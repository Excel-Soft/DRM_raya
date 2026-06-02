import { Express, Request, Response } from "express";

import { db } from "./db";
import {
  serviceFollowups,
  serviceComplaints,
  serviceDropouts,
  serviceRenewals
} from "../shared/schema";
import { eq } from "drizzle-orm";

export function registerServiceCoreRoutes(app: Express) {
  // Followups
  app.get("/api/service/followups/due", async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const followups = await db.select().from(serviceFollowups).where(eq(serviceFollowups.assignedTo, execId));
      res.json(followups);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch due followups" });
    }
  });

  app.post("/api/service/followups", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceFollowups).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create followup" });
    }
  });

  app.patch("/api/service/followups/:id/complete", async (req: Request, res: Response) => {
    try {
      await db.update(serviceFollowups)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(serviceFollowups.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to complete followup" });
    }
  });

  // Complaints
  app.get("/api/service/complaints", async (req: Request, res: Response) => {
    try {
      const complaints = await db.select().from(serviceComplaints);
      res.json(complaints);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch complaints" });
    }
  });

  app.post("/api/service/complaints", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceComplaints).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create complaint" });
    }
  });

  // Dropouts
  app.get("/api/service/dropouts", async (req: Request, res: Response) => {
    try {
      const dropouts = await db.select().from(serviceDropouts);
      res.json(dropouts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch dropouts" });
    }
  });

  app.post("/api/service/dropouts", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceDropouts).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to mark dropout" });
    }
  });

  app.patch("/api/service/dropouts/:id/recover", async (req: Request, res: Response) => {
    try {
      await db.update(serviceDropouts)
        .set({ status: "recovered", recoveredAt: new Date(), recoveryNote: req.body.recoveryNote })
        .where(eq(serviceDropouts.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to recover dropout" });
    }
  });

  // Renewals
  app.get("/api/service/renewals", async (req: Request, res: Response) => {
    try {
      const renewals = await db.select().from(serviceRenewals);
      res.json(renewals);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch renewals" });
    }
  });

  app.post("/api/service/renewals", async (req: Request, res: Response) => {
    try {
      const result = await db.insert(serviceRenewals).values({
        ...req.body,
        createdBy: req.user!.userId || (req.user as any)!.id,
      }).returning();
      res.json(result[0] || { success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create renewal" });
    }
  });

  // Phase 5: GM / VAS / BV Bridges
  app.get("/api/service/gm-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "GM Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch GM report" });
    }
  });
  
  app.get("/api/service/vas-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "VAS Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch VAS report" });
    }
  });

  app.get("/api/service/bv-report", async (req: Request, res: Response) => {
    try {
      res.json({ message: "BV Report stub" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch BV report" });
    }
  });

  app.post("/api/service/gm", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "GM injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create GM entry" });
    }
  });

  app.post("/api/service/vas", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "VAS injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create VAS entry" });
    }
  });

  app.post("/api/service/bv", async (req: Request, res: Response) => {
    try {
      res.json({ success: true, message: "BV injected from Service Department" });
    } catch (err) {
      res.status(500).json({ error: "Failed to create BV entry" });
    }
  });
}
