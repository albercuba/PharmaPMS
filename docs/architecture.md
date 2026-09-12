# PharmaPMS Architecture

## Scope

PharmaPMS is a self-hosted, browser-based pharmacy management system. The initial implementation uses a modular monolith so domain boundaries are explicit without the operational cost of microservices. Pharmacy records remain traceable and country-specific behavior can be added through adapters rather than embedded in generic workflows.

## Technology decisions

| Concern | Choice | Rationale |
| --- | --- | --- |
| Browser UI | React + TypeScript + Vite | Mature ecosystem, strong typing, fast local development, and an existing UI scaffold in this repository. |
| API | Fastify + TypeScript | Small, fast, schema-friendly HTTP framework with a clear plugin model and good security/performance characteristics. |
| Database | PostgreSQL | Open-source, durable relational storage with transactions, constraints, indexes, and JSON support where justified. |
| Database access | Prisma Client + Prisma Migrate | Typed queries and version-controlled migrations. Domain services will own transaction boundaries rather than exposing Prisma throughout the UI. |
| Validation | Zod | Runtime validation at configuration and API boundaries with inferred TypeScript types. |
| Authentication | Server-managed secure sessions backed by persistent storage | Keeps credentials and session decisions on the server; supports revocation and avoids putting long-lived tokens in browser storage. Passwords are hashed with Argon2id and only SHA-256 session token hashes are persisted. |
| Authorization | Application RBAC with explicit permissions | Roles are assignable per organization/location and sensitive operations can require additional pharmacist approval. Authorization is enforced in backend services, not only in the UI. |
| UI localization | i18next + react-i18next | Translation keys, fallback locales, locale-aware formatting, and RTL metadata are already integrated in the frontend. |
| API localization | Locale-aware JSON catalogs at the API boundary | API errors return stable codes plus localized messages selected from `X-UI-Locale`/`Accept-Language` with fallback. Domain data translations remain normalized in database translation tables. |
| Testing | Vitest + Fastify inject + test PostgreSQL | Fast unit tests for domain logic and HTTP contract tests without needing a browser. Database integration tests will use an isolated PostgreSQL service. |
| API style | JSON REST under `/api/v1` | Explicit, browser-friendly endpoints with stable versioning. OpenAPI documentation can be added as endpoint contracts mature. |
| Deployment | Docker Compose with API, frontend, and PostgreSQL | Simple self-hosted operation, persistent database volume, and no mandatory proprietary service. A reverse proxy/HTTPS remains an operator concern. |

## Repository structure

```text
backend/                 Fastify API and application services
  src/config/            Environment parsing and application configuration
  src/lib/               Shared backend utilities
  src/modules/           Bounded domains (identity, catalog, inventory, ...)
  src/plugins/           Fastify plugins and cross-cutting concerns
  src/routes/            HTTP route registration
  tests/                 Backend unit and API tests
database/prisma/         Prisma schema and versioned migrations
frontend/                React browser application
docs/                    Product, architecture, and delivery documentation
docker/                  Container-specific configuration
compose.yml              Local/self-hosted service composition
.env.example             Non-secret configuration template
```

The backend is organized by domain as features arrive. Presentation routes should call application/domain services; they should not contain inventory, dispensing, pricing, or authorization rules.

## Initial data model direction

The first schema establishes tenancy and identity boundaries without pretending that future workflows are complete:

- `Organization`: pharmacy company/tenant and its country configuration.
- `Location`: branch or pharmacy site belonging to an organization.
- `User`: employee identity, preferred UI locale, and account state.
- `Role`, `Permission`, `UserRole`, `RolePermission`: explicit RBAC assignments.
- `Session`: revocable server-side authentication sessions.
- `AuditEvent`: append-only security and business audit record foundation.

The next domain migrations will add:

