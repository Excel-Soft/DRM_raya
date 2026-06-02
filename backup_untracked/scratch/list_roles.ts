
import { db } from '../server/db.ts';
import { attributes, roles } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';

async function listRoles() {
    try {
        console.log("--- Roles Table ---");
        const allRoles = await db.select().from(roles);
        console.log(JSON.stringify(allRoles, null, 2));

        console.log("\n--- Job Designation Attributes ---");
        const jobDesignations = await db.select().from(attributes).where(eq(attributes.category, "Job Designation"));
        console.log(JSON.stringify(jobDesignations, null, 2));
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        process.exit();
    }
}

listRoles();
