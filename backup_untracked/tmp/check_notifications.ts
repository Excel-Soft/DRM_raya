import { pool } from "../server/db";

async function checkNotificationsTable() {
    const client = await pool.connect();
    try {
        console.log("Checking notifications table...");
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'notifications'
        `);
        console.log("Columns:", res.rows);

        const schemaRes = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'notifications'
        `);
        console.log("Schemas:", schemaRes.rows);
    } catch (err) {
        console.error("Error checking notifications table:", err);
    } finally {
        client.release();
    }
}

checkNotificationsTable();
