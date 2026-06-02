
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

    try {
        console.log("Attempting to insert a todo with an empty string in participants...");
        const values = [
            userId,
            "Malformed Task",
            "General",
            "This should fail if participants are not cleaned",
            "MEDIUM",
            "NONE",
            "same_day",
            "2026-03-06",
            null,
            [""], // Empty string in UUID array
            "ASSIGNED"
        ];

        const sql = `
        insert into drm.todo_tasks
          (created_by_user_id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        returning id
      `;

        await pool.query(sql, values);
        process.exit(0);
    } catch (err) {
        console.error("Caught expected error:");
        console.error(err.message);
        process.exit(1);
    }
}

main();
