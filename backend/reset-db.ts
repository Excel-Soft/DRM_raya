import { Client } from 'pg';
import 'dotenv/config';

async function resetDb() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected. Dropping schemas...');
  try {
    await client.query("DROP SCHEMA IF EXISTS drm CASCADE; DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE;");
    console.log('✅ Schemas dropped successfully!');
  } catch (err) {
    console.error('❌ Drop failed:', err);
  } finally {
    await client.end();
  }
}
resetDb();
