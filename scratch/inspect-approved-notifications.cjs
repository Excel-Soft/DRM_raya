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
  const res = await pool.query(
    "SELECT id, message, user_id, type, read_status, created_at FROM drm.notifications WHERE message ILIKE '%approved%' OR message ILIKE '%invoice%' ORDER BY created_at DESC"
  );
  console.log("=== APPROVED/INVOICE NOTIFICATIONS ===");
  console.log(res.rows);
}

main().catch(console.error).finally(() => pool.end());
