# AGENTS.md — PharmaPMS Development Guide

This file defines the rules that AI coding assistants should follow when working on PharmaPMS.

## Project

Name: PharmaPMS

PharmaPMS is a self-hosted pharmacy management web application intended to support pharmacy operations including inventory, purchasing, POS, prescriptions, patients, reporting, security, and multilingual workflows.

The full functional specification is located at:

`docs/product-spec.md`

Read that file before implementing major features.

## Core Constraints

- PharmaPMS must remain self-hostable.
- The full application must be deployable with Docker.
- Docker Compose should be provided for development and standard deployments.
- Avoid mandatory proprietary cloud dependencies.
- Use environment variables for deployment-specific configuration.
- Never commit passwords, API keys, tokens, private certificates, or other secrets.
- Persistent application data must not live inside disposable application containers.
- Database migrations must be version controlled.

## Development Priorities

Build the MVP in roughly this order:

1. Authentication, users, roles, and permissions
2. Pharmacy / organization configuration
3. Medicine and product catalog
4. Inventory, batches, lots, and expiry tracking
5. Suppliers and purchasing
6. Point of Sale
7. Patient records
8. Prescription and dispensing workflows
9. Printing and labels
10. Audit trail
11. Reports and analytics
12. Multilingual UI and localized patient output throughout all implemented modules

Do not attempt to implement every future feature before the core workflows are stable.

## Architecture Rules

Prefer clear domain boundaries.

Suggested domains:

- identity
- pharmacy
- catalog
- inventory
- suppliers
- purchasing
- pos
- patients
- prescriptions
- dispensing
- reporting
- localization
- audit
- integrations

Country-specific functionality should live behind modules or adapters.

Examples:

- electronic prescriptions
- insurance
- controlled-drug reporting
- tax rules
- government integrations

Do not mix country-specific logic into generic inventory or dispensing code unless it is unavoidable.

## Multilingual Requirements

Internationalization is a core requirement, not a later enhancement.

Rules:

- Never hard-code user-facing text directly into application components when it should be translated.
- Use translation keys.
- Use standard locale identifiers such as `en-US`, `de-DE`, `fr-FR`, and `ar-SA`.
- Support per-user UI language.
- Support per-patient preferred language.
- Patient-facing labels and instructions may use a different language from the pharmacist UI.
- Store language and country as separate concepts.
- Support locale-aware formatting for:
  - dates
  - times
  - numbers
  - decimal separators
  - currency
- Design the UI to support right-to-left languages.
- Use Unicode throughout the application and database.
- Do not dynamically machine-translate safety-critical clinical information.
- Clinical translations should come from approved or reviewed sources.

Avoid database schemas such as:

- `name_en`
- `name_de`
- `name_fr`

Prefer translation tables or another scalable localization model.

## Security Requirements

PharmaPMS handles sensitive medical and commercial information.

Every feature must consider:

- authorization
- authentication
- audit logging
- data validation
- data privacy
- secure defaults
- least privilege
- protection against common web vulnerabilities

Sensitive actions should create audit records where appropriate.

Examples include:

- prescription changes
- dispensing
- stock adjustments
- refunds
- price changes
- user permission changes
- controlled medicine actions

Do not silently delete important business records. Prefer states such as cancelled, voided, archived, or reversed where appropriate.

## Data Integrity

Pharmacy data must be traceable.

Inventory should support:

- product
- batch / lot
- expiry date
- quantity
- stock movement history
- source and destination
- user responsible for changes

Financial and dispensing records should not be modified destructively without an audit trail.

Use database transactions for operations that modify multiple related records.

## Clinical Safety

Do not invent:

- drug interactions
- contraindications
- dosage rules
- pregnancy warnings
- clinical substitutions

Clinical decision support must integrate with a reputable clinical / medication data source.

If such a provider has not yet been selected, create interfaces and mock adapters rather than embedding guessed clinical data.

## UI / UX

The application should be optimized for pharmacy staff who use it throughout the workday.

Prioritize:

- fast workflows
- keyboard-friendly interaction
- barcode scanner compatibility
- clear warnings
- minimal clicks for frequent tasks
- readable tables
- strong search
- clear confirmation for destructive or sensitive actions

Accessibility should be considered during implementation.

## Testing

New functionality should include appropriate tests.

Prioritize testing for:

- authentication
- permissions
- inventory calculations
- batch and expiry behavior
- purchasing
- sales
- refunds
- prescriptions
- dispensing
- localization
- audit logging

Critical pharmacy calculations and stock movements should have automated tests.

## API Design

Use stable, explicit APIs.

- Validate incoming data.
- Return useful errors.
- Avoid leaking internal exceptions or sensitive information.
- Keep business logic out of presentation-only code.
- Document public/internal APIs that other modules depend on.

## Database

Use migrations for every schema change.

Prefer:

- explicit foreign keys
- constraints
- indexes for frequently searched pharmacy data
- immutable or auditable transaction records where appropriate

Avoid premature denormalization.

## Docker

The repository should eventually contain at least:

- `Dockerfile`
- `docker-compose.yml` or `compose.yml`
- `.env.example`
- persistent database volume configuration
- health checks where practical
- deployment documentation

The application should be buildable and runnable from a fresh clone using documented commands.

## Documentation

When adding major functionality:

1. Update relevant documentation.
2. Document new environment variables.
3. Document database migrations if operationally important.
4. Add setup instructions for new integrations.
5. Keep `docs/product-spec.md` aligned with implemented product decisions.

## AI Coding Assistant Behavior

Before making a large change:

1. Read this file.
2. Read `docs/product-spec.md`.
3. Inspect existing architecture and conventions.
4. Prefer extending existing patterns instead of creating competing patterns.
5. Keep changes focused.
6. Do not rewrite unrelated code.
7. Explain important architectural decisions in code comments or documentation when necessary.
8. Do not claim a feature is complete unless its main workflow is actually implemented and tested.

When requirements are ambiguous, favor the option that:

- preserves data integrity
- is easier to audit
- supports multilingual usage
- remains country-neutral
- remains self-hostable
- keeps future pharmacy integrations possible
