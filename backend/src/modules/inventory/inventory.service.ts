import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';

export type InventoryDatabase = PrismaClient | Prisma.TransactionClient;
export type MovementType =
  | 'RECEIVING'
  | 'SALE'
  | 'DISPENSING'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'EXPIRY'
  | 'TRANSFER'
  | 'CORRECTION';
export type StockState =
  'AVAILABLE' | 'QUARANTINED' | 'DAMAGED' | 'EXPIRED' | 'DISPOSED';

export class InventoryBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryBusinessError';
  }
}

async function assertProductAndLocation(
  db: InventoryDatabase,
  organizationId: string,
  productId: string,
  locationId: string,
) {
  const [product, location] = await Promise.all([
    db.product.findFirst({
      where: { id: productId, organizationId, status: { not: 'ARCHIVED' } },
      select: { id: true },
    }),
    db.location.findFirst({
      where: { id: locationId, organizationId },
      select: { id: true },
    }),
  ]);
  if (!product)
    throw new InventoryBusinessError('Product is not available for inventory');
  if (!location)
    throw new InventoryBusinessError(
      'Location does not belong to the organization',
    );
}

async function applyBalanceDelta(
  db: InventoryDatabase,
  input: {
    organizationId: string;
    productId: string;
    batchId: string;
    locationId: string;
    stockStatus: StockState;
    quantityDelta: number;
  },
) {
  if (!Number.isInteger(input.quantityDelta) || input.quantityDelta === 0) {
    throw new InventoryBusinessError(
      'Inventory movement quantity must be a non-zero integer',
    );
  }
  if (input.quantityDelta > 0) {
    return db.inventoryBalance.upsert({
      where: {
        batchId_stockStatus: {
          batchId: input.batchId,
          stockStatus: input.stockStatus,
        },
      },
      create: { ...input, quantity: input.quantityDelta },
      update: { quantity: { increment: input.quantityDelta } },
    });
  }
  const result = await db.inventoryBalance.updateMany({
    where: {
      batchId: input.batchId,
      stockStatus: input.stockStatus,
      quantity: { gte: Math.abs(input.quantityDelta) },
    },
    data: { quantity: { decrement: Math.abs(input.quantityDelta) } },
  });
  if (result.count !== 1)
    throw new InventoryBusinessError(
      'Insufficient stock for this inventory movement',
    );
  return db.inventoryBalance.findUniqueOrThrow({
    where: {
      batchId_stockStatus: {
        batchId: input.batchId,
        stockStatus: input.stockStatus,
      },
    },
  });
}

async function appendMovement(
  db: InventoryDatabase,
  input: {
    organizationId: string;
    productId: string;
    batchId: string;
    locationId: string;
    actorUserId: string;
    movementType: MovementType;
    stockStatus: StockState;
    quantityDelta: number;
    reason: string;
    referenceType?: string;
    referenceId?: string;
    transferId?: string;
  },
) {
  if (!input.reason.trim())
    throw new InventoryBusinessError(
      'An inventory movement reason is required',
    );
  await applyBalanceDelta(db, input);
  return db.stockMovement.create({ data: input });
}

export const appendInventoryMovementInTransaction = appendMovement;

async function findOrCreateBatch(
  db: InventoryDatabase,
  input: {
    organizationId: string;
    productId: string;
    locationId: string;
    lotNumber: string;
    expiryDate: Date;
  },
) {
  if (input.expiryDate <= new Date())
    throw new InventoryBusinessError(
      'Receiving stock with an expired date is not allowed',
    );
  const existing = await db.batch.findUnique({
    where: {
      organizationId_productId_locationId_lotNumber: {
        organizationId: input.organizationId,
        productId: input.productId,
        locationId: input.locationId,
        lotNumber: input.lotNumber,
      },
    },
  });
  if (existing) {
    if (existing.expiryDate.getTime() !== input.expiryDate.getTime())
      throw new InventoryBusinessError(
        'The lot already exists with a different expiry date',
      );
    return existing;
  }
  return db.batch.create({ data: input });
}

export async function receiveStockInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    locationId: string;
    lotNumber: string;
    expiryDate: Date;
    quantity: number;
    reason: string;
    referenceType?: string;
    referenceId?: string;
  },
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new InventoryBusinessError(
      'Received quantity must be a positive integer',
    );
  await assertProductAndLocation(
    tx,
    input.organizationId,
    input.productId,
    input.locationId,
  );
  const batch = await findOrCreateBatch(tx, input);
  const movement = await appendMovement(tx, {
    ...input,
    batchId: batch.id,
    movementType: 'RECEIVING',
    stockStatus: 'AVAILABLE',
    quantityDelta: input.quantity,
  });
  await recordAuditEvent(tx, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    action: 'inventory.receive',
    entityType: 'StockMovement',
    entityId: movement.id,
    metadata: { batchId: batch.id, quantity: input.quantity },
  });
  return { batch, movement };
}

