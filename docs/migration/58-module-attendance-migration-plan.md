# Wave 4A — Attendance (`webxl_attendance` → `drm.attendance`)

**Database:** `drm_legacy_stage` only

## Mapping

| Legacy | Modern |
|--------|--------|
| `id` | new UUID + legacy map (`entity_type=attendance_row`) |
| `user_id` | `user_id` (UUID map) |
| `date` | `date` (day) |
| `timeIn` / `timeOut` | `check_in` / `check_out` (combined with `date`) |
| `late_absent` | `status` + `is_late` / flags |
| `branch`, `meeting` | `notes` |

**Status rules (summary):** `True` → Absent; holiday strings → Leave; times present → Present/Late from `H:M` late token.

## Script

`backend/scripts/migration/run-attendance-transform.mjs`

```bash
node scripts/migration/run-attendance-transform.mjs --dry-run
node scripts/migration/run-attendance-transform.mjs --execute-staging --batch-size=5000
```

## Staging run (2026-11-05)

| Metric | Count |
|--------|------:|
| Archive rows | 483,212 |
| Migrated (`drm.attendance`) | 482,655 |
| Rejected (`unmapped_user`) | 557 |
| Skipped (idempotent re-run) | 500 |

Dry-run: 739 user map entries; 0 null dates.
