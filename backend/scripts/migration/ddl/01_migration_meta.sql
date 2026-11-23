-- Target database: drm_legacy_stage ONLY
-- Migration infrastructure (no PII; audit counts and id maps only)

CREATE SCHEMA IF NOT EXISTS migration_meta AUTHORIZATION drm_app;

CREATE TABLE IF NOT EXISTS migration_meta.migration_legacy_ids (
  entity_type text NOT NULL,
  legacy_table text NOT NULL,
  legacy_id text NOT NULL,
  modern_id text NOT NULL,
  modern_table text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, legacy_table, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_legacy_ids_modern
  ON migration_meta.migration_legacy_ids (modern_table, modern_id);

CREATE TABLE IF NOT EXISTS migration_meta.migration_rejects (
  id bigserial PRIMARY KEY,
  source_table text NOT NULL,
  legacy_id text,
  target_table text,
  rejection_reason text NOT NULL,
  raw_record_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migration_rejects_source
  ON migration_meta.migration_rejects (source_table, created_at DESC);

CREATE TABLE IF NOT EXISTS migration_meta.migration_batches (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  target_table text,
  batch_status text NOT NULL DEFAULT 'pending',
  rows_read bigint NOT NULL DEFAULT 0,
  rows_archived bigint NOT NULL DEFAULT 0,
  rows_migrated bigint NOT NULL DEFAULT 0,
  rows_rejected bigint NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_summary text
);

CREATE INDEX IF NOT EXISTS idx_migration_batches_source
  ON migration_meta.migration_batches (source_table, started_at DESC);

CREATE TABLE IF NOT EXISTS migration_meta.migration_table_status (
  source_table text PRIMARY KEY,
  total_source_rows bigint,
  archived_rows bigint NOT NULL DEFAULT 0,
  modern_migrated_rows bigint NOT NULL DEFAULT 0,
  rejected_rows bigint NOT NULL DEFAULT 0,
  unmapped_rows bigint NOT NULL DEFAULT 0,
  validation_status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-record traceability (no sensitive column payloads)
CREATE TABLE IF NOT EXISTS migration_meta.migration_record_state (
  source_table text NOT NULL,
  legacy_pk text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'ARCHIVED_AND_MIGRATED',
    'ARCHIVED_ONLY',
    'ARCHIVED_PENDING_REVIEW',
    'ARCHIVED_REJECTED'
  )),
  archive_table text NOT NULL,
  modern_table text,
  modern_id text,
  batch_id uuid REFERENCES migration_meta.migration_batches (batch_id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, legacy_pk)
);

CREATE INDEX IF NOT EXISTS idx_migration_record_state_state
  ON migration_meta.migration_record_state (state);

-- Possible cross-table matches (reconciliation never overwrites in Phase 2B)
CREATE TABLE IF NOT EXISTS migration_meta.migration_reconciliation_candidates (
  id bigserial PRIMARY KEY,
  source_table_a text NOT NULL,
  legacy_pk_a text NOT NULL,
  source_table_b text NOT NULL,
  legacy_pk_b text NOT NULL,
  match_rule text NOT NULL,
  confidence text NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_table_a, legacy_pk_a, source_table_b, legacy_pk_b, match_rule)
);

GRANT USAGE ON SCHEMA migration_meta TO drm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA migration_meta TO drm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA migration_meta TO drm_app;
