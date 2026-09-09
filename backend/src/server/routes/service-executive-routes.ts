import { Express, Request, Response } from "express";

import { db } from "../db";
import {
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
  appointments,
  customers,
  services,
  serviceComplaints,
  serviceDropouts,
  targetSystemDailyTargets,
  targetSystemUserTargets,
  users
} from "../../shared/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { computeExpiryState } from "../utils/service-expiry";
import { opportunitiesRepository } from "../repositories/opportunities.repository";

export function registerServiceExecutiveRoutes(app: Express) {
  // Statistics for Executive top cards
  app.get("/api/service/executive/stats", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      
      const allCustomers = await db.select().from(serviceCustomers).where(eq(serviceCustomers.assignedTo, execId));
      
      let newCount = 0;
      let renewCount = 0;
      let expireCount = 0;
      let activeCount = 0;

      for (const cust of allCustomers) {
        const state = computeExpiryState(cust.expiryDate);
        if (state === "active") activeCount++;
        if (state === "expiring") expireCount++;
        // the status field will indicate if it's new or renewed from previous flows
      }

      res.json({
        totalContact: allCustomers.length,
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

  // User's Activity Breakdown
  app.get("/api/service/executive/activities", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const today = new Date();
      const s = startOfDay(today);
      const e = endOfDay(today);

      const activities = await db.select()
        .from(serviceActivities)
        .where(
          and(
            eq(serviceActivities.userId, execId),
            gte(serviceActivities.activityDate, s),
            lte(serviceActivities.activityDate, e)
          )
        );

      // Build dynamic activities response based on Daily Targets for the user's role
      const userRes = await db.select().from(users).where(eq(users.id, execId));
      const userRole = userRes[0]?.role;

      let defaultActivities = [
        { method: "Mobile", target: "15 () 0%", time: 0 },
        { method: "OnSite Visit", target: "1 () 0%", time: 0 },
        { method: "Whatsapp", target: "20 () 0%", time: 0 },
        { method: "VAS Call", target: "5 () 0%", time: 0 },
        { method: "E-mail", target: "5 () 0%", time: 0 },
        { method: "Webinar", target: "1 () 0%", time: 0 },
        { method: "Seminar", target: "1 () 0%", time: 0 },
        { method: "Copy Product", target: "10 () 0%", time: 0 },
        { method: "New Product", target: "5 () 0%", time: 0 },
        { method: "ShowCase", target: "5 () 0%", time: 0 },
      ];

      // This endpoint is specifically for the Service Executive dashboard.
      // If an Admin views this dashboard, we still want to show Service Executive targets.
      const targetRoleName = "service executive";
      
      const allTargets = await db.select().from(targetSystemDailyTargets);
      const roleTargets = allTargets.filter(t => t.role.replace(/_/g, ' ').toLowerCase() === targetRoleName);
      
      if (roleTargets.length > 0) {
        // Map to new format and replace
        defaultActivities = defaultActivities.map(act => {
          const match = roleTargets.find(t => t.method.toLowerCase().includes(act.method.toLowerCase()) || act.method.toLowerCase().includes(t.method.toLowerCase()));
          if (match) {
            return { ...act, target: `${match.target} () 0%` };
          }
          return act;
        });
      }

      res.json(defaultActivities);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // User Targets vs Achievement
  app.get("/api/service/executive/targets", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      
      const targetRoleName = "service_executive";
      
      // Get a valid service executive ID if the current user isn't one (for admin views)
      let targetUserId = execId;
      const currentUser = await db.select().from(users).where(eq(users.id, execId)).limit(1);
      if (currentUser[0]?.role !== targetRoleName) {
        const serviceExec = await db.select().from(users).where(eq(users.role, targetRoleName)).limit(1);
        if (serviceExec.length > 0) {
          targetUserId = serviceExec[0].id;
        }
      }

      // Fetch targets from the master table (both user and role)
      const allTargetsRes = await db.select().from(targetSystemUserTargets);
      
      const allTargets = allTargetsRes.filter(t => 
        t.userId === targetUserId || t.userId === targetRoleName
      );
      
      const ab = allTargets.filter(t => t.category && t.category.toLowerCase().includes("ab new")).map(t => ({
        target: `${t.targetName} [${t.target || 0}]`,
        bonus: t.bonus,
        price: t.price,
        reward: t.reward,
        kwa: t.kwa,
        vas: t.vas
      }));

      const vas = allTargets.filter(t => t.category && t.category.toLowerCase().includes("vas")).map(t => ({
        target: `${t.targetName} [${t.target || 0}]`,
        bonus: t.bonus,
        price: t.price,
        reward: t.reward
      }));

      const stageCounts = await opportunitiesRepository.countByStage(targetUserId);
      const overall = [
          { name: "LD", value: stageCounts["LD"] || 0 },
          { name: "QF", value: stageCounts["QF"] || 0 },
          { name: "AY", value: stageCounts["AY"] || 0 },
          { name: "IN", value: stageCounts["IN"] || 0 },
          { name: "PM", value: stageCounts["PM"] || 0 },
          { name: "GM", value: stageCounts["GM"] || 0 },
          { name: "BV", value: stageCounts["BV"] || 0 },
          { name: "NC", value: stageCounts["NC"] || 0 },
          { name: "RC", value: stageCounts["RC"] || 0 },
          { name: "EC", value: stageCounts["EC"] || 0 },
          { name: "FW", value: stageCounts["FW"] || 0 },
          { name: "NF", value: stageCounts["NF"] || 0 },
      ];

      res.json({
        ab,
        vas,
        overall
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch targets" });
    }
  });

  // Today Appointments
  app.get("/api/service/executive/appointments", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const t = await db.select()
        .from(appointments)
        .where(eq(appointments.userId, execId))
        .orderBy(desc(appointments.startsAt));
        
      res.json(t);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Customer Queue Data (In-Service, Expiring)
  app.get("/api/service/executive/customers/:filter", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const { filter } = req.params; // 'in-service', 'expiring', 'expired'

      const results = await db.select({
        serviceCustomer: serviceCustomers,
        customerDetails: customers,
        packageDetails: services
      })
      .from(serviceCustomers)
      .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
      .leftJoin(services, eq(serviceCustomers.packageId, services.id))
      .where(eq(serviceCustomers.assignedTo, execId));

      // Filter by dynamic expiry state in memory
      const filtered = results.filter(r => {
        const state = computeExpiryState(r.serviceCustomer.expiryDate);
        if (filter === "expiring") return state === "expiring";
        if (filter === "expired") return state === "expired";
        return state === "active"; // defaults to in-service
      });

      res.json(filtered);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch filtered customers" });
    }
  });
}
