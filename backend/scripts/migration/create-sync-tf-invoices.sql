-- SQL ports of the first-migration transforms for the invoices module, used by the incremental
-- old-DRM import (scripts/migration/incremental/sync_modern.py), same contract as tf_company /
-- tf_followup in create-incremental-sync-functions.sql:
--   input  = to_jsonb(legacy_archive.<table> row) (all archive columns are text)
--   output = jsonb {drm column -> value} for every column the original script wrote, except id,
--            or {"_reject": "<reason>"} when the original script rejected the row.
--
--   tf_invoice(row)          = run-invoices-transform.mjs transform()  + run-invoice-items-backfill.mjs (items)
--                              webxl_invoice          -> drm.invoices
--   tf_payment(row)          = run-payments-transform.mjs              webxl_payments         -> drm.ledger_entries
--   tf_invoice_item_pay(row) = run-wave6-batch-transform.mjs invoice_item_pay
--                              webxl_invoice_item_pay -> drm.legacy_invoice_item_payments
--   tf_quotation(row)        = run-quotations-transform.mjs (quotation row only; quotation_items not included)
--                              webxl_quotations       -> drm.quotations
-- Helpers: mig_jsnum (JS Number(string)), mig_money (parseMoney/money of the invoice, payment and
-- quotation scripts), mig_jsnum_json (JSON.stringify of a JS number), mig_inv_items (items JSON text).
-- Additive only (functions). Rollback: create-sync-tf-invoices.rollback.sql
BEGIN;

-- JS Number(String(v)): whitespace-trimmed, '' -> 0, decimal / exponent / Infinity / 0x 0o 0b,
-- anything else -> NaN. NULL input -> NULL (callers decide what null means).
CREATE OR REPLACE FUNCTION migration_meta.mig_jsnum(v text) RETURNS float8
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s text;
  r numeric := 0;
  base int;
  digs text;
  i int;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  s := coalesce(migration_meta.mig_trim(v), '');
  IF s = '' THEN RETURN 0; END IF;
  IF s ~ '^[+-]?(Infinity|([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?)$' THEN
    BEGIN
      RETURN s::float8;
    EXCEPTION WHEN others THEN  -- PG rejects over/underflow; JS gives +-Infinity / +-0
      IF s ~ '[eE]-' THEN RETURN CASE WHEN s LIKE '-%' THEN '-0'::float8 ELSE 0 END; END IF;
      RETURN CASE WHEN s LIKE '-%' THEN '-Infinity'::float8 ELSE 'Infinity'::float8 END;
    END;
  END IF;
  IF s ~ '^0[xX][0-9a-fA-F]+$' THEN base := 16;
  ELSIF s ~ '^0[oO][0-7]+$' THEN base := 8;
  ELSIF s ~ '^0[bB][01]+$' THEN base := 2;
  ELSE RETURN 'NaN'::float8;
  END IF;
  digs := lower(substr(s, 3));
  FOR i IN 1..length(digs) LOOP
    r := r * base + (strpos('0123456789abcdef', substr(digs, i, 1)) - 1);
  END LOOP;
  RETURN r::float8;
END $$;

