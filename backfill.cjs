const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.uaxllkzhlvxpdhzbmura:1XyZf01iM2kL3pQ9@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await pool.query("UPDATE drm.opportunities op SET owner_id = c.owner_user_id FROM drm.customers c WHERE op.customer_id = c.id AND c.owner_user_id IS NOT NULL AND op.owner_id IS DISTINCT FROM c.owner_user_id");
  console.log("Backfilled opportunities");
  pool.end();
}

main().catch(console.error);
