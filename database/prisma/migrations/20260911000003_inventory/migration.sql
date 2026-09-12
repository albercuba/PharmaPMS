CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIVING', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGE', 'EXPIRY', 'TRANSFER', 'CORRECTION');
CREATE TYPE "StockStatus" AS ENUM ('AVAILABLE', 'QUARANTINED', 'DAMAGED', 'EXPIRED', 'DISPOSED');
CREATE TYPE "InventoryCountStatus" AS ENUM ('OPEN', 'RECONCILED', 'CANCELLED');

CREATE TABLE "Batch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "lotNumber" VARCHAR(120) NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Batch_organizationId_productId_locationId_lotNumber_key" ON "Batch"("organizationId", "productId", "locationId", "lotNumber");
CREATE INDEX "Batch_organizationId_locationId_expiryDate_idx" ON "Batch"("organizationId", "locationId", "expiryDate");
CREATE INDEX "Batch_productId_expiryDate_idx" ON "Batch"("productId", "expiryDate");

CREATE TABLE "InventoryBalance" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "stockStatus" "StockStatus" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryBalance_batchId_stockStatus_key" ON "InventoryBalance"("batchId", "stockStatus");
CREATE INDEX "InventoryBalance_organizationId_locationId_stockStatus_idx" ON "InventoryBalance"("organizationId", "locationId", "stockStatus");
CREATE INDEX "InventoryBalance_productId_locationId_stockStatus_idx" ON "InventoryBalance"("productId", "locationId", "stockStatus");

CREATE TABLE "StockMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "movementType" "InventoryMovementType" NOT NULL,
  "stockStatus" "StockStatus" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "referenceType" VARCHAR(80),
  "referenceId" VARCHAR(120),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockMovement_organizationId_locationId_occurredAt_idx" ON "StockMovement"("organizationId", "locationId", "occurredAt");
CREATE INDEX "StockMovement_batchId_occurredAt_idx" ON "StockMovement"("batchId", "occurredAt");
CREATE INDEX "StockMovement_productId_occurredAt_idx" ON "StockMovement"("productId", "occurredAt");

CREATE TABLE "InventoryThreshold" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "lowStockLevel" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryThreshold_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryThreshold_organizationId_productId_locationId_key" ON "InventoryThreshold"("organizationId", "productId", "locationId");
CREATE INDEX "InventoryThreshold_organizationId_locationId_lowStockLevel_idx" ON "InventoryThreshold"("organizationId", "locationId", "lowStockLevel");

CREATE TABLE "InventoryCount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "status" "InventoryCountStatus" NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reconciledAt" TIMESTAMP(3),
  CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InventoryCount_organizationId_locationId_status_idx" ON "InventoryCount"("organizationId", "locationId", "status");
CREATE UNIQUE INDEX "InventoryCount_one_open_per_location_key" ON "InventoryCount"("organizationId", "locationId") WHERE "status" = 'OPEN';

CREATE TABLE "InventoryCountItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "inventoryCountId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "expectedQuantity" INTEGER NOT NULL,
  "countedQuantity" INTEGER,
  "variance" INTEGER,
  CONSTRAINT "InventoryCountItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryCountItem_inventoryCountId_batchId_key" ON "InventoryCountItem"("inventoryCountId", "batchId");
CREATE INDEX "InventoryCountItem_batchId_idx" ON "InventoryCountItem"("batchId");

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCountItem" ADD CONSTRAINT "InventoryCountItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'inventory:read', 'Read inventory'),
  (gen_random_uuid(), 'inventory:receive', 'Receive stock into inventory'),
  (gen_random_uuid(), 'inventory:adjust', 'Adjust inventory'),
  (gen_random_uuid(), 'inventory:count', 'Perform inventory counts')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('administrator', 'pharmacist', 'inventory-purchasing')
  AND p."code" IN ('inventory:read', 'inventory:receive', 'inventory:adjust', 'inventory:count')
ON CONFLICT DO NOTHING;

ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_quantity_delta_nonzero" CHECK ("quantityDelta" <> 0);
ALTER TABLE "InventoryThreshold" ADD CONSTRAINT "InventoryThreshold_low_stock_nonnegative" CHECK ("lowStockLevel" >= 0);
