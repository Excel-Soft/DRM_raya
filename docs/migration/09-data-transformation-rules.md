# Phase 1F — Data transformation rules

Rules for Phase 2 ETL. **No sample PII, passwords, or tokens** from the dump are included here.

## ENUM columns (MySQL → PostgreSQL)

Legacy MySQL enums (10 columns in DDL) must **not** be cast directly to Drizzle enums.

| Pattern | Rule |
|---------|------|
| Lowercase legacy (`success`, `failed`, `pending`) | Map to **text** or target enum via explicit `CASE` table |
| `webxl_coa_parent_heads.account_type` (`Asset`, …) | Map to `account_head_category` (`Assets`, `Liabilities`, `OwnerEquity`, `Revenue`, `Expenses`) — **rename + pluralization** |
| `webxl_gm_account_history.operation` | Store as **text** in archive or JSON audit payload |
| Drizzle enums (PascalCase / mixed) | Maintain CSV lookup per `(mysql_table, column)` |

Unknown enum value → `migration_rejects` row, do not fail entire batch.

## Boolean (`tinyint(1)`)

| MySQL | PostgreSQL |
|-------|------------|
| `0` / `1` | `false` / `true` |
| `NULL` | `NULL` unless target column is `NOT NULL` → default per schema |

Apply to ~21 boolean-like columns (attendance flags, `password_resets.used`, etc.).

## Zero dates and invalid dates

| Legacy pattern | Rule |
|----------------|------|
| `0000-00-00` date | `NULL` or reject row (config per column) |
| `0000-00-00 00:00:00` datetime | `NULL` |
| Invalid leap dates | `NULL` + reject log |

PostgreSQL ** rejects** zero dates without transformation.

## Timestamps and time zones

| Rule | Detail |
|------|--------|
| Dump session | `time_zone = +00:00` in header — treat naive datetimes as **UTC** unless business confirms local (PKR) |
| `ON UPDATE CURRENT_TIMESTAMP()` | **Drop** on insert; use `updated_at = created_at` or source `updated_at` column only |
| Target columns | Prefer `timestamptz` where production uses timezone-aware columns |

## JSON

| MySQL `json` | PostgreSQL `jsonb` |
|--------------|-------------------|
| Validate parse | On failure → text fallback or reject |
| Empty object/array | Preserve |

## Decimal and monetary fields

| Issue | Rule |
|-------|------|
| `float` / `double` (e.g. invoice totals) | Cast to `numeric(p,s)` per target column; avoid binary float in money |
| `decimal` | Direct map with scale check |
| Legacy varchar amounts (`tbl_invoices.grandtotal`) | Strip non-numeric; parse to numeric or reject |
| Currency | Default **PKR** where modern schema defaults; USD fields on GM/dollar tables per column name |

## Unsigned integers

| Issue | Rule |
|-------|------|
| `bigint(20) UNSIGNED` | Fit in signed `bigint`; if > 2^63-1 → reject |
| `int(11) UNSIGNED` | Safe in `integer` |

## NULL vs empty string

| Rule | |
|------|--|
| `""` for nullable text | Convert to `NULL` where app treats blank as missing (match Drizzle defaults) |
| Required NOT NULL text | Coalesce `''` only if schema allows; else reject |

## Password hashes and reset tokens

| Data | Rule |
|------|------|
| User password fields in `webxl_user` | Map to `password_hash` if bcrypt/argon recognizable; else force password reset flow |
| `password_resets.token` | Map to `password_reset_tokens.token`; resolve **email** via legacy user join — **never** map `user_id` to token PK |
| `webxl_password_reset_emails` | Archive only — not imported as tokens |

**Never** write secrets or hashes into migration documentation or logs.

## HTML and LONGTEXT

| Rule | |
|------|--|
| `LONGTEXT` / `TEXT` with HTML | Store as-is in `text` columns; optional sanitizer **only** if product requires (default: preserve fidelity) |
| Size limits | Truncate only with explicit business approval + reject log |

## `user_activities` vs audit logs

Do **not** import legacy audit rows into **`user_activities`**. Sales activity feed rows are **created by modern app logic** with typed `action_type` enum — legacy audit enums do not match.

## Diagnose follow-up composed strings

Legacy `webxl_followup_service` stores ratings like `"Old-3/ New-4"` in varchar fields — copy **verbatim** into `diagnose_followups.*` text columns per `schema.ts` comment.

## Charset

Source **utf8mb4** → PostgreSQL **UTF8**. Strip invalid UTF-8 sequences with replacement char only if parser fails.

## Repeatable transforms

Each rule should be implemented as a **pure function** `(mysql_table, column, raw_value) -> pg_value | REJECT` in Phase 2 ETL, unit-tested without production data.
