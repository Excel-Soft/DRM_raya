import { Router, type Express } from "express";
import { z } from "zod";
import { gmBvPoolRepository } from "../repositories/gm-bv-pool.repository";

export const createSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  companyName: z.string().trim().min(2).max(160).optional(),
  title: z.string().trim().min(2).max(160).optional(),
  status: z.enum(["Draft", "Submitted", "Approved", "Rejected"]).optional().default("Draft"),
  reportDate: z.union([z.string(), z.date()]).optional(),
  notes: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  totalTasks: z.coerce.number().optional(),
  valueSold: z.coerce.number().optional(),
  successRate: z.coerce.number().optional(),
  followUpsDone: z.coerce.number().optional(),
  missedLeads: z.coerce.number().optional(),
  meta: z.record(z.any()).optional(),
  metrics: z.record(z.any()).optional(),
  assignedTo: z.string().uuid().optional(),
}).strict();

export const updateSchema = createSchema.partial();

const parseDate = (val?: string) => (val ? new Date(val) : undefined);

export function registerGmBvPoolRoutes(app: Express) {
  const router = Router();

  router.get("/gm-bv-pool", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 10;
      const search = (req.query.q as string) ?? (req.query.search as string) ?? "";
      const status = (req.query.status as string) ?? undefined;
      const dateFrom = parseDate(req.query.from as string | undefined);
      const dateTo = parseDate(req.query.to as string | undefined);
      const result = await gmBvPoolRepository.list({
        userId: req.user.userId,
        roleId: req.user.roleId,
        search,
        status,
        dateFrom,
        dateTo,
        page,
        pageSize,
      });
      return res.json(result);
    } catch (error) {
      console.error("Error fetching GM BV pool:", error);
      return res.status(500).json({ error: "Failed to fetch GM BV pool" });
    }
  });

  router.get("/gm-bv-pool/summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const period = (req.query.period as string) || "TD";
      const summary = await gmBvPoolRepository.summary({
        userId: req.user.userId,
        roleId: req.user.roleId,
        period,
      });
      return res.json(summary);
    } catch (error) {
      console.error("Error fetching GM BV pool summary:", error);
      return res.status(500).json({ error: "Failed to fetch GM BV pool summary" });
    }
  });

  router.post("/gm-bv-pool", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = createSchema.parse(req.body);
      const created = await gmBvPoolRepository.create(req.user.userId, req.user.roleId, parsed);
      return res.status(201).json({ success: true, id: created.id });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "VALIDATION_ERROR", details: error.errors });
      }
      console.error("Error creating GM BV entry:", error);
      return res.status(500).json({ error: "Failed to create GM BV entry" });
    }
  });

  router.patch("/gm-bv-pool/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = updateSchema.parse(req.body);
      const result = await gmBvPoolRepository.update(req.user.userId, req.params.id, parsed);
      if (!result.rowCount) {
        return res.status(404).json({ error: "GM BV entry not found" });
      }
      return res.json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "VALIDATION_ERROR", details: error.errors });
      }
      console.error("Error updating GM BV entry:", error);
      return res.status(500).json({ error: "Failed to update GM BV entry" });
    }
  });

  router.post("/gm-bv-pool/:id/assign", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = z.object({ assignedTo: z.string().uuid() }).parse(req.body);
      const result = await gmBvPoolRepository.assign(req.params.id, parsed.assignedTo, req.user.userId, req.user.roleId);
      if (!result.rowCount) {
        return res.status(404).json({ error: "GM BV entry not found or not authorized" });
      }
      return res.json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "VALIDATION_ERROR", details: error.errors });
      }
      console.error("Error assigning GM BV entry:", error);
      return res.status(500).json({ error: "Failed to assign GM BV entry" });
    }
  });

  router.post("/gm-bv-pool/:id/link-customer", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const linked = await gmBvPoolRepository.linkCustomer(req.params.id, req.user.userId, req.user.roleId);
      if (!linked?.customerId) {
        return res.status(404).json({ error: "GM BV entry not found, not authorized, or could not link customer" });
      }
      return res.json({ success: true, customerId: linked.customerId });
    } catch (error) {
      console.error("Error linking GM BV entry to customer:", error);
      return res.status(500).json({ error: "Failed to link GM BV entry to customer" });
    }
  });

  router.delete("/gm-bv-pool/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await gmBvPoolRepository.remove(req.user.userId, req.params.id, req.user.roleId);
      if (!result.rowCount) {
        return res.status(404).json({ error: "GM BV entry not found or not authorized" });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting GM BV entry:", error);
      return res.status(500).json({ error: "Failed to delete GM BV entry" });
    }
  });

  router.post("/gm-bv-pool/:id/withdraw", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await gmBvPoolRepository.withdraw(req.user.userId, req.params.id, req.user.roleId);
      if (!result.rowCount) {
        return res.status(404).json({ error: "GM BV entry not found or not authorized" });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("Error withdrawing GM BV entry:", error);
      return res.status(500).json({ error: "Failed to withdraw GM BV entry" });
    }
  });

  app.use("/api", router);
}

export default registerGmBvPoolRoutes;
