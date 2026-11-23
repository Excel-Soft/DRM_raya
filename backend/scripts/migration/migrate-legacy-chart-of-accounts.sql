-- Office Account -> Chart of Accounts + Office Expense heads, from the old DRM.
--
-- 1) Chart of Accounts: the 4 legacy COA levels -> drm.account_heads (one tree via
--    parent_account_id, which is what chart-of-accounts.tsx renders):
--      webxl_coa_parent_heads            (5)   level 1  Assets / Liabilities / ...
--      webxl_coa_child_heads             (17)  level 2  Current Assets / Administrative Expenses / ...
--      webxl_coa_transactional_heads     (69)  level 3
--      webxl_coa_sub_transactional_heads (124) level 4  (heads expenses are booked on)
--    code = legacy account_code; category from the parent's account_type; type = a value
--    from the page's ACCOUNT_TYPES list chosen from the level-2 head name and inherited
--    by its descendants; normal_balance Debit for Assets/Expenses else Credit.
--    Mojibake "â€™" in names is repaired to "’".
--
-- 2) Office expenses (15,388, already copied with placeholder heads "Head <n>"):
--    the old system changed head lists in 2025 -
--      create_date >= 2025-01-01 : phead_id = COA sub-transactional head
--                                  -> expense_head = that account_heads.id (so the
--                                  head filters and "code - name" display work)
--      before 2025               : phead_id / head_id = old webxl_expenses_head tree
--                                  -> expense_head = "<parent> / <child>" name text
--    Only rows still holding the placeholder are updated.
--
-- Idempotent (mapping rows / placeholder check). Rollback: rollback-legacy-chart-of-accounts.sql
BEGIN;

CREATE TEMP TABLE _coa ON COMMIT DROP AS
WITH p AS (
  SELECT 'webxl_coa_parent_heads'::text AS legacy_table, ph.id AS legacy_id, 1 AS lvl,
         btrim(ph.account_code) AS code, ph.head_name AS raw_name, ph.description, ph.is_active, ph.created_by, ph.created_at,
         CASE ph.account_type WHEN 'Asset' THEN 'Assets' WHEN 'Liability' THEN 'Liabilities' WHEN 'Equity' THEN 'OwnerEquity'
                              WHEN 'Revenue' THEN 'Revenue' ELSE 'Expenses' END AS category,
         NULL::text AS parent_legacy_table, NULL::text AS parent_legacy_id, ph.id AS root_id, NULL::text AS child_name
  FROM legacy_archive.webxl_coa_parent_heads ph
),
c AS (
  SELECT 'webxl_coa_child_heads'::text AS legacy_table, ch.id AS legacy_id, 2 AS lvl, btrim(ch.account_code) AS code,
         ch.head_name AS raw_name, ch.description, ch.is_active, ch.created_by, ch.created_at,
         p.category, 'webxl_coa_parent_heads'::text AS parent_legacy_table, ch.parent_id AS parent_legacy_id,
         ch.parent_id AS root_id, ch.head_name AS child_name
  FROM legacy_archive.webxl_coa_child_heads ch JOIN p ON p.legacy_id = ch.parent_id
),
t AS (
  SELECT 'webxl_coa_transactional_heads'::text AS legacy_table, th.id AS legacy_id, 3 AS lvl, btrim(th.account_code) AS code,
         th.head_name AS raw_name, th.description, th.is_active, th.created_by, th.created_at,
         c.category, 'webxl_coa_child_heads'::text AS parent_legacy_table, th.child_id AS parent_legacy_id,
         c.root_id, c.child_name
  FROM legacy_archive.webxl_coa_transactional_heads th JOIN c ON c.legacy_id = th.child_id
),
s AS (
  SELECT 'webxl_coa_sub_transactional_heads'::text AS legacy_table, sh.id AS legacy_id, 4 AS lvl, btrim(sh.account_code) AS code,
         sh.head_name AS raw_name, sh.description, sh.is_active, sh.created_by, sh.created_at,
         t.category, 'webxl_coa_transactional_heads'::text AS parent_legacy_table, sh.transactional_id AS parent_legacy_id,
         t.root_id, t.child_name
  FROM legacy_archive.webxl_coa_sub_transactional_heads sh JOIN t ON t.legacy_id = sh.transactional_id
)
SELECT x.*, gen_random_uuid()::text AS new_id,
       btrim(replace(replace(replace(x.raw_name, 'â€™', '’'), 'â€“', '–'), 'â€œ', '“')) AS name,
       CASE
         WHEN x.category = 'Assets' THEN CASE WHEN x.child_name ILIKE '%non-current%' THEN 'Fixed Asset' ELSE 'Current Asset' END
         WHEN x.category = 'Liabilities' THEN CASE WHEN x.child_name ILIKE '%non-current%' THEN 'Long-term Liability' ELSE 'Current Liability' END
         WHEN x.category = 'OwnerEquity' THEN 'Capital'
         WHEN x.category = 'Revenue' THEN 'Operating Revenue'
         ELSE CASE WHEN x.child_name ILIKE '%administrative%' THEN 'Administrative Expense'
                   WHEN x.child_name ILIKE '%financial%' THEN 'Financial Expense'
                   ELSE 'Operating Expense' END
       END AS acc_type
