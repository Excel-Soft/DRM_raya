
import { pool } from "../server/db";

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gm_entries'
      ORDER BY column_name
    `);
        console.log("COLUMNS IN gm_entries:");
        res.rows.forEach(r => console.log(`- ${r.column_name}`));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
checkColumns();
