import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';
import {
  appendInventoryMovementInTransaction,
  receiveStockInTransaction,
} from '../inventory/inventory.service.js';

export class PurchasingBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurchasingBusinessError';
  }
}

type Db = PrismaClient | Prisma.TransactionClient;
const receivableStatuses = new Set([
  'SUBMITTED',
  'PARTIALLY_RECEIVED',
  'BACKORDERED',
]);
const transitions: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'BACKORDERED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'BACKORDERED', 'CANCELLED'],
  BACKORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

export function isValidPurchaseOrderTransition(from: string, to: string) {
  return (transitions[from] ?? []).includes(to);
}

export async function listSuppliers(
  db: Db,
  organizationId: string,
  search?: string,
) {
  return db.supplier.findMany({
    where: {
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { referenceNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  });
}

export async function createSupplier(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxIdentifier?: string;
    referenceNumber?: string;
    notes?: string;
  },
) {
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        taxIdentifier: input.taxIdentifier,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
      },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'supplier.create',
      entityType: 'Supplier',
      entityId: supplier.id,
    });
    return supplier;
  });
}

export async function updateSupplier(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supplierId: string;
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxIdentifier?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  },
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.supplier.findFirst({
      where: { id: input.supplierId, organizationId: input.organizationId },
    });
    if (!existing) throw new PurchasingBusinessError('Supplier was not found');
    const { supplierId, organizationId, actorUserId, ...data } = input;
    const supplier = await tx.supplier.update({
      where: { id: supplierId },
      data,
    });
    await recordAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: 'supplier.update',
      entityType: 'Supplier',
      entityId: supplier.id,
      metadata: { status: supplier.status },
    });
    return supplier;
  });
}

export async function listPurchaseOrders(
  db: Db,
  organizationId: string,
  status?: string,
) {
  return db.purchaseOrder.findMany({
    where: { organizationId, ...(status ? { status: status as never } : {}) },
    include: {
      supplier: true,
      location: true,
      items: { include: { product: { include: { translations: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPurchaseOrder(
  db: Db,
  organizationId: string,
  id: string,
) {
  const order = await db.purchaseOrder.findFirst({
    where: { id, organizationId },
    include: {
      supplier: true,
      location: true,
      items: {
        include: {
          product: { include: { translations: true } },
          receiptItems: true,
        },
      },
      receipts: { include: { items: true }, orderBy: { receivedAt: 'desc' } },
    },
  });
  if (!order) throw new PurchasingBusinessError('Purchase order was not found');
  return order;
}

export async function createPurchaseOrder(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supplierId: string;
    locationId: string;
    orderNumber: string;
    expectedDate?: Date;
    supplierReference?: string;
    notes?: string;
    items: Array<{
      productId: string;
      orderedQuantity: number;
      unitCost: number;
      taxAmount?: number;
      notes?: string;
    }>;
  },
) {
  if (!input.items.length)
    throw new PurchasingBusinessError(
      'A purchase order requires at least one item',
    );
  if (
    input.items.some(
      (item) =>
        item.orderedQuantity <= 0 ||
        !Number.isInteger(item.orderedQuantity) ||
        item.unitCost < 0,
    )
  )
    throw new PurchasingBusinessError(
      'Purchase quantities must be positive integers and costs cannot be negative',
    );
  return db.$transaction(async (tx) => {
    const [supplier, location] = await Promise.all([
      tx.supplier.findFirst({
        where: {
          id: input.supplierId,
          organizationId: input.organizationId,
          status: 'ACTIVE',
        },
      }),
      tx.location.findFirst({
        where: { id: input.locationId, organizationId: input.organizationId },
      }),
    ]);
    if (!supplier)
      throw new PurchasingBusinessError(
        'Supplier is not active or does not belong to the organization',
      );
    if (!location)
      throw new PurchasingBusinessError(
        'Location does not belong to the organization',
      );
    const products = await tx.product.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: input.items.map((item) => item.productId) },
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (
      products.length !==
      new Set(input.items.map((item) => item.productId)).size
    )
      throw new PurchasingBusinessError('One or more products are unavailable');
    const order = await tx.purchaseOrder.create({
      data: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        locationId: input.locationId,
        createdByUserId: input.actorUserId,
        orderNumber: input.orderNumber.trim(),
        expectedDate: input.expectedDate,
        supplierReference: input.supplierReference,
        notes: input.notes,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            orderedQuantity: item.orderedQuantity,
            unitCost: item.unitCost,
            taxAmount: item.taxAmount,
            notes: item.notes,
          })),
        },
      },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'purchasing.order_create',
      entityType: 'PurchaseOrder',
      entityId: order.id,
    });
    return order;
  });
}

export async function transitionPurchaseOrder(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    purchaseOrderId: string;
    status:
      | 'SUBMITTED'
      | 'CANCELLED'
      | 'BACKORDERED'
      | 'PARTIALLY_RECEIVED'
      | 'RECEIVED';
  },
) {
  return db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: {
        id: input.purchaseOrderId,
        organizationId: input.organizationId,
      },
    });
    if (!order)
      throw new PurchasingBusinessError('Purchase order was not found');
    if (!isValidPurchaseOrderTransition(order.status, input.status))
      throw new PurchasingBusinessError(
        `Invalid purchase order transition from ${order.status} to ${input.status}`,
      );
    if (input.status === 'BACKORDERED') {
      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: order.id },
      });
      for (const item of items) {
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            backorderedQuantity: item.orderedQuantity - item.receivedQuantity,
          },
        });
      }
    }
    const updated = await tx.purchaseOrder.update({
      where: { id: order.id },
      data: { status: input.status },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'purchasing.order_status',
      entityType: 'PurchaseOrder',
      entityId: order.id,
      metadata: { from: order.status, to: input.status },
    });
    return updated;
  });
}

