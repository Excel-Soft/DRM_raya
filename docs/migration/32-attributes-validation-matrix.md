# Phase 2D — Attributes validation matrix

**Scope reconciliation:** [`34-attributes-scope-reconciliation.md`](./34-attributes-scope-reconciliation.md)  
**Eligible rows (strict):** **200**

## Pre-flight (read-only — current)

| # | Check | Expected | Result |
|---|-------|----------|--------|
| P1 | Total archive rows | 244 | Pass |
| P2 | Strict eligible SQL count | 200 | Pass |
| P3 | Excluded refId 3 | 31 | Pass |
| P4 | Excluded refId 10 | 10 | Pass |
| P5 | Held refId 7 | 1 | Pass |
| P6 | Excluded ids 197,198 | 2 | Pass |
| P7 | `drm.attributes` empty | 0 | Pass |
| P8 | Phase 2C pilot | 1,858 vas rows | Pass |
| P9 | Mapping VERIFIED | Only `name` | Pass (honest) |
| P10 | Execution authorized | No | **Blocked — approval required** |

## 1. Source vs migrated counts (post-execution)

| Check | Criterion |
|-------|-----------|
| Archive unchanged | `count(*) = 244` always |
| In scope | `migrated + rejected = 200` (or 194 if refId 9 held) |
| Modern rows | `count(*) FROM drm.attributes = migrated` |
| Not in attributes ETL | 41 rows (refId 3+10) + 3 held/reject tracked as **ARCHIVED_ONLY** or separate module queues |

## 2. Legacy → modern ID map

| Check | Criterion |
|-------|-----------|
| entity_type | `attribute_row` only for rows in attributes scope |
| refId 3 ids | **Must not** appear as `attribute_row` |
| Completeness | One map row per migrated legacy id |
| UUID validity | All modern ids valid uuid |

## 3. Duplicates

| Scenario | Expected |
|----------|----------|
| Re-run ETL | Idempotent skip via map |
| Same name, different category | Allowed (PG has no unique on name) |
| Misfiles 197,198 | Rejected or held — not migrated |

## 4. Null / defaults

| Column | Rule |
|--------|------|
| category, name | NOT NULL |
| date_label | Set only refId 11/12 from `time` |
| branch | Set only refId 12 |
| refId 8 time | Not in modern row |
| parent_id, amount, email, phone | NULL |

## 5. Foreign keys

| FK | Expect |
|----|--------|
| parent_id | All NULL initially |

## 6. Value spot checks

- Stratified samples per **included** refId (0,1,2,4,5,6,8,9,11,12,13,14).
- refId **12**: `branch` + `date_label` match archive.
- refId **8**: confirm `date_label` NULL despite non-empty `time`.

## 7. Archive immutability

Before/after: `SELECT count(*) FROM legacy_archive.webxl_attribute` = 244.

## 8. Retry safety

Second run: 0 inserts if all mapped.

## 9. Batch rollback

Failed batch: no orphan modern rows without map entries.

## 10. Timestamps (Issue 5)

| Check | Criterion |
|-------|-----------|
| created_at / updated_at | Equal to migration time ± batch ordering |
| Documentation | Report must **not** claim legacy historical timestamps |

## 11. Downstream (future, D5)

| Check | Criterion |
|-------|-----------|
| refId 0 service_id | Resolves via `attribute_row` |
| refId 3 service_id | Resolves via **service** map, not attribute |
| service_id=5 | **1** follow-up row — orphan reconciliation |

## 12. Phase 2C regression

`webxl_vas_comm_final`: 1,858 modern + map rows unchanged.

---

**Phase 2D outcome:** **READY_FOR_BUSINESS_APPROVAL** — matrix defined; execution blocked until mapping and scope approved.
