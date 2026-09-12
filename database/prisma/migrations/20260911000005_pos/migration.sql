CREATE TYPE "SaleStatus" AS ENUM ('HELD', 'COMPLETED', 'VOIDED');
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CARD', 'MOBILE', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'VOIDED');
CREATE TYPE "RefundStatus" AS ENUM ('POSTED', 'VOIDED');

CREATE TABLE "Sale" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "locationId" UUID NOT NULL, "cashierUserId" UUID NOT NULL,
  "receiptNumber" VARCHAR(80) NOT NULL, "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED', "currency" VARCHAR(3) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL, "taxTotal" DECIMAL(12,2) NOT NULL, "discountTotal" DECIMAL(12,2) NOT NULL, "total" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "voidedAt" TIMESTAMP(3), CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Sale_organizationId_receiptNumber_key" ON "Sale"("organizationId", "receiptNumber");
CREATE INDEX "Sale_organizationId_createdAt_idx" ON "Sale"("organizationId", "createdAt");
CREATE INDEX "Sale_locationId_createdAt_idx" ON "Sale"("locationId", "createdAt");

CREATE TABLE "SaleItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "saleId" UUID NOT NULL, "productId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL, "taxRate" DECIMAL(8,5) NOT NULL, "taxAmount" DECIMAL(12,2) NOT NULL, "discountAmount" DECIMAL(12,2) NOT NULL, "lineTotal" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

CREATE TABLE "SaleItemBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "saleItemId" UUID NOT NULL, "batchId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  CONSTRAINT "SaleItemBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaleItemBatch_saleItemId_batchId_key" ON "SaleItemBatch"("saleItemId", "batchId");
CREATE INDEX "SaleItemBatch_batchId_idx" ON "SaleItemBatch"("batchId");

CREATE TABLE "Payment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "saleId" UUID NOT NULL, "type" "PaymentType" NOT NULL, "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED', "amount" DECIMAL(12,2) NOT NULL, "reference" VARCHAR(160), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

CREATE TABLE "Refund" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "locationId" UUID NOT NULL, "saleId" UUID NOT NULL, "createdByUserId" UUID NOT NULL, "status" "RefundStatus" NOT NULL DEFAULT 'POSTED', "reason" TEXT NOT NULL, "total" DECIMAL(12,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Refund_organizationId_createdAt_idx" ON "Refund"("organizationId", "createdAt");
CREATE INDEX "Refund_saleId_idx" ON "Refund"("saleId");

CREATE TABLE "RefundItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "refundId" UUID NOT NULL, "saleItemId" UUID NOT NULL, "quantity" INTEGER NOT NULL, "amount" DECIMAL(12,2) NOT NULL, CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefundItem_saleItemId_idx" ON "RefundItem"("saleItemId");

CREATE TABLE "RefundItemBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "refundItemId" UUID NOT NULL, "batchId" UUID NOT NULL, "quantity" INTEGER NOT NULL, CONSTRAINT "RefundItemBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RefundItemBatch_batchId_idx" ON "RefundItemBatch"("batchId");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItemBatch" ADD CONSTRAINT "SaleItemBatch_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItemBatch" ADD CONSTRAINT "SaleItemBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundItemBatch" ADD CONSTRAINT "RefundItemBatch_refundItemId_fkey" FOREIGN KEY ("refundItemId") REFERENCES "RefundItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundItemBatch" ADD CONSTRAINT "RefundItemBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxRate" >= 0 AND "taxRate" <= 1 AND "discountAmount" >= 0);
ALTER TABLE "SaleItemBatch" ADD CONSTRAINT "SaleItemBatch_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "RefundItemBatch" ADD CONSTRAINT "RefundItemBatch_quantity_check" CHECK ("quantity" > 0);

INSERT INTO "Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'pos:read', 'Read point of sale'), (gen_random_uuid(), 'pos:create', 'Complete sales'), (gen_random_uuid(), 'pos:discount', 'Apply discounts'),
  (gen_random_uuid(), 'pos:price-override', 'Override selling prices'), (gen_random_uuid(), 'pos:void', 'Void held sales'), (gen_random_uuid(), 'pos:refund', 'Refund completed sales')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" IN ('administrator', 'pharmacist', 'inventory-purchasing') AND p."code" IN ('pos:read', 'pos:create', 'pos:discount', 'pos:price-override', 'pos:void', 'pos:refund') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" = 'cashier' AND p."code" IN ('pos:read', 'pos:create') ON CONFLICT DO NOTHING;