export async function receivePurchase(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    purchaseOrderId: string;
    supplierInvoiceNumber?: string;
    supplierReference?: string;
    notes?: string;
    items: Array<{
      purchaseOrderItemId: string;
      lotNumber: string;
      expiryDate: Date;
      quantity: number;
      unitCost?: number;
    }>;
  },
) {
  if (!input.items.length)
    throw new PurchasingBusinessError('A receipt requires at least one item');
  return db.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findFirst({
      where: {
        id: input.purchaseOrderId,
        organizationId: input.organizationId,
      },
      include: { items: true },
    });
    if (!order || !receivableStatuses.has(order.status))
      throw new PurchasingBusinessError(
        'Purchase order is not available for receiving',
      );
    const receipt = await tx.purchaseReceipt.create({
      data: {
        organizationId: input.organizationId,
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        locationId: order.locationId,
        receivedByUserId: input.actorUserId,
        supplierInvoiceNumber: input.supplierInvoiceNumber,
        supplierReference: input.supplierReference,
        notes: input.notes,
      },
    });
    for (const item of input.items) {
      const poItem = order.items.find(
        (candidate) => candidate.id === item.purchaseOrderItemId,
      );
      if (!poItem)
        throw new PurchasingBusinessError(
          'Receipt item does not belong to this purchase order',
        );
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        poItem.receivedQuantity + item.quantity > poItem.orderedQuantity
      )
        throw new PurchasingBusinessError(
          'Received quantity exceeds the ordered quantity',
        );
      const received = await receiveStockInTransaction(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: poItem.productId,
        locationId: order.locationId,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        reason: `Purchase receipt ${receipt.id}`,
        referenceType: 'PurchaseReceipt',
        referenceId: receipt.id,
      });
      const cost = item.unitCost ?? Number(poItem.unitCost);
      await tx.purchaseReceiptItem.create({
        data: {
          purchaseReceiptId: receipt.id,
          purchaseOrderItemId: poItem.id,
          batchId: received.batch.id,
          quantity: item.quantity,
          unitCost: cost,
        },
      });
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { receivedQuantity: { increment: item.quantity } },
      });
      await tx.purchaseCostHistory.create({
        data: {
          organizationId: input.organizationId,
          supplierId: order.supplierId,
          productId: poItem.productId,
          purchaseOrderId: order.id,
          purchaseOrderItemId: poItem.id,
          unitCost: cost,
          currency: (
            await tx.organization.findUniqueOrThrow({
              where: { id: input.organizationId },
              select: { currency: true },
            })
          ).currency,
        },
      });
    }
    const refreshed = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    const fullyReceived = refreshed.items.every(
      (item) => item.receivedQuantity >= item.orderedQuantity,
    );
    const hasOutstanding = refreshed.items.some(
      (item) => item.receivedQuantity < item.orderedQuantity,
    );
    const status = fullyReceived
      ? 'RECEIVED'
      : hasOutstanding
        ? 'PARTIALLY_RECEIVED'
        : 'RECEIVED';
    await tx.purchaseOrder.update({
      where: { id: order.id },
      data: {
        status,
        items: {
          updateMany: {
            where: { receivedQuantity: { lt: 999999 } },
            data: { backorderedQuantity: 0 },
          },
        },
      },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'purchasing.receive',
      entityType: 'PurchaseReceipt',
      entityId: receipt.id,
      metadata: { purchaseOrderId: order.id, itemCount: input.items.length },
    });
    return tx.purchaseReceipt.findUniqueOrThrow({
      where: { id: receipt.id },
      include: { items: true },
    });
  });
}

