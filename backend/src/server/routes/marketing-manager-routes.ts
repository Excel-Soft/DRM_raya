import { Request, Response, Router } from "express";
import { requireRole } from "../middleware/auth.middleware";
import {
  fetchMarketingDashboardEvents,
  fetchMarketingUploadedLeads,
} from "../services/marketing-manager-dashboard.service";

const router = Router();

const ROLES = ["marketing_manager", "manager", "hod", "super_hod", "admin"] as const;

router.use(requireRole(...ROLES));

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "ld";
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "10"), 10) || 10));
    const scope = String(req.query.leadScope || "org").toLowerCase();
    const userId =
      scope === "mine"
        ? ((req as any).user?.userId || (req as any).user?.id || null)
        : null;

    const [eventsPayload, leadsPayload] = await Promise.all([
      fetchMarketingDashboardEvents(period),
      fetchMarketingUploadedLeads(page, limit, userId),
    ]);

    res.json({
      events: eventsPayload.events,
      stats: eventsPayload.stats,
      leads: leadsPayload.rows,
      leadsMeta: { total: leadsPayload.total, page, limit },
    });
  } catch (error: any) {
    console.error("Marketing dashboard error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;