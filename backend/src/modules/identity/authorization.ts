import type { FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser } from './auth.service.js';

export class AuthorizationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireUser(request: FastifyRequest, db: PrismaClient) {
  const user = await getAuthenticatedUser(request, db);
  if (!user) throw new AuthorizationError();
  return user;
}

export function assertLocationAccess(
  user: {
    locationId: string | null;
    roles?: Array<{ role: { name: string } }>;
  },
  locationId: string,
) {
  const isAdministrator = user.roles?.some(
    ({ role }) => role.name === 'administrator',
  );
  if (!isAdministrator && user.locationId && user.locationId !== locationId) {
    throw new AuthorizationError('Location access required');
  }
}

export function scopeLocationId(
  user: {
    locationId: string | null;
    roles?: Array<{ role: { name: string } }>;
  },
  requestedLocationId?: string,
) {
  const isAdministrator = user.roles?.some(
    ({ role }) => role.name === 'administrator',
  );
  if (isAdministrator) return requestedLocationId;
  if (
    user.locationId &&
    requestedLocationId &&
    user.locationId !== requestedLocationId
  ) {
    throw new AuthorizationError('Location access required');
  }
  return user.locationId ?? requestedLocationId;
}

export async function requirePermission(
  request: FastifyRequest,
  db: PrismaClient,
  permissionCode: string,
) {
  const user = await requireUser(request, db);
  const permissions = new Set(
    user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.code),
    ),
  );
  if (!permissions.has(permissionCode)) {
    throw new AuthorizationError('Insufficient permissions');
  }
  return user;
}
