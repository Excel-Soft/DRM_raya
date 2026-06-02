import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8');
    const parsed = dotenv.parse(contents);
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

async function main() {
    console.log('Fetching roles info...');
    const tables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'roles'");
    console.log('Roles tables found:', tables.rows);
}

main()
    .catch(console.error)
    .finally(() => pool.end());
