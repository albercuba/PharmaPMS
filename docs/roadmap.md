# PharmaPMS Roadmap

This roadmap tracks implemented foundation work without treating placeholders as completed workflows.

## Milestone 0 — Architecture and development environment

- [x] Select modular-monolith technology stack.
- [x] Document architecture and domain boundaries.
- [x] Add frontend application scaffold and localization foundation.
- [x] Add backend TypeScript/Fastify scaffold.
- [x] Add environment validation and safe configuration template.
- [x] Add PostgreSQL Compose service with persistent volume and health check.
- [x] Add Prisma schema foundation and migration workflow documentation.
- [x] Add API health and readiness endpoints.
- [x] Add automated backend test and lint/type-check commands.
- [x] Add Docker build configuration.

## Milestone 1 — Identity, permissions, pharmacy configuration, localization

- [x] Implement registration/bootstrap for the first organization owner.
- [x] Implement Argon2id password hashing and secure server-side sessions.
- [x] Implement login, logout, and session revocation.
- [x] Add database-backed failed-login tracking and temporary account lockout.
- [ ] Add MFA enrollment, recovery, and enforcement.
- [x] Implement organization/location configuration.
- [x] Implement role and permission management with backend enforcement.
- [x] Add audit events for authentication and permission changes.
- [x] Persist user UI language preference.
- [x] Persist patient/output locale preferences when patient records exist.
- [x] Add locale fallback, locale-aware metadata, and RTL/locale tests.
- [x] Localize API validation/error messages from translation catalogs.

## Milestone 2 — Medicine and product catalog

- [x] Add products, medicines, ingredients, manufacturers, identifiers, and statuses.
- [x] Add normalized product translations with locale fallback.
- [x] Add search and barcode/GTIN uniqueness rules.
- [x] Add catalog permissions and audit history for product and price changes.
- [x] Add product list, search/filter, create, edit, and details UI.

## Milestone 3 — Inventory, batches, expiry, and stock movements

- [x] Add batches/lots, expiry dates, and location ownership.
- [x] Add immutable stock movement ledger and transactional balance updates.
- [x] Implement FEFO queries, low-stock and expiry warnings.
- [x] Add adjustments, quarantine, damaged/expired states, and reconciliation audit.
- [x] Add inventory count opening and reconciliation workflow.
- [x] Add current stock, batch, expiry, and adjustment UI views.

## Milestone 4 — Suppliers and purchasing

- [x] Add suppliers and contacts.
- [x] Add purchase orders, items, receiving, invoice references, and returns.
- [x] Connect receiving to stock movement transactions.
- [x] Add supplier price history; reorder suggestions remain deferred.

## Milestone 5 — Point of Sale

- [x] Add sales, sale items, payments, and immutable sale snapshots.
- [x] Support barcode/product search, payment types, discounts, refunds, and held-sale voiding.
- [x] Add transactional FEFO stock deduction and immutable financial state transitions.
- [ ] Add register/shift management, split-payment UI, and API-connected POS screens.

## Milestone 6 — Patients

- [x] Add organization-scoped patient profiles, consent/privacy records, preferred language, notes, and structured history foundations.
- [x] Restrict sensitive patient data by role and organization scope with minimal search projections.
- [x] Add audited patient creation, updates, archival, and detail access.

## Milestone 7 — Prescriptions and dispensing

- [x] Add prescriptions, prescribers, prescription items, explicit statuses, repeats, and clinician-entered instructions.
- [x] Add pharmacist verification and immutable dispensing records.
- [x] Connect dispensing to patient history and FEFO inventory transactions with batch traceability.
- [x] Add safety boundary documenting that clinical decision support remains deferred pending a reputable provider.
- [ ] Add production prescription intake integrations, reviewed patient-label templates, and broader clinical-provider integration.

## Milestone 8 — Labels and printing

- [x] Add printer-agnostic HTML renderers for prescription labels, patient instructions, and receipts.
- [x] Separate staff UI locale from patient print locale and use patient locale by default for patient documents.
- [x] Add locale-aware dates, currency, Unicode, RTL metadata, safe escaping, and English fallback.
- [x] Preserve original dosage instructions when no validated translation exists; no machine translation is performed.
- [ ] Add reviewed clinical translation catalogs, PDF/physical-printer adapters, invoices, barcode/price labels, and purchase-order output.