export async function receiveStock(
  db: PrismaClient,
  input: Parameters<typeof receiveStockInTransaction>[1],
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0)
    throw new InventoryBusinessError(
      'Received quantity must be a positive integer',
    );
  return db.$transaction((tx) => receiveStockInTransaction(tx, input));
}

export async function adjustStock(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    batchId: string;
    stockStatus: StockState;
    quantityDelta: number;
    reason: string;
    movementType?: MovementType;
  },
) {
  return db.$transaction(async (tx) => {
    const batch = await tx.batch.findFirst({
      where: { id: input.batchId, organizationId: input.organizationId },
    });
    if (!batch)
      throw new InventoryBusinessError(
        'Batch does not belong to the organization',
      );
    const movement = await appendMovement(tx, {
      ...input,
      productId: batch.productId,
      locationId: batch.locationId,
      movementType: input.movementType ?? 'ADJUSTMENT',
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.adjust',
      entityType: 'StockMovement',
      entityId: movement.id,
      metadata: {
        batchId: batch.id,
        quantityDelta: input.quantityDelta,
        stockStatus: input.stockStatus,
        reason: input.reason,
      },
    });
    return movement;
  });
}

export async function moveStockStatus(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    batchId: string;
    fromStatus: StockState;
    toStatus: StockState;
    quantity: number;
    reason: string;
    movementType: 'DAMAGE' | 'EXPIRY' | 'ADJUSTMENT';
  },
) {
  if (input.quantity <= 0 || !Number.isInteger(input.quantity))
    throw new InventoryBusinessError(
      'Moved quantity must be a positive integer',
    );
  return db.$transaction(async (tx) => {
    const batch = await tx.batch.findFirst({
      where: { id: input.batchId, organizationId: input.organizationId },
    });
    if (!batch)
      throw new InventoryBusinessError(
        'Batch does not belong to the organization',
      );
    await appendMovement(tx, {
      ...input,
      productId: batch.productId,
      locationId: batch.locationId,
      stockStatus: input.fromStatus,
      quantityDelta: -input.quantity,
      movementType: input.movementType,
    });
    const movement = await appendMovement(tx, {
      ...input,
      productId: batch.productId,
      locationId: batch.locationId,
      stockStatus: input.toStatus,
      quantityDelta: input.quantity,
      movementType: input.movementType,
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.status_change',
      entityType: 'Batch',
      entityId: batch.id,
      metadata: {
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        quantity: input.quantity,
      },
    });
    return movement;
  });
}

export function allocateFefo<T extends { quantity: number }>(
  balances: T[],
  requestedQuantity: number,
) {
  let remaining = requestedQuantity;
  return balances.flatMap((balance) => {
    if (remaining <= 0) return [];
    const allocatedQuantity = Math.min(balance.quantity, remaining);
    remaining -= allocatedQuantity;
    return [{ ...balance, allocatedQuantity }];
  });
}

export async function selectFefo(
  db: PrismaClient,
  input: {
    organizationId: string;
    productId: string;
    locationId: string;
    quantity: number;
  },
) {
  const balances = await db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      locationId: input.locationId,
      stockStatus: 'AVAILABLE',
      quantity: { gt: 0 },
      batch: { expiryDate: { gte: new Date() } },
    },
    include: { batch: true },
    orderBy: [
      { batch: { expiryDate: 'asc' } },
      { batch: { createdAt: 'asc' } },
    ],
  });
  return allocateFefo(balances, input.quantity);
}

export async function listInventory(
  db: PrismaClient,
  input: {
    organizationId: string;
    locationId?: string;
    productId?: string;
    status?: StockState;
    expiringBefore?: Date;
    includeZero?: boolean;
  },
) {
  return db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      productId: input.productId,
      stockStatus: input.status,
      ...(input.includeZero ? {} : { quantity: { gt: 0 } }),
      batch: input.expiringBefore
        ? { expiryDate: { lte: input.expiringBefore } }
        : undefined,
    },
    include: {
      product: { include: { translations: true } },
      batch: true,
      location: true,
    },
    orderBy: [{ batch: { expiryDate: 'asc' } }, { updatedAt: 'desc' }],
  });
}

