# Reporting and audit review

Milestone 9 adds protected, organization-scoped reporting endpoints and an operational dashboard.

## Endpoints

All endpoints require an authenticated session and the permission shown:

- `GET /api/v1/dashboard` (`dashboard:read`): prescription queue, low stock, expiring/expired stock, pending purchasing, open count alerts, and reconciled inventory discrepancies.
- `GET /api/v1/reports/sales` (`reports:read`): completed sales, revenue, tax, discounts, units, and an estimated gross profit.
- `GET /api/v1/reports/sales.csv` (`reports:read`): safe CSV sales export.
- `GET /api/v1/reports/inventory` (`reports:read`): batch/location stock and purchase-cost valuation.
- `GET /api/v1/reports/inventory.csv` (`reports:read`): safe CSV inventory export.
- `GET /api/v1/reports/movements` (`reports:read`): the immutable stock movement ledger.
- `GET /api/v1/reports/purchasing` (`reports:read`): posted receipts and purchase spend.
- `GET /api/v1/reports/suppliers` (`reports:read`): supplier receipt counts, units, and spend grouped by supplier.
- `GET /api/v1/reports/prescriptions` (`reports:read`): prescription status volume and completed dispensing count.
- `GET /api/v1/reports/activity` (`reports:read`): cashier, dispensing, and stock-movement activity grouped by user.
- `GET /api/v1/audit/events` (`audit:read`): paginated audit review with organization, action, entity, actor, outcome, and date filters.
- `GET /api/v1/audit/events.csv` (`audit:read`): bounded CSV export of filtered audit records.

Reports accept `locationId`, `from`, and `to` query parameters. Date ranges use ISO dates and the upper bound is exclusive. The report layer never accepts an organization identifier from the caller; tenancy comes from the authenticated user.

## Financial and clinical safety

Sales report gross profit is explicitly an estimate because the current sale schema stores sale-time selling/tax/discount snapshots but does not yet store cost allocation snapshots. It uses the product purchase cost currently available in the catalog and must not be treated as accounting-grade historical COGS until cost snapshots are added.

Prescription and dispensing reports expose workflow counts only. No clinical alerts or recommendations are generated.

Audit export includes actor display name, action, entity, outcome, timestamp, and contextual metadata already recorded by domain services. Passwords, session tokens, and raw clinical instructions are not recorded by the audit service or selected by these reports.

## Database and deployment

Migration `20260912000009_reporting_audit_indexes` adds indexes for completed-sale date/status queries and organization/action/time audit filtering. Apply it with the normal Prisma deployment command:

```sh
cd backend
npm run db:deploy
```

The migration must be applied against the persistent PostgreSQL service before using the new report queries in a deployed environment.
