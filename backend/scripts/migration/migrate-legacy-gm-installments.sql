-- Account -> Create GM: LOAN / Partial GM installments from the old DRM.
-- Old DRM kept each installment of a Delay (loan) / Installment (partial) GM in
-- webxl_verify_gm_delay_amount (2,797 rows): what was due (delay_dollars, delay_pkr,
-- pay_date, cheque_no) and, once collected, what came in (current_pkr,
-- current_dollar_pay, current_dollar_rate, current_pay_date, cash_status) with
-- acc_status = Paid / Recoverd (Pending = not collected yet).
-- New app: schedule = gm_entries.installments (jsonb rows
-- {dollar, pkr, dollarRate, chequeNo, payDate, createdAt}); collections =
-- drm.gm_partial_receipts. Both were empty for old entries, so the "0" badge and the
-- receipts / installments dialog showed nothing.
--  1) gm_partial_receipts.screenshot_url (ensure.ts additive column, never applied here;
--     the receipts endpoint selects it)
--  2) installments  : one row per old delay row (ordered by due date) - only for migrated
--                     loan/partial GMs whose schedule is still empty
--  3) receipts      : one per old row with acc_status Paid / Recoverd
--                     (method = cash_status, e.g. Cash Received / Extra Discount Paid)
-- Idempotent (mapping rows). Rollback: rollback-migrate-legacy-gm-installments.sql
BEGIN;

ALTER TABLE drm.gm_partial_receipts ADD COLUMN IF NOT EXISTS screenshot_url text;

CREATE TEMP TABLE _d ON COMMIT DROP AS
SELECT d.id AS legacy_id, g.id::text AS gm_id,
       NULLIF(regexp_replace(coalesce(d.delay_dollars, ''), '[^0-9.]', '', 'g'), '')::numeric AS due_usd,
       NULLIF(regexp_replace(coalesce(d.delay_pkr, ''), '[^0-9.]', '', 'g'), '')::numeric AS due_pkr,
       NULLIF(regexp_replace(coalesce(d.current_dollar_pay, ''), '[^0-9.]', '', 'g'), '')::numeric AS paid_usd,
       NULLIF(regexp_replace(coalesce(d.current_pkr, ''), '[^0-9.]', '', 'g'), '')::numeric AS paid_pkr,
       NULLIF(regexp_replace(coalesce(d.current_dollar_rate, ''), '[^0-9.]', '', 'g'), '')::numeric AS paid_rate,
       CASE WHEN d.pay_date ~ '^\d{4}-\d{2}-\d{2}' AND d.pay_date NOT LIKE '0000%' THEN left(d.pay_date, 10) END AS due_date,
       CASE WHEN d.current_pay_date ~ '^\d{4}-\d{2}-\d{2}' AND d.current_pay_date NOT LIKE '0000%' THEN d.current_pay_date::date END AS paid_date,
       CASE WHEN d.create_at ~ '^\d{4}-\d{2}-\d{2}' AND d.create_at NOT LIKE '0000%' THEN d.create_at::timestamp END AS created_at,
       NULLIF(NULLIF(btrim(d.cheque_no), ''), '0') AS cheque_no,
       NULLIF(btrim(d.cash_status), '') AS cash_status,
       lower(btrim(coalesce(d.acc_status, ''))) AS acc_status,
       NULLIF(btrim(d.recovery_type), '') AS recovery_type,
       d.pay_by
FROM legacy_archive.webxl_verify_gm_delay_amount d
JOIN migration_meta.migration_legacy_ids m
  ON m.entity_type = 'gm_entry' AND m.legacy_table = 'webxl_verify_gm' AND m.legacy_id = d.gmid
JOIN drm.gm_entries g ON g.id::text = m.modern_id;

-- 2) schedule
UPDATE drm.gm_entries g
SET installments = s.rows, updated_at = now()
FROM (
  SELECT gm_id,
         jsonb_agg(jsonb_build_object(
           'dollar', COALESCE(due_usd, 0),
           'pkr', due_pkr,
           'dollarRate', CASE WHEN due_usd > 0 AND due_pkr > 0 THEN round(due_pkr / due_usd, 4) END,
           'chequeNo', cheque_no,
           'payDate', due_date,
           'createdAt', to_char(COALESCE(created_at, now()), 'YYYY-MM-DD"T"HH24:MI:SS'),
           'legacyId', legacy_id
         ) ORDER BY due_date NULLS LAST, legacy_id::int) AS rows
    FROM _d GROUP BY gm_id
) s
WHERE g.id::text = s.gm_id
  AND jsonb_array_length(COALESCE(g.installments, '[]'::jsonb)) = 0;

-- 3) collections
CREATE TEMP TABLE _r ON COMMIT DROP AS
SELECT _d.*, gen_random_uuid()::text AS new_id
FROM _d
WHERE acc_status IN ('paid', 'recoverd')
  AND NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'gm_partial_receipt' AND m.legacy_table = 'webxl_verify_gm_delay_amount'
                    AND m.legacy_id = _d.legacy_id);

INSERT INTO drm.gm_partial_receipts (id, gm_id, amount_usd, amount_pkr, dollar_rate, receipt_date, method, reference, notes, collected_by, created_at)
SELECT r.new_id, r.gm_id,
       COALESCE(r.paid_usd, r.due_usd, 0),
       COALESCE(r.paid_pkr, r.due_pkr),
       r.paid_rate,
       COALESCE(r.paid_date::timestamp, r.due_date::timestamp, r.created_at, now()),
       r.cash_status,
       'Old DRM installment #' || r.legacy_id,
       NULLIF(concat_ws(' · ', r.recovery_type, CASE WHEN r.acc_status = 'recoverd' THEN 'Recovered' END), ''),
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = r.pay_by
           AND EXISTS (SELECT 1 FROM drm.users u WHERE u.id = um.modern_id::uuid) LIMIT 1),
       COALESCE(r.created_at, now())
FROM _r r;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'gm_partial_receipt', 'webxl_verify_gm_delay_amount', legacy_id, new_id, 'gm_partial_receipts' FROM _r;

COMMIT;
