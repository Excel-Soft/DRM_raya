
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, "utf-8");
    for (const line of contents.split("\n")) {
        const [key, ...rest] = line.split("=");
        if (key && rest.length > 0) {
            process.env[key.trim()] = rest.join("=").trim().replace(/^'|^"|"$|'$/g, "");
        }
    }
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const userId = "512a8be4-e78c-4f7d-afbb-8c6740007ba5"; // admin@example.com
    const participantId = "9ea6656a-bed3-4549-b60d-cba847c1c5ab"; // talha

    try {
        console.log("Attempting to insert a test todo...");
        const values = [
            userId,
            "Manual Test Task",
            "General",
            "Testing from script",
            "MEDIUM",
            "NONE",
            "same_day",
            "2026-03-06",
            null,
            [participantId],
            "ASSIGNED"
        ];

        const sql = `
        insert into drm.todo_tasks
          (created_by_user_id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id
      `;

        const result = await pool.query(sql, values);
        console.log("Success! Created ID:", result.rows[0].id);
        process.exit(0);
    } catch (err) {
        console.error("Full Error Output:");
        console.error(err);
        process.exit(1);
    }
}

main();
