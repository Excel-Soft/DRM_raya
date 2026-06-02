import { pool } from "./server/db";
pool.query("SELECT items FROM drm.invoices WHERE invoice_number = 'INV-00221'").then(r => console.log(r.rows[0].items)).catch(console.error).finally(() => process.exit());
