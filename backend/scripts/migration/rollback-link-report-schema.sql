-- Undo ensure-link-report-schema.sql (drops only the added columns; the sequence is owned by display_id).
BEGIN;
ALTER TABLE drm.product_posting_evidence_links
  DROP COLUMN IF EXISTS display_id,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS verified_by_user_id,
  DROP COLUMN IF EXISTS verify_note,
  DROP COLUMN IF EXISTS verify_status;
ALTER TABLE drm.link_report_commission_verifications DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE drm.link_report_commission_verifications ALTER COLUMN status SET DEFAULT 'VERIFIED';
COMMIT;
