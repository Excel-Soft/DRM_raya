-- SQL ports of the first-migration transforms for the tasks module, used by the incremental
-- old-DRM import (same conventions as create-incremental-sync-functions.sql):
--   tf_task_log_history(row) = run-wave5-highvolume-transform.mjs migrateTaskLogHistory()
--                              webxl_task_log_history -> drm.task_log_history (entity task_log_history_row)
--   tf_task_link(row)        = run-wave5-highvolume-transform.mjs migrateTaskLinks()
--                              webxl_task_links       -> drm.link_reports     (entity task_link)
-- Input: to_jsonb(legacy_archive.<t> row). Output: the drm columns the original INSERT set
-- (except id, which the original generated with crypto.randomUUID()), or {"_reject": reason}.
-- Requires migration_meta.mig_trim / mig_ts (create-incremental-sync-functions.sql).
-- Rollback: create-sync-tf-tasks.rollback.sql
BEGIN;

-- webxl_task_log_history -> drm.task_log_history
-- Original: uid = userMap.get(String(row.user_id))  (exact match, no trim, no fallback;
-- unmapped -> reject 'unmapped_user'); event_time = parseTs(time) ?? parseTs(create_at).
-- Target columns are timestamptz: node-pg sent the Berlin-local JS Date with its offset,
-- so the wall clock from mig_ts() is interpreted in Europe/Berlin.
CREATE OR REPLACE FUNCTION migration_meta.tf_task_log_history(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  uid uuid;
  ev timestamp := coalesce(migration_meta.mig_ts(j->>'time'), migration_meta.mig_ts(j->>'create_at'));
  ca timestamp := migration_meta.mig_ts(j->>'create_at');
BEGIN
  SELECT m.modern_id::uuid INTO uid FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user'
     AND m.legacy_id = coalesce(j->>'user_id', 'null')   -- JS String(null) = 'null'
   LIMIT 1;
  IF uid IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;
  RETURN jsonb_build_object(
    'user_id', uid,
    'legacy_task_id', migration_meta.mig_trim(j->>'task_id'),
    'status', migration_meta.mig_trim(j->>'status'),
    'event_time', to_jsonb(ev AT TIME ZONE 'Europe/Berlin'),
    'legacy_created_at', to_jsonb(ca AT TIME ZONE 'Europe/Berlin')
  );
END $$;

-- webxl_task_links -> drm.link_reports
-- Original: uid = mapLegacyUserId(user_id, userMap, {fallback}) — ''/'0'/unmapped -> fallback
-- user = loadFallbackUserId() = "SELECT id FROM drm.users ORDER BY created_at LIMIT 1".
-- drm.users.created_at has ties, so that query is not deterministic; all 17,395 migrated
-- fallback rows got 5e27b8fb-b68b-4a2f-beee-50f14197cba3, which is preferred here (if it
-- still exists), else the original query with id as tie-breaker.
-- submitted_at = created_at = updated_at = parseTs(create_at) ?? new Date() (insert time,
-- Berlin wall clock into a timestamp-without-tz column).
CREATE OR REPLACE FUNCTION migration_meta.tf_task_link(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  pk text := coalesce(j->>'id', j->>'_legacy_pk');
  uid uuid;
  ts timestamp := coalesce(migration_meta.mig_ts(j->>'create_at'), (now() AT TIME ZONE 'Europe/Berlin'));
  lnk text := coalesce(migration_meta.mig_trim(j->>'link'), 'legacy:missing-link:' || pk);
BEGIN
  IF migration_meta.mig_trim(j->>'user_id') IS NOT NULL AND migration_meta.mig_trim(j->>'user_id') <> '0' THEN
    SELECT m.modern_id::uuid INTO uid FROM migration_meta.migration_legacy_ids m
     WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user'
       AND m.legacy_id = migration_meta.mig_trim(j->>'user_id')
     LIMIT 1;
  END IF;
  IF uid IS NULL THEN
    SELECT u.id INTO uid FROM drm.users u WHERE u.id = '5e27b8fb-b68b-4a2f-beee-50f14197cba3'::uuid;
  END IF;
  IF uid IS NULL THEN
    SELECT u.id INTO uid FROM drm.users u ORDER BY u.created_at, u.id LIMIT 1;
  END IF;
  IF uid IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;
  RETURN jsonb_build_object(
    'submitted_by_user_id', uid,
    'company_name', left(coalesce(migration_meta.mig_trim(j->>'detail'), '-'), 500),
    'link_url', left(lnk, 4000),
    'source_module', 'legacy_task_link',
    'submitted_at', to_jsonb(ts),
    'created_at', to_jsonb(ts),
    'updated_at', to_jsonb(ts),
    -- raw (untrimmed) archive values, exactly as JSON.stringify(meta) stored them
    'legacy_metadata', jsonb_build_object(
      'legacy_pro_id', j->'pro_id',
      'legacy_task_id', j->'task_id',
      'showcase', j->'showcase',
      'verify', j->'verify',
      'note', j->'note',
      'verify_date', j->'verify_date',
      'send_to_qa', j->'send_to_qa',
      'qa_status', j->'qa_status',
      'qa_com', j->'qa_com',
      'qa_reject_image', j->'qa_reject_image',
      'qa_date', j->'qa_date'
    )
  );
END $$;

COMMIT;
