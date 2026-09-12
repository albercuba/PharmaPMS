import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  InventoryBusinessError,
  adjustStock,
  listInventory,
  listLowStock,
  listMovements,
  markExpiredStock,
  moveStockStatus,
  openInventoryCount,
  receiveStock,
  reconcileInventoryCount,
  selectFefo,
  setLowStockThreshold,
} from '../modules/inventory/inventory.service.js';

const receiveSchema = z.object({
  productId: z.string().uuid(),
  locationId: z.string().uuid(),
  lotNumber: z.string().trim().min(1).max(120),
  expiryDate: z.coerce.date(),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(120).optional(),
});

const adjustmentSchema = z.object({
  batchId: z.string().uuid(),
  stockStatus: z.enum([
    'AVAILABLE',
    'QUARANTINED',
    'DAMAGED',
    'EXPIRED',
    'DISPOSED',
  ]),
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, 'Quantity delta cannot be zero'),
  reason: z.string().trim().min(1).max(500),
  movementType: z
    .enum(['ADJUSTMENT', 'CORRECTION', 'RETURN', 'SALE'])
    .default('ADJUSTMENT'),
});

const statusMoveSchema = z
  .object({
    batchId: z.string().uuid(),
    fromStatus: z.enum([
      'AVAILABLE',
      'QUARANTINED',
      'DAMAGED',
      'EXPIRED',
      'DISPOSED',
    ]),
    toStatus: z.enum([
      'AVAILABLE',
      'QUARANTINED',
      'DAMAGED',
      'EXPIRED',
      'DISPOSED',
    ]),
    quantity: z.number().int().positive(),
    reason: z.string().trim().min(1).max(500),
    movementType: z.enum(['DAMAGE', 'EXPIRY', 'ADJUSTMENT']),
  })
  .refine((value) => value.fromStatus !== value.toStatus, {
    message: 'Stock statuses must be different',
    path: ['toStatus'],
  });

export function registerInventoryRoutes(
  app: FastifyInstance,
  db: PrismaClient,
) {
  app.get('/inventory', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_READ,
    );
    const query = z
      .object({
        locationId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        status: z
          .enum(['AVAILABLE', 'QUARANTINED', 'DAMAGED', 'EXPIRED', 'DISPOSED'])
          .optional(),
        expiringBefore: z.coerce.date().optional(),
        includeZero: z.coerce.boolean().default(false),
      })
      .parse(request.query);
    return {
      inventory: await listInventory(db, {
        organizationId: user.organizationId,
        ...query,
      }),
    };
  });

  app.get('/inventory/movements', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_READ,
    );
    const query = z
      .object({
        batchId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
        locationId: z.string().uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(request.query);
    return listMovements(db, { organizationId: user.organizationId, ...query });
  });

  app.put('/inventory/thresholds', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_ADJUST,
    );
    const input = z
      .object({
        productId: z.string().uuid(),
        locationId: z.string().uuid(),
        lowStockLevel: z.number().int().nonnegative(),
      })
      .parse(request.body);
    return {
      threshold: await setLowStockThreshold(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    };
  });

  app.get('/inventory/low-stock', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_READ,
    );
    const query = z
      .object({ locationId: z.string().uuid().optional() })
      .parse(request.query);
    return {
      items: await listLowStock(db, {
        organizationId: user.organizationId,
        ...query,
      }),
    };
  });

  app.get('/inventory/fefo', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_READ,
    );
    const query = z
      .object({
        productId: z.string().uuid(),
        locationId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      })
      .parse(request.query);
    return {
      batches: await selectFefo(db, {
        organizationId: user.organizationId,
        ...query,
      }),
    };
  });

  app.post('/inventory/receive', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_RECEIVE,
    );
    const input = receiveSchema.parse(request.body);
    const result = await receiveStock(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      ...input,
    });
    return reply.code(201).send(result);
  });

  app.post('/inventory/adjust', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_ADJUST,
    );
    const input = adjustmentSchema.parse(request.body);
    const movement = await adjustStock(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      ...input,
    });
    return reply.code(201).send({ movement });
  });

  app.post('/inventory/status-change', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_ADJUST,
    );
    const input = statusMoveSchema.parse(request.body);
    const movement = await moveStockStatus(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      ...input,
    });
    return reply.code(201).send({ movement });
  });

  app.post('/inventory/mark-expired', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_ADJUST,
    );
    const input = z
      .object({ locationId: z.string().uuid().optional() })
      .parse(request.body ?? {});
    return markExpiredStock(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      ...input,
    });
  });

  app.post('/inventory/counts', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_COUNT,
    );
    const input = z
      .object({
        locationId: z.string().uuid(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(request.body);
    const count = await openInventoryCount(db, {
      organizationId: user.organizationId,
      actorUserId: user.id,
      ...input,
    });
    return reply.code(201).send({ count });
  });

  app.post('/inventory/counts/:countId/reconcile', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_COUNT,
    );
    const { countId } = z
      .object({ countId: z.string().uuid() })
      .parse(request.params);
    const input = z
      .object({
        items: z
          .array(
            z.object({
              batchId: z.string().uuid(),
              countedQuantity: z.number().int().nonnegative(),
            }),
          )
          .min(1),
      })
      .parse(request.body);
    return {
      count: await reconcileInventoryCount(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        countId,
        ...input,
      }),
    };
  });
}

export { InventoryBusinessError };
