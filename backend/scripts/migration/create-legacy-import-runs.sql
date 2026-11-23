-- Incremental old-DRM import (Admin → Old Data Import).
-- Old DRM keeps running after the 2026-11-04 snapshot; an admin uploads a newer
-- MySQL dump and backend/scripts/migration/incremental/import_old_dump.py merges it
-- into legacy_archive.*:
--   new rows (legacy pk not in archive)  -> inserted
--   changed rows (same pk, other values) -> updated, previous row saved here first
--   identical rows                       -> skipped (never duplicated)
-- Nothing is deleted from legacy_archive except rows a run itself inserted, and
-- only when that run is rolled back.
-- Rollback: create-legacy-import-runs.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS migration_meta.import_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     text NOT NULL,
  file_path     text NOT NULL,
  file_size     bigint NOT NULL DEFAULT 0,
  -- uploading | uploaded | checking | checked | applying | applied | rolling_back | rolled_back | failed
  status        text NOT NULL DEFAULT 'uploading',
  -- per-table counts from the last check/apply: {tables:[{table,dumpRows,new,changed,same,...}], totals:{...}}
  report        jsonb,
  progress      text,
  -- pid of the running import_old_dump.py (detects a job that died)
  pid           integer,
  error         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  checked_at    timestamptz,
  applied_at    timestamptz,
  applied_by    uuid,
  rolled_back_at timestamptz,
  rolled_back_by uuid
);
CREATE INDEX IF NOT EXISTS idx_import_runs_created ON migration_meta.import_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS migration_meta.import_row_history (
  id             bigserial PRIMARY KEY,
  run_id         uuid NOT NULL REFERENCES migration_meta.import_runs(id),
  table_name     text NOT NULL,
  archive_row_id bigint NOT NULL,
  legacy_pk      text NOT NULL,
  action         text NOT NULL CHECK (action IN ('insert', 'update')),
  -- full archive row before an update (NULL for inserts)
  old_row        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_import_row_history_run ON migration_meta.import_row_history (run_id, table_name);

COMMIT;
