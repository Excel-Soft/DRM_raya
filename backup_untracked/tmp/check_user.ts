import { pool } from '../server/db';
async function run() {
    try {
        const res = await pool.query("SELECT id, name, username, roles, role_id FROM users WHERE id = '512a8be4-e78c-4f7d-afbb-8c6740007ba5'");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
