import type { PrismaClient } from '@prisma/client';

export type ReportRange = {
  organizationId: string;
  from?: Date;
  to?: Date;
  locationId?: string;
};
const dateWhere = (from?: Date, to?: Date) =>
  from || to ? { gte: from, lt: to } : undefined;
const number = (value: unknown) => Number(value ?? 0);

export async function salesReport(db: PrismaClient, input: ReportRange) {
  const sales = await db.sale.findMany({
    where: {
      organizationId: input.organizationId,
      status: 'COMPLETED',
      locationId: input.locationId,
      createdAt: dateWhere(input.from, input.to),
    },
    select: {
      id: true,
      receiptNumber: true,
      locationId: true,
      cashierUserId: true,
      currency: true,
      subtotal: true,
      taxTotal: true,
      discountTotal: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          product: { select: { purchasePrice: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  let revenue = 0;
  let tax = 0;
  let discounts = 0;
  let cost = 0;
  let units = 0;
  for (const sale of sales) {
    revenue += number(sale.total);
    tax += number(sale.taxTotal);
    discounts += number(sale.discountTotal);
    for (const item of sale.items) {
      units += item.quantity;
      cost += number(item.product.purchasePrice) * item.quantity;
    }
  }
  return {
    count: sales.length,
    units,
    revenue,
    tax,
    discounts,
    cost,
    grossProfit: revenue - cost,
    sales,
  };
}

export async function inventoryReport(db: PrismaClient, input: ReportRange) {
  const balances = await db.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      quantity: { gt: 0 },
    },
    select: {
      productId: true,
      batchId: true,
      locationId: true,
      stockStatus: true,
      quantity: true,
      product: {
        select: {
          purchasePrice: true,
          sellingPrice: true,
          translations: {
            where: { locale: 'en-US' },
            take: 1,
            select: { displayName: true },
          },
        },
      },
      batch: { select: { lotNumber: true, expiryDate: true } },
    },
    orderBy: [{ batch: { expiryDate: 'asc' } }],
  });
  const rows = balances.map((row) => ({
    ...row,
    productName: row.product.translations[0]?.displayName ?? row.productId,
    value: row.quantity * number(row.product.purchasePrice),
  }));
  const available = rows.filter((row) => row.stockStatus === 'AVAILABLE');
  return {
    rows,
    totalUnits: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalValue: rows.reduce((sum, row) => sum + row.value, 0),
    availableValue: available.reduce((sum, row) => sum + row.value, 0),
  };
}

export async function stockMovementReport(
  db: PrismaClient,
  input: ReportRange,
) {
  return db.stockMovement.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      occurredAt: dateWhere(input.from, input.to),
    },
    orderBy: { occurredAt: 'desc' },
    take: 1000,
    select: {
      id: true,
      productId: true,
      batchId: true,
      locationId: true,
      actorUserId: true,
      movementType: true,
      stockStatus: true,
      quantityDelta: true,
      reason: true,
      referenceType: true,
      referenceId: true,
      occurredAt: true,
    },
  });
}

export async function supplierActivityReport(
  db: PrismaClient,
  input: ReportRange,
) {
  const receipts = await db.purchaseReceipt.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      receivedAt: dateWhere(input.from, input.to),
      status: 'POSTED',
    },
    select: {
      supplierId: true,
      supplier: { select: { name: true } },
      items: { select: { quantity: true, unitCost: true } },
    },
  });
  const suppliers = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      receipts: number;
      units: number;
      spend: number;
    }
  >();
  for (const receipt of receipts) {
    const current = suppliers.get(receipt.supplierId) ?? {
      supplierId: receipt.supplierId,
      supplierName: receipt.supplier.name,
      receipts: 0,
      units: 0,
      spend: 0,
    };
    current.receipts += 1;
    for (const item of receipt.items) {
      current.units += item.quantity;
      current.spend += item.quantity * number(item.unitCost);
    }
    suppliers.set(receipt.supplierId, current);
  }
  return [...suppliers.values()].sort((a, b) => b.spend - a.spend);
}

