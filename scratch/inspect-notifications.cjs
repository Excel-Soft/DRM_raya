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
    SELECT n.*, u.username 
    FROM drm.notifications n
    LEFT JOIN drm.users u ON n.user_id = u.id
    ORDER BY n.created_at DESC
    LIMIT 20
  `);
  console.log("=== RECENT NOTIFICATIONS ===");
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error).finally(() => pool.end());
