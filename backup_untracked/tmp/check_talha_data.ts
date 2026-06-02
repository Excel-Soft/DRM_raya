import { pool } from "../server/db";

async function run() {
    try {
        const res = await pool.query("select id from users where email = 'talhaexcelstech@gmail.com'");
        const userId = res.rows[0]?.id;
        console.log("User ID:", userId);

        if (userId) {
            const custRes = await pool.query("select count(*) from customers where (owner_user_id = $1 or created_by = $2) and coalesce(is_deleted, false) = false", [userId, userId]);
            console.log("Customer Count for Talha (Owned/Created):", custRes.rows[0]?.count);

            const projectsRes = await pool.query("select count(*) from projects where owner_user_id = $1 or created_by = $2", [userId, userId]);
            console.log("Projects for Talha:", projectsRes.rows[0]?.count);

            const tasksRes = await pool.query("select count(*) from tasks where owner_user_id = $1 or assigned_to_user_id = $2 or created_by = $3", [userId, userId, userId]);
            console.log("Tasks for Talha:", tasksRes.rows[0]?.count);
        }

        const allCustRes = await pool.query("select id, company_name, pool_type, owner_user_id, created_by from customers limit 10");
        console.log("Customer Details:", allCustRes.rows);

        const allProjCount = await pool.query("select count(*) from projects");
        console.log("Total Projects Count:", allProjCount.rows[0]?.count);

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
