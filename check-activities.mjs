import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        console.log('\n--- Checking Table Locations ---');
        const tablesRes = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'project_activities'
        `);
        console.table(tablesRes.rows);

        console.log('\n--- Checking search_path ---');
        const pathRes = await pool.query('SHOW search_path');
        console.log('search_path:', pathRes.rows[0].search_path);

        const checkTables = [
            'drm.activities',
            'drm.tasks',
            'drm.projects',
            'drm.appointments',
            'drm.customers',
            'drm.activity_logs'
        ];

        console.log('\n--- Counts ---');
        for (const t of checkTables) {
            try {
                const res = await pool.query(`SELECT count(*) FROM ${t}`);
                console.log(`${t} count:`, res.rows[0].count);
            } catch (e) {
                console.log(`${t} check failed:`, e.message);
            }
        }

        console.log('\n--- Columns of ai_cloud_crm.activities ---');
        try {
            const cols = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'ai_cloud_crm' AND table_name = 'activities'
            `);
            console.table(cols.rows);
        } catch (e) {
            console.log('Column check failed:', e.message);
        }

        console.log('\n--- Project Statuses ---');
        try {
            const projects = await pool.query('SELECT name, status FROM drm.projects');
            console.table(projects.rows);
        } catch (e) {
            console.log('Project status check failed:', e.message);
        }

        await pool.end();
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
