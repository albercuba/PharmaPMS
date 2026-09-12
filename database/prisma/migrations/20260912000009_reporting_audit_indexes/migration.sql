-- Indexes support date-range reporting and protected audit review.
CREATE INDEX "Sale_organizationId_status_createdAt_idx"
  ON "Sale" ("organizationId", "status", "createdAt");
CREATE INDEX "AuditEvent_organizationId_action_occurredAt_idx"
  ON "AuditEvent" ("organizationId", "action", "occurredAt");
