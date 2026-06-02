import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fix() {
  await client.connect();
  console.log('Connected to DB');
  
  try {
    console.log('Checking columns in drm.notifications...');
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND table_name = 'notifications';
    `);
    
    const columns = res.rows.map(r => r.column_name);
    console.log('Current columns:', columns);
    
    if (!columns.includes('link')) {
      console.log('Adding "link" column...');
      await client.query('ALTER TABLE drm.notifications ADD COLUMN link TEXT;');
      console.log('Column "link" added.');
    } else {
      console.log('Column "link" already exists.');
    }

    if (!columns.includes('target_url')) {
      console.log('Adding "target_url" column...');
      await client.query('ALTER TABLE drm.notifications ADD COLUMN target_url TEXT;');
      console.log('Column "target_url" added.');
    } else {
      console.log('Column "target_url" already exists.');
    }

  } catch (err) {
    console.error('Error fixing table:', err);
  } finally {
    await client.end();
  }
}

fix();
