import { pool } from "../server/db";

async function check() {
    try {
        const res = await pool.query(
            `select lr.user_id, u.full_name, r.name as role_name
               from drm.loan_requests lr
               left join drm.users u on u.id::text = lr.user_id::text
               left join drm.roles r on r.id::text = u.role_id::text`
          );
        console.log(res.rows);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

check();
