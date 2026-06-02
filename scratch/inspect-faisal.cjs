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
  const res = await pool.query("SELECT id, name, username, email, role, role_id, roles, is_active FROM drm.users WHERE id = $1", ["64b855c8-1136-4d7a-bc8c-17f172e65199"]);
  console.log("Faisal user details:", res.rows[0]);
}

main().catch(console.error).finally(() => pool.end());
