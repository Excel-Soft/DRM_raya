-- drm_legacy_stage: catch-all for small legacy tables without dedicated modern targets
CREATE TABLE IF NOT EXISTS drm.legacy_archive_payload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  legacy_pk text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  migrated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_legacy_archive_payload_source_pk UNIQUE (source_table, legacy_pk)
);

CREATE INDEX IF NOT EXISTS idx_legacy_archive_payload_source ON drm.legacy_archive_payload (source_table);
