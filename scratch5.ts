import { pool } from "./server/db";
pool.query("SELECT full_name FROM drm.users WHERE id = '52d42bc6-be6f-4cce-81bc-132ce0c18f68'").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
