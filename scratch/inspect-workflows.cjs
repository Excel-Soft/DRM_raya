const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// Manually parse .env
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
  const resWorkflows = await pool.query(`
    SELECT w.id, w.project_id, p.name as project_name, w.task_id, t.title as task_title, 
           w.executive_user_id, u.name as exec_name, w.current_phase, w.assigned_duration_minutes, w.created_at
    FROM drm.product_posting_workflows w
    LEFT JOIN drm.projects p ON w.project_id = p.id
    LEFT JOIN drm.tasks t ON w.task_id = t.id
    LEFT JOIN drm.users u ON w.executive_user_id = u.id
    ORDER BY w.created_at DESC
    LIMIT 10
  `);

  console.log("=== RECENT WORKFLOWS ===");
  console.log(resWorkflows.rows);

  const resTasks = await pool.query(`
    SELECT t.id, t.project_id, p.name as project_name, t.title, t.assigned_to_user_id, u.name as assigned_to_name, t.status, t.created_at
    FROM drm.tasks t
    LEFT JOIN drm.projects p ON t.project_id = p.id
    LEFT JOIN drm.users u ON t.assigned_to_user_id = u.id
    ORDER BY t.created_at DESC
    LIMIT 10
  `);

  console.log("=== RECENT TASKS ===");
  console.log(resTasks.rows);
}

main().catch(console.error).finally(() => pool.end());
