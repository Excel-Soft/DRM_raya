import { pool } from "./server/db";
pool.query("SELECT id, invoice_number, status, created_at, updated_at, created_by_user_id FROM drm.invoices ORDER BY created_at DESC LIMIT 5").then(r => console.log("Recent Invoices:", r.rows)).catch(console.error);

pool.query("SELECT id, status, created_at, updated_at, sales_exec_id FROM drm.product_posting_invoices ORDER BY created_at DESC LIMIT 5").then(r => console.log("Recent Product Posting Invoices:", r.rows)).catch(console.error).finally(() => setTimeout(() => process.exit(), 1000));
