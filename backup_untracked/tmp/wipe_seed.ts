import { db } from "../server/db";
import { projects, tasks, taskTimeLogs, taskStatusHistory, projectFinancials, projectAssignments, projectApprovals } from "../shared/schema";
import { inArray } from "drizzle-orm";

async function main() {
    console.log("Deleting all mock projects and tasks...");

    // we need to delete the dependencies first
    await db.delete(taskTimeLogs);
    await db.delete(taskStatusHistory);
    // wait table task_comments
    await db.execute(`DELETE FROM task_comments`);

    await db.delete(tasks);

    await db.delete(projectFinancials);
    await db.delete(projectAssignments);
    await db.delete(projectApprovals);
    await db.delete(projects);

    console.log("Done wiping projects and tasks.");
    process.exit(0);
}
main();
