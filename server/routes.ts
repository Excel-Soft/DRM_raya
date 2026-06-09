import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { pool, checkDbHealth, getDbUnavailableReason, isNetworkOrDnsError, markDbUnavailable } from "./db";
import { storage } from "./storage";
import aiRoutes from "./ai-routes";
import authRoutes from "./auth.routes";
import { registerSalesRoutes } from "./sales-routes";
import { registerPmsRoutes } from "./pms-routes";
import { registerSupportRoutes } from "./support-routes";
import { registerSettingsRoutes } from "./settings-routes";
import { registerAttendanceRoutes } from "./attendance-routes";
import { registerAttendanceEditRoutes } from "./attendance-edit-routes";
import { registerSalaryRoutes } from "./salary-routes";
import { registerStage3ReportsRoutes } from "./stage3-reports-routes";
import { registerLeaveRoutes } from "./leave-routes";
import { registerOvertimeRoutes } from "./overtime-routes";
import { registerLoanRoutes } from "./loan-routes";
import { registerReportsRoutes } from "./reports-routes";
import { registerTodoRoutes } from "./todo-routes";
// Manager routes removed
import { registerAccountRoutes } from "./account-routes";
import { registerGmBvPoolRoutes } from "./gm-bv-pool-routes";
import tempContactsRoutes from "./temp-contacts-routes";
import poolsRoutes from "./pools-routes";
import trainingRoutes from "./training-routes";
import crmRoutes from "./crm-routes";
import officeAccountRoutes from "./office-account-routes";
import { checkUrlPermission, checkAllowedIp } from "./settings.middleware";
import { usersRepository } from "./repositories/users.repository";
import { registerHodRoutes } from "./hod-routes";
import { registerQuickEntriesRoutes } from "./quick-entries-routes";
import { registerDashboardRoutes } from "./dashboard-routes";
import { registerGmPoolRoutes } from "./gm-pool-routes";
import { registerProjectActivityRoutes } from "./project-activity-routes";
import { registerQuotationRoutes } from "./quotation-routes";
import { registerServicePoolRoutes } from "./service-pool-routes";
import { authMiddleware, getAuthToken } from "./auth.middleware";
import { authService } from "./auth.service";
import { normalizeRole } from "./utils/role-utils";
import usersRoutes from "./users-routes";
import adminActivityRoutes from "./admin-activity-routes";
import rbacRoutes from "./rbac-routes";
import attributesRoutes from "./attributes-routes";
import drmRoutes from "./drm-routes";
import { registerBotRoutes } from "./bot-routes";
import { registerFormRoutes } from "./form-routes";
import { registerFbRoutes } from "./fb-routes";
import { registerDdManagerRoutes } from "./dd-manager-routes";
import { registerDdExecutiveRoutes } from "./dd-executive-routes";
import noticeRoutes from "./notice-routes";
import policyRoutes from "./policy-routes";
import portfolioRoutes from "./portfolio-routes";
import itAssetsRoutes from "./it-assets-routes";
import receptionRoutes from "./reception-routes";

import { registerServiceExecutiveRoutes } from "./service-executive-routes";
import { registerServiceManagerRoutes } from "./service-manager-routes";
import { registerServiceCoreRoutes } from "./service-core-routes";
import { registerServiceReportsRoutes } from "./service-reports-routes";
// Product Posting Workflow Routes
import { invoiceRouter } from "./routes/invoice-routes";
import { projectDocRouter } from "./routes/project-doc-routes";
import { taskExecutionRouter } from "./routes/task-execution-routes";
import { notificationRouter } from "./routes/notification-routes";
import { productPostingWorkflowRouter } from "./routes/product-posting-workflow-routes";
import { softwareWorkflowRouter } from "./routes/software-workflow-routes";
import { registerPostingDataRoutes } from "./posting-data-routes";
import { registerLeadsImportRoutes } from "./leads-import-routes";
import targetSystemRoutes from "./target-system-routes";
import { registerPerformanceRoutes } from "./performance-routes";
import { registerIncrementRoutes } from "./increment-routes";
import { registerPenaltyRoutes } from "./penalty-routes";
import { registerPromotionRoutes } from "./promotion-routes";
import { registerTodayPostRoutes } from "./today-post-routes";
import { registerCommissionVerificationRoutes } from "./commission-verification-routes";
import { registerSocialAccountsRoutes } from "./social-accounts-routes";
import { registerLateComingRoutes } from "./late-coming-routes";
import { registerEventsRoutes } from "./events-routes";
import { registerTeamReportLinkReportRoutes } from "./team-report-link-report-routes";
import { registerProjectReportRoutes } from "./project-report-routes";
import { communicationRouter } from "./routes/communication-routes";
import { CommunicationService } from "./services/communication.service";


