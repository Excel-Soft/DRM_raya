# Phase 2C — Readiness review (archive + modern schema)

**Database:** `drm_legacy_stage` only  
**Date:** 2026-11-04  
**Scope:** Pre-transform verification before controlled legacy → modern ETL

## Task A — Archive integrity

### Documents reviewed

| Doc | Finding |
|-----|---------|
| [`17-source-backup-integrity.md`](./17-source-backup-integrity.md) | Source file intact |
| [`18-archive-import-execution.md`](./18-archive-import-execution.md) | Streaming parser + resume documented |
| [`19-archive-row-count-reconciliation.csv`](./19-archive-row-count-reconciliation.csv) | 0 table-level mismatches |
| [`20-archive-data-integrity-report.md`](./20-archive-data-integrity-report.md) | 5,507,713 = 5,507,713 |
| [`21-failed-and-unresolved-records.md`](./21-failed-and-unresolved-records.md) | 0 unresolved source rows |
| [`22-phase2b-final-report.md`](./22-phase2b-final-report.md) | Phase 2B complete |

### PostgreSQL verification (direct)

| Check | Result |
|-------|--------|
| Archive tables (`legacy_archive`) | **166** (`information_schema`) |
| Total archived rows (CSV sum of `archived_rows`) | **5,507,713** |
| Pilot table `webxl_vas_comm_final` | **1,858** archive = [`source-row-counts.json`](./source-row-counts.json) |
| Source backup SHA-256 (2026-11-04) | `09e81ddbfb663e1ddc37a913d41cd656a78fa849b959f295836fca0df25102ba` — **unchanged** |

Row counts alone do not prove per-field fidelity; they prove **completeness of archive ingestion** against the parsed manifest.

### Duplicate resume rejects (`duplicate_legacy_pk`)

| Metric | Value |
|--------|------:|
| Total `duplicate_legacy_pk` rejects | **494,149** (grew vs early ~239k report due to additional resume overlap attempts) |
| Non-duplicate rejection reasons | **0** |
| `webxl_attendance` dup rejects | 488,748 |
| `webxl_task_links` dup rejects | 9,318 |

**Investigation:** For high-volume tables, every duplicate reject’s `(source_table, legacy_id)` still exists in `legacy_archive` (0 orphans):

- `webxl_attendance`: archive **483,212** = source manifest; dup rejects **488,748** (> row count) → **multiple failed re-insert attempts per PK**, not missing rows.
- `webxl_task_links`: archive **891,208**; dup rejects **9,318**; **0** dup rejects without matching archive PK.

**Conclusion:** Rejects are **retry/resume collisions** only, not evidence of dropped source records.

### NUL-byte normalization

