-- Item lists that hang off a parent row (not row-by-row copies), for the incremental old-DRM
-- import (scripts/migration/incremental/sync_modern.py):
--   mig_inv_items_from(rows)   invoice.items text from any set of webxl_invoice_item rows
--                              (same output as mig_inv_items(invoice_id), which reads the archive)
--                              -> lets the sync rebuild an invoice's items "before" an import
--   tf_quotation_items(rows)   drm.quotation_items rows for a quotation (run-quotations-transform.mjs)
--   quotation_items_set(id)    current drm.quotation_items of a quotation in the same shape
-- Rollback: create-sync-items-functions.rollback.sql
BEGIN;

CREATE OR REPLACE FUNCTION migration_meta.mig_inv_items_from(rows jsonb) RETURNS text
LANGUAGE sql STABLE AS $$
  WITH it AS (
    SELECT i.item, i.detail, i.id,
           CASE WHEN i.unit_price IS NULL OR i.unit_price = '' THEN 0 ELSE
             (SELECT CASE WHEN n = n AND abs(n) <> 'Infinity'::float8 THEN n ELSE 0 END
                FROM migration_meta.mig_jsnum(replace(i.unit_price, ',', '')) n) END AS unit,
           CASE WHEN i.qty IS NULL OR i.qty = '' THEN 0 ELSE
             (SELECT CASE WHEN n = n AND abs(n) <> 'Infinity'::float8 THEN n ELSE 0 END
                FROM migration_meta.mig_jsnum(replace(i.qty, ',', '')) n) END AS qtyn,
           CASE WHEN i.pkr IS NULL OR i.pkr = '' THEN 0 ELSE
             (SELECT CASE WHEN n = n AND abs(n) <> 'Infinity'::float8 THEN n ELSE 0 END
                FROM migration_meta.mig_jsnum(replace(i.pkr, ',', '')) n) END AS pkrn
      FROM jsonb_to_recordset(coalesce(rows, '[]'::jsonb))
           AS i(item text, detail text, id text, unit_price text, qty text, pkr text)
  ), q AS (
    SELECT it.*, greatest(1, trunc(CASE WHEN qtyn = 0 THEN 1 ELSE qtyn END))::float8 AS qn FROM it
  )
  SELECT coalesce(
    '[' || string_agg(
      '{"name":' || to_json(left(coalesce(item, 'Item'), 500))::text
      || ',"description":' || to_json(CASE WHEN coalesce(detail, '') <> '' THEN left(detail, 4000) ELSE '' END)::text
      || ',"unitPrice":' || migration_meta.mig_jsnum_json(unit)
      || ',"quantity":' || migration_meta.mig_jsnum_json(qn)
      || ',"total":' || migration_meta.mig_jsnum_json(CASE WHEN pkrn <> 0 THEN pkrn ELSE unit * qn END)
      || '}', ',' ORDER BY id::bigint) || ']',
    '[]')
  FROM q
$$;

-- money(v, fb): '' / NULL -> fb; strip commas, trim; must look like -?\d+(\.\d+)?
CREATE OR REPLACE FUNCTION migration_meta.mig_qmoney(v text, fb text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v IS NULL OR v = '' THEN fb
              WHEN migration_meta.mig_trim(replace(v, ',', '')) ~ '^-?\d+(\.\d+)?$'
                THEN migration_meta.mig_trim(replace(v, ',', ''))
              ELSE fb END
$$;

-- safeInt(v): '' / NULL -> NULL; Math.trunc(Number(trim(v))); non-finite or outside int4 -> NULL
-- (the original INSERT into an int4 column would have failed on such a value)
CREATE OR REPLACE FUNCTION migration_meta.mig_safeint(v text) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v IS NULL OR v = '' THEN NULL ELSE
    (SELECT CASE WHEN n = n AND abs(n) <> 'Infinity'::float8 AND abs(trunc(n)) <= 2147483647 THEN trunc(n)::integer END
       FROM migration_meta.mig_jsnum(coalesce(migration_meta.mig_trim(v), '')) n) END
$$;

-- rows: jsonb array of webxl_quotation_items rows (to_jsonb), any order -> sorted jsonb array
CREATE OR REPLACE FUNCTION migration_meta.tf_quotation_items(rows jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(o ORDER BY o::text), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'product_id', left(coalesce(r->>'item', r->>'id'), 200),
      'detail', migration_meta.mig_trim(r->>'detail'),
      'min_time', migration_meta.mig_safeint(r->>'min_day'),
      'max_time', migration_meta.mig_safeint(r->>'max_day'),
      -- unit_price / ab_discount columns keep 2 decimals (0.125 was stored as 0.13)
      'unit_price', round(migration_meta.mig_qmoney(r->>'unit_price', '0')::numeric, 2),
      'quantity', greatest(1, coalesce(migration_meta.mig_safeint(r->>'qty'), 1)),
      'item_total', round(migration_meta.mig_qmoney(r->>'unit_price', '0')::numeric
                          * greatest(1, coalesce(migration_meta.mig_safeint(r->>'qty'), 1)), 2),
      'start_year', migration_meta.mig_safeint(r->>'from_year'),
      'end_year', migration_meta.mig_safeint(r->>'to_year'),
      'domain_url', migration_meta.mig_trim(r->>'domain'),
      'ab_discount', round(migration_meta.mig_qmoney(r->>'ab_discount', '0')::numeric, 2)
    ) AS o
    FROM jsonb_array_elements(coalesce(rows, '[]'::jsonb)) r) x
$$;

CREATE OR REPLACE FUNCTION migration_meta.quotation_items_set(q uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(o ORDER BY o::text), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('product_id', product_id, 'detail', detail, 'min_time', min_time, 'max_time', max_time,
             'unit_price', unit_price, 'quantity', quantity, 'item_total', item_total, 'start_year', start_year,
             'end_year', end_year, 'domain_url', domain_url, 'ab_discount', ab_discount) AS o
      FROM drm.quotation_items WHERE quotation_id = q) x
$$;

COMMIT;
