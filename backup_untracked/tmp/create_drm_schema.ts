import { pool } from "../server/db";

async function main() {
    console.log("Ensuring drm schema exists...");

    try {
        await pool.query("CREATE SCHEMA IF NOT EXISTS drm");
        console.log("OK: CREATE SCHEMA IF NOT EXISTS drm");
    } catch (err: any) {
        console.log("ERROR:", err.message);
    }

    process.exit(0);
}
main();
