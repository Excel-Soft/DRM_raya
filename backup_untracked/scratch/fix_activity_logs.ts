import { pool } from '../server/db';

async function run() {
    try {
        console.log("Making activity_logs.user_id nullable in the database...");
        await pool.query(`ALTER TABLE drm.activity_logs ALTER COLUMN user_id DROP NOT NULL;`);
        console.log("Done! user_id is now nullable.");
    } catch(e: any) {
        if (e.message?.includes('already nullable')) {
            console.log("Column is already nullable, nothing to do.");
        } else {
            console.error("Error:", e.message);
        }
    }
    process.exit(0);
}
run();
