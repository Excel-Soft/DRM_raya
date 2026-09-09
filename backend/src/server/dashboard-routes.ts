import { Router, type Application, type Request } from "express";
import { authMiddleware } from "./middleware/auth.middleware";
import { DashboardController } from "./controllers/dashboard.controller";

const router = Router();

router.get("/activities", authMiddleware, DashboardController.getActivities);
router.get("/chart-data", authMiddleware, DashboardController.getChartData);
router.get("/current-month-trend", authMiddleware, DashboardController.getCurrentMonthTrend);
router.get("/daily-team-meeting", authMiddleware, DashboardController.getDailyTeamMeeting);
router.get("/followups", authMiddleware, DashboardController.getFollowups);
router.get("/team-work-performance", authMiddleware, DashboardController.getTeamWorkPerformance);
router.get("/team-meetings/active", authMiddleware, DashboardController.getActiveTeamMeetings);
router.post("/team-meetings/:userId/start", authMiddleware, DashboardController.startTeamMeeting);
router.post("/team-meetings/:userId/end", authMiddleware, DashboardController.endTeamMeeting);
router.get("/summary", authMiddleware, DashboardController.getSummary);
router.get("/revenue-series", authMiddleware, DashboardController.getRevenueSeries);
router.get("/orders-series", authMiddleware, DashboardController.getOrdersSeries);
router.get("/top-products", authMiddleware, DashboardController.getTopProducts);
router.get("/sales-by-channel", authMiddleware, DashboardController.getSalesByChannel);
router.get("/orders", authMiddleware, DashboardController.getOrders);
router.get("/top-customers", authMiddleware, DashboardController.getTopCustomers);
router.get("/low-stock-products", authMiddleware, DashboardController.getLowStockProducts);

export function registerDashboardRoutes(app: Application) {
  app.use("/api/dashboard", router);
  return app;
}

// STUB (best-effort real implementation — the original was missing from this
// checkout, this is inferred from its two call patterns below): no department
// hierarchy table is available here, so this always returns null, meaning
// "no restriction" — managers see unfiltered results rather than the app
// crashing or wrongly hiding data. Restore the real implementation once it's
// recovered from the team.
export async function getDepartmentFilterUserIds(
  _reqLike: Request | { user: { userId: string; roleId: string; activeRoleId?: string } },
): Promise<string[] | null> {
  return null;
}

// Mirrors the equivalent local helper already used in sales-routes.ts.
export function getPeriodRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);

  switch (period) {
    case "TD":
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
      break;
    case "WC":
      from.setDate(now.getDate() - 7);
      break;
    case "MONTH":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      from.setDate(now.getDate() - 7);
  }

  return { from, to };
}
