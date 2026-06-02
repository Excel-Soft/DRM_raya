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
  const res = await pool.query(`
    SELECT id, name, status, owner_user_id, created_at FROM drm.projects WHERE id IN ('e93994ea-7c38-4f79-8d58-4f74835450aa', '1c6e07c3-fe28-43c2-b5eb-3f92bbb49e83')
  `);
  console.log("=== PROJECTS ===");
  console.log(res.rows);

  const taskRes = await pool.query(`
    SELECT id, project_id, title, status, assigned_to_user_id, created_at FROM drm.tasks WHERE id = '49418d16-1281-4075-8266-d6e7affc8075' OR project_id IN ('e93994ea-7c38-4f79-8d58-4f74835450aa', '1c6e07c3-fe28-43c2-b5eb-3f92bbb49e83')
  `);
  console.log("=== TASKS ===");
  console.log(taskRes.rows);

  const wfRes = await pool.query(`
    SELECT id, project_id, task_id, current_phase, executive_user_id, created_at FROM drm.product_posting_workflows WHERE project_id IN ('e93994ea-7c38-4f79-8d58-4f74835450aa', '1c6e07c3-fe28-43c2-b5eb-3f92bbb49e83')
  `);
  console.log("=== WORKFLOWS ===");
  console.log(wfRes.rows);
}

main().catch(console.error).finally(() => pool.end());
