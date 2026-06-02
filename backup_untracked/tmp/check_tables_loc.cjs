const { pool } = require('../server/db');

async function checkTables() {
    try {
        const res = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('activities', 'appointments', 'customers', 'users')
    `);
        console.log('Tables found:', JSON.stringify(res.rows, null, 2));

        const pathRes = await pool.query('SHOW search_path');
        console.log('Current search_path:', pathRes.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkTables();
