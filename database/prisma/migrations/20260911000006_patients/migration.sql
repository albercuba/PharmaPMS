CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'WITHDRAWN');
CREATE TABLE "Patient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL, "patientNumber" VARCHAR(80) NOT NULL,
  "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "dateOfBirth" TIMESTAMP(3), "gender" VARCHAR(80), "phone" VARCHAR(80), "email" VARCHAR(320), "address" TEXT,
  "preferredLocale" VARCHAR(16) NOT NULL DEFAULT 'en-US', "communicationPreferences" JSONB, "notes" TEXT, "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Patient_organizationId_patientNumber_key" ON "Patient"("organizationId", "patientNumber");
CREATE INDEX "Patient_organizationId_status_lastName_firstName_idx" ON "Patient"("organizationId", "status", "lastName", "firstName");
CREATE INDEX "Patient_organizationId_phone_idx" ON "Patient"("organizationId", "phone");
CREATE TABLE "PatientAllergy" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "patientId" UUID NOT NULL, "description" TEXT NOT NULL, "reaction" TEXT, "notes" TEXT, CONSTRAINT "PatientAllergy_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PatientAllergy_patientId_idx" ON "PatientAllergy"("patientId");
CREATE TABLE "PatientMedicationHistory" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "patientId" UUID NOT NULL, "description" TEXT NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT, CONSTRAINT "PatientMedicationHistory_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PatientMedicationHistory_patientId_recordedAt_idx" ON "PatientMedicationHistory"("patientId", "recordedAt");
CREATE TABLE "PatientInsurance" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "patientId" UUID NOT NULL, "providerName" TEXT NOT NULL, "memberNumber" TEXT, "policyReference" TEXT, "notes" TEXT, CONSTRAINT "PatientInsurance_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PatientInsurance_patientId_idx" ON "PatientInsurance"("patientId");
CREATE TABLE "PatientConsent" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "patientId" UUID NOT NULL, "purpose" TEXT NOT NULL, "status" "ConsentStatus" NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "notes" TEXT, CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "PatientConsent_patientId_recordedAt_idx" ON "PatientConsent"("patientId", "recordedAt");
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientAllergy" ADD CONSTRAINT "PatientAllergy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientMedicationHistory" ADD CONSTRAINT "PatientMedicationHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientInsurance" ADD CONSTRAINT "PatientInsurance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "Permission" ("id", "code", "description") VALUES (gen_random_uuid(), 'patients:read', 'Read patient records'), (gen_random_uuid(), 'patients:create', 'Create patient records'), (gen_random_uuid(), 'patients:update', 'Update and archive patient records') ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" IN ('administrator', 'pharmacist') AND p."code" IN ('patients:read', 'patients:create', 'patients:update') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId") SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p WHERE r."name" = 'pharmacy-technician' AND p."code" = 'patients:read' ON CONFLICT DO NOTHING;
