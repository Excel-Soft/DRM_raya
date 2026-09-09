import { Client } from 'pg';
import 'dotenv/config';

async function dropAll() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected. Getting tables...');
  try {
    const res = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE schemaname IN ('drm', 'public')
    `);
    
    for (const row of res.rows) {
      console.log(`Dropping table ${row.schemaname}.${row.tablename}...`);
      await client.query(`DROP TABLE IF EXISTS "${row.schemaname}"."${row.tablename}" CASCADE`);
    }
    console.log('✅ All tables dropped successfully!');
  } catch (err) {
    console.error('❌ Drop failed:', err);
  } finally {
    await client.end();
  }
}
dropAll();
