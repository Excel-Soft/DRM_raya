BEGIN;
DROP FUNCTION IF EXISTS migration_meta.quotation_items_set(uuid);
DROP FUNCTION IF EXISTS migration_meta.tf_quotation_items(jsonb);
DROP FUNCTION IF EXISTS migration_meta.mig_safeint(text);
DROP FUNCTION IF EXISTS migration_meta.mig_qmoney(text, text);
DROP FUNCTION IF EXISTS migration_meta.mig_inv_items_from(jsonb);
COMMIT;
