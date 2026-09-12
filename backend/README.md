# PharmaPMS API

Fastify/TypeScript API foundation for PharmaPMS.

## Local commands

```sh
npm install
npm run db:generate
DATABASE_URL='postgresql://...' npm run db:validate
npm run dev
```

The API exposes:

- `GET /api/v1/health` — process liveness
- `GET /api/v1/ready` — database readiness check
- `POST /api/v1/auth/bootstrap` — one-time first organization/admin setup
- `POST /api/v1/auth/login` — Argon2id password verification and session cookie
- `POST /api/v1/auth/logout` — server-side session revocation
- `GET /api/v1/auth/me` — current authenticated user
- `GET/PATCH /api/v1/organization` — authorized pharmacy configuration
- `GET /api/v1/locations` — authorized organization locations
- `GET/POST/PATCH /api/v1/users` — authorized user management
- `GET/POST/PATCH /api/v1/catalog/products` — authorized product catalog operations
- `GET /api/v1/inventory` — current balances by batch/location/state
- `GET /api/v1/inventory/movements` — immutable movement history
- `GET /api/v1/inventory/fefo` — expiry-ordered allocation candidates
- `POST /api/v1/inventory/receive` — transactional receiving
- `POST /api/v1/inventory/adjust` — auditable stock adjustment
- `POST /api/v1/inventory/status-change` — damage/quarantine/expiry transitions
- `POST /api/v1/inventory/counts` and `/reconcile` — count workflows
- `GET /api/v1/roles` — authorized role and permission inspection
- `GET/POST/PATCH /api/v1/suppliers` — supplier management
- `GET/POST/PATCH /api/v1/purchase-orders` — purchase order lifecycle
- `POST /api/v1/purchase-orders/:purchaseOrderId/receive` — transactional partial/full receiving
- `POST /api/v1/purchase-returns` — auditable supplier returns
- `GET/POST/PATCH /api/v1/patients` — permission-protected patient records and archive behavior
- `GET /api/v1/patients/:patientId` — audited patient detail and history foundation
- `GET/POST /api/v1/prescriptions` — prescription queue and clinician-entered prescription creation
- `POST /api/v1/prescriptions/:prescriptionId/status` — explicit receipt/verification/cancellation workflow
- `POST /api/v1/prescriptions/:prescriptionId/verify` — pharmacist verification
- `POST /api/v1/prescriptions/:prescriptionId/dispense` — transactional partial/full FEFO dispensing
- `GET /api/v1/dispensing` — permission-protected dispensing history
- `GET /api/v1/documents/prescriptions/:id/label` — localized prescription label HTML
- `GET /api/v1/documents/prescriptions/:id/instructions` — patient-locale instruction HTML with validated-translation warning
- `GET /api/v1/documents/sales/:id/receipt` — localized receipt HTML
- `GET /api/v1/purchase-cost-history` — append-only purchase cost history
- `GET /api/v1/pos/products` — barcode/product search for checkout
- `POST /api/v1/pos/sales` — transactional FEFO sale completion
- `POST /api/v1/pos/sales/:saleId/void` — void held sales
- `POST /api/v1/pos/refunds` — auditable batch-aware refunds

Sessions are stored as SHA-256 token hashes in PostgreSQL and exposed to browsers only through an HTTP-only SameSite cookie.

Use `npm run db:migrate` during development to create a migration, and `npm run db:deploy` for committed migrations in deployments. The API now exposes catalog, inventory, supplier, and purchasing foundations. POS, patient, prescription, and dispensing workflows remain later milestones.
