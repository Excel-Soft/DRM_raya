import { Router, Request, Response } from "express";
import { db } from "../db";
import { followUps, customers, users, targetSystemTargets } from "../../shared/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";
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
    const { userId, grade, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const dateFrom = new Date(startDate as string);
    const dateTo = new Date(endDate as string);
    dateTo.setHours(23, 59, 59, 999);

    const authUserId = (req.user as any)?.userId || (req.user as any)?.id;
    const authRoleId = (req.user as any)?.roleId || (req.user as any)?.role;
    const allowedUserIds = await resolveScopeUserIds(authUserId, authRoleId);

    const conditions = [
      gte(followUps.dateTime, dateFrom),
      lte(followUps.dateTime, dateTo)
    ];

    if (allowedUserIds !== null) {
       if (allowedUserIds.length === 0) {
           return res.json([]);
       }
       conditions.push(inArray(followUps.createdBy, allowedUserIds));
    }

    if (userId && userId !== "All") {
      conditions.push(eq(followUps.createdBy, userId as string));
    }

    if (grade && grade !== "All") {
      conditions.push(eq(customers.grade, grade as string));
    }

    // Query to get the follow-ups with related customer and user data
    const queryResult = await db.select({
      id: customers.id,
      company: customers.companyName,
      grade: customers.grade,
      person: customers.accountName,
      salePersonName: users.name,
      comm: followUps.notes,
      follow: followUps.dateTime,
      method: followUps.method,
      crmId: customers.crmId,
    })
    .from(followUps)
    .leftJoin(customers, eq(followUps.customerId, customers.id))
    .leftJoin(users, eq(followUps.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(followUps.dateTime));

    // Map to match exactly the expected output columns, handling potentially missing fields gracefully
    const formattedData = queryResult.map((item, index) => ({
      no: index + 1,
      id: item.crmId || item.id, // Prefer CRM ID if available, otherwise database ID
      company: item.company,
      grade: item.grade,
      person: item.person,
      salePerson: item.salePersonName,
      comm: item.comm,
      follow: item.follow,
    }));

    return res.json(formattedData);

  } catch (error) {
    console.error("Error fetching grade system report:", error);
    return res.status(500).json({ error: "Failed to fetch grade system data" });
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
