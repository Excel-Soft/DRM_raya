import { db } from "../server/db";
import { loanRequests, loanReports, users } from "../shared/schema";
import { gte, lte, and, inArray } from "drizzle-orm";

async function check() {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
    
    const userIds = ['0dccb495-9eb3-4ad8-923d-5e6a9677beff']; // Fakhar
    
    const whereConditions = [
        gte(loanRequests.createdAt, fromDate),
        lte(loanRequests.createdAt, toDate)
      ];
      if (userIds && userIds.length > 0) {
        whereConditions.push(inArray(loanRequests.userId, userIds));
      }
    
      const loans = await db
        .select()
        .from(loanRequests)
        .where(and(...whereConditions));
        
      console.log("Fakhar's Loans:", loans);
      process.exit(0);
}

check();
