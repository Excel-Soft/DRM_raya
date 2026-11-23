"""
Copy what an applied import changed in legacy_archive into the drm.* tables that hold
copies of old data (step 2 of Admin -> Old Data Import). Uses the SQL ports of the first
migration's transforms (scripts/migration/create-incremental-sync-functions.sql):

  customers       webxl_company       new -> INSERT drm.customers (+ migration_legacy_ids)
                                      changed -> 3-way update (see below)
  last follow-up  webxl_last_followup new/changed -> customers.last_followup_date / comment
                                      (same rule as run-wave5-highvolume-transform.mjs)
  follow-ups      webxl_followup      new -> INSERT drm.follow_ups (+ migration_legacy_ids)
                                      changed -> 3-way update

3-way update: for every field the old DRM changed (old version -> new version, both run
through the same transform), the drm.* value is replaced only if it still equals the
old version, i.e. nobody changed it in the new app. Otherwise it is left alone and
reported as a conflict. Every change is logged in migration_meta.import_modern_history
(old/new values per field) so a rollback restores exactly what this import changed.

Duplicates: an old row is never copied twice (migration_legacy_ids). A new old-DRM company
whose com_id already exists is rejected (same as the first migration); one whose name and
phone match a customer created in the new app is linked to that customer instead of
creating a second one; a name-only match is copied and listed as a possible duplicate.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

CUSTOMER_FIELDS = {  # field -> SQL cast for the UPDATE
    "company_name": "text", "account_name": "text", "phone": "text", "region": "text", "grade": "text",
    "status": "drm.customer_status", "ntn": "text", "country": "text", "city": "text", "address": "text",
    "crm_id": "text", "crm_date": "timestamp", "company_type": "text", "website": "text",
    "rc_link": "text", "source": "text", "is_deleted": "boolean", "ab_type": "text",
}
FOLLOWUP_FIELDS = {
    "customer_id": "uuid", "assigned_to": "uuid", "created_by": "uuid", "due_at": "timestamp",
    "notes": "text", "method": "text", "reservation_type": "text", "talk_time_seconds": "integer",
    "date_time": "timestamp",
}
CONFLICT_SAMPLES = 50


def _ql(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def _three_way_sql(run: str, legacy_table: str, modern_table: str, tf: str, fields: dict[str, str],
                   key: str) -> str:
    """changed old rows -> per-field apply/conflict, then UPDATE + history. Returns SQL that
    leaves temp tables cf_{key} (field rows) for the report."""
    arr = "ARRAY[" + ",".join(_ql(f) for f in fields) + "]"
    sets = ",\n         ".join(
        f"{f} = CASE WHEN u.x ? {_ql(f)} THEN (u.x->>{_ql(f)})::{cast} ELSE m.{f} END" for f, cast in fields.items()
    )
    return f"""
CREATE TEMP TABLE cc_{key} ON COMMIT DROP AS
  SELECT h.legacy_pk, mm.modern_id::uuid AS mid,
         migration_meta.{tf}(h.old_row) AS t0,
         migration_meta.{tf}(to_jsonb(a)) AS t1,
         to_jsonb(m) AS cur
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.{legacy_table} a ON a._archive_row_id = h.archive_row_id
    JOIN migration_meta.migration_legacy_ids mm
      ON mm.legacy_table = {_ql(legacy_table)} AND mm.modern_table = {_ql(modern_table)} AND mm.legacy_id = h.legacy_pk
    JOIN drm.{modern_table} m ON m.id::text = mm.modern_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = {_ql(legacy_table)} AND h.action = 'update';
CREATE TEMP TABLE cf_{key} ON COMMIT DROP AS
  SELECT c.mid, c.legacy_pk, f, c.t0->>f AS o, c.t1->>f AS n, c.cur->>f AS cur,
         (c.cur->>f) IS NOT DISTINCT FROM (c.t0->>f) AS apply
    FROM cc_{key} c, unnest({arr}) f
   WHERE c.t0 IS NOT NULL AND c.t1 IS NOT NULL AND NOT (c.t0 ? '_reject') AND NOT (c.t1 ? '_reject')
     AND (c.t0->>f) IS DISTINCT FROM (c.t1->>f)
     AND (c.cur->>f) IS DISTINCT FROM (c.t1->>f);
WITH u AS (SELECT mid, jsonb_object_agg(f, n) AS x, jsonb_object_agg(f, cur) AS old FROM cf_{key} WHERE apply GROUP BY mid),
upd AS (
  UPDATE drm.{modern_table} m SET
         {sets},
         updated_at = now()
    FROM u WHERE m.id = u.mid
  RETURNING m.id)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, old_values, new_values)
SELECT {_ql(run)}::uuid, {_ql(modern_table)}, u.mid, {_ql(legacy_table)},
       (SELECT legacy_pk FROM cf_{key} WHERE mid = u.mid LIMIT 1), 'update', u.old, u.x
  FROM u WHERE u.mid IN (SELECT id FROM upd);
"""


def customers_sql(run: str) -> str:
    return f"""
SET lock_timeout = '15s';
SET statement_timeout = '30min';
BEGIN;
-- A) companies this import added to the archive and not copied yet
CREATE TEMP TABLE nc ON COMMIT DROP AS
  SELECT h.legacy_pk, migration_meta.tf_company(to_jsonb(a)) AS t, btrim(a."assignId") AS assign_legacy,
         row_number() OVER (PARTITION BY lower(migration_meta.mig_trim(a.com_id)) ORDER BY a._legacy_pk::bigint) AS rn
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.webxl_company a ON a._archive_row_id = h.archive_row_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_company' AND h.action = 'insert'
     AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                      WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = h.legacy_pk);
ALTER TABLE nc ADD COLUMN outcome text, ADD COLUMN match_id uuid, ADD COLUMN new_id uuid DEFAULT gen_random_uuid();
UPDATE nc SET outcome = 'rejected:missing_com_id' WHERE t IS NULL;
UPDATE nc SET outcome = 'rejected:duplicate_com_id' WHERE outcome IS NULL AND rn > 1;
-- com_id already used by a customer: link when that customer was created in the new app
-- (same company), otherwise reject like the first migration did.
UPDATE nc SET match_id = c.id,
       outcome = CASE WHEN EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                                    WHERE m.modern_table = 'customers' AND m.modern_id = c.id::text)
                      THEN 'rejected:duplicate_com_id' ELSE 'linked' END
  FROM drm.customers c
 WHERE nc.outcome IS NULL AND lower(c.drm_id) = lower(nc.t->>'drm_id');
-- same company name + same phone digits as a customer created in the new app -> link
UPDATE nc SET match_id = c.id, outcome = 'linked'
  FROM drm.customers c
 WHERE nc.outcome IS NULL
   AND lower(btrim(c.company_name)) = lower(nc.t->>'company_name')
   AND regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') <> ''
   AND regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') = regexp_replace(nc.t->>'phone', '\\D', '', 'g')
   AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                    WHERE m.modern_table = 'customers' AND m.modern_id = c.id::text);
-- name-only match with a new-app customer: copied, but reported
UPDATE nc SET outcome = 'inserted:possible_duplicate'
 WHERE outcome IS NULL AND EXISTS (
   SELECT 1 FROM drm.customers c
    WHERE lower(btrim(c.company_name)) = lower(nc.t->>'company_name')
      AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                       WHERE m.modern_table = 'customers' AND m.modern_id = c.id::text));
