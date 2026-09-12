import { describe, expect, it } from 'vitest';
import { requirePermission } from '../src/modules/identity/authorization.js';
import { AuthorizationError } from '../src/modules/identity/authorization.js';
import type { PrismaClient } from '@prisma/client';

function databaseForPermissions(codes: string[]) {
  return {
    session: {
      findUnique: async () => ({
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'user-id',
          organizationId: 'org-id',
          status: 'ACTIVE',
          roles: codes.map((code) => ({
            role: { permissions: [{ permission: { code } }] },
          })),
        },
      }),
    },
  } as unknown as PrismaClient;
}

describe('server-side authorization', () => {
  it('allows a user with the requested permission', async () => {
    const user = await requirePermission(
      { cookies: { pharmapms_session: 'token' } } as never,
      databaseForPermissions(['users:read']),
      'users:read',
    );

    expect(user.id).toBe('user-id');
  });

  it('rejects a user without the requested permission', async () => {
    await expect(
      requirePermission(
        { cookies: { pharmapms_session: 'token' } } as never,
        databaseForPermissions(['organization:read']),
        'users:read',
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
