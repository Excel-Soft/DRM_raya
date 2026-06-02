import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND table_schema = 'drm'
  `);
  console.log("Tasks columns in DB:", result.rows);
}

main().catch(console.error);
