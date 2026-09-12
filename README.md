# PharmaPMS

PharmaPMS is a self-hosted, multilingual pharmacy management web application.

The project is intended to cover the core operational needs of a pharmacy, including:

- medicine and product management
- inventory, batches, and expiry dates
- suppliers and purchasing
- point of sale
- patient management
- prescriptions and dispensing
- labels and printing
- reporting
- permissions and audit logs
- multilingual workflows
- future country-specific pharmacy integrations

## Status

Milestones 0 through 9 are scaffolded with backend workflows, persistence, permissions, audit coverage, reporting, and an operational dashboard. Several production-hardening items remain documented in `docs/roadmap.md`, including PostgreSQL integration testing and full frontend API wiring.

## Development foundation

The repository now contains a modular-monolith foundation: a React/Vite frontend, a Fastify/TypeScript API, PostgreSQL/Prisma database migrations, automated tests, and Docker Compose configuration. See `docs/architecture.md` and `docs/roadmap.md` before extending the system.

Copy `.env.example` to `.env`, replace the local development values, then start PostgreSQL and the API with:

```sh
cp .env.example .env
docker compose up --build
```

The Docker API container applies committed migrations automatically before starting. For manual/local API runs, apply migrations from the backend directory with `npm run db:deploy`.

## Frontend

The initial modern web interface lives in `frontend/`.

```sh
cd frontend
npm install
npm run dev
```

The frontend is built with React, TypeScript, and translation files from day one so adding languages later is straightforward. See `frontend/README.md` for localization steps.

## Documentation

- `AGENTS.md` — development rules for AI coding assistants and contributors
- `docs/product-spec.md` — product requirements and feature specification
- `docs/architecture.md` — technology and domain architecture
- `docs/roadmap.md` — milestone tracking
- `docs/reporting.md` — reporting and audit endpoint documentation

## Deployment Goal

PharmaPMS will be deployable as a self-hosted web application using Docker.

A standard installation should eventually be possible using Docker Compose with persistent volumes and environment-based configuration.

## Development Philosophy

PharmaPMS should be:

- self-hostable
- secure
- auditable
- multilingual
- modular
- pharmacy-focused
- extensible for country-specific requirements

## MVP Direction

The initial product should focus on:

1. users and permissions
2. medicine catalog
3. inventory and expiry tracking
4. suppliers and purchasing
5. POS
6. patients
7. prescriptions and dispensing
8. labels
9. audit logging
10. reporting
11. multilingual support throughout the application

See `docs/product-spec.md` for the complete feature list.
