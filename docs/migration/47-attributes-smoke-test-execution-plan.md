# Phase 2F — 10-record staging smoke test execution plan

**Prepared:** 2026-11-04  
**Mapping status:** `BUSINESS_MAPPING_APPROVED` ([`46-attributes-business-approval.md`](./46-attributes-business-approval.md))  
**Execution status:** **NOT RUN** — await explicit smoke approval  

---

## 1. Objective

Insert **10** approved attribute rows on **`drm_legacy_stage`** only, with full `migration_meta` traceability, then validate before any full **201**-row load.

---

## 2. Deterministic sample (10 legacy ids)

Fixed set for repeatability — [`48-attributes-smoke-test-sample.csv`](./48-attributes-smoke-test-sample.csv):

| legacy_id | refId | Category |
|----------:|------:|----------|
| 9 | 1 | Company Business Type |
| 12 | 4 | Company Detail |
| 33 | 2 | Service Type |
| 107 | 7 | Service Type |
| 137 | 8 | Contact Attribute |
| 160 | 9 | Whatsapp Message |
| 171 | 11 | Govt Leave |
| 181 | 12 | Account Monthly Task |
| 316 | 0 | Alibaba Packages |
| 278 | 14 | Country |

**Excluded from sample:** refId **3**, **10**; ids **197**, **198**.

### Pre-flight SELECT (read-only)

```sql
SELECT id, "refId", name, time, branch
FROM legacy_archive.webxl_attribute
WHERE id IN ('9','12','33','107','137','160','171','181','316','278')
ORDER BY id::int;
```

---

## 3. Staging database guard

| Check | Requirement |
|-------|-------------|
| Host / socket | Local PostgreSQL (`/var/run/postgresql`) |
| Database | **`drm_legacy_stage`** only — script asserts `current_database()` |
| Schemas written | `drm.attributes`, `migration_meta.*` |
| Schemas read | `legacy_archive.webxl_attribute` |
| Forbidden | Supabase, `drm_postgres`, production `.env` |

---

## 4. ETL command (do **not** run until approved)

From `/var/www/DRM_raya/backend`:

```bash
sudo -u postgres node scripts/migration/run-attributes-transform.mjs \
  --execute-staging \
  --legacy-ids=9,12,33,107,137,160,171,181,316,278 \
  --batch-size=10
```

**Script behavior (`--execute-staging`):**

- One transaction per batch (single batch of 10).
- `INSERT` into `drm.attributes` with new UUIDs.
- `migration_meta.migration_legacy_ids` (`entity_type=attribute_row`).
- `migration_meta.migration_record_state` = `TRANSFORMED_SUCCESSFULLY`.
- `migration_meta.migration_batches` + rejects on validation failure.
- Skip rows already mapped (retry-safe).
- **No** modification to `legacy_archive`.

---

## 5. Post-smoke validation (after approval)

```sql
-- Archive unchanged
SELECT count(*) FROM legacy_archive.webxl_attribute;  -- expect 244

-- Modern inserts
SELECT count(*) FROM drm.attributes;  -- expect 10 (if staging was empty)

-- Maps
SELECT count(*) FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'attribute_row';  -- expect 10

-- Spot check id 107
SELECT a.category, a.name, m.legacy_id
FROM drm.attributes a
JOIN migration_meta.migration_legacy_ids m ON m.modern_id = a.id::text
WHERE m.legacy_id = '107';
-- expect Service Type / Agriculture

-- Phase 2C regression
SELECT count(*) FROM drm.webxl_vas_comm_final;  -- expect 1858
```

Compare rows to [`48-attributes-smoke-test-sample.csv`](./48-attributes-smoke-test-sample.csv).

---

## 6. Rollback procedure (staging only)

If smoke must be undone **before** proceeding to full load:

```sql
BEGIN;
DELETE FROM drm.attributes a
USING migration_meta.migration_legacy_ids m
WHERE m.entity_type = 'attribute_row'
  AND m.modern_table = 'attributes'
  AND m.modern_id = a.id::text
  AND m.legacy_id IN ('9','12','33','107','137','160','171','181','316','278');

DELETE FROM migration_meta.migration_record_state
WHERE source_table = 'webxl_attribute'
  AND legacy_pk IN ('9','12','33','107','137','160','171','181','316','278');

DELETE FROM migration_meta.migration_legacy_ids
WHERE entity_type = 'attribute_row'
  AND legacy_id IN ('9','12','33','107','137','160','171','181','316','278');

-- Optional: mark batch failed in migration_batches by batch_id from script output
COMMIT;
```

Do **not** delete or truncate `legacy_archive`.

---

## 7. Safety boundaries

| Rule | |
|------|--|
| Production / Supabase | No |
| Phase 2C pilot table | No changes |
| Archive immutability | Read-only on `legacy_archive` |
| refId 3 / 10 / 197 / 198 | Not in smoke set |

---

## 8. Unresolved blockers

| Blocker | Notes |
|---------|--------|
| **Smoke execution approval** | Required from Mohammad — Phase 2F stops here |
| Full **201** load | After successful smoke + validation |
| Services / branches modules | 41 rows still out of scope |
| Follow-up `service_id=5` orphan | Unchanged (doc 34) |

**Request explicit approval to run §4 command.**