UPDATE nc SET outcome = 'inserted' WHERE outcome IS NULL;

-- Private pool rule (restore-private-pool-assignments.sql): old assignee is an active user.
CREATE TEMP TABLE nc_owner ON COMMIT DROP AS
  SELECT nc.legacy_pk, (nc.t->>'assignee')::uuid AS owner_id
    FROM nc
    JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = nc.assign_legacy
   WHERE nc.outcome LIKE 'inserted%' AND nc.t->>'assignee' IS NOT NULL
     AND coalesce(u."roleId", '') !~ '(^|,)54(,|$)'
     AND EXISTS (SELECT 1 FROM drm.users du WHERE du.id = (nc.t->>'assignee')::uuid);

INSERT INTO drm.customers (
  id, company_name, account_name, email, phone, region, grade, status, ntn, country, city, address,
  crm_id, crm_date, company_type, website, comment, rc_link, source, drm_id, owner_user_id, pool_type,
  created_by, is_deleted, ab_type, created_at, updated_at)
SELECT nc.new_id, t->>'company_name', t->>'account_name', t->>'email', t->>'phone', t->>'region', t->>'grade',
       (t->>'status')::drm.customer_status, t->>'ntn', t->>'country', t->>'city', t->>'address',
       t->>'crm_id', (t->>'crm_date')::timestamp, t->>'company_type', t->>'website', t->>'comment',
       t->>'rc_link', t->>'source', t->>'drm_id', o.owner_id,
       (CASE WHEN o.owner_id IS NOT NULL THEN 'Private' ELSE 'Public' END)::drm.pool_type,
       (t->>'created_by')::uuid, (t->>'is_deleted')::boolean, t->>'ab_type',
       coalesce((t->>'created_at')::timestamp, now()), coalesce((t->>'updated_at')::timestamp, now())
  FROM nc LEFT JOIN nc_owner o ON o.legacy_pk = nc.legacy_pk
 WHERE nc.outcome LIKE 'inserted%';
UPDATE nc SET match_id = new_id WHERE outcome LIKE 'inserted%';
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'customer', 'webxl_company', legacy_pk, match_id::text, 'customers' FROM nc WHERE outcome IN ('inserted', 'inserted:possible_duplicate', 'linked');
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, new_values)
SELECT {_ql(run)}::uuid, 'customers', match_id, 'webxl_company', legacy_pk,
       CASE WHEN outcome = 'linked' THEN 'update' ELSE 'insert' END,
       CASE WHEN outcome = 'linked' THEN jsonb_build_object('_linked', true) ELSE NULL END
  FROM nc WHERE outcome IN ('inserted', 'inserted:possible_duplicate', 'linked');
INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
SELECT 'webxl_company', legacy_pk, 'customers', split_part(outcome, ':', 2), 'incremental:{run}'
  FROM nc WHERE outcome LIKE 'rejected:%';

-- B) companies the old DRM changed
{_three_way_sql(run, 'webxl_company', 'customers', 'tf_company', CUSTOMER_FIELDS, 'cust')}

-- B2) old assignee changed -> owner / pool, unless the new app moved the customer meanwhile
CREATE TEMP TABLE co ON COMMIT DROP AS
  SELECT c.mid, c.legacy_pk, (c.t0->>'assignee')::uuid AS old_a, (c.t1->>'assignee')::uuid AS new_a,
         m.owner_user_id AS cur_owner, m.pool_type::text AS cur_pool,
         EXISTS (SELECT 1 FROM legacy_archive.webxl_company a
                   JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = btrim(a."assignId")
                  WHERE a._source_table = 'webxl_company' AND a._legacy_pk = c.legacy_pk
                    AND coalesce(u."roleId", '') !~ '(^|,)54(,|$)'
                    AND EXISTS (SELECT 1 FROM drm.users du WHERE du.id = (c.t1->>'assignee')::uuid)) AS new_active
    FROM cc_cust c JOIN drm.customers m ON m.id = c.mid
   WHERE c.t0 IS NOT NULL AND c.t1 IS NOT NULL AND (c.t0->>'assignee') IS DISTINCT FROM (c.t1->>'assignee');
ALTER TABLE co ADD COLUMN outcome text;
UPDATE co SET outcome = CASE
  WHEN cur_pool IN ('Service', 'GMBV') THEN 'conflict:in ' || cur_pool || ' pool'
  WHEN cur_owner IS NOT NULL AND cur_owner IS DISTINCT FROM old_a THEN 'conflict:reassigned in new app'
  ELSE 'apply' END;
WITH upd AS (
  UPDATE drm.customers m
     SET owner_user_id = CASE WHEN co.new_active THEN co.new_a ELSE NULL END,
         pool_type = (CASE WHEN co.new_active THEN 'Private' ELSE 'Public' END)::drm.pool_type,
         updated_at = now()
    FROM co WHERE m.id = co.mid AND co.outcome = 'apply'
  RETURNING m.id, co.legacy_pk, co.cur_owner, co.cur_pool, m.owner_user_id, m.pool_type::text AS pool)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, old_values, new_values)
SELECT {_ql(run)}::uuid, 'customers', id, 'webxl_company', legacy_pk, 'update',
       jsonb_build_object('owner_user_id', cur_owner, 'pool_type', cur_pool),
       jsonb_build_object('owner_user_id', owner_user_id, 'pool_type', pool)
  FROM upd;

SELECT json_build_object(
  'module', 'customers',
  'newInArchive', (SELECT count(*) FROM nc),
  'inserted', (SELECT count(*) FROM nc WHERE outcome LIKE 'inserted%'),
  'insertedPrivate', (SELECT count(*) FROM nc_owner),
  'linkedToExisting', (SELECT count(*) FROM nc WHERE outcome = 'linked'),
  'possibleDuplicates', (SELECT coalesce(json_agg(json_build_object('legacyId', legacy_pk, 'company', t->>'company_name')), '[]')
                           FROM (SELECT * FROM nc WHERE outcome = 'inserted:possible_duplicate' LIMIT {CONFLICT_SAMPLES}) x),
  'rejected', (SELECT coalesce(json_object_agg(r, n), '{{}}') FROM (SELECT split_part(outcome, ':', 2) r, count(*) n FROM nc WHERE outcome LIKE 'rejected:%' GROUP BY 1) x),
  'changedInArchive', (SELECT count(*) FROM cc_cust),
  'updatedRows', (SELECT count(DISTINCT mid) FROM cf_cust WHERE apply) + (SELECT count(*) FROM co WHERE outcome = 'apply' AND mid NOT IN (SELECT mid FROM cf_cust WHERE apply)),
  'updatedFields', (SELECT coalesce(json_object_agg(f, n), '{{}}') FROM (
                      SELECT f, count(*) n FROM cf_cust WHERE apply GROUP BY f
                      UNION ALL SELECT 'owner/pool', count(*) FROM co WHERE outcome = 'apply' HAVING count(*) > 0) x),
  'conflicts', (SELECT count(*) FROM cf_cust WHERE NOT apply) + (SELECT count(*) FROM co WHERE outcome LIKE 'conflict:%'),
  'conflictSamples', (SELECT coalesce(json_agg(x), '[]') FROM (
      SELECT legacy_pk AS "legacyId", f AS field, o AS "oldDrm_before", n AS "oldDrm_now", cur AS "newApp" FROM cf_cust WHERE NOT apply
      UNION ALL
      SELECT legacy_pk, 'owner/pool', old_a::text, new_a::text, coalesce(cur_owner::text, '') || ' / ' || cur_pool || ' (' || split_part(outcome, ':', 2) || ')'
        FROM co WHERE outcome LIKE 'conflict:%'
      LIMIT {CONFLICT_SAMPLES}) x)
);
COMMIT;
"""


def last_followup_sql(run: str) -> str:
    # run-wave5-highvolume-transform.mjs: rows in id order; date = max(existing, row date);
    # comment = note of the last row with a non-empty note.
    return f"""
