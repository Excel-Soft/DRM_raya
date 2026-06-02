
import { db } from "../server/db";
import { bvEntries, users } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

async function debugBvQuery() {
    try {
        // 1. Get Admin Object
        const admin = (await db.select().from(users).limit(1))[0];
        console.log(`👤 Testing as User: ${admin.username} (${admin.id})`);

        // 2. Define Date Ranges
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const endOfToday = new Date(today.setHours(23, 59, 59, 999));

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 3. Test Cases
        await testQuery(admin.id, thirtyDaysAgo, endOfToday, "Last 30 Days");
        await testQuery(admin.id, new Date("2020-01-01"), endOfToday, "Last 5 Years");

    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        process.exit();
    }
}

async function testQuery(userId: string, from: Date, to: Date, label: string) {
    console.log(`\n🔎 Testing Range: ${label}`);
    console.log(`   From: ${from.toISOString()}`);
    console.log(`   To:   ${to.toISOString()}`);

    const conditions = [
        gte(bvEntries.createdAt, from),
        lte(bvEntries.createdAt, to)
    ];

    // This matches the backend logic: if userId is provided (and not 'all'), add filter
    // We assume filterUserId is working correctly in the backend.
    conditions.push(eq(bvEntries.salesPersonId, userId));

    const entries = await db
        .select()
        .from(bvEntries)
        .where(and(...conditions))
        .orderBy(desc(bvEntries.createdAt));

    console.log(`   ✅ Found: ${entries.length} entries`);
    if (entries.length > 0) {
        console.log(`   📝 First Entry ID: ${entries[0].id}, CreatedAt: ${entries[0].createdAt}`);
    }
}

debugBvQuery();
