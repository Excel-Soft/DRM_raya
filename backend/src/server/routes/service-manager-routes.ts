import { Express, Request, Response } from "express";

import { db, pool } from "../db";
import {
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
  serviceRenewals,
  appointments,
  users,
  serviceComplaints,
  serviceDropouts
} from "../../shared/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { computeExpiryState } from "../utils/service-expiry";
import { ensureBridgeLinksTable } from "../services/service-bridge.service";

export function registerServiceManagerRoutes(app: Express) {
  // Manager Stats / Top Cards
  app.get("/api/service/manager/stats", async (req: Request, res: Response) => {
    try {
      const allCustomers = await db.select().from(serviceCustomers);
      
      let newCount = 0;
      let renewCount = 0;
      let expireCount = 0;
      let activeCount = 0;

      for (const cust of allCustomers) {
        const state = computeExpiryState(cust.expiryDate);
        if (state === "active") activeCount++;
        if (state === "expiring") expireCount++;
        // the status field conceptually implies renewal vs new.
      }

      // Total revenue = sum of recorded service-renewal amounts, the only
      // defensible revenue source the service module owns today. Opaque metrics
      // (vm/kwa/psa/sponsorBrand) have no source table and remain an honest 0
      // rather than an invented formula.
      const revenueRows = await db
        .select({ totalRevenue: sql<number>`COALESCE(SUM(${serviceRenewals.amount}), 0)::float` })
        .from(serviceRenewals);
      const totalRevenue = revenueRows[0]?.totalRevenue ?? 0;

      res.json({
        totalRevenue,
        new: newCount,
        renew: renewCount,
        expire: expireCount,
        inService: activeCount,
        vm: 0,
        kwa: 0,
        psa: 0,
        sponsorBrand: 0
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Roll-up of Manager activities section
  app.get("/api/service/manager/activities", async (req: Request, res: Response) => {
    try {
      // Grouping logic for method-based activity counts. 
      // For instance: grouping by "method" field.
      // E-mail, OnSite Visit, WhatsApp, etc.
      
      const counts = await db.select({
        method: serviceActivities.method,
        count: sql<number>`count(${serviceActivities.id})::int`
      })
      .from(serviceActivities)
      .groupBy(serviceActivities.method);

      // Transform into object { WhatsApp: 5, Call: 10 }
      const methodCounts: Record<string, number> = {};
      counts.forEach((c: any) => { methodCounts[c.method] = c.count; });

      res.json(methodCounts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch manager activities" });
    }
  });

  // Team Queue Service Sales / Target Performance
  app.get("/api/service/manager/queue-performance", async (req: Request, res: Response) => {
    try {
      // Return a list of users involved in "service" department and their targets
      const serviceUsers = await db.select().from(users).where(eq(users.department, "Service")); // Assuming 'Service' exists

      // Active service→GM / service→BV bridge counts per creator. These are sourced
      // directly from drm.service_bridge_links (the bridge owns this data), so they
      // are defensible. The remaining queue metrics (total/target/achieve/remain/
      // aMinus/prediction) have no service-scoped source table yet and stay 0.
      const bridgeCounts: Record<string, { gm: number; bv: number }> = {};
      try {
        await ensureBridgeLinksTable();
        const { rows } = await pool.query<{ createdBy: string; targetModule: string; n: number }>(
          `SELECT created_by AS "createdBy", target_module AS "targetModule", COUNT(*)::int AS n
             FROM drm.service_bridge_links
            WHERE status = 'active' AND target_module IN ('gm','bv') AND created_by IS NOT NULL
            GROUP BY created_by, target_module`,
        );
        for (const r of rows) {
          const key = String(r.createdBy);
          if (!bridgeCounts[key]) bridgeCounts[key] = { gm: 0, bv: 0 };
          if (r.targetModule === "gm") bridgeCounts[key].gm = r.n;
          else if (r.targetModule === "bv") bridgeCounts[key].bv = r.n;
        }
      } catch (bridgeErr) {
        console.error("[ServiceManager] bridge counts unavailable", bridgeErr);
      }

      const data = [];
      for (const user of serviceUsers) {
        const counts = bridgeCounts[user.id] || { gm: 0, bv: 0 };
        data.push({
          user: user.fullName || user.username,
          total: 0,
          target: 0,
          achieve: 0,
          remain: 0,
          aMinus: 0,
          prediction: 0,
          gm: counts.gm,
          bv: counts.bv
        });
      }

      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch queue performance" });
    }
  });

  // Current Month Graph Map
  app.get("/api/service/manager/current-month-graph", async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const dailyMap: Record<string, number> = {};
      eachDayOfInterval({ start, end }).forEach(day => {
        dailyMap[format(day, 'yyyy-MM-dd')] = 0;
      });

      // Populate from real service-activity volume for the current month.
      const dailyCounts = await db
        .select({
          day: sql<string>`to_char(${serviceActivities.activityDate}, 'YYYY-MM-DD')`,
          count: sql<number>`count(${serviceActivities.id})::int`,
        })
        .from(serviceActivities)
        .where(and(gte(serviceActivities.activityDate, start), lte(serviceActivities.activityDate, end)))
        .groupBy(sql`to_char(${serviceActivities.activityDate}, 'YYYY-MM-DD')`);

      for (const row of dailyCounts) {
        if (row.day in dailyMap) dailyMap[row.day] = row.count;
      }

      const responseArray = Object.keys(dailyMap).map(k => ({ date: k, count: dailyMap[k] }));

      res.json(responseArray);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch month graph" });
    }
  });

  // Most Detailed Team Work Performance
  app.get("/api/service/manager/team-work-performance", async (req: Request, res: Response) => {
    try {
      // Stub returning aggregated work performance for each user
      res.json({
        leads: 0,
        follow: 0,
        notFollow: 0,
        grades: 0,
        reports: 0,
        ratings: 0,
        upselling: 0,
        rfq: 0,
        products: 0,
        samples: 0,
        orders: 0,
        revenue: 0,
        callConnected: 0,
        notResponse: 0,
        appointments: 0,
        meetings: 0
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch team work performance" });
    }
  });
}
