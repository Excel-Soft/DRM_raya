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
  const userId = "64b855c8-1136-4d7a-bc8c-17f172e65199";
  
  console.log("=== WORKFLOWS FOR FAISAL ===");
  const workflowsRes = await pool.query(`
    SELECT w.*, p.name as project_name, p.status as project_status, t.title as task_title 
    FROM drm.product_posting_workflows w
    LEFT JOIN drm.projects p ON w.project_id = p.id
    LEFT JOIN drm.tasks t ON w.task_id = t.id
    WHERE w.executive_user_id = $1
  `, [userId]);
  console.log(workflowsRes.rows);

  console.log("\n=== TASKS FOR FAISAL ===");
  const tasksRes = await pool.query(`
    SELECT t.*, p.name as project_name 
    FROM drm.tasks t
    LEFT JOIN drm.projects p ON t.project_id = p.id
    WHERE t.assigned_to_user_id = $1
  `, [userId]);
  console.log(tasksRes.rows);
}

main().catch(console.error).finally(() => pool.end());
