import { db } from "../server/db";
import { projects, tasks } from "../shared/schema";

async function dump() {
    const p = await db.select().from(projects);
    const t = await db.select().from(tasks);
    console.log("PROJECTS:", JSON.stringify(p, null, 2));
    console.log("TASKS:", JSON.stringify(t, null, 2));
    process.exit(0);
}

dump();
