import { db, pool } from "../db";
import { vasProgressSnapshots, type VasProgressSnapshot } from "@models/schema";
import { eq, and } from "drizzle-orm";

export class VasProgressRepository {
  async findByUserAndPeriod(
    userId: string,
    month: number,
    year: number
  ): Promise<VasProgressSnapshot | undefined> {
    try {
      const result = await db
        .select()
        .from(vasProgressSnapshots)
        .where(
          and(
            eq(vasProgressSnapshots.userId, userId),
            eq(vasProgressSnapshots.periodMonth, month),
            eq(vasProgressSnapshots.periodYear, year)
          )!
        )
        .limit(1);

      return result[0];
    } catch (error: any) {
      if (error?.code === "42P01") {
        // Table doesn't exist; treat as no data instead of 500
        return undefined;
      }
      throw error;
    }
  }

  async getCurrentMonthProgress(userId: string): Promise<VasProgressSnapshot | undefined> {
    const now = new Date();
    return this.findByUserAndPeriod(userId, now.getMonth() + 1, now.getFullYear());
  }
}

export const vasProgressRepository = new VasProgressRepository();
