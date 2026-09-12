import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requirePermission } from '../modules/identity/authorization.js';
import { PERMISSIONS } from '../modules/identity/permissions.js';
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  type ProductInput,
} from '../modules/catalog/catalog.service.js';
import { supportedLocales } from '../modules/localization/locale.js';

const translationSchema = z.object({
  locale: z
    .string()
    .min(2)
    .max(16)
    .refine((locale) => locale in supportedLocales, 'Unsupported locale'),
  displayName: z.string().trim().min(1).max(240),
  genericName: z.string().trim().max(240).optional(),
  brandName: z.string().trim().max(240).optional(),
});

const medicineSchema = z.object({
  prescriptionClass: z.enum(['UNKNOWN', 'OTC', 'PRESCRIPTION_ONLY']),
  controlledDrugClass: z.enum(['NONE', 'CONTROLLED', 'UNKNOWN']),
  strength: z.string().trim().max(120).optional(),
  dosageForm: z.string().trim().max(120).optional(),
  packSize: z.string().trim().max(120).optional(),
  ingredients: z
    .array(
      z.object({
        canonicalName: z.string().trim().min(1).max(200),
        strength: z.string().trim().max(120).optional(),
        unit: z.string().trim().max(32).optional(),
      }),
    )
    .max(50)
    .optional(),
});

const productFields = z.object({
  sku: z.string().trim().min(1).max(64).optional(),
  productType: z.enum(['MEDICINE', 'GENERAL']),
  manufacturerName: z.string().trim().min(1).max(200).optional(),
  taxCategory: z.string().trim().max(64).optional(),
  purchasePrice: z.number().nonnegative().finite().optional(),
  sellingPrice: z.number().nonnegative().finite().optional(),
  storageRequirements: z.string().trim().max(500).optional(),
  translations: z.array(translationSchema).min(1).max(30),
  barcodes: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(64),
        type: z.string().trim().max(32).optional(),
      }),
    )
    .max(20)
    .optional(),
  medicine: medicineSchema.optional(),
});

const productSchema = productFields.superRefine((value, context) => {
  if (value.productType === 'MEDICINE' && !value.medicine) {
    context.addIssue({
      code: 'custom',
      path: ['medicine'],
      message: 'Medicine details are required for medicine products',
    });
  }
  if (value.productType === 'GENERAL' && value.medicine) {
    context.addIssue({
      code: 'custom',
      path: ['medicine'],
      message: 'Medicine details are only valid for medicine products',
    });
  }
});

const updateSchema = productFields
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  })
  .superRefine((value, context) => {
    if (value.productType === 'MEDICINE' && !value.medicine) {
      context.addIssue({
        code: 'custom',
        path: ['medicine'],
        message:
          'Medicine details are required when changing product type to medicine',
      });
    }
  });

const idSchema = z.object({ productId: z.string().uuid() });

export function registerCatalogRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/catalog/products', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.CATALOG_READ);
    const query = z
      .object({
        search: z.string().trim().max(200).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
        locale: z
          .string()
          .min(2)
          .max(16)
          .refine((locale) => locale in supportedLocales, 'Unsupported locale')
          .optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(request.query);
    return listProducts(db, user.organizationId, query);
  });

  app.get('/catalog/products/:productId', async (request) => {
    const user = await requirePermission(request, db, PERMISSIONS.CATALOG_READ);
    const { productId } = idSchema.parse(request.params);
    return { product: await getProduct(db, user.organizationId, productId) };
  });

  app.post('/catalog/products', async (request, reply) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.CATALOG_CREATE,
    );
    const input = productSchema.parse(request.body) as ProductInput;
    const product = await createProduct(
      db,
      user.organizationId,
      user.id,
      input,
    );
    return reply.code(201).send({ product });
  });

  app.patch('/catalog/products/:productId', async (request) => {
    const user = await requirePermission(
      request,
      db,
      PERMISSIONS.CATALOG_UPDATE,
    );
    const { productId } = idSchema.parse(request.params);
    const input = updateSchema.parse(request.body);
    if (input.status === 'ARCHIVED' || input.status === 'INACTIVE') {
      await requirePermission(request, db, PERMISSIONS.CATALOG_ARCHIVE);
    }
    const product = await updateProduct(
      db,
      user.organizationId,
      user.id,
      productId,
      input,
    );
    return { product };
  });
}
