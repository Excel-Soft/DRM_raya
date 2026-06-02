import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    ssl: { rejectUnauthorized: false }
});

(async () => {
    try {
        const res = await pool.query(`
            SELECT id, project_name, company_name, status, created_at 
            FROM drm.product_posting_invoices 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log('Newest invoices:', res.rows);
        await pool.end();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
