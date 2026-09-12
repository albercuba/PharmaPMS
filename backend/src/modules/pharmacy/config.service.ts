import type { PrismaClient } from '@prisma/client';

export const localePattern =
  /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-[A-Z]{2}|-[0-9]{3})?$/;
export const countryPattern = /^[A-Z]{2}$/;
export const currencyPattern = /^[A-Z]{3}$/;

export async function getOrganizationConfiguration(
  db: PrismaClient,
  organizationId: string,
) {
  return db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      countryCode: true,
      defaultLocale: true,
      currency: true,
      timezone: true,
      status: true,
    },
  });
}
