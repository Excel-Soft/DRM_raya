import { db } from "../server/db";
import { projects, tasks, users } from "../shared/schema";
import { eq, or } from "drizzle-orm";

async function main() {
    console.log("--- PROJECTS ---");
    const allProjects = await db.select().from(projects);
    allProjects.forEach(p => console.log(`Project: ${p.name}, Owner: ${p.ownerUserId}`));

    console.log("\n--- TASKS ---");
    const allTasks = await db.select().from(tasks).leftJoin(projects, eq(tasks.projectId, projects.id));
    allTasks.forEach(t => console.log(`Task: ${t.tasks.title}, Status: ${t.tasks.status}, Owner: ${t.tasks.ownerUserId}, AssignedTo: ${t.tasks.assignedToUserId}, Project: ${t.projects?.name}`));

    process.exit(0);
}
main();
