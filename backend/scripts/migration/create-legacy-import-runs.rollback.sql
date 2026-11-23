-- Rollback for create-legacy-import-runs.sql.
-- Roll back every applied run first (Admin → Old Data Import → Rollback), otherwise the
-- archive rows those runs inserted/updated stay as they are and their history is lost.
BEGIN;
DROP TABLE IF EXISTS migration_meta.import_row_history;
DROP TABLE IF EXISTS migration_meta.import_runs;
COMMIT;
