import { pool } from '../db.js';

async function checkOldInstallments() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
      SELECT 
        id, 
        company_name, 
        installments, 
        is_partial_payment,
        created_at 
      FROM gm_entries 
      WHERE is_partial_payment = true 
      ORDER BY created_at DESC 
      LIMIT 20
    `);

        console.log(`Found ${result.rowCount} entries with is_partial_payment = true\n`);

        for (const row of result.rows) {
            console.log(`ID: ${row.id}`);
            console.log(`Company: ${row.company_name}`);
            console.log(`Created: ${row.created_at}`);
            console.log(`Installments: ${row.installments || 'NULL'}`);
            console.log('---');
        }
    } finally {
        client.release();
        process.exit(0);
    }
}

checkOldInstallments();