SET lock_timeout = '15s';
BEGIN;
CREATE TEMP TABLE lf ON COMMIT DROP AS
  SELECT h.legacy_pk, h.action, m.modern_id::uuid AS cust,
         coalesce(migration_meta.mig_ts(a.nc), migration_meta.mig_ts(a.create_date)) AS d,
         migration_meta.mig_trim(a.note) AS note, a._legacy_pk::bigint AS ord
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.webxl_last_followup a ON a._archive_row_id = h.archive_row_id
    LEFT JOIN migration_meta.migration_legacy_ids m
      ON m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = a.com_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_last_followup';
CREATE TEMP TABLE lfc ON COMMIT DROP AS
  SELECT cust, max(d) AS d,
         (array_agg(note ORDER BY ord DESC) FILTER (WHERE note IS NOT NULL))[1] AS note
    FROM lf WHERE cust IS NOT NULL GROUP BY cust;
WITH prev AS (SELECT c.id, c.last_followup_date, c.comment FROM drm.customers c JOIN lfc ON lfc.cust = c.id),
upd AS (
  UPDATE drm.customers c SET
         last_followup_date = CASE WHEN lfc.d IS NULL THEN c.last_followup_date
                                   WHEN c.last_followup_date IS NULL OR c.last_followup_date < lfc.d THEN lfc.d
                                   ELSE c.last_followup_date END,
         comment = CASE WHEN lfc.note IS NOT NULL THEN left(lfc.note, 2000) ELSE c.comment END,
         updated_at = now()
    FROM lfc WHERE c.id = lfc.cust
  RETURNING c.id, c.last_followup_date, c.comment)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, action, old_values, new_values)
SELECT {_ql(run)}::uuid, 'customers', u.id, 'webxl_last_followup', 'update',
       jsonb_build_object('last_followup_date', p.last_followup_date, 'comment', p.comment),
       jsonb_build_object('last_followup_date', u.last_followup_date, 'comment', u.comment)
  FROM upd u JOIN prev p ON p.id = u.id
 WHERE (p.last_followup_date, p.comment) IS DISTINCT FROM (u.last_followup_date, u.comment);
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'last_followup_snapshot', 'webxl_last_followup', legacy_pk, cust::text, 'customers'
  FROM lf WHERE action = 'insert' AND cust IS NOT NULL
ON CONFLICT DO NOTHING;
SELECT json_build_object(
  'module', 'lastFollowup',
  'rowsInArchive', (SELECT count(*) FROM lf),
  'customersUpdated', (SELECT count(*) FROM migration_meta.import_modern_history
                        WHERE run_id = {_ql(run)}::uuid AND legacy_table = 'webxl_last_followup'),
  'rejected', (SELECT CASE WHEN count(*) > 0 THEN json_build_object('unmapped_customer', count(*)) ELSE '{{}}'::json END
                 FROM lf WHERE cust IS NULL)
);
COMMIT;
"""


def followups_sql(run: str) -> str:
    return f"""
SET lock_timeout = '15s';
SET statement_timeout = '30min';
BEGIN;
CREATE TEMP TABLE nf ON COMMIT DROP AS
  SELECT h.legacy_pk, migration_meta.tf_followup(to_jsonb(a)) AS t, gen_random_uuid() AS new_id
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.webxl_followup a ON a._archive_row_id = h.archive_row_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_followup' AND h.action = 'insert'
     AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                      WHERE m.entity_type = 'followup' AND m.legacy_table = 'webxl_followup' AND m.legacy_id = h.legacy_pk);
INSERT INTO drm.follow_ups (id, customer_id, assigned_to, created_by, due_at, status, notes, method,
                            reservation_type, talk_time_seconds, date_time, created_at, updated_at, is_deleted)
SELECT new_id, (t->>'customer_id')::uuid, (t->>'assigned_to')::uuid, (t->>'created_by')::uuid, (t->>'due_at')::timestamp,
       'Open', t->>'notes', t->>'method', t->>'reservation_type', (t->>'talk_time_seconds')::int,
       (t->>'date_time')::timestamp, (t->>'created_at')::timestamp, (t->>'created_at')::timestamp, false
  FROM nf WHERE NOT (t ? '_reject');
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'followup', 'webxl_followup', legacy_pk, new_id::text, 'follow_ups' FROM nf WHERE NOT (t ? '_reject');
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action)
SELECT {_ql(run)}::uuid, 'follow_ups', new_id, 'webxl_followup', legacy_pk, 'insert' FROM nf WHERE NOT (t ? '_reject');
INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
SELECT 'webxl_followup', legacy_pk, 'follow_ups', t->>'_reject', 'incremental:{run}' FROM nf WHERE t ? '_reject';

{_three_way_sql(run, 'webxl_followup', 'follow_ups', 'tf_followup', FOLLOWUP_FIELDS, 'fu')}

SELECT json_build_object(
  'module', 'followUps',
  'newInArchive', (SELECT count(*) FROM nf),
  'inserted', (SELECT count(*) FROM nf WHERE NOT (t ? '_reject')),
  'rejected', (SELECT coalesce(json_object_agg(r, n), '{{}}') FROM (SELECT t->>'_reject' r, count(*) n FROM nf WHERE t ? '_reject' GROUP BY 1) x),
  'changedInArchive', (SELECT count(*) FROM cc_fu),
  'updatedRows', (SELECT count(DISTINCT mid) FROM cf_fu WHERE apply),
  'updatedFields', (SELECT coalesce(json_object_agg(f, n), '{{}}') FROM (SELECT f, count(*) n FROM cf_fu WHERE apply GROUP BY f) x),
  'conflicts', (SELECT count(*) FROM cf_fu WHERE NOT apply),
  'conflictSamples', (SELECT coalesce(json_agg(x), '[]') FROM (
      SELECT legacy_pk AS "legacyId", f AS field, o AS "oldDrm_before", n AS "oldDrm_now", cur AS "newApp"
        FROM cf_fu WHERE NOT apply LIMIT {CONFLICT_SAMPLES}) x)
);
COMMIT;
"""


def pool_sql(run: str) -> str:
    """A customer that got a new follow-up from this import, is still assigned in old DRM to an
    active user, but sits in the Public pool with no owner (90-day sweep while its activity was
    only in old DRM) -> back to that user's Private pool. Nothing else is touched."""
    return f"""
SET lock_timeout = '15s';
BEGIN;
CREATE TEMP TABLE pc ON COMMIT DROP AS
  SELECT DISTINCT c.id, mu.modern_id::uuid AS owner_id
    FROM migration_meta.import_modern_history h
    JOIN drm.follow_ups f ON f.id::text = h.modern_id
    JOIN drm.customers c ON c.id = f.customer_id
    JOIN migration_meta.migration_legacy_ids mc
      ON mc.entity_type = 'customer' AND mc.legacy_table = 'webxl_company' AND mc.modern_id = c.id::text
    JOIN legacy_archive.webxl_company a ON a._source_table = 'webxl_company' AND a._legacy_pk = mc.legacy_id
    JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = btrim(a."assignId")
    JOIN migration_meta.migration_legacy_ids mu
      ON mu.modern_table = 'users' AND mu.legacy_table = 'webxl_user' AND mu.legacy_id = u._legacy_pk
   WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = 'follow_ups' AND h.action = 'insert'
     AND f.created_at >= now() - interval '90 days'
     AND c.pool_type = 'Public' AND c.owner_user_id IS NULL AND coalesce(c.is_deleted, false) = false
     AND coalesce(u."roleId", '') !~ '(^|,)54(,|$)'
     AND EXISTS (SELECT 1 FROM drm.users du WHERE du.id::text = mu.modern_id);
WITH upd AS (
  UPDATE drm.customers c SET pool_type = 'Private', owner_user_id = pc.owner_id, updated_at = now()
    FROM pc WHERE c.id = pc.id
  RETURNING c.id, c.owner_user_id)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, action, old_values, new_values)
SELECT {_ql(run)}::uuid, 'customers', id, 'webxl_followup', 'update',
       jsonb_build_object('owner_user_id', NULL, 'pool_type', 'Public'),
       jsonb_build_object('owner_user_id', owner_user_id, 'pool_type', 'Private')
  FROM upd;
SELECT json_build_object('module', 'privatePool', 'customersUpdated', (SELECT count(*) FROM pc));
COMMIT;
"""


