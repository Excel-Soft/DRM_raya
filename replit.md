# WebExcels DRM

Internal DRM / business-operations web app (sales, customers, PMS tasks, product
posting, approvals, permissions, HR/attendance, accounts).

## Stack
- **Frontend**: React 18 + Vite + TypeScript (`client/`), Wouter routing,
  TanStack Query, Tailwind + Radix UI.
- **Backend**: Express + TypeScript (`server/`), serves both the API and the
  Vite frontend via middleware. Entry: `server/index.ts`.
- **Database**: PostgreSQL (schema name `drm`), Drizzle ORM. Schema in
  `shared/schema.ts`. Uses the Replit-provided PostgreSQL database.
- **Auth**: JWT (bcrypt password hashing).

## Running
- Dev: `npm run dev` (Replit "Run" button / `Start application` workflow), port 5000.
- The active app is `server/`, `client/`, `shared/`. The smaller `src/` scaffold
  and `api:dev` / `auth:dev` scripts are legacy and not used.

See `REPLIT_RUNBOOK.md` for full setup details, environment variables, the dev
admin login, and known issues.

## User preferences
- First priority was to run the imported app as-is: no changes to business
  workflows, approval logic, roles, permissions, UI, APIs, or DB business
  structure. Only boot-blocker fixes were made.
- Use the Replit PostgreSQL database, not the previous developer's external
  Supabase database, unless an explicit production `DATABASE_URL` is provided.
- Do not delete the existing backup/scratch files.
- Secrets must live in Replit-managed env, never hard-coded in source.
