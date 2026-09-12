-- Register and cash-shift controls for location-scoped POS operations
CREATE TYPE "CashShiftStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "Register" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Register_organizationId_code_key" ON "Register"("organizationId", "code");
CREATE INDEX "Register_locationId_active_idx" ON "Register"("locationId", "active");
INSERT INTO "Register" ("id", "organizationId", "locationId", "name", "code", "updatedAt")
SELECT gen_random_uuid(), l."organizationId", l."id", 'Main register', 'MAIN', CURRENT_TIMESTAMP
FROM "Location" l
WHERE NOT EXISTS (
  SELECT 1 FROM "Register" r WHERE r."organizationId" = l."organizationId" AND r."code" = 'MAIN'
);
ALTER TABLE "Register" ADD CONSTRAINT "Register_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Register" ADD CONSTRAINT "Register_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CashShift" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "registerId" UUID NOT NULL,
  "openedByUserId" UUID NOT NULL,
  "closedByUserId" UUID,
  "status" "CashShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openingCash" DECIMAL(12,2) NOT NULL,
  "expectedCash" DECIMAL(12,2),
  "countedCash" DECIMAL(12,2),
  "variance" DECIMAL(12,2),
  "notes" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashShift_organizationId_locationId_status_idx" ON "CashShift"("organizationId", "locationId", "status");
CREATE INDEX "CashShift_registerId_status_idx" ON "CashShift"("registerId", "status");
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD COLUMN "registerId" UUID;
ALTER TABLE "Sale" ADD COLUMN "cashShiftId" UUID;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashShiftId_fkey" FOREIGN KEY ("cashShiftId") REFERENCES "CashShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Sale_cashShiftId_createdAt_idx" ON "Sale"("cashShiftId", "createdAt");