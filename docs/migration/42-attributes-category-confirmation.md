# Phase 2E/2F — Attributes category mapping confirmation

## Status

**`BUSINESS_MAPPING_APPROVED`** — **2026-11-04** (Mohammad — explicit approval of complete table below)

| Phase | Status |
|-------|--------|
| Phase 2E dry-run | `DRY_RUN_COMPLETE` — [`43-attributes-dry-run-report.md`](./43-attributes-dry-run-report.md) |
| Phase 2F staging smoke | **`READY_FOR_10_RECORD_STAGING_SMOKE_TEST_APPROVAL`** — execution **not** authorized |
| Full 201-row ETL | Not authorized |

Record: [`46-attributes-business-approval.md`](./46-attributes-business-approval.md)

---

## A. User-confirmed business decisions (2026-11-04)

| # | Decision | Status |
|---|----------|--------|
| 1 | **refId 9:** All **6** records → **`Whatsapp Message`**; names unchanged | **Approved** |
| 2 | **refId 7:** **`Agriculture`** (id **107**) → **`Service Type`** (same string as refId **2**); separate row | **Approved** |
| 3 | **refId 3:** **31** rows → **EXCLUDED_SERVICES** (future services catalog) | **Approved** |
| 4 | **refId 10:** **10** rows → **EXCLUDED_BRANCHES** (future branches) | **Approved** |
| 5 | **Legacy ids 197, 198:** Misfiled grades — excluded | **Approved** |

**Attributes ETL scope:** **201** rows (244 − 31 − 10 − 2).

---

## B. Approved category labels

| refId | Category | Attributes ETL |
|------:|----------|----------------|
| 0 | Alibaba Packages | Yes |
| 1 | Company Business Type | Yes |
| 2 | Service Type | Yes |
| 3 | EXCLUDED_SERVICES | **No** |
| 4 | Company Detail | Yes |
| 5 | Source | Yes |
| 6 | Job Designation | Yes |
| 7 | Service Type | Yes |
| 8 | Contact Attribute | Yes (except ids 197, 198) |
| 9 | Whatsapp Message | Yes |
| 10 | EXCLUDED_BRANCHES | **No** |
| 11 | Govt Leave | Yes |
| 12 | Account Monthly Task | Yes |
| 13 | Portfolio Categories | Yes |
| 14 | Country | Yes |

Machine-readable: [`40-attributes-final-category-mapping.csv`](./40-attributes-final-category-mapping.csv)

---

## C. Technical transformation rules (approved for staging ETL)

| Rule | Detail |
|------|--------|
| `id` | New UUID; `migration_legacy_ids` (`entity_type=attribute_row`) on execute |
| `category` | From §B |
| `name` | Trim; non-empty |
| `date_label` | From `time` only refId **11**, **12** |
| `branch` | From `branch` only refId **12** |
| refId **8** `time` | Archive-only (no `date_label`) |
| `parent_id`, `amount`, `email`, `phone` | NULL |
| `created_at` / `updated_at` | **Migration timestamps** — not historical |

---

## D. Open items (non-mapping)

| Item | Status |
|------|--------|
| 10-record smoke execution | Awaiting approval — [`47-attributes-smoke-test-execution-plan.md`](./47-attributes-smoke-test-execution-plan.md) |
| Follow-up `service_id=5` orphan | Reconciliation backlog (doc 34) |
| Services / branches modules | 41 rows deferred |

---

## E. Confirmation checklist

- [x] Category strings for refId 0–14 (excluding 3/10 as routing labels) — **approved 2026-11-04**
- [x] EXCLUDED_SERVICES / EXCLUDED_BRANCHES routing — **approved**
- [ ] **Staging smoke execution** — **pending separate approval**
- [ ] Full **201**-row load — **not requested**
