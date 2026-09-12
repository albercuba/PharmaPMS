import { describe, expect, it, vi } from 'vitest';
import {
  auditEventsToCsv,
  listAuditEvents,
  rowsToCsv,
} from '../src/modules/audit/audit.query.js';
import {
  dashboardSummary,
  salesReport,
} from '../src/modules/reporting/reporting.service.js';
import type { PrismaClient } from '@prisma/client';

const db = (value: unknown) => value as PrismaClient;

describe('reporting and audit', () => {
  it('escapes operational CSV cells', () => {
    expect(rowsToCsv(['name'], [['A, "safe"']])).toBe('"name"\n"A, ""safe"""');
  });

  it('calculates sales revenue, units, cost, and gross profit from recorded snapshots', async () => {
    const mock = {
      sale: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 's1',
            receiptNumber: 'R1',
            locationId: 'l1',
            cashierUserId: 'u1',
            currency: 'EUR',
            subtotal: 20,
            taxTotal: 4,
            discountTotal: 1,
            total: 23,
            createdAt: new Date(),
            items: [
              {
                productId: 'p1',
                quantity: 2,
                unitPrice: 10,
                lineTotal: 20,
                product: { purchasePrice: 6 },
              },
            ],
          },
        ]),
      },
    };
    const report = await salesReport(db(mock), { organizationId: 'o1' });
    expect(report).toMatchObject({
      count: 1,
      units: 2,
      revenue: 23,
      cost: 12,
      grossProfit: 11,
    });
  });

  it('returns only the requested organization audit events and produces safe CSV', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'a1',
        actorUserId: 'u1',
        action: 'pos.sale_complete',
        entityType: 'Sale',
        entityId: 's1',
        outcome: 'SUCCESS',
        metadata: { total: 2 },
        occurredAt: new Date('2026-09-12T00:00:00Z'),
        actor: { displayName: 'A "User"', email: 'a@example.test' },
      },
    ]);
    const mock = {
      auditEvent: { findMany, count: vi.fn().mockResolvedValue(1) },
    };
    const result = await listAuditEvents(db(mock), {
      organizationId: 'o1',
      action: 'pos.sale_complete',
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'o1',
      action: 'pos.sale_complete',
    });
    expect(result.total).toBe(1);
    expect(auditEventsToCsv(result.events)).toContain('"A ""User"""');
  });

  it('combines operational dashboard attention counts', async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);
    const mock = {
      prescription: { count },
      inventoryThreshold: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { productId: 'p1', locationId: 'l1', lowStockLevel: 5 },
          ]),
      },
      inventoryBalance: {
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { productId: 'p1', locationId: 'l1', _sum: { quantity: 2 } },
          ]),
        count,
      },
      purchaseOrder: { count },
      inventoryCount: { count },
      inventoryCountItem: { count },
    };
    const result = await dashboardSummary(db(mock), 'o1');
    expect(result).toMatchObject({
      awaitingPrescriptions: 3,
      lowStock: 1,
      expiringSoon: 5,
      expiredStock: 1,
      pendingPurchaseOrders: 2,
      openCounts: 6,
      inventoryDiscrepancies: 2,
    });
  });
});
