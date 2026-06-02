import { pool } from '../server/db';
async function run() {
    try {
        const res = await pool.query("SELECT id, company_name, person_name, owner_user_id, created_by, pool_type FROM customers WHERE company_name ILIKE '%Mosin%' OR person_name ILIKE '%Mosin%'");
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
