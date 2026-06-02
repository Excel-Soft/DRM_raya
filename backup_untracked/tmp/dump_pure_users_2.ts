import { pool } from "../server/db";

async function main() {
    const res = await pool.query("SELECT * FROM users");
    console.log("Users:", res.rows);
    process.exit(0);
}
main();
