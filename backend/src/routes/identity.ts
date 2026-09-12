import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAuditEvent } from '../modules/audit/audit.service.js';
import {
  authenticate,
  beginMfaEnrollment,
  completeMfaLogin,
  confirmMfaEnrollment,
  AuthenticationError,
  bootstrapOrganization,
  getAuthenticatedUser,
  InactiveUserError,
  revokeSession,
  serializeUser,
  sessionCookieOptions,
} from '../modules/identity/auth.service.js';
import { requirePermission } from '../modules/identity/authorization.js';
import { hashPassword } from '../modules/identity/security.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import { supportedLocales } from '../modules/localization/locale.js';
import type { PrismaClient } from '@prisma/client';

const bootstrapSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  defaultLocale: z
    .string()
    .min(2)
    .max(16)
    .refine((locale) => locale in supportedLocales, 'Unsupported locale'),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase()),
  timezone: z.string().min(1).max(80),
  locationName: z.string().trim().min(2).max(160),
  locationCode: z.string().trim().min(1).max(32),
  displayName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

const loginSchema = z.object({
  organizationId: z.string().uuid(),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(160),
  password: z.string().min(12).max(128),
  preferredLocale: z
    .string()
    .min(2)
    .max(16)
    .refine((locale) => locale in supportedLocales, 'Unsupported locale'),
  locationId: z.string().uuid().nullable().optional(),
  roleId: z.string().uuid().optional(),
});

const updateUserSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']).optional(),
    preferredLocale: z
      .string()
      .min(2)
      .max(16)
      .refine((locale) => locale in supportedLocales, 'Unsupported locale')
      .optional(),
    displayName: z.string().trim().min(2).max(160).optional(),
    locationId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one update is required',
  );

