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

  // Mimic projectsRepository.findAllWithStats(FaisalUserId)
  // Which does:
  // SELECT ... FROM projects
  // WHERE owner_user_id = FaisalUserId OR EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND (tasks.owner_user_id = FaisalUserId OR tasks.assigned_to_user_id = FaisalUserId))
  const res = await pool.query(`
    SELECT id, name, status, owner_user_id, created_at FROM drm.projects
    WHERE owner_user_id = $1 OR EXISTS (
      SELECT 1 FROM drm.tasks 
      WHERE tasks.project_id = projects.id 
      AND (tasks.owner_user_id = $1 OR tasks.assigned_to_user_id = $1)
    )
  `, [FaisalUserId]);

  console.log("=== FAISAL PROJECTS (findAllWithStats) ===");
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