export async function purchasingReport(db: PrismaClient, input: ReportRange) {
  const receipts = await db.purchaseReceipt.findMany({
    where: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      receivedAt: dateWhere(input.from, input.to),
      status: 'POSTED',
    },
    select: {
      id: true,
      supplierId: true,
      purchaseOrderId: true,
      receivedAt: true,
      items: { select: { quantity: true, unitCost: true } },
    },
    orderBy: { receivedAt: 'desc' },
  });
  const total = receipts.reduce(
    (sum, receipt) =>
      sum +
      receipt.items.reduce(
        (itemSum, item) => itemSum + item.quantity * number(item.unitCost),
        0,
      ),
    0,
  );
  return { count: receipts.length, total, receipts };
}

export async function prescriptionReport(db: PrismaClient, input: ReportRange) {
  const [prescriptions, dispensing] = await Promise.all([
    db.prescription.groupBy({
      by: ['status'],
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        createdAt: dateWhere(input.from, input.to),
      },
      _count: { _all: true },
    }),
    db.dispensingRecord.count({
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        dispensedAt: dateWhere(input.from, input.to),
        status: 'COMPLETED',
      },
    }),
  ]);
  return {
    prescriptions: prescriptions.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
    dispensingCount: dispensing,
  };
}

export async function activityReport(db: PrismaClient, input: ReportRange) {
  const [sales, dispensing, movements] = await Promise.all([
    db.sale.groupBy({
      by: ['cashierUserId'],
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        status: 'COMPLETED',
        createdAt: dateWhere(input.from, input.to),
      },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.dispensingRecord.groupBy({
      by: ['dispensedByUserId'],
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        status: 'COMPLETED',
        dispensedAt: dateWhere(input.from, input.to),
      },
      _count: { _all: true },
    }),
    db.stockMovement.groupBy({
      by: ['actorUserId'],
      where: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        occurredAt: dateWhere(input.from, input.to),
      },
      _count: { _all: true },
    }),
  ]);
  return { sales, dispensing, movements };
}

export async function dashboardSummary(
  db: PrismaClient,
  organizationId: string,
  locationId?: string,
) {
  const now = new Date();
  const expiryCutoff = new Date(now);
  expiryCutoff.setDate(expiryCutoff.getDate() + 90);
  const [
    awaitingPrescriptions,
    thresholds,
    availableBalances,
    expiringSoon,
    expiredStock,
    pendingPurchaseOrders,
    openCounts,
    inventoryDiscrepancies,
  ] = await Promise.all([
    db.prescription.count({
      where: {
        organizationId,
        locationId,
        status: { in: ['RECEIVED', 'AWAITING_VERIFICATION'] },
      },
    }),
    db.inventoryThreshold.findMany({
      where: {
        organizationId,
        locationId,
        lowStockLevel: { gt: 0 },
        product: { status: 'ACTIVE' },
      },
      select: { productId: true, locationId: true, lowStockLevel: true },
    }),
    db.inventoryBalance.groupBy({
      by: ['productId', 'locationId'],
      where: { organizationId, locationId, stockStatus: 'AVAILABLE' },
      _sum: { quantity: true },
    }),
    db.inventoryBalance.count({
      where: {
        organizationId,
        locationId,
        quantity: { gt: 0 },
        stockStatus: 'AVAILABLE',
        batch: { expiryDate: { gt: now, lte: expiryCutoff } },
      },
    }),
    db.inventoryBalance.count({
      where: {
        organizationId,
        locationId,
        quantity: { gt: 0 },
        stockStatus: { in: ['EXPIRED', 'DISPOSED'] },
      },
    }),
    db.purchaseOrder.count({
      where: {
        organizationId,
        locationId,
        status: { in: ['SUBMITTED', 'PARTIALLY_RECEIVED', 'BACKORDERED'] },
      },
    }),
    db.inventoryCount.count({
      where: { organizationId, locationId, status: 'OPEN' },
    }),
    db.inventoryCountItem.count({
      where: {
        variance: { not: 0 },
        inventoryCount: { organizationId, locationId, status: 'RECONCILED' },
      },
    }),
  ]);
  const balances = new Map(
    availableBalances.map((row) => [
      `${row.productId}:${row.locationId}`,
      row._sum.quantity ?? 0,
    ]),
  );
  const lowStock = thresholds.filter(
    (threshold) =>
      (balances.get(`${threshold.productId}:${threshold.locationId}`) ?? 0) <=
      threshold.lowStockLevel,
  ).length;
  return {
    awaitingPrescriptions,
    lowStock,
    expiringSoon,
    expiredStock,
    pendingPurchaseOrders,
    openCounts,
    inventoryDiscrepancies,
    generatedAt: now,
  };
}
