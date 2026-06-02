import { pool } from "./server/db";
pool.query("SELECT id, invoice_number, status, created_at, updated_at, created_by_user_id FROM drm.invoices WHERE created_by_user_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)").then(r => console.log("Standard Invoices:", r.rows)).catch(console.error);

pool.query("SELECT id, status, created_at, updated_at, sales_exec_id FROM drm.product_posting_invoices WHERE sales_exec_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1)").then(r => console.log("Product Posting Invoices:", r.rows)).catch(console.error).finally(() => setTimeout(() => process.exit(), 1000));
