CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "ProductType" AS ENUM ('MEDICINE', 'GENERAL');
CREATE TYPE "PrescriptionClass" AS ENUM ('UNKNOWN', 'OTC', 'PRESCRIPTION_ONLY');
CREATE TYPE "ControlledDrugClass" AS ENUM ('NONE', 'CONTROLLED', 'UNKNOWN');

CREATE TABLE "Manufacturer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Manufacturer_organizationId_name_key" ON "Manufacturer"("organizationId", "name");
CREATE INDEX "Manufacturer_organizationId_idx" ON "Manufacturer"("organizationId");

CREATE TABLE "Product" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "manufacturerId" UUID,
  "sku" VARCHAR(64),
  "productType" "ProductType" NOT NULL DEFAULT 'MEDICINE',
  "taxCategory" VARCHAR(64),
  "purchasePrice" DECIMAL(12,2),
  "sellingPrice" DECIMAL(12,2),
  "storageRequirements" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "searchText" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_organizationId_sku_key" ON "Product"("organizationId", "sku");
CREATE INDEX "Product_organizationId_status_idx" ON "Product"("organizationId", "status");
CREATE INDEX "Product_organizationId_productType_idx" ON "Product"("organizationId", "productType");
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

CREATE TABLE "ProductTranslation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "locale" VARCHAR(16) NOT NULL,
  "displayName" TEXT NOT NULL,
  "genericName" TEXT,
  "brandName" TEXT,
  "searchText" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");
CREATE INDEX "ProductTranslation_locale_idx" ON "ProductTranslation"("locale");

CREATE TABLE "ProductBarcode" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "value" VARCHAR(64) NOT NULL,
  "type" VARCHAR(32) NOT NULL DEFAULT 'GTIN',
  CONSTRAINT "ProductBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductBarcode_value_key" ON "ProductBarcode"("value");
CREATE INDEX "ProductBarcode_productId_idx" ON "ProductBarcode"("productId");

CREATE TABLE "Medicine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "prescriptionClass" "PrescriptionClass" NOT NULL DEFAULT 'UNKNOWN',
  "controlledDrugClass" "ControlledDrugClass" NOT NULL DEFAULT 'NONE',
  "strength" TEXT,
  "dosageForm" TEXT,
  "packSize" TEXT,
  CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Medicine_productId_key" ON "Medicine"("productId");

CREATE TABLE "ActiveIngredient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActiveIngredient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActiveIngredient_organizationId_canonicalName_key" ON "ActiveIngredient"("organizationId", "canonicalName");
CREATE INDEX "ActiveIngredient_organizationId_idx" ON "ActiveIngredient"("organizationId");

CREATE TABLE "MedicineIngredient" (
  "medicineId" UUID NOT NULL,
  "activeIngredientId" UUID NOT NULL,
  "strength" TEXT,
  "unit" TEXT,
  CONSTRAINT "MedicineIngredient_pkey" PRIMARY KEY ("medicineId", "activeIngredientId")
);
CREATE INDEX "MedicineIngredient_activeIngredientId_idx" ON "MedicineIngredient"("activeIngredientId");

CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "ProductTranslation_searchText_trgm_idx" ON "ProductTranslation" USING GIN ("searchText" gin_trgm_ops);

ALTER TABLE "Manufacturer" ADD CONSTRAINT "Manufacturer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActiveIngredient" ADD CONSTRAINT "ActiveIngredient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicineIngredient" ADD CONSTRAINT "MedicineIngredient_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicineIngredient" ADD CONSTRAINT "MedicineIngredient_activeIngredientId_fkey" FOREIGN KEY ("activeIngredientId") REFERENCES "ActiveIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'catalog:read', 'Read catalog products'),
  (gen_random_uuid(), 'catalog:create', 'Create catalog products'),
  (gen_random_uuid(), 'catalog:update', 'Update catalog products'),
  (gen_random_uuid(), 'catalog:archive', 'Archive catalog products')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" = 'administrator'
  AND p."code" IN ('catalog:read', 'catalog:create', 'catalog:update', 'catalog:archive')
ON CONFLICT DO NOTHING;