## Milestone 9 — Audit, reporting, and operational dashboards

- [x] Expand append-only audit coverage with organization-scoped search and CSV export.
- [x] Add protected sales, stock/valuation, expiry, purchase, prescription/dispensing, movement, and activity reports.
- [x] Add dashboard attention counts backed by real domain queries for prescriptions, low stock, expiry, purchasing, open counts, and reconciled inventory discrepancies.
- [ ] Add richer report UI filters and scheduled reports.

## Milestone 10 — Multi-branch and external integrations

- [x] Add branch-scoped access enforcement and transactional inter-branch transfers.
- [x] Define provider-neutral integration contracts and country-module strategy.
- [ ] Add branch assignment management, transfer approval/in-transit workflows, and branch-specific price overrides.
- [ ] Implement approved country-specific adapters, including tax, insurance, e-prescriptions, and reporting.
- [ ] Add reputable medication-data integration.
- [ ] Add accounting, wholesaler, payment terminal, dispensing-machine, and communications adapters.

## Execution Priority — Continue Here

The milestones above remain the source of truth for completed and incomplete scope. Work through the following sequence before starting additional major product domains or external integrations.

### Priority 1 — Security hardening: MFA

Goal: close the remaining foundational identity/security gap before expanding operational workflows.

- [ ] Implement TOTP-based MFA enrollment for eligible users.
- [ ] Require explicit confirmation of a newly enrolled MFA factor before activation.
- [ ] Add one-time recovery codes, shown only at enrollment/regeneration time and stored securely as hashes.
- [ ] Add MFA challenge handling to login/session creation.
- [ ] Add organization-level MFA enforcement policy with clear behavior for already-enrolled and not-yet-enrolled users.
- [ ] Add user self-service MFA reset/regeneration flows where policy permits.
- [ ] Add privileged/admin MFA reset workflow with audit logging and permission checks.
- [ ] Add audit events for enrollment, removal, recovery-code regeneration, failed MFA challenges, policy changes, and administrative resets.
- [ ] Add rate limits / lockout protections for MFA verification attempts.
- [ ] Add backend tests for enrollment, challenge, recovery, enforcement, reset, permission boundaries, and audit events.
- [ ] Add frontend MFA enrollment, challenge, recovery-code, reset, and policy-management screens using the shared design system.

Acceptance criteria:

- Users can enroll, verify, use, recover, and reset MFA without bypassing existing role/organization boundaries.
- MFA enforcement cannot be bypassed by direct API calls.
- Recovery codes are never stored or returned in plaintext after generation.
- Security-sensitive MFA actions are auditable.
- Existing session, lockout, localization, and permission behavior continues to pass tests.

### Priority 2 — Complete Point of Sale operator workflow

Goal: convert the implemented POS domain/backend foundation into a complete day-to-day pharmacy workflow.

#### Register and shift management

- [ ] Add register entities/configuration scoped by organization and location.
- [ ] Add shift opening with opening cash balance and responsible user.
- [ ] Add shift closing with counted cash, expected cash, variance, notes, and audit event.
- [ ] Prevent invalid overlapping/open shift states according to location/register rules.
- [ ] Add shift summary API and UI.
- [ ] Add permission checks for opening, closing, reviewing, and overriding register shifts.

#### POS UI

- [ ] Build an API-connected POS screen using the shared Open WebUI-inspired application shell and component system.
- [ ] Add fast barcode/GTIN lookup and product/medicine search.
- [ ] Add keyboard-first cart workflow suitable for counter use.
- [ ] Add cart quantity editing, item removal, discounts, price/permission validation, and totals.
- [ ] Surface stock availability and FEFO-relevant warnings without duplicating clinical decision support.
- [ ] Add hold/resume/void sale workflow.
- [ ] Add payment selection and payment-status handling.
- [ ] Add split-payment UI using the existing payment model/backend behavior.
- [ ] Add sale completion and receipt rendering/printing flow.
- [ ] Add refund workflow with permission checks, immutable financial transitions, and stock handling consistent with existing domain rules.
- [ ] Add useful empty, loading, error, offline/API-failure, and permission-denied states.

#### POS verification

