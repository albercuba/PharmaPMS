import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';
import { appendInventoryMovementInTransaction } from '../inventory/inventory.service.js';

export class PrescriptionBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrescriptionBusinessError';
  }
}

type Tx = Prisma.TransactionClient;
const transitions: Record<string, string[]> = {
  DRAFT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['AWAITING_VERIFICATION', 'CANCELLED'],
  AWAITING_VERIFICATION: ['VERIFIED', 'CANCELLED'],
  VERIFIED: ['PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED'],
  PARTIALLY_DISPENSED: ['DISPENSED', 'CANCELLED'],
  DISPENSED: [],
  CANCELLED: [],
};
export function isValidPrescriptionTransition(from: string, to: string) {
  return (transitions[from] ?? []).includes(to);
}

const detailInclude = {
  patient: true,
  prescriber: true,
  items: {
    include: {
      product: { include: { translations: true } },
      dispensingItems: true,
    },
  },
  dispensingRecords: {
    include: {
      items: { include: { allocations: { include: { batch: true } } } },
    },
    orderBy: { dispensedAt: 'desc' as const },
  },
};

export async function listPrescriptions(
  db: PrismaClient,
  organizationId: string,
  status?: string,
) {
  return db.prescription.findMany({
    where: { organizationId, ...(status ? { status: status as never } : {}) },
    select: {
      id: true,
      prescriptionNumber: true,
      status: true,
      createdAt: true,
      patient: {
        select: {
          id: true,
          patientNumber: true,
          firstName: true,
          lastName: true,
          preferredLocale: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
export async function getPrescription(
  db: PrismaClient,
  organizationId: string,
  id: string,
  actorUserId?: string,
) {
  const prescription = await db.prescription.findFirst({
    where: { id, organizationId },
    include: detailInclude,
  });
  if (!prescription)
    throw new PrescriptionBusinessError('Prescription was not found');
  await recordAuditEvent(db, {
    organizationId,
    actorUserId,
    action: 'prescription.view',
    entityType: 'Prescription',
    entityId: id,
  });
  return prescription;
}

export async function createPrescription(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    locationId: string;
    patientId: string;
    prescriberId?: string;
    prescriptionNumber: string;
    items: Array<{
      productId: string;
      medicineName: string;
      strength?: string;
      prescribedQuantity: number;
      dosageInstructions: string;
      instructionsLocale?: string;
      repeatsAllowed?: number;
      notes?: string;
    }>;
  },
) {
  if (!input.items.length)
    throw new PrescriptionBusinessError(
      'A prescription requires at least one item',
    );
  if (
    input.items.some(
      (item) =>
        !Number.isInteger(item.prescribedQuantity) ||
        item.prescribedQuantity <= 0 ||
        !item.dosageInstructions.trim() ||
        (item.repeatsAllowed ?? 0) < 0,
    )
  )
    throw new PrescriptionBusinessError(
      'Prescription quantities, instructions, and repeats are invalid',
    );
  return db.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: {
        id: input.patientId,
        organizationId: input.organizationId,
        status: 'ACTIVE',
      },
    });
    if (!patient)
      throw new PrescriptionBusinessError('Patient is not available');
    const location = await tx.location.findFirst({
      where: { id: input.locationId, organizationId: input.organizationId },
    });
    if (!location)
      throw new PrescriptionBusinessError(
        'Location does not belong to the organization',
      );
    if (
      input.prescriberId &&
      !(await tx.prescriber.findFirst({
        where: { id: input.prescriberId, organizationId: input.organizationId },
      }))
    )
      throw new PrescriptionBusinessError(
        'Prescriber does not belong to the organization',
      );
    const products = await tx.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        organizationId: input.organizationId,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (
      products.length !==
      new Set(input.items.map((item) => item.productId)).size
    )
      throw new PrescriptionBusinessError(
        'One or more prescription products are unavailable',
      );
    const prescription = await tx.prescription.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        patientId: input.patientId,
        prescriberId: input.prescriberId,
        createdByUserId: input.actorUserId,
        prescriptionNumber: input.prescriptionNumber.trim(),
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            medicineNameSnapshot: item.medicineName.trim(),
            strengthSnapshot: item.strength,
            prescribedQuantity: item.prescribedQuantity,
            dosageInstructions: item.dosageInstructions.trim(),
            instructionsLocale: item.instructionsLocale ?? 'und',
            repeatsAllowed: item.repeatsAllowed ?? 0,
            repeatsRemaining: item.repeatsAllowed ?? 0,
            notes: item.notes,
          })),
        },
      },
      include: { items: true },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'prescription.create',
      entityType: 'Prescription',
      entityId: prescription.id,
    });
    return prescription;
  });
}

export async function transitionPrescription(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    prescriptionId: string;
    status: 'RECEIVED' | 'AWAITING_VERIFICATION' | 'CANCELLED';
  },
) {
  return db.$transaction(async (tx) => {
    const prescription = await tx.prescription.findFirst({
      where: { id: input.prescriptionId, organizationId: input.organizationId },
    });
    if (
      !prescription ||
      !isValidPrescriptionTransition(prescription.status, input.status)
    )
      throw new PrescriptionBusinessError(
        'Invalid prescription status transition',
      );
    const updated = await tx.prescription.update({
      where: { id: prescription.id },
      data: {
        status: input.status,
        ...(input.status === 'CANCELLED'
          ? {
              cancelledAt: new Date(),
              cancellationReason: 'Cancelled by authorized user',
            }
          : {}),
      },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'prescription.status',
      entityType: 'Prescription',
      entityId: prescription.id,
      metadata: { from: prescription.status, to: input.status },
    });
    return updated;
  });
}

