# CRM/ERP Database (PostgreSQL + Drizzle ORM)

This repo contains a full CRM/ERP database schema implemented with:

- TypeScript
- PostgreSQL
- `drizzle-orm` + `drizzle-kit`
- `pg`
- `dotenv`

Schema lives in `src/db/schema.ts` (UUID PKs everywhere, `created_at`/`updated_at` on every table, `snake_case` columns, soft-delete via `is_deleted` on business records).

## Setup

1. Install dependencies

```powershell
npm install
```

2. Create `.env` (in repo root)

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
# Optional (set true for hosted Postgres requiring SSL)
DATABASE_SSL=true
# Optional (default: require). Use verify-full if your provider supports full verification.
# DATABASE_SSL_MODE=require
# DATABASE_SSL_MODE=verify-full

# Optional seed overrides
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=admin123
```

Note: Some Windows editors save `.env` as UTF-16LE; this project supports UTF-8 and UTF-16LE.

## Migrations

- Generate SQL migrations into `drizzle/`:

```powershell
npm run db:generate
```

- Apply migrations:

```powershell
npm run db:migrate
```

- Drizzle stores migration state in `drizzle.__drizzle_migrations` (schema `drizzle`), not in `public`.

- (Dev-only) Push schema directly without migrations:

```powershell
npm run db:push
```

## Seed

```powershell
npm run db:seed
```

This seeds:

- roles + permissions + role_permissions
- an admin user (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- a small demo customer/project/ticket dataset

## Notes

- UUID defaults use Postgres `gen_random_uuid()` (the initial migration enables `pgcrypto`).
- `updated_at` is set by the application/seed; if you want DB-enforced updates, add a trigger in a migration.

## API (JWT Auth + Customers)

This repo also includes a strict, multi-user API implementation (no data bleeding):

- Sales Executive: customers scoped to `customers.created_by = req.user.id`
- Sales Manager/Admin: can query all customers
- Not-found responses are `404` when scoped out (to avoid leaking existence)

### Env

```env
JWT_SECRET=change-me
```

### Run

```powershell
npm install
npm run api:dev
```

### Endpoints

- `POST /api/auth/signup` → creates user (bcrypt `password_hash`)
- `POST /api/auth/login` → returns `{ token, user }` (JWT `sub` + `role`, 12h expiry)
- `GET /api/auth/me` → current user
- `POST /api/customers/check-duplicates`
- `POST /api/customers` (transactional create + primary contact; returns `409` on duplicates unless `forceCreate=true`)
- `GET /api/customers` (paged list)
- `GET /api/customers/:id` (customer + contacts)
- `POST /api/customers/import` (CSV upload field: `file`)
- `GET /api/customers/import-template` (CSV template)
