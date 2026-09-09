
import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Dropping url_permissions table to force clean schema...");
    try {
        await db.execute(sql`DROP TABLE IF EXISTS url_permissions CASCADE`);
        console.log("Table dropped successfully.");
    } catch (err) {
        console.error("Error dropping table:", err);
    }
    process.exit(0);
}

main();
