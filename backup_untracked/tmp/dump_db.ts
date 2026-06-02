import { db } from "../server/db";
import { projects, tasks, users } from "../shared/schema";

async function main() {
    console.log("Projects:");
    const allProjects = await db.select().from(projects);
    allProjects.forEach(p => console.log(`Project: ${p.name}, Owner: ${p.ownerUserId}`));

    console.log("\nTasks:");
    const allTasks = await db.select().from(tasks);
    allTasks.forEach(t => console.log(`Task: ${t.title}, Owner: ${t.ownerUserId}, AssignedTo: ${t.assignedToUserId}`));

    console.log("\nUsers:");
    const allUsers = await db.select().from(users);
    allUsers.forEach(u => console.log(`User: ${u.email}, ID: ${u.id}, Role: ${u.roleId}`));

    process.exit(0);
}
main();
