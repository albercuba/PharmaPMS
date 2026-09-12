import type { PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';

export class PatientBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatientBusinessError';
  }
}
type PatientInput = {
  organizationId: string;
  actorUserId: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  preferredLocale?: string;
  communicationPreferences?: object;
  notes?: string;
};
const safeSelect = {
  id: true,
  patientNumber: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
  phone: true,
  email: true,
  preferredLocale: true,
  status: true,
} as const;
export async function listPatients(
  db: PrismaClient,
  organizationId: string,
  search?: string,
) {
  return db.patient.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      ...(search
        ? {
            OR: [
              { patientNumber: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: safeSelect,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 100,
  });
}
export async function getPatient(
  db: PrismaClient,
  organizationId: string,
  id: string,
  actorUserId?: string,
) {
  const patient = await db.patient.findFirst({
    where: { id, organizationId },
    include: {
      allergies: true,
      medicationHistory: { orderBy: { recordedAt: 'desc' } },
      insuranceRecords: true,
      consents: { orderBy: { recordedAt: 'desc' } },
    },
  });
  if (!patient) throw new PatientBusinessError('Patient was not found');
  await recordAuditEvent(db, {
    organizationId,
    actorUserId,
    action: 'patient.view',
    entityType: 'Patient',
    entityId: patient.id,
  });
  return patient;
}
export async function createPatient(db: PrismaClient, input: PatientInput) {
  return db.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        organizationId: input.organizationId,
        patientNumber: input.patientNumber.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        phone: input.phone,
        email: input.email,
        address: input.address,
        preferredLocale: input.preferredLocale,
        communicationPreferences: input.communicationPreferences,
        notes: input.notes,
      },
      select: safeSelect,
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'patient.create',
      entityType: 'Patient',
      entityId: patient.id,
    });
    return patient;
  });
}
export async function updatePatient(
  db: PrismaClient,
  input: PatientInput & { patientId: string; status?: 'ACTIVE' | 'ARCHIVED' },
) {
  return db.$transaction(async (tx) => {
    const existing = await tx.patient.findFirst({
      where: { id: input.patientId, organizationId: input.organizationId },
    });
    if (!existing) throw new PatientBusinessError('Patient was not found');
    const { patientId, organizationId, actorUserId, ...data } = input;
    const patient = await tx.patient.update({
      where: { id: patientId },
      data: {
        ...data,
        patientNumber: data.patientNumber.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
      },
      select: safeSelect,
    });
    await recordAuditEvent(tx, {
      organizationId,
      actorUserId,
      action:
        patient.status === 'ARCHIVED' ? 'patient.archive' : 'patient.update',
      entityType: 'Patient',
      entityId: patient.id,
    });
    return patient;
  });
}
