import { rolesRepository } from "../server/repositories/roles.repository";
import { db } from "../server/db";
import { eq } from "drizzle-orm";
import { attributes } from "@shared/schema";

async function run() {
    try {
        const roles = await rolesRepository.findAll();
        console.log("Roles from repo:", roles.length, roles.slice(0, 3));

        const jobDesignations = await db.select().from(attributes).where(eq(attributes.category, "Job Designation")).limit(5);
        console.log("Job Designations:", jobDesignations.length, jobDesignations.slice(0, 3));
    } catch (err) {
        console.error("Error:", err);
    }
    process.exit();
}
run();
