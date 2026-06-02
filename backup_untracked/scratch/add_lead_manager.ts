
import { db } from '../server/db.ts';
import { roles, attributes } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

async function addLeadManager() {
    try {
        console.log("Checking for lead_manager...");
        const existingRoles = await db.select().from(roles).where(eq(roles.name, "lead_manager"));
        
        if (existingRoles.length === 0) {
            console.log("Adding lead_manager to roles table...");
            await db.insert(roles).values({
                id: crypto.randomUUID(),
                name: "lead_manager",
                description: "Lead Generation and Management"
            });
            console.log("lead_manager added successfully.");
        } else {
            console.log("lead_manager already exists in roles table.");
        }

        // Also add to job designations as a fallback/compatibility
        const existingAttr = await db.select().from(attributes).where(eq(attributes.name, "Lead Manager"));
        if (existingAttr.length === 0) {
            console.log("Adding Lead Manager to attributes table...");
            await db.insert(attributes).values({
                id: crypto.randomUUID(),
                category: "Job Designation",
                name: "Lead Manager"
            });
            console.log("Lead Manager attribute added successfully.");
        } else {
            console.log("Lead Manager attribute already exists.");
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        process.exit();
    }
}

addLeadManager();
