import type { Prisma, PrismaClient } from '@prisma/client';
import { recordAuditEvent } from '../audit/audit.service.js';

export type CatalogDatabase = PrismaClient | Prisma.TransactionClient;

export type IngredientInput = {
  canonicalName: string;
  strength?: string;
  unit?: string;
};

export type ProductTranslationInput = {
  locale: string;
  displayName: string;
  genericName?: string;
  brandName?: string;
};

export type ProductInput = {
  sku?: string;
  productType: 'MEDICINE' | 'GENERAL';
  manufacturerName?: string;
  taxCategory?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  storageRequirements?: string;
  translations: ProductTranslationInput[];
  barcodes?: Array<{ value: string; type?: string }>;
  medicine?: {
    prescriptionClass: 'UNKNOWN' | 'OTC' | 'PRESCRIPTION_ONLY';
    controlledDrugClass: 'NONE' | 'CONTROLLED' | 'UNKNOWN';
    strength?: string;
    dosageForm?: string;
    packSize?: string;
    ingredients?: IngredientInput[];
  };
};

export function buildSearchText(input: {
  sku?: string | null;
  translations?: ProductTranslationInput[];
  barcodes?: Array<{ value: string }>;
}) {
  return [
    input.sku,
    ...(input.translations ?? []).flatMap(
      ({ displayName, genericName, brandName }) => [
        displayName,
        genericName,
        brandName,
      ],
    ),
    ...(input.barcodes ?? []).map(({ value }) => value),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function decimalValue(value?: number) {
  return value === undefined ? undefined : value.toFixed(2);
}

async function findOrCreateManufacturer(
  db: CatalogDatabase,
  organizationId: string,
  name?: string,
) {
  if (!name) return undefined;
  const normalizedName = name.trim();
  const existing = await db.manufacturer.findUnique({
    where: { organizationId_name: { organizationId, name: normalizedName } },
  });
  if (existing) return existing;
  return db.manufacturer.create({
    data: { organizationId, name: normalizedName },
  });
}

async function connectIngredients(
  db: CatalogDatabase,
  organizationId: string,
  medicineId: string,
  ingredients: IngredientInput[] | undefined,
) {
  for (const ingredient of ingredients ?? []) {
    const activeIngredient = await db.activeIngredient.upsert({
      where: {
        organizationId_canonicalName: {
          organizationId,
          canonicalName: ingredient.canonicalName.trim(),
        },
      },
      create: {
        organizationId,
        canonicalName: ingredient.canonicalName.trim(),
      },
      update: {},
    });
    await db.medicineIngredient.create({
      data: {
        medicineId,
        activeIngredientId: activeIngredient.id,
        strength: ingredient.strength,
        unit: ingredient.unit,
      },
    });
  }
}

export async function createProduct(
  db: PrismaClient,
  organizationId: string,
  actorUserId: string,
  input: ProductInput,
) {
  return db.$transaction(async (tx) => {
    const manufacturer = await findOrCreateManufacturer(
      tx,
      organizationId,
      input.manufacturerName,
    );
    const product = await tx.product.create({
      data: {
        organizationId,
        manufacturerId: manufacturer?.id,
        sku: input.sku?.trim().toUpperCase(),
        productType: input.productType,
        taxCategory: input.taxCategory,
        purchasePrice: decimalValue(input.purchasePrice),
        sellingPrice: decimalValue(input.sellingPrice),
        storageRequirements: input.storageRequirements,
        searchText: buildSearchText(input),
        translations: {
          create: input.translations.map((translation) => ({
            ...translation,
            searchText: buildSearchText({ translations: [translation] }),
          })),
        },
        barcodes: { create: input.barcodes ?? [] },
        medicine:
          input.productType === 'MEDICINE' && input.medicine
            ? {
                create: {
                  prescriptionClass: input.medicine.prescriptionClass,
                  controlledDrugClass: input.medicine.controlledDrugClass,
                  strength: input.medicine.strength,
                  dosageForm: input.medicine.dosageForm,
                  packSize: input.medicine.packSize,
                  ingredients: { create: [] },
                },
              }
            : undefined,
      },
    });

    if (
      input.productType === 'MEDICINE' &&
      input.medicine?.ingredients?.length
    ) {
      await connectIngredients(
        tx,
        organizationId,
        product.id,
        input.medicine.ingredients,
      );
    }
    await recordAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: 'catalog.product_create',
      entityType: 'Product',
      entityId: product.id,
    });
    return product;
  });
}

