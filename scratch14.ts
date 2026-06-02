import { pool } from "./server/db";
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' AND table_schema = 'drm'").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
