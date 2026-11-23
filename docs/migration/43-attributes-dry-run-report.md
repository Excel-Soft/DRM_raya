# Phase 2E — Attributes dry-run report (read-only)

**Final status:** `DRY_RUN_COMPLETE_AWAITING_CATEGORY_CONFIRMATION`  
**Database:** `drm_legacy_stage`  
**Script:** `backend/scripts/migration/run-attributes-transform.mjs --dry-run`  
**Executed:** 2026-11-04  

---

## Database write confirmation

| Check | Result |
|-------|--------|
| INSERT/UPDATE/DELETE on `drm.attributes` | **None** |
| Writes to `migration_meta.*` | **None** |
| DDL / sequences | **None** |
| Transaction mode | `BEGIN READ ONLY` + `ROLLBACK` |
| Archive row count before | **244** |
| Archive row count after | **244** |

---

## Scope verification (SQL + dry-run)

| Metric | Expected | Actual |
|--------|----------|--------|
| Total source | 244 | **244** |
| refId 3 excluded | 31 | **31** |
| refId 10 excluded | 10 | **10** |
| Misfiles 197, 198 | 2 | **2** |
| refId 7 (Service Type) | 1 included | **1** valid |
| refId 9 (Whatsapp Message) | 6 included | **6** valid |
| **Eligible (valid transforms)** | **201** | **201** |
| Rejected | 0 | **0** |
| Excluded (routing/misfile) | 43 | **43** |
| Accounting (valid+rejected+excluded) | 244 | **244** ✓ |

Per-row scope export: [`41-attributes-final-scope-reconciliation.csv`](./41-attributes-final-scope-reconciliation.csv)

---

## Transform results

| Outcome | Count |
|---------|------:|
| Valid transformed (in-memory) | **201** |
| Rejected | **0** |
| Excluded | **43** |

### Exclusion reasons

| reason | count |
|--------|------:|
| excluded_refid_services | 31 |
| excluded_refid_branches | 10 |
| excluded_misfile_grade | 2 |

### Proposed category distribution (201 valid rows)

| category | rows |
|----------|-----:|
| Portfolio Categories | 38 |
| Account Monthly Task | 23 |
| Source | 23 |
| Company Detail | 21 |
| Govt Leave | 18 |
| Service Type | **13** (12 refId 2 + **1** refId 7) |
| Contact Attribute | **30** (32 − 2 misfiles) |
| Company Business Type | 11 |
| Job Designation | 9 |
| Whatsapp Message | **6** |
| Alibaba Packages | 5 |
| Country | 4 |

---

## Validation checks (dry-run)

| Check | Result |
|-------|--------|
| UUID generation (in-memory) | **201/201** valid v4 format |
| NOT NULL `category`, `name` | **Pass** |
| refId **7** category | **`Service Type`** |
| refId **9** names unchanged | **Pass** (6 rows) |
| refId **8** `time` → `date_label` | **Pass** — 29 rows with duration in archive; all `date_label` null |
| refId **11/12** `date_label` from `time` | Applied where `time` non-empty |
| refId **12** `branch` | Copied when present (23 archive rows with branch) |
| Null defaults (`parent_id`, `amount`, email, phone) | **NULL** on all valid rows |

---

## Artifacts

| File | Description |
|------|-------------|
| [`40-attributes-final-category-mapping.csv`](./40-attributes-final-category-mapping.csv) | refId → category + disposition |
| [`44-attributes-dry-run-samples.csv`](./44-attributes-dry-run-samples.csv) | First 15 valid transformed samples |
| [`45-attributes-dry-run-validation.csv`](./45-attributes-dry-run-validation.csv) | All 244 rows: valid / excluded / rejected |

---

## Next step

1. User confirms complete category mapping in [`42-attributes-category-confirmation.md`](./42-attributes-category-confirmation.md).
2. Only then authorize **Phase 2F** staging DML (`drm.attributes` + `migration_meta`).

**No staging load was performed in Phase 2E.**
