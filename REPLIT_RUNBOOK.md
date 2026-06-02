# WebExcels DRM — Replit Runbook

How the imported WebExcels DRM app was brought up in this Replit development
environment. The goal of this pass was **only** to get the existing app running
as-is. No business workflows, approval logic, roles, permissions, UI, or database
business structure were changed.

## 1. Correct project root

The import was nested two levels deep
(`WebExcelsDRM-main/WebExcelsDRM-main/`). It was moved up so the real project
root is now the workspace root:

```
/home/runner/workspace
```

This root contains the active app: `server/`, `client/`, `shared/`,
`package.json` (name: `rest-express`), `vite.config.ts`, `drizzle.config.ts`.

The active runtime is `server/index.ts` (Express + Vite middleware), the active
frontend entry is `client/src/App.tsx`, and the active schema is
`shared/schema.ts` (PostgreSQL schema name: `drm`).

> Note: the smaller `src/` scaffold and the `api:dev` / `auth:dev` scripts are
> NOT the primary app and were left untouched.

## 2. Node version

```
node -v   ->  v20.20.0   (satisfies engines: ">=20 <23")
npm  -v   ->  10.8.2
```

`.replit` declares `modules = ["nodejs-20"]`.

## 3. Install command used

```
npm install
```

(`npm ci` was not required; `npm install` completed successfully.)

## 4. Database setup

The app uses the **Replit-provided PostgreSQL** database (not the previous
developer's external Supabase database). Replit injects `DATABASE_URL`,
`PGHOST=helium`, etc. into the environment.

Steps performed against the Replit database:

```sql
CREATE SCHEMA IF NOT EXISTS drm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Then the schema was created from `shared/schema.ts`:

```
npx drizzle-kit push --force
```

All 108 tables defined in `shared/schema.ts` were created. `drizzle-kit push`
reports an error at the foreign-key stage because `shared/schema.ts` (and the
base migration `migrations/0000_rapid_taskmaster.sql`) declare ~62 foreign keys
where a `varchar` column references `users.id` (a `uuid`). PostgreSQL cannot
create a FK between incompatible types, so those specific FK constraints do not
exist. **This is pre-existing in the codebase and does not affect the tables,
columns, or app functionality** — it only omits some referential-integrity
constraints that the original database never had either.

## 5. Run command

```
npm run dev
```

This is wired to the Replit "Run" button via the `Start application` workflow
(`.replit` → `[[workflows.workflow]]`), serving on port **5000**
(mapped to external port 80).

## 6. Environment variables

Stored in Replit shared env (`.replit` → `[userenv.shared]`), so they are NOT in
source files:

| Key            | Value / source                                  |
| -------------- | ----------------------------------------------- |
| `DATABASE_URL` | Replit-managed (Helium PostgreSQL), auto-injected |
| `JWT_SECRET`   | freshly generated strong random value           |
| `DATABASE_SSL` | `false` (Helium is internal, no SSL)            |
| `DEBUG_ERRORS` | `true`                                           |
| `NODE_ENV`     | `development` (set by the `dev` script via cross-env; also in `.env`) |
| `PORT`         | `5000`                                            |

The imported `.env` still contains the old developer's Supabase `DATABASE_URL`
and an old `JWT_SECRET`, but these are **ignored**: the env loader
(`server/env.ts`) does not override variables already present in the process
environment, and Replit injects `DATABASE_URL` / sets `JWT_SECRET` first.

## 7. Dev admin login (DEV ONLY — do not use in production)

A development admin user was created using a one-off DEV-ONLY script that was
**removed after use** (so no credentials are committed to the repo):

- Email: `admin@webexcels.local`
- Password: provided privately in the Replit Agent chat summary (not stored in
  source or docs).
- Role: `admin`

Login verifies against the `password_hash` column (bcrypt). To recreate or rotate
the admin, run a one-off script that hashes the password with
`authService.hashPassword` and upserts the user, then delete the script.

## 8. Files changed

- **Moved**: entire project from `WebExcelsDRM-main/WebExcelsDRM-main/` to the
  workspace root. Removed the empty nested folders and the large `zipFile.zip`.
- **`server/db.ts`**: `validateDbHost()` now also accepts the Replit internal
  single-label host (`helium` / `process.env.PGHOST`). This was the only code
  change required to boot against the Replit database. No business logic changed.
- **Added then removed** a one-off DEV-ONLY admin-bootstrap script after
  creating the admin user (no credentials committed).
- **Added** this `REPLIT_RUNBOOK.md` and `replit.md`.
- **`.replit`**: workflow + `[userenv.shared]` env vars configured by the Replit
  tooling.

No changes were made to approval logic, departments, roles, permissions, UI,
APIs, or the database business structure.

## 9. Known remaining issues

- **`GET /api/tasks` returns 500** (the "quick entries" route in
  `server/quick-entries-routes.ts`). Its raw SQL expects `tasks.due_at` and
  `tasks.assigned_to`, but the schema's `tasks` table has `due_date` and
  `assigned_to_user_id`. This is a pre-existing mismatch between that route's SQL
  and `shared/schema.ts`; fixing it means changing route logic or DB structure,
  which is intentionally deferred.
- The `varchar -> uuid` foreign keys described in section 4 are not enforced at
  the database level (pre-existing schema inconsistency).
- The Replit database is freshly created and empty apart from the dev admin user
  and any data the app seeds on startup; it does not contain the previous
  developer's Supabase data.

Smoke test results: login succeeds; `GET /api/auth/me`, `/api/customers`,
`/api/users`, `/api/permissions` all return 200; the React app, login screen,
dashboard and sidebar/menu load.

## 10. Exact next step before workflow changes

Decide and confirm the database strategy: continue on the empty Replit
PostgreSQL (and seed/import data as needed), **or** provide an explicit
production/Supabase `DATABASE_URL` to point at the real data. Only after that
should business-workflow work begin.
