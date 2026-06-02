
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(
      `INSERT INTO drm.office_vas (company_name, amount, currency, method, vas_date, notes, created_by_user_id)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
      ['Global Solutions VAS', '1500.00', 'PKR', 'Cash', 'Seed data for report view', 'b29868ad-e13c-4aed-8c70-444639c3bfaf']
    );
    console.log('Successfully inserted dummy VAS record');
  } catch (err) {
    console.error('Error during insertion:', err);
  } finally {
    await client.end();
  }
}

main();
