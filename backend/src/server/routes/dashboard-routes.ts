import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { DashboardController } from "../controllers/dashboard.controller";
import { pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "../db";
import type { PoolClient } from "pg";

// Moving ensureTables logic here to keep routes file complete
let ensureTablesPromise: Promise<void> | null = null;
async function ensureTables() {
  if (ensureTablesPromise) return ensureTablesPromise;
  ensureTablesPromise = (async () => {
    if (!isDbAvailable()) {
      console.warn("[dashboard] skipping ensure tables because database is unavailable");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("set statement_timeout = 10000");
      await client.query(`
        create table if not exists products (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          sku text not null,
          price numeric(12,2) not null default 0,
          cost numeric(12,2) not null default 0,
          stock int not null default 0,
          created_at timestamptz not null default now()
        );
      `);
      await client.query(`
        create table if not exists refunds (
          id uuid primary key default gen_random_uuid(),
          order_id uuid not null,
          amount numeric(12,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
      `);
      await client.query(`
        create table if not exists branches (
          id uuid primary key default gen_random_uuid(),
          name text not null unique
        );
      `);
    } finally {
      client.release();
    }
  })().catch(err => {
    ensureTablesPromise = null;
    throw err;
  });
  return ensureTablesPromise;
}

async function ensureTablesWithRetry() {
  const attempts = [500, 1000, 2000, 4000, 8000];
  for (let i = 0; i < attempts.length; i++) {
    try {
      await ensureTables();
      return;
    } catch (err) {
      const wait = attempts[i];
      if (isNetworkOrDnsError(err)) {
        markDbUnavailable((err as any)?.message || "db unreachable", err);
        return;
      }
      if (i === attempts.length - 1) return;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

// Re-export this so users.controller.ts doesn't break
export { getDepartmentFilterUserIds } from "../controllers/dashboard.controller";

export function registerDashboardRoutes(app: Express) {
  app.use("/api/dashboard", authMiddleware);
  app.use("/api/orders", authMiddleware);
  app.use("/api/customers", authMiddleware);
  app.use("/api/products", authMiddleware);

  ensureTablesWithRetry().catch((err) => console.error("Failed to ensure analytics tables", err));

  app.get("/api/dashboard/summary", DashboardController.getSummary);
  app.get("/api/dashboard/revenue-series", DashboardController.getRevenueSeries);
  app.get("/api/dashboard/orders-series", DashboardController.getOrdersSeries);
  app.get("/api/dashboard/top-products", DashboardController.getTopProducts);
  app.get("/api/dashboard/sales-by-channel", DashboardController.getSalesByChannel);
  app.get("/api/dashboard/activities", DashboardController.getActivities);
  app.get("/api/dashboard/current-month-trend", DashboardController.getCurrentMonthTrend);
  app.get("/api/dashboard/daily-team-meeting", DashboardController.getDailyTeamMeeting);
  app.post("/api/dashboard/team-meetings/:userId/start", DashboardController.startTeamMeeting);
  app.post("/api/dashboard/team-meetings/:userId/end", DashboardController.endTeamMeeting);
  app.get("/api/dashboard/team-meetings/active", DashboardController.getActiveTeamMeetings);
  app.get("/api/dashboard/team-queue-performance", DashboardController.getTeamQueuePerformance);
  app.get("/api/dashboard/followups", DashboardController.getFollowups);
  app.get("/api/dashboard/team-work-performance", DashboardController.getTeamWorkPerformance);
  app.get("/api/orders", DashboardController.getOrders);
  app.post("/api/orders", DashboardController.createOrder);
  app.patch("/api/orders/:id/status", DashboardController.updateOrderStatus);
  app.post("/api/orders/:id/refund", DashboardController.refundOrder);
  app.get("/api/orders/export.csv", DashboardController.exportOrders);
  app.get("/api/customers/top", DashboardController.getTopCustomers);
  app.get("/api/products/low-stock", DashboardController.getLowStockProducts);
  app.get("/api/dashboard/chart-data", DashboardController.getChartData);
}
