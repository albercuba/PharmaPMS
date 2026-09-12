import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';
import { appendInventoryMovementInTransaction } from '../inventory/inventory.service.js';

export class PosBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PosBusinessError';
  }
}

type Db = PrismaClient | Prisma.TransactionClient;
const money = (value: number) => Math.round(value * 100) / 100;

export function calculateSaleTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    taxRate: number;
    discountAmount?: number;
  }>,
) {
  const subtotal = money(
    items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
  const discountTotal = money(
    items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0),
  );
  const taxTotal = money(
    items.reduce(
      (sum, item) =>
        sum +
        Math.max(
          0,
          item.unitPrice * item.quantity - (item.discountAmount ?? 0),
        ) *
          item.taxRate,
      0,
    ),
  );
  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: money(Math.max(0, subtotal - discountTotal) + taxTotal),
  };
}

export async function searchSaleProducts(
  db: Db,
  input: { organizationId: string; search: string; locale?: string },
) {
  const search = input.search.trim();
  if (!search) return [];
  return db.product.findMany({
    where: {
      organizationId: input.organizationId,
      status: 'ACTIVE',
      OR: [
        { sku: { contains: search, mode: 'insensitive' } },
        { barcodes: { some: { value: search } } },
        {
          translations: {
            some: {
              locale: input.locale,
              OR: [
                { displayName: { contains: search, mode: 'insensitive' } },
                { genericName: { contains: search, mode: 'insensitive' } },
                { brandName: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    include: { translations: true, barcodes: true, medicine: true },
    take: 25,
  });
}

async function allocateAndDeduct(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    locationId: string;
    quantity: number;
    saleId: string;
  },
) {
  const balances = await tx.inventoryBalance.findMany({
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
  const total = balances.reduce((sum, balance) => sum + balance.quantity, 0);
  if (total < input.quantity)
    throw new PosBusinessError('Insufficient available stock');
  let remaining = input.quantity;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const balance of balances) {
    if (!remaining) break;
    const quantity = Math.min(remaining, balance.quantity);
    await appendInventoryMovementInTransaction(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      productId: input.productId,
      batchId: balance.batchId,
      locationId: input.locationId,
      movementType: 'SALE',
      stockStatus: 'AVAILABLE',
      quantityDelta: -quantity,
      reason: `Sale ${input.saleId}`,
      referenceType: 'Sale',
      referenceId: input.saleId,
    });
    allocations.push({ batchId: balance.batchId, quantity });
    remaining -= quantity;
  }
  return allocations;
}

export async function completeSale(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    locationId: string;
    receiptNumber?: string;
    currency: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice?: number;
      taxRate?: number;
      discountAmount?: number;
    }>;
    payments: Array<{
      type: 'CASH' | 'CARD' | 'MOBILE' | 'OTHER';
      amount: number;
      reference?: string;
    }>;
    allowDiscount?: boolean;
    allowPriceOverride?: boolean;
  },
) {
  if (!input.items.length || !input.payments.length)
    throw new PosBusinessError('A sale requires items and payments');
  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        organizationId: input.organizationId,
        id: { in: input.items.map((item) => item.productId) },
        status: 'ACTIVE',
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    if (
      products.length !==
      new Set(input.items.map((item) => item.productId)).size
    )
      throw new PosBusinessError('One or more products are unavailable');
    const calculated = input.items.map((item) => {
      const product = byId.get(item.productId)!;
      const unitPrice = item.unitPrice ?? Number(product.sellingPrice ?? 0);
      const discount = item.discountAmount ?? 0;
      const taxRate = item.taxRate ?? 0;
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        unitPrice < 0 ||
        discount < 0 ||
        taxRate < 0 ||
        taxRate > 1
      )
        throw new PosBusinessError(
          'Invalid sale quantity, price, discount, or tax',
        );
      if (discount > unitPrice * item.quantity)
        throw new PosBusinessError('Discount cannot exceed the item subtotal');
      if (discount > 0 && !input.allowDiscount)
        throw new PosBusinessError('Discount permission is required');
      if (item.unitPrice !== undefined && !input.allowPriceOverride)
        throw new PosBusinessError('Price override permission is required');
      const subtotal = money(unitPrice * item.quantity);
      const taxable = money(Math.max(0, subtotal - discount));
      const tax = money(taxable * taxRate);
      return {
        ...item,
        unitPrice,
        discount,
        taxRate,
        subtotal,
        tax,
        lineTotal: money(taxable + tax),
      };
    });
    const subtotal = money(
      calculated.reduce((sum, item) => sum + item.subtotal, 0),
    );
    const discountTotal = money(
      calculated.reduce((sum, item) => sum + item.discount, 0),
    );
    const taxTotal = money(calculated.reduce((sum, item) => sum + item.tax, 0));
    const total = money(
      calculated.reduce((sum, item) => sum + item.lineTotal, 0),
    );
    const paid = money(
      input.payments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    if (
      input.payments.some((payment) => payment.amount <= 0) ||
      Math.abs(paid - total) > 0.001
    )
      throw new PosBusinessError('Payment total must equal the sale total');
    const sale = await tx.sale.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        cashierUserId: input.actorUserId,
        receiptNumber: input.receiptNumber ?? `POS-${Date.now()}`,
        currency: input.currency,
        subtotal,
        taxTotal,
        discountTotal,
        total,
      },
    });
    for (const item of calculated) {
      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          taxAmount: item.tax,
          discountAmount: item.discount,
          lineTotal: item.lineTotal,
        },
      });
      const allocations = await allocateAndDeduct(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: item.productId,
        locationId: input.locationId,
        quantity: item.quantity,
        saleId: sale.id,
      });
      await tx.saleItemBatch.createMany({
        data: allocations.map((allocation) => ({
          saleItemId: saleItem.id,
          ...allocation,
        })),
      });
    }
    await tx.payment.createMany({
      data: input.payments.map((payment) => ({
        saleId: sale.id,
        type: payment.type,
        amount: payment.amount,
        reference: payment.reference,
      })),
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'pos.sale_complete',
      entityType: 'Sale',
      entityId: sale.id,
      metadata: { total, itemCount: input.items.length },
    });
    return tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: { items: { include: { allocations: true } }, payments: true },
    });
  });
}

