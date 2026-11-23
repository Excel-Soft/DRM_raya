# Phase 2D — Attributes scope reconciliation

**Database:** `drm_legacy_stage` (read-only)  
**Table:** `legacy_archive.webxl_attribute`  
**Date:** 2026-11-04  

## Status

**READY_FOR_BUSINESS_APPROVAL** — scope arithmetic and exclusions are reconciled; **no ETL** until the draft `refId` → `category` map and open bucket decisions (refId **7**, **9**) are explicitly approved.

Execution remains **blocked** until that approval (mapping is not VERIFIED from legacy source code).

---

## Issue 1 — Row count reconciliation

### Authoritative total

```sql
SELECT count(*)::int AS total_source
FROM legacy_archive.webxl_attribute;
-- Result: 244
```

Matches [`source-row-counts.json`](./source-row-counts.json) and [`19-archive-row-count-reconciliation.csv`](./19-archive-row-count-reconciliation.csv).

### Exclusion filters (exact SQL)

| # | Filter | SQL predicate | Rows |
|---|--------|---------------|-----:|
| E1 | refId **3** → services catalog (not `drm.attributes`) | `"refId" = '3'` | **31** |
| E2 | refId **10** → branches (not `drm.attributes`) | `"refId" = '10'` | **10** |
| E3 | refId **7** → manual review (hold until category approved) | `"refId" = '7'` | **1** |
| E4 | refId **8** misfiles (grades, not contact methods) | `id IN ('197','198')` | **2** |

```sql
-- E1
SELECT count(*) FROM legacy_archive.webxl_attribute WHERE "refId" = '3';        -- 31
-- E2
SELECT count(*) FROM legacy_archive.webxl_attribute WHERE "refId" = '10';       -- 10
-- E3
SELECT count(*) FROM legacy_archive.webxl_attribute WHERE "refId" = '7';        -- 1
-- E4
SELECT count(*) FROM legacy_archive.webxl_attribute WHERE id IN ('197','198');  -- 2
```

### Final eligible set (attributes module, strict)

Rows that **may** load into `drm.attributes` after category map approval — **excluding wrong-target buckets, manual hold, and misfiles only**:

```sql
SELECT count(*)::int AS eligible_attributes_strict
FROM legacy_archive.webxl_attribute a
WHERE a."refId" NOT IN ('3', '10', '7')
  AND a.id NOT IN ('197', '198');
-- Result: 200
```

**Accounting:** 244 − 31 − 10 − 1 − 2 = **200**.

### Optional hold: refId **9** (business review)

refId **9** is not excluded by routing (still uses `GET /api/attributes/:category`), but content is mixed (see Issue 3). If held until reviewed:

```sql
SELECT count(*)::int AS eligible_if_refid9_held
FROM legacy_archive.webxl_attribute a
WHERE a."refId" NOT IN ('3', '10', '7', '9')
  AND a.id NOT IN ('197', '198');
-- Result: 194
```

### Disposition by refId (every bucket reviewed)

| refId | Rows | Disposition | `drm.attributes` ETL? |
|------:|-----:|-------------|------------------------|
| 0 | 5 | Eligible — **Alibaba Packages** (draft category) | Yes, pending map |
| 1 | 11 | Eligible — **Company Business Type** | Yes, pending map |
| 2 | 12 | Eligible — **Service Type** | Yes, pending map |
| 3 | 31 | **Excluded** — **services** / subservices module | **No** |
| 4 | 21 | Eligible — **Company Detail** | Yes, pending map |
| 5 | 23 | Eligible — **Source** | Yes, pending map |
| 6 | 9 | Eligible — **Job Designation** | Yes, pending map |
| 7 | 1 | **Hold** — single row `Agriculture` (duplicate name in refId 2) | **No** until decision |
| 8 | 32 | Eligible **30** — **Contact Attribute**; **2** misfiles E4 | 30 yes; 2 reject/hold |
| 9 | 6 | **Review** — mixed labels (see Issue 3) | 6 yes *or* hold → 194 scope |
| 10 | 10 | **Excluded** — **drm.branches** | **No** |
| 11 | 18 | Eligible — **Govt Leave** + `time`→`date_label` | Yes, pending map |
| 12 | 23 | Eligible — **Account Monthly Task** + `time`/`branch` | Yes, pending map |
| 13 | 38 | Eligible — **Portfolio Categories** | Yes, pending map |
| 14 | 4 | Eligible — **Country** | Yes, pending map |