export function registerIdentityRoutes(
  app: FastifyInstance,
  db: PrismaClient,
  isProduction: boolean,
) {
  app.get('/auth/bootstrap/status', async () => ({
    setupRequired: (await db.organization.count()) === 0,
  }));

  app.post('/auth/bootstrap', async (request, reply) => {
    const input = bootstrapSchema.parse(request.body);
    const result = await bootstrapOrganization(db, input);
    return reply.code(201).send({
      organization: result.organization,
      location: result.location,
      user: serializeUser(result.user),
    });
  });

  app.post('/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await authenticate(db, input);
    reply.setCookie(
      'pharmapms_session',
      result.token,
      sessionCookieOptions(isProduction),
    );
    return {
      user: serializeUser(result.user),
      expiresAt: result.expiresAt.toISOString(),
    };
  });

  app.post('/auth/login/mfa', async (request, reply) => {
    const input = z
      .object({
        challengeToken: z.string().min(20).max(200),
        code: z.string().regex(/^\d{6}$/).optional(),
        recoveryCode: z.string().regex(/^[A-Za-z0-9-]{6,20}$/).optional(),
      })
      .refine((value) => value.code || value.recoveryCode, 'MFA code is required')
      .parse(request.body);
    const result = await completeMfaLogin(db, input);
    reply.setCookie(
      'pharmapms_session',
      result.token,
      sessionCookieOptions(isProduction),
    );
    return {
      user: serializeUser(result.user),
      expiresAt: result.expiresAt.toISOString(),
    };
  });

  app.get('/auth/mfa/status', async (request, reply) => {
    const user = await getAuthenticatedUser(request, db);
    if (!user) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    return {
      enrolled: Boolean(user.mfa?.confirmedAt),
      organizationEnforced: user.organization.mfaEnforced,
    };
  });

  app.post('/auth/mfa/enroll', async (request, reply) => {
    const user = await getAuthenticatedUser(request, db);
    if (!user) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    return beginMfaEnrollment(db, user.id);
  });

  app.post('/auth/mfa/confirm', async (request, reply) => {
    const user = await getAuthenticatedUser(request, db);
    if (!user) return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    const input = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(request.body);
    const recoveryCodes = await confirmMfaEnrollment(db, user.id, input.code);
    return { recoveryCodes };
  });

  app.patch('/organization/mfa-policy', async (request) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.ORGANIZATION_UPDATE,
    );
    const input = z.object({ enforced: z.boolean() }).parse(request.body);
    const organization = await db.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id: actor.organizationId },
        data: { mfaEnforced: input.enforced },
      });
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'auth.mfa_policy_change',
        entityType: 'Organization',
        entityId: actor.organizationId,
        metadata: { enforced: input.enforced },
      });
      return result;
    });
    return { enforced: organization.mfaEnforced };
  });

  app.post('/users/:userId/mfa/reset', async (request) => {
    const actor = await requirePermission(request, db, PERMISSIONS.ROLES_MANAGE);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
    await db.$transaction(async (tx) => {
      const target = await tx.user.findFirstOrThrow({
        where: { id: userId, organizationId: actor.organizationId },
      });
      await tx.userMfa.deleteMany({ where: { userId: target.id } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: target.id } });
      await tx.mfaChallenge.deleteMany({ where: { userId: target.id } });
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'auth.mfa_admin_reset',
        entityType: 'UserMfa',
        entityId: target.id,
      });
    });
    return { success: true };
  });

  app.post('/auth/logout', async (request, reply) => {
    await revokeSession(request, db);
    reply.clearCookie('pharmapms_session', { path: '/' });
    return { success: true };
  });

  app.get('/auth/me', async (request, reply) => {
    const user = await getAuthenticatedUser(request, db);
    if (!user)
      return reply.code(401).send({ error: 'AUTHENTICATION_REQUIRED' });
    return {
      user: serializeUser(user),
      organization: user.organization,
      location: user.location,
    };
  });

  app.get('/users', async (request) => {
    const actor = await requirePermission(request, db, PERMISSIONS.USERS_READ);
    const users = await db.user.findMany({
      where: { organizationId: actor.organizationId },
      select: {
        id: true,
        email: true,
        displayName: true,
        preferredLocale: true,
        status: true,
        locationId: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: { displayName: 'asc' },
    });
    return { users };
  });

  app.post('/users', async (request, reply) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.USERS_CREATE,
    );
    const input = createUserSchema.parse(request.body);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          organizationId: actor.organizationId,
          locationId: input.locationId,
          email: input.email,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
          preferredLocale: input.preferredLocale,
          status: 'ACTIVE',
        },
      });
      if (input.roleId) {
        const role = await tx.role.findFirstOrThrow({
          where: { id: input.roleId, organizationId: actor.organizationId },
        });
        await tx.userRole.create({
          data: { userId: created.id, roleId: role.id },
        });
      }
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.create',
        entityType: 'User',
        entityId: created.id,
      });
      return created;
    });
    return reply.code(201).send({ user: serializeUser(user) });
  });

  app.patch('/users/:userId', async (request) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.USERS_UPDATE,
    );
    const { userId } = z
      .object({ userId: z.string().uuid() })
      .parse(request.params);
    const input = updateUserSchema.parse(request.body);
    const current = await db.user.findFirstOrThrow({
      where: { id: userId, organizationId: actor.organizationId },
    });
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: current.id },
        data: input,
      });
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: input.status ? 'user.status_change' : 'user.update',
        entityType: 'User',
        entityId: result.id,
        metadata: { changedFields: Object.keys(input) },
      });
      return result;
    });
    return { user: serializeUser(updated) };
  });

  app.get('/permissions', async (request) => {
    await requirePermission(request, db, PERMISSIONS.ROLES_MANAGE);
    return { permissions: await db.permission.findMany({ orderBy: { code: 'asc' } }) };
  });

  app.get('/roles', async (request) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.ROLES_MANAGE,
    );
    const roles = await db.role.findMany({
      where: { organizationId: actor.organizationId },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return { roles };
  });

  app.put('/roles/:roleId/permissions', async (request) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.ROLES_MANAGE,
    );
    const { roleId } = z
      .object({ roleId: z.string().uuid() })
      .parse(request.params);
    const input = z
      .object({ permissionIds: z.array(z.string().uuid()).max(100) })
      .parse(request.body);
    await db.$transaction(async (tx) => {
      const role = await tx.role.findFirstOrThrow({
        where: { id: roleId, organizationId: actor.organizationId },
      });
      const permissions = await tx.permission.findMany({
        where: { id: { in: input.permissionIds } },
      });
      if (permissions.length !== new Set(input.permissionIds).size)
        throw new Error('One or more permissions do not exist');
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map(({ id }) => ({
          roleId: role.id,
          permissionId: id,
        })),
      });
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'role.permissions_change',
        entityType: 'Role',
        entityId: role.id,
        metadata: { permissionIds: input.permissionIds },
      });
    });
    return { success: true };
  });

  app.post('/users/:userId/roles/:roleId', async (request) => {
    const actor = await requirePermission(
      request,
      db,
      PERMISSIONS.ROLES_MANAGE,
    );
    const params = z
      .object({ userId: z.string().uuid(), roleId: z.string().uuid() })
      .parse(request.params);
    await db.$transaction(async (tx) => {
      const user = await tx.user.findFirstOrThrow({
        where: { id: params.userId, organizationId: actor.organizationId },
      });
      const role = await tx.role.findFirstOrThrow({
        where: { id: params.roleId, organizationId: actor.organizationId },
      });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
      await recordAuditEvent(tx, {
        organizationId: actor.organizationId,
        actorUserId: actor.id,
        action: 'user.role_assign',
        entityType: 'UserRole',
        metadata: { userId: user.id, roleId: role.id },
      });
    });
    return { success: true };
  });
}

export { AuthenticationError, InactiveUserError };
