import { pool } from "../server/db";

async function main() {
    console.log("Mapping data to talha...");

    try {
        const userEmail = "talhaexcelstech@gmail.com";
        const emailRes = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
        if (!emailRes.rows.length) {
            console.log("No user found with email!");
            process.exit(1);
        }
        const talhaId = emailRes.rows[0].id;
        console.log("Talha ID:", talhaId);

        await pool.query("UPDATE projects SET owner_user_id = $1, created_by = $1", [talhaId]);
        await pool.query("UPDATE tasks SET owner_user_id = $1, created_by = $1, assigned_to_user_id = $1, assigned_to = $1", [talhaId]);

        console.log("Successfully mapped tasks to Talha!");
    } catch (err) {
        console.error("SQL Error:", err);
    }

    process.exit(0);
}
main();
