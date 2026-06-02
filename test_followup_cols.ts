import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkCols() {
  try {
    const res = await db.execute(sql`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'drm' AND table_name IN ('follow_ups', 'followup_subservice_details');
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
checkCols();
