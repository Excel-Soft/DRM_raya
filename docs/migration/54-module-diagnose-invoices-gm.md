# D2 batch — Diagnose → Invoices → GM (`drm_legacy_stage`)

**Order executed:** 1) Diagnose 2) Invoices 3) GM  
**Live VPS `.env` / PM2:** unchanged (staging DB only)

## 1. Diagnose — `webxl_followup_service` → `drm.diagnose_followups`

| | |
|--|--:|
| Archive | 105,408 |
| Migrated | **105,343** |
| Rejected (unmapped `uid`) | 65 |
| DDL | `backend/scripts/migration/ddl/07_diagnose_followups.sql` |
| Script | `run-diagnose-transform.mjs` |

## 2. Invoices — `webxl_invoice` → `drm.invoices` (D2 webxl only)

| | |
|--|--:|
| Archive | 10,386 |
| Migrated | **10,381** |
| Rejected (unmapped user) | 5 |
| Invoice numbers | `LEG-000001` … (legacy `invoice_id`) |
| Line items | `items = '[]'` (no `webxl_invitems` in archive) |
| Script | `run-invoices-transform.mjs` |

## 3. GM — `webxl_verify_gm` → `drm.gm_entries`

| | |
|--|--:|
| Archive | 4,800 |
| Migrated | **4,797** |
| Rejected (unmapped user) | 3 |
| Notes | Best-effort map; amounts from `customer_dollars` / `price`; not `webxl_gmaccount` |
| Script | `run-gm-transform.mjs` |

## Staging totals (after D1 + this batch)

| Table | Approx. rows |
|-------|-------------:|
| `users` | 739 |
| `customers` | 231,920 |
| `attributes` | 201 |
| `follow_ups` | 987,851 |
| `diagnose_followups` | 105,343 |
| `invoices` | 10,381 |
| `gm_entries` | 4,797 |

## Mac verify (tunnel open)

```bash
psql "$DATABASE_URL" -c "
SELECT 'diagnose' AS module, count(*) FROM drm.diagnose_followups
UNION ALL SELECT 'invoices', count(*) FROM drm.invoices
UNION ALL SELECT 'gm', count(*) FROM drm.gm_entries;"
```

Expected: **105343 / 10381 / 4797** (verified on staging after batch).

## Mac app testing notes

- Keep `DATABASE_URL` → **`drm_legacy_stage`**, `SKIP_SCHEMA_ENSURE=true`, SSH tunnel **55432**.
- **Invoices:** line items empty in DB (`items = '[]'`) — UI lists/detail may look sparse until invitems migration.
- **GM:** mapped from verify table, not full `webxl_gmaccount` — compare amounts/approval fields carefully in QA.
- **Diagnose:** use diagnose reports / follow-up diagnose screens; unmapped users (65) won’t appear.
- Dashboard widgets that still expect **non-migrated** tables (quotations, product posting, menu_permissions, per-exec `sales_*`) may return **empty** via soft-fallback — not a sign this batch failed.

See also: [50-d1-users-customers-execution.md](./50-d1-users-customers-execution.md), [51-mac-local-staging-runbook.md](./51-mac-local-staging-runbook.md), [55-next-module-roadmap.md](./55-next-module-roadmap.md)
