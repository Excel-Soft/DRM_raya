-- Rollback for add-dollar-pay-ab-confirm-overrides.sql
-- WARNING: drops any Ab Payment Status updates saved from the new Dollar Pay page.
BEGIN;
DROP TABLE IF EXISTS drm.dollar_pay_ab_confirm_overrides;
COMMIT;
