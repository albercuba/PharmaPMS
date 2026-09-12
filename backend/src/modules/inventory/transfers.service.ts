import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';
import { appendInventoryMovementInTransaction } from './inventory.service.js';

type Db = PrismaClient | Prisma.TransactionClient;
export class TransferBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferBusinessError';
  }
}

type TransferItemInput = {
  productId: string;
  sourceBatchId: string;
  quantity: number;
};
async function validateLocations(
  db: Db,
  organizationId: string,
  sourceLocationId: string,
  destinationLocationId: string,
) {
  if (sourceLocationId === destinationLocationId)
    throw new TransferBusinessError('Transfer locations must be different');
  const locations = await db.location.findMany({
    where: {
      organizationId,
      id: { in: [sourceLocationId, destinationLocationId] },
    },
    select: { id: true },
  });
  if (locations.length !== 2)
    throw new TransferBusinessError(
      'Both transfer locations must belong to the organization',
    );
}

export async function createStockTransfer(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    sourceLocationId: string;
    destinationLocationId: string;
    reason: string;
    items: TransferItemInput[];
  },
) {
  if (
    !input.reason.trim() ||
    input.items.length === 0 ||
    input.items.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity <= 0,
    )
  )
    throw new TransferBusinessError(
      'A reason and positive transfer quantities are required',
    );
  return db.$transaction(async (tx) => {
    await validateLocations(
      tx,
      input.organizationId,
      input.sourceLocationId,
      input.destinationLocationId,
    );
    for (const item of input.items) {
      const batch = await tx.batch.findFirst({
        where: {
          id: item.sourceBatchId,
          organizationId: input.organizationId,
          productId: item.productId,
          locationId: input.sourceLocationId,
        },
      });
      if (!batch)
        throw new TransferBusinessError(
          'A source batch does not belong to the source location',
        );
    }
    const transfer = await tx.stockTransfer.create({
      data: {
        organizationId: input.organizationId,
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
        createdByUserId: input.actorUserId,
        reason: input.reason,
        items: { create: input.items },
      },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.transfer_create',
      entityType: 'StockTransfer',
      entityId: transfer.id,
      metadata: {
        sourceLocationId: input.sourceLocationId,
        destinationLocationId: input.destinationLocationId,
        itemCount: input.items.length,
      },
    });
    return transfer;
  });
}

export async function completeStockTransfer(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    transferId: string;
    allowedLocationId?: string;
  },
) {
  return db.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findFirst({
      where: { id: input.transferId, organizationId: input.organizationId },
      include: { items: true },
    });
    if (!transfer) throw new TransferBusinessError('Transfer was not found');
    if (
      input.allowedLocationId &&
      input.allowedLocationId !== transfer.sourceLocationId &&
      input.allowedLocationId !== transfer.destinationLocationId
    ) {
      throw new TransferBusinessError(
        'You do not have access to this transfer location',
      );
    }
    if (transfer.status !== 'DRAFT')
      throw new TransferBusinessError('Only draft transfers can be completed');
    for (const item of transfer.items) {
      const source = await tx.batch.findFirst({
        where: {
          id: item.sourceBatchId,
          organizationId: input.organizationId,
          locationId: transfer.sourceLocationId,
          productId: item.productId,
        },
      });
      if (!source)
        throw new TransferBusinessError(
          'A source batch is no longer available',
        );
      const destination = await tx.batch.upsert({
        where: {
          organizationId_productId_locationId_lotNumber: {
            organizationId: input.organizationId,
            productId: item.productId,
            locationId: transfer.destinationLocationId,
            lotNumber: source.lotNumber,
          },
        },
        create: {
          organizationId: input.organizationId,
          productId: item.productId,
          locationId: transfer.destinationLocationId,
          lotNumber: source.lotNumber,
          expiryDate: source.expiryDate,
        },
        update: { expiryDate: source.expiryDate },
      });
      await tx.stockTransferItem.update({
        where: { id: item.id },
        data: { destinationBatchId: destination.id },
      });
      await appendInventoryMovementInTransaction(tx, {
        organizationId: input.organizationId,
        productId: item.productId,
        batchId: source.id,
        locationId: transfer.sourceLocationId,
        actorUserId: input.actorUserId,
        movementType: 'TRANSFER',
        stockStatus: 'AVAILABLE',
        quantityDelta: -item.quantity,
        reason: transfer.reason,
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        transferId: transfer.id,
      });
      await appendInventoryMovementInTransaction(tx, {
        organizationId: input.organizationId,
        productId: item.productId,
        batchId: destination.id,
        locationId: transfer.destinationLocationId,
        actorUserId: input.actorUserId,
        movementType: 'TRANSFER',
        stockStatus: 'AVAILABLE',
        quantityDelta: item.quantity,
        reason: transfer.reason,
        referenceType: 'StockTransfer',
        referenceId: transfer.id,
        transferId: transfer.id,
      });
    }
    const completed = await tx.stockTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'COMPLETED',
        completedByUserId: input.actorUserId,
        completedAt: new Date(),
      },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.transfer_complete',
      entityType: 'StockTransfer',
      entityId: transfer.id,
      metadata: {
        sourceLocationId: transfer.sourceLocationId,
        destinationLocationId: transfer.destinationLocationId,
        itemCount: transfer.items.length,
      },
    });
    return completed;
  });
}

export async function listStockTransfers(
  db: PrismaClient,
  input: { organizationId: string; locationId?: string },
) {
  return db.stockTransfer.findMany({
    where: {
      organizationId: input.organizationId,
      OR: input.locationId
        ? [
            { sourceLocationId: input.locationId },
            { destinationLocationId: input.locationId },
          ]
        : undefined,
    },
    include: { items: true, sourceLocation: true, destinationLocation: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