# ─── generic modules (one old table -> one drm table, row by row) ──────────────────────
# key, label, legacy table, drm table, mapping entity_type, transform, id expression for new
# rows, columns copied on insert, columns kept in sync by the 3-way update (subset of insert).
GENERIC_MODULES: list[dict] = [
    # attendance (create-sync-tf-attendance.sql). created_at/updated_at/late_minutes belong to the app;
    # a day the app already recorded for that user is skipped (no unique key on attendance).
    {"key": "attendance", "label": "Attendance", "legacy": "webxl_attendance", "modern": "attendance",
     "entity": "attendance_row", "tf": "tf_attendance", "new_id": "gen_random_uuid()",
     "insert": ["user_id", "date", "check_in", "check_out", "status", "late_checkin", "late_checkout", "is_late",
                "working_hours", "notes", "created_at", "updated_at"],
     "update": ["check_in", "check_out", "status", "late_checkin", "is_late", "working_hours", "notes"],
     "exists": "EXISTS (SELECT 1 FROM drm.attendance x WHERE x.user_id = r.user_id AND x.date = r.date)",
     "dedupe": ["user_id", "date"]},
    # month tables: UNIQUE (user_id, month, year). An existing month row is never overwritten by a
    # different old row (the first migration's ON CONFLICT merge is not repeated); branch kept as is.
    {"key": "attendance_month", "label": "Attendance month", "legacy": "webxl_attendance_month", "modern": "attendance_month",
     "entity": "attendance_month_row", "tf": "tf_attendance_month", "new_id": "gen_random_uuid()",
     "insert": ["user_id", "late_hour", "late_min", "half_leave", "leaves", "branch", "month", "year", "created_at", "updated_at"],
     "update": ["late_hour", "late_min", "half_leave", "leaves"],
     "exists": "EXISTS (SELECT 1 FROM drm.attendance_month x WHERE x.user_id = r.user_id AND x.month = r.month AND x.year = r.year)",
     "dedupe": ["user_id", "month", "year"]},
    {"key": "attendance_month_history", "label": "Attendance month history", "legacy": "webxl_attendance_month_history",
     "modern": "attendance_month_history", "entity": "attendance_month_history_row", "tf": "tf_attendance_month_history",
     "new_id": "gen_random_uuid()",
     "insert": ["user_id", "late_hour", "late_min", "half_leave", "leaves", "month", "year", "created_at", "updated_at"],
     "update": ["late_hour", "late_min", "half_leave", "leaves"],
     "exists": "EXISTS (SELECT 1 FROM drm.attendance_month_history x WHERE x.user_id = r.user_id AND x.month = r.month AND x.year = r.year)",
     "dedupe": ["user_id", "month", "year"]},
    # legacy_uid is insert-only (two script versions stored different ids in it)
    {"key": "raw_punch", "label": "Raw attendance punches", "legacy": "webxl_raw_attendence", "modern": "attendance_raw_punches",
     "entity": "raw_attendance_punch", "tf": "tf_raw_punch", "new_id": "gen_random_uuid()",
     "insert": ["user_id", "legacy_uid", "office", "device_ip", "state", "punch_type", "att_timestamp", "received_at", "raw_json"],
     "update": ["user_id", "office", "device_ip", "state", "punch_type", "att_timestamp", "received_at", "raw_json"]},
    # tasks (create-sync-tf-tasks.sql). webxl_task_assign needs no copy: the app reads the archive.
    {"key": "task_log", "label": "Task log history", "legacy": "webxl_task_log_history", "modern": "task_log_history",
     "entity": "task_log_history_row", "tf": "tf_task_log_history", "new_id": "gen_random_uuid()",
     "insert": ["user_id", "legacy_task_id", "status", "event_time", "legacy_created_at"],
     "update": ["user_id", "legacy_task_id", "status", "event_time", "legacy_created_at"]},
    # dates are insert-only (a missing old date became "now" in the first migration); legacy_metadata
    # holds the link verdict -> 3-way keeps a verdict given in the new app
    {"key": "task_link", "label": "Task links (Link Report)", "legacy": "webxl_task_links", "modern": "link_reports",
     "entity": "task_link", "tf": "tf_task_link", "new_id": "gen_random_uuid()",
     "insert": ["submitted_by_user_id", "company_name", "link_url", "source_module", "submitted_at", "created_at",
                "updated_at", "legacy_metadata"],
     "update": ["submitted_by_user_id", "company_name", "link_url", "legacy_metadata"], "touch_updated_at": True},
    # invoices (create-sync-tf-invoices.sql), in dependency order: invoice -> payments -> item payments.
    # invoice_number (LEG-xxxxxx) and dates set on insert only; items also re-synced by invoice_items_sql().
    {"key": "invoice", "label": "Invoices", "legacy": "webxl_invoice", "modern": "invoices",
     "entity": "invoice", "tf": "tf_invoice", "new_id": "gen_random_uuid()::text",
     "insert": ["invoice_number", "customer_id", "customer_name", "customer_email", "customer_address", "subtotal", "tax",
                "total", "currency", "status", "issue_date", "due_date", "paid_at", "notes", "items", "created_by_user_id",
                "dollar_rate", "created_at", "updated_at"],
     "update": ["customer_id", "customer_name", "customer_email", "customer_address", "subtotal", "tax", "total",
                "currency", "status", "issue_date", "due_date", "paid_at", "notes", "items", "created_by_user_id",
                "dollar_rate"], "touch_updated_at": True},
    {"key": "payment", "label": "Payments (ledger)", "legacy": "webxl_payments", "modern": "ledger_entries",
     "entity": "payment", "tf": "tf_payment", "new_id": "gen_random_uuid()::text",
     "insert": ["entry_type", "amount", "currency", "description", "category", "date", "entry_date", "reference_id",
                "reference_type", "created_by_user_id", "status", "remarks", "created_at"],
     "update": ["amount", "description", "date", "entry_date", "reference_id", "reference_type", "created_by_user_id"]},
    {"key": "invoice_item_pay", "label": "Invoice item payments", "legacy": "webxl_invoice_item_pay",
     "modern": "legacy_invoice_item_payments", "entity": "invoice_item_pay_row", "tf": "tf_invoice_item_pay",
     "new_id": "gen_random_uuid()",
     "insert": ["invoice_id", "legacy_invoice_id", "legacy_inv_item_id", "item_label", "amount", "method", "paid_at"],
     "update": ["invoice_id", "legacy_invoice_id", "legacy_inv_item_id", "item_label", "amount", "method", "paid_at"]},
    # quotation items re-synced by quotation_items_sql()
    {"key": "quotation", "label": "Quotations", "legacy": "webxl_quotations", "modern": "quotations",
     "entity": "quotation", "tf": "tf_quotation", "new_id": "gen_random_uuid()",
     "insert": ["customer_id", "account_holder", "company", "email", "contact", "delivery_time", "gst_percent",
                "discount_type", "discount_value", "sub_amount", "gst_amount", "total_amount", "grand_total",
                "payment_term_percent", "save_status", "note", "dollar_rate", "created_by", "created_at", "updated_at",
                "hod_status", "hod_comment", "quotation_type", "amount"],
     "update": ["customer_id", "account_holder", "company", "email", "contact", "delivery_time", "gst_percent",
                "discount_type", "discount_value", "sub_amount", "gst_amount", "total_amount", "grand_total",
                "payment_term_percent", "save_status", "note", "dollar_rate", "created_by", "hod_status", "hod_comment",
                "quotation_type", "amount"], "touch_updated_at": True},
]


