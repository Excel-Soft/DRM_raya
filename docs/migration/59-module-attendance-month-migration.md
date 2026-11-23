# Attendance month aggregates

**DB:** `drm_legacy_stage` only

| Legacy | Modern |
|--------|--------|
| `webxl_attendance` | `drm.attendance` — see doc **58** (done) |
| `webxl_attendance_month` | `drm.attendance_month` |
| `webxl_attendance_month_history` | `drm.attendance_month_history` |

No archive table named `webxl_attdance` (typo).

DDL: `backend/scripts/migration/ddl/09_attendance_month_tables.sql`  
Script: `backend/scripts/migration/run-attendance-month-transform.mjs`

Duplicate `(user_id, month, year)`: processed in legacy `id` order; **last row wins** via upsert.

## Staging run (2026-11-05)

| Source | Migrated rows | Distinct modern rows | Rejected | Upsert (duplicate key) |
|--------|--------------:|---------------------:|---------:|-----------------------:|
| `webxl_attendance_month` | 17,117 | 16,999 | 60 (`unmapped_user`) | 118 |
| `webxl_attendance_month_history` | 12,130 | 12,098 | 245 (24 user, **221 `invalid_year`**) | 32 |

History rejects with `year` like `1970`, `3460`, `4105` (bad legacy data, no `last_update` to recover).

`webxl_attendance` daily rows: **482,655** already in `drm.attendance` (doc 58).
