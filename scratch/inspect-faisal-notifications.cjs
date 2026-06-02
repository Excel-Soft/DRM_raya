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
  const userId = "64b855c8-1136-4d7a-bc8c-17f172e65199"; // Faisal
  
  console.log("=== NOTIFICATIONS FOR FAISAL ===");
  const res = await pool.query(`
    SELECT * FROM drm.notifications 
    WHERE user_id = $1 
    ORDER BY created_at DESC 
    LIMIT 20
  `, [userId]);
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