def generic_sql(run: str, m: dict) -> str:
    """Insert new old rows and 3-way update changed ones for one generic module. Values are
    compared and stored as jsonb (typed), so numbers/booleans/jsonb columns round-trip."""
    k, lt, mt, ent, tf = m["key"], m["legacy"], m["modern"], m["entity"], m["tf"]
    ins_cols = m["insert"]
    upd = ", ".join(_ql(c) for c in m["update"]) or "NULL"
    col_list = ", ".join(ins_cols)
    sel = ", ".join(f"r.{c}" for c in ins_cols)
    sets = ",\n         ".join(f"{c} = CASE WHEN u.x ? {_ql(c)} THEN r.{c} ELSE t.{c} END" for c in m["update"])
    touch = ",\n         updated_at = now()" if m.get("touch_updated_at") else ""
    # same record already in the new app (e.g. attendance of that user/day) -> skip, never duplicate
    exists_upd = "" if not m.get("exists") else f"""UPDATE n_{k} n SET outcome = 'exists'
 WHERE n.outcome IS NULL
   AND EXISTS (SELECT 1 FROM jsonb_populate_record(NULL::drm.{mt}, n.t) r WHERE {m["exists"]});"""
    # unique key inside one import: keep the newest old row
    dedupe_sql = "" if not m.get("dedupe") else f"""UPDATE n_{k} n SET outcome = 'duplicate_in_import'
  FROM (SELECT legacy_pk, row_number() OVER (PARTITION BY {", ".join(f"t->>{_ql(c)}" for c in m["dedupe"])}
                                             ORDER BY length(legacy_pk) DESC, legacy_pk DESC) AS rn
          FROM n_{k} WHERE outcome IS NULL) d
 WHERE n.legacy_pk = d.legacy_pk AND d.rn > 1;"""
    upd_block = "" if not m["update"] else f"""
CREATE TEMP TABLE c_{k} ON COMMIT DROP AS
  SELECT h.legacy_pk, mm.modern_id AS mid,
         migration_meta.{tf}(h.old_row) AS t0, migration_meta.{tf}(to_jsonb(a)) AS t1, to_jsonb(t) AS cur
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.{lt} a ON a._archive_row_id = h.archive_row_id
    JOIN migration_meta.migration_legacy_ids mm
      ON mm.entity_type = {_ql(ent)} AND mm.legacy_table = {_ql(lt)} AND mm.legacy_id = h.legacy_pk
    JOIN drm.{mt} t ON t.id::text = mm.modern_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = {_ql(lt)} AND h.action = 'update';
CREATE TEMP TABLE f_{k} ON COMMIT DROP AS
  SELECT c.mid, c.legacy_pk, f, c.t0->f AS o, c.t1->f AS n, c.cur->f AS cur,
         (c.cur->f) IS NOT DISTINCT FROM (c.t0->f) AS apply
    FROM c_{k} c, unnest(ARRAY[{upd}]) f
   WHERE NOT (c.t0 ? '_reject') AND NOT (c.t1 ? '_reject')
     AND (c.t0->f) IS DISTINCT FROM (c.t1->f)
     AND (c.cur->f) IS DISTINCT FROM (c.t1->f);
WITH u AS (SELECT mid, min(legacy_pk) AS lpk, jsonb_object_agg(f, n) AS x, jsonb_object_agg(f, coalesce(cur, 'null'::jsonb)) AS old
             FROM f_{k} WHERE apply GROUP BY mid),
upd AS (
  UPDATE drm.{mt} t SET
         {sets}{touch}
    FROM u CROSS JOIN LATERAL jsonb_populate_record(NULL::drm.{mt}, u.x) r
   WHERE t.id::text = u.mid
  RETURNING t.id::text AS id)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, old_values, new_values)
SELECT {_ql(run)}::uuid, {_ql(mt)}, u.mid, {_ql(lt)}, u.lpk, 'update', u.old, u.x FROM u WHERE u.mid IN (SELECT id FROM upd);
"""
    report_upd = ("""'changedInArchive', (SELECT count(*) FROM c_{k}),
  'updatedRows', (SELECT count(DISTINCT mid) FROM f_{k} WHERE apply),
  'updatedFields', (SELECT coalesce(json_object_agg(f, n), '{{}}') FROM (SELECT f, count(*) n FROM f_{k} WHERE apply GROUP BY f) x),
  'conflicts', (SELECT count(*) FROM f_{k} WHERE NOT apply),
  'conflictSamples', (SELECT coalesce(json_agg(x), '[]') FROM (
      SELECT legacy_pk AS "legacyId", f AS field, o #>> '{{}}' AS "oldDrm_before", n #>> '{{}}' AS "oldDrm_now", cur #>> '{{}}' AS "newApp"
        FROM f_{k} WHERE NOT apply LIMIT {lim}) x),""".format(k=k, lim=CONFLICT_SAMPLES)) if m["update"] else "'changedInArchive', 0,"
    return f"""
SET lock_timeout = '15s';
SET statement_timeout = '30min';
BEGIN;
CREATE TEMP TABLE n_{k} ON COMMIT DROP AS
  SELECT h.legacy_pk, migration_meta.{tf}(to_jsonb(a)) AS t, ({m["new_id"]}) AS new_id
    FROM migration_meta.import_row_history h
    JOIN legacy_archive.{lt} a ON a._archive_row_id = h.archive_row_id
   WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = {_ql(lt)} AND h.action = 'insert'
     AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids mm
                      WHERE mm.entity_type = {_ql(ent)} AND mm.legacy_table = {_ql(lt)} AND mm.legacy_id = h.legacy_pk);
ALTER TABLE n_{k} ADD COLUMN outcome text;
UPDATE n_{k} SET outcome = 'rejected' WHERE t ? '_reject';
{dedupe_sql}
{exists_upd}
INSERT INTO drm.{mt} (id, {col_list})
SELECT n.new_id, {sel}
  FROM n_{k} n CROSS JOIN LATERAL jsonb_populate_record(NULL::drm.{mt}, n.t) r
 WHERE n.outcome IS NULL;
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT {_ql(ent)}, {_ql(lt)}, legacy_pk, new_id::text, {_ql(mt)} FROM n_{k} WHERE outcome IS NULL;
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action)
SELECT {_ql(run)}::uuid, {_ql(mt)}, new_id::text, {_ql(lt)}, legacy_pk, 'insert' FROM n_{k} WHERE outcome IS NULL;
INSERT INTO migration_meta.migration_rejects (source_table, legacy_id, target_table, rejection_reason, raw_record_reference)
SELECT {_ql(lt)}, legacy_pk, {_ql(mt)}, t->>'_reject', 'incremental:{run}' FROM n_{k} WHERE t ? '_reject';
{upd_block}
SELECT json_build_object(
  'module', {_ql(k)}, 'label', {_ql(m["label"])},
  'newInArchive', (SELECT count(*) FROM n_{k}),
  'inserted', (SELECT count(*) FROM n_{k} WHERE outcome IS NULL),
  'skippedExisting', (SELECT count(*) FROM n_{k} WHERE outcome = 'exists'),
  'skippedDuplicate', (SELECT count(*) FROM n_{k} WHERE outcome = 'duplicate_in_import'),
  'rejected', (SELECT coalesce(json_object_agg(r, c), '{{}}') FROM (SELECT t->>'_reject' r, count(*) c FROM n_{k} WHERE t ? '_reject' GROUP BY 1) x),
  {report_upd}
  'conflictSamplesEnd', NULL
);
COMMIT;
"""


