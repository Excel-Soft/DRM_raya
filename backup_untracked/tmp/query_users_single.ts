import pg from "pg";
import { config } from "dotenv";
config();

async function run() {
    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    const res = await client.query("SELECT id, email, role, roles FROM drm.users");
    console.table(res.rows);
    await client.end();
}
run();
