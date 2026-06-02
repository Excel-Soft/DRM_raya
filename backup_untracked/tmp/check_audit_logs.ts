import { pool } from "../server/db";

async function checkTable() {
    try {
        const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'impersonation_audit_logs';
    `);

        console.log("Tables:");
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkTable();
