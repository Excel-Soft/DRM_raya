import { db } from "./server/db";
import { accountHeads } from "./shared/schema";

async function testQ() {
  try {
    const res = await db.select().from(accountHeads);
    console.log("Rows:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("FAILED:", err.message || err);
  }
  process.exit(0);
}
testQ();
