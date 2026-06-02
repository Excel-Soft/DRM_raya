import { db } from "../server/db";
import { loanRequests } from "@shared/schema";
import { and, gte, lte, inArray } from "drizzle-orm";

async function main() {
  const userId = "4fec24fc-8c7a-4066-8126-578f66164d00"; // Assuming this is Haider
  
  // Use dates from frontend
  const from = new Date("2026-04-15");
  from.setHours(0,0,0,0);
  const to = new Date("2026-05-15");
  to.setHours(23,59,59,999);
  
  console.log("from:", from.toISOString());
  console.log("to:", to.toISOString());

  const whereConditions = [
    gte(loanRequests.createdAt, from),
    lte(loanRequests.createdAt, to),
    inArray(loanRequests.userId, [userId])
  ];

  const loans = await db
    .select()
    .from(loanRequests)
    .where(and(...whereConditions));

  console.log(`Found ${loans.length} loans for user ${userId}`);
  console.log(JSON.stringify(loans, null, 2));

  process.exit(0);
}
main();