export async function updateProduct(
  db: PrismaClient,
  organizationId: string,
  actorUserId: string,
  productId: string,
  input: Partial<ProductInput> & {
    status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  },
) {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findFirstOrThrow({
      where: { id: productId, organizationId },
      include: { medicine: true, translations: true, barcodes: true },
    });
    const manufacturer =
      input.manufacturerName === undefined
        ? undefined
        : await findOrCreateManufacturer(
            tx,
            organizationId,
            input.manufacturerName,
          );
    const product = await tx.product.update({
      where: { id: current.id },
      data: {
        manufacturerId:
          input.manufacturerName === undefined
            ? undefined
            : (manufacturer?.id ?? null),
        sku: input.sku?.trim().toUpperCase(),
        productType: input.productType,
        taxCategory: input.taxCategory,
        purchasePrice: decimalValue(input.purchasePrice),
        sellingPrice: decimalValue(input.sellingPrice),
        storageRequirements: input.storageRequirements,
        status: input.status,
        searchText: buildSearchText({
          sku: input.sku ?? current.sku,
          translations:
            input.translations ??
            current.translations.map(
              ({ locale, displayName, genericName, brandName }) => ({
                locale,
                displayName,
                genericName: genericName ?? undefined,
                brandName: brandName ?? undefined,
              }),
            ),
          barcodes: input.barcodes ?? current.barcodes,
        }),
      },
    });

    for (const translation of input.translations ?? []) {
      await tx.productTranslation.upsert({
        where: {
          productId_locale: {
            productId: product.id,
            locale: translation.locale,
          },
        },
        create: {
          productId: product.id,
          ...translation,
          searchText: buildSearchText({ translations: [translation] }),
        },
        update: {
          ...translation,
          searchText: buildSearchText({ translations: [translation] }),
        },
      });
    }
    for (const barcode of input.barcodes ?? []) {
      await tx.productBarcode.upsert({
        where: { value: barcode.value },
        create: {
          productId: product.id,
          value: barcode.value,
          type: barcode.type ?? 'GTIN',
        },
        update: { productId: product.id, type: barcode.type ?? 'GTIN' },
      });
    }
    if (input.productType === 'MEDICINE' && input.medicine) {
      const medicine = await tx.medicine.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          prescriptionClass: input.medicine.prescriptionClass,
          controlledDrugClass: input.medicine.controlledDrugClass,
          strength: input.medicine.strength,
          dosageForm: input.medicine.dosageForm,
          packSize: input.medicine.packSize,
        },
        update: {
          prescriptionClass: input.medicine.prescriptionClass,
          controlledDrugClass: input.medicine.controlledDrugClass,
          strength: input.medicine.strength,
          dosageForm: input.medicine.dosageForm,
          packSize: input.medicine.packSize,
        },
      });
      if (input.medicine.ingredients) {
        await tx.medicineIngredient.deleteMany({
          where: { medicineId: medicine.id },
        });
        await connectIngredients(
          tx,
          organizationId,
          medicine.id,
          input.medicine.ingredients,
        );
      }
    }
    await recordAuditEvent(tx, {
      organizationId,
      actorUserId,
      action: input.status
        ? 'catalog.product_status_change'
        : 'catalog.product_update',
      entityType: 'Product',
      entityId: product.id,
      metadata: { changedFields: Object.keys(input) },
    });
    return product;
  });
}

export async function listProducts(
  db: PrismaClient,
  organizationId: string,
  options: {
    search?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
    locale?: string;
    page: number;
    pageSize: number;
  },
) {
  const search = options.search?.trim();
  const where: Prisma.ProductWhereInput = {
    organizationId,
    status: options.status,
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { searchText: { contains: search.toLocaleLowerCase() } },
            {
              barcodes: {
                some: { value: { contains: search, mode: 'insensitive' } },
              },
            },
            {
              translations: {
                some: {
                  locale: options.locale,
                  searchText: { contains: search.toLocaleLowerCase() },
                },
              },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        translations: true,
        barcodes: true,
        manufacturer: true,
        medicine: {
          include: { ingredients: { include: { activeIngredient: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    db.product.count({ where }),
  ]);
  return { items, total, page: options.page, pageSize: options.pageSize };
}

export function getProduct(
  db: PrismaClient,
  organizationId: string,
  productId: string,
) {
  return db.product.findFirstOrThrow({
    where: { id: productId, organizationId },
    include: {
      translations: true,
      barcodes: true,
      manufacturer: true,
      medicine: {
        include: { ingredients: { include: { activeIngredient: true } } },
      },
    },
  });
}
