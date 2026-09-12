import { afterAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/modules/identity/security.js';
import type { AppConfig } from '../src/config/env.js';

const config: AppConfig = {
  NODE_ENV: 'test',
  API_HOST: '127.0.0.1',
  API_PORT: 3000,
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  SESSION_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  CORS_ORIGIN: 'http://localhost:5173',
  DEFAULT_LOCALE: 'en-US',
};

const passwordHash = await hashPassword('correct horse battery staple');
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  locationId: null,
  email: 'owner@example.test',
  passwordHash,
  displayName: 'Pharmacy Owner',
  preferredLocale: 'en-US',
  status: 'ACTIVE' as const,
  failedLoginAttempts: 0,
  lockedUntil: null,
};

const database = {
  user: {
    findUnique: async () => user,
    findUniqueOrThrow: async () => user,
    update: async () => user,
  },
  session: {
    create: async () => ({ id: 'session-id' }),
    findUnique: async () => ({
      id: 'session-id',
      userId: user.id,
      revokedAt: null,
    }),
    update: async () => ({ id: 'session-id' }),
  },
  auditEvent: {
    create: async () => ({ id: 'audit-id' }),
  },
  $transaction: async (operation: unknown) => {
    if (typeof operation === 'function') return operation(database);
    return operation;
  },
} as unknown as PrismaClient;

const app = buildApp(config, database);

describe('authentication endpoints', () => {
  it('logs in with valid credentials and sets an httpOnly session cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        organizationId: user.organizationId,
        email: user.email,
        password: 'correct horse battery staple',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe(user.email);
    expect(response.headers['set-cookie']).toContain('HttpOnly');
  });

  it('revokes a server-side session on logout', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { pharmapms_session: 'session-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true });
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
  });

  it('localizes validation errors from the requested locale', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-ui-locale': 'ar-SA' },
      payload: { organizationId: 'not-an-id', email: 'invalid', password: '' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().locale).toBe('ar-SA');
    expect(response.json().message).toBe('تحتاج بعض الحقول إلى المراجعة.');
    expect(response.json().details[0].message).toBe(
      'تنسيق هذه القيمة غير صحيح.',
    );
  });

  it('does not reveal whether credentials or the account are invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'accept-language': 'de-DE' },
      payload: {
        organizationId: user.organizationId,
        email: user.email,
        password: 'wrong password',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'INVALID_CREDENTIALS',
      locale: 'de-DE',
      message: 'E-Mail-Adresse oder Passwort ist falsch.',
    });
  });
});

afterAll(async () => {
  await app.close();
});
