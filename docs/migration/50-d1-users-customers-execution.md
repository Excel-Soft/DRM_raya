# D1 + Users/Customers migration execution (staging)

**Date:** 2026-11-04  
**Database:** `drm_legacy_stage` only  
**Approval:** Mohammad — proceed with users + customers per migration plan.

## D1 — Customer source of truth

| Decision | Choice |
|----------|--------|
| **Primary customer load** | `legacy_archive.webxl_company` → `drm.customers` |
| **`tbl_customers`** | **Archive-only** — no ETL into `customers` until a separate merge/reconcile plan is approved |
| **Rationale** | App routes and FKs (`com_id`, `assignId`, invoices) align with `webxl_company`; `tbl_customers` is parallel CRM shape (doc 06, 08, 10) |

## Users — `webxl_user` → `drm.users`

| Topic | Rule |
|-------|------|
| PK map | `user_id` → new UUID; `migration_meta.migration_legacy_ids` (`entity_type=user`) |
| Login identity | `webxl_login` LATERAL pick (non-empty username preferred, latest `updated_at`) for `username` + password |
| Email / username uniqueness | First row keeps email; duplicates → `local+uid{user_id}@domain`; empty email → `legacy-user-{user_id}@drm.migrated.local` |
| Password | Legacy `webxl_login.password` is **short plaintext** — on execute, **bcrypt** into `password_hash` only (never logged). Users without login row: `MIGRATION_STAGING_DEFAULT_PASSWORD` env (staging reset policy) |
| Roles | Copy `roleId` / login `role_id` into `role_id`; `role` left null unless mapped later |
| HR fields | `name`, `fname` → `name` / `full_name`; `branch`, `country`, `officeNumber` → defaults where required |

**Scripts:** `backend/scripts/migration/run-users-transform.mjs` (`--dry-run` | `--execute-staging`)

## Customers — `webxl_company` → `drm.customers`

| Legacy | Modern |
|--------|--------|
| `id` | UUID + legacy map (`entity_type=customer`) |
| `com_id` | `drm_id` (unique); duplicate `com_id` → reject 2nd+ |
| `cname` | `company_name` (fallback `com_id`) |
| `contact` | `account_name`, `phone` (legacy has no email column) |
| *(synthetic)* | `email` = `legacy-{id}@drm.migrated.local` |
| `country` / `abAccount` | `country`, `region` (pool codes FM/GS/GM/HI/AK else country or `Other`) |
| `status` | Map to enum `New` / `Renew` / `Expire` |
| `grade` | Normalize; unknown → `C` |
| `assignId`, `created_by` | `owner_user_id`, `created_by` via user map (null if unmapped) |
| `disable` = `Yes` | `is_deleted` = true |

**Scripts:** `backend/scripts/migration/run-customers-transform.mjs` (`--dry-run` | `--execute-staging`, `--batch-size=1000`, optional `--limit`)

**Order:** Run **users** execute before **customers** execute.

## Staging login (Mac / tunnel)

1. Point local backend `.env` at `drm_legacy_stage` (see `.env.staging-tunnel.example`).
2. Log in with **legacy email** + **legacy password** (from old DRM) for users that had `webxl_login`.
3. Users without login: set password via reset flow or re-run execute with `MIGRATION_STAGING_DEFAULT_PASSWORD` and use that password once.

## Execution log (drm_legacy_stage)

| Step | Result |
|------|--------|
| Users dry-run | 739 valid, 1 rejected (`missing_name`) |
| Users execute | **739** → `drm.users`; **739** legacy maps |
| Customers dry-run | 231,920 valid, **83** rejected (`duplicate_com_id`) |
| Customers execute | **231,920** → `drm.customers` (~8 min, batch 2000) |
| Archive | `webxl_user` 740, `webxl_company` 232,003 unchanged |

## Follow-ups (D5a)

See [53-module-followups-migration-plan.md](./53-module-followups-migration-plan.md) — **987,851** rows in `drm.follow_ups`.

## Out of scope (this phase)

- `tbl_customers`, invoices, follow-ups, GM — next modules per plan 27/14.
- Supabase production, live VPS `.env`, PM2, Nginx — unchanged.
