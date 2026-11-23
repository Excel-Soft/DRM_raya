# Phase 2D–2F — Attributes migration plan

**Mapping:** **`BUSINESS_MAPPING_APPROVED`** (2026-11-04) — [`46-attributes-business-approval.md`](./46-attributes-business-approval.md)  
**Execution:** Smoke prepared — **not run** ([`47`](./47-attributes-smoke-test-execution-plan.md))  
**Scope authority:** [`34-attributes-scope-reconciliation.md`](./34-attributes-scope-reconciliation.md)

## 1. Scope options

| Option | Row count | Definition |
|--------|----------:|------------|
| **A-full** | 244 | **Rejected** — violates routing for refId 3, 10 |
| **A-partial (approved 2E)** | **201** | SQL: `"refId" NOT IN ('3','10') AND id NOT IN ('197','198')` — includes refId **7** (Service Type) and **9** (Whatsapp Message) |
| **A-split** | 244 | **201** → `attributes` + **31** → services + **10** → branches + **2** misfile reject |

~~**~178**~~ — **withdrawn** (incorrect; see doc 34).

## 2. Preconditions

- [x] Business approves **refId → category** table (§3) — **2026-11-04**
- [x] refId **7** / **9** decisions approved
- [x] Migration timestamps policy (§5)
- [ ] **10-record smoke** executed — pending separate approval
- [ ] `drm.attributes` empty before smoke (currently **0**)

## 3. refId → category lookup (APPROVED)

| refId | Proposed `category` | Attributes ETL? |
|------:|---------------------|-----------------|
| 0 | Alibaba Packages | Yes |
| 1 | Company Business Type | Yes |
| 2 | Service Type | Yes |
| 3 | EXCLUDED_SERVICES | **No** → services module |
| 4 | Company Detail | Yes |
| 5 | Source | Yes |
| 6 | Job Designation | Yes |
| 7 | **Service Type** | **Yes** — user confirmed merge (same string as refId 2) |
| 8 | Contact Attribute | Yes except ids **197**, **198** |
| 9 | **Whatsapp Message** | **Yes** — all 6 names unchanged (user confirmed) |
| 10 | EXCLUDED_BRANCHES | **No** → branches |
| 11 | Govt Leave | Yes; `time` → `date_label` |
| 12 | Account Monthly Task | Yes; `time` → `date_label`; `branch` → `branch` |
| 13 | Portfolio Categories | Yes |
| 14 | Country | Yes |

## 4. ID strategy

| Legacy | Modern |
|--------|--------|
| `webxl_attribute.id` (int) | New UUID on `drm.attributes.id` |
| Map | `migration_meta.migration_legacy_ids`: `entity_type = 'attribute_row'`, `legacy_table = 'webxl_attribute'`, `modern_table = 'attributes'` |

**Do not** register refId **3** rows as `attribute_row`. Use future **`service_catalog_row`** (or equivalent) when the services module runs.

## 5. Column transform rules

1. **category** — from approved refId map; reject if unmapped or excluded refId.
2. **name** — trim; reject if empty.
3. **date_label** — copy `time` **only** if `refId IN ('11','12')`; else NULL.
4. **branch** — copy trimmed `branch` **only** if `refId = '12'`; else NULL.
5. **refId 8 `time`** — **do not migrate** to any modern column (archive only).
6. **parent_id, amount, email, phone** — NULL.
7. **created_at / updated_at** — migration insert time; **not** historical legacy timestamps (doc 34 §5). Optionally order inserts by `_archive_row_id` for stable API ordering within the same second.

## 6. ETL

Script: `backend/scripts/migration/run-attributes-transform.mjs` (`--dry-run` | `--execute-staging`).

- Batch transactions; `migration_batches`, `migration_rejects`, `migration_record_state`.
- No blind `ON CONFLICT DO NOTHING`.
- Archive row count **244** unchanged.

## 7. Reconciliation targets (post-approval)

| Metric | A-partial strict |
|--------|-----------------:|
| Selected | 201 |
| Migrated + rejected | 201 |
| Archive count | 244 |
| Wrong-module backlog | 41 (31+10) |
| Misfile reject | 2 (197, 198) |

## 8. Out of scope

- refId **3** / **10** transforms
- `webxl_follow_up_services` (D5) — except preserving id-map rules documented in doc 34
- Orphan follow-up `service_id=5` — explicit reconciliation item

## 9. Smoke command (awaiting execution approval)

```bash
cd /var/www/DRM_raya/backend
sudo -u postgres node scripts/migration/run-attributes-transform.mjs \
  --execute-staging \
  --legacy-ids=9,12,33,107,137,160,171,181,316,278 \
  --batch-size=10
```

**Do not run until smoke execution is explicitly approved.**
