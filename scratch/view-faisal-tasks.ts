import { db } from "../server/db";
import { tasks, projects } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Faisal User ID: 64b855c8-1136-4d7a-bc8c-17f172e65199");
  const faisalTasks = await db.select().from(tasks).where(eq(tasks.assignedToUserId, "64b855c8-1136-4d7a-bc8c-17f172e65199"));
  console.log("Tasks found:", JSON.stringify(faisalTasks, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
