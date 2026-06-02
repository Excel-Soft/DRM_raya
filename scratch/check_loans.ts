import { pool } from "../server/db";

async function check() {
    try {
        const res = await pool.query(
            `select lr.*, u.full_name
               from drm.loan_requests lr
               left join users u on u.id = lr.user_id
              limit 5`
          );
        console.log(res.rows);
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

check();
