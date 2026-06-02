
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
    try {
        const { rows } = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'todo_tasks'
    `);
        console.log("Tables found named 'todo_tasks':");
        console.log(JSON.stringify(rows, null, 2));

        for (const row of rows) {
            const countRes = await pool.query(`SELECT count(*)::int as count FROM ${row.table_schema}.${row.table_name}`);
            console.log(`Count in ${row.table_schema}.${row.table_name}: ${countRes.rows[0].count}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
