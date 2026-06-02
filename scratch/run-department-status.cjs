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
  const FaisalUserId = "64b855c8-1136-4d7a-bc8c-17f172e65199";
  const userRole = "posting_executive";

  let roleFilter = "";
  if (userRole === "product_posting_executive" || userRole === "posting_executive" || userRole === "design_executive" || userRole === "developer_executive") {
      roleFilter = `AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${FaisalUserId}')`;
  }

  const { rows } = await pool.query(`
    SELECT 
      p.id,
      COALESCE(i.company_name, c.company_name, 'Unknown') as "company",
      COALESCE(i.project_name, p.name) as "project",
      p.status,
      u.name as "assign",
      p.created_at as "date",
      COALESCE(fin.total_amount, 0) as "amount",
      i.status as "invoiceStatus",
      (SELECT COUNT(*) FROM drm.tasks t WHERE t.project_id = p.id) as "totalTasks",
      (SELECT SUM(duration_minutes) FROM drm.task_time_logs tl JOIN drm.tasks t ON tl.task_id = t.id WHERE t.project_id = p.id) as "totalTime"
    FROM drm.projects p
    LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
    LEFT JOIN drm.customers c ON p.customer_id = c.id
    LEFT JOIN drm.users u ON p.owner_user_id = u.id
    LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
    WHERE coalesce(p.is_deleted, false) = false
    ${roleFilter}
    ORDER BY p.updated_at DESC
  `);

  console.log("=== DEPARTMENT STATUS FOR FAISAL ===");
  console.log(rows);
}

main().catch(console.error).finally(() => pool.end());
