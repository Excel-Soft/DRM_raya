# Wave 4B — Leads (`webxl_leads` → `drm.opportunities`)

**Database:** `drm_legacy_stage` only

## Mapping

| Legacy | Modern |
|--------|--------|
| `id` | `id` (new UUID/varchar) + `migration_legacy_ids` (`entity_type=lead`) |
| `com_id` | `customer_id` via `webxl_company` legacy map (numeric); else `customers.drm_id` match |
| `user_id` | `owner_id` via user map |
| `transfer_note` / `transfer` | `title` (short label) |
| — | `stage` = `LD` (default pipeline) |
| `create_date` | `created_at`, `updated_at` |

## Script

`backend/scripts/migration/run-leads-transform.mjs`

```bash
sudo -u postgres bash -c 'cd /var/www/DRM_raya/backend && node scripts/migration/run-leads-transform.mjs --dry-run'
sudo -u postgres bash -c 'cd /var/www/DRM_raya/backend && node scripts/migration/run-leads-transform.mjs --execute-staging --batch-size=5000'
```

## Execution log

| | |
|--|--:|
| Archive | 160,798 |
| Migrated → `drm.opportunities` | **158,565** |
| Rejected | 2,233 (unmapped customer/user) |
| Default `stage` | `LD` |
