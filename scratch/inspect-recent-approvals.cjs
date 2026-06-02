const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const parts = line.trim().split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
      process.env[key] = val;
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Check product posting invoices
  console.log("=== RECENT PRODUCT POSTING INVOICES ===");
  const invoicesRes = await pool.query(`
    SELECT i.id, i.amount, i.sales_exec_id, u.name as sales_exec_name, i.project_name, i.status, i.created_at, i.updated_at
    FROM drm.product_posting_invoices i
    LEFT JOIN drm.users u ON i.sales_exec_id = u.id
    WHERE i.updated_at >= NOW() - INTERVAL '2 days'
    ORDER BY i.updated_at DESC
  `);
  console.log(invoicesRes.rows);

  // Check quotations
  console.log("=== RECENT QUOTATIONS ===");
  const quotRes = await pool.query(`
    SELECT q.id, q.company, q.save_status, q.created_by, u.name as creator_name, q.created_at, q.updated_at
    FROM drm.quotations q
    LEFT JOIN drm.users u ON q.created_by::text = u.id::text
    WHERE q.updated_at >= NOW() - INTERVAL '2 days'
    ORDER BY q.updated_at DESC
  `);
  console.log(quotRes.rows);

  // Check projects
  console.log("=== RECENT PROJECTS ===");
  const projRes = await pool.query(`
    SELECT p.id, p.name, p.status, p.owner_user_id, u.name as owner_name, p.created_at
    FROM drm.projects p
    LEFT JOIN drm.users u ON p.owner_user_id::text = u.id::text
    WHERE p.created_at >= NOW() - INTERVAL '2 days'
    ORDER BY p.created_at DESC
  `);
  console.log(projRes.rows);

  // Check recent notifications
  console.log("=== RECENT NOTIFICATIONS ===");
  const notifRes = await pool.query(`
    SELECT n.id, n.message, n.user_id, u.name as user_name, n.created_at
    FROM drm.notifications n
    LEFT JOIN drm.users u ON n.user_id = u.id
    WHERE n.created_at >= NOW() - INTERVAL '2 days'
    ORDER BY n.created_at DESC
  `);
  console.log(notifRes.rows);
}

main().catch(console.error).finally(() => pool.end());
