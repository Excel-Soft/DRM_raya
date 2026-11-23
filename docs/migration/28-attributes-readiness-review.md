# Phase 2D–2F — Attributes module readiness review

**Database:** `drm_legacy_stage`  
**Path:** `legacy_archive.webxl_attribute` → `drm.attributes` (201-row approved scope)

## Current status

| Flag | Value |
|------|--------|
| Mapping | **`BUSINESS_MAPPING_APPROVED`** (2026-11-04) — [`46-attributes-business-approval.md`](./46-attributes-business-approval.md) |
| Dry-run | Complete — **201** valid ([`43`](./43-attributes-dry-run-report.md)) |
| Staging smoke | **`READY_FOR_10_RECORD_STAGING_SMOKE_TEST_APPROVAL`** — **not executed** |
| Full ETL | **Not authorized** |

## Executive summary

| Question | Answer |
|----------|--------|
| Approved attributes scope? | **201** rows |
| Archive total? | **244** |
| Excluded? | 31 services + 10 branches + 2 misfiles |
| May run 10-record smoke? | **No** — explicit execution approval required ([`47`](./47-attributes-smoke-test-execution-plan.md)) |
| May run full 201 load? | **No** |

Historical note: early **~200** count held refId **7**; approved scope **201** includes refId **7** and **9**.

## Artifacts

| Doc | Purpose |
|-----|---------|
| [`34-attributes-scope-reconciliation.md`](./34-attributes-scope-reconciliation.md) | Scope math |
| [`40-attributes-final-category-mapping.csv`](./40-attributes-final-category-mapping.csv) | Approved refId map |
| [`42-attributes-category-confirmation.md`](./42-attributes-category-confirmation.md) | Approval record |
| [`46-attributes-business-approval.md`](./46-attributes-business-approval.md) | Business sign-off |
| [`47-attributes-smoke-test-execution-plan.md`](./47-attributes-smoke-test-execution-plan.md) | Smoke command + rollback |
| [`48-attributes-smoke-test-sample.csv`](./48-attributes-smoke-test-sample.csv) | 10 legacy ids |
| [`49-attributes-pre-execution-checklist.md`](./49-attributes-pre-execution-checklist.md) | Pre-flight |

## Safety (unchanged)

- Staging only; archive immutable on read path for ETL.
- Phase 2C pilot untouched until smoke runs (still **1858** vas rows).
- No production / Supabase / `.env` / PM2 / Nginx.

**Stop — await smoke execution approval.**
