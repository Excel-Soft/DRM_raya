import { pool } from "./server/db";
pool.query("SELECT i.id, i.customer_name, i.status FROM drm.invoices i WHERE i.status = 'Sent'").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
