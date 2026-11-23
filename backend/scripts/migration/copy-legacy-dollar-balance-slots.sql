-- Copy old-DRM dollar balance slots (webxl_dollar_buyer_dollars with show_ab='Show' and
-- a remaining dollars <> 0 — the old Balance tab / Pay Alibaba "short" list) into
-- drm.dollar_buying so they can be picked and spent in the new Pay Alibaba flow.
-- Only the REMAINING balance is copied (dollar_amount = remaining_usd = old dollars);
-- paid_pkr = pkr_amount so they never show as buyer payables. Each row is mapped in
-- migration_meta.migration_legacy_ids (modern_table 'dollar_buying'); aggregate queries
-- that already count old buys from the archive exclude mapped rows.
-- legacy_archive is not modified. Rollback: copy-legacy-dollar-balance-slots.rollback.sql
BEGIN;
WITH src AS (
  SELECT d._legacy_pk AS legacy_id,
         u.name AS buyer_name,
         COALESCE(NULLIF(btrim(b.buyer_from), ''), d.buyer_reference) AS buyer_reference,
         NULLIF(d.buyer_reference_paypal_email, '') AS paypal_email,
         NULLIF(d.buyer_account_no, '') AS account_no,
         NULLIF(d.cheque_id, '') AS cheque_id,
         NULLIF(d.payment_method, '') AS payment_method,
         NULLIF(d.type, '') AS type,
         substring(replace(d.dollars, ',', '') from '-?[0-9]+(?:[.][0-9]+)?')::numeric AS remaining,
         substring(replace(d.dollar_rate, ',', '') from '-?[0-9]+(?:[.][0-9]+)?')::numeric AS rate,
         NULLIF(left(d.buy_date, 10), '')::date AS buy_date,
         concat_ws(' — ', NULLIF(d.detail, ''), 'Old DRM balance slot #' || d._legacy_pk) AS detail
    FROM legacy_archive.webxl_dollar_buyer_dollars d
    LEFT JOIN legacy_archive.webxl_user u ON u._source_table = 'webxl_user' AND u._legacy_pk = d.buyer_main
    LEFT JOIN legacy_archive.webxl_dollar_buyer b ON b._source_table = 'webxl_dollar_buyer' AND b._legacy_pk = d.buyer_reference
   WHERE btrim(d.show_ab) = 'Show'
     AND COALESCE(substring(replace(d.dollars, ',', '') from '-?[0-9]+(?:[.][0-9]+)?')::numeric, 0) <> 0
     AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                      WHERE m.entity_type = 'dollar_buying' AND m.legacy_table = 'webxl_dollar_buyer_dollars'
                        AND m.legacy_id = d._legacy_pk)
), ins AS (
  INSERT INTO drm.dollar_buying (
    buyer_name, buyer_reference, paypal_email, account_no, cheque_id, payment_method, type,
    dollar_amount, dollar_rate, pkr_amount, date, detail, martini, balance_status,
    is_confirmed, confirmed_at, remaining_usd, paid_pkr, pay_status, created_at, updated_at)
  SELECT buyer_name, buyer_reference, paypal_email, account_no, cheque_id, payment_method, type,
         remaining, rate, round(remaining * rate, 2), buy_date, detail, 'Show', 'Show',
         true, buy_date, remaining, round(remaining * rate, 2), 'Paid', buy_date, now()
    FROM src
  RETURNING id, detail
)
INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'dollar_buying', 'webxl_dollar_buyer_dollars', substring(detail from 'Old DRM balance slot #([0-9]+)'), id, 'dollar_buying'
  FROM ins;
COMMIT;
