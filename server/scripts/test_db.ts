import { db } from "../db";
import { sql } from "drizzle-orm";

async function main() {
    try {
        console.log("Testing DB connection...");
        const result = await db.execute(sql`SELECT 1`);
        console.log("Connection successful:", result);
    } catch (error) {
        console.error("Connection failed:", error);
    } finally {
        process.exit(0);
    }
}

main();
