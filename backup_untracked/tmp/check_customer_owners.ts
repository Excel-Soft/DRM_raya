import { pool } from "../server/db";

async function run() {
    const res = await pool.query(
        `SELECT c.id, c.company_name, c.owner_user_id, c.created_by, op.owner_id as op_owner_id, c.pool_type
     FROM customers c
     LEFT JOIN opportunities op on op.customer_id = c.id
     ORDER BY c.created_at DESC
     LIMIT 5`
    );
    console.table(res.rows);

    const res2 = await pool.query(`SELECT id, name, username, role_id, role, roles FROM users ORDER BY created_at DESC LIMIT 5`);
    console.table(res2.rows);

    process.exit(0);
}
run();