- [ ] Add integration tests for sale creation, discounts, payments, split payments, held sales, voids, refunds, FEFO deduction, stock consistency, and audit events.
- [ ] Verify that concurrent sales cannot oversell stock or corrupt balances.
- [ ] Verify that financial state transitions remain immutable and invalid transitions are rejected.
- [ ] Verify that every stock-affecting POS action maps to the immutable movement ledger.

Acceptance criteria:

- A cashier/pharmacist can open a shift, complete a sale from barcode/search through payment and receipt, process supported refunds, and close the shift without manual database/API work.
- All POS actions remain organization/location scoped and permission enforced on the backend.
- Inventory and financial records remain transactionally consistent.

### Priority 3 — Shared UI/UX consolidation

Goal: standardize the frontend before adding more operational screens.

- [ ] Establish a reusable design system inspired by the latest Open WebUI visual language while retaining PharmaPMS branding and workflows.
- [ ] Add semantic design tokens for backgrounds, surfaces, text, borders, inputs, radii, spacing, sidebar widths, and states.
- [ ] Standardize application shell, collapsible sidebar, header, page containers, responsive breakpoints, and mobile drawer behavior.
- [ ] Standardize buttons, icon buttons, inputs, textarea, selects, comboboxes, tables, tabs, toggles, badges, avatars, tooltips, popovers, context menus, dialogs, drawers, toasts, empty states, skeleton/loading states, and error states.
- [ ] Standardize data-table patterns for search, filters, pagination, row actions, bulk actions where applicable, and responsive behavior.
- [ ] Ensure light/dark modes are complete and accessible.
- [ ] Ensure keyboard navigation and focus-visible behavior for all interactive primitives.
- [ ] Remove duplicated/ad-hoc styling where shared components can be used.
- [ ] Apply the shared design system first to POS, then settings/admin, reports, inventory, catalog, purchasing, patients, prescriptions, and dispensing screens.
- [ ] Verify desktop, tablet, and mobile layouts with no horizontal overflow.

Acceptance criteria:

- New screens can be built primarily from shared UI primitives instead of page-specific styling.
- Existing workflows remain functional after visual refactoring.
- Light/dark mode, responsive layout, and keyboard accessibility are consistent across the application.

### Priority 4 — Reporting and printing completion

Goal: make existing reporting and document-generation capabilities operationally complete.

#### Reporting UI

- [ ] Add rich UI filters for the existing protected sales, stock/valuation, expiry, purchase, prescription/dispensing, movement, and activity reports.
- [ ] Add date/location/status/user filters where supported by existing report APIs.
- [ ] Add reusable saved-filter/report-view support if it can be implemented without introducing premature complexity.
- [ ] Add CSV export actions to report screens using existing backend capabilities.
- [ ] Add clear empty states and permission-aware report access.
- [ ] Add scheduled report delivery architecture and implementation only after destination/transport requirements are explicitly configured.

#### Printing/output

- [ ] Add PDF adapters for existing HTML prescription labels, patient instructions, and receipts.
- [ ] Add physical-printer adapter abstraction without coupling core rendering to a printer vendor.
- [ ] Add invoice output.
- [ ] Add barcode/price label output.
- [ ] Add purchase-order output.
- [ ] Add print preview and reprint history where appropriate.
- [ ] Preserve patient/output locale behavior, RTL support, Unicode handling, safe escaping, and English fallback.
- [ ] Do not machine-translate clinician-entered dosage instructions.

Acceptance criteria:

- Staff can filter and export all currently implemented reports from the UI.
- Existing printable documents can be reliably rendered to PDF.
- Printer-specific concerns remain behind adapters.
- Locale and clinical-translation safety rules remain intact.

### Priority 5 — Multi-branch workflow completion

Goal: complete operational branch management before country/provider integrations.

- [ ] Add branch/location assignment management for users and roles.
- [ ] Add transfer approval workflow.
- [ ] Add explicit requested, approved, dispatched/in-transit, received, rejected/cancelled transfer states as appropriate to the existing domain model.
- [ ] Ensure stock moves between locations only at the correct transactional stage.
- [ ] Add receiving confirmation and discrepancy handling for inter-branch transfers.
- [ ] Add full audit history for transfer state changes and overrides.
- [ ] Add branch-specific price overrides with clear precedence over organization/default pricing.
- [ ] Add UI for branch assignments, transfer queues, transfer detail/history, and price overrides.
- [ ] Add tests for branch isolation, unauthorized cross-branch access, transfer concurrency, duplicate receiving, and pricing precedence.

