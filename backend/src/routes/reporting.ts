import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  assertLocationAccess,
  requirePermission,
} from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  auditEventsToCsv,
  listAuditEvents,
  rowsToCsv,
} from '../modules/audit/audit.query.js';
import {
  activityReport,
  dashboardSummary,
  inventoryReport,
  prescriptionReport,
  purchasingReport,
  salesReport,
  stockMovementReport,
  supplierActivityReport,
} from '../modules/reporting/reporting.service.js';

const filters = z.object({
  locationId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
function scopedFilters(
  request: Parameters<typeof filters.parse>[0],
  user: {
    locationId: string | null;
    roles?: Array<{ role: { name: string } }>;
  },
) {
  const parsed = filters.parse(request);
  if (parsed.locationId) assertLocationAccess(user, parsed.locationId);
  const isAdministrator = user.roles?.some(
    ({ role }) => role.name === 'administrator',
  );
  return !isAdministrator && user.locationId
    ? { ...parsed, locationId: user.locationId }
    : parsed;
}

const auditFilters = filters.extend({
  actorUserId: z.string().uuid().optional(),
  action: z.string().max(120).optional(),
  entityType: z.string().max(80).optional(),
  entityId: z.string().uuid().optional(),
  outcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export function registerReportingRoutes(
  app: FastifyInstance,
  db: PrismaClient,
) {
  app.get('/dashboard', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.DASHBOARD_READ,
    );
    const query = scopedFilters(request, user);
    return dashboardSummary(db, user.organizationId, query.locationId);
  });
  app.get('/reports/sales', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      report: await salesReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/sales.csv', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    const report = await salesReport(db, {
      organizationId: user.organizationId,
      ...scopedFilters(request, user),
    });
    return reply
      .header('content-disposition', 'attachment; filename="sales-report.csv"')
      .type('text/csv; charset=utf-8')
      .send(
        rowsToCsv(
          [
            'id',
            'receiptNumber',
            'locationId',
            'cashierUserId',
            'currency',
            'revenue',
            'createdAt',
          ],
          report.sales.map((sale) => [
            sale.id,
            sale.receiptNumber,
            sale.locationId,
            sale.cashierUserId,
            sale.currency,
            sale.total,
            sale.createdAt,
          ]),
        ),
      );
  });
  app.get('/reports/inventory', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      report: await inventoryReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/inventory.csv', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    const report = await inventoryReport(db, {
      organizationId: user.organizationId,
      ...scopedFilters(request, user),
    });
    return reply
      .header(
        'content-disposition',
        'attachment; filename="inventory-report.csv"',
      )
      .type('text/csv; charset=utf-8')
      .send(
        rowsToCsv(
          [
            'productId',
            'productName',
            'batchId',
            'lotNumber',
            'locationId',
            'stockStatus',
            'quantity',
            'value',
          ],
          report.rows.map((row) => [
            row.productId,
            row.productName,
            row.batchId,
            row.batch.lotNumber,
            row.locationId,
            row.stockStatus,
            row.quantity,
            row.value,
          ]),
        ),
      );
  });
  app.get('/reports/movements', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      movements: await stockMovementReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/suppliers', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      suppliers: await supplierActivityReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/purchasing', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      report: await purchasingReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/prescriptions', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      report: await prescriptionReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/reports/activity', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.REPORTS_READ);
    return {
      report: await activityReport(db, {
        organizationId: user.organizationId,
        ...scopedFilters(request, user),
      }),
    };
  });
  app.get('/audit/events', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.AUDIT_READ);
    return listAuditEvents(db, {
      organizationId: user.organizationId,
      ...auditFilters.parse(request.query),
    });
  });
  app.get('/audit/events.csv', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.AUDIT_READ);
    const query = auditFilters.parse(request.query);
    const result = await listAuditEvents(db, {
      organizationId: user.organizationId,
      ...query,
      page: 1,
      pageSize: 1000,
    });
    return reply
      .header('content-disposition', 'attachment; filename="audit-events.csv"')
      .type('text/csv; charset=utf-8')
      .send(auditEventsToCsv(result.events));
  });
}
