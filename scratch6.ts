import { pool } from "./server/db";
pool.query("SELECT id, invoice_number, status, created_at, created_by_user_id FROM drm.invoices WHERE created_by_user_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
