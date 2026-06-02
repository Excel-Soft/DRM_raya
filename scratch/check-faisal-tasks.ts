import { db } from "../server/db";
import { tasks, projects } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const allTasks = await db.select().from(tasks).where(eq(tasks.assignedToUserId, "64b855c8-1136-4d7a-bc8c-17f172e65199"));
  console.log("Tasks assigned to Faisal in drm.tasks:", JSON.stringify(allTasks, null, 2));

  // Let's also query productPostingWorkflows
  // wait, is there a productPostingWorkflows table? Let's check from the schema.
}

main().catch(console.error).finally(() => process.exit(0));
