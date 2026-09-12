import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  adjustStock,
  allocateFefo,
  InventoryBusinessError,
  receiveStock,
  selectFefo,
} from '../src/modules/inventory/inventory.service.js';
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

describe('inventory calculations', () => {
  it('allocates requested stock in expiry order without exceeding a batch', () => {
    const result = allocateFefo(
      [
        { quantity: 3, lot: 'earliest' },
        { quantity: 10, lot: 'later' },
      ],
      8,
    );

    expect(result).toEqual([
      { quantity: 3, lot: 'earliest', allocatedQuantity: 3 },
      { quantity: 10, lot: 'later', allocatedQuantity: 5 },
    ]);
  });

  it('rejects invalid receiving quantities before opening a transaction', async () => {
    const database = {
      $transaction: async () => undefined,
    } as unknown as PrismaClient;

    await expect(
      receiveStock(database, {
        organizationId: 'org-id',
        actorUserId: 'user-id',
        productId: 'product-id',
        locationId: 'location-id',
        lotNumber: 'LOT-1',
        expiryDate: new Date(Date.now() + 86_400_000),
        quantity: 0,
        reason: 'Receiving',
      }),
    ).rejects.toBeInstanceOf(InventoryBusinessError);
  });

  it('records receiving as a positive balance and immutable movement', async () => {
    const database = {
      $transaction: async (operation: (tx: unknown) => unknown) =>
        operation(database),
      product: { findFirst: async () => ({ id: 'product-id' }) },
      location: { findFirst: async () => ({ id: 'location-id' }) },
      batch: {
        findUnique: async () => undefined,
        create: async () => ({
          id: 'batch-id',
          expiryDate: new Date(Date.now() + 86_400_000),
        }),
      },
      inventoryBalance: { upsert: async () => ({ quantity: 10 }) },
      stockMovement: {
        create: async ({ data }: { data: { quantityDelta: number } }) => ({
          id: 'movement-id',
          quantityDelta: data.quantityDelta,
        }),
      },
      auditEvent: { create: async () => ({ id: 'audit-id' }) },
    } as unknown as PrismaClient;

    const result = await receiveStock(database, {
      organizationId: 'org-id',
      actorUserId: 'user-id',
      productId: 'product-id',
      locationId: 'location-id',
      lotNumber: 'LOT-1',
      expiryDate: new Date(Date.now() + 86_400_000),
      quantity: 10,
      reason: 'Supplier receiving',
    });

    expect(result.movement.quantityDelta).toBe(10);
  });

  it('rejects a decrease that would make a balance negative', async () => {
    const database = {
      $transaction: async (operation: (tx: unknown) => unknown) =>
        operation(database),
      batch: {
        findFirst: async () => ({
          id: 'batch-id',
          productId: 'product-id',
          locationId: 'location-id',
        }),
      },
      inventoryBalance: { updateMany: async () => ({ count: 0 }) },
    } as unknown as PrismaClient;

    await expect(
      adjustStock(database, {
        organizationId: 'org-id',
        actorUserId: 'user-id',
        batchId: 'batch-id',
        stockStatus: 'AVAILABLE',
        quantityDelta: -1,
        reason: 'Correction',
      }),
    ).rejects.toBeInstanceOf(InventoryBusinessError);
  });

  it('selects only available, non-expired balances and returns allocations', async () => {
    const database = {
      inventoryBalance: {
        findMany: async () => [
          {
            quantity: 4,
            batch: {
              expiryDate: new Date('2027-01-01'),
              createdAt: new Date('2026-01-01'),
            },
          },
          {
            quantity: 9,
            batch: {
              expiryDate: new Date('2027-02-01'),
              createdAt: new Date('2026-01-02'),
            },
          },
        ],
      },
    } as unknown as PrismaClient;

    const result = await selectFefo(database, {
      organizationId: 'org-id',
      productId: 'product-id',
      locationId: 'location-id',
      quantity: 6,
    });
    expect(result.map((item) => item.allocatedQuantity)).toEqual([4, 2]);
  });
});

describe('inventory API authorization', () => {
  it('requires inventory permission', async () => {
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
                  permissions: [{ permission: { code: 'catalog:read' } }],
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
      url: '/api/v1/inventory',
      cookies: { pharmapms_session: 'token' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