-- parseMoney(v, fb) / money(v, fb) of run-invoices / run-payments / run-quotations-transform.mjs:
-- String(v).replace(/,/g, "").trim() must match /^-?\d+(\.\d+)?$/ else fallback (text, as sent).
CREATE OR REPLACE FUNCTION migration_meta.mig_money(v text, fb text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(migration_meta.mig_trim(replace(v, ',', '')), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN migration_meta.mig_trim(replace(v, ',', '')) ELSE fb END
$$;

-- JSON.stringify(<JS number>) (shortest round-trip digits; exponent only < 1e-6 or >= 1e21).
CREATE OR REPLACE FUNCTION migration_meta.mig_jsnum_json(x float8) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET extra_float_digits = 1 AS $$
DECLARE
  t text;
  m text[];
  d text;
  n int;
  k int;
  neg boolean;
BEGIN
  IF x IS NULL OR x = 'NaN'::float8 OR x = 'Infinity'::float8 OR x = '-Infinity'::float8 THEN RETURN 'null'; END IF;
  x := x + 0;  -- -0 -> 0
  IF x = 0 THEN RETURN '0'; END IF;
  t := x::text;
  m := regexp_match(t, '^(-?)([0-9]+)(?:\.([0-9]+))?(?:e([+-][0-9]+))?$');
  neg := m[1] = '-';
  d := m[2] || coalesce(m[3], '');
  n := length(m[2]) + coalesce(m[4]::int, 0);      -- value = 0.d * 10^n
  WHILE left(d, 1) = '0' LOOP d := substr(d, 2); n := n - 1; END LOOP;
  d := rtrim(d, '0');
  k := length(d);
  IF k <= n AND n <= 21 THEN t := d || repeat('0', n - k);
  ELSIF 0 < n AND n <= 21 THEN t := left(d, n) || '.' || substr(d, n + 1);
  ELSIF -6 < n AND n <= 0 THEN t := '0.' || repeat('0', -n) || d;
  ELSE
    t := CASE WHEN k = 1 THEN d ELSE left(d, 1) || '.' || substr(d, 2) END
         || 'e' || CASE WHEN n - 1 >= 0 THEN '+' ELSE '-' END || abs(n - 1)::text;
  END IF;
  RETURN CASE WHEN neg THEN '-' || t ELSE t END;
END $$;

-- drm.invoices.items as written by run-invoice-items-backfill.mjs for one legacy invoice id
-- (exact JSON.stringify text; '[]' when the invoice has no webxl_invoice_item rows).
-- NB the script selected i."totalPkr" but read r.totalpkr (undefined), so totalPkr is never used.
CREATE OR REPLACE FUNCTION migration_meta.mig_inv_items(legacy_invoice_id text) RETURNS text
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
      FROM legacy_archive.webxl_invoice_item i
     WHERE i.invoice_id = legacy_invoice_id
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

-- webxl_invoice -> drm.invoices (run-invoices-transform.mjs transform() + items backfill)
CREATE OR REPLACE FUNCTION migration_meta.tf_invoice(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  inv_id text := coalesce(j->>'invoice_id', 'null');           -- String(row.invoice_id)
  created_by uuid;
  cust uuid;
  issue timestamp;
  sub text;
  inv_num text;
  pay float8 := migration_meta.mig_jsnum(coalesce(j->>'pay', '0'));
  tot float8 := migration_meta.mig_jsnum(coalesce(j->>'grand_total', '0'));
  acc text := lower(coalesce(migration_meta.mig_trim(j->>'account'), ''));
BEGIN
  -- userMap.get(String(row.user_id)) ?? userMap.get(String(row.updated_by))  (no trim, no '0' rule)
  SELECT m.modern_id::uuid INTO created_by FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = coalesce(j->>'user_id', 'null') LIMIT 1;
  IF created_by IS NULL THEN
    SELECT m.modern_id::uuid INTO created_by FROM migration_meta.migration_legacy_ids m
     WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = coalesce(j->>'updated_by', 'null') LIMIT 1;
  END IF;
  IF created_by IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;
  IF coalesce(j->>'com_id', '') <> '' THEN
    SELECT m.modern_id::uuid INTO cust FROM migration_meta.migration_legacy_ids m
     WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = j->>'com_id' LIMIT 1;
  END IF;
  issue := migration_meta.mig_ts(j->>'create_date');
  IF issue IS NULL THEN RETURN jsonb_build_object('_reject', 'missing_issue_date'); END IF;
  inv_num := 'LEG-' || lpad(inv_id, greatest(6, length(inv_id)), '0');
  -- original: reject when the number already exists in drm.invoices (other than this row's own invoice)
  IF EXISTS (SELECT 1 FROM drm.invoices x WHERE x.invoice_number = inv_num
              AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                               WHERE m.entity_type = 'invoice' AND m.legacy_table = 'webxl_invoice'
                                 AND m.legacy_id = inv_id AND m.modern_id = x.id)) THEN
    RETURN jsonb_build_object('_reject', 'dup_inv_num');
  END IF;
  sub := migration_meta.mig_money(j->>'sub_total', '0');
  RETURN jsonb_build_object(
    'invoice_number', inv_num,
    'customer_id', cust,
    'customer_name', coalesce(migration_meta.mig_trim(j->>'cname'), 'Company ' || coalesce(j->>'com_id', 'null')),
    'customer_email', migration_meta.mig_trim(j->>'email'),
    'customer_address', migration_meta.mig_trim(j->>'address'),
    'subtotal', sub::numeric(12,2),
    'tax', migration_meta.mig_money(j->>'gst', '0')::numeric(12,2),
    'total', migration_meta.mig_money(j->>'grand_total', sub)::numeric(12,2),
    'currency', 'USD',
    'status', CASE WHEN pay > 0 AND tot > 0 AND pay >= tot * 0.99 THEN 'Paid'
                   WHEN acc LIKE '%cancel%' THEN 'Cancelled'
                   WHEN acc LIKE '%sent%' THEN 'Sent' ELSE 'Draft' END,
    'issue_date', issue,
    'due_date', migration_meta.mig_ts(j->>'update_date'),
    'paid_at', CASE WHEN migration_meta.mig_jsnum(coalesce(j->>'pay', '0')) > 0
                    THEN coalesce(migration_meta.mig_ts(j->>'update_date'), issue) END,
    'notes', migration_meta.mig_trim(j->>'hod_comm'),
    'items', migration_meta.mig_inv_items(j->>'invoice_id'),
    'created_by_user_id', created_by,
    'dollar_rate', migration_meta.mig_money(j->>'doller_rate', '280')::numeric(12,2),
    'created_at', issue,
    'updated_at', issue
  );
END $$;

-- webxl_payments -> drm.ledger_entries (run-payments-transform.mjs)
CREATE OR REPLACE FUNCTION migration_meta.tf_payment(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  amt text := migration_meta.mig_money(j->>'amount', NULL);
  inv text := migration_meta.mig_trim(j->>'invoice_id');
  ref text;
  created_by uuid;
  dt timestamp;
  method text := coalesce(migration_meta.mig_trim(j->>'method'), 'cash');
  receipt text := migration_meta.mig_trim(j->>'receipt_number');
BEGIN
  IF amt IS NULL THEN RETURN jsonb_build_object('_reject', 'invalid_amount'); END IF;
  IF amt::numeric < 0 THEN amt := '0'; END IF;
  IF inv IS NOT NULL THEN
    SELECT m.modern_id, i.created_by_user_id INTO ref, created_by
      FROM migration_meta.migration_legacy_ids m LEFT JOIN drm.invoices i ON i.id = m.modern_id
     WHERE m.entity_type = 'invoice' AND m.legacy_table = 'webxl_invoice' AND m.legacy_id = inv LIMIT 1;
  END IF;
  -- fallbackUser = (SELECT id FROM drm.users ORDER BY created_at LIMIT 1) at migration time; 100 users
  -- share the minimum created_at, the first run picked this one (all 66 migrated fallback rows).
  created_by := coalesce(created_by, '5e27b8fb-b68b-4a2f-beee-50f14197cba3'::uuid);
  -- original: parseTs(create_date) ?? new Date()  (now, Berlin wall clock)
  dt := coalesce(migration_meta.mig_ts(j->>'create_date'), localtimestamp);
  RETURN jsonb_build_object(
    'entry_type', 'Credit',
    'amount', amt::numeric(12,2),
    'currency', 'USD',
    'description', left('Legacy payment' || coalesce(' inv ' || inv, '') || coalesce(' receipt ' || receipt, '')
                        || ' (' || method || ')', 500),
    'category', 'Invoice',
    'date', dt,
    'entry_date', dt,
    'reference_id', ref,
    'reference_type', CASE WHEN ref IS NOT NULL THEN 'invoice' END,
    'created_by_user_id', created_by,
    'status', 'Posted',
    'remarks', 'legacy_payment_id=' || coalesce(j->>'id', 'null'),
    'created_at', dt
  );
END $$;

-- webxl_invoice_item_pay -> drm.legacy_invoice_item_payments (run-wave6-batch-transform.mjs invoice_item_pay)
CREATE OR REPLACE FUNCTION migration_meta.tf_invoice_item_pay(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  inv text;
  pay text := replace(migration_meta.mig_trim(j->>'pay'), ',', '');   -- wave6 money(): trim, then strip commas
BEGIN
  SELECT m.modern_id INTO inv FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'invoice' AND m.legacy_table = 'webxl_invoice'
     AND m.legacy_id = coalesce(j->>'invoice_id', 'null') LIMIT 1;
  IF inv IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_invoice'); END IF;
  RETURN jsonb_build_object(
    'invoice_id', inv::uuid,
    'legacy_invoice_id', migration_meta.mig_trim(j->>'invoice_id'),
    'legacy_inv_item_id', migration_meta.mig_trim(j->>'inv_item_id'),
    'item_label', migration_meta.mig_trim(j->>'item'),
    'amount', (CASE WHEN pay ~ '^-?[0-9]+(\.[0-9]+)?$' THEN pay ELSE '0' END)::numeric(14,2),
    'method', migration_meta.mig_trim(j->>'method'),
    -- timestamptz column: the JS Date (Berlin local time) is an absolute instant
    'paid_at', migration_meta.mig_ts(j->>'create_at') AT TIME ZONE 'Europe/Berlin'
  );
END $$;

-- webxl_quotations -> drm.quotations (run-quotations-transform.mjs; quotation_items are a separate table)
CREATE OR REPLACE FUNCTION migration_meta.tf_quotation(j jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  created_by text;
  cust text;
  sub text := migration_meta.mig_money(j->>'sub_total', '0');
  grand numeric;
  cname text := migration_meta.mig_trim(j->>'cname');
  hod text := migration_meta.mig_trim(j->>'hod_status');
  ts timestamptz;
BEGIN
  SELECT m.modern_id INTO created_by FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'user' AND m.legacy_table = 'webxl_user' AND m.legacy_id = coalesce(j->>'user_id', 'null') LIMIT 1;
  IF created_by IS NULL THEN RETURN jsonb_build_object('_reject', 'unmapped_user'); END IF;
  SELECT m.modern_id INTO cust FROM migration_meta.migration_legacy_ids m
   WHERE m.entity_type = 'customer' AND m.legacy_table = 'webxl_company' AND m.legacy_id = coalesce(j->>'com_id', 'null') LIMIT 1;
  grand := migration_meta.mig_money(j->>'grand_total', sub)::numeric(12,2);
  -- original: parseTs(create_date) ?? new Date(); timestamptz column => absolute instant
  ts := coalesce(migration_meta.mig_ts(j->>'create_date') AT TIME ZONE 'Europe/Berlin', now());
  RETURN jsonb_build_object(
    'customer_id', cust,
    'account_holder', coalesce(cname, 'Account'),
    'company', coalesce(cname, 'Company ' || coalesce(j->>'com_id', 'null')),
    'email', migration_meta.mig_trim(j->>'email'),
    'contact', migration_meta.mig_trim(j->>'phone'),
    'delivery_time', migration_meta.mig_trim(j->>'dliver_time'),
    'gst_percent', 0::numeric(6,2),
    'discount_type', 'AMOUNT',
    'discount_value', migration_meta.mig_money(j->>'discount', '0')::numeric(12,2),
    'sub_amount', sub::numeric(12,2),
    'gst_amount', migration_meta.mig_money(j->>'gst', '0')::numeric(12,2),
    'total_amount', grand,
    'grand_total', grand,
    'payment_term_percent', migration_meta.mig_money(j->>'first_pay', '0')::numeric(6,2),
    'save_status', migration_meta.mig_trim(j->>'quo_save'),
    'note', coalesce(migration_meta.mig_trim(j->>'quo_note'), migration_meta.mig_trim(j->>'quo_title')),
    'dollar_rate', migration_meta.mig_money(j->>'dollar_rate', '280')::numeric(12,2),
    'created_by', created_by,
    'created_at', ts,
    'updated_at', ts,
    'hod_status', CASE WHEN lower(coalesce(hod, '')) LIKE '%approv%' THEN 'approved'
                       WHEN lower(coalesce(hod, '')) LIKE '%reject%' THEN 'rejected' ELSE hod END,
    'hod_comment', migration_meta.mig_trim(j->>'hod_comment'),
    'quotation_type', migration_meta.mig_trim(j->>'quo_type'),
    'amount', grand
  );
END $$;

COMMIT;