- Catalog: organization-scoped `Product`, `Medicine`, `ProductTranslation`, `Manufacturer`, `ProductBarcode`, `ActiveIngredient`, and `MedicineIngredient`. Product status is lifecycle-based; catalog records are never hard-deleted through the API. Exact SKU/barcode constraints and PostgreSQL trigram search indexes support pharmacy lookup.
- Inventory: `Batch` with lot/expiry/location ownership, `InventoryBalance` as a transactional derived view by batch/status, immutable `StockMovement` ledger, `InventoryThreshold`, `InventoryCount`, and `InventoryCountItem`. Movement writes and balance changes occur together in transactions; negative balances are rejected.
- Purchasing: `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, immutable `PurchaseReceipt`/receipt items, append-only `PurchaseCostHistory`, and `PurchaseReturn` records. Receiving shares the inventory transaction client so batches, balances, movements, PO quantities, costs, and audits commit atomically.
- Patients/prescriptions: `Patient`, `Prescription`, `PrescriptionItem`, `DispensingRecord`.
- POS: immutable `Sale`/`SaleItem` snapshots, FEFO `SaleItemBatch` allocations, `Payment` records, and `Refund`/refund-batch records. Sale completion, stock deduction, payments, and audit events share one transaction.
- Patients: organization-scoped `Patient` records with independent preferred locale, structured allergy/history/insurance/consent foundations, archive-only lifecycle, and privacy-scoped search/detail access.
- Prescriptions/dispensing: explicit `Prescription`/`PrescriptionItem` snapshots, `Prescriber`, pharmacist verification metadata, immutable `DispensingRecord`/item/batch allocations, and `DISPENSING` inventory movements. No clinical decision-support facts are generated locally; validated provider adapters remain a future integration.
- Documents: printer-agnostic HTML renderers for prescription labels, patient instructions, and receipts. Renderers receive an explicit output locale, use patient locale by default for patient documents, preserve original clinical instruction text when no validated translation exists, and expose RTL metadata for downstream printer adapters.
- Reporting/audit: organization-scoped, permission-protected report queries read immutable sales, purchase, inventory movement, prescription, dispensing, and balance records. Audit review supports paginated filters and CSV export; exports contain operational context only and never passwords, session tokens, or unnecessary clinical content.
- Multi-branch: the centralized organization catalog is shared while stock, purchasing, sales, prescriptions, dispensing, and reporting are location-scoped. Users with a primary location are restricted to it for branch-sensitive APIs; administrators can consolidate across locations. `StockTransfer` is an explicit auditable aggregate, and completion writes paired source/destination ledger movements in one transaction. The `scopeLocationId`/`assertLocationAccess` authorization helpers are the required boundary for location-aware routes.
- Integrations: provider-neutral contracts live under `backend/src/modules/integrations`. External credentials/configuration are injected from deployment configuration; country-specific adapters remain outside generic domain services and no provider is mandatory.

Important records will use lifecycle states such as `DRAFT`, `CONFIRMED`, `CANCELLED`, `VOIDED`, or `ARCHIVED` rather than destructive deletion. Stock is traceable through movement records; a balance is not the system of record. Multi-record operations use database transactions.

Localized business content will use translation relations keyed by entity and locale, never columns such as `name_en` or `name_de`. UI locale, pharmacy country, currency, tax configuration, and patient/print locale are separate concepts.

## Security and privacy boundaries

- Secrets are supplied through environment variables and are not committed.
- Passwords are Argon2id hashes; raw passwords are never persisted or logged.
- Sessions are HTTP-only, Secure in production, SameSite protected, and revocable.
- Backend authorization is mandatory even when the UI hides an action.
- Input is validated at API boundaries; database constraints provide a second integrity layer.
- Errors returned to clients are safe, stable errors, not stack traces or SQL details.
- Sensitive actions create audit events without storing unnecessary clinical data in log messages.
- Login failures are counted in the database and accounts are temporarily locked after repeated failures.
- Clinical safety data will be integrated behind a provider interface; no interactions, contraindications, or dosage facts will be invented locally.

## Localization

The frontend stores translation keys in locale resources and uses `Intl` for dates, numbers, and currencies. `document.dir` is derived from locale metadata for RTL support. Adding a language means adding a resource and registering locale metadata, not changing components.

Patient language and printed instruction language will be stored on patient/output preferences independently of the employee UI locale. Safety-critical translations must be approved/managed content, not live machine translation.

## Docker and persistence

`compose.yml` defines a PostgreSQL service with a named volume and an API service that waits for database health. The database is never stored in the disposable API container. Production operators should place an HTTPS reverse proxy in front of the application and configure backups for the PostgreSQL volume.

## Architectural decisions not yet implemented

Purchasing now provides supplier lifecycle records, explicit purchase-order states, partial receiving, backorder-ready quantities, supplier returns, append-only cost history, and transactional inventory integration. POS now provides transactional FEFO sale deduction, immutable price/tax/discount/payment snapshots, permission-gated sensitive actions, refunds, and audit events. Patient management now provides organization-scoped profiles, independent patient locale, structured privacy/clinical-history foundations, archive behavior, and audited access/modification. Prescription/dispensing foundations now provide explicit states, prescriber and clinician-entered instruction snapshots, pharmacist verification, partial FEFO dispensing, batch traceability, and transactional audit records. Reporting now provides protected operational dashboard counts, sales/inventory/purchasing/prescription/activity reports, and audit filtering/CSV export. Clinical decision support, reviewed clinical translations, register shifts, PDF/physical-printer adapters, and broader document/report export remain deferred. Milestone 3 now provides batch/location inventory, immutable movements, receiving, adjustments, status transitions, expiry processing, FEFO allocation, low-stock thresholds, and count reconciliation. Milestone 1 now provides Argon2id password hashing, revocable HTTP-only sessions, bootstrap/login/logout, organization configuration, RBAC enforcement, role/permission management, and security audit events. MFA now provides encrypted TOTP enrollment, confirmation, one-time recovery-code hashes, login challenges, organization enforcement policy, rate-limited challenge attempts, and audit events. MFA administration screens, recovery/reset self-service, and full endpoint integration tests remain follow-up work.