**Sum excluded / held from attributes path:** 31 + 10 + 1 + 2 = **44**.  
**Sum strict eligible:** **200**.

### Why **~178** was wrong

Earlier docs used **~178** for “A-partial”. That number is **not** supported by any documented filter on staging.

| Calculation | Result | Notes |
|-------------|-------:|-------|
| 244 − 31 − 10 | **203** | Excludes only refId 3 and 10 (old informal partial) |
| 244 − 31 − 10 − 1 − 2 | **200** | **Correct strict eligible** |
| ~178 | **178** | **Error** — likely an undocumented subtraction (~**25** rows), e.g. mistakenly treating part of refId **8** or **9** as out of scope without listing each bucket |

**Do not use 178** in plans or reconciliation; use **200** (or **194** if refId **9** is held).

### Unclassified rows

**0** archive rows fall outside refId 0–14. Every row is classified above; none are silently dropped.

---

## Issue 2 — Column mapping evidence

Sources: [`drm-schema-mapping.automated-backup.csv`](./drm-schema-mapping.automated-backup.csv) (no `(1)` variant in repo), [`drm-schema-mapping.csv`](./drm-schema-mapping.csv), `backend/src/shared/schema.ts`, staging `information_schema` for `drm.attributes`.

| Target column | Resolution | Status |
|---------------|------------|--------|
| `id` | New UUID (`gen_random_uuid()`); legacy int in `migration_meta.migration_legacy_ids` with `entity_type='attribute_row'` | **TYPE_CONVERSION_REQUIRED** — not VERIFIED as 1:1 id preservation |
| `category` | From approved `refId` lookup only | **NEEDS_MANUAL_REVIEW** — draft strings match modern UI list in [`attributes.tsx`](../../frontend/src/pages/drm/attributes.tsx), not legacy code |
| `name` | `trim(name)`; reject if empty | **VERIFIED** — 244/244 non-empty in archive |
| `date_label` | Copy `time` **only** when `"refId" IN ('11','12')`; store as text; do not parse as timestamptz | **TRANSFORMATION_REQUIRED** — rule approved in plan, not legacy-verified |
| `branch` | Copy trimmed `branch` **only** when `"refId" = '12'`; else NULL | **TRANSFORMATION_REQUIRED** — evidence: all 23 non-empty `branch` values are refId 12 |
| `time` (refId **8**) | **No modern column** — duration metadata; preserve in archive only | **UNMAPPED** (do not map to `date_label` or `amount`) |
| `parent_id` | NULL | **UNMAPPED** — approved default |
| `amount` | NULL | **UNMAPPED** — no legacy column |
| `email`, `phone` | NULL | **UNMAPPED** — no legacy column |
| `created_at`, `updated_at` | Set at migration insert time | **MIGRATION_TIMESTAMP** — see Issue 5 |

---

## Issue 3 — Special refId buckets

### refId **3** (31 rows) — services destination

- Modern UI: **Service for Quotation** → `ServiceCatalogTree` / `drm.services` hierarchy ([`attributes.tsx`](../../frontend/src/pages/drm/attributes.tsx)), not `GET /api/attributes/...`.
- **Do not** insert into `drm.attributes`.
- Future `entity_type`: **`service_catalog_row`** (or `service_row`) on `drm.services` / child tables — **not** `attribute_row`.
- Downstream: only **88** of 249,060 `webxl_follow_up_services` rows reference refId **3** ids (17, 23, 28); majority of `service_id` references are **refId 0** (see Issue 4).

### refId **7** (1 row)

- `id=7`, `name=Agriculture` — duplicates a category name under refId **2** (`Agriculture & Food`).
- **Hold** until business assigns category (merge into Service Type vs reject duplicate).

### refId **8** (32 rows)

- **Contact Attribute** / follow-up methods; `time` = duration minutes (numeric strings), except empty on one row.
- **197**, **198** (`B+`, `A-`) — misfiled grades ([`service-appointment-modal.tsx`](../../frontend/src/components/service-appointment-modal.tsx)); **exclude** from migrate (E4) or `PENDING_BUSINESS_REVIEW`.
- **`time` must not** map to `date_label`.

### refId **9** (6 rows)

