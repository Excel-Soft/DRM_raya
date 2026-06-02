import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixRecent() {
  try {
    const res = await db.execute(sql`
      UPDATE drm.followup_subservice_details
      SET talk_time_minutes = 20
      WHERE created_at > now() - interval '20 minutes'
      AND method IN ('In-Meeting', 'in_meeting')
      AND talk_time_minutes IS NULL
      RETURNING *;
    `);
    console.log("Updated rows:", res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
fixRecent();