def generic_rollback_sql(run: str, m: dict) -> str:
    k, lt, mt, ent = m["key"], m["legacy"], m["modern"], m["entity"]
    sets = ",\n         ".join(f"{c} = CASE WHEN r.x ? {_ql(c)} THEN p.{c} ELSE t.{c} END" for c in m["update"])
    restore = "" if not m["update"] else f"""
CREATE TEMP TABLE gu_{k} ON COMMIT DROP AS
  SELECT h.id AS hid, h.modern_id, f.key AS f, f.value AS oldv, h.new_values->f.key AS newv
    FROM migration_meta.import_modern_history h, jsonb_each(h.old_values) f
   WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = {_ql(mt)} AND h.action = 'update' AND h.old_values IS NOT NULL;
CREATE TEMP TABLE gg_{k} ON COMMIT DROP AS
  SELECT modern_id, f, (array_agg(oldv ORDER BY hid))[1] AS oldv, (array_agg(newv ORDER BY hid DESC))[1] AS newv
    FROM gu_{k} GROUP BY modern_id, f;
CREATE TEMP TABLE gr_{k} ON COMMIT DROP AS
  SELECT g.* FROM gg_{k} g JOIN drm.{mt} t ON t.id::text = g.modern_id
   WHERE (to_jsonb(t)->g.f) IS NOT DISTINCT FROM g.newv;
WITH r AS (SELECT modern_id, jsonb_object_agg(f, oldv) AS x FROM gr_{k} GROUP BY modern_id),
upd AS (
  UPDATE drm.{mt} t SET
         {sets}
    FROM r CROSS JOIN LATERAL jsonb_populate_record(NULL::drm.{mt}, r.x) p
   WHERE t.id::text = r.modern_id
  RETURNING 1)
SELECT json_build_object('table', {_ql(mt)}, 'restoredRows', (SELECT count(*) FROM upd),
                         'keptNewerEdits', (SELECT count(*) FROM gg_{k}) - (SELECT count(*) FROM gr_{k}));
"""
    return f"""
SET lock_timeout = '15s';
BEGIN;
{restore}
WITH ins AS (
  SELECT modern_id, legacy_id FROM migration_meta.import_modern_history
   WHERE run_id = {_ql(run)}::uuid AND modern_table = {_ql(mt)} AND action = 'insert'),
d AS (DELETE FROM drm.{mt} t USING ins WHERE t.id::text = ins.modern_id RETURNING 1),
dm AS (DELETE FROM migration_meta.migration_legacy_ids mm USING ins
        WHERE mm.entity_type = {_ql(ent)} AND mm.legacy_table = {_ql(lt)}
          AND mm.legacy_id = ins.legacy_id AND mm.modern_id = ins.modern_id RETURNING 1)
SELECT json_build_object('table', {_ql(mt)}, 'removedRows', (SELECT count(*) FROM d), 'unmapped', (SELECT count(*) FROM dm));
COMMIT;
"""


def invoice_items_sql(run: str) -> str:
    """invoices.items is built from webxl_invoice_item rows: rebuild it for every invoice whose items
    this import added/changed. "Before" = the item rows as they were before this import."""
    return f"""
SET lock_timeout = '15s';
BEGIN;
CREATE TEMP TABLE ii ON COMMIT DROP AS
  SELECT DISTINCT inv FROM (
    SELECT a.invoice_id AS inv FROM migration_meta.import_row_history h
      JOIN legacy_archive.webxl_invoice_item a ON a._archive_row_id = h.archive_row_id
     WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_invoice_item'
    UNION
    SELECT h.old_row->>'invoice_id' FROM migration_meta.import_row_history h
     WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_invoice_item' AND h.action = 'update') x
   WHERE inv IS NOT NULL;
CREATE TEMP TABLE ib ON COMMIT DROP AS
  SELECT ii.inv, v.id::text AS mid, v.items AS cur,
         migration_meta.mig_inv_items(ii.inv) AS t1,
         migration_meta.mig_inv_items_from((
           SELECT jsonb_agg(z.r) FROM (
             SELECT coalesce(h.old_row, to_jsonb(a)) AS r
               FROM legacy_archive.webxl_invoice_item a
               LEFT JOIN migration_meta.import_row_history h
                 ON h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_invoice_item' AND h.archive_row_id = a._archive_row_id
              WHERE a._source_table = 'webxl_invoice_item' AND (h.action IS NULL OR h.action = 'update')) z
            WHERE z.r->>'invoice_id' = ii.inv)) AS t0
    FROM ii
    JOIN migration_meta.migration_legacy_ids mm
      ON mm.entity_type = 'invoice' AND mm.legacy_table = 'webxl_invoice' AND mm.legacy_id = ii.inv
    JOIN drm.invoices v ON v.id::text = mm.modern_id;
WITH upd AS (
  UPDATE drm.invoices v SET items = ib.t1, updated_at = now()
    FROM ib WHERE v.id::text = ib.mid AND ib.cur IS NOT DISTINCT FROM ib.t0 AND ib.t0 IS DISTINCT FROM ib.t1
  RETURNING v.id::text AS id, ib.inv, ib.cur, ib.t1)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, old_values, new_values)
SELECT {_ql(run)}::uuid, 'invoices', id, 'webxl_invoice_item', inv, 'update',
       jsonb_build_object('items', cur), jsonb_build_object('items', t1) FROM upd;
SELECT json_build_object('module', 'invoiceItems', 'label', 'Invoice items',
  'invoicesAffected', (SELECT count(*) FROM ib),
  'updatedRows', (SELECT count(*) FROM ib WHERE cur IS NOT DISTINCT FROM t0 AND t0 IS DISTINCT FROM t1),
  'conflicts', (SELECT count(*) FROM ib WHERE cur IS DISTINCT FROM t0 AND cur IS DISTINCT FROM t1),
  'conflictSamples', (SELECT coalesce(json_agg(json_build_object('legacyId', inv, 'field', 'items',
        'oldDrm_before', left(t0, 120), 'oldDrm_now', left(t1, 120), 'newApp', left(cur, 120))), '[]')
     FROM (SELECT * FROM ib WHERE cur IS DISTINCT FROM t0 AND cur IS DISTINCT FROM t1 LIMIT {CONFLICT_SAMPLES}) x));
COMMIT;
"""


