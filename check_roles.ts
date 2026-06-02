import { db } from "./server/db";
import { roles } from "./shared/schema";

async function checkRoles() {
    const allRoles = await db.select().from(roles);
    console.log("Roles in DB:", allRoles.map(r => r.name));
    process.exit(0);
}
checkRoles();
