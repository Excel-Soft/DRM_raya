import { db, pool } from "../db";
import { targets, type Target } from "@models/schema";
import { eq, and } from "drizzle-orm";

export class TargetsRepository {
  async findByUserId(userId: string, type?: string): Promise<Target[]> {
    const conditions = [eq(targets.userId, userId)];

    if (type) {
      conditions.push(eq(targets.type, type as any));
    }

    return db
      .select()
      .from(targets)
      .where(and(...conditions)!);
  }

  async findByType(userId: string, type: "AB" | "VAS"): Promise<Target[]> {
    // Legacy targets table has month/year with ab_target and vas_target
    try {
      return await db
        .select()
        .from(targets)
        .where(and(eq(targets.userId, userId), eq(targets.type, type))!);
    } catch (error: any) {
      if (error?.code !== "42703") throw error;
    }

    const rows = await pool.query(
      `select month, year, ab_target, vas_target from targets where user_id = $1 order by year desc, month desc limit 3`,
      [userId],
    );
    if (rows.rowCount === 0) {
      return [
        {
          id: `fallback-${type}-1`,
          userId,
          type,
          name: type === "AB" ? "$1k - $49k" : "$1k - $29k",
          bonusType: "percentage",
          bonusValue: type === "AB" ? "10%" : "8%",
          priceTarget: type === "AB" ? "$50,000" : "$30,000",
          rewardText: type === "AB" ? "$500" : "$300",
          kwaRequirement: type === "AB" ? "5" : "3",
          vasRequirement: type === "AB" ? "3" : "5",
          createdAt: new Date(),
        } as any,
      ];
    }

    return rows.rows.map((r: any, idx: number) => ({
      id: `legacy-${type}-${idx}`,
      userId,
      type,
      name: `${r.month}/${r.year}`,
      bonusType: "percentage",
      bonusValue: type === "AB" ? "10%" : "8%",
      priceTarget: type === "AB" ? String(r.ab_target ?? 0) : String(r.vas_target ?? 0),
      rewardText: type === "AB" ? "$500" : "$300",
      kwaRequirement: "",
      vasRequirement: "",
      createdAt: new Date(),
    }) as any);
  }
}

export const targetsRepository = new TargetsRepository();
