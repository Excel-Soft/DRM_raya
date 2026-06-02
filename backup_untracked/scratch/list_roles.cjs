
const { db } = require('./server/db');
const { attributes, roles } = require('./shared/schema');
const { eq } = require('drizzle-orm');

async function listRoles() {
    try {
        console.log("--- Roles Table ---");
        const allRoles = await db.select().from(roles);
        console.log(JSON.stringify(allRoles, null, 2));

        console.log("\n--- Job Designation Attributes ---");
        const jobDesignations = await db.select().from(attributes).where(eq(attributes.category, "Job Designation"));
        console.log(JSON.stringify(jobDesignations, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

listRoles();
