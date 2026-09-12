import { describe, expect, it, vi } from 'vitest';

const { appendMovement } = vi.hoisted(() => ({
  appendMovement: vi.fn().mockResolvedValue({ id: 'movement' }),
}));
vi.mock('../src/modules/inventory/inventory.service.js', () => ({
  appendInventoryMovementInTransaction: appendMovement,
}));

import { completeStockTransfer } from '../src/modules/inventory/transfers.service.js';
import type { PrismaClient } from '@prisma/client';

const asDb = (value: unknown) => value as PrismaClient;

describe('transactional stock transfer completion', () => {
  it('writes paired source and destination movements and preserves batch identity', async () => {
    appendMovement.mockClear();
    const tx = {
      stockTransfer: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'transfer',
          status: 'DRAFT',
          sourceLocationId: 'source',
          destinationLocationId: 'destination',
          reason: 'branch restock',
          items: [
            {
              id: 'item',
              productId: 'product',
              sourceBatchId: 'source-batch',
              quantity: 3,
            },
          ],
        }),
        update: vi
          .fn()
          .mockResolvedValue({ id: 'transfer', status: 'COMPLETED' }),
      },
      batch: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'source-batch',
          productId: 'product',
          lotNumber: 'LOT-1',
          expiryDate: new Date('2030-01-01'),
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'destination-batch' }),
      },
      stockTransferItem: { update: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = asDb({
      $transaction: async (callback: (transaction: unknown) => unknown) =>
        callback(tx),
    });
    await completeStockTransfer(db, {
      organizationId: 'org',
      actorUserId: 'user',
      transferId: 'transfer',
    });
    expect(appendMovement).toHaveBeenCalledTimes(2);
    expect(appendMovement).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({
        batchId: 'source-batch',
        locationId: 'source',
        quantityDelta: -3,
        transferId: 'transfer',
        movementType: 'TRANSFER',
      }),
    );
    expect(appendMovement).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({
        batchId: 'destination-batch',
        locationId: 'destination',
        quantityDelta: 3,
        transferId: 'transfer',
        movementType: 'TRANSFER',
      }),
    );
    expect(tx.stockTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'transfer' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });
});
