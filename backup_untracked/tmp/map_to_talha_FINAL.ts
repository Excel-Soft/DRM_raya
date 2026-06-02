import { pool } from "../server/db";

async function main() {
    console.log("Adding talha to users...");

    try {
        const talhaId = "9ea6656a-bed3-4549-b60d-cba847c1c5ab";
        const email = "talhaexcelstech@gmail.com";
        await pool.query("INSERT INTO users (id, email, full_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING", [talhaId, email, "Talha", "admin", "mock_hash"]);
        console.log("Talha added/verified in DB!");

        await pool.query("UPDATE projects SET owner_user_id = $1, created_by = $1", [talhaId]);
        await pool.query("UPDATE tasks SET owner_user_id = $1, created_by = $1, assigned_to_user_id = $1, assigned_to = $1", [talhaId]);

        console.log("Successfully mapped tasks to Talha!");
    } catch (err) {
        console.error("SQL Error:", err);
    }

    process.exit(0);
}
main();
