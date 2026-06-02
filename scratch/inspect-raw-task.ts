import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    SELECT id, assigned_to, created_by, assigned_to_user_id, owner_user_id, due_at, due_date
    FROM drm.tasks 
    WHERE id = '49418d16-1281-4075-8266-d6e7affc8075'
  `);
  console.log("Raw Task Row:", result.rows[0]);
}

main().catch(console.error);