export async function verifyPrescription(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    prescriptionId: string;
  },
) {
  return db.$transaction(async (tx) => {
    const prescription = await tx.prescription.findFirst({
      where: {
        id: input.prescriptionId,
        organizationId: input.organizationId,
        status: 'AWAITING_VERIFICATION',
      },
    });
    if (!prescription)
      throw new PrescriptionBusinessError(
        'Prescription is not awaiting verification',
      );
    const verified = await tx.prescription.update({
      where: { id: prescription.id },
      data: {
        status: 'VERIFIED',
        verifiedByUserId: input.actorUserId,
        verifiedAt: new Date(),
      },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'prescription.verify',
      entityType: 'Prescription',
      entityId: prescription.id,
    });
    return verified;
  });
}

async function deductFefo(
  tx: Tx,
  input: {
    organizationId: string;
    actorUserId: string;
    productId: string;
    locationId: string;
    quantity: number;
    dispensingId: string;
  },
) {
  const balances = await tx.inventoryBalance.findMany({
    where: {
      organizationId: input.organizationId,
      productId: input.productId,
      locationId: input.locationId,
      stockStatus: 'AVAILABLE',
      quantity: { gt: 0 },
      batch: { expiryDate: { gte: new Date() } },
    },
    include: { batch: true },
    orderBy: [
      { batch: { expiryDate: 'asc' } },
      { batch: { createdAt: 'asc' } },
    ],
  });
  if (
    balances.reduce((sum, balance) => sum + balance.quantity, 0) <
    input.quantity
  )
    throw new PrescriptionBusinessError(
      'Insufficient available stock for dispensing',
    );
  let remaining = input.quantity;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const balance of balances) {
    if (!remaining) break;
    const quantity = Math.min(remaining, balance.quantity);
    await appendInventoryMovementInTransaction(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      productId: input.productId,
      batchId: balance.batchId,
      locationId: input.locationId,
      movementType: 'DISPENSING',
      stockStatus: 'AVAILABLE',
      quantityDelta: -quantity,
      reason: `Dispensing ${input.dispensingId}`,
      referenceType: 'DispensingRecord',
      referenceId: input.dispensingId,
    });
    allocations.push({ batchId: balance.batchId, quantity });
    remaining -= quantity;
  }
  return allocations;
}

export async function dispensePrescription(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    prescriptionId: string;
    items: Array<{ prescriptionItemId: string; quantity: number }>;
    notes?: string;
  },
) {
  if (!input.items.length)
    throw new PrescriptionBusinessError('A dispensing event requires items');
  return db.$transaction(async (tx) => {
    const prescription = await tx.prescription.findFirst({
      where: {
        id: input.prescriptionId,
        organizationId: input.organizationId,
        status: { in: ['VERIFIED', 'PARTIALLY_DISPENSED'] },
      },
      include: { items: { include: { dispensingItems: true } } },
    });
    if (!prescription)
      throw new PrescriptionBusinessError(
        'Prescription is not verified for dispensing',
      );
    const record = await tx.dispensingRecord.create({
      data: {
        organizationId: input.organizationId,
        locationId: prescription.locationId,
        prescriptionId: prescription.id,
        dispensedByUserId: input.actorUserId,
        notes: input.notes,
      },
    });
    for (const requested of input.items) {
      const prescriptionItem = prescription.items.find(
        (item) => item.id === requested.prescriptionItemId,
      );
      if (
        !prescriptionItem ||
        !Number.isInteger(requested.quantity) ||
        requested.quantity <= 0
      )
        throw new PrescriptionBusinessError('Invalid dispensing item');
      const dispensed = prescriptionItem.dispensingItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      );
      if (dispensed + requested.quantity > prescriptionItem.prescribedQuantity)
        throw new PrescriptionBusinessError(
          'Dispensing quantity exceeds the prescribed quantity',
        );
      const item = await tx.dispensingItem.create({
        data: {
          dispensingRecordId: record.id,
          prescriptionItemId: prescriptionItem.id,
          quantity: requested.quantity,
        },
      });
      const allocations = await deductFefo(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        productId: prescriptionItem.productId,
        locationId: prescription.locationId,
        quantity: requested.quantity,
        dispensingId: record.id,
      });
      await tx.dispensingItemBatch.createMany({
        data: allocations.map((allocation) => ({
          dispensingItemId: item.id,
          ...allocation,
        })),
      });
    }
    const refreshed = await tx.prescription.findUniqueOrThrow({
      where: { id: prescription.id },
      include: { items: { include: { dispensingItems: true } } },
    });
    const fullyDispensed = refreshed.items.every(
      (item) =>
        item.dispensingItems.reduce(
          (sum, dispensing) => sum + dispensing.quantity,
          0,
        ) >= item.prescribedQuantity,
    );
    await tx.prescription.update({
      where: { id: prescription.id },
      data: { status: fullyDispensed ? 'DISPENSED' : 'PARTIALLY_DISPENSED' },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'dispensing.complete',
      entityType: 'DispensingRecord',
      entityId: record.id,
      metadata: {
        prescriptionId: prescription.id,
        itemCount: input.items.length,
      },
    });
    return tx.dispensingRecord.findUniqueOrThrow({
      where: { id: record.id },
      include: { items: { include: { allocations: true } } },
    });
  });
}