FROM (SELECT * FROM p UNION ALL SELECT * FROM c UNION ALL SELECT * FROM t UNION ALL SELECT * FROM s) x
WHERE NOT EXISTS (SELECT 1 FROM migration_meta.migration_legacy_ids m
                  WHERE m.entity_type = 'account_head' AND m.legacy_table = x.legacy_table AND m.legacy_id = x.legacy_id)
  AND NOT EXISTS (SELECT 1 FROM drm.account_heads a WHERE a.code = btrim(x.code));

-- insert level by level so parent ids resolve
INSERT INTO drm.account_heads (id, code, name, category, type, description, parent_account_id, opening_balance,
                               normal_balance, is_active, created_by_user_id, created_at, updated_at)
SELECT n.new_id, n.code, n.name, n.category::drm.account_head_category, n.acc_type, NULLIF(btrim(n.description), ''),
       COALESCE(pn.new_id, pm.modern_id), 0,
       CASE WHEN n.category IN ('Assets', 'Expenses') THEN 'Debit' ELSE 'Credit' END,
       CASE WHEN n.is_active = '0' THEN 0 ELSE 1 END,
       (SELECT um.modern_id::uuid FROM migration_meta.migration_legacy_ids um
         WHERE um.entity_type = 'user' AND um.legacy_table = 'webxl_user' AND um.legacy_id = n.created_by LIMIT 1),
       COALESCE(n.created_at::timestamp, now()), COALESCE(n.created_at::timestamp, now())
FROM _coa n
LEFT JOIN _coa pn ON pn.legacy_table = n.parent_legacy_table AND pn.legacy_id = n.parent_legacy_id
LEFT JOIN migration_meta.migration_legacy_ids pm
       ON pm.entity_type = 'account_head' AND pm.legacy_table = n.parent_legacy_table AND pm.legacy_id = n.parent_legacy_id
ORDER BY n.lvl, n.code;

INSERT INTO migration_meta.migration_legacy_ids (entity_type, legacy_table, legacy_id, modern_id, modern_table)
SELECT 'account_head', legacy_table, legacy_id, new_id, 'account_heads' FROM _coa
ON CONFLICT DO NOTHING;

-- 2) expense heads
UPDATE drm.office_expenses o
SET expense_head = COALESCE(
      CASE
        WHEN e.create_date >= '2025-01-01' THEN
          (SELECT am.modern_id FROM migration_meta.migration_legacy_ids am
            WHERE am.entity_type = 'account_head' AND am.legacy_table = 'webxl_coa_sub_transactional_heads'
              AND am.legacy_id = e.phead_id)
        ELSE
          NULLIF(concat_ws(' / ',
            NULLIF(btrim(ph."expenName"), ''),
            CASE WHEN e.head_id <> '0' THEN NULLIF(btrim(ch."expenName"), '') END), '')
      END,
      o.expense_head)
FROM migration_meta.migration_legacy_ids m
JOIN legacy_archive.webxl_expense e ON e.id = m.legacy_id
LEFT JOIN legacy_archive.webxl_expenses_head ph ON ph.head_id = e.phead_id
LEFT JOIN legacy_archive.webxl_expenses_head ch ON ch.head_id = e.head_id
WHERE m.entity_type = 'expense_row' AND m.legacy_table = 'webxl_expense'
  AND m.modern_id = o.id
  AND o.expense_head ~ '^Head [0-9]+$';

COMMIT;