Implementation: `sanitizeArchiveText()` in `backend/scripts/migration/run-archive-import.mjs` replaces ASCII `0x00` with the two-character sequence `\` + `0` in archive TEXT.

| Property | Assessment |
|----------|------------|
| Reversible | Yes — audit can map stored `\0` back to byte NUL |
| Distinguishable from literal `\0` text in source | **Ambiguous** if legacy ever stored the two-character sequence `\0` as data (unlikely in URL/link fields) |
| Fidelity limitation | Original byte length changes; semantic content preserved for typical string fields |

PostgreSQL cannot store NUL in TEXT; normalization is required for import, not optional.

### Archive immutability (Phase 2C rule)

Transform ETL **reads** `legacy_archive` only. Pilot run verified row count **1,858 → 1,858** before/after modern inserts.

## Task B — Modern schema readiness

### Contract

- `backend/src/shared/schema.ts` — **159** Drizzle tables
- Review: [`13-modern-schema-ddl-review.md`](./13-modern-schema-ddl-review.md)

### Tables in `drm_legacy_stage.drm`

| Metric | Before pilot DDL | After pilot DDL |
|--------|------------------|-----------------|
| Tables present | 146 | **147** |

### Missing vs `schema.ts` (12 remaining after pilot)

1. `ab_closing_history`
2. `ab_report_notes`
3. `branches`
4. `cheque_pool`
5. `department_team_commissions`
6. `departments`
7. `diagnose_followups`
8. `dollar_advance_payments`
9. `dollar_allocations`
10. `gm_bv_commission_verifications`
11. `target_system_kwa_history`
12. `task_files`

**Pilot target applied:** `drm.webxl_vas_comm_final` via [`backend/scripts/migration/ddl/05_pilot_webxl_vas_comm_final.sql`](../backend/scripts/migration/ddl/05_pilot_webxl_vas_comm_final.sql) (PG 16, matches `webxlVasCommFinal` including typo column `hod_satatus_date`).

No unrestricted `drizzle-kit push`. No production PG17 dump applied.

### Pilot target column / constraint check

| Item | Status |
|------|--------|
| PK `id` serial | OK — preserved via `OVERRIDING SYSTEM VALUE` |
| `user_id` integer NOT NULL | OK — **legacy integer**, no UUID user FK (per `schema.ts` comment) |
| Decimals `(10,2)` | OK |
| Timestamps | OK — `0000-00-00*` → NULL |
| FK to `users` / `customers` | **None** on this table |
| Enums | **None** |

### `migration_meta` readiness

- `migration_legacy_ids`, `migration_rejects`, `migration_batches` — in use
- `migration_record_state.state` CHECK extended for Phase 2C: `TRANSFORMED_SUCCESSFULLY`, `TRANSFORMATION_REJECTED`, `PENDING_BUSINESS_REVIEW`

## Task C — Mapping evidence (summary)

Sources: [`06-manual-mapping-review.md`](./06-manual-mapping-review.md), [`07-legacy-table-classification.csv`](./07-legacy-table-classification.csv), [`08-id-mapping-strategy.md`](./08-id-mapping-strategy.md), [`09-data-transformation-rules.md`](./09-data-transformation-rules.md), [`drm-schema-mapping.csv`](./drm-schema-mapping.csv)

| Classification | Pilot usage |
|----------------|-------------|
| **DIRECT_MIGRATION** | Only `webxl_vas_comm_final` in classification CSV — selected for pilot |
| **INFERRED** column rows in CSV | Treated as snake_case PG columns, not camelCase Drizzle property names |
| **UNVERIFIED** archive columns | `dep`, `target`, `total_amount`, `rewardcomment`, `user_status_date`, `create_at` — **archive-only** |
| **DUPLICATE_SOURCE / UNVERIFIED tables** | Not in scope for Phase 2C pilot |

## Task D — Pilot selection rationale

**Selected:** `legacy_archive.webxl_vas_comm_final` → `drm.webxl_vas_comm_final`

| Criterion | Fit |
|-----------|-----|
| Table-level **DIRECT_MIGRATION** | Only table with this classification |
| Explicit `schema.ts` target | `webxlVasCommFinal` |
| Small row count | 1,858 |
| Integer PK preservation | Documented in ID strategy |
| No UUID user FK | Avoids unmigrated `users` map |
| Not users / customers / invoices | Per Phase 2C instructions |
| No duplicate-source group | Outside D1–D4 |
| Archive-only columns documented | 6 columns not in modern DDL |

## Blockers before broad migration

1. **12 missing modern tables** — modules targeting those tables need targeted DDL first.
2. **Business decisions D1–D25** — unchanged; duplicate-source domains blocked.
3. **User/customer UUID maps** — required before most `TRANSFORM_AND_MIGRATE` modules with FKs.
4. **Row count ≠ field fidelity** — spot checks and business rules still required per module.

## Safety confirmation

| System | Touched |
|--------|---------|
| Supabase production | No |
| `drm_postgres` | No |
| Production / staging `.env` | No |
| PM2 / Nginx / live app code | No |
| `old_drm_database.sql` | No (read + checksum only) |
| `legacy_archive` data rows | No updates/deletes |

**STOP after one pilot table** — see [`25-pilot-execution-report.md`](./25-pilot-execution-report.md).
