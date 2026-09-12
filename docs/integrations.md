# Integration and country-module foundation

PharmaPMS keeps external systems behind adapter contracts in `backend/src/modules/integrations/contracts.ts`. These interfaces are intentionally provider-neutral and return explicit `SUCCESS`, `NOT_CONFIGURED`, or `FAILED` outcomes. No provider, cloud service, clinical facts, or credentials are bundled.

Implementations should be injected at application startup and configured through environment variables or an operator-managed secret store. Secrets must never be placed in source code, migrations, logs, or audit metadata. Adapter calls must be idempotent where the external system supports an idempotency key, and failures must not partially commit pharmacy transactions.

Country-specific modules must not alter generic catalog, inventory, POS, prescription, or dispensing rules directly. A country module should provide:

1. A country code and versioned configuration.
2. Explicit tax, identifier, insurance, e-prescription, controlled-drug, or regulatory adapters implementing the generic contracts.
3. Validated translation/terminology data where needed.
4. Tests for its own legal and integration behavior.
5. A documented configuration and secret list.

The core domain passes country/context information to adapters but remains country-neutral. Adding Germany, Saudi Arabia, or another country therefore adds an adapter/module and configuration rather than conditional country logic throughout the application.

## Branch and transfer API

`POST /api/v1/inventory/transfers` creates a draft transfer and `POST /api/v1/inventory/transfers/:id/complete` completes it. Both require `inventory:transfer`. A non-administrator user with a primary location can only operate on that location; administrators may consolidate across locations. Completion is atomic and writes paired `TRANSFER` movements linked to the transfer, so a failure leaves both balances and the transfer state unchanged. `GET /api/v1/inventory/transfers` provides the organization-scoped history.
