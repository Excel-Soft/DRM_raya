import { Router, Request, Response } from "express";
import { db } from "../db";
import { gmEntries, customers, users, targetSystemUserTargets } from "../../shared/schema";
import { eq, and, gte, lte, or, inArray, desc, sql } from "drizzle-orm";
import { isManagerialRole } from "../utils/role-utils";
import { getDepartmentFilterUserIds } from "../dashboard-routes";

const router = Router();

const isManagerRole = (roleId?: string) => isManagerialRole(roleId);

const resolveScopeUserIds = async (userId: string, roleId?: string): Promise<string[] | null> => {
  if (!isManagerRole(roleId)) return [userId];
  return getDepartmentFilterUserIds({ user: { userId, roleId: roleId as string, activeRoleId: roleId as string } });
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId, type, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const dateFrom = new Date(startDate as string);
    const dateTo = new Date(endDate as string);
    dateTo.setHours(23, 59, 59, 999);

    const authUserId = (req.user as any)?.userId || (req.user as any)?.id;
    const authRoleId = (req.user as any)?.roleId || (req.user as any)?.role;
    const allowedUserIds = await resolveScopeUserIds(authUserId, authRoleId);

    // 1. Gather GM Entries
    const conditions = [
      gte(gmEntries.createdAt, dateFrom),
      lte(gmEntries.createdAt, dateTo),
      eq(gmEntries.isDeleted, false)
    ];

    if (allowedUserIds !== null) {
       // if they asked for a specific user and are allowed
       if (userId && userId !== "All") {
         if (!allowedUserIds.includes(userId as string) && authRoleId !== "admin" && authRoleId !== "super_admin") {
            return res.status(403).json({ error: "Not authorized to view this user" });
         }
         conditions.push(eq(gmEntries.salesPersonId, userId as string));
       } else {
         conditions.push(inArray(gmEntries.salesPersonId, allowedUserIds));
       }
    } else {
       if (userId && userId !== "All") {
         conditions.push(eq(gmEntries.salesPersonId, userId as string));
       }
    }

    if (type && type !== "All") {
      let entryTypeStr = "";
      if (type === "1") entryTypeStr = "New";
      else if (type === "0") entryTypeStr = "Rc";
      else if (type === "2") entryTypeStr = "Expire";
      else if (type === "3") entryTypeStr = "Rc/Up";
      
      if (entryTypeStr) {
        conditions.push(eq(gmEntries.entryType, entryTypeStr));
      }
    }

    const results = await db
      .select({
        id: gmEntries.id,
        companyName: gmEntries.companyName,
        packageType: gmEntries.packageType,
        amountUsd: gmEntries.amountUsd,
        extraDiscountUsd: gmEntries.extraDiscountUsd,
        salesPersonName: users.name,
        paymentStatus: gmEntries.paymentStatus,
        createdAt: gmEntries.createdAt,
        entryType: gmEntries.entryType,
        canonicalGmType: gmEntries.canonicalGmType,
        userId: gmEntries.salesPersonId,
      })
      .from(gmEntries)
      .leftJoin(users, eq(users.id, gmEntries.salesPersonId))
      .where(and(...conditions))
      .orderBy(desc(gmEntries.createdAt));

    // 2. Map targets to each user
    const userIdsInResult = Array.from(new Set(results.map(r => r.userId).filter(Boolean))) as string[];
    const userTargets: Record<string, any[]> = {};
    
    if (userIdsInResult.length > 0) {
      const targets = await db
        .select()
        .from(targetSystemUserTargets)
        .where(inArray(targetSystemUserTargets.userId, userIdsInResult));
      
      for (const t of targets) {
        if (!userTargets[t.userId]) userTargets[t.userId] = [];
        userTargets[t.userId].push(t);
      }
    }

    const finalData = results.map((row, index) => {
      const uTargets = userTargets[row.userId!] || [];
      // Pick first matching target for simplicity, or sum them up based on logic
      const target = uTargets[0] || {};
      
      let tconversion = Number(target.price || 0); // Price from target
      let reward = Number(target.reward || 0);
      let vas = Number(target.vas || 0);
      let kwa = Number(target.kwa || 0);

      const pkg = row.packageType || "";
      const isRc = row.entryType === "Rc";
      const isEc = row.entryType === "Expire";
      const isNew = row.entryType === "New";
      // This is a simplified dropout simulation since dropout isn't explicitly mapped in GM
      const dropout = 0; 
      
      if (pkg === "Basic") {
         tconversion = 3000;
         if (isRc || isEc) tconversion = 1000;
      } else if (pkg === "GGS Digital" || pkg === "GGS Lite") {
         tconversion = 2500;
         if (isRc || isEc) tconversion = 1000;
      } else if (pkg === "Basic Plus" || pkg === "Standard") {
         tconversion = 5000;
         if (isRc || isEc) tconversion = 1000;
      }

      return {
        sr: index + 1,
        company: row.companyName,
        package: row.packageType,
        price: target.price || 0,
        extraDisc: row.extraDiscountUsd,
        comm: tconversion,
        reward: reward,
        vas: vas,
        kwa: kwa,
        method: "0x 1000",
        person: row.salesPersonName,
        pay: 0,
        bvSubmit: row.createdAt,
        bv: "Total Rc",
        rcNew: row.entryType,
        dropout: "None",
        type: row.canonicalGmType || row.entryType,
        receiveDate: row.createdAt,
      };
    });

    res.json(finalData);

  } catch (err: any) {
    console.error("BV System report error:", err);
    res.status(500).json({ error: "Failed to fetch BV System report" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
    try {
        const authUserId = (req.user as any)?.userId || (req.user as any)?.id;
        const authRoleId = (req.user as any)?.roleId || (req.user as any)?.role;
        const allowedUserIds = await resolveScopeUserIds(authUserId, authRoleId);

        let query = db.select({
            id: users.id,
            name: users.name,
            fullName: users.fullName,
        }).from(users);

        if (allowedUserIds !== null) {
            if (allowedUserIds.length === 0) return res.json([]);
            query = query.where(inArray(users.id, allowedUserIds)) as any;
        }

        const usersList = await query;
        return res.json(usersList);
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

export default router;
