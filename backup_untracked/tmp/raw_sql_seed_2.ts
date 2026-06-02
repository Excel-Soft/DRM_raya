import { pool } from "../server/db";

async function main() {
    console.log("Adding mock data via raw SQL...");

    try {
        const userEmail = "talhaexcelstech@gmail.com";
        const emailRes = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
        const userId = emailRes.rows[0]?.id || "9ea6656a-bed3-4549-b60d-cba847c1c5ab"; // Talha's ID shown before

        console.log("Using user ID:", userId);

        const projectRes = await pool.query(
            "INSERT INTO projects (name, description, status, created_by, owner_user_id, workspace) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            ["My First Project", "Test Description", "Active", userId, userId, "Development"]
        );
        const projectId = projectRes.rows[0].id;
        console.log("Created Project ID:", projectId);

        await pool.query(
            "INSERT INTO tasks (project_id, title, description, status, priority, created_by, owner_user_id, assigned_to_user_id, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [projectId, "Kickoff meeting", "Discuss goals", "ToDo", "High", userId, userId, userId, "Work"]
        );

        await pool.query(
            "INSERT INTO tasks (project_id, title, description, status, priority, created_by, owner_user_id, assigned_to_user_id, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [projectId, "Database setup", "Set up PostgreSQL", "In Progress", "High", userId, userId, userId, "Work"]
        );

        await pool.query(
            "INSERT INTO tasks (project_id, title, description, status, priority, created_by, owner_user_id, assigned_to_user_id, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [projectId, "UI Design", "Create Figma mockups", "Blocked", "Medium", userId, userId, userId, "Work"]
        );

        await pool.query(
            "INSERT INTO tasks (project_id, title, description, status, priority, created_by, owner_user_id, assigned_to_user_id, category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            [projectId, "Backend API", "Create Express server", "Completed", "High", userId, userId, userId, "Work"]
        );

        console.log("Successfully inserted tasks!");
    } catch (err) {
        console.error("SQL Error:", err);
    }

    process.exit(0);
}
main();
