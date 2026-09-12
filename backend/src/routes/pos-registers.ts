import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { assertLocationAccess, requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import { createRegister, closeCashShift, getCurrentShift, getShiftSummary, listRegisters, openCashShift, RegisterBusinessError } from '../modules/pos/register.service.js';

const locationId = z.string().uuid();
export function registerPosRegisterRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/pos/registers', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_READ);
    const query = z.object({ locationId: locationId.optional() }).parse(request.query);
    if (query.locationId) assertLocationAccess(user, query.locationId);
    return { registers: await listRegisters(db, user.organizationId, query.locationId ?? user.locationId ?? undefined) };
  });

  app.post('/pos/registers', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_SHIFT_REVIEW);
    const input = z.object({ locationId, name: z.string().trim().min(1).max(80), code: z.string().trim().min(1).max(32) }).parse(request.body);
    assertLocationAccess(user, input.locationId);
    return reply.code(201).send({ register: await createRegister(db, { ...input, organizationId: user.organizationId, actorUserId: user.id }) });
  });

  app.get('/pos/shifts/current', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_READ);
    const query = z.object({ registerId: z.string().uuid() }).parse(request.query);
    const register = await db.register.findFirst({ where: { id: query.registerId, organizationId: user.organizationId } });
    if (!register) throw new RegisterBusinessError('Register was not found');
    assertLocationAccess(user, register.locationId);
    return { shift: await getCurrentShift(db, user.organizationId, query.registerId) };
  });

  app.get('/pos/shifts/:shiftId/summary', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_SHIFT_REVIEW);
    const { shiftId } = z.object({ shiftId: z.string().uuid() }).parse(request.params);
    const summary = await getShiftSummary(db, user.organizationId, shiftId);
    assertLocationAccess(user, summary.locationId);
    return { shift: summary };
  });

  app.post('/pos/shifts/open', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_SHIFT_OPEN);
    const input = z.object({ locationId, registerId: z.string().uuid(), openingCash: z.number().nonnegative(), notes: z.string().trim().max(500).optional() }).parse(request.body);
    assertLocationAccess(user, input.locationId);
    return reply.code(201).send({ shift: await openCashShift(db, { ...input, organizationId: user.organizationId, actorUserId: user.id }) });
  });

  app.post('/pos/shifts/:shiftId/close', async (request, reply) => {
    const user = await requirePermission(request, db, PERMISSIONS.POS_SHIFT_CLOSE);
    const { shiftId } = z.object({ shiftId: z.string().uuid() }).parse(request.params);
    const input = z.object({ countedCash: z.number().nonnegative(), notes: z.string().trim().max(500).optional() }).parse(request.body);
    const summary = await getShiftSummary(db, user.organizationId, shiftId);
    assertLocationAccess(user, summary.locationId);
    return reply.send({ shift: await closeCashShift(db, { ...input, shiftId, organizationId: user.organizationId, actorUserId: user.id }) });
  });
}
