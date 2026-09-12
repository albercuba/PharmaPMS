import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  renderPrescriptionDocument,
  renderSaleReceipt,
} from '../modules/documents/document.service.js';

const params = z.object({ id: z.string().uuid() });
const localeQuery = z.object({ locale: z.string().min(2).max(16).optional() });
export function registerDocumentRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/documents/prescriptions/:id/label', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRINTING_READ,
    );
    const { id } = params.parse(request.params);
    const query = localeQuery.parse(request.query);
    const result = await renderPrescriptionDocument(db, {
      organizationId: user.organizationId,
      prescriptionId: id,
      requestedLocale: query.locale,
      kind: 'PRESCRIPTION_LABEL',
    });
    await db.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'document.render',
        entityType: 'Prescription',
        entityId: id,
        metadata: { kind: 'PRESCRIPTION_LABEL', locale: result.locale },
      },
    });
    return reply.type('text/html; charset=utf-8').send(result.html);
  });
  app.get(
    '/documents/prescriptions/:id/instructions',
    async (request, reply) => {
      const user = await requirePermission(
        request,
        db,
        PERMISSIONS.PRINTING_READ,
      );
      const { id } = params.parse(request.params);
      const query = localeQuery.parse(request.query);
      const result = await renderPrescriptionDocument(db, {
        organizationId: user.organizationId,
        prescriptionId: id,
        requestedLocale: query.locale,
        kind: 'PATIENT_INSTRUCTIONS',
      });
      await db.auditEvent.create({
        data: {
          organizationId: user.organizationId,
          actorUserId: user.id,
          action: 'document.render',
          entityType: 'Prescription',
          entityId: id,
          metadata: {
            kind: 'PATIENT_INSTRUCTIONS',
            locale: result.locale,
            patientLocale: result.patientLocale,
          },
        },
      });
      return reply.type('text/html; charset=utf-8').send(result.html);
    },
  );
  app.get('/documents/sales/:id/receipt', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PRINTING_READ,
    );
    const { id } = params.parse(request.params);
    const query = localeQuery.parse(request.query);
    const html = await renderSaleReceipt(db, {
      organizationId: user.organizationId,
      saleId: id,
      requestedLocale: query.locale,
    });
    await db.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'document.render',
        entityType: 'Sale',
        entityId: id,
        metadata: { kind: 'RECEIPT', locale: query.locale ?? 'en-US' },
      },
    });
    return reply.type('text/html; charset=utf-8').send(html);
  });
}
