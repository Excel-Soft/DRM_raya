import { db } from "./server/db";
import { accountHeads } from "./shared/schema";

async function testQ() {
  try {
    const res = await db.select().from(accountHeads);
    console.log("Success!", res.length);
  } catch (err) {
    console.error("FAILED:", err.message || err);
  }
  process.exit(0);
}
testQ();
