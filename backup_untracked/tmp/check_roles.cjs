const pg = require('pg');
require('dotenv').config();

async function checkRoles() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const roles = await pool.query('SELECT name FROM drm.roles');
        console.log('ROLES TABLE:', roles.rows.map(r => r.name));
        
        const attrs = await pool.query("SELECT name FROM drm.attributes WHERE category = 'Job Designation'");
        console.log('JOB DESIGNATIONS:', attrs.rows.map(r => r.name));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkRoles();
