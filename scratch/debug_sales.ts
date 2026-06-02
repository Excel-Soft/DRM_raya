import { db } from "../server/db";
import { targetSystemUserTargets } from "../shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  const allUserTargets = await db.select().from(targetSystemUserTargets);
  console.log("Total targets:", allUserTargets.length);

  const userIdStr = "6d406b3c-4055-4c8c-b421-9367f187a672";
  const userFullName = "Haider";

  const userTargets = allUserTargets.filter(t => 
    (t.userId === String(userIdStr) || t.userId === String(userFullName)) && 
    t.category && 
    (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
  );

  console.log("User targets:", userTargets);
  process.exit(0);
}
run().catch(console.error);