| id | name | Notes |
|----|------|-------|
| 160 | Seminar | Overlaps refId **5** Source |
| 161 | Webinar | Overlaps refId **5** Source |
| 162 | Social Media | |
| 246 | Hum Mashal-e-Rah(lahore | Person/location label |
| 275 | Tanveer Gujranwala | Person/location label |
| 288 | Afzal Sambrial | Person/location label |

Draft category **Whatsapp Message** (modern UI). **Not reclassified** — business confirms whether all six belong in that category.

### refId **10** (10 rows)

- Office names (Faisalabad, Lahore, Sialkot, …) → **`drm.branches`**, not attributes.

### refId **11** (18 rows)

- Holiday names; `time` holds date-like strings (`2026-5-1`, …) → proposed **`date_label`** (text, not historical `created_at`).

### refId **12** (23 rows)

- Bill/rent task names; **`time`** → **`date_label`**; **`branch`** → **`branch`** (Sialkot, Lahore, Karachi, …).

---

## Issue 4 — Downstream `service_id` semantics

### `webxl_follow_up_services.service_id`

```sql
SELECT f.service_id, count(*)::int AS cnt, a."refId", min(a.name) AS sample_name
FROM legacy_archive.webxl_follow_up_services f
LEFT JOIN legacy_archive.webxl_attribute a ON a.id = f.service_id
WHERE f.service_id IS NOT NULL AND f.service_id <> ''
GROUP BY f.service_id, a."refId"
ORDER BY cnt DESC;
```

| Legacy `service_id` | Follow-up rows | refId | Interpretation |
|--------------------:|---------------:|------:|----------------|
| 316 | 203,746 | **0** | Alibaba Packages → **`attribute_row`** → `attributes` |
| 319 | 20,630 | **0** | same |
| 332 | 11,599 | **0** | same |
| 317 | 6,519 | **0** | same |
| 318 | 6,477 | **0** | same |
| 17 | 74 | **3** | Quotation service → **`service_catalog_row`**, not `attribute_row` |
| 23 | 11 | **3** | same |
| 28 | 3 | **3** | same |
| **5** | **1** | **NULL** | **Orphan** — no `webxl_attribute.id = 5` (see below) |

**Orphan reconciliation item (explicit):**

```sql
SELECT count(*) FROM legacy_archive.webxl_follow_up_services f
WHERE f.service_id = '5'
  AND NOT EXISTS (SELECT 1 FROM legacy_archive.webxl_attribute a WHERE a.id = f.service_id);
-- 1 row
```

Legacy id **5** is missing from the archive attribute table (closest: id **13** = `FaceBook`, refId **5** Source). Future transform: **`migration_rejects`** or **`PENDING_BUSINESS_REVIEW`** on that follow-up line — **do not** invent an attribute.

### refId **3** mapping strategy (future)

| Item | Rule |
|------|------|
| Modern destination | `drm.services` (+ subservices as per catalog design) |
| `entity_type` | **`service_catalog_row`** (name TBD in ETL — must **not** be `attribute_row`) |
| `migration_legacy_ids.modern_table` | `services` (and/or child tables) |
| refId **3** rows (31) | Map when **service catalog migration** is approved |
| Follow-up rows pointing at refId **3** ids | Resolve via **service** map, not attribute map |

### `webxl_quotation_tracker.service_id` (informational)

- **1,564** rows; **57** distinct `service_id`; **863** rows orphan vs `webxl_attribute` (many ids not in attribute table — expected if tracker used a wider id universe).
- refId **3** example: id **28** → Digital Marketing (82 rows).
- **Not in scope** for attributes ETL; document for future quotation module.

---

## Issue 5 — Timestamp policy

Legacy `webxl_attribute` has **no** `created_at` / `updated_at`.

On migration insert:

- `created_at` and `updated_at` = **migration transaction timestamp** (or batch start time).
- These are **not** historical source timestamps and **must not** be documented as preserved legacy dates.
- API ordering (`ORDER BY created_at ASC`) will reflect **migration order** (optionally align insert order with `_archive_row_id` within a batch), not legacy entry order.

---

## Summary table

| Metric | Count |
|--------|------:|
| Total source | 244 |
| Excluded refId 3 | 31 |
| Excluded refId 10 | 10 |
| Held refId 7 | 1 |
| Excluded misfiles 197, 198 | 2 |
| **Strict eligible → `drm.attributes`** | **200** |
| Eligible if refId 9 held | 194 |
| Routed to other modules (3 + 10) | 41 |
| Follow-up orphan `service_id=5` | 1 (reconciliation) |

**Approval required** before any transform. **No database writes** in this reconciliation phase.
