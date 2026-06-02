import { pool } from "./server/db";
pool.query(`
SELECT 'office_vas' as source, id, vas_date as date FROM drm.office_vas WHERE created_by_user_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)
UNION ALL
SELECT 'ppi' as source, id, created_at as date FROM drm.product_posting_invoices WHERE sales_exec_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)
UNION ALL
SELECT 'invoice' as source, id, created_at as date FROM drm.invoices WHERE created_by_user_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)
`).then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