def quotation_items_sql(run: str) -> str:
    """drm.quotation_items (no legacy ids): for quotations this import added, or whose
    webxl_quotation_items it changed, replace the item set when it still equals the set built
    from the item rows before this import (otherwise: conflict, new-app items kept)."""
    return f"""
SET lock_timeout = '15s';
BEGIN;
CREATE TEMP TABLE qa ON COMMIT DROP AS
  SELECT DISTINCT q FROM (
    SELECT a.quo_id AS q FROM migration_meta.import_row_history h
      JOIN legacy_archive.webxl_quotation_items a ON a._archive_row_id = h.archive_row_id
     WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_quotation_items'
    UNION
    SELECT h.old_row->>'quo_id' FROM migration_meta.import_row_history h
     WHERE h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_quotation_items' AND h.action = 'update'
    UNION
    SELECT legacy_id FROM migration_meta.import_modern_history
     WHERE run_id = {_ql(run)}::uuid AND modern_table = 'quotations' AND action = 'insert') x
   WHERE q IS NOT NULL;
CREATE TEMP TABLE qb ON COMMIT DROP AS
  SELECT qa.q, mm.modern_id::uuid AS qid,
         migration_meta.quotation_items_set(mm.modern_id::uuid) AS cur,
         migration_meta.tf_quotation_items((SELECT jsonb_agg(to_jsonb(a)) FROM legacy_archive.webxl_quotation_items a
                                             WHERE a._source_table = 'webxl_quotation_items' AND a.quo_id = qa.q)) AS t1,
         migration_meta.tf_quotation_items((
           SELECT jsonb_agg(z.r) FROM (
             SELECT coalesce(h.old_row, to_jsonb(a)) AS r
               FROM legacy_archive.webxl_quotation_items a
               LEFT JOIN migration_meta.import_row_history h
                 ON h.run_id = {_ql(run)}::uuid AND h.table_name = 'webxl_quotation_items' AND h.archive_row_id = a._archive_row_id
              WHERE a._source_table = 'webxl_quotation_items' AND (h.action IS NULL OR h.action = 'update')) z
            WHERE z.r->>'quo_id' = qa.q)) AS t0
    FROM qa
    JOIN migration_meta.migration_legacy_ids mm
      ON mm.entity_type = 'quotation' AND mm.legacy_table = 'webxl_quotations' AND mm.legacy_id = qa.q;
CREATE TEMP TABLE qapply ON COMMIT DROP AS
  SELECT * FROM qb WHERE (cur = t0 OR cur = '[]'::jsonb AND EXISTS (
            SELECT 1 FROM migration_meta.import_modern_history h WHERE h.run_id = {_ql(run)}::uuid
               AND h.modern_table = 'quotations' AND h.action = 'insert' AND h.modern_id = qb.qid::text))
                     AND cur IS DISTINCT FROM t1;
-- old item rows: keep a full copy in the history, then remove
WITH old AS (SELECT i.* FROM drm.quotation_items i JOIN qapply p ON p.qid = i.quotation_id)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action, old_values, new_values)
SELECT {_ql(run)}::uuid, 'quotation_items', old.id::text, 'webxl_quotation_items', p.q, 'update', to_jsonb(old), '{{"_deleted": true}}'::jsonb
  FROM old JOIN qapply p ON p.qid = old.quotation_id;
DELETE FROM drm.quotation_items i USING qapply p WHERE i.quotation_id = p.qid;
WITH ins AS (
  INSERT INTO drm.quotation_items (quotation_id, product_id, detail, min_time, max_time, unit_price, quantity,
                                   item_total, start_year, end_year, domain_url, ab_discount)
  SELECT p.qid, r.product_id, r.detail, r.min_time, r.max_time, r.unit_price, r.quantity, r.item_total,
         r.start_year, r.end_year, r.domain_url, r.ab_discount
    FROM qapply p CROSS JOIN LATERAL jsonb_array_elements(p.t1) e
    CROSS JOIN LATERAL jsonb_populate_record(NULL::drm.quotation_items, e) r
  RETURNING id, quotation_id)
INSERT INTO migration_meta.import_modern_history (run_id, modern_table, modern_id, legacy_table, legacy_id, action)
SELECT {_ql(run)}::uuid, 'quotation_items', ins.id::text, 'webxl_quotation_items', p.q, 'insert'
  FROM ins JOIN qapply p ON p.qid = ins.quotation_id;
SELECT json_build_object('module', 'quotationItems', 'label', 'Quotation items',
  'quotationsAffected', (SELECT count(*) FROM qb),
  'updatedRows', (SELECT count(*) FROM qapply),
  'conflicts', (SELECT count(*) FROM qb WHERE cur IS DISTINCT FROM t0 AND cur IS DISTINCT FROM t1
                   AND qid NOT IN (SELECT qid FROM qapply)),
  'conflictSamples', (SELECT coalesce(json_agg(json_build_object('legacyId', q, 'field', 'items',
        'oldDrm_before', left(t0::text, 120), 'oldDrm_now', left(t1::text, 120), 'newApp', left(cur::text, 120))), '[]')
     FROM (SELECT * FROM qb WHERE cur IS DISTINCT FROM t0 AND cur IS DISTINCT FROM t1
              AND qid NOT IN (SELECT qid FROM qapply) LIMIT {CONFLICT_SAMPLES}) x));
COMMIT;
"""


def quotation_items_rollback_sql(run: str) -> str:
    return f"""
SET lock_timeout = '15s';
BEGIN;
WITH d AS (
  DELETE FROM drm.quotation_items i USING migration_meta.import_modern_history h
   WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = 'quotation_items' AND h.action = 'insert' AND i.id::text = h.modern_id
  RETURNING 1),
r AS (
  INSERT INTO drm.quotation_items
  SELECT (jsonb_populate_record(NULL::drm.quotation_items, h.old_values)).*
    FROM migration_meta.import_modern_history h
   WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = 'quotation_items' AND h.action = 'update'
     AND h.new_values ? '_deleted'
     AND EXISTS (SELECT 1 FROM drm.quotations q WHERE q.id = (h.old_values->>'quotation_id')::uuid)
  RETURNING 1)
SELECT json_build_object('table', 'quotation_items', 'removedRows', (SELECT count(*) FROM d), 'restoredRows', (SELECT count(*) FROM r));
COMMIT;
"""


