# Database migrations

Prisma schema: `prisma/schema.prisma`.

With PostgreSQL running locally and `DATABASE_URL` loaded:

```sh
cd backend
npm run db:generate
npm run db:migrate
```

For a deployment, apply committed migrations without creating new ones:

```sh
cd backend
npm run db:deploy
```

The database is persistent through the named Docker Compose volume. Do not edit an already-applied migration; create a new migration for schema changes.
