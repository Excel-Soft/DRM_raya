import { pool } from "./server/db";
pool.query("SELECT id FROM drm.users WHERE full_name = 'Haider' LIMIT 1").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
