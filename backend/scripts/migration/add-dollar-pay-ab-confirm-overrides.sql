-- Dollar Pay page (/account/dollar-pay): "Ab Payment Status" updates for partial
-- payments (old func.php `dollar_pay_ab_gm_id2_partial`).
--
-- The old handler UPDATEd webxl_verify_gm_delay_amount.ab_confirm_status/
-- ab_confirm_detail/ab_confirm_date/ab_confirm_by. Those rows now live READ-ONLY in
-- legacy_archive.webxl_verify_gm_delay_amount, so updates made from the new app are
-- stored here and overlaid on the archive values when the page reads them.
--
-- ADDITIVE ONLY. Rollback: add-dollar-pay-ab-confirm-overrides.rollback.sql
BEGIN;

CREATE TABLE IF NOT EXISTS drm.dollar_pay_ab_confirm_overrides (
  legacy_delay_id      text PRIMARY KEY,           -- webxl_verify_gm_delay_amount.id
  legacy_gm_id         text NOT NULL,              -- webxl_verify_gm_delay_amount.gmid
  ab_confirm_status    text NOT NULL CHECK (ab_confirm_status IN ('paid', 'refund', 'processing')),
  ab_confirm_date      date,
  ab_confirm_detail    text,
  ab_confirm_by        uuid,                       -- drm.users.id of the updater
  ab_confirm_by_name   text,
  archive_status       text,                       -- archive ab_confirm_status at first override
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dollar_pay_ab_confirm_overrides_gm_idx
  ON drm.dollar_pay_ab_confirm_overrides (legacy_gm_id);

COMMIT;
