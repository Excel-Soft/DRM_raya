# Module D5a — `webxl_followup` → `drm.follow_ups`

**Database:** `drm_legacy_stage` only  
**Depends on:** D1 users + customers (`migration_legacy_ids`)

## Scope

| Source | Target | Archive rows (approx.) |
|--------|--------|-------------------------|
| `legacy_archive.webxl_followup` | `drm.follow_ups` | 988,465 |

**Out of scope this batch:** `webxl_follow_up_services` (D5 decision), `webxl_followup_service` → `diagnose_followups` (separate module).

## Column mapping

| Legacy | Modern | Rule |
|--------|--------|------|
| `id` | `id` | New UUID; legacy in `migration_legacy_ids` (`entity_type=followup`) |
| `com_id` | `customer_id` | Customer map (`webxl_company.id`) — **required** |
| `uid` | `assigned_to`, `created_by` | User map; null if unmapped |
| `nc` / `create_date` | `due_at` | `coalesce(nc, create_date)`; fallback `create_date` or reject if none |
| `create_date` | `date_time`, `created_at` | Parsed timestamp |
| `cm` | `method` | Contact method (Mobile, E-mail, …) |
| `ncm` / `purpose_call` | `reservation_type` | First non-empty |
| `note` / `answer` | `notes` | Concat or prefer `note` |
| `tk_mint` | `talk_time_seconds` | Treat as **minutes** → × 60 |
| — | `status` | Default `Open` |

## Rejects

- Missing `com_id` or customer not in map
- Missing usable `due_at` (no `nc` and no `create_date`)

## Script

`backend/scripts/migration/run-followups-transform.mjs`

```bash
sudo -u postgres bash -c 'cd /var/www/DRM_raya/backend && node scripts/migration/run-followups-transform.mjs --dry-run'
sudo -u postgres bash -c 'cd /var/www/DRM_raya/backend && node scripts/migration/run-followups-transform.mjs --execute-staging --batch-size=3000'
```

Optional pilot: `--limit=5000`

## Execution log (drm_legacy_stage)

| Metric | Value |
|--------|------:|
| Archive rows | 988,465 |
| Migrated → `drm.follow_ups` | **987,851** |
| Rejected (`unmapped_customer`) | 614 |
| Fix applied | Cap `tk_mint` → `talk_time_seconds` (overflow int) |
| Legacy maps (`entity_type=followup`) | 987,851 |

Archive row count unchanged (immutable).
