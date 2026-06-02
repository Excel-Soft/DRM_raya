import { db } from "../server/db";
import { tasks, projects } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, "49418d16-1281-4075-8266-d6e7affc8075"));
  console.log("Task details:", JSON.stringify(task, null, 2));
  if (task?.projectId) {
    const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
    console.log("Project linked to task:", JSON.stringify(project, null, 2));
  }
}

main().catch(console.error).finally(() => process.exit(0));
