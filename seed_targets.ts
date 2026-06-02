import { db } from "./server/db";
import { targetSystemUserTargets } from "./shared/schema";

async function run() {
  const dummyTargetDetails = [
    { userId: "M. Arslan Janjua", targetName: "AB-GGS PRO", category: "AB New Terget", target: "0", price: "10000", bonus: "10000", vas: "0", kwa: "0", reward: "10000", total: "20000", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), signDate: new Date("2026-04-22T17:08:00") },
    { userId: "M. Arslan Janjua", targetName: "AB-KAP", category: "AB New Terget", target: "0", price: "10999", bonus: "70000", vas: "0", kwa: "0", reward: "70000", total: "140000", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), signDate: new Date("2026-04-22T17:08:00") },
    { userId: "Muhammad Junaid Aazar", targetName: "AB-GGS PRO", category: "AB New Terget", target: "0", price: "10000", bonus: "10000", vas: "0", kwa: "0", reward: "10000", total: "20000", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), signDate: new Date("2026-04-22T17:08:00") },
  ];

  for (const t of dummyTargetDetails) {
    await db.insert(targetSystemUserTargets).values({
      userId: t.userId,
      targetName: t.targetName,
      category: t.category,
      target: t.target,
      price: t.price,
      bonus: t.bonus,
      vas: t.vas,
      kwa: t.kwa,
      reward: t.reward,
      total: t.total,
      startDate: t.startDate,
      endDate: t.endDate,
      signDate: t.signDate
    });
  }
  console.log("Seeded user targets!");
  process.exit(0);
}

run().catch(console.error);
