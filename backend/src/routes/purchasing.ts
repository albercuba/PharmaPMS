import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  createPurchaseOrder,
  createPurchaseReturn,
  createSupplier,
  getPurchaseOrder,
  listCostHistory,
  listPurchaseOrders,
  listSuppliers,
  receivePurchase,
  transitionPurchaseOrder,
  updateSupplier,
} from '../modules/purchasing/purchasing.service.js';

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().trim().max(80).optional(),
  address: z.string().trim().max(500).optional(),
  taxIdentifier: z.string().trim().max(120).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const itemSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().optional(),
  notes: z.string().trim().max(500).optional(),
});

export function registerPurchasingRoutes(
  app: FastifyInstance,
  db: PrismaClient,
) {
  app.get('/suppliers', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.SUPPLIERS_READ,
    );
    const query = z
      .object({ search: z.string().trim().max(200).optional() })
      .parse(request.query);
    return {
      suppliers: await listSuppliers(db, user.organizationId, query.search),
    };
  });
  app.post('/suppliers', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.SUPPLIERS_CREATE,
    );
    return reply.code(201).send({
      supplier: await createSupplier(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...supplierSchema.parse(request.body),
      }),
    });
  });
  app.get('/suppliers/:supplierId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.SUPPLIERS_READ,
    );
    const { supplierId } = z
      .object({ supplierId: z.string().uuid() })
      .parse(request.params);
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, organizationId: user.organizationId },
      include: { purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 25 } },
    });
    if (!supplier) throw new Error('Supplier was not found');
    return { supplier };
  });
  app.patch('/suppliers/:supplierId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.SUPPLIERS_UPDATE,
    );
    const { supplierId } = z
      .object({ supplierId: z.string().uuid() })
      .parse(request.params);
    const input = supplierSchema
      .partial()
      .extend({ status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional() })
      .parse(request.body);
    return {
      supplier: await updateSupplier(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        supplierId,
        ...input,
      }),
    };
  });

  app.get('/purchase-orders', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_READ,
    );
    const query = z
      .object({
        status: z
          .enum([
            'DRAFT',
            'SUBMITTED',
            'PARTIALLY_RECEIVED',
            'RECEIVED',
            'BACKORDERED',
            'CANCELLED',
          ])
          .optional(),
      })
      .parse(request.query);
    return {
      purchaseOrders: await listPurchaseOrders(
        db,
        user.organizationId,
        query.status,
      ),
    };
  });
  app.post('/purchase-orders', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_CREATE,
    );
    const input = z
      .object({
        supplierId: z.string().uuid(),
        locationId: z.string().uuid(),
        orderNumber: z.string().trim().min(1).max(80),
        expectedDate: z.coerce.date().optional(),
        supplierReference: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(1000).optional(),
        items: z.array(itemSchema).min(1),
      })
      .parse(request.body);
    return reply.code(201).send({
      purchaseOrder: await createPurchaseOrder(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    });
  });
  app.get('/purchase-orders/:purchaseOrderId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_READ,
    );
    const { purchaseOrderId } = z
      .object({ purchaseOrderId: z.string().uuid() })
      .parse(request.params);
    return {
      purchaseOrder: await getPurchaseOrder(
        db,
        user.organizationId,
        purchaseOrderId,
      ),
    };
  });
  app.patch('/purchase-orders/:purchaseOrderId/status', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_UPDATE,
    );
    const { purchaseOrderId } = z
      .object({ purchaseOrderId: z.string().uuid() })
      .parse(request.params);
    const { status } = z
      .object({
        status: z.enum([
          'SUBMITTED',
          'CANCELLED',
          'BACKORDERED',
          'PARTIALLY_RECEIVED',
          'RECEIVED',
        ]),
      })
      .parse(request.body);
    return {
      purchaseOrder: await transitionPurchaseOrder(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        purchaseOrderId,
        status,
      }),
    };
  });
  app.post(
    '/purchase-orders/:purchaseOrderId/receive',
    async (request, reply) => {
      const user = await requirePermission(
        request,
        db,
        PERMISSIONS.PURCHASING_RECEIVE,
      );
      const { purchaseOrderId } = z
        .object({ purchaseOrderId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({
          supplierInvoiceNumber: z.string().trim().max(120).optional(),
          supplierReference: z.string().trim().max(120).optional(),
          notes: z.string().trim().max(1000).optional(),
          items: z
            .array(
              z.object({
                purchaseOrderItemId: z.string().uuid(),
                lotNumber: z.string().trim().min(1).max(120),
                expiryDate: z.coerce.date(),
                quantity: z.number().int().positive(),
                unitCost: z.number().nonnegative().optional(),
              }),
            )
            .min(1),
        })
        .parse(request.body);
      return reply.code(201).send({
        receipt: await receivePurchase(db, {
          organizationId: user.organizationId,
          actorUserId: user.id,
          purchaseOrderId,
          ...input,
        }),
      });
    },
  );
  app.post('/purchase-returns', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_RETURN,
    );
    const input = z
      .object({
        supplierId: z.string().uuid(),
        purchaseOrderId: z.string().uuid().optional(),
        locationId: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
        supplierReference: z.string().trim().max(120).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              batchId: z.string().uuid(),
              quantity: z.number().int().positive(),
              unitCost: z.number().nonnegative(),
            }),
          )
          .min(1),
      })
      .parse(request.body);
    return reply.code(201).send({
      purchaseReturn: await createPurchaseReturn(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    });
  });
  app.get('/purchase-cost-history', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PURCHASING_READ,
    );
    const query = z
      .object({ productId: z.string().uuid().optional() })
      .parse(request.query);
    return {
      history: await listCostHistory(db, user.organizationId, query.productId),
    };
  });
}
