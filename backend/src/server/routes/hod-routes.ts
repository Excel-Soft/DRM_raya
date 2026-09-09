import type { Express, Request, Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import { hodRepository } from "../repositories/hod.repository";
import { projectsRepository } from "../repositories/projects.repository";
import { pool } from "../db";
import { isHodAllowed, normalizeRole, isManagerialRole } from "../utils/role-utils";
import { getDepartmentFilterUserIds } from "./dashboard-routes";
import { registerHodQuickActionRoutes } from "./hod-quick-actions.routes";
import { generateInvoicesAfterFinalGmApproval } from "./services/gm-invoice-generation.service";
import { resolveOrCreateCanonicalDrmId } from "../utils/drm-id-utils";
import { GM_INVOICE_GENERATION_TIMING } from "../../shared/gm-sales-constants";
import { NotificationService } from "./services/notification-service";


const router = Router();

// Accepts HOD/Admin/Manager as elevated roles for these routes
// NOTE: If a user's role is updated in DB, they must log out/in to refresh the JWT payload.
function requireHod(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  
  // Bypass role check in local dev when MOCK_AUTH is enabled to avoid UI sync issues
  if (process.env.MOCK_AUTH === "true") {
    return next();
  }
  const rawRole = req.user.roleId;
  const tokenRole = normalizeRole(rawRole);
  if (!isHodAllowed(tokenRole)) {
    console.warn(
      `[${new Date().toISOString()}] HOD_GUARD 403 ${req.method} ${req.originalUrl} userId=${req.user.userId} rawRole="${rawRole}" tokenRole="${tokenRole}" allowed="${["hod", "admin", "manager"].join(",")}"`,
    );
    return res
      .status(403)
      .json({
        success: false,
        message:
          "Access denied: HOD/Admin required. If your role was changed in DB, logout/login (or refresh token) to update your access.",
      });
  }
  // ensure normalized role propagates
  req.user.roleId = tokenRole;
  next();
}

function logApi(req: Request, status: number, payload: unknown) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
  console.log(`Status: ${status}`);
  console.log(`Body: ${JSON.stringify(req.body)}`);
  console.log(`Response: ${JSON.stringify(payload)}`);
}


