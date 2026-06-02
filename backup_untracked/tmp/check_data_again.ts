import { db } from "../server/db";
import { projects, tasks, users } from "../shared/schema";
import { eq, or } from "drizzle-orm";

async function main() {
    console.log("Fetching all projects...");
    const allProjects = await db.select().from(projects);
    console.log(`Found ${allProjects.length} projects`);
    allProjects.forEach(p => console.log(`Project: [${p.id}] ${p.name}, Owner: ${p.ownerUserId}, CreatedBy: ${(p as any).createdBy}`));

    console.log("\nFetching all tasks...");
    const allTasks = await db.select().from(tasks);
    console.log(`Found ${allTasks.length} tasks`);
    allTasks.forEach(t => console.log(`Task: [${t.id}] ${t.title}, Owner: ${t.ownerUserId}, AssignedTo: ${t.assignedToUserId}, CreatedBy: ${(t as any).createdBy}`));

    process.exit(0);
}
main();
