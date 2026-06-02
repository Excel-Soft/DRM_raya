import { pool } from "../server/db";

async function run() {
    const q = await pool.query("SELECT * FROM public.attributes WHERE category='Job Designation'");
    console.log("Job Designations from public.attributes:");
    console.table(q.rows);
    process.exit();
}

run();
