
import { db } from "../server/db";
import { bvEntries } from "@shared/schema";
import { count } from "drizzle-orm";

async function checkBvData() {
    try {
        const result = await db.select({ count: count() }).from(bvEntries);
        console.log(`✅ Total BV entries: ${result[0].count}`);
    } catch (err) {
        console.error("❌ Error checking data:", err);
    } finally {
        process.exit();
    }
}

checkBvData();
