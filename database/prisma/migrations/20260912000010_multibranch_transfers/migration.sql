CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

CREATE TABLE "StockTransfer" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "sourceLocationId" UUID NOT NULL,
  "destinationLocationId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "completedByUserId" UUID,
  "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransfer_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "StockTransferItem" (
  "id" UUID NOT NULL,
  "transferId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "sourceBatchId" UUID NOT NULL,
  "destinationBatchId" UUID,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransferItem_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransferItem_destinationBatchId_fkey" FOREIGN KEY ("destinationBatchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockTransferItem_quantity_check" CHECK ("quantity" > 0)
);
ALTER TABLE "StockMovement" ADD COLUMN "transferId" UUID;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StockTransferItem_transferId_productId_sourceBatchId_key" ON "StockTransferItem"("transferId", "productId", "sourceBatchId");
CREATE INDEX "StockTransfer_organizationId_status_createdAt_idx" ON "StockTransfer"("organizationId", "status", "createdAt");
CREATE INDEX "StockTransfer_sourceLocationId_createdAt_idx" ON "StockTransfer"("sourceLocationId", "createdAt");
CREATE INDEX "StockTransfer_destinationLocationId_createdAt_idx" ON "StockTransfer"("destinationLocationId", "createdAt");
CREATE INDEX "StockTransferItem_sourceBatchId_idx" ON "StockTransferItem"("sourceBatchId");
CREATE INDEX "StockTransferItem_destinationBatchId_idx" ON "StockTransferItem"("destinationBatchId");
CREATE INDEX "StockMovement_transferId_idx" ON "StockMovement"("transferId");
