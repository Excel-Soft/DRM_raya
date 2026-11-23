-- Link Report: additive per-link verdict columns on product_posting_evidence_links,
-- plus the confirmed_at column / Pending default on link_report_commission_verifications.
-- Same statements as ensure.ts (ensureLinkReport... block); applied by hand because
-- the server runs with SKIP_SCHEMA_ENSURE=true. Idempotent, additive only.
BEGIN;
ALTER TABLE drm.product_posting_evidence_links ADD COLUMN IF NOT EXISTS verify_status text NOT NULL DEFAULT 'Pending';
ALTER TABLE drm.product_posting_evidence_links ADD COLUMN IF NOT EXISTS verify_note text;
ALTER TABLE drm.product_posting_evidence_links ADD COLUMN IF NOT EXISTS verified_by_user_id uuid REFERENCES drm.users(id);
ALTER TABLE drm.product_posting_evidence_links ADD COLUMN IF NOT EXISTS verified_at timestamp;
CREATE SEQUENCE IF NOT EXISTS drm.product_posting_evidence_links_display_id_seq;
ALTER TABLE drm.product_posting_evidence_links ADD COLUMN IF NOT EXISTS display_id integer NOT NULL DEFAULT nextval('drm.product_posting_evidence_links_display_id_seq');
ALTER SEQUENCE drm.product_posting_evidence_links_display_id_seq OWNED BY drm.product_posting_evidence_links.display_id;
ALTER TABLE drm.link_report_commission_verifications ADD COLUMN IF NOT EXISTS confirmed_at timestamp;
ALTER TABLE drm.link_report_commission_verifications ALTER COLUMN status SET DEFAULT 'Pending';
COMMIT;
