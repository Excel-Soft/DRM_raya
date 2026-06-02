import { pool } from "../server/db";

async function checkSchemas() {
    try {
        const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE' 
      AND table_schema IN ('public', 'drm')
      ORDER BY table_schema, table_name;
    `);

        console.log("Tables in DB by Schema:");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkSchemas();
