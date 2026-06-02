import { pool } from "../server/db";

async function run() {
    const q = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log("Tables in public schema:");
    console.table(q.rows);
    process.exit();
}
run();