export async function registerRoutes(app: Express): Promise<Server> {
  // SECURITY (J): MOCK_AUTH bypasses real JWT authentication. It must never be
  // active in production. If it is enabled in a production build, refuse to start.
  if (process.env.NODE_ENV === "production" && process.env.MOCK_AUTH === "true") {
    throw new Error(
      "FATAL: MOCK_AUTH=true is not allowed when NODE_ENV=production. " +
        "Mock authentication bypasses real auth and would expose the app. " +
        "Unset MOCK_AUTH (or set it to false) before starting in production.",
    );
  }

  // To enable legacy mock auth (NOT recommended), set MOCK_AUTH=true.
  // Refreshing server to apply .env changes...
  if (process.env.MOCK_AUTH === "true") {
    console.warn("MOCK_AUTH=true: Using header/env-based mock user (unsafe for multi-user deployments).");
    app.use("/api", async (req, res, next) => {
      try {
        const headerEmail = req.headers["x-mock-user-email"];
        const email =
          (typeof headerEmail === "string" && headerEmail.trim() ? headerEmail.trim() : undefined) ??
          (process.env.MOCK_AUTH_EMAIL?.trim() ? process.env.MOCK_AUTH_EMAIL.trim() : undefined) ??
          "admin@webexcels.com";

        const user = await usersRepository.findByEmail(email);
        if (!user) {
          return res.status(401).json({ error: `Mock user not found for email: ${email}` });
        }

        const actingRole = req.headers["x-acting-role"] as string;
        const normalizedActingRole = actingRole ? normalizeRole(actingRole) : undefined;

        req.user = {
          userId: user.id,
          email: user.email,
          roleId: normalizedActingRole || (user as any).role_id || (user as any).role || "",
          activeRoleId: normalizedActingRole || (user as any).role_id || (user as any).role || "",
          role: actingRole || (user as any).role || "",
          roles: (user as any).roles || [],
          branch: (user as any).branch || "",
          country: (user as any).country || "",
        } as any;
        return next();
      } catch (error) {
        console.error("Error fetching mock user:", error);
        return res.status(500).json({ error: "Failed to authenticate mock user" });
      }
    });
  }

  // DRM Routes
  app.use("/api/drm", drmRoutes);

  // Authentication routes (public)
  app.use("/api/auth", authRoutes);

  // Attributes routes
  app.use("/api", attributesRoutes);

  // Lightweight DB health check (public)
  // Lightweight DB health check (public)
  const dbHealthHandler = async (_req: Request, res: Response) => {
    const health = await checkDbHealth();
    if (health.ok) {
      return res.status(200).json({ ok: true, db: "up", time: new Date().toISOString() });
    }
    return res.status(503).json({
      ok: false,
      db: "down",
      code: "UNREACHABLE",
      message: health.error || getDbUnavailableReason() || "Database unreachable",
      time: new Date().toISOString(),
    });
  };
  app.get("/health/db", dbHealthHandler);
  app.get("/api/health/db", dbHealthHandler);

  // Auth health check (reports presence/validity of token or cookie)
  const authHealthHandler = (req: Request, res: Response) => {
    const tokenInfo = getAuthToken(req);
    const base = {
      hasAuthHeader: tokenInfo.hasAuthHeader,
      hasAuthCookie: tokenInfo.hasAuthCookie,
    };

    if (!tokenInfo.token) {
      return res.status(401).json({ ok: false, authenticated: false, reason: "missing-token", ...base });
    }

    try {
      const payload = authService.verifyToken(tokenInfo.token);
      const userId = (payload as any).userId ?? (payload as any).id ?? (payload as any).user_id;
      const roleId = normalizeRole(
        (payload as any).roleId ?? (payload as any).role ?? (payload as any).role_id,
      );

      return res.json({
        ok: true,
        authenticated: true,
        userId,
        roleId,
        email: (payload as any).email ?? null,
        ...base,
      });
    } catch (err: any) {
      return res.status(401).json({
        ok: false,
        authenticated: false,
        reason: err?.message || "Invalid token",
        ...base,
      });
    }
  };
  app.get("/health/auth", authHealthHandler);
  app.get("/api/health/auth", authHealthHandler);

  // Protect all other API routes with JWT auth.
  if (process.env.MOCK_AUTH !== "true") {
    app.use("/api", authMiddleware);
  }

  // Basic profile/settings endpoints for user menu
  app.get("/api/me/profile", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      const user = await usersRepository.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      return res.json({
        id: user.id,
        name: user.name ?? user.username ?? user.email,
        email: user.email,
        roleId: (user as any).roleId ?? (user as any).role_id ?? "sales_executive",
        branch: (user as any).branch ?? null,
        country: (user as any).country ?? null,
        createdAt: (user as any).createdAt ?? (user as any).created_at ?? null,
      });
    } catch (err: any) {
      console.error("Failed to fetch profile", err);
      return res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/me/settings", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.userId || (req.user as any)?.id;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      return res.json({
        userId,
        preferences: {
          theme: "light",
          notifications: true,
          language: "en",
        },
      });
    } catch (err: any) {
      console.error("Failed to fetch settings", err);
      return res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // IP restriction (only enforced if IP_RESTRICTION_ENABLED=true env var is set)
  app.use(checkAllowedIp);

  // URL permission checking (enforces role-based access control)
  app.use(checkUrlPermission);

  // AI Assistant routes (protected)
  app.use("/api/ai", aiRoutes);

  // Sales routes (protected)
  registerSalesRoutes(app);

  // PMS routes (protected)
  registerPmsRoutes(app);

  // Support routes (protected)
  registerSupportRoutes(app);
  registerGmPoolRoutes(app);
  registerGmBvPoolRoutes(app);
  registerProjectActivityRoutes(app);
  registerQuotationRoutes(app);
  registerServicePoolRoutes(app);

  // Register newly created Service Department Workflow Routes
  registerServiceExecutiveRoutes(app);
  registerServiceManagerRoutes(app);
  registerServiceCoreRoutes(app);
  await registerServiceReportsRoutes(app);

  // Settings routes (protected)
  registerSettingsRoutes(app);

  // Attendance routes (protected)
  registerAttendanceRoutes(app);
  registerAttendanceEditRoutes(app);
  registerTodoRoutes(app);

  // Salary / payroll routes (protected, role-guarded)
  registerSalaryRoutes(app);

  // Leave routes (protected)
  registerLeaveRoutes(app);

  // Overtime routes (protected)
  registerOvertimeRoutes(app);

  // Loan routes (protected)
  registerLoanRoutes(app);

  // D&D Manager → Project Report routes (protected). Mounted BEFORE the reports
  // router so the exact /api/reports/projects path wins over its /reports/:type
  // parameterized route.
  registerProjectReportRoutes(app);

  // Stage 3 report endpoints with exact /api/reports/* paths. Mounted BEFORE the
  // reports router so they win over its /reports/:type parameterized route.
  registerStage3ReportsRoutes(app);

  registerReportsRoutes(app);
  registerAccountRoutes(app);
  registerQuickEntriesRoutes(app);
  registerDashboardRoutes(app);
  registerHodRoutes(app);
  registerBotRoutes(app);
  registerFormRoutes(app);
  registerFbRoutes(app);
  registerDdManagerRoutes(app);
  registerDdExecutiveRoutes(app);

  // Temp contacts routes (protected)
  app.use("/api/customer/temporary-contact", tempContactsRoutes);
  app.use("/api/temp-contact", tempContactsRoutes);

  // Pools routes (protected)
  app.use("/api/pools", poolsRoutes);

  // Training routes (protected)
  app.use("/api/training", trainingRoutes);


  // CRM routes (protected) - consolidated endpoints for customers, activities, meetings, etc.
  app.use("/api/crm", crmRoutes);
  app.use("/api", crmRoutes); // Add root mounting for /api/customers/search

  // Office Account routes (protected)
  app.use("/api/office", officeAccountRoutes);

  // Users management routes (protected)
  app.use("/api/users", usersRoutes);

  // Admin activity/dashboard routes (protected)
  app.use("/api/admin/activities", adminActivityRoutes);

  // RBAC & Role Navigator routes (protected)
  app.use("/api", rbacRoutes);

  app.use("/api/notice-board", noticeRoutes);
  app.use("/api/policies", policyRoutes);
  app.use("/api/portfolio", portfolioRoutes);
  app.use("/api/it", itAssetsRoutes);

  // Reception routes
  app.use("/api/reception", receptionRoutes);

  // Product Posting Workflow Routes (protected)
  app.use("/api/invoices", invoiceRouter);
  app.use("/api/projects", projectDocRouter);
  app.use("/api/tasks", taskExecutionRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/product-posting", productPostingWorkflowRouter);
  app.use("/api/software", softwareWorkflowRouter);

  // Stage 7 — unified communication / follow-up timeline (protected). Ensure the
  // runtime table/enums exist before serving (db:push is broken repo-wide).
  await CommunicationService.ensureSchema();
  app.use("/api/communications", communicationRouter);
  registerPostingDataRoutes(app);
  registerLeadsImportRoutes(app);
  app.use("/api/target-system", targetSystemRoutes);

  // Performance System routes (protected, read-only) — mounted after auth middleware
  registerPerformanceRoutes(app);

  // Increment Management routes (protected) — mounted after auth + permission middleware
  registerIncrementRoutes(app);

  // Penalty Management routes (protected) — mounted after auth + permission middleware
  registerPenaltyRoutes(app);

  // Stage 7 DRM/DD operations (protected) — mounted after auth + permission middleware.
  // Awaited because each registrar runs idempotent table DDL before serving requests.
  await registerPromotionRoutes(app);
  await registerTodayPostRoutes(app);
  await registerCommissionVerificationRoutes(app);
  await registerSocialAccountsRoutes(app);
  await registerLateComingRoutes(app);

  // Stage 8 Events (persistence/workflow) routes (protected) — mounted after auth +
  // permission middleware. Awaited because the registrar runs idempotent table DDL
  // before serving requests.
  await registerEventsRoutes(app);

  // Team Report → Link Report routes (protected) — mounted after auth + permission middleware
  registerTeamReportLinkReportRoutes(app);

  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const httpServer = createServer(app);

  return httpServer;
}
