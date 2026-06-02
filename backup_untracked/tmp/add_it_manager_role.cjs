const pg = require('pg');
require('dotenv').config();

async function addITManager() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Adding IT Manager role...');
        
        await pool.query(`
            INSERT INTO drm.roles (name, description, created_at, updated_at)
            VALUES ('it_manager', 'IT Manager', NOW(), NOW())
            ON CONFLICT (name) DO NOTHING;
        `);
        
        console.log('IT Manager role added successfully.');

    } catch (err) {
        console.error('Error adding IT Manager role:', err.message);
    } finally {
        await pool.end();
    }
}

addITManager();
