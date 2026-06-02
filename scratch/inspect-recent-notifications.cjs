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
    SELECT n.id, n.message, n.user_id, u.name as user_name, u.role as user_role, n.type, n.read_status, n.created_at 
    FROM drm.notifications n
    LEFT JOIN drm.users u ON n.user_id = u.id
    WHERE n.created_at >= NOW() - INTERVAL '2 days'
    ORDER BY n.created_at DESC
  `);
  console.log("=== RECENT NOTIFICATIONS (LAST 2 DAYS) ===");
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
