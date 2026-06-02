
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    console.log('Dropping old drm.office_vas...');
    await client.query('DROP TABLE IF EXISTS drm.office_vas CASCADE');
    
    console.log('Creating new drm.office_vas...');
    await client.query(`
      CREATE TABLE drm.office_vas (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        company_name text NOT NULL,
        amount decimal(12, 2) NOT NULL,
        currency text NOT NULL DEFAULT 'PKR',
        method text NOT NULL,
        vas_date timestamp NOT NULL DEFAULT now(),
        notes text,
        created_by_user_id varchar NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    
    console.log('Successfully recreated drm.office_vas');
    
    console.log('Inserting dummy VAS record...');
    await client.query(`
      INSERT INTO drm.office_vas (company_name, amount, currency, method, vas_date, notes, created_by_user_id)
      VALUES ($1, $2, $3, $4, NOW(), $5, $6)
    `, ['Global Solutions VAS', '1500.00', 'PKR', 'Cash', 'Seed data for report view', 'b29868ad-e13c-4aed-8c70-444639c3bfaf']);
    
    console.log('Successfully seeded VAS record.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
