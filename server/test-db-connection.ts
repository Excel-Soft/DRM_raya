import { pool } from "./db";

async function run() {
    console.log("Testing DB connection...");
    try {
        const res = await pool.query("select count(*) from password_reset_otps");
        console.log("DB count:", res.rows[0]);
    } catch (error) {
        console.error("DB error:", error);
    }
}

run();
