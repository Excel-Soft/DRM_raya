import { db } from "../server/db";
import { roles } from "../shared/schema";

async function checkRoles() {
    const allRoles = await db.select().from(roles);
    allRoles.forEach(r => console.log(`${r.id}: ${r.name}`));
}

checkRoles();