def rollback_sql(run: str, modern_table: str) -> str:
    """Undo one table: delete rows the import inserted; put back each updated field whose
    current value is still the one the import wrote (newer new-app edits are kept)."""
    sfx = modern_table
    legacy = {"customers": ("customer", "webxl_company"), "follow_ups": ("followup", "webxl_followup")}[modern_table]
    return f"""
SET lock_timeout = '15s';
BEGIN;
CREATE TEMP TABLE hu_{sfx} ON COMMIT DROP AS
  SELECT h.id AS hid, h.modern_id, f.key AS f, f.value AS oldv, h.new_values->f.key AS newv
    FROM migration_meta.import_modern_history h, jsonb_each(h.old_values) f
   WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = {_ql(modern_table)} AND h.action = 'update'
     AND h.old_values IS NOT NULL;
-- per field: the value before this import's first change, and the value its last change wrote.
-- Restore only where the row still holds that last value (compared as text: jsonb keeps
-- booleans/numbers typed in to_jsonb(row) but as strings in the history).
CREATE TEMP TABLE hg_{sfx} ON COMMIT DROP AS
  SELECT modern_id, f, (array_agg(oldv ORDER BY hid))[1] AS oldv, (array_agg(newv ORDER BY hid DESC))[1] AS newv
    FROM hu_{sfx} GROUP BY modern_id, f;
CREATE TEMP TABLE hr_{sfx} ON COMMIT DROP AS
  SELECT hg_{sfx}.* FROM hg_{sfx} JOIN drm.{modern_table} m ON m.id::text = hg_{sfx}.modern_id
   WHERE (to_jsonb(m)->>hg_{sfx}.f) IS NOT DISTINCT FROM (hg_{sfx}.newv #>> '{{}}');
WITH r AS (SELECT modern_id, jsonb_object_agg(f, oldv #>> '{{}}') AS x FROM hr_{sfx} GROUP BY modern_id),
upd AS (
  UPDATE drm.{modern_table} m
     SET (SELECT_COLUMNS_PLACEHOLDER)
    FROM r WHERE m.id::text = r.modern_id
  RETURNING 1)
SELECT json_build_object('table', {_ql(modern_table)}, 'restoredRows', (SELECT count(*) FROM upd),
                         'keptNewerEdits', (SELECT count(*) FROM hg_{sfx}) - (SELECT count(*) FROM hr_{sfx}));
-- mappings of last-follow-up rows this import added (their archive rows go with the archive rollback)
DELETE FROM migration_meta.migration_legacy_ids mm
 USING migration_meta.import_row_history h
 WHERE {_ql(modern_table)} = 'customers' AND h.run_id = {_ql(run)}::uuid
   AND h.table_name = 'webxl_last_followup' AND h.action = 'insert'
   AND mm.entity_type = 'last_followup_snapshot' AND mm.legacy_table = 'webxl_last_followup' AND mm.legacy_id = h.legacy_pk;
-- unlink new-app customers that an import linked to an old company
DELETE FROM migration_meta.migration_legacy_ids mm
 USING migration_meta.import_modern_history h
 WHERE h.run_id = {_ql(run)}::uuid AND h.modern_table = {_ql(modern_table)} AND h.action = 'update'
   AND h.new_values ? '_linked'
   AND mm.legacy_table = h.legacy_table AND mm.legacy_id = h.legacy_id AND mm.modern_id = h.modern_id::text;
WITH ins AS (
  SELECT modern_id, legacy_id FROM migration_meta.import_modern_history
   WHERE run_id = {_ql(run)}::uuid AND modern_table = {_ql(modern_table)} AND action = 'insert'),
d AS (DELETE FROM drm.{modern_table} m USING ins WHERE m.id::text = ins.modern_id RETURNING m.id),
dm AS (DELETE FROM migration_meta.migration_legacy_ids mm USING ins
        WHERE mm.entity_type = {_ql(legacy[0])} AND mm.legacy_table = {_ql(legacy[1])}
          AND mm.legacy_id = ins.legacy_id AND mm.modern_id = ins.modern_id::text RETURNING 1)
SELECT json_build_object('table', {_ql(modern_table)}, 'removedRows', (SELECT count(*) FROM d), 'unmapped', (SELECT count(*) FROM dm));
COMMIT;
"""


def _set_clause(fields: dict[str, str], extra: dict[str, str]) -> str:
    allf = {**fields, **extra}
    return ",\n         ".join(
        f"{f} = CASE WHEN r.x ? {_ql(f)} THEN (r.x->>{_ql(f)})::{c} ELSE m.{f} END" for f, c in allf.items()
    ) + ",\n         updated_at = now()"


def run_sync(run: str, psql_file: Callable[[str], str], progress: Callable[[str], None], work: Path) -> list[dict]:
    out = []
    for label, sql in (("customers", customers_sql(run)), ("last follow-ups", last_followup_sql(run)),
                       ("follow-ups", followups_sql(run)), ("private pool", pool_sql(run))):
        progress(f"Updating new system: {label}")
        out.append(_last_json(psql_file(_write(work, f"sync_{label.replace(' ', '_')}.sql", sql))))
    for m in GENERIC_MODULES:
        progress(f"Updating new system: {m['label']}")
        out.append(_last_json(psql_file(_write(work, f"sync_{m['key']}.sql", generic_sql(run, m)))))
    for label, sql in (("invoice items", invoice_items_sql(run)), ("quotation items", quotation_items_sql(run))):
        progress(f"Updating new system: {label}")
        out.append(_last_json(psql_file(_write(work, f"sync_{label.replace(' ', '_')}.sql", sql))))
    return out


def run_rollback(run: str, psql_file: Callable[[str], str], progress: Callable[[str], None], work: Path) -> list[dict]:
    res = []
    progress("Rolling back new system: quotation items")
    res.append(_last_json(psql_file(_write(work, "rb_quotation_items.sql", quotation_items_rollback_sql(run)))))
    for m in reversed(GENERIC_MODULES):
        progress(f"Rolling back new system: {m['label']}")
        lines = [json.loads(l) for l in psql_file(_write(work, f"rb_{m['key']}.sql", generic_rollback_sql(run, m))).splitlines() if l.startswith("{")]
        merged = {}
        for l in lines:
            merged.update(l)
        res.append(merged)
    extra_c = {"owner_user_id": "uuid", "pool_type": "drm.pool_type", "last_followup_date": "timestamp", "comment": "text"}
    for table, fields, extra in (("follow_ups", FOLLOWUP_FIELDS, {}), ("customers", CUSTOMER_FIELDS, extra_c)):
        progress(f"Rolling back new system: {table}")
        sql = rollback_sql(run, table).replace("SET (SELECT_COLUMNS_PLACEHOLDER)", "SET " + _set_clause(fields, extra))
        lines = [json.loads(l) for l in psql_file(_write(work, f"rb_{table}.sql", sql)).splitlines() if l.startswith("{")]
        merged = {}
        for l in lines:
            merged.update(l)
        res.append(merged)
    return res


def _write(work: Path, name: str, sql: str) -> str:
    p = work / name
    p.write_text(sql, encoding="utf-8")
    return str(p)


def _last_json(text: str) -> dict:
    lines = [l for l in text.splitlines() if l.startswith("{")]
    return json.loads(lines[-1]) if lines else {}
