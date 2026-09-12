import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';

export class RegisterBusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegisterBusinessError';
  }
}

type Db = PrismaClient | Prisma.TransactionClient;
const amount = (value: number) => Math.round(value * 100) / 100;

export async function listRegisters(db: Db, organizationId: string, locationId?: string) {
  return db.register.findMany({
    where: { organizationId, ...(locationId ? { locationId } : {}) },
    include: { location: { select: { name: true, code: true } } },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
}

export async function createRegister(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; locationId: string; name: string; code: string },
) {
  return db.$transaction(async (tx) => {
    const location = await tx.location.findFirst({
      where: { id: input.locationId, organizationId: input.organizationId },
    });
    if (!location) throw new RegisterBusinessError('Location was not found');
    const register = await tx.register.create({
      data: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        name: input.name,
        code: input.code,
      },
    });
    await recordAuditEvent(tx, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: 'pos.register_create',
      entityType: 'Register',
      entityId: register.id,
      metadata: { locationId: input.locationId, code: input.code },
    });
    return register;
  });
}

export async function getCurrentShift(db: Db, organizationId: string, registerId: string) {
  return db.cashShift.findFirst({
    where: { organizationId, registerId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

export async function getShiftSummary(db: Db, organizationId: string, shiftId: string) {
  const shift = await db.cashShift.findFirst({
    where: { id: shiftId, organizationId },
    include: { register: true, location: true, openedBy: { select: { displayName: true } }, closedBy: { select: { displayName: true } } },
  });
  if (!shift) throw new RegisterBusinessError('Cash shift was not found');
  const payments = await db.payment.aggregate({
    where: { sale: { cashShiftId: shift.id, organizationId, status: 'COMPLETED' }, status: 'POSTED' },
    _sum: { amount: true },
  });
  const cashSales = await db.payment.aggregate({
    where: { sale: { cashShiftId: shift.id, organizationId, status: 'COMPLETED' }, status: 'POSTED', type: 'CASH' },
    _sum: { amount: true },
  });
  const expectedCash = amount(Number(shift.openingCash) + Number(cashSales._sum.amount ?? 0));
  return { ...shift, cashSales: Number(cashSales._sum.amount ?? 0), totalPayments: Number(payments._sum.amount ?? 0), expectedCash };
}

export async function openCashShift(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; locationId: string; registerId: string; openingCash: number; notes?: string },
) {
  if (input.openingCash < 0) throw new RegisterBusinessError('Opening cash cannot be negative');
  return db.$transaction(async (tx) => {
    const register = await tx.register.findFirst({ where: { id: input.registerId, organizationId: input.organizationId, locationId: input.locationId, active: true } });
    if (!register) throw new RegisterBusinessError('Active register was not found at this location');
    const existing = await tx.cashShift.findFirst({ where: { organizationId: input.organizationId, registerId: input.registerId, status: 'OPEN' } });
    if (existing) throw new RegisterBusinessError('This register already has an open shift');
    const shift = await tx.cashShift.create({
      data: { organizationId: input.organizationId, locationId: input.locationId, registerId: input.registerId, openedByUserId: input.actorUserId, openingCash: input.openingCash, notes: input.notes },
    });
    await recordAuditEvent(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, action: 'pos.shift_open', entityType: 'CashShift', entityId: shift.id, metadata: { registerId: input.registerId, openingCash: input.openingCash } });
    return shift;
  });
}

export async function closeCashShift(
  db: PrismaClient,
  input: { organizationId: string; actorUserId: string; shiftId: string; countedCash: number; notes?: string },
) {
  if (input.countedCash < 0) throw new RegisterBusinessError('Counted cash cannot be negative');
  return db.$transaction(async (tx) => {
    const shift = await tx.cashShift.findFirst({ where: { id: input.shiftId, organizationId: input.organizationId, status: 'OPEN' } });
    if (!shift) throw new RegisterBusinessError('Only an open shift can be closed');
    const cashSales = await tx.payment.aggregate({ where: { sale: { cashShiftId: shift.id, organizationId: input.organizationId, status: 'COMPLETED' }, status: 'POSTED', type: 'CASH' }, _sum: { amount: true } });
    const expectedCash = amount(Number(shift.openingCash) + Number(cashSales._sum.amount ?? 0));
    const variance = amount(input.countedCash - expectedCash);
    const updated = await tx.cashShift.updateMany({ where: { id: shift.id, status: 'OPEN' }, data: { status: 'CLOSED', closedByUserId: input.actorUserId, expectedCash, countedCash: input.countedCash, variance, notes: input.notes ?? shift.notes, closedAt: new Date() } });
    if (updated.count !== 1) throw new RegisterBusinessError('Shift was closed by another request');
    const result = await tx.cashShift.findUniqueOrThrow({ where: { id: shift.id } });
    await recordAuditEvent(tx, { organizationId: input.organizationId, actorUserId: input.actorUserId, action: 'pos.shift_close', entityType: 'CashShift', entityId: shift.id, metadata: { expectedCash, countedCash: input.countedCash, variance } });
    return result;
  });
}
