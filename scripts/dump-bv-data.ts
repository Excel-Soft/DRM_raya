
import { db } from "../server/db";
import { bvEntries, users } from "@shared/schema";

async function dumpBvData() {
    try {
        const entries = await db.select().from(bvEntries);
        console.log("📊 BV Entries Dump:");
        console.log(JSON.stringify(entries, null, 2));

        const admin = await db.select().from(users).limit(1);
        console.log("👤 Admin User:", JSON.stringify(admin, null, 2));

    } catch (err) {
        console.error("❌ Error dumping data:", err);
    } finally {
        process.exit();
    }
}

dumpBvData();
