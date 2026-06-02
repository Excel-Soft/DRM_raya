import { pool } from "./server/db";
pool.query("UPDATE drm.invoices SET payment_method = 'Online Payment' WHERE invoice_number = 'INV-00221'").then(r => console.log('Updated method!')).catch(console.error).finally(() => process.exit());
