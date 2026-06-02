
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
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

        for (const row of rows) {
            try {
                const countRes = await pool.query(`SELECT count(*)::int as count FROM public."${row.table_name}"`);
                console.log(`public.${row.table_name}: ${countRes.rows[0].count}`);
            } catch (e) {
                console.log(`public.${row.table_name}: [skipped/error: ${e.message}]`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
