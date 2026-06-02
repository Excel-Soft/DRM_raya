import { pool } from "./server/db";
pool.query("SELECT id, invoice_number, status, created_at, created_by_user_id FROM drm.invoices ORDER BY updated_at DESC LIMIT 5").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