export function listMovements(
  db: PrismaClient,
  input: {
    organizationId: string;
    batchId?: string;
    productId?: string;
    locationId?: string;
    page: number;
    pageSize: number;
  },
) {
  const where = {
    organizationId: input.organizationId,
    batchId: input.batchId,
    productId: input.productId,
    locationId: input.locationId,
  } satisfies Prisma.StockMovementWhereInput;
  return Promise.all([
    db.stockMovement.findMany({
      where,
      include: {
        product: true,
        batch: true,
        location: true,
        actor: { select: { id: true, displayName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.stockMovement.count({ where }),
  ]).then(([items, total]) => ({
    items,
    total,
    page: input.page,
    pageSize: input.pageSize,
  }));
}

export async function setLowStockThreshold(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    locationId: string;
    lowStockLevel: number;
  },
) {
  if (!Number.isInteger(input.lowStockLevel) || input.lowStockLevel < 0)
    throw new InventoryBusinessError(
      'Low-stock threshold must be a non-negative integer',
    );
  await assertProductAndLocation(
    db,
    input.organizationId,
    input.productId,
    input.locationId,
  );
  return db.$transaction(async (tx) => {
    const threshold = await tx.inventoryThreshold.upsert({
      where: {
        organizationId_productId_locationId: {
          organizationId: input.organizationId,
          productId: input.productId,
          locationId: input.locationId,
        },
      },
      create: input,
      update: { lowStockLevel: input.lowStockLevel },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.threshold_update',
      entityType: 'InventoryThreshold',
      entityId: threshold.id,
      metadata: { lowStockLevel: input.lowStockLevel },
    });
    return threshold;
  });
}

export async function listLowStock(
  db: PrismaClient,
  input: { organizationId: string; locationId?: string },
) {
  const thresholds = await db.inventoryThreshold.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
    },
    include: { product: { include: { translations: true } }, location: true },
  });
  const balances = await db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      stockStatus: 'AVAILABLE',
      quantity: { gt: 0 },
    },
  });
  return thresholds
    .map((threshold) => ({
      ...threshold,
      currentQuantity: balances
        .filter(
          (balance) =>
            balance.productId === threshold.productId &&
            balance.locationId === threshold.locationId,
        )
        .reduce((total, balance) => total + balance.quantity, 0),
    }))
    .filter((item) => item.currentQuantity <= item.lowStockLevel);
}

export async function markExpiredStock(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    locationId?: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const available = await db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      stockStatus: 'AVAILABLE',
      quantity: { gt: 0 },
      batch: { expiryDate: { lt: now } },
    },
    include: { batch: true },
  });
  let moved = 0;
  for (const balance of available) {
    await moveStockStatus(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      batchId: balance.batchId,
      fromStatus: 'AVAILABLE',
      toStatus: 'EXPIRED',
      quantity: balance.quantity,
      reason: 'Batch passed its expiry date',
      movementType: 'EXPIRY',
    });
    moved += balance.quantity;
  }
  return { batches: available.length, quantity: moved };
}

export async function openInventoryCount(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    locationId: string;
    notes?: string;
  },
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.inventoryCount.findFirst({
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        status: 'OPEN',
      },
    });
    if (existing)
      throw new InventoryBusinessError(
        'An inventory count is already open for this location',
      );
    const balances = await tx.inventoryBalance.findMany({
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        stockStatus: 'AVAILABLE',
        quantity: { gt: 0 },
      },
    });
    const count = await tx.inventoryCount.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        createdByUserId: input.actorUserId,
        notes: input.notes,
        items: {
          create: balances.map(({ batchId, quantity }) => ({
            batchId,
            expectedQuantity: quantity,
          })),
        },
      },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.count_open',
      entityType: 'InventoryCount',
      entityId: count.id,
    });
    return count;
  });
}

export async function reconcileInventoryCount(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    countId: string;
    items: Array<{ batchId: string; countedQuantity: number }>;
  },
) {
  return db.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: {
        id: input.countId,
        organizationId: input.organizationId,
        status: 'OPEN',
      },
      include: { items: true },
    });
    if (!count) throw new InventoryBusinessError('Inventory count is not open');
    const submitted = new Map(
      input.items.map((item) => [item.batchId, item.countedQuantity]),
    );
    for (const item of count.items) {
      const countedQuantity = submitted.get(item.batchId);
      if (
        countedQuantity === undefined ||
        !Number.isInteger(countedQuantity) ||
        countedQuantity < 0
      )
        throw new InventoryBusinessError(
          'Every count item requires a non-negative integer quantity',
        );
      const current = await tx.inventoryBalance.findUnique({
        where: {
          batchId_stockStatus: {
            batchId: item.batchId,
            stockStatus: 'AVAILABLE',
          },
        },
      });
      const adjustment = countedQuantity - (current?.quantity ?? 0);
      if (adjustment !== 0) {
        const batch = await tx.batch.findUniqueOrThrow({
          where: { id: item.batchId },
        });
        const movement = await appendMovement(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          batchId: item.batchId,
          productId: batch.productId,
          locationId: batch.locationId,
          stockStatus: 'AVAILABLE',
          quantityDelta: adjustment,
          reason: `Inventory count reconciliation ${count.id}`,
          movementType: 'CORRECTION',
        });
        await recordAuditEvent(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: 'inventory.reconciliation_adjustment',
          entityType: 'StockMovement',
          entityId: movement.id,
          metadata: {
            countId: count.id,
            batchId: item.batchId,
            quantityDelta: adjustment,
          },
        });
      }
      await tx.inventoryCountItem.update({
        where: { id: item.id },
        data: {
          countedQuantity,
          variance: countedQuantity - item.expectedQuantity,
        },
      });
    }
    const reconciled = await tx.inventoryCount.update({
      where: { id: count.id },
      data: { status: 'RECONCILED', reconciledAt: new Date() },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'inventory.count_reconcile',
      entityType: 'InventoryCount',
      entityId: count.id,
    });
    return reconciled;
  });
}
