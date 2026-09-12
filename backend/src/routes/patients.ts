import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  createPatient,
  getPatient,
  listPatients,
  updatePatient,
} from '../modules/patients/patients.service.js';
const fields = z.object({
  patientNumber: z.string().trim().min(1).max(80),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  dateOfBirth: z.coerce.date().max(new Date()).optional(),
  gender: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(80).optional(),
  email: z.string().email().max(320).optional(),
  address: z.string().trim().max(500).optional(),
  preferredLocale: z.string().min(2).max(16).optional(),
  communicationPreferences: z.record(z.string(), z.boolean()).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export function registerPatientRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/patients', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PATIENTS_READ,
    );
    const query = z
      .object({ search: z.string().trim().max(120).optional() })
      .parse(request.query);
    return {
      patients: await listPatients(db, user.organizationId, query.search),
    };
  });
  app.get('/patients/:patientId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PATIENTS_READ,
    );
    const { patientId } = z
      .object({ patientId: z.string().uuid() })
      .parse(request.params);
    return {
      patient: await getPatient(db, user.organizationId, patientId, user.id),
    };
  });
  app.post('/patients', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PATIENTS_CREATE,
    );
    return reply.code(201).send({
      patient: await createPatient(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        ...fields.parse(request.body),
      }),
    });
  });
  app.patch('/patients/:patientId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.PATIENTS_UPDATE,
    );
    const { patientId } = z
      .object({ patientId: z.string().uuid() })
      .parse(request.params);
    const input = fields
      .partial()
      .extend({ status: z.enum(['ACTIVE', 'ARCHIVED']).optional() })
      .parse(request.body);
    const current = await getPatient(
      db,
      user.organizationId,
      patientId,
      user.id,
    );
    return {
      patient: await updatePatient(db, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        patientId,
        patientNumber: input.patientNumber ?? current.patientNumber,
        firstName: input.firstName ?? current.firstName,
        lastName: input.lastName ?? current.lastName,
        dateOfBirth: input.dateOfBirth ?? current.dateOfBirth ?? undefined,
        gender: input.gender,
        phone: input.phone ?? current.phone ?? undefined,
        email: input.email ?? current.email ?? undefined,
        address: input.address ?? undefined,
        preferredLocale: input.preferredLocale ?? current.preferredLocale,
        communicationPreferences: input.communicationPreferences,
        notes: input.notes ?? undefined,
        status: input.status,
      }),
    };
  });
}
