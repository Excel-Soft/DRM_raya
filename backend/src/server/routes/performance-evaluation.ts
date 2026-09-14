import { Request, Response } from "express";

import { eq, and, between, inArray, gte, lte, or, sql } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";
import { pool, db } from "../db";
import { followUps, targetSystemDailyTargets, attributes, users } from "../../shared/schema";

export const getPerformanceEvaluation = async (req: any, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { userId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    // Default to 'all' if no user provided
    const targetUserId = (userId as string) || "all";

    const dateFrom = new Date(startDate as string);
    const dateTo = new Date(endDate as string);
    // ensure time is included if needed
    dateTo.setHours(23, 59, 59, 999);

    let usersList: any[] = [];
    if (targetUserId === "all") {
      // For all, we fetch all users under the current user's purview, or just all non-admin users for simplicity
      // Depending on RBAC, let's just fetch all users
      const allUsers = await db.select({ userId: users.id, name: users.name, role: users.roleId }).from(users);
      usersList = allUsers;
    } else {
      const selectedUser = await db.select({ userId: users.id, name: users.name, role: users.roleId }).from(users).where(eq(users.id, targetUserId)).limit(1);
      if (selectedUser.length > 0) {
        usersList = selectedUser;
      }
    }

    // For each user we find their daily targets
    const performanceData: any[] = [];
    
    // The modern schema doesn't track time per attribute, so default to 1 min/unit or fetch from elsewhere if needed.
    const attributeTimeMap = new Map();

    // Calculate total days (excluding Sundays if required, as per old logic)
    let totalDays = 0;
    for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) { // 0 is Sunday
        totalDays++;
      }
    }

    if (targetUserId === "all") {
        // Group by user
        const result: any[] = [];
        
        for (const u of usersList) {
            // Get targets for user's role
            // role is stored in various cases, normalize it
            // target_system_daily_targets uses specific cases but we'll try to match ignoring case if possible, or exact
            
            // Getting followups for this user between dates
            const followups = await db.select({
                method: followUps.method,
                date: followUps.dateTime,
                count: sql`count(*)`,
            }).from(followUps)
            .where(and(
                eq(followUps.createdBy, u.userId),
                gte(followUps.dateTime, dateFrom),
                lte(followUps.dateTime, dateTo)
            ))
            .groupBy(followUps.method, followUps.dateTime);
            
            // Actually wait, for 'all' we just want totals.
            // Let's get total followup time
            let totalSpentMins = 0;
            let totalFollowups = 0;
            
            // To be accurate, we just count all followups in the period
            const userFollowups = await db.select().from(followUps)
            .where(and(
                eq(followUps.createdBy, u.userId),
                gte(followUps.dateTime, dateFrom),
                lte(followUps.dateTime, dateTo)
            ));
            
            for (const fu of userFollowups) {
                if (fu.method) {
                    const time = attributeTimeMap.get(fu.method.toLowerCase()) || 1;
                    totalSpentMins += (1 * time); // 1 followup * time
                }
            }

            result.push({
                name: u.name,
                userId: u.userId,
                totalDays: totalDays,
                workingHours: 8 * totalDays,
                spentMins: totalSpentMins,
                taskTimeMins: totalSpentMins, // Simplifying
                freeTimeMins: (8 * totalDays * 60) - totalSpentMins
            });
        }

        return res.json({ mode: "all", data: result, startDate, endDate, totalDays });
    } else {
        // Single user view, grouped by date
        const u = usersList[0];
        if (!u) {
            return res.status(404).json({ error: "User not found" });
        }

        // Get targets
        // target_system_daily_targets stores role
        const rawTargets = await db.select().from(targetSystemDailyTargets);
        
        // Find targets that match the user's role (case insensitive)
        const userRole = (u.role || "").toLowerCase();
        const userTargets = rawTargets.filter(t => (t.role || "").toLowerCase() === userRole);
        
        // Generate headers from targets
        const headers = userTargets.map(t => ({
            method: t.method,
            target: t.target,
            timeMultiplier: attributeTimeMap.get((t.method || "").toLowerCase()) || 1
        }));
        
        const methodNames = headers.map(h => (h.method || "").toLowerCase());

        // Get followups
        const userFollowups = await db.select().from(followUps)
        .where(and(
            eq(followUps.createdBy, u.userId),
            gte(followUps.dateTime, dateFrom),
            lte(followUps.dateTime, dateTo)
        ));

        // Group by Date (YYYY-MM-DD)
        const dateMap = new Map();
        
        // Initialize date map with all dates in range
        for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split("T")[0];
            if (d.getDay() !== 0) {
               dateMap.set(dateStr, { date: dateStr, metrics: {}, totalSpentTime: 0 });
            }
        }
        
        for (const fu of userFollowups) {
            if (!fu.dateTime) continue;
            const dateStr = new Date(fu.dateTime).toISOString().split("T")[0];
            if (!dateMap.has(dateStr)) continue; // weekend or out of range
            
            const method = (fu.method || "").toLowerCase();
            const dayObj = dateMap.get(dateStr);
            
            if (!dayObj.metrics[method]) {
                dayObj.metrics[method] = { count: 0 };
            }
            dayObj.metrics[method].count += 1;
            
            const timeMult = attributeTimeMap.get(method) || 1;
            dayObj.totalSpentTime += (1 * timeMult);
        }

        const rows = Array.from(dateMap.values());
        
        // Total calculations
        const totalWorkingHours = totalDays * 8;
        const totalSpentMins = rows.reduce((acc, row) => acc + row.totalSpentTime, 0);

        return res.json({
            mode: "single",
            user: u.name,
            headers,
            rows,
            totals: {
                totalDays,
                workingHours: totalWorkingHours,
                spentMins: totalSpentMins,
                freeMins: (totalWorkingHours * 60) - totalSpentMins
            }
        });
    }

  } catch (error) {
    console.error("Error fetching performance evaluation:", error);
    res.status(500).json({ error: "Failed to fetch performance data" });
  }
};
