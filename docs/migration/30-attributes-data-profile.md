# Phase 2D — `webxl_attribute` data profile

**Database:** `drm_legacy_stage` (read-only)  
**Reconciliation:** [`34-attributes-scope-reconciliation.md`](./34-attributes-scope-reconciliation.md)

## Volume

| Metric | Value |
|--------|------:|
| Archive rows | **244** |
| Strict eligible → `drm.attributes` | **200** |
| Excluded wrong-target (refId 3+10) | **41** |
| Held / rejected (refId 7 + ids 197,198) | **3** |
| Optional hold refId 9 | **6** → **194** eligible |

## Source DDL (MySQL)

| Column | Type |
|--------|------|
| `id` | int(11) NOT NULL |
| `refId` | int(11) NOT NULL |
| `name` | varchar(255) |
| `time` | varchar(100) |
| `branch` | varchar(100) |

No `created_at`, `updated_at`, `parent`, `amount`, `email`, `phone`.

## Target: `drm.attributes` (staging)

- **0** rows; PK `uuid`; FK `parent_id` → self.
- Matches `schema.ts`.

## Primary key / nulls

| Check | Result |
|-------|--------|
| Distinct `_legacy_pk` | 244 |
| Duplicate `id` | 0 |
| Empty `name` | 0 |
| Empty `refId` | 0 |
| Legacy `id` range | 9 – 335 |

## refId distribution

| refId | Rows | Destination (summary) |
|------:|-----:|------------------------|
| 0 | 5 | `attributes` — Alibaba Packages |
| 1 | 11 | `attributes` — Company Business Type |
| 2 | 12 | `attributes` — Service Type |
| 3 | 31 | **`services` catalog** — excluded |
| 4 | 21 | `attributes` — Company Detail |
| 5 | 23 | `attributes` — Source |
| 6 | 9 | `attributes` — Job Designation |
| 7 | 1 | **Hold** — Agriculture |
| 8 | 32 | `attributes` — Contact Attribute (30 + 2 misfiles) |
| 9 | 6 | `attributes` — Whatsapp Message (review) |
| 10 | 10 | **`drm.branches`** — excluded |
| 11 | 18 | `attributes` — Govt Leave |
| 12 | 23 | `attributes` — Account Monthly Task |
| 13 | 38 | `attributes` — Portfolio Categories |
| 14 | 4 | `attributes` — Country |

## Column usage

| Column | Non-empty | Pattern |
|--------|----------:|---------|
| `time` | 72 | refId **8**: durations; **11/12**: date-like strings |
| `branch` | 23 | **All refId 12** |

## refId **9** detail (mixed — not reclassified)

| id | name |
|----|------|
| 160 | Seminar |
| 161 | Webinar |
| 162 | Social Media |
| 246 | Hum Mashal-e-Rah(lahore |
| 275 | Tanveer Gujranwala |
| 288 | Afzal Sambrial |

Seminar/Webinar also appear under refId **5** (Source). Person/location strings need business confirmation under **Whatsapp Message**.

## refId **8** misfiles

| id | name | time |
|----|------|------|
| 197 | B+ | 1 |
| 198 | A- | 1 |

Excluded from eligible set (grades, not methods).

## Downstream references

### `webxl_follow_up_services.service_id`

| Pattern | Follow-up rows | Future entity_type |
|---------|---------------:|--------------------|
| refId **0** ids (316, 319, …) | ~249k | **`attribute_row`** |
| refId **3** ids (17, 23, 28) | 88 | **`service_catalog_row`** — not `attribute_row` |
| **`service_id = 5`** | **1** | **Orphan** — no attribute id 5 |

### `webxl_quotation_tracker.service_id`

- 1,564 rows; 57 distinct ids; **863** orphans vs `webxl_attribute`.
- refId **3** example: id 28 (82 rows).
- Out of scope for attributes module.

## Timestamps

Legacy table provides **no** row timestamps. Any future `created_at`/`updated_at` on insert are **migration timestamps** only (doc 34 §5).

## Staging safety

- `drm.attributes`: 0 rows (unchanged).
- Phase 2C pilot mappings: unchanged.
- Profiling: SELECT only.
