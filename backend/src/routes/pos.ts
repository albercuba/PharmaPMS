import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { assertLocationAccess, requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  completeSale,
  refundSale,
  searchSaleProducts,
  voidHeldSale,
} from '../modules/pos/pos.service.js';


const payment = z.object({
  type: z.enum(['CASH', 'CARD', 'MOBILE', 'OTHER']),
  amount: z.number().positive(),
  reference: z.string().trim().max(160).optional(),
});
const saleItem = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  discountAmount: z.number().nonnegative().optional(),
});

export function registerPosRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/pos/products', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_READ);
    const query = z
      .object({
        search: z.string().trim().min(1).max(200),
        locale: z.string().max(16).optional(),
      })
      .parse(request.query);
    return {
      products: await searchSaleProducts(db, {
        organizationId: user.organizationId,
        ...query,
      }),
    };
  });
  app.post('/pos/sales', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_CREATE);
    const input = z
      .object({
        locationId: z.string().uuid(),
        registerId: z.string().uuid(),
        cashShiftId: z.string().uuid(),
        receiptNumber: z.string().trim().max(80).optional(),
        currency: z.string().length(3),
        items: z.array(saleItem).min(1),
        payments: z.array(payment).min(1),
      })
      .parse(request.body);
    assertLocationAccess(user, input.locationId);
    const hasDiscount = input.items.some(
      (item) => (item.discountAmount ?? 0) > 0,
    );
    const hasOverride = input.items.some(
      (item) => item.unitPrice !== undefined,
    );
    if (hasDiscount)
      await requirePermission(request, db, PERMISSIONS.POS_DISCOUNT);
    if (hasOverride)
      await requirePermission(request, db, PERMISSIONS.POS_PRICE_OVERRIDE);
    return reply.code(201).send({
      sale: await completeSale(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        allowDiscount: hasDiscount,
        allowPriceOverride: hasOverride,
        ...input,
      }),
    });
  });
  app.post('/pos/sales/:saleId/void', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_VOID);
    const { saleId } = z
      .object({ saleId: z.string().uuid() })
      .parse(request.params);
    return {
      sale: await voidHeldSale(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        saleId,
      }),
    };
  });
  app.post('/pos/refunds', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_REFUND);
    const input = z
      .object({
        saleId: z.string().uuid(),
        locationId: z.string().uuid(),
        reason: z.string().trim().min(1).max(500),
        items: z
          .array(
            z.object({
              saleItemId: z.string().uuid(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1),
      })
      .parse(request.body);
    return reply.code(201).send({
      refund: await refundSale(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    });
  });
}
