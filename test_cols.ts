import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkCols() {
  try {
    const res = await db.execute(sql`
      SELECT table_schema, column_name 
      FROM information_schema.columns 
      WHERE table_name = 'account_heads';
    `);
    console.log("account_heads columns:", res.rows);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
checkCols();
