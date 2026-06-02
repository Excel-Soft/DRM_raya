import { pool } from "../server/db";

async function run() {
    try {
        const res = await pool.query("select id from users where email = 'talhaexcelstech@gmail.com'");
        const userId = res.rows[0]?.id;
        console.log("Mapping all data to User ID:", userId);

        if (!userId) {
            console.error("User not found!");
            process.exit(1);
        }

        // 1. Map Customers
        const custRes = await pool.query("update customers set owner_user_id = $1, updated_at = now()", [userId]);
        console.log("Updated customers:", custRes.rowCount);

        // 2. Map Projects
        const projRes = await pool.query("update projects set owner_user_id = $1, updated_at = now()", [userId]);
        console.log("Updated projects:", projRes.rowCount);

        // 3. Map Tasks
        const taskRes = await pool.query("update tasks set owner_user_id = $1, assigned_to_user_id = $1, updated_at = now()", [userId]);
        console.log("Updated tasks:", taskRes.rowCount);

        // 4. Map Donations (if column exists)
        try {
            const donRes = await pool.query("update donations set created_by_user_id = $1", [userId]);
            console.log("Updated donations:", donRes.rowCount);
        } catch (e) {
            console.log("Donations update skipped (maybe missing created_by_user_id)");
        }

        // 5. Map Invoices
        try {
            const invRes = await pool.query("update invoices set created_by_user_id = $1", [userId]);
            console.log("Updated invoices:", invRes.rowCount);
        } catch (e) {
            console.log("Invoices update skipped (maybe missing created_by_user_id)");
        }

        // 6. Map GM Pool Entries
        try {
            const gmRes = await pool.query("update gm_entries set created_by_user_id = $1", [userId]);
            console.log("Updated gm_entries:", gmRes.rowCount);
        } catch (e) {
            console.log("gm_entries update skipped");
        }

        console.log("Data mapping completed!");

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
