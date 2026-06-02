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
            SELECT p.id, p.name, COALESCE(c.company_name, i.company_name) as company_name
            FROM drm.projects p
            LEFT JOIN drm.customers c ON p.customer_id = c.id
            LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
            LIMIT 5
        `);
        console.log('Query result:', res.rows);
        await pool.end();
    } catch (e) {
        console.error('SQL Error:', e);
        process.exit(1);
    }
})();
