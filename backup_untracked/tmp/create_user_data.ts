import { db } from "../server/db";
import { projects, tasks, users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const userEmail = "talhaexcelstech@gmail.com";
    const userRecords = await db.select().from(users).where(eq(users.email, userEmail));

    if (!userRecords.length) {
        console.log("User not found: " + userEmail);
    } else {
        const u = userRecords[0];
        console.log("User id:", u.id);

        // Add a test project for this user so they can see data
        const [proj] = await db.insert(projects).values({
            name: "My First Custom Project",
            description: "A test project created by AI for Talha",
            ownerUserId: u.id,
            workSpace: "Development",
            status: "Active",
            startDate: new Date(),
        }).returning();

        console.log("Inserted project:", proj.name);

        const [task1] = await db.insert(tasks).values({
            projectId: proj.id,
            title: "Homepage Revamp",
            description: "Update the homepage",
            ownerUserId: u.id,
            assignedToUserId: u.id,
            category: "Work",
            priority: "High",
            status: "InProgress",
        }).returning();

        const [task2] = await db.insert(tasks).values({
            projectId: proj.id,
            title: "Database Migration",
            description: "Move to new schema",
            ownerUserId: u.id,
            assignedToUserId: u.id,
            category: "Work",
            priority: "High",
            status: "ToDo",
        }).returning();

        console.log("Inserted tasks:", task1.title, task2.title);
    }

    process.exit(0);
}
main();