export async function createPurchaseReturn(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    supplierId: string;
    purchaseOrderId?: string;
    locationId: string;
    reason: string;
    supplierReference?: string;
    items: Array<{
      productId: string;
      batchId: string;
      quantity: number;
      unitCost: number;
    }>;
  },
) {
  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, organizationId: input.organizationId },
    });
    if (!supplier) throw new PurchasingBusinessError('Supplier was not found');
    const returned = await tx.purchaseReturn.create({
      data: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        purchaseOrderId: input.purchaseOrderId,
        locationId: input.locationId,
        createdByUserId: input.actorUserId,
        reason: input.reason,
        supplierReference: input.supplierReference,
      },
    });
    for (const item of input.items) {
      const batch = await tx.batch.findFirst({
        where: {
          id: item.batchId,
          productId: item.productId,
          locationId: input.locationId,
          organizationId: input.organizationId,
        },
      });
      if (!batch || item.quantity <= 0 || !Number.isInteger(item.quantity))
        throw new PurchasingBusinessError(
          'Invalid purchase return batch or quantity',
        );
      const movement = await appendInventoryMovementInTransaction(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: item.productId,
        batchId: item.batchId,
        locationId: input.locationId,
        movementType: 'RETURN',
        stockStatus: 'AVAILABLE',
        quantityDelta: -item.quantity,
        reason: `Purchase return ${returned.id}`,
        referenceType: 'PurchaseReturn',
        referenceId: returned.id,
      });
      await tx.purchaseReturnItem.create({
        data: {
          purchaseReturnId: returned.id,
          productId: item.productId,
          batchId: item.batchId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        },
      });
      await recordAuditEvent(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'purchasing.return_movement',
        entityType: 'StockMovement',
        entityId: movement.id,
        metadata: { purchaseReturnId: returned.id },
      });
    }
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'purchasing.return',
      entityType: 'PurchaseReturn',
      entityId: returned.id,
    });
    return tx.purchaseReturn.findUniqueOrThrow({
      where: { id: returned.id },
      include: { items: true },
    });
  });
}

export async function listCostHistory(
  db: Db,
  organizationId: string,
  productId?: string,
) {
  return db.purchaseCostHistory.findMany({
    where: { organizationId, productId },
    orderBy: { recordedAt: 'desc' },
    include: { supplier: true, product: { include: { translations: true } } },
  });
}
