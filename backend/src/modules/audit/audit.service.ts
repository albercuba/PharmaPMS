import type { Prisma, PrismaClient } from '@prisma/client';

export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function recordAuditEvent(
  db: DatabaseClient,
  event: {
    organizationId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    outcome?: 'SUCCESS' | 'FAILURE';
    metadata?: Prisma.InputJsonValue;
  },
) {
  return db.auditEvent.create({
    data: {
      organizationId: event.organizationId,
      actorUserId: event.actorUserId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      outcome: event.outcome ?? 'SUCCESS',
      metadata: event.metadata,
    },
  });
}
