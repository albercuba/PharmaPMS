import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../modules/audit/audit.service.js';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import { getOrganizationConfiguration } from '../modules/pharmacy/config.service.js';
import { supportedLocales } from '../modules/localization/locale.js';

const updateConfigurationSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    countryCode: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    defaultLocale: z
      .string()
      .min(2)
      .max(16)
      .refine((locale) => locale in supportedLocales, 'Unsupported locale')
      .optional(),
    currency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
    timezone: z.string().min(1).max(80).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one update is required',
  );

export function registerPharmacyRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/organization', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.ORGANIZATION_READ,
    );
    return {
      organization: await getOrganizationConfiguration(db, user.organizationId),
    };
  });

  app.patch('/organization', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.ORGANIZATION_UPDATE,
    );
    const input = updateConfigurationSchema.parse(request.body);
    const organization = await db.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: user.organizationId },
        data: input,
      });
      await recordAuditEvent(tx, {
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: 'organization.configuration_update',
        entityType: 'Organization',
        entityId: user.organizationId,
        metadata: { changedFields: Object.keys(input) },
      });
      return updated;
    });
    return { organization };
  });

  app.get('/locations', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.ORGANIZATION_READ,
    );
    const locations = await db.location.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
    });
    return { locations };
  });
}
