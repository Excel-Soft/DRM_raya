-- Undo create-gm-bv-commission-verifications.sql. Refuses if verifications were saved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM drm.gm_bv_commission_verifications) THEN
    RAISE EXCEPTION 'gm_bv_commission_verifications has rows; not dropping';
  END IF;
END $$;
DROP TABLE IF EXISTS drm.gm_bv_commission_verifications;
