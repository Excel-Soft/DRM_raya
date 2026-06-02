import { pool } from '../server/db'; 
async function run() { 
    try {
        const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff";
        const tableId = userId.replace(/-/g, '_');
        const tableName = `sales_${tableId}`;
        const query = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'drm' AND table_name = '${tableName}') as exists;`;
        const res = await pool.query(query); 
        console.log("Table exists:", res.rows[0].exists);
        if (res.rows[0].exists) {
            const count = await pool.query(`SELECT count(*) FROM drm.${tableName}`);
            console.log("Count in table:", count.rows[0].count);
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0); 
} 
run();
