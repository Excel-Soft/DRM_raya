import { getLoanReport } from "../server/reports-routes"; // Wait, I can't import this easily.
// I will just write a script to fetch it via API or simulate the logic.
import { db } from "../server/db";
import { loanRequests } from "../shared/schema";
import { gte, lte, and, inArray } from "drizzle-orm";

async function check() {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
    
    // Check all loans in last 30 days
    const whereConditions = [
        gte(loanRequests.createdAt, fromDate),
        lte(loanRequests.createdAt, toDate)
      ];

      const loans = await db
        .select()
        .from(loanRequests)
        .where(and(...whereConditions));
        
      console.log("Loans in last 30 days:", loans);
      process.exit(0);
}

check();
