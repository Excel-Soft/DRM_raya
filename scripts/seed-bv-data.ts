
import { db, pool } from "../server/db";
import { bvEntries, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedBvData() {
    try {
        console.log("🌱 Seeding BV data...");

        // Get a user to assign entries to (Admin or first user)
        const allUsers = await db.select().from(users).limit(1);

        if (allUsers.length === 0) {
            console.log("❌ No users found. Please create a user first.");
            process.exit(1);
        }

        const adminUser = allUsers[0];
        console.log(`Assigning entries to user: ${adminUser.username} (${adminUser.id})`);

        const d2 = new Date(); d2.setDate(d2.getDate() - 2);
        const d5 = new Date(); d5.setDate(d5.getDate() - 5);
        const d10 = new Date(); d10.setDate(d10.getDate() - 10);

        const sampleEntries = [
            {
                companyName: "trusmile surgical",
                packageType: "10000",
                amount: "364",
                commission: "364",
                reward: "364",
                vasAmount: "364",
                kwaAmount: "364",
                method: "364",
                personName: "364",
                payAmount: "364",
                bvAmount: "364",
                entryType: "364",
                type: "2021-07-13 17:08:25",
                salesPersonId: adminUser.id,
                receivedAt: d2,
                createdAt: d2,
            },
            {
                companyName: "Tech Solutions",
                packageType: "Gold",
                amount: "5000",
                commission: "500",
                reward: "100",
                vasAmount: "200",
                kwaAmount: "50",
                method: "Bank Transfer",
                personName: "John Doe",
                payAmount: "5000",
                bvAmount: "4500",
                entryType: "New",
                type: "2025-01-15 10:00:00",
                salesPersonId: adminUser.id,
                receivedAt: d5,
                createdAt: d5,
            },
            {
                companyName: "Global Trade Co",
                packageType: "Silver",
                amount: "2500",
                commission: "250",
                reward: "50",
                vasAmount: "100",
                kwaAmount: "25",
                method: "Cash",
                personName: "Jane Smith",
                payAmount: "2500",
                bvAmount: "2200",
                entryType: "Renewal",
                type: "2025-02-01 14:30:00",
                salesPersonId: adminUser.id,
                receivedAt: d10,
                createdAt: d10,
            }
        ];

        await db.insert(bvEntries).values(sampleEntries);

        console.log(`✅ Seeded ${sampleEntries.length} BV entries with safe dates.`);

    } catch (err) {
        console.error("❌ Error seeding BV data:", err);
    } finally {
        process.exit();
    }
}

seedBvData();
