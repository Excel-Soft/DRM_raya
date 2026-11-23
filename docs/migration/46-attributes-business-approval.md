# Phase 2F — Business mapping approval record

## Status

**`BUSINESS_MAPPING_APPROVED`**

| Field | Value |
|-------|--------|
| Approved by | Mohammad (explicit confirmation) |
| Approval date | **2026-11-04** |
| Document superseded | [`42-attributes-category-confirmation.md`](./42-attributes-category-confirmation.md) §B (now **approved**, not draft) |
| Staging ETL execution | **Not authorized in Phase 2F** — smoke test awaits separate approval |
| Phase 2F outcome | **`READY_FOR_10_RECORD_STAGING_SMOKE_TEST_APPROVAL`** |

---

## Approved category and routing table

| refId | Category / disposition |
|------:|------------------------|
| 0 | Alibaba Packages |
| 1 | Company Business Type |
| 2 | Service Type |
| 3 | EXCLUDED_SERVICES |
| 4 | Company Detail |
| 5 | Source |
| 6 | Job Designation |
| 7 | Service Type |
| 8 | Contact Attribute |
| 9 | Whatsapp Message |
| 10 | EXCLUDED_BRANCHES |
| 11 | Govt Leave |
| 12 | Account Monthly Task |
| 13 | Portfolio Categories |
| 14 | Country |

---

## Approved operational rules

1. **refId 7:** Legacy id **107** (`Agriculture`) uses category **`Service Type`** (same string as refId **2**); remains a **separate row** (no deduplication).
2. **refId 9:** All **6** records under **`Whatsapp Message`**; names **unchanged**.
3. **refId 3:** **31** rows excluded from attributes → future services catalog migration.
4. **refId 10:** **10** rows excluded → future branches migration.
5. **Legacy ids 197, 198:** Excluded as misfiled grades (not Contact Attribute).

---

## Approved scope (verified SQL 2026-11-04)

```sql
SELECT count(*)::int FROM legacy_archive.webxl_attribute;  -- 244

SELECT count(*)::int FROM legacy_archive.webxl_attribute
WHERE "refId" NOT IN ('3','10') AND id NOT IN ('197','198');  -- 201
```

| Metric | Count |
|--------|------:|
| Archive source rows | 244 |
| Attributes ETL scope | **201** |
| Excluded services (refId 3) | 31 |
| Excluded branches (refId 10) | 10 |
| Excluded misfiles | 2 |

---

## Dry-run alignment (Phase 2E)

[`43-attributes-dry-run-report.md`](./43-attributes-dry-run-report.md): **201** valid, **0** rejected, **43** excluded; read-only; archive **244** unchanged.

---

## What this approval does **not** authorize

- 10-record staging smoke **execution**
- Full **201**-row load
- Production, Supabase, `drm_postgres`, `.env`, PM2, Nginx
- Changes to Phase 2C `webxl_vas_comm_final` data

Smoke test plan: [`47-attributes-smoke-test-execution-plan.md`](./47-attributes-smoke-test-execution-plan.md)