export async function voidHeldSale(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; saleId: string },
) {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: {
        id: input.saleId,
        organizationId: input.organizationId,
        status: 'HELD',
      },
    });
    if (!sale)
      throw new PosBusinessError('Only held sales can be voided directly');
    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { status: 'VOIDED', voidedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'pos.sale_void',
      entityType: 'Sale',
      entityId: sale.id,
    });
    return updated;
  });
}

export async function refundSale(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    saleId: string;
    locationId: string;
    reason: string;
    items: Array<{ saleItemId: string; quantity: number }>;
  },
) {
  return db.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: {
        id: input.saleId,
        organizationId: input.organizationId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          include: {
            allocations: true,
            refundItems: { include: { allocations: true } },
          },
        },
      },
    });
    if (!sale) throw new PosBusinessError('Completed sale was not found');
    const selected = input.items.map((inputItem) => {
      const item = sale.items.find(
        (candidate) => candidate.id === inputItem.saleItemId,
      );
      if (
        !item ||
        !Number.isInteger(inputItem.quantity) ||
        inputItem.quantity <= 0
      )
        throw new PosBusinessError('Invalid refund item');
      const refunded = item.refundItems.reduce(
        (sum, refund) => sum + refund.quantity,
        0,
      );
      if (refunded + inputItem.quantity > item.quantity)
        throw new PosBusinessError(
          'Refund quantity exceeds the remaining sale quantity',
        );
      return {
        inputItem,
        item,
        amount: money(
          (Number(item.lineTotal) / item.quantity) * inputItem.quantity,
        ),
      };
    });
    const total = money(selected.reduce((sum, item) => sum + item.amount, 0));
    const refund = await tx.refund.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        saleId: sale.id,
        createdByUserId: input.actorUserId,
        reason: input.reason,
        total,
      },
    });
    for (const selectedItem of selected) {
      const refundItem = await tx.refundItem.create({
        data: {
          refundId: refund.id,
          saleItemId: selectedItem.item.id,
          quantity: selectedItem.inputItem.quantity,
          amount: selectedItem.amount,
        },
      });
      let remaining = selectedItem.inputItem.quantity;
      for (const allocation of selectedItem.item.allocations) {
        if (!remaining) break;
        const alreadyRefunded = selectedItem.item.refundItems
          .flatMap((item) => item.allocations)
          .filter((item) => item.batchId === allocation.batchId)
          .reduce((sum, item) => sum + item.quantity, 0);
        const quantity = Math.min(
          remaining,
          allocation.quantity - alreadyRefunded,
        );
        if (quantity <= 0) continue;
        await appendInventoryMovementInTransaction(tx, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          productId: selectedItem.item.productId,
          batchId: allocation.batchId,
          locationId: input.locationId,
          movementType: 'RETURN',
          stockStatus: 'AVAILABLE',
          quantityDelta: quantity,
          reason: `Refund ${refund.id}`,
          referenceType: 'Refund',
          referenceId: refund.id,
        });
        await tx.refundItemBatch.create({
          data: {
            refundItemId: refundItem.id,
            batchId: allocation.batchId,
            quantity,
          },
        });
        remaining -= quantity;
      }
      if (remaining)
        throw new PosBusinessError(
          'Unable to map refund quantity to original batches',
        );
    }
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'pos.sale_refund',
      entityType: 'Refund',
      entityId: refund.id,
      metadata: { saleId: sale.id, total },
    });
    return tx.refund.findUniqueOrThrow({
      where: { id: refund.id },
      include: { items: true },
    });
  });
}
