# Incremental old-DRM import (Admin → Old Data Import)

Old DRM keeps running after the 2026-11-04 snapshot that was archived into
`legacy_archive.*`. This merges a newer old-DRM MySQL dump into the archive without
duplicating anything.

## Flow

1. Admin uploads the `.sql` dump on **DRM Setting → Old Data Import** (`/admin/legacy-import`).
   It is sent in 8 MB chunks and stored in `backend/private/legacy-imports/<run-id>.sql`
   (not under `backend/uploads`, which is public).
2. **Check** runs automatically: `import_old_dump.py --mode check` parses the dump with
   `parsers/mysql_insert_parser.py`, cleans values exactly like `run-archive-import.mjs`,
   `\copy`s each table into a temp table and compares by old primary key
   (`_source_table`, `_legacy_pk`):
   - **new** – pk not in the archive → will be inserted
   - **changed** – same pk, some value differs → will be updated
   - **same** – identical → skipped
   - **duplicate in file** – pk twice in the dump → skipped, reported
   - **only in archive** – in the archive but not in the dump → counted, never deleted
   Nothing is written. The report (per table, with the columns that changed) is stored in
   `migration_meta.import_runs.report`.
3. Admin reviews the report and clicks **Import** (`--mode apply`). Each table is one
   transaction: changed rows are copied to `migration_meta.import_row_history` (full old
   row as JSON) and updated; new rows are inserted and logged. Every touched row gets
   `_mig_batch_id = <run id>`.
4. **Rollback** (`--mode rollback`, latest applied import only) restores every updated row
   from the history and deletes the rows that import inserted.

Only one job runs at a time; a job whose process died is marked failed on the next list call.

## What it updates

1. **legacy_archive** (all old tables) — screens that read old data straight from the archive
   (AB Report, Dollar System, BV / VAS / Balance reports, PMS pending/running, …) show it at once.
2. **drm.* copies** (`sync_modern.py`, after the archive step of an Import):
   - `webxl_company` → `drm.customers`: new companies inserted with the first migration's rules
     (`migration_meta.tf_company`); Private pool + owner when the old assignee is an active user,
     otherwise Public. A com_id that already exists is rejected; a company whose name + phone
     match a customer created in the new app is linked to it (no duplicate); a name-only match
     is inserted and listed as a possible duplicate.
   - `webxl_last_followup` → `customers.last_followup_date` / `comment` (wave5 rule).
   - `webxl_followup` → `drm.follow_ups` (`migration_meta.tf_followup`).
   - Changed old rows: **3-way** — a field is updated only if its new-app value still equals the
     old-DRM value before the change; otherwise it is kept and reported as a conflict.
     Owner/pool follow an old reassignment unless the customer is in the Service/GMBV pool or was
     reassigned in the new app.
   - Every change is in `migration_meta.import_modern_history`; rollback restores a field only
     while it still holds the imported value (later new-app edits are kept).
   - Generic modules (`GENERIC_MODULES` in sync_modern.py, transforms in
     create-sync-tf-attendance.sql / -tasks.sql / -invoices.sql, all validated against every
     migrated row): attendance, attendance_month(+history), raw punches, task log history,
     task links (link_reports), invoices, payments (ledger_entries), invoice item payments,
     quotations. Same rules: insert new, 3-way update, insert-only columns (created_at,
     invoice_number, legacy_uid, …), and an `exists` guard that skips a record the new app already
     has (attendance of that user/day, month rows by user/month/year).
   - invoices.items is rebuilt when webxl_invoice_item rows change; drm.quotation_items is
     replaced as a set when it still equals the set before the import (create-sync-items-functions.sql).
   - Not copied: webxl_task_assign (the app reads it from the archive directly).

The transforms were checked against the first migration: `tf_company` reproduces all
231,920 migrated customers (23 fields, 0 differences except `comment`, which the wave5
last-follow-up step overwrote) and `tf_followup` all 987,851 follow-ups (11 fields, 0 differences).

## Tests done (2026-11-23)

- Full original dump (901 MB, 159 tables, 5,507,713 rows) re-checked against the archive:
  0 new, 0 changed — 8 min 50 s, 26 MB RAM.
- Customer/follow-up sync end to end inside one rolled-back transaction: new company (→ Private
  pool of its active assignee) + its new follow-up, changed company (city, grade, assignee →
  owner/pool), new last follow-up, changed follow-up note, and a conflict (field also edited in
  the new app → kept, reported). Modern rollback restored every row exactly (all fields equal
  except updated_at) and removed the inserted rows and their legacy-id mappings.

- Re-importing the original tables (`webxl_kwa`, `webxl_vas_comm_final`) → 0 new, 0 changed, 2,178 same.
- Modified dump in a scratch schema → 1 new, 1 changed (`account_pay_status`, `account_pay_date`),
  2 duplicate rows skipped; apply → re-check shows 0 new / 0 changed; rollback → tables identical
  to the archive (`EXCEPT` = 0 rows).

## Manual run

```bash
cd /var/www/DRM_raya/backend
export $(grep -E '^DATABASE_URL=' .env | xargs)
python3 scripts/migration/incremental/import_old_dump.py --run-id <import_runs.id> --mode check --file dump.sql
# --schema <name> runs against a copy of the archive tables (testing)
```

Schema: `scripts/migration/create-legacy-import-runs.sql` (rollback: `.rollback.sql`).
