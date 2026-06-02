const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'gm_entries' 
      AND (column_name = 'alibaba_discount_usd' OR column_name = 'extra_discount_usd')
    `);
    console.log('Columns found:', res.rows);
    
    // Also check if the table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'gm_entries'
      )
    `);
    console.log('Table gm_entries exists:', tableCheck.rows[0].exists);

  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
