import { describe, expect, it, vi } from 'vitest';
import {
  assertLocationAccess,
  AuthorizationError,
} from '../src/modules/identity/authorization.js';
import { createStockTransfer } from '../src/modules/inventory/transfers.service.js';
import type { PrismaClient } from '@prisma/client';

const asDb = (value: unknown) => value as PrismaClient;

describe('multi-branch transfer boundaries', () => {
  it('prevents a branch user from selecting another branch', () => {
    expect(() =>
      assertLocationAccess({ locationId: 'branch-a' }, 'branch-b'),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertLocationAccess({ locationId: 'branch-a' }, 'branch-a'),
    ).not.toThrow();
    expect(() =>
      assertLocationAccess(
        {
          locationId: 'branch-a',
          roles: [{ role: { name: 'administrator' } }],
        },
        'branch-b',
      ),
    ).not.toThrow();
  });

  it('rejects same-location or cross-organization transfer requests before creating records', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'branch-a' }]);
    const db = asDb({
      $transaction: async (callback: (tx: unknown) => unknown) =>
        callback({ location: { findMany } }),
    });
    await expect(
      createStockTransfer(db, {
        organizationId: 'org',
        actorUserId: 'user',
        sourceLocationId: 'branch-a',
        destinationLocationId: 'branch-a',
        reason: 'restock',
        items: [{ productId: 'product', sourceBatchId: 'batch', quantity: 1 }],
      }),
    ).rejects.toThrow('different');
    await expect(
      createStockTransfer(db, {
        organizationId: 'org',
        actorUserId: 'user',
        sourceLocationId: 'branch-a',
        destinationLocationId: 'branch-b',
        reason: 'restock',
        items: [{ productId: 'product', sourceBatchId: 'batch', quantity: 1 }],
      }),
    ).rejects.toThrow('Both transfer locations');
  });
});
