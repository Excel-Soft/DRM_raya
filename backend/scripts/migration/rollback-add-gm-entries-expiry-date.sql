-- Undo add-gm-entries-expiry-date.sql (drops the added column).
ALTER TABLE drm.gm_entries DROP COLUMN IF EXISTS expiry_date;
