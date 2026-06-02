import { pool } from "../server/db";

async function checkRealProjects() {
    try {
        const projectsRes = await pool.query("SELECT * FROM projects");
        console.log("Real Projects:");
        console.table(projectsRes.rows);

        const tasksRes = await pool.query("SELECT * FROM tasks");
        console.log("Real Tasks:");
        console.table(tasksRes.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRealProjects();
