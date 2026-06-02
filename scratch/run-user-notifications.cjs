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
  const userId = "9ea6656a-bed3-4549-b60d-cba847c1c5ab";
  const res = await pool.query(`
    SELECT * FROM drm.notifications 
    WHERE user_id = $1 
    ORDER BY created_at DESC
  `, [userId]);
  console.log("=== USER NOTIFICATIONS ===");
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
