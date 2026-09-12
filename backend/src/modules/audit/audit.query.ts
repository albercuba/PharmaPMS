import type { PrismaClient } from '@prisma/client';

export type AuditQuery = {
  organizationId: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listAuditEvents(db: PrismaClient, input: AuditQuery) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;
  const where = {
    organizationId: input.organizationId,
    ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    ...(input.action ? { action: input.action } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.from || input.to
      ? {
          occurredAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lt: input.to } : {}),
          },
        }
      : {}),
  };
  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        outcome: true,
        metadata: true,
        occurredAt: true,
        actor: { select: { displayName: true, email: true } },
      },
    }),
    db.auditEvent.count({ where }),
  ]);
  return {
    events,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

function csvCell(value: unknown) {
  const text =
    value instanceof Date ? value.toISOString() : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function auditEventsToCsv(
  events: Awaited<ReturnType<typeof listAuditEvents>>['events'],
) {
  return rowsToCsv(
    [
      'id',
      'occurredAt',
      'actor',
      'action',
      'entityType',
      'entityId',
      'outcome',
      'metadata',
    ],
    events.map((event) => [
      event.id,
      event.occurredAt,
      event.actor?.displayName ?? event.actorUserId ?? 'system',
      event.action,
      event.entityType,
      event.entityId,
      event.outcome,
      event.metadata ? JSON.stringify(event.metadata) : '',
    ]),
  );
}
