import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  createPrescription,
  dispensePrescription,
  getPrescription,
  listPrescriptions,
  PrescriptionBusinessError,
  transitionPrescription,
  verifyPrescription,
} from '../modules/prescriptions/prescriptions.service.js';

const itemSchema = z.object({
  productId: z.string().uuid(),
  medicineName: z.string().trim().min(1).max(300),
  strength: z.string().trim().max(120).optional(),
  prescribedQuantity: z.number().int().positive(),
  dosageInstructions: z.string().trim().min(1).max(2000),
  instructionsLocale: z.string().min(2).max(16).optional(),
  repeatsAllowed: z.number().int().nonnegative().max(99).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export function registerPrescriptionRoutes(
  app: FastifyInstance,
  db: PrismaClient,
) {
  app.get('/prescriptions', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRESCRIPTIONS_READ,
    );
    const query = z
      .object({
        status: z
          .enum([
            'DRAFT',
            'RECEIVED',
            'AWAITING_VERIFICATION',
            'VERIFIED',
            'PARTIALLY_DISPENSED',
            'DISPENSED',
            'CANCELLED',
          ])
          .optional(),
      })
      .parse(request.query);
    return {
      prescriptions: await listPrescriptions(
        db,
        user.organizationId,
        query.status,
      ),
    };
  });
  app.get('/prescriptions/:prescriptionId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRESCRIPTIONS_READ,
    );
    const { prescriptionId } = z
      .object({ prescriptionId: z.string().uuid() })
      .parse(request.params);
    return {
      prescription: await getPrescription(
        db,
        user.organizationId,
        prescriptionId,
        user.id,
      ),
    };
  });
  app.post('/prescriptions', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRESCRIPTIONS_CREATE,
    );
    const input = z
      .object({
        locationId: z.string().uuid(),
        patientId: z.string().uuid(),
        prescriberId: z.string().uuid().optional(),
        prescriptionNumber: z.string().trim().min(1).max(80),
        items: z.array(itemSchema).min(1),
      })
      .parse(request.body);
    return reply.code(201).send({
      prescription: await createPrescription(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...input,
      }),
    });
  });
  app.post('/prescriptions/:prescriptionId/status', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRESCRIPTIONS_UPDATE,
    );
    const { prescriptionId } = z
      .object({ prescriptionId: z.string().uuid() })
      .parse(request.params);
    const input = z
      .object({
        status: z.enum(['RECEIVED', 'AWAITING_VERIFICATION', 'CANCELLED']),
      })
      .parse(request.body);
    return {
      prescription: await transitionPrescription(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        prescriptionId,
        status: input.status,
      }),
    };
  });
  app.post('/prescriptions/:prescriptionId/verify', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRESCRIPTIONS_VERIFY,
    );
    const { prescriptionId } = z
      .object({ prescriptionId: z.string().uuid() })
      .parse(request.params);
    return {
      prescription: await verifyPrescription(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        prescriptionId,
      }),
    };
  });
  app.post(
    '/prescriptions/:prescriptionId/dispense',
    async (request, reply) => {
      const user = await requirePermission(
        request,
        db,
        PERMISSIONS.DISPENSING_CREATE,
      );
      const { prescriptionId } = z
        .object({ prescriptionId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({
          notes: z.string().trim().max(1000).optional(),
          items: z
            .array(
              z.object({
                prescriptionItemId: z.string().uuid(),
                quantity: z.number().int().positive(),
              }),
            )
            .min(1),
        })
        .parse(request.body);
      return reply.code(201).send({
        dispensing: await dispensePrescription(db, {
          organizationId: user.organizationId,
          actorUserId: user.id,
          prescriptionId,
          ...input,
        }),
      });
    },
  );
  app.get('/dispensing', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.DISPENSING_READ,
    );
    return {
      dispensing: await db.dispensingRecord.findMany({
        where: { organizationId: user.organizationId },
        include: {
          prescription: {
            select: {
              id: true,
              prescriptionNumber: true,
              patient: {
                select: {
                  patientNumber: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          items: { include: { allocations: { include: { batch: true } } } },
        },
        orderBy: { dispensedAt: 'desc' },
        take: 100,
      }),
    };
  });
}

export { PrescriptionBusinessError };
