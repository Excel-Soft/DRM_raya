import { db, pool } from "../src/db/index";
import { roles } from "../src/db/schema";
import { eq, or } from "drizzle-orm";

async function upsertRole(name: string, description: string) {
    const now = new Date();
    console.log(`Upserting role: ${name}`);
    await db.insert(roles)
        .values({
            name,
            description,
            updated_at: now
        })
        .onConflictDoUpdate({
            target: roles.name,
            set: { description, updated_at: now }
        });
}

async function main() {
    // Roles to delete
    console.log("Removing unwanted roles...");
    await db.delete(roles)
        .where(
            or(
                eq(roles.name, "support_agent"),
                eq(roles.name, "brand_new_role")
            )
        );

    // Roles to add/update
    await upsertRole("product_posting_manager", "Product Posting Manager");
    await upsertRole("dd_manager", "D&D Manager");
    await upsertRole("qa_manager", "QA Manager");
    await upsertRole("verification_manager", "Verification Manager");
    await upsertRole("posting_executive", "Posting Executive");
    await upsertRole("dd_executive", "D&D Executive");

    console.log("Roles updated successfully.");
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