Acceptance criteria:

- Multi-branch users can operate only within assigned scope unless explicitly permitted otherwise.
- Transfers cannot duplicate or lose stock through retries/concurrency.
- Branch-specific prices resolve deterministically and are auditable.

### Priority 6 — Prescription/clinical production readiness

Goal: finish only the operational prescription work that does not require unvalidated clinical decision support.

- [ ] Add production prescription intake adapter interfaces and at least one approved integration only when provider/country requirements are known.
- [ ] Add reviewed patient-label templates and approval/versioning workflow.
- [ ] Add reviewed clinical translation catalogs with explicit source/version metadata.
- [ ] Preserve original instructions whenever validated translation is unavailable.
- [ ] Add broader clinical-provider integrations only behind provider-neutral contracts.
- [ ] Keep interaction checking, dose checking, contraindication alerts, and other clinical decision support disabled/deferred until backed by a reputable validated medication/clinical-data provider.

Acceptance criteria:

- No feature presents unvalidated generated clinical advice as authoritative decision support.
- External prescription/clinical data is traceable to its provider and source payload/status.

### Priority 7 — Country modules and external integrations

Goal: begin external integrations only after the internal security, POS, reporting/printing, and branch workflows above are stable.

Implement adapters incrementally and behind existing provider-neutral contracts.

- [ ] Select the first target country/module and document its legal, tax, invoice, insurance, e-prescription, retention, and reporting requirements.
- [ ] Implement country-specific tax/fiscal behavior.
- [ ] Implement approved e-prescription integration.
- [ ] Implement insurance/claims integration if required for the target country.
- [ ] Add reputable medication-data provider integration with version/source tracking and clear update strategy.
- [ ] Add accounting adapter.
- [ ] Add wholesaler ordering/catalog adapter.
- [ ] Add payment-terminal adapter.
- [ ] Add dispensing-machine adapter where relevant.
- [ ] Add communications adapter(s) for configured transactional notifications.
- [ ] Add integration health/status, retry/idempotency, failure queues, audit events, and operational diagnostics for every external adapter.

Acceptance criteria:

- Core PharmaPMS domain logic remains provider-neutral.
- External failures cannot corrupt internal inventory, sales, patient, or prescription state.
- Integration operations are idempotent where required and observable through logs/status/audit records.

## Agent Working Rules

When continuing implementation from this roadmap:

- Work on the highest-priority unchecked item unless a dependency blocks it.
- Do not mark placeholders, interfaces, mock screens, or unconnected UI as completed workflows.
- Preserve the modular-monolith architecture and existing domain boundaries.
- Enforce organization, location/branch, role, and permission boundaries on the backend; frontend hiding is never sufficient authorization.
- Preserve immutable stock movement, financial transition, dispensing, and audit-history guarantees.
- Keep migrations backward-safe and review data migration implications before changing existing persisted structures.
- Add or update automated tests with each backend/domain change.
- Keep localization working for supported UI locales and preserve separate patient/output locale behavior.
- Do not introduce machine-generated clinical advice or machine translation of clinician-entered instructions as authoritative output.
- Reuse shared frontend components and design tokens instead of creating page-specific UI patterns.
- Keep the existing Docker workflow healthy; before marking a task complete, run the relevant lint, type-check, test, build, migration validation, and container startup checks.
- Update this roadmap as work is completed. Only check an item after its implementation is connected end-to-end and verified.

## Immediate Next Task

Start with **Priority 1 — Security hardening: MFA**.

The first implementation slice should be:

- [x] Add MFA persistence/schema changes and migration.
- [x] Add TOTP enrollment/start-confirm endpoints.
- [x] Add secure recovery-code generation/storage.
- [x] Add MFA challenge to the existing login/session flow.
- [ ] Add backend tests for enrollment, confirmation, login challenge, recovery code use, and bypass prevention.
- [ ] Add localized frontend enrollment and challenge screens.
- [ ] Run the full backend test/lint/type-check suite and Docker build/start validation before proceeding to organization-level enforcement and admin reset flows.
