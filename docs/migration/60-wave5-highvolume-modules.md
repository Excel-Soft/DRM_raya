# Wave 5 — nine high-volume modules

**DB:** `drm_legacy_stage` only  
**DDL:** `ddl/10_wave5_highvolume_tables.sql`  
**Script:** `run-wave5-highvolume-transform.mjs --module=<name>`

| Order | Module | Legacy | Modern target |
|------:|--------|--------|---------------|
| 1 | `task_links` | `webxl_task_links` | `drm.link_reports` (+ `legacy_metadata`) |
| 2 | `follow_up_services` | `webxl_follow_up_services` | `drm.follow_up_service_lines` |
| 3 | `com_history` | `webxl_com_history` | `drm.communication_logs` |
| 4 | `com_detail` | `webxl_com_detail` | `drm.customer_contacts` |
| 5 | `last_followup` | `webxl_last_followup` | `drm.customers` (last_followup_date / comment) |
| 6 | `raw_attendence` | `webxl_raw_attendence` | `drm.attendance_raw_punches` |
| 7 | `posting_data` | `webxl_posting_data` | `drm.product_posting_data` |
| 8 | `task_assign` | `webxl_task_assign` | `drm.legacy_task_assignments` |
| 9 | `task_log_history` | `webxl_task_log_history` | `drm.task_log_history` |

Batch runner: `run-wave5-all-sequential.sh` (logs to `/tmp/wave5-migrate.log`).

## Progress (VPS)

```bash
cd /var/www/DRM_raya/backend/scripts/migration
chmod +x wave5-migration-progress.sh
./wave5-migration-progress.sh          # snapshot
./wave5-migration-progress.sh --watch  # refresh every 30s
tail -f /tmp/wave5-migrate.log         # raw log (+ [progress] every ~2 min while running)
```

**Note:** `webxl_raw_attendence` uses machine `uid`/`user_id` — most rows may reject until `users.attendance_id` is populated on staging.
