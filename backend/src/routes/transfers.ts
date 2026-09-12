import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  assertLocationAccess,
  requirePermission,
} from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  completeStockTransfer,
  createStockTransfer,
  listStockTransfers,
  TransferBusinessError,
} from '../modules/inventory/transfers.service.js';

const item = z.object({
  productId: z.string().uuid(),
  sourceBatchId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
const create = z.object({
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  items: z.array(item).min(1),
});
export function registerTransferRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/inventory/transfers', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_READ,
    );
    const query = z
      .object({ locationId: z.string().uuid().optional() })
      .parse(request.query);
    if (query.locationId) assertLocationAccess(user, query.locationId);
    return {
      transfers: await listStockTransfers(db, {
        organizationId: user.organizationId,
        locationId: query.locationId ?? user.locationId ?? undefined,
      }),
    };
  });
  app.post('/inventory/transfers', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_TRANSFER,
    );
    const input = create.parse(request.body);
    assertLocationAccess(user, input.sourceLocationId);
    assertLocationAccess(user, input.destinationLocationId);
    return reply.code(201).send({
      transfer: await createStockTransfer(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    });
  });
  app.post('/inventory/transfers/:id/complete', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.INVENTORY_TRANSFER,
    );
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    return {
      transfer: await completeStockTransfer(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        transferId: id,
        allowedLocationId: user.roles.some(
          ({ role }) => role.name === 'administrator',
        )
          ? undefined
          : (user.locationId ?? undefined),
      }),
    };
  });
}
export { TransferBusinessError };
