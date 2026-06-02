import { pool } from "./server/db";
pool.query("UPDATE drm.invoices SET created_by_user_id = (SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1) WHERE invoice_number = 'INV-00221'").then(r => console.log('Updated!')).catch(console.error).finally(() => process.exit());
