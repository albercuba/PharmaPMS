import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { recordAuditEvent } from '../audit/audit.service.js';
import { ROLE_PERMISSIONS, SYSTEM_ROLES } from './permissions.js';
import {
  createSessionToken,
  createOtpAuthUri,
  createRecoveryCodes,
  createTotpSecret,
  decryptMfaSecret,
  encryptMfaSecret,
  hashPassword,
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  verifyPassword,
  verifyTotp,
} from './security.js';

export type IdentityDatabase = PrismaClient | Prisma.TransactionClient;

export class AuthenticationError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class InactiveUserError extends Error {
  constructor() {
    super('User account is inactive');
    this.name = 'InactiveUserError';
  }
}

export class AccountLockedError extends Error {
  constructor() {
    super('User account is temporarily locked');
    this.name = 'AccountLockedError';
  }
}

export class MfaChallengeRequiredError extends Error {
  readonly challengeToken: string;
  constructor(challengeToken: string) {
    super('MFA verification required');
    this.name = 'MfaChallengeRequiredError';
    this.challengeToken = challengeToken;
  }
}

export class MfaEnrollmentRequiredError extends Error {
  constructor() {
    super('MFA enrollment required');
    this.name = 'MfaEnrollmentRequiredError';
  }
}

export async function bootstrapOrganization(
  db: PrismaClient,
  input: {
    organizationName: string;
    countryCode: string;
    defaultLocale: string;
    currency: string;
    timezone: string;
    locationName: string;
    locationCode: string;
    displayName: string;
    email: string;
    password: string;
  },
) {
  return db.$transaction(async (tx) => {
    if ((await tx.organization.count()) > 0) {
      throw new Error('Organization bootstrap has already been completed');
    }

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        countryCode: input.countryCode,
        defaultLocale: input.defaultLocale,
        currency: input.currency,
        timezone: input.timezone,
      },
    });
    const location = await tx.location.create({
      data: {
        organizationId: organization.id,
        name: input.locationName,
        code: input.locationCode,
        timezone: input.timezone,
      },
    });
    await tx.register.create({
      data: {
        organizationId: organization.id,
        locationId: location.id,
        name: 'Main register',
        code: 'MAIN',
      },
    });
    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        locationId: location.id,
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        preferredLocale: input.defaultLocale,
        status: 'ACTIVE',
      },
    });

    await tx.permission.createMany({
      data: Object.values(ROLE_PERMISSIONS)
        .flat()
        .filter((code, index, all) => all.indexOf(code) === index)
        .map((code) => ({
          code,
          description: `Permission: ${code}`,
        })),
      skipDuplicates: true,
    });
    const permissions = await tx.permission.findMany();

    for (const [roleName, permissionCodes] of Object.entries(
      ROLE_PERMISSIONS,
    )) {
      const role = await tx.role.create({
        data: {
          organizationId: organization.id,
          name: roleName,
          description: `System role: ${roleName}`,
        },
      });
      await tx.rolePermission.createMany({
        data: permissions
          .filter((permission) => permissionCodes.includes(permission.code))
          .map((permission) => ({
            roleId: role.id,
            permissionId: permission.id,
          })),
      });
      if (roleName === SYSTEM_ROLES.ADMINISTRATOR) {
        await tx.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }

    await recordAuditEvent(tx, {
      organizationId: organization.id,
      actorUserId: user.id,
      action: 'organization.bootstrap',
      entityType: 'Organization',
      entityId: organization.id,
      metadata: { locationId: location.id },
    });

    return { organization, location, user };
  });
}

export async function authenticate(
  db: PrismaClient,
  input: { organizationId: string; email: string; password: string },
) {
  const user = await db.user.findUnique({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.email,
      },
    },
    include: { organization: true, mfa: true },
  });

  if (!user || !user.passwordHash) {
    throw new AuthenticationError();
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAuditEvent(db, {
      organizationId: user.organizationId,
      action: 'auth.login_locked_account',
      entityType: 'User',
      entityId: user.id,
      outcome: 'FAILURE',
    });
    throw new AccountLockedError();
  }
  if (user.status !== 'ACTIVE') {
    await recordAuditEvent(db, {
      organizationId: user.organizationId,
      action: 'auth.login_inactive_user',
      entityType: 'User',
      entityId: user.id,
      outcome: 'FAILURE',
    });
    throw new InactiveUserError();
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts, lockedUntil },
      });
      await recordAuditEvent(tx, {
        organizationId: user.organizationId,
        action:
          failedLoginAttempts >= 5
            ? 'auth.account_locked'
            : 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        outcome: 'FAILURE',
        metadata: { failedLoginAttempts },
      });
    });
    if (lockedUntil) throw new AccountLockedError();
    throw new AuthenticationError();
  }

  const mfa = user.mfa;
  if (user.organization?.mfaEnforced && !mfa?.confirmedAt) {
    throw new MfaEnrollmentRequiredError();
  }
  if (mfa?.confirmedAt) {
    const challengeToken = createSessionToken();
    await db.mfaChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(challengeToken),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await recordAuditEvent(db, {
      organizationId: user.organizationId,
      action: 'auth.mfa_challenge_issued',
      entityType: 'User',
      entityId: user.id,
    });
    throw new MfaChallengeRequiredError(challengeToken);
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.$transaction(async (tx) => {
    await tx.session.create({
      data: { userId: user.id, tokenHash: hashSessionToken(token), expiresAt },
    });
    await tx.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await recordAuditEvent(tx, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
    });
  });

  return { token, expiresAt, user };
}

