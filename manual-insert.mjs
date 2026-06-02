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
        const userId = '9ea6656a-bed3-4549-b60d-cba847c1c5ab'; // Admin user
        const res = await pool.query(`
            INSERT INTO drm.product_posting_invoices (amount, project_name, company_name, sales_exec_id, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, ['1000', 'Manual Test Project', 'Manual Test Company', userId, 'PENDING_HOD']);
        console.log('Inserted invoice ID:', res.rows[0].id);
        await pool.end();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
