import { Pool } from "pg";
import { config } from "dotenv";

config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const users = await pool.query("SELECT id FROM users WHERE lower(full_name) LIKE '%fakhar%'");
  if (users.rows.length === 0) {
    console.log("no fakhar");
    return;
  }
  const userId = users.rows[0].id;
  const leads = await pool.query("SELECT c.id, c.company_name, c.owner_user_id, c.created_at as c_created_at, op.id as op_id, op.stage, op.created_at as op_created_at, op.owner_id as op_owner_id, op.updated_at as op_updated_at FROM drm.customers c LEFT JOIN drm.opportunities op ON c.id = op.customer_id WHERE c.owner_user_id = $1 OR op.owner_id = $1", [userId]);
  console.log("Fakhar leads:", JSON.stringify(leads.rows, null, 2));
  pool.end();
}

main().catch(console.error);
