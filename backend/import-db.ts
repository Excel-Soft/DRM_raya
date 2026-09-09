import { Client } from 'pg';
import * as fs from 'fs';
import 'dotenv/config';

async function importDb() {
  console.log('Reading 11MB SQL file...');
  const sql = fs.readFileSync('/Users/apple/DRM Raya/dump_full.sql', 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('Connected to Supabase, starting import (this might take a minute)...');
  try {
    await client.query(sql);
    console.log('✅ Import successful! Database is fully restored.');
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    await client.end();
  }
}
importDb();
