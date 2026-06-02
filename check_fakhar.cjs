const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.uaxllkzhlvxpdhzbmura:1XyZf01iM2kL3pQ9@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const users = await pool.query("SELECT id, full_name, role FROM users WHERE lower(full_name) LIKE '%fakhar%'");
  console.log("Fakhar users:", users.rows);

  if (users.rows.length > 0) {
    const userId = users.rows[0].id;
    const leads = await pool.query("SELECT c.id, c.company_name, c.owner_user_id, op.id as op_id, op.stage FROM drm.customers c LEFT JOIN drm.opportunities op ON c.id = op.customer_id WHERE c.owner_user_id = $1", [userId]);
    console.log("Fakhar leads/customers:", leads.rows);
  }

  pool.end();
}

main().catch(console.error);
