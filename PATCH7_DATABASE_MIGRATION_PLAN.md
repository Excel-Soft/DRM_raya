# PATCH 7 — Database Migration Plan (Stage 8, Section B · DB-001)

**Date:** 2026-06-30. Builds on `PATCH7_DB_MIGRATION_RECONCILIATION.md`.
Reconciles `shared/schema.ts`, the `migrations/` history, and the live `drm` schema;
documents the `db:push` defect and the runtime-DDL apply path. **No destructive
migration was run; all DDL is additive.**

## 1. Sources of truth & tooling
| Layer | Location | Role |
|---|---|---|
| Schema of record | `shared/schema.ts` (Drizzle) | canonical model |
| Generator config | `drizzle.config.ts` | `dialect: postgresql`, `schemaFilter: ["drm"]`, `out: ./migrations`, `url: DATABASE_URL` |
| Migration history | `migrations/*.sql` (**32 files**) + `migrations/meta` | historical record; **not** the live-apply path |
| Live-apply path | `server/db/ensure.ts` via `ensureDbOnce()` (`server/index.ts:76`) | additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` at boot |

## 2. `db:push` is broken (known, pre-existing — DB-001 open root cause)
`npm run db:push` (`drizzle-kit push`) **fails repo-wide** on a pre-existing
foreign-key **type mismatch** unrelated to any Patch 7 change. Therefore:
- We do **not** run `db:push`/`drizzle-kit migrate` as part of a change.
- Additive schema needs are applied as **runtime DDL** (`ADD COLUMN IF NOT EXISTS`)
  or via `psql` — never a push.
- The server performs **schema maintenance on boot**; startup log shows
  `[accounts] schema maintenance completed successfully`. This is the de-facto
  reconciliation path (e.g. `server/db/ensure.ts` adds `penalties.status`,
  `penalties.voided_by/voided_at/void_reason`, `attendance_edit_requests.salary_locked`,
  `…override_reason`, all idempotently).

## 3. Test-DB / migration run result (executed this session)
| Action | Result |
|---|---|
| `npm run db:push` against the configured DB | **FAILS** — pre-existing FK type mismatch (unchanged) |
| Runtime ensure-DDL at boot (`ensureDbOnce`) | **SUCCEEDS** — `schema maintenance completed successfully` |
| Live `drm` table count | **641 tables** (`information_schema.tables`) |
| Patch-relevant tables present | `penalties, gm_entries, gm_loan_terms, gm_partial_receipts, invoices, projects, social_media_posts, activity_logs, it_domains, office_expenses, account_heads, cross_department_status_history` — **all present** |

> A dedicated throwaway *test database* was not provisioned; the reconciliation was
> run against the live dev DB **read-only** (table census) plus the idempotent boot
> ensure path. No destructive or data-mutating migration was executed.

## 4. Tables added across patches (representative)
Drizzle `shared/schema.ts` is the inventory of record. Patch-era additions verified
present in the live schema include: penalties + void columns (P2/P3),
`gm_*` pool/loan/partial-receipt tables (P5), `cross_department_status_history` (P5),
`social_media_posts` (P4), IT assets (`it_domains`, `it_backups`, servers) (P4),
office accounts (`office_expenses`, `account_heads`) (P4), `activity_logs` (audit).

## 5. Forward-migration policy (this stage)
- **DDL footprint this stage: zero.** No columns/tables/constraints/indexes added.
- Where the historical `migrations/` set lags `shared/schema.ts`, the gap is covered
  at runtime by `ensure.ts`; no new forward migration is required for current code.
- **Recommended (out of scope for closure):** fix the FK type mismatch so
  `drizzle-kit push`/`generate` works again, then **squash** the runtime-ensure DDL
  into proper forward migrations and retire the boot-DDL dependency. This is a schema
  migration project, not a gap-closure task — tracked under **DB-001 (Partial)**.

## 6. Safety guarantees
- No `DROP`, no destructive `ALTER`, no data backfill executed.
- All applied DDL is additive and idempotent (`IF NOT EXISTS`).
- `search_path` pinned to `drm, public` per connection.

## Status
**DB-001 = Partial.** Live schema matches code expectations and boots cleanly via
runtime ensure-DDL; closure to Complete requires fixing the `db:push` FK defect and
migrating off boot-DDL onto versioned forward migrations.
