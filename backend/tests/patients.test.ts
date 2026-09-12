import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import {
  getPatient,
  listPatients,
} from '../src/modules/patients/patients.service.js';

const patient = {
  id: 'patient-1',
  patientNumber: 'P-1',
  firstName: 'Amina',
  lastName: 'Rahman',
  dateOfBirth: null,
  phone: null,
  email: null,
  preferredLocale: 'ar-SA',
  status: 'ACTIVE' as const,
};

describe('patient privacy boundaries', () => {
  it('searches only active patients in the organization and returns minimal fields', async () => {
    const findMany = vi.fn().mockResolvedValue([patient]);
    const db = { patient: { findMany } } as unknown as PrismaClient;
    await expect(listPatients(db, 'org-1', 'Amina')).resolves.toEqual([
      patient,
    ]);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: 'org-1',
      status: 'ACTIVE',
    });
    expect(findMany.mock.calls[0][0].select).not.toHaveProperty('notes');
  });

  it('records audited access when a patient detail is viewed', async () => {
    const auditEvent = vi.fn().mockResolvedValue({ id: 'audit-1' });
    const db = {
      patient: {
        findFirst: vi.fn().mockResolvedValue({
          ...patient,
          allergies: [],
          medicationHistory: [],
          insuranceRecords: [],
          consents: [],
        }),
      },
      auditEvent: { create: auditEvent },
    } as unknown as PrismaClient;
    await getPatient(db, 'org-1', 'patient-1');
    expect(auditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'patient.view',
          entityId: 'patient-1',
        }),
      }),
    );
  });
});
