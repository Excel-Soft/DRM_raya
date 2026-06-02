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
  
  // Directly run the SQL query from getExecutionRowsForRole
  const res = await pool.query(`
    SELECT 
      w.id as "wf_id",
      w.project_id as "wf_project_id",
      w.task_id as "wf_task_id",
      w.current_phase as "wf_current_phase",
      p.id as "proj_id",
      p.name as "proj_name",
      t.id as "task_id",
      t.project_id as "task_project_id",
      t.title as "task_title",
      t.assigned_to_user_id as "task_assigned_to"
    FROM drm.product_posting_workflows w
    LEFT JOIN drm.projects p ON w.project_id = p.id
    LEFT JOIN drm.tasks t ON w.task_id = t.id
    WHERE w.executive_user_id = $1
  `, [FaisalUserId]);

  console.log("=== FAISAL WORKFLOW EXECUTIONS ===");
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
