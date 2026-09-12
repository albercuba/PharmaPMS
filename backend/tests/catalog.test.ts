import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  buildSearchText,
  createProduct,
} from '../src/modules/catalog/catalog.service.js';
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

describe('catalog business rules', () => {
  it('builds an indexed search document from identifiers and translations', () => {
    expect(
      buildSearchText({
        sku: 'SKU-001',
        barcodes: [{ value: '04012345678901' }],
        translations: [
          {
            locale: 'en-US',
            displayName: 'Amoxicillin 500 mg',
            genericName: 'Amoxicillin',
            brandName: 'Example',
          },
        ],
      }),
    ).toContain('sku-001 amoxicillin 500 mg');
  });

  it('creates a product, medicine relation, ingredients, and audit event transactionally', async () => {
    const createdProduct = { id: 'product-id' };
    const database = {
      $transaction: async (operation: (tx: unknown) => unknown) =>
        operation(database),
      manufacturer: {
        findUnique: async () => undefined,
        create: async () => ({ id: 'manufacturer-id' }),
      },
      product: {
        create: async ({ data }: { data: { searchText: string } }) => ({
          ...createdProduct,
          searchText: data.searchText,
        }),
      },
      activeIngredient: { upsert: async () => ({ id: 'ingredient-id' }) },
      medicineIngredient: { create: async () => ({}) },
      auditEvent: { create: async () => ({ id: 'audit-id' }) },
    } as unknown as PrismaClient;

    const result = await createProduct(database, 'org-id', 'user-id', {
      productType: 'MEDICINE',
      translations: [{ locale: 'en-US', displayName: 'Amoxicillin 500 mg' }],
      medicine: {
        prescriptionClass: 'PRESCRIPTION_ONLY',
        controlledDrugClass: 'NONE',
        ingredients: [
          { canonicalName: 'Amoxicillin', strength: '500', unit: 'mg' },
        ],
      },
    });

    expect(result.id).toBe('product-id');
    expect(result.searchText).toContain('amoxicillin 500 mg');
  });
});

describe('catalog API authorization', () => {
  it('requires catalog permission for product listing', async () => {
    const database = {
      session: {
        findUnique: async () => ({
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: 'user-id',
            organizationId: 'org-id',
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
    } as unknown as PrismaClient;
    const app = buildApp(config, database);
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/products',
      cookies: { pharmapms_session: 'token' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
