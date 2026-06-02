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

// Set up Drizzle and database connection
const { drizzle } = require("drizzle-orm/node-postgres");
const pg = require("pg");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  // We can just run the same logic or use standard queries
  const { getExecutionRowsForRole } = require("../server/services/product-posting-workflow.service");
  
  // Call it for Faisal
  console.log("=== EXECUTIONS FOR FAISAL ===");
  const res = await getExecutionRowsForRole("posting_executive", "64b855c8-1136-4d7a-bc8c-17f172e65199");
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error).finally(() => client.end());