export async function beginMfaEnrollment(
  db: PrismaClient,
  userId: string,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const secret = createTotpSecret();
  await db.userMfa.upsert({
    where: { userId },
    create: { userId, secretCipher: encryptMfaSecret(secret) },
    update: { secretCipher: encryptMfaSecret(secret), confirmedAt: null },
  });
  await recordAuditEvent(db, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    action: 'auth.mfa_enrollment_started',
    entityType: 'UserMfa',
    entityId: user.id,
  });
  return { secret, otpauthUri: createOtpAuthUri(user.email, secret) };
}

export async function confirmMfaEnrollment(
  db: PrismaClient,
  userId: string,
  code: string,
) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const factor = await db.userMfa.findUniqueOrThrow({ where: { userId } });
  if (!verifyTotp(decryptMfaSecret(factor.secretCipher), code)) {
    await recordAuditEvent(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.mfa_enrollment_failed',
      entityType: 'UserMfa',
      entityId: user.id,
      outcome: 'FAILURE',
    });
    throw new AuthenticationError('Invalid MFA code');
  }
  const codes = createRecoveryCodes();
  await db.$transaction(async (tx) => {
    await tx.userMfa.update({
      where: { userId },
      data: { confirmedAt: new Date() },
    });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.createMany({
      data: await Promise.all(
        codes.map(async (code) => ({
          userId,
          codeHash: await hashPassword(code),
        })),
      ),
    });
    await recordAuditEvent(tx, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'auth.mfa_enrollment_confirmed',
      entityType: 'UserMfa',
      entityId: user.id,
    });
  });
  return codes;
}

export async function completeMfaLogin(
  db: PrismaClient,
  input: { challengeToken: string; code?: string; recoveryCode?: string },
) {
  const challenge = await db.mfaChallenge.findUnique({
    where: { tokenHash: hashSessionToken(input.challengeToken) },
    include: { user: { include: { organization: true, mfa: true } } },
  });
  if (
    !challenge ||
    challenge.consumedAt ||
    challenge.expiresAt <= new Date() ||
    challenge.attempts >= 5 ||
    challenge.user.status !== 'ACTIVE' ||
    !challenge.user.mfa?.confirmedAt
  ) {
    throw new AuthenticationError('Invalid MFA code');
  }

  let valid = Boolean(
    input.code && verifyTotp(
      decryptMfaSecret(challenge.user.mfa.secretCipher),
      input.code,
    ),
  );
  let recoveryId: string | undefined;
  if (!valid && input.recoveryCode) {
    const recoveryCodes = await db.mfaRecoveryCode.findMany({
      where: { userId: challenge.userId, usedAt: null },
    });
    for (const recovery of recoveryCodes) {
      if (await verifyPassword(recovery.codeHash, input.recoveryCode.trim().toUpperCase())) {
        valid = true;
        recoveryId = recovery.id;
        break;
      }
    }
  }
  if (!valid) {
    await db.mfaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    await recordAuditEvent(db, {
      organizationId: challenge.user.organizationId,
      action: 'auth.mfa_challenge_failed',
      entityType: 'User',
      entityId: challenge.userId,
      outcome: 'FAILURE',
    });
    throw new AuthenticationError('Invalid MFA code');
  }

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.$transaction(async (tx) => {
    await tx.mfaChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    if (recoveryId) {
      await tx.mfaRecoveryCode.update({
        where: { id: recoveryId },
        data: { usedAt: new Date() },
      });
    }
    await tx.session.create({
      data: {
        userId: challenge.userId,
        tokenHash: hashSessionToken(token),
        expiresAt,
      },
    });
    await recordAuditEvent(tx, {
      organizationId: challenge.user.organizationId,
      actorUserId: challenge.userId,
      action: 'auth.mfa_login',
      entityType: 'User',
      entityId: challenge.userId,
      metadata: { recoveryCode: Boolean(recoveryId) },
    });
  });
  return { token, expiresAt, user: challenge.user };
}

export async function getAuthenticatedUser(
  request: FastifyRequest,
  db: PrismaClient,
) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        include: {
          organization: true,
          mfa: true,
          location: true,
          roles: {
            include: {
              role: {
                include: { permissions: { include: { permission: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== 'ACTIVE'
  ) {
    return null;
  }
  return session.user;
}

export async function revokeSession(request: FastifyRequest, db: PrismaClient) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });
  if (!session || session.revokedAt) return null;
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: session.userId },
    });
    await tx.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      organizationId: user.organizationId,
      actorUserId: session.userId,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: session.id,
    });
  });
  return session;
}

export function serializeUser(user: {
  id: string;
  organizationId: string;
  locationId: string | null;
  email: string;
  displayName: string;
  preferredLocale: string;
  status: string;
}) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    locationId: user.locationId,
    email: user.email,
    displayName: user.displayName,
    preferredLocale: user.preferredLocale,
    status: user.status,
  };
}

export const sessionCookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DURATION_MS / 1000,
});
