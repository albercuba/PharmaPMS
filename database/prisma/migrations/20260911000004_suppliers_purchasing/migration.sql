CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BACKORDERED', 'CANCELLED');
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('POSTED', 'VOIDED');
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('POSTED', 'VOIDED');

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "name" TEXT NOT NULL,
  "contactName" TEXT, "email" VARCHAR(320), "phone" VARCHAR(80), "address" TEXT, "taxIdentifier" VARCHAR(120), "referenceNumber" VARCHAR(120), "notes" TEXT,
  "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Supplier_organizationId_name_key" ON "Supplier"("organizationId", "name");
CREATE UNIQUE INDEX "Supplier_organizationId_referenceNumber_key" ON "Supplier"("organizationId", "referenceNumber");
CREATE INDEX "Supplier_organizationId_status_idx" ON "Supplier"("organizationId", "status");

CREATE TABLE "PurchaseOrder" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "supplierId" UUID NOT NULL, "locationId" UUID NOT NULL, "createdByUserId" UUID NOT NULL,
  "orderNumber" VARCHAR(80) NOT NULL, "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT', "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expectedDate" TIMESTAMP(3),
  "supplierInvoiceNumber" VARCHAR(120), "supplierReference" VARCHAR(120), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_orderNumber_key" ON "PurchaseOrder"("organizationId", "orderNumber");
CREATE INDEX "PurchaseOrder_organizationId_status_orderDate_idx" ON "PurchaseOrder"("organizationId", "status", "orderDate");
CREATE INDEX "PurchaseOrder_supplierId_orderDate_idx" ON "PurchaseOrder"("supplierId", "orderDate");

CREATE TABLE "PurchaseOrderItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchaseOrderId" UUID NOT NULL, "productId" UUID NOT NULL, "orderedQuantity" INTEGER NOT NULL, "receivedQuantity" INTEGER NOT NULL DEFAULT 0, "backorderedQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,2) NOT NULL, "taxAmount" DECIMAL(12,2), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseOrderItem_purchaseOrderId_productId_key" ON "PurchaseOrderItem"("purchaseOrderId", "productId");
CREATE INDEX "PurchaseOrderItem_productId_idx" ON "PurchaseOrderItem"("productId");

CREATE TABLE "PurchaseReceipt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "purchaseOrderId" UUID NOT NULL, "supplierId" UUID NOT NULL, "locationId" UUID NOT NULL, "receivedByUserId" UUID NOT NULL,
  "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'POSTED', "supplierInvoiceNumber" VARCHAR(120), "supplierReference" VARCHAR(120), "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT,
  CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReceipt_organizationId_receivedAt_idx" ON "PurchaseReceipt"("organizationId", "receivedAt");
CREATE INDEX "PurchaseReceipt_purchaseOrderId_idx" ON "PurchaseReceipt"("purchaseOrderId");

CREATE TABLE "PurchaseReceiptItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchaseReceiptId" UUID NOT NULL, "purchaseOrderItemId" UUID NOT NULL, "batchId" UUID NOT NULL, "quantity" INTEGER NOT NULL, "unitCost" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReceiptItem_purchaseOrderItemId_idx" ON "PurchaseReceiptItem"("purchaseOrderItemId");
CREATE INDEX "PurchaseReceiptItem_batchId_idx" ON "PurchaseReceiptItem"("batchId");

CREATE TABLE "PurchaseCostHistory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "supplierId" UUID NOT NULL, "productId" UUID NOT NULL, "purchaseOrderId" UUID NOT NULL, "purchaseOrderItemId" UUID NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL, "currency" VARCHAR(3) NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseCostHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseCostHistory_organizationId_productId_recordedAt_idx" ON "PurchaseCostHistory"("organizationId", "productId", "recordedAt");
CREATE INDEX "PurchaseCostHistory_supplierId_recordedAt_idx" ON "PurchaseCostHistory"("supplierId", "recordedAt");

CREATE TABLE "PurchaseReturn" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "supplierId" UUID NOT NULL, "purchaseOrderId" UUID, "locationId" UUID NOT NULL, "createdByUserId" UUID NOT NULL,
  "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'POSTED', "reason" TEXT NOT NULL, "supplierReference" VARCHAR(120), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReturn_organizationId_createdAt_idx" ON "PurchaseReturn"("organizationId", "createdAt");

CREATE TABLE "PurchaseReturnItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "purchaseReturnId" UUID NOT NULL, "productId" UUID NOT NULL, "batchId" UUID NOT NULL, "quantity" INTEGER NOT NULL, "unitCost" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseReturnItem_productId_batchId_idx" ON "PurchaseReturnItem"("productId", "batchId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseCostHistory" ADD CONSTRAINT "PurchaseCostHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseCostHistory" ADD CONSTRAINT "PurchaseCostHistory_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseCostHistory" ADD CONSTRAINT "PurchaseCostHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseCostHistory" ADD CONSTRAINT "PurchaseCostHistory_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseCostHistory" ADD CONSTRAINT "PurchaseCostHistory_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_quantity_check" CHECK ("orderedQuantity" > 0 AND "receivedQuantity" >= 0 AND "receivedQuantity" <= "orderedQuantity" AND "backorderedQuantity" >= 0);
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "PurchaseReturnItem" ADD CONSTRAINT "PurchaseReturnItem_quantity_check" CHECK ("quantity" > 0);

INSERT INTO "Permission" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'suppliers:read', 'Read suppliers'), (gen_random_uuid(), 'suppliers:create', 'Create suppliers'), (gen_random_uuid(), 'suppliers:update', 'Update suppliers'),
  (gen_random_uuid(), 'purchasing:read', 'Read purchasing'), (gen_random_uuid(), 'purchasing:create', 'Create purchase orders'), (gen_random_uuid(), 'purchasing:update', 'Update purchase orders'),
  (gen_random_uuid(), 'purchasing:receive', 'Receive purchase orders'), (gen_random_uuid(), 'purchasing:return', 'Return purchases') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" IN ('administrator', 'pharmacist', 'inventory-purchasing') AND p."code" IN ('suppliers:read', 'suppliers:create', 'suppliers:update', 'purchasing:read', 'purchasing:create', 'purchasing:update', 'purchasing:receive', 'purchasing:return') ON CONFLICT DO NOTHING;
