import { Express, Request, Response } from "express";

import { db } from "./db";
import {
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
  appointments,
  users,
  serviceComplaints,
  serviceDropouts
} from "../shared/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { computeExpiryState } from "./utils/service-expiry";

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

      // Total revenue placeholder (requires sum of invoices/gm matching the service)
      res.json({
        totalRevenue: 0,
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

      const data = [];
      for (const user of serviceUsers) {
        data.push({
          user: user.fullName || user.username,
          total: 0,
          target: 0,
          achieve: 0,
          remain: 0,
          aMinus: 0,
          prediction: 0,
          gm: 0,
          bv: 0
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

      // Example stub: Return array of `{ date, count }`
      const dailyMap: Record<string, number> = {};
      
      eachDayOfInterval({ start, end }).forEach(day => {
        dailyMap[format(day, 'yyyy-MM-dd')] = 0;
      });

      // You could populate dailyMap by running group-by queries on serviceActivities or serviceCustomers createdAt
      
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
