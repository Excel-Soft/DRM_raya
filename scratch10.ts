import { pool } from "./server/db";
pool.query("SELECT full_name FROM drm.users WHERE id = '9ea6656a-bed3-4549-b60d-cba847c1c5ab'").then(r => console.log(r.rows)).catch(console.error).finally(() => process.exit());
