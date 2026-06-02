import { pool } from "../server/db";

async function main() {
    console.log("Fixing missing DB columns...");

    const fixes = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}'",
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS notes text",
        "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes text",
    ];

    for (const sql of fixes) {
        try {
            await pool.query(sql);
            console.log("OK:", sql.substring(0, 60));
        } catch (err: any) {
            console.log("SKIP:", sql.substring(0, 60), "->", err.message);
        }
    }

    // Verify user exists and has correct data
    const usersRes = await pool.query("SELECT id, email, role, roles FROM users");
    console.log("\nUsers in DB:", usersRes.rows);

    // Verify projects/tasks
    const projRes = await pool.query("SELECT id, name, owner_user_id, created_by FROM projects");
    console.log("\nProjects:", projRes.rows);

    const taskRes = await pool.query("SELECT id, title, status, owner_user_id, created_by, assigned_to_user_id FROM tasks");
    console.log("\nTasks:", taskRes.rows);

    process.exit(0);
}
main();
