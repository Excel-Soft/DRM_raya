import { pool } from "../server/db";

async function main() {
    const res = await pool.query("SELECT * FROM projects");
    console.log("Projects:", res.rows);
    const res2 = await pool.query("SELECT * FROM tasks");
    console.log("Tasks:", res2.rows);
    process.exit(0);
}
main();
