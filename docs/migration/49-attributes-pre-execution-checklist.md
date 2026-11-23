# Phase 2F — Pre-execution checklist (10-record smoke)

**Final status:** `READY_FOR_10_RECORD_STAGING_SMOKE_TEST_APPROVAL`  
**Date prepared:** 2026-11-04  

---

## Mapping and scope

| Item | Status |
|------|--------|
| Business mapping | **`BUSINESS_MAPPING_APPROVED`** ([`46`](./46-attributes-business-approval.md)) |
| Category table locked | Yes — [`40-attributes-final-category-mapping.csv`](./40-attributes-final-category-mapping.csv) |
| Archive total 244 | Verified SQL |
| Eligible scope 201 | Verified SQL |
| Dry-run 201 valid / 0 rejected | [`43`](./43-attributes-dry-run-report.md) / [`45`](./45-attributes-dry-run-validation.csv) |
| refId 7 → Service Type | Dry-run id **107** valid |
| refId 9 × 6 included | Dry-run ids 160,161,162,246,275,288 valid |
| 197, 198 excluded | Dry-run `excluded_misfile_grade` |
| refId 3, 10 excluded | 31 + 10 dry-run exclusions |
| date_label / branch rules | Dry-run pass (refId 8 durations not in date_label) |
| Dry-run DB writes | **None** confirmed |

---

## Smoke sample

| Item | Status |
|------|--------|
| 10 legacy ids chosen | [`48-attributes-smoke-test-sample.csv`](./48-attributes-smoke-test-sample.csv) |
| Representative refIds | 0,1,2,4,7,8,9,11,12,14 |
| Excluded ids not in sample | 197, 198, refId 3/10 rows |

---

## Staging environment (pre-smoke)

| Check | Expected now | Re-check before run |
|-------|--------------|---------------------|
| `current_database()` | `drm_legacy_stage` | Required |
| `drm.attributes` count | **0** | Should be 0 or document partial |
| `attribute_row` maps | **0** | |
| `webxl_vas_comm_final` modern rows | **1858** | Must unchanged after smoke |
| `legacy_archive.webxl_attribute` | **244** | Must unchanged after smoke |

---

## Execution authorization

| Item | Status |
|------|--------|
| Phase 2F smoke **command prepared** | [`47`](./47-attributes-smoke-test-execution-plan.md) §4 |
| Phase 2F smoke **executed** | **NO** — blocked |
| User approval to run smoke | **Pending** |

---

## Post-smoke (when authorized)

- [ ] Archive still 244  
- [ ] 10 modern rows + 10 maps  
- [ ] Sample CSV field match  
- [ ] Phase 2C count 1858  
- [ ] Rollback script tested only if needed ([`47`](./47-attributes-smoke-test-execution-plan.md) §6)  

---

## Blockers

1. **Explicit approval** to execute `--execute-staging` smoke command.  
2. None technical for the 10-row sample given approved mapping.

**Stop here until Mohammad approves smoke execution.**
