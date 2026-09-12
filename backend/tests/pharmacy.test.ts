import { afterAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
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

const database = {
  session: {
    findUnique: async () => ({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
        status: 'ACTIVE',
        roles: [
          {
            role: {
              permissions: [{ permission: { code: 'organization:read' } }],
            },
          },
        ],
      },
    }),
  },
  organization: {
    findUniqueOrThrow: async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      name: 'PharmaPMS Demo Pharmacy',
      countryCode: 'DE',
      defaultLocale: 'en-US',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
      status: 'ACTIVE',
    }),
  },
} as unknown as PrismaClient;

const app = buildApp(config, database);

describe('pharmacy configuration', () => {
  it('returns country, language, currency, and timezone as separate values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/organization',
      cookies: { pharmapms_session: 'valid-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().organization).toMatchObject({
      countryCode: 'DE',
      defaultLocale: 'en-US',
      currency: 'EUR',
      timezone: 'Europe/Berlin',
    });
  });
});

afterAll(async () => {
  await app.close();
});