router.get("/daily-report", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const role = req.user!.roleId;
      // Allow broader access for the Product Posting Dashboard
      const isManager = isManagerialRole(role) || isHodAllowed(role);

      const period = String(req.query.period || 'daily').toLowerCase();
      let dateFilter = '';
      if (period === 'daily' || period === 'today') {
        dateFilter = "AND t.created_at >= CURRENT_DATE";
      } else if (period === 'yesterday') {
        dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '1 day' AND t.created_at < CURRENT_DATE";
      } else if (period === 'weekly') {
        dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (period === 'monthly') {
        dateFilter = "AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'";
      }

      const queryText = `
        SELECT 
          t.id,
          u.username as "name",
          p.name as "company",
          p.workspace as "project",
          '0' as "free",
          t.title as "task",
          t.status,
          '0' as "run",
          COALESCE(SUM(ttl.duration_minutes), 0) || ' mins' as "spent",
          t.created_at as "createdAt",
          p.id as "projectId"
        FROM drm.tasks t
        LEFT JOIN drm.users u ON t.assigned_to_user_id = u.id
        LEFT JOIN drm.projects p ON t.project_id = p.id
        LEFT JOIN drm.task_time_logs ttl ON t.id = ttl.task_id
        WHERE 1=1
        ${isManager ? "" : "AND t.assigned_to_user_id = $1::uuid"}
        ${dateFilter}
        GROUP BY t.id, u.username, p.name, p.workspace, p.id
        ORDER BY t.created_at DESC
        LIMIT 20
      `;
      const result = await client.query(queryText, isManager ? [] : [req.user!.userId]);

      const response = { success: true, data: result.rows };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD daily report fetch error:", error);
    const response = { success: false, message: "Failed to load daily report" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/dashboard/important-stats", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // This endpoint is shared by the real HOD/Super HOD dashboards (which
      // should see company-wide numbers) AND several department-manager
      // dashboards (SEO/SMM, Product Posting, Verification, QA) that were
      // previously getting the exact same unscoped, company-wide project
      // counts under their own department's header. getDepartmentFilterUserIds
      // returns null only for true global roles — a department manager gets
      // back their own team's user ids instead.
      const activeRoleForScope = (req.user as any)?.activeRoleId || req.user?.roleId;
      const allowedProjectUserIds = isManagerialRole(activeRoleForScope)
        ? await getDepartmentFilterUserIds(req)
        : null;
      const projectScopeParams: any[] = [];
      let projectScopeSql = "";
      if (allowedProjectUserIds) {
        projectScopeParams.push(allowedProjectUserIds);
        projectScopeSql = `AND (owner_user_id = ANY($1::uuid[]) OR (owner_user_id IS NULL AND created_by = ANY($1::uuid[])))`;
      }

      // Real statistics queries
      const statsQuery = await client.query(`
        SELECT
          COUNT(*) as "total",
          COUNT(CASE WHEN LOWER(status) IN ('completed', 'success', 'approved') THEN 1 END) as "completed",
          COUNT(CASE WHEN LOWER(status) IN ('in progress', 'active') THEN 1 END) as "in_progress",
          COUNT(CASE WHEN LOWER(status) IN ('pending', 'waiting', 'ready_for_qa') THEN 1 END) as "pending",
          COUNT(CASE WHEN (end_date < NOW()) AND LOWER(status) = 'active' THEN 1 END) as "delayed"
        FROM drm.projects
        WHERE 1=1 ${projectScopeSql}
      `, projectScopeParams);
      const upcomingQuery = await client.query(`
        SELECT COUNT(*) as count
        FROM drm.projects
        WHERE end_date >= NOW() AND end_date <= NOW() + INTERVAL '7 days'
        ${projectScopeSql}
      `, projectScopeParams);

      // Get GM Verification Pending count
      const gmPendingQuery = await client.query(`
        SELECT COUNT(*) as count FROM drm.gm_entries 
        WHERE (approval_status IS NULL OR approval_status = 'pending_hod')
        AND COALESCE(is_deleted, false) = false
      `);

      // Get Leave application count (strictly pending)
      const leaveCount = await client.query(`
        SELECT COUNT(*) as count
        FROM drm.leave_requests
        WHERE status = 'Pending'
      `);

      // Get active team count (users)
      const activeTeam = await client.query(`
        SELECT COUNT(*) as count
        FROM drm.users
        WHERE is_active = true
      `);

      // Get real QA-verification-pending count (tasks actually awaiting QA,
      // not a re-labeled copy of the project "pending" count).
      const qaVerificationQuery = await client.query(`
        SELECT COUNT(*) as count
        FROM drm.tasks
        WHERE status = 'READY_FOR_QA'
      `);

      const row = statsQuery.rows[0];
      const total = parseInt(row.total || '0');
      const completed = parseInt(row.completed || '0');
      const pending = parseInt(row.pending || '0');
      const delayed = parseInt(row.delayed || '0');
      const inProgress = parseInt(row.in_progress || '0');
      const upcoming = parseInt(upcomingQuery.rows[0]?.count || '0');
      const gmPending = parseInt(gmPendingQuery.rows[0]?.count || '0');
      const leaves = parseInt(leaveCount.rows[0]?.count || '0');
      const activeUsers = parseInt(activeTeam.rows[0]?.count || '0');
      const qaVerification = parseInt(qaVerificationQuery.rows[0]?.count || '0');

      const stats = {
        delayProjects: delayed,
        upcoming: upcoming,
        completed: completed,
        inProgress: inProgress,
        pending: pending, // Project Pending
        qaVerification: qaVerification, // Tasks actually in READY_FOR_QA, distinct from "Pending"
        leaveApplication: leaves,
        activeTeam: activeUsers,
        depVerification: gmPending, // GM Verification
        activities: {
          totalProjects: total,
          complete: completed,
          pending: pending,
          delay: delayed,
          free: Math.max(0, total - inProgress - completed),
        }
      };

      const response = { success: true, data: stats };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD important stats error:", error);
    const response = { success: false, message: "Failed to load important stats" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/projects/delayed", async (req, res) => {
  try {
    const data = await projectsRepository.getDetailedDelayedProjects();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("HOD detailed delayed projects error:", error);
    return res.status(500).json({ success: false, message: "Failed to load detailed delayed projects" });
  }
});

router.get("/projects/upcoming", async (req, res) => {
  try {
    const data = await projectsRepository.getDetailedUpcomingProjects();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("HOD detailed upcoming projects error:", error);
    return res.status(500).json({ success: false, message: "Failed to load detailed upcoming projects" });
  }
});

router.use(requireHod);

router.get("/dashboard/summary", async (req, res) => {
  try {
    const period = typeof req.query.period === "string" ? req.query.period : undefined;
    const data = await hodRepository.getSummary(period);
    const response = { success: true, data };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("HOD summary error:", error);
    const response = { success: false, message: "Failed to load summary" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/approvals", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const { items, total } = await hodRepository.getPendingApprovals(page, limit);

    const response = {
      success: true,
      data: items,
      meta: { total, page, limit },
    };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("HOD approvals error:", error);
    const response = { success: false, message: "Failed to load approvals" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.post("/approvals/:id/approve", async (req, res) => {
  try {
    const approvalId = req.params.id;
    const updated = await hodRepository.approveApproval(approvalId, req.user!.userId);
    if (!updated) {
      const response = { success: false, message: "Approval not found or already processed" };
      logApi(req, 404, response);
      return res.status(404).json(response);
    }
    const response = { success: true, message: "Approved successfully", data: updated };
    logApi(req, 200, response);

    // Generate 3 default invoices when a GM entry is approved
    if (updated && (updated as any).source === "gm_entries") {
      try {
        const gmId = approvalId;
        await generateInvoicesAfterFinalGmApproval(gmId, req.user!.userId, req);
        console.log(`[HOD] Invoices generated for GM ${gmId} after approval`);
      } catch (invErr) {
        console.error("[HOD] Invoice generation failed (non-fatal):", invErr);
      }
    }

    return res.json(response);



  } catch (error) {
    console.error("HOD approve error:", error);
    const response = { success: false, message: "Failed to approve" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.post("/approvals/:id/reject", async (req, res) => {
  try {
    const approvalId = req.params.id;
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const updated = await hodRepository.rejectApproval(approvalId, req.user!.userId, reason);
    if (!updated) {
      const response = { success: false, message: "Approval not found or already processed" };
      logApi(req, 404, response);
      return res.status(404).json(response);
    }
    const response = { success: true, message: "Rejected successfully", data: updated };
    logApi(req, 200, response);
    return res.json(response);



  } catch (error) {
    console.error("HOD reject error:", error);
    const response = { success: false, message: "Failed to reject" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

// Quick actions
const leaveApproveSchema = z.object({ leaveId: z.string().uuid() });
router.post("/leaves/approve", async (req, res) => {
  try {
    const { leaveId } = leaveApproveSchema.parse(req.body);
    await pool.query(
      `update drm.leave_requests
       set status = 'Approved', approved_by = $2, updated_at = now()
       where id = $1`,
      [leaveId, req.user!.userId],
    );
    const response = { success: true, message: "Leave approved" };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("HOD leave approve error:", error);
    const response = { success: false, message: "Failed to approve leave" };
    logApi(req, 400, response);
    return res.status(400).json(response);
  }
});

router.post("/projects/escalate", async (req, res) => {
  const response = { success: true, message: "Project escalation recorded" };
  logApi(req, 200, response);
  return res.json(response);
});

router.post("/gm/reassign", async (req, res) => {
  const response = { success: true, message: "GM reassignment recorded" };
  logApi(req, 200, response);
  return res.json(response);
});

router.post("/notify-sales", async (req, res) => {
  const response = { success: true, message: "Sales team notified" };
  logApi(req, 200, response);
  return res.json(response);
});

router.post("/reports", async (req, res) => {
  const response = { success: true, message: "Report request queued" };
  logApi(req, 200, response);
  return res.json(response);
});

router.post("/sync", async (req, res) => {
  const response = { success: true, message: "Sync triggered" };
  logApi(req, 200, response);
  return res.json(response);
});

// Verification endpoints
router.get("/verification/gms", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ge.id,
          ge.drm_id as "drmId",
          ge.member_id as "memberId",
          ge.order_id as "orderId",
          ge.company_name as "company",
          ge.sales_person_name as "salePerson",
          ge.added_by_name as "servicePerson",
          ge.package_type as "package",
          ge.entry_type as "type",
          ge.amount_usd as "orderDollar",
          ge.customer_dollar as "customerDollar",
          ge.dollar_rate as "dollarRate",
          ge.amount_pkr as "pkr",
          ge.alibaba_discount_usd as "alibabaDiscount",
          ge.extra_discount_usd as "extraDiscount",
          ge.extra_discount_pkr as "extraDiscountPkr",
          ge.extra_discount_hod as "extraDiscountHod",
          ge.final_order_usd as "finalOrder",
          ge.is_partial_payment as "isPartial",
          ge.is_loan as "isLoan",
          ge.canonical_gm_type as "canonicalGmType",
          ge.status,
          ge.hod_status as "hodStatus",
          ge.accountant_status as "accountantStatus",
          ge.payment_status as "paymentStatus",
          ge.payment_proof_url as "paymentProofUrl",
          ge.installments as "installments",
          ge.created_at as "createdAt",
          ge.updated_at as "updatedAt"
        FROM drm.gm_entries ge
        WHERE (ge.approval_status IS NULL OR ge.approval_status = 'pending_hod')
        ORDER BY ge.created_at DESC
        LIMIT 100
      `);

      // Simplified logging to avoid potential runtime errors
      console.log(`[DEBUG] Found ${result.rows.length} GM entries.`);
      if (result.rows.length > 0) {
        console.log("First entry status:", result.rows[0].status);
      }

      const response = { success: true, data: result.rows };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD GMs fetch error:", error);
    const response = { success: false, message: "Failed to load GM pool entries" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

// Phase 3 — the financial fields below (discounts, dollar rate, PKR/USD
// amounts, installments) previously flowed straight from req.body into the
// (already-parameterized) UPDATE below with no validation at all.
const gmVerificationInstallmentSchema = z
  .object({
    dollar: z.coerce.number().finite().nonnegative().optional(),
    pkr: z.coerce.number().finite().nonnegative().optional(),
    chequeNo: z.string().trim().max(100).optional(),
    payDate: z.string().trim().max(40).optional(),
  })
  .strict();

export const gmVerificationStatusSchema = z
  .object({
    status: z.enum(["Approved", "Rejected"]),
    installments: z.array(gmVerificationInstallmentSchema).max(60).optional(),
    extraDiscountHod: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    extraDiscountPkr: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    extraDiscount: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    alibabaDiscount: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    dollarRate: z.coerce.number().finite().positive().max(10_000).optional(),
    pkr: z.coerce.number().finite().nonnegative().max(1_000_000_000_000).optional(),
    orderDollar: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    customerDollar: z.coerce.number().finite().nonnegative().max(1_000_000_000).optional(),
    notes: z.string().trim().max(2000).optional(),
    accountType: z.string().trim().max(60).optional(),
  })
  .strict();

router.post("/verification/gms/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = gmVerificationStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid request payload", details: parsed.error.errors });
    }
    const { status, installments, extraDiscountHod, extraDiscountPkr, extraDiscount,
      alibabaDiscount, dollarRate, pkr, orderDollar, customerDollar, notes, accountType } = parsed.data;

    const client = await pool.connect();
    try {
      // Approval is gated server-side (not just in the UI) on Extra Discount HOD
      // exactly matching the Sales-requested Extra Discount — mirrors the check
      // in handleSaveGmStatus on the client, but re-validated here against the
      // entry's own stored extra_discount_usd so it can't be bypassed by a
      // direct API call that skips or spoofs the client-side check.
      if (status === "Approved") {
        const currentRes = await client.query(
          `SELECT COALESCE(extra_discount_usd, 0)::numeric AS extra_discount_usd FROM drm.gm_entries WHERE id = $1`,
          [id],
        );
        if (currentRes.rows.length === 0) {
          const response = { success: false, message: "GM entry not found" };
          logApi(req, 404, response);
          return res.status(404).json(response);
        }
        const requestedDiscount = Number(currentRes.rows[0].extra_discount_usd ?? 0);
        if (extraDiscountHod === undefined) {
          const response = {
            success: false,
            message: "Extra Discount HOD is required before this GM entry can be approved.",
          };
          logApi(req, 400, response);
          return res.status(400).json(response);
        }
        if (Math.abs(extraDiscountHod - requestedDiscount) > 0.01) {
          const response = {
            success: false,
            message: `Extra Discount HOD (${extraDiscountHod}) must exactly match the requested Extra Discount (${requestedDiscount}) before this GM entry can be approved.`,
          };
          logApi(req, 400, response);
          return res.status(400).json(response);
        }
      }

      // Build dynamic SET clauses for optional fields
      const setClauses: string[] = [
        "status = $1",
        "hod_status = $1",
        "updated_at = now()"
      ];
      const params: any[] = [status, id];
      let paramIdx = 3;

      // When HOD approves, move to next stage so Account Manager can see it
      if (status === "Approved") {
        setClauses.push("approval_status = 'pending_managers'");
        setClauses.push("account_manager_status = 'pending'");
        setClauses.push(`hod_approved_by = $${paramIdx++}`);
        setClauses.push(`hod_approved_at = now()`);
        params.push(req.user!.userId); // becomes $3
      }


      if (installments !== undefined) {
        setClauses.push(`installments = $${paramIdx++}`);
        params.push(JSON.stringify(installments));
      }
      if (extraDiscountHod !== undefined) {
        setClauses.push(`extra_discount_hod = $${paramIdx++}`);
        params.push(extraDiscountHod || 0);
      }
      if (extraDiscountPkr !== undefined) {
        setClauses.push(`extra_discount_pkr = $${paramIdx++}`);
        params.push(extraDiscountPkr || 0);
      }
      if (extraDiscount !== undefined) {
        setClauses.push(`extra_discount_usd = $${paramIdx++}`);
        params.push(extraDiscount || 0);
      }
      if (alibabaDiscount !== undefined) {
        setClauses.push(`alibaba_discount_usd = $${paramIdx++}`);
        params.push(alibabaDiscount || 0);
      }
      if (dollarRate !== undefined) {
        setClauses.push(`dollar_rate = $${paramIdx++}`);
        params.push(dollarRate || 0);
      }
      if (pkr !== undefined) {
        setClauses.push(`amount_pkr = $${paramIdx++}`);
        params.push(pkr || 0);
      }
      if (orderDollar !== undefined) {
        setClauses.push(`amount_usd = $${paramIdx++}`);
        params.push(orderDollar || 0);
      }
      if (customerDollar !== undefined) {
        setClauses.push(`customer_dollar = $${paramIdx++}`);
        params.push(customerDollar || 0);
      }
      if (notes !== undefined) {
        setClauses.push(`notes = $${paramIdx++}`);
        params.push(notes || '');
      }
      if (accountType !== undefined) {
        setClauses.push(`entry_type = $${paramIdx++}`);
        params.push(accountType || 'New');
      }

      const updateResult = await client.query(
        `UPDATE drm.gm_entries SET ${setClauses.join(', ')} WHERE id = $2
         RETURNING company_name, created_by, sales_person_id, sales_person_name, customer_id`,
        params
      );

      // Send notification to the GM entry creator
      const entry = updateResult.rows[0];
      if (entry) {
        // Resolve the user to notify: sales_person_id > customer owner > sales_person_name match > created_by
        let notifyUserId = entry.sales_person_id || null;

        if (!notifyUserId && entry.customer_id) {
          const custRes = await client.query(
            "SELECT owner_user_id FROM drm.customers WHERE id = $1",
            [entry.customer_id]
          );
          if (custRes.rows[0]?.owner_user_id) notifyUserId = custRes.rows[0].owner_user_id;
        }

        if (!notifyUserId && entry.sales_person_name) {
          const userRes = await client.query(
            "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
            [entry.sales_person_name.trim()]
          );
          if (userRes.rows[0]?.id) notifyUserId = userRes.rows[0].id;
        }

        // Final fallback: notify the person who created the GM entry
        if (!notifyUserId && entry.created_by) {
          notifyUserId = entry.created_by;
        }

        if (notifyUserId) {
          const companyName = entry.company_name || 'Unknown';
          const notifMsg = status === "Approved"
            ? `Your GM entry for '${companyName}' has been approved by the HOD. It has been forwarded to the Account Department for further review.`
            : `Your GM entry for '${companyName}' has been rejected by the HOD. Please contact your manager for further details.`;

          try {
            await NotificationService.notify({
              userId: String(notifyUserId),
              message: notifMsg,
              type: status === "Approved" ? "SUCCESS" : "ERROR",
              targetUrl: "/account/gm-entries"
            });
            console.log(`[HOD] Notification sent to user ${notifyUserId} for GM ${id} - ${status}`);
          } catch (notifErr) {
            console.error("[HOD] Failed to send GM status notification:", notifErr);
          }
        } else {
          console.warn(`[HOD] Could not resolve notifyUserId for GM entry ${id}`);
        }
      }

      // Generate default invoices when HOD approves an existing GM entry
      if (status === "Approved" && entry) {
        try {
          const creatorId = entry.sales_person_id || entry.created_by || (req.user as any)?.userId;
          await generateInvoicesAfterFinalGmApproval(String(id), String(creatorId), req);
          console.log(`[HOD] Invoices generated for GM entry ${id} after HOD approval`);
        } catch (invErr) {
          console.error("[HOD] Invoice generation failed (non-fatal):", invErr);
        }
      }

      const response = { success: true, message: `GM entry ${status} successfully` };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD GM status update error:", error);
    const response = { success: false, message: "Failed to update GM status" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});


router.get("/verification/leave-requests", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          lr.id,
          lr.user_id as "userId",
          u.username as "userName",
          u.email as "userEmail",
          lr.from_date as "fromDate",
          lr.to_date as "toDate",
          lr.type,
          -- lr.purpose removed as column missing in DB
          -- lr.leave_type also removed
          -- lr.description also removed
          lr.reason,
          lr.status,
          lr.approved_by as "approvedBy",
          lr.created_at as "createdAt"
        FROM drm.leave_requests lr
        LEFT JOIN drm.users u ON lr.user_id = u.id
        ORDER BY lr.created_at DESC
        LIMIT 100
      `);

      const response = { success: true, data: result.rows };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD leave requests fetch error:", error);
    const response = { success: false, message: "Failed to load leave requests" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/verification/waiting", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ge.id,
          ge.company_name as "companyName",
          ge.drm_id as "drmId",
          ge.status,
          ge.created_at as "createdAt",
          u.username as "createdByName"
        FROM drm.gm_entries ge
        LEFT JOIN drm.users u ON ge.created_by = u.id
        WHERE ge.status IN ('Pending', 'Waiting', 'In Review')
        ORDER BY ge.created_at DESC
        LIMIT 100
      `);

      const response = { success: true, data: result.rows };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD waiting projects fetch error:", error);
    const response = { success: false, message: "Failed to load waiting projects" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/verification/update-requests", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Fetch Temp GM entries with creator name
      const tempGms = await client.query(`
        SELECT 
          t.id, 
          'Temp GM' as type,
          t.company_name as "company",
          u.username as "salePerson",
          t.amount,
          t.amount_type,
          t.reason,
          t.created_at as "createdAt",
          t.status
        FROM drm.temp_gm_entries t
        LEFT JOIN drm.users u ON t.created_by_user_id = u.id
        WHERE t.status IN ('pending', 'Pending')
      `);

      // Fetch Refund GM entries with creator name
      const refundGms = await client.query(`
        SELECT 
          r.id, 
          'Refund GM' as type,
          r.company_name as "company",
          u.username as "salePerson",
          r.amount,
          r.amount_type,
          r.comment as reason,
          r.created_at as "createdAt",
          r.status
        FROM drm.refund_gm_entries r
        LEFT JOIN drm.users u ON r.created_by_user_id = u.id
        WHERE r.status IN ('pending', 'Pending')
      `);

      // Fetch GM entries with active update requests
      const gmUpdateRequests = await client.query(`
        SELECT 
          ge.id,
          'GM Update' as type,
          ge.company_name as "company",
          ge.sales_person_name as "salePerson",
          ge.amount_usd as "orderDollar",
          ge.package_type as "package",
          ge.dollar_rate as "dollarRate",
          ge.amount_pkr as "pkr",
          ge.alibaba_discount_usd as "alibabaDiscount",
          ge.extra_discount_usd as "extraDiscount",
          ge.payment_status as "status",
          ge.accountant_status as "accountantStatus",
          ge.created_at as "createdAt",
          ge.drm_id as "drmId"
        FROM drm.gm_entries ge
        WHERE ge.update_request_status IS NOT NULL
      `);

      const mapToGmStructure = (item: any) => {
        const alibaba = parseFloat(item.alibabaDiscount || 0);
        const extra = parseFloat(item.extraDiscount || 0);
        const totalDiscount = alibaba + extra;
        const amount = parseFloat(item.orderDollar || item.amount || 0);

        // Calculate percentages if possible
        const alibabaPct = amount > 0 ? Math.round((alibaba / (amount + totalDiscount)) * 100) : 0;
        const extraPct = amount > 0 ? Math.round((extra / (amount + totalDiscount)) * 100) : 0;
        const totalPct = alibabaPct + extraPct;

        return {
          id: item.id,
          drmId: item.drmId || "-",
          companyName: item.company,
          salePerson: item.salePerson,
          package: item.package || "Basic",
          type: item.type || "New",
          orderDollar: amount,
          dollarRate: item.dollarRate || "0",
          pkr: item.pkr || item.amount || "0",
          discount: `$${alibaba} (${alibabaPct}%)`,
          extraDiscount: `$${extra} (${extraPct}%)`,
          totalDiscount: `$${totalDiscount} (${totalPct}%)`,
          status: item.status || "Pending",
          accountantStatus: item.accountantStatus || "Pending",
          createdAt: item.createdAt,
          reason: item.reason || ""
        };
      };

      const allRequests = [
        ...tempGms.rows.map(mapToGmStructure),
        ...refundGms.rows.map(mapToGmStructure),
        ...gmUpdateRequests.rows.map(mapToGmStructure)
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      console.log(`[DEBUG] Update Requests: Temp=${tempGms.rowCount}, Refund=${refundGms.rowCount}, GM=${gmUpdateRequests.rowCount}, Total=${allRequests.length}`);
      if (allRequests.length === 0) {
        console.log("[DEBUG] Refund GMs Query Result:", JSON.stringify(refundGms.rows));
      }

      const response = { success: true, data: allRequests };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD update requests fetch error:", error);
    const response = { success: false, message: "Failed to load update requests" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

router.get("/verification/withdrawals", async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Fetch GM entries with pending withdrawal requests
      const result = await client.query(`
        SELECT 
          ge.id,
          ge.entry_type as type,
          ge.company_name as "company",
          ge.drm_id as "drmId",
          ge.member_id as "memberId",
          ge.order_id as "orderId",
          ge.sales_person_name as "salePerson",
          ge.amount_usd as "amount",
          'USD' as amount_type,
          ge.amount_pkr as pkr,
          ge.withdrawal_reason as reason,
          ge.withdrawal_requested_at as "createdAt",
          ge.status,
          u.username as "requestedByName"
        FROM drm.gm_entries ge
        LEFT JOIN drm.users u ON ge.withdrawal_requested_by = u.id
        WHERE ge.withdrawal_status = 'pending_hod'
          AND COALESCE(ge.is_deleted, false) = false
        ORDER BY ge.withdrawal_requested_at ASC
      `);

      const response = { success: true, data: result.rows };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD withdrawals fetch error:", error);
    const response = { success: false, message: "Failed to load withdrawals" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

// HOD approves withdrawal request
router.post("/verification/withdrawals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE drm.gm_entries
       SET withdrawal_status = 'approved',
           status = 'Withdrawn',
           approval_status = 'pending_hod',
           hod_status = 'Pending',
           account_manager_status = 'pending',
           super_hod_status = NULL,
           hod_approved_at = NULL,
           hod_approved_by = NULL,
           account_manager_approved_at = NULL,
           account_manager_approved_by = NULL,
           withdrawal_actioned_by = $2,
           withdrawal_actioned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND withdrawal_status = 'pending_hod'
       RETURNING id`,
      [id, req.user!.userId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "No pending withdrawal request found" });
    const response = { success: true, message: "Withdrawal approved. Entry marked as Withdrawn." };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("HOD withdraw approve error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve withdrawal" });
  }
});

// HOD rejects withdrawal request
router.post("/verification/withdrawals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE drm.gm_entries
       SET withdrawal_status = 'rejected',
           withdrawal_actioned_by = $2,
           withdrawal_actioned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND withdrawal_status = 'pending_hod'
       RETURNING id`,
      [id, req.user!.userId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "No pending withdrawal request found" });
    const response = { success: true, message: "Withdrawal request rejected." };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("HOD withdraw reject error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject withdrawal" });
  }
});

// ─── SUPER HOD: GM Update Requests ─────────────────────────────────────────

// Fetch all pending update requests for Super HOD (separate from HOD route above)
router.get("/verification/super-hod-update-requests", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ge.id,
        ge.drm_id as "drmId",
        ge.member_id as "memberId",
        ge.order_id as "orderId",
        ge.company_name as "companyName",
        ge.sales_person_name as "salesPersonName",
        ge.package_type as "package",
        ge.entry_type as "entryType",
        ge.amount_usd as "orderDollar",
        ge.customer_dollar as "customerDollar",
        ge.dollar_rate as "dollarRate",
        ge.amount_pkr as "pkr",
        ge.alibaba_discount_usd as "abDiscount",
        ge.extra_discount_usd as "extraDiscount",
        ge.extra_discount_pkr as "extraPkrDiscount",
        ge.extra_discount_hod as "extraDiscountHod",
        ge.notes as "notes",
        ge.installments as "installments",
        ge.update_request_status as "updateRequestStatus",
        ge.update_requested_at as "createdAt",
        u.username as "requestedBy"
      FROM drm.gm_entries ge
      LEFT JOIN drm.users u ON ge.update_requested_by = u.id
      WHERE ge.update_request_status = 'pending_super_hod'
        AND COALESCE(ge.is_deleted, false) = false
      ORDER BY ge.update_requested_at ASC
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Super HOD update-requests fetch error:", error);
    return res.status(500).json({ success: false, message: "Failed to load update requests" });
  }
});

// Super HOD approves update request → Delete becomes visible for Sales Executive
router.post("/verification/update-requests/:id/approve", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE drm.gm_entries
       SET update_request_status = 'super_hod_approved',
           super_hod_status = 'approved',
           super_hod_actioned_by = $2,
           super_hod_actioned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND update_request_status = 'pending_super_hod'
       RETURNING id`,
      [id, req.user.userId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "No pending update request found" });
    return res.json({ success: true, message: "Update request approved. Sales Executive can now delete this entry." });
  } catch (error) {
    console.error("Super HOD update-request approve error:", error);
    return res.status(500).json({ success: false, message: "Failed to approve update request" });
  }
});

// Super HOD rejects update request → Both delete and update options hidden
router.post("/verification/update-requests/:id/reject", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE drm.gm_entries
       SET update_request_status = 'super_hod_rejected',
           super_hod_status = 'rejected',
           super_hod_actioned_by = $2,
           super_hod_actioned_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND update_request_status = 'pending_super_hod'
       RETURNING id`,
      [id, req.user.userId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "No pending update request found" });
    return res.json({ success: true, message: "Update request rejected." });
  } catch (error) {
    console.error("Super HOD update-request reject error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject update request" });
  }
});

router.post("/verification/update-requests/:id/action", async (req, res) => {
  try {
    const { id } = req.params;
    // status: Approved/Rejected
    // type: 'Temp GM' | 'Refund GM'
    // data: { ...fields } (updated values from form)
    const { status, type, data } = req.body;

    if (!status || !["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'Approved' or 'Rejected'" });
    }

    const client = await pool.connect();
    try {
      if (type === 'Temp GM') {
        if (status === 'Approved') {
          const canonicalDrmId = data.drmId || await resolveOrCreateCanonicalDrmId(client, {
            companyName: data.company,
            email: data.email,
            phone: data.phone,
          });

          // Create real GM entry
          await client.query(`
                INSERT INTO drm.gm_entries (
                  drm_id, member_id, order_id, company_name, sales_person_name, package_type,
                  amount_usd, customer_dollar, dollar_rate, amount_pkr,
                  alibaba_discount_usd, extra_discount_usd, extra_discount_pkr, extra_discount_hod,
                  installments, status, hod_status, notes, created_by_user_id, entry_type
                ) VALUES (
                   $1, $2, $3, $4, $5, $6, 
                   $7, $8, $9, $10,
                   $11, $12, $13, $14,
                   $15, 'Pending', 'Approved', $16, $17, 'GM'
                )
             `, [
            canonicalDrmId,
            data.memberId,
            data.orderId,
            data.company,
            data.salePerson,
            data.package || 'Standard',
            data.orderDollar || 0,
            data.customerDollar || 0,
            data.dollarRate || 0,
            data.pkr || 0,
            data.alibabaDiscount || 0,
            data.extraDiscount || 0,
            data.extraDiscountPkr || 0,
            data.extraDiscountHod || 0,
            JSON.stringify(data.installments || []),
            data.reason,
          ]);
          
          // Automatically create the default product-posting invoices (Patch 5
          // Stage 4 / P6). Delegated to the generation service: idempotent,
          // canonical types, gated by configured timing (default ON_GM_CREATION
          // preserves prior behavior). Best-effort: never throws.
          const creatorRes = await client.query('SELECT created_by_user_id FROM drm.temp_gm_entries WHERE id = $1', [id]);
          const creatorId = creatorRes.rows[0]?.created_by_user_id;
          await generateInvoicesAfterFinalGmApproval(String(id), creatorId || (req.user as any)?.userId, req);

          // Update temp entry to Approved
          await client.query('UPDATE drm.temp_gm_entries SET status = $1, hod_approved_at = NOW(), updated_at = NOW() WHERE id = $2', ['Approved', id]);

        } else {
          // Just update status to Rejected
          const rowRes = await client.query('UPDATE drm.temp_gm_entries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['Rejected', id]);
          const entry = rowRes.rows[0];
          if (entry) {
            const creatorId = entry.created_by_user_id || entry.sales_person_id;
            const companyName = entry.company_name || data?.company || "Company";
            const reason = data?.reason || data?.comment || "No reason provided";

            if (creatorId) {
              await NotificationService.notify({
                userId: String(creatorId),
                message: `Your Temp GM entry for '${companyName}' was rejected by HOD. Reason: ${reason}`,
                type: "ERROR",
                targetUrl: "/sales/gm-pool",
              }).catch(() => {});
            }

            await NotificationService.notifyRole(
              "admin",
              `Temp GM entry for '${companyName}' was rejected by HOD. Reason: ${reason}`,
              "ERROR",
              { targetUrl: "/hod/verification" }
            ).catch(() => {});
          }
        }
      } else if (type === 'Refund GM') {
        // For Refund GM, update status and notify
        const rRes = await client.query('UPDATE drm.refund_gm_entries SET status = $1, comment = $2 WHERE id = $3 RETURNING *',
          [status, data.reason || '', id]);
        const entry = rRes.rows[0];
        if (status === 'Rejected' && entry) {
          const creatorId = entry.created_by_user_id || entry.sales_person_id;
          const companyName = entry.company_name || data?.company || "Company";
          const reason = data?.reason || data?.comment || "No reason provided";
          if (creatorId) {
            await NotificationService.notify({
              userId: String(creatorId),
              message: `Your Refund GM entry for '${companyName}' was rejected by HOD. Reason: ${reason}`,
              type: "ERROR",
              targetUrl: "/sales/gm-pool",
            }).catch(() => {});
          }
          await NotificationService.notifyRole(
            "admin",
            `Refund GM entry for '${companyName}' was rejected by HOD. Reason: ${reason}`,
            "ERROR",
            { targetUrl: "/hod/verification" }
          ).catch(() => {});
        }
      } else {
        return res.status(400).json({ success: false, message: "Invalid request type" });
      }

      const response = { success: true, message: `Request ${status} successfully` };
      logApi(req, 200, response);
      return res.json(response);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("HOD update request action error:", error);
    const response = { success: false, message: "Failed to process request" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});


// Get project deadlines
router.get("/dashboard/project-deadlines", async (req, res) => {
  try {
    const filter = (req.query.filter as string) || 'WK';
    const data = await hodRepository.getProjectDeadlines(filter, req.user!.userId);
    const response = { success: true, data };
    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("[HOD] getProjectDeadlines failed", { error });
    const response = { success: false, message: "Failed to load project deadlines" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});

// Super HOD Dashboard Statistics
router.get("/super-stats", async (req, res) => {
  try {
    // Get all GM entries statistics
    const gmStatsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN approval_status = 'approved' OR final_status = 'approved' OR approval_status = 'approved_by_account' THEN 1 END) as approved_count,
        COUNT(CASE WHEN approval_status LIKE 'rejected%' OR final_status = 'rejected' OR status = 'Rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN (approval_status IS NULL OR approval_status = 'pending_hod') AND status = 'Pending' THEN 1 END) as pending_hod,
        COUNT(CASE WHEN approval_status = 'pending_managers' THEN 1 END) as pending_managers,
        COUNT(CASE WHEN approval_status = 'pending_super_hod' THEN 1 END) as pending_super_hod,
        SUM(CASE WHEN approval_status = 'approved' OR final_status = 'approved' OR approval_status = 'approved_by_account' THEN COALESCE(amount_usd, 0) ELSE 0 END) as total_revenue
      FROM drm.gm_entries
    `);

    // Get pending at each stage
    const pendingAccountManagerQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM drm.gm_entries
      WHERE approval_status = 'pending_managers'
      AND hod_approved_at IS NOT NULL
      AND account_manager_approved_at IS NULL
    `);

    const pendingSalesManagerQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM drm.gm_entries
      WHERE approval_status = 'pending_managers'
      AND account_manager_approved_at IS NOT NULL
      AND sales_manager_approved_at IS NULL
    `);

    // Get team member counts by role
    const teamStatsQuery = await pool.query(`
      SELECT 
        role_id,
        COUNT(*) as count
      FROM drm.users
      WHERE role_id IN ('sales_executive', 'account_manager', 'sales_manager', 'Sales Executive', 'Account Manager', 'Sales Manager')
      GROUP BY role_id
    `);

    // Calculate average processing time (approved entries only)
    const avgProcessingQuery = await pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (COALESCE(super_hod_approved_at, sales_manager_approved_at, updated_at) - created_at)) / 86400) as avg_days
      FROM drm.gm_entries
      WHERE (approval_status = 'approved' OR final_status = 'approved' OR approval_status = 'approved_by_account')
      AND created_at IS NOT NULL
    `);

    const gmStats = gmStatsQuery.rows[0];
    const totalEntries = parseInt(gmStats.total_entries) || 0;
    const approvedCount = parseInt(gmStats.approved_count) || 0;
    const rejectedCount = parseInt(gmStats.rejected_count) || 0;
    const pendingHOD = parseInt(gmStats.pending_hod) || 0;
    const pendingAccountManager = parseInt(pendingAccountManagerQuery.rows[0]?.count) || 0;
    const pendingSalesManager = parseInt(pendingSalesManagerQuery.rows[0]?.count) || 0;
    const pendingSuperHOD = parseInt(gmStats.pending_super_hod) || 0;
    const totalRevenue = parseFloat(gmStats.total_revenue) || 0;

    // Calculate approval rate
    const approvalRate = totalEntries > 0
      ? ((approvedCount / totalEntries) * 100).toFixed(1)
      : "0.0";

    // Calculate average processing time
    const avgDays = parseFloat(avgProcessingQuery.rows[0]?.avg_days) || 0;
    const avgProcessingTime = avgDays > 0
      ? `${avgDays.toFixed(1)} days`
      : "N/A";

    // Process team stats
    const teamStats = teamStatsQuery.rows.reduce((acc: any, row: any) => {
      const role = row.role_id.toLowerCase().replace(/\s+/g, '_');
      acc[role] = parseInt(row.count) || 0;
      return acc;
    }, {});

    const response = {
      success: true,
      data: {
        totalGMEntries: totalEntries,
        pendingHOD: pendingHOD,
        pendingAccountManager: pendingAccountManager,
        pendingSalesManager: pendingSalesManager,
        pendingSuperHOD: pendingSuperHOD,
        approved: approvedCount,
        rejected: rejectedCount,
        approvalRate: parseFloat(approvalRate),
        avgProcessingTime: avgProcessingTime,
        totalRevenue: totalRevenue,
        teamPerformance: {
          salesExecutives: teamStats.sales_executive || 0,
          accountManagers: teamStats.account_manager || 0,
          salesManagers: teamStats.sales_manager || 0,
        },
      },
    };

    logApi(req, 200, response);
    return res.json(response);
  } catch (error) {
    console.error("[HOD] super-stats failed", { error });
    const response = { success: false, message: "Failed to load super stats" };
    logApi(req, 500, response);
    return res.status(500).json(response);
  }
});


export function registerHodRoutes(app: Express) {
  console.log("[startup] HOD routes mounted at /api/hod");
  registerHodQuickActionRoutes(router);
  app.use("/api/hod", router);
}
