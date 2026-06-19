import { Router, type Express } from "express";
import { pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "./db";
import { z } from "zod";
import { customersRepository } from "./repositories/customers.repository";
import { tempContactsRepository } from "./repositories/temp-contacts.repository";
import { generateDrmId } from "./utils/drm-id-utils";
import { isManagerialRole, normalizeRole, ROLES } from "./utils/role-utils";
import crypto from "crypto";
import { createProductPostingInvoices } from "./utils/invoice-utils";
import { generateDefaultInvoicesForGm, generateInvoicesAfterFinalGmApproval } from "./services/gm-invoice-generation.service";
import { NotificationService } from "./services/notification-service";
import { requireGmSalesActionPermission, GM_SALES_ACTION_KEYS, resolveAllowedRoles } from "./utils/gm-sales-permissions";
import { getConfig } from "./services/gm-sales-config.service";
import { recordGmSalesAudit, GM_SALES_AUDIT_ACTIONS } from "./services/gm-sales-audit";
import { sendError, sendSuccess, zodIssues } from "./utils/api-response";
import {
  resolveCanonicalGmType,
  checkLoanGmEnabled,
  checkGmCreationThreshold,
  thresholdsConfigured,
  getInitialGmDbState,
  recheckGmThresholdAtApproval,
} from "./services/gm-create-policy.service";
import { mapGmTypeToDbFlags, GM_TYPES, GM_INVOICE_GENERATION_TIMING, type GmSalesConfig } from "../shared/gm-sales-constants";
import { transitionWorkflowStatus } from "./services/workflow-status.service";
import { ApiError } from "./utils/api-error";
import {
  WORKFLOW_ENTITY_TYPES,
  GM_WORKFLOW_STAGES,
  GM_LOAN_ADMIN_GATE_STATES,
  GM_LOAN_ADMIN_GATE_TRANSITIONS,
} from "../shared/gm-sales-constants";

/** Build the central-service actor from the authenticated request user. */
function gmWorkflowActor(req: any) {
  const u = req.user ?? {};
  return {
    userId: u.userId,
    roleId: u.roleId,
    activeRoleId: u.activeRoleId,
    roles: u.roles,
  };
}

/**
 * Patch 5 Stage 2 — re-validate a GM's payment amount against the configured
 * minimum threshold at an approval transition. Short-circuits (no DB read, no
 * behaviour change) when no thresholds are configured, which is the default.
 */
async function enforceApprovalThreshold(
  id: string,
  req: unknown,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  let cfg: GmSalesConfig;
  try {
    cfg = (await getConfig()).config;
  } catch {
    return { ok: false, status: 503, body: { error: "Workflow configuration is unavailable", code: "CONFIG_UNAVAILABLE" } };
  }
  if (!thresholdsConfigured(cfg)) return { ok: true };
  const cur = await pool.query(
    "SELECT is_loan, is_partial_payment, package_type, customer_dollar, amount_usd FROM drm.gm_entries WHERE id = $1",
    [id],
  );
  const e = cur.rows[0];
  if (!e) return { ok: true };
  const amt = Number(e.customer_dollar ?? e.amount_usd ?? 0);
  const recheck = recheckGmThresholdAtApproval({
    config: cfg,
    isLoan: e.is_loan,
    isPartialPayment: e.is_partial_payment,
    packageType: e.package_type,
    amountUsd: amt,
  });
  if (recheck.ok) return { ok: true };
  await recordGmSalesAudit({
    action: GM_SALES_AUDIT_ACTIONS.GM_THRESHOLD_VALIDATION_FAILED,
    entityType: "gm_entry",
    entityId: String(id),
    reason: recheck.message,
    after: recheck.details,
    req: req as any,
  });
  return { ok: false, status: 400, body: { error: recheck.message, code: recheck.code, details: recheck.details } };
}

function parsePagination(page?: string, pageSize?: string) {
  const pageNum = Math.max(1, Number(page) || 1);
  const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 10));
  return { page: pageNum, pageSize: sizeNum };
}

// Ensure required columns exist on gm_entries to safely store GM pool fields
async function ensureGmEntriesColumns() {
  if (!isDbAvailable()) {
    console.warn("[gm-pool] skip ensure columns because database is unavailable");
    return;
  }
  try {
    // Check if table exists first
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'drm' AND table_name = 'gm_entries'
    `);

    if (tableCheck.rowCount === 0) {
       console.warn("[gm-pool] table drm.gm_entries does not exist yet. Skipping column assurance.");
       return;
    }

    await pool.query(`
      ALTER TABLE drm.gm_entries
        ADD COLUMN IF NOT EXISTS payment_status text,
        ADD COLUMN IF NOT EXISTS dropout text,
        ADD COLUMN IF NOT EXISTS extension text,
        ADD COLUMN IF NOT EXISTS payment_proof_url text,
        ADD COLUMN IF NOT EXISTS alibaba_discount_usd decimal(12,2),
        ADD COLUMN IF NOT EXISTS final_order_usd decimal(12,2),
        ADD COLUMN IF NOT EXISTS extra_discount_usd decimal(12,2),
        ADD COLUMN IF NOT EXISTS extra_discount_pkr decimal(15,2),
        ADD COLUMN IF NOT EXISTS withdrawal_status text,
        ADD COLUMN IF NOT EXISTS withdrawal_reason text,
        ADD COLUMN IF NOT EXISTS withdrawal_requested_by uuid,
        ADD COLUMN IF NOT EXISTS withdrawal_requested_at timestamptz,
        ADD COLUMN IF NOT EXISTS withdrawal_actioned_by uuid,
        ADD COLUMN IF NOT EXISTS withdrawal_actioned_at timestamptz,
        ADD COLUMN IF NOT EXISTS update_request_status text,
        ADD COLUMN IF NOT EXISTS update_requested_by uuid,
        ADD COLUMN IF NOT EXISTS update_requested_at timestamptz,
        ADD COLUMN IF NOT EXISTS super_hod_status text,
        ADD COLUMN IF NOT EXISTS super_hod_actioned_by uuid,
        ADD COLUMN IF NOT EXISTS super_hod_actioned_at timestamptz,
        ADD COLUMN IF NOT EXISTS approval_status text,
        ADD COLUMN IF NOT EXISTS final_status text,
        ADD COLUMN IF NOT EXISTS account_manager_status text,
        ADD COLUMN IF NOT EXISTS account_manager_approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS account_manager_approved_by uuid,
        ADD COLUMN IF NOT EXISTS account_manager_comment text,
        ADD COLUMN IF NOT EXISTS hod_approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS hod_approved_by uuid,
        ADD COLUMN IF NOT EXISTS hod_comment text,
        ADD COLUMN IF NOT EXISTS sales_manager_status text,
        ADD COLUMN IF NOT EXISTS sales_manager_approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS sales_manager_approved_by uuid,
        ADD COLUMN IF NOT EXISTS sales_manager_comment text,
        ADD COLUMN IF NOT EXISTS super_hod_approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS super_hod_approved_by uuid,
        ADD COLUMN IF NOT EXISTS super_hod_comment text,
        ADD COLUMN IF NOT EXISTS sales_person_name text
    `);
  } catch (err) {
    console.error("[gm-pool] failed to ensure gm_entries columns", err);
    if (isNetworkOrDnsError(err)) {
      markDbUnavailable((err as any)?.message || "db unreachable", err);
    }
  }
}

const gmPackages = [
  { id: "basic", name: "Basic", priceUsd: 1399, orderDollar: 1399 },
  { id: "basic-plus", name: "Basic Plus", priceUsd: 1999, orderDollar: 1999 },
  { id: "ggs-digital", name: "GGS Digital", priceUsd: 899, orderDollar: 899 },
  { id: "standard", name: "Standard", priceUsd: 2999, orderDollar: 2999 },
  { id: "premium", name: "Premium", priceUsd: 4999, orderDollar: 4999 },
  { id: "verified-supplier", name: "Verified Supplier", priceUsd: 9999, orderDollar: 9999 },
  { id: "kwa", name: "Kwa", priceUsd: 0, orderDollar: 0 },
  { id: "kwa-200", name: "Kwa-200", priceUsd: 200, orderDollar: 200 },
  { id: "kwa-500", name: "Kwa-500", priceUsd: 500, orderDollar: 500 },
  { id: "kwa-1000", name: "Kwa-1000", priceUsd: 1000, orderDollar: 1000 },
  { id: "kwa-2000", name: "Kwa-2000", priceUsd: 2000, orderDollar: 2000 },
  { id: "kwa-5000", name: "Kwa-5000", priceUsd: 5000, orderDollar: 5000 },
  { id: "cat", name: "Cat", priceUsd: 0, orderDollar: 0 },
  { id: "ai", name: "Ai", priceUsd: 0, orderDollar: 0 },
  { id: "psa", name: "Psa", priceUsd: 567, orderDollar: 567 },
  { id: "sa", name: "SA", priceUsd: 0, orderDollar: 0 },
  { id: "rc-up", name: "Rc-Up", priceUsd: 0, orderDollar: 0 },
  { id: "kap", name: "KAP", priceUsd: 9999, orderDollar: 9999 },
  { id: "ggs-pro", name: "GGS Pro", priceUsd: 2799, orderDollar: 2799 },
  { id: "kwa-kap", name: "KWA-KAP", priceUsd: 3000, orderDollar: 3000 },
  { id: "china-trip", name: "China Trip", priceUsd: 2200, orderDollar: 2200 },
  { id: "kwa-pro", name: "Kwa-Pro", priceUsd: 800, orderDollar: 800 },
  { id: "kap-package", name: "KAP-Package", priceUsd: 10999, orderDollar: 10999 },
];

/**
 * Patch 5 Stage 3 — final-approval gate for PARTIAL (P4) and LOAN (P5) GMs.
 * Runs immediately before any transition that finalises a GM (sets
 * `final_status = 'approved'`). FULL GMs are a pure no-op (zero behaviour change).
 * A PARTIAL GM is blocked until its recorded receipts cover the full customer
 * dollar (remaining <= 0); a LOAN GM is blocked until an Admin (Super HOD) has
 * approved its loan terms. Returns the LEGACY `{ error, code, details }` body used
 * by the surrounding approval routes so existing frontends keep working unchanged.
 */
async function enforceLoanPartialFinalApprovalGate(
  id: string,
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const cur = await pool.query(
    "SELECT is_loan, is_partial_payment, COALESCE(customer_dollar, amount_usd, 0)::numeric AS target FROM drm.gm_entries WHERE id = $1",
    [id],
  );
  const e = cur.rows[0];
  if (!e) return { ok: true }; // missing GM → let the route's own 404 handle it
  const isLoan = Number(e.is_loan) === 1;
  const isPartial = Number(e.is_partial_payment) === 1;
  if (!isLoan && !isPartial) return { ok: true }; // FULL GM — no-op

  if (isPartial) {
    const paidRes = await pool.query(
      "SELECT COALESCE(SUM(amount_usd), 0)::numeric AS paid FROM drm.gm_partial_receipts WHERE gm_id = $1",
      [id],
    );
    const target = Number(e.target || 0);
    const paid = Number(paidRes.rows[0]?.paid || 0);
    const remaining = Number((target - paid).toFixed(2));
    if (remaining > 0.009) {
      return {
        ok: false,
        status: 409,
        body: {
          error: `Cannot grant final approval: this partial-payment GM still has an outstanding balance of $${remaining.toFixed(2)}. Record receipts until it is fully paid first.`,
          code: "PARTIAL_PAYMENT_INCOMPLETE",
          details: { target, paid, remaining },
        },
      };
    }
  }

  if (isLoan) {
    const lt = await pool.query(
      "SELECT admin_approval_status FROM drm.gm_loan_terms WHERE gm_id = $1",
      [id],
    );
    const status = (lt.rows[0]?.admin_approval_status as string | undefined) ?? "NONE";
    if (status !== "APPROVED") {
      return {
        ok: false,
        status: 409,
        body: {
          error: "Cannot grant final approval: this loan GM requires Admin (Super HOD) approval of its loan terms first.",
          code: "LOAN_ADMIN_APPROVAL_REQUIRED",
          details: { adminApprovalStatus: status },
        },
      };
    }
  }

  return { ok: true };
}

export function registerGmPoolRoutes(app: Express) {
  const router = Router();
  void ensureGmEntriesColumns();

  const createSchema = z.object({
    companyId: z.string().uuid().optional().nullable(),
    companyName: z.string().trim().min(1, "Company is required"),
    memberId: z.string().trim().min(1, "Member Id is required"),
    orderId: z.string().trim().min(1, "Order Id is required"),
    packageId: z.string().trim().min(1, "Package is required"),
    packageName: z.string().trim().min(1, "Package is required"),
    pkrAmount: z.coerce.number().positive("PKR amount must be greater than 0"),
    dollarRate: z.coerce.number().positive("Dollar rate must be greater than 0"),
    alibabaDiscount: z.coerce.number().min(0, "Alibaba discount cannot be negative"),
    extraPkrDiscount: z.coerce.number().min(0).default(0),
    paymentStatus: z.string().trim().min(1, "Payment status is required"),
    type: z.string().trim().min(1, "Type is required"),
    dropout: z.string().trim().optional().nullable(),
    extension: z.string().trim().optional().nullable(),
    detail: z.string().trim().optional().nullable(),
    loanMode: z.enum(["loan", "installment", "none"]).default("none"),
    paymentProofUrl: z.string().trim().optional().nullable(),
    installments: z.array(z.any()).optional().default([]),
  });

  const updateSchema = z.object({
    package: z.string().optional(),
    type: z.string().optional(),
    orderDollar: z.coerce.number().optional(),
    customerDollar: z.coerce.number().optional(),
    dollarRate: z.coerce.number().optional(),
    pkr: z.coerce.number().optional(),
    status: z.string().optional(),
    hodStatus: z.string().optional(),
    accountantStatus: z.string().optional(),
  });

  router.get("/gm-packages", async (_req, res) => {
    res.json({ packages: gmPackages });
  });

  router.get("/gm-pool", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });

      const { page: pageStr, pageSize: sizeStr, search, customerId, from, to } = req.query;
      const { page, pageSize } = parsePagination(pageStr as string, sizeStr as string);
      const offset = (page - 1) * pageSize;

      const whereParts: string[] = ["coalesce(is_deleted,false) = false"];
      const params: any[] = [];

      const { getDepartmentFilterUserIds } = await import("./dashboard-routes.js");

      const roleToCheck = (req.user as any).activeRoleId || req.user.roleId || "";
      const normalizedRole = normalizeRole(roleToCheck);

      const superRoles = [ROLES.ADMIN, ROLES.SUPER_HOD, ROLES.HOD];
      const isSuperUser = superRoles.includes(normalizedRole as any);
      const isManager = isManagerialRole(normalizedRole);

      if (!isSuperUser) {
        if (isManager) {
          const allowedUserIds = await getDepartmentFilterUserIds(req);
          if (allowedUserIds && allowedUserIds.length > 0) {
            params.push(allowedUserIds);
            whereParts.push(`created_by::uuid = ANY($${params.length}::uuid[])`);
            console.log(`[gm-pool] SECURE FILTER APPLIED for manager ${req.user.userId} acting as ${normalizedRole}. Allowed Users: ${allowedUserIds.length}`);
          } else {
            params.push((req.user as any).userId);
            whereParts.push(`created_by::text = $${params.length}::text`);
          }
        } else {
          params.push((req.user as any).userId);
          whereParts.push(`created_by::text = $${params.length}::text`);
          console.log(`[gm-pool] SECURE FILTER APPLIED for user ${req.user.userId} acting as ${normalizedRole}`);
        }
      } else {
        console.log(`[gm-pool] FULL ACCESS for manager ${req.user.userId} (Role: ${normalizedRole})`);
      }

      if (customerId && typeof customerId === "string") {
        params.push(customerId);
        whereParts.push(`customer_id = $${params.length}`);
      }

      if (search && typeof search === "string" && search.trim()) {
        params.push(`%${search.trim()}%`);
        whereParts.push(`(company_name ilike $${params.length} or drm_id ilike $${params.length} or member_id ilike $${params.length} or order_id ilike $${params.length})`);
      }

      if (from && typeof from === "string") {
        params.push(new Date(from));
        whereParts.push(`created_at >= $${params.length}`);
      }

      if (to && typeof to === "string") {
        params.push(new Date(to));
        whereParts.push(`created_at <= $${params.length}`);
      }

      const whereClause = `where ${whereParts.join(" and ")}`;

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM drm.gm_entries ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.total || "0", 10);

      params.push(pageSize, offset);
      const dataResult = await pool.query(
        `select
          id,
          drm_id as "drmId",
          member_id as "memberId",
          order_id as "orderId",
          customer_id as "customerId",
          company_name as company,
          sales_person_name as "salesPersonName",
          package_type as package,
          entry_type as type,
          amount_usd as "orderDollar",
          customer_dollar as "customerDollar",
          dollar_rate as "dollarRate",
          amount_pkr as pkr,
          alibaba_discount_usd as "abDiscount",
          extra_discount_usd as "extraDiscount",
          extra_discount_pkr as "extraPkrDiscount",
          status,
          payment_status as "paymentStatus",
          hod_status as "hodStatus",
          accountant_status as "accountantStatus",
          withdrawal_status as "withdrawalStatus",
          update_request_status as "updateRequestStatus",
          super_hod_status as "superHodStatus",
          approval_status as "approvalStatus",
          account_manager_status as "accountManagerStatus",
          final_status as "finalStatus",
          is_loan as "isLoan",
          is_partial_payment as "isPartialPayment",
          notes,
          installments,
          dropout,
          extension,
          payment_proof_url as "paymentProofUrl",
          created_at as "createdAt",
          updated_at as "updateRequest"
        FROM drm.gm_entries
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return res.json({
        data: dataResult.rows.map((row: any) => ({
          ...row,
          status: row.paymentStatus || row.status || null,
          bvDate: null,
          accountant: null,
          hod: null,
          alibaba: null,
          payDate: null,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      console.error("[gm-pool] Error fetching GM pool:", error);
      return res.status(500).json({ error: "Failed to fetch GM pool" });
    }
  });

  router.post("/gm", requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_CREATE, { auditUnauthorizedAttempt: true }), async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = createSchema.parse(req.body);
      if (parsed.companyName) parsed.companyName = parsed.companyName.trim();
      const pkg = gmPackages.find((p) => p.id === parsed.packageId);
      if (!pkg) {
        return res.status(400).json({ error: "Invalid package selected" });
      }

      const orderDollar = pkg.orderDollar ?? pkg.priceUsd ?? 0;
      if (parsed.alibabaDiscount > orderDollar) {
        return res.status(400).json({ error: "Alibaba discount cannot exceed order dollar amount" });
      }

      const packagePrice = pkg.priceUsd ?? orderDollar;
      const finalOrderDollar = Number(Math.max(0, orderDollar - parsed.alibabaDiscount).toFixed(2));
      const customerDollar = Number((parsed.pkrAmount / parsed.dollarRate).toFixed(2));
      const extraDollarDiscount = Number((finalOrderDollar - customerDollar).toFixed(2));
      const extraDiscountPkr = Number((extraDollarDiscount * parsed.dollarRate).toFixed(2));
      // Patch 5 Stage 2 — resolve canonical GM type (FULL/PARTIAL/LOAN) and enforce
      // the config-driven loan gate + minimum-payment threshold. Behaviour-preserving
      // with safe defaults (loan enabled, no thresholds). The derived flags below stay
      // the source of the DB is_loan/is_partial_payment columns; gm_type remains 'GM'.
      const typeResult = resolveCanonicalGmType({
        explicit: (req.body as any)?.canonicalGmType ?? (req.body as any)?.gmType,
        loanMode: parsed.loanMode,
      });
      if (!typeResult.ok || !typeResult.value) {
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_TYPE_CHANGE_DENIED,
          entityType: "gm_entry",
          entityId: "n/a",
          reason: typeResult.message,
          after: { explicit: (req.body as any)?.canonicalGmType, loanMode: parsed.loanMode },
          req,
        });
        return res.status(400).json({ error: typeResult.message, code: typeResult.code });
      }
      const canonicalGmType = typeResult.value;
      const gmFlags = mapGmTypeToDbFlags(canonicalGmType).value ?? { isLoan: 0, isPartialPayment: 0 };
      const isLoan = gmFlags.isLoan === 1;
      const isPartial = gmFlags.isPartialPayment === 1;

      let gmConfig: GmSalesConfig;
      try {
        gmConfig = (await getConfig()).config;
      } catch {
        return res.status(503).json({ error: "Workflow configuration is unavailable", code: "CONFIG_UNAVAILABLE" });
      }

      // Patch 5 Stage 2 — type-specific initiator authorization. The route guard
      // (gm.create) is a coarse union gate; here we enforce the per-type allowed-
      // initiator config now that the canonical type is known. Default config lists
      // are identical across types, so this is a no-op unless an admin diverges them.
      const actingRole = normalizeRole(
        (req.user as any)?.activeRoleId ?? (req.user as any)?.roleId ?? "",
      );
      if (actingRole !== ROLES.ADMIN) {
        const typeActionKey =
          canonicalGmType === GM_TYPES.LOAN
            ? GM_SALES_ACTION_KEYS.GM_CREATE_LOAN
            : canonicalGmType === GM_TYPES.PARTIAL
              ? GM_SALES_ACTION_KEYS.GM_CREATE_PARTIAL
              : GM_SALES_ACTION_KEYS.GM_CREATE_FULL;
        const allowedForType = resolveAllowedRoles(typeActionKey, gmConfig);
        if (!allowedForType.includes(actingRole)) {
          await recordGmSalesAudit({
            action: GM_SALES_AUDIT_ACTIONS.GM_CREATE_UNAUTHORIZED_ATTEMPT,
            entityType: "gm_entry",
            entityId: "n/a",
            reason: `Role "${actingRole}" is not permitted to create a ${canonicalGmType} GM`,
            after: { action: typeActionKey, role: actingRole, gmType: canonicalGmType },
            req,
          });
          return res.status(403).json({
            error: "You do not have permission to create this GM type",
            code: "FORBIDDEN",
            details: { gmType: canonicalGmType },
          });
        }
      }

      const loanCheck = checkLoanGmEnabled(gmConfig, canonicalGmType);
      if (!loanCheck.ok) {
        return res.status(400).json({ error: loanCheck.message, code: loanCheck.code });
      }

      const thresholdCheck = checkGmCreationThreshold({
        config: gmConfig,
        gmType: canonicalGmType,
        packageKey: parsed.packageName,
        amountUsd: customerDollar,
      });
      if (!thresholdCheck.ok) {
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_THRESHOLD_VALIDATION_FAILED,
          entityType: "gm_entry",
          entityId: "n/a",
          reason: thresholdCheck.message,
          after: thresholdCheck.details,
          req,
        });
        return res.status(400).json({ error: thresholdCheck.message, code: thresholdCheck.code, details: thresholdCheck.details });
      }

      const createdByRole = (req.user as any)?.activeRoleId ?? (req.user as any)?.roleId ?? null;
      const initialGmState = getInitialGmDbState(canonicalGmType);
      let countryVal = "Other";
      if (parsed.companyId) {
        const cRes = await pool.query("SELECT country FROM drm.customers WHERE id = $1", [parsed.companyId]);
        if (cRes.rows[0]?.country) countryVal = cRes.rows[0].country;
      }
      const drmId = generateDrmId(
        parsed.companyName,
        countryVal,
        parsed.memberId || parsed.companyName,
        parsed.orderId || parsed.memberId || crypto.randomUUID()
      );
      const notesParts = [
        parsed.detail?.trim() || "",
        parsed.dropout ? `Dropout: ${parsed.dropout}` : "",
        parsed.extension ? `Extension: ${parsed.extension}` : "",
        parsed.extraPkrDiscount ? `Extra PKR Discount: ${parsed.extraPkrDiscount}` : "",
        `Extra $ Discount: ${extraDollarDiscount}`,
      ].filter(Boolean);

      // Fetch sales person name from users table
      const userRes = await pool.query("SELECT name FROM drm.users WHERE id = $1", [req.user.userId]);
      const salesPersonName = userRes.rows[0]?.name || req.user.email || "Unknown";

      let finalCustomerId = parsed.companyId ?? null;

      // promotion logic if companyId is from temp_contacts
      if (finalCustomerId) {
        const isAlreadyCustomer = await pool.query("SELECT id FROM drm.customers WHERE id = $1", [finalCustomerId]);
        if (isAlreadyCustomer.rowCount === 0) {
          // Check if it's a temp contact
          const lead = await tempContactsRepository.findById(finalCustomerId, req.user.userId);
          if (lead) {
            console.log(`[gm-pool] promoting lead ${lead.id} to customer for GM entry`);

            // Generate Custom DRM ID
            const drmIdCustom = generateDrmId(
              lead.personName || "Unknown",
              "Other",
              lead.personName,
              crypto.randomUUID()
            );

            // Promote lead to customer
            const newCustomer = await customersRepository.create({
              companyName: lead.personName || "Unknown Company",
              accountName: lead.personName || "Unknown Person",
              email: lead.email || "no-email@temporary.com",
              phone: lead.mobile || "0000000000",
              region: "Other", // Default region
              grade: lead.grade || "C",
              source: lead.source || "GM Form Promotion",
              personName: lead.personName,
              mobile: lead.mobile,
              drmId: drmIdCustom, // Use the new custom ID
            }, req.user.userId);

            finalCustomerId = newCustomer.id;
            // Mark lead as promoted
            await tempContactsRepository.promoteToCustomer(lead.id, newCustomer.id, req.user.userId, req.user.userId);
          }
        }
      }

      // Resolve sales person ID
      let resolvedSalesPersonId = req.user.userId;
      if (finalCustomerId) {
        const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [finalCustomerId]);
        if (custRes.rows[0]?.owner_user_id) {
          resolvedSalesPersonId = custRes.rows[0].owner_user_id;
        }
      }

      const insertSql = `
        INSERT INTO drm.gm_entries (
          id,
          gm_type,
          drm_id,
          member_id,
          order_id,
          company_name,
          package_type,
          entry_type,
          amount,
          amount_usd,
          customer_dollar,
          dollar_rate,
          amount_pkr,
          alibaba_discount_usd,
          final_order_usd,
          extra_discount_usd,
          extra_discount_pkr,
          status,
          payment_status,
          is_loan,
          is_partial_payment,
          notes,
          dropout,
          extension,
          payment_proof_url,
          created_by,
          customer_id,
          installments,
          sales_person_name,
          sales_person_id,
          created_at,
          updated_at,
          is_deleted,
          approval_status,
          created_by_role
        )
        VALUES (
          gen_random_uuid(),
          'GM',
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28, now(), now(), false, 'pending_hod', $29
        )
        returning *
      `;

      // D-05: Prevent duplicate GM entries for the same company/customer
      const duplicateCheck = await pool.query(
        "SELECT id FROM drm.gm_entries WHERE (customer_id = $1 OR lower(trim(company_name)) = lower(trim($2))) AND coalesce(is_deleted, false) = false LIMIT 1",
        [finalCustomerId, parsed.companyName]
      );
      if ((duplicateCheck.rowCount ?? 0) > 0) {
        return res.status(400).json({ error: "Validation Error: A GM entry already exists for this customer or company." });
      }

      const values = [
        drmId,
        parsed.memberId,
        parsed.orderId,
        parsed.companyName,
        parsed.packageName,
        parsed.type,
        finalOrderDollar,
        orderDollar,
        customerDollar,
        parsed.dollarRate,
        parsed.pkrAmount,
        parsed.alibabaDiscount,
        finalOrderDollar,
        extraDollarDiscount,
        extraDiscountPkr,
        "Pending",
        parsed.paymentStatus,
        isLoan,
        isPartial,
        notesParts.join(" | "),
        parsed.dropout ?? null,
        parsed.extension ?? null,
        parsed.paymentProofUrl ?? null,
        req.user.userId,
        finalCustomerId,
        JSON.stringify(parsed.installments || []),
        salesPersonName,
        resolvedSalesPersonId,
        createdByRole,
      ];

      const result = await pool.query(insertSql, values);
      const row = result.rows[0];

      const isOverrideCreate = (() => {
        const r = normalizeRole(createdByRole ?? "");
        return r === ROLES.ADMIN || gmConfig.gmCreateOverrideRoles.map((x) => normalizeRole(x)).includes(r);
      })();
      await recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_CREATE,
        entityType: "gm_entry",
        entityId: String(row.id),
        nextStatus: initialGmState.canonicalStage,
        after: {
          canonicalGmType,
          isLoan,
          isPartialPayment: isPartial,
          status: row.status,
          approvalStatus: row.approval_status,
          packageType: row.package_type,
          amountUsd: customerDollar,
          createdByRole,
          override: isOverrideCreate,
        },
        reason: isOverrideCreate ? "gm_create_override" : undefined,
        req,
      });
      await recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_TYPE_SET,
        entityType: "gm_entry",
        entityId: String(row.id),
        after: { canonicalGmType, source: typeResult.source },
        req,
      });

      // Automatically create the default product-posting invoices (Patch 5
      // Stage 4 / P6). Delegated to the generation service: idempotent per GM,
      // canonical invoice types, and gated by configured timing (default
      // ON_GM_CREATION preserves the prior behavior). Best-effort: never throws.
      await generateDefaultInvoicesForGm({
        gmId: String(row.id),
        customerId: finalCustomerId,
        companyName: parsed.companyName,
        ownerUserId: req.user.userId,
        event: GM_INVOICE_GENERATION_TIMING.ON_GM_CREATION,
        actorUserId: req.user.userId,
        req,
      });

      return res.status(201).json({
        success: true,
        gm: {
          id: row.id,
          drmId: row.drm_id,
          memberId: row.member_id,
          orderId: row.order_id,
          companyName: row.company_name,
          packageType: row.package_type,
          entryType: row.entry_type,
          orderDollar: row.amount_usd,
          customerDollar: row.customer_dollar,
          dollarRate: row.dollar_rate,
          pkrAmount: row.amount_pkr,
          status: row.payment_status ?? row.status,
          paymentStatus: row.payment_status ?? row.status,
          isLoan: row.is_loan,
          isPartialPayment: row.is_partial_payment,
          notes: row.notes,
          dropout: row.dropout,
          extension: row.extension,
          paymentProofUrl: row.payment_proof_url,
          createdAt: row.created_at,
          salesPersonName: row.sales_person_name,
          extraDollarDiscount,
          packagePrice,
        },
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "VALIDATION_ERROR", details: error.errors });
      }
      console.error("Error creating GM entry:", error);
      return res.status(500).json({ error: "Failed to create GM entry" });
    }
  });



  router.patch("/gm-pool/:id", async (req, res) => {
    try {
      const parsed = updateSchema.parse(req.body);

      // Server-side enforcement: Sales Exec can only edit before HOD approval
      if (req.user) {
        const userRole = (req.user as any).roleId?.toLowerCase() || "";
        if (userRole === "sales_executive") {
          const entryCheck = await pool.query(
            `SELECT approval_status FROM drm.gm_entries WHERE id = $1`,
            [req.params.id]
          );
          const entry = entryCheck.rows[0];
          if (entry && entry.approval_status && entry.approval_status !== 'pending_hod') {
            return res.status(403).json({ error: "You cannot edit this entry after HOD approval. Use 'Request Update' instead." });
          }
        }
      }

      const fields: string[] = [];
      const values: any[] = [];

      if (parsed.package !== undefined) {
        fields.push(`package_type = $${fields.length + 1}`);
        values.push(parsed.package);
      }
      if (parsed.type !== undefined) {
        fields.push(`entry_type = $${fields.length + 1}`);
        values.push(parsed.type);
      }
      if (parsed.orderDollar !== undefined) {
        fields.push(`amount_usd = $${fields.length + 1}`);
        values.push(parsed.orderDollar);
      }
      if (parsed.customerDollar !== undefined) {
        fields.push(`customer_dollar = $${fields.length + 1}`);
        values.push(parsed.customerDollar);
      }
      if (parsed.dollarRate !== undefined) {
        fields.push(`dollar_rate = $${fields.length + 1}`);
        values.push(parsed.dollarRate);
      }
      if (parsed.pkr !== undefined) {
        fields.push(`amount_pkr = $${fields.length + 1}`);
        values.push(parsed.pkr);
      }
      if (parsed.status !== undefined) {
        fields.push(`status = $${fields.length + 1}`);
        values.push(parsed.status);
      }
      if (parsed.hodStatus !== undefined) {
        fields.push(`hod_status = $${fields.length + 1}`);
        values.push(parsed.hodStatus);
      }
      if (parsed.accountantStatus !== undefined) {
        fields.push(`accountant_status = $${fields.length + 1}`);
        values.push(parsed.accountantStatus);
      }

      if (fields.length === 0) {
        return res.json({ success: true, message: "No changes applied" });
      }

      const updateSql = `
        UPDATE drm.gm_entries
           SET ${fields.join(", ")},
               updated_at = NOW()
         WHERE id = $${fields.length + 1}
         RETURNING id
      `;
      values.push(req.params.id);
      const result = await pool.query(updateSql, values);
      if (!result.rowCount) {
        return res.status(404).json({ error: "GM entry not found" });
      }
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      console.error("Error updating GM pool entry:", err);
      res.status(500).json({ error: "Failed to update GM entry" });
    }
  });

  // ========== MULTI-STAGE APPROVAL ENDPOINTS ==========

  router.post("/gm-pool/:id/fix-status", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { approval_status } = req.body;
      if (!approval_status) return res.status(400).json({ error: "approval_status required" });
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [id, approval_status]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Entry not found" });
      res.json({ success: true, data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: "Failed to fix status" });
    }
  });

  router.post("/gm-pool/:id/hod-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      const thr = await enforceApprovalThreshold(id, req);
      if (!thr.ok) return res.status(thr.status).json(thr.body);
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'pending_managers', hod_approved_at = NOW(), hod_approved_by = $2, hod_comment = $3, account_manager_status = 'pending', updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_hod' RETURNING *`,
        [id, req.user.userId, comment || null]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      const hodEntry = result.rows[0];

      // Notify Sales Executive that HOD approved and it's now with Account
      let hodSalesPersonId = hodEntry.sales_person_id || hodEntry.created_by;
      if (!hodSalesPersonId && hodEntry.customer_id) {
        const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [hodEntry.customer_id]);
        if (custRes.rows[0]?.owner_user_id) hodSalesPersonId = custRes.rows[0].owner_user_id;
      }
      if (hodSalesPersonId) {
        try {
          await NotificationService.notify({
            userId: hodSalesPersonId,
            message: `Your GM entry for '${hodEntry.company_name || 'Unknown'}' has been approved by the HOD and forwarded to the Account Department for further review.`,
            type: "SUCCESS",
            targetUrl: "/pms/approvals"
          });
        } catch (notifErr) {
          console.error("Failed to send HOD approval notification:", notifErr);
        }
      }

      res.json({ success: true, message: "Approved by HOD.", data: hodEntry });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve GM entry" });
    }
  });

  router.post("/gm-pool/:id/hod-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      // Stage 8: rejecting a GM entry requires a reason.
      if (!String(comment ?? "").trim()) {
        return res.status(400).json({ error: "A reason (comment) is required to reject a GM entry" });
      }
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'rejected_by_hod', final_status = 'rejected', hod_approved_at = NOW(), hod_approved_by = $2, hod_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_hod' RETURNING *`,
        [id, req.user.userId, comment]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      res.json({ success: true, message: "Rejected by HOD", data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject GM entry" });
    }
  });

  router.post("/gm-pool/:id/account-manager-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      const thr = await enforceApprovalThreshold(id, req);
      if (!thr.ok) return res.status(thr.status).json(thr.body);
      // Patch 5 Stage 3 — block final approval of an unpaid PARTIAL / un-admin-approved LOAN GM.
      const gate = await enforceLoanPartialFinalApprovalGate(id);
      if (!gate.ok) return res.status(gate.status).json(gate.body);
      const result = await pool.query(
        `UPDATE drm.gm_entries SET account_manager_status = 'approved', approval_status = 'approved', final_status = 'approved', account_manager_approved_at = NOW(), account_manager_approved_by = $2, account_manager_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_managers' AND account_manager_status = 'pending' RETURNING *`,
        [id, req.user.userId, comment || null]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      const entry = result.rows[0];

      // Patch 5 Stage 4 / P6 — dormant unless timing=AFTER_FINAL_GM_APPROVAL.
      // No-op under the default ON_GM_CREATION policy; never throws.
      await generateInvoicesAfterFinalGmApproval(String(id), req.user.userId, req);

      // Always notify Sales Executive immediately after Account Manager approves
      let salesPersonId = entry.sales_person_id || entry.created_by;
      if (!salesPersonId && entry.customer_id) {
        const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [entry.customer_id]);
        if (custRes.rows[0]?.owner_user_id) salesPersonId = custRes.rows[0].owner_user_id;
      }
      if (!salesPersonId && entry.sales_person_name) {
        const userRes = await pool.query(
          "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
          [entry.sales_person_name.trim()]
        );
        if (userRes.rows[0]?.id) salesPersonId = userRes.rows[0].id;
      }

      if (salesPersonId) {
        try {
          await NotificationService.notify({
            userId: salesPersonId,
            message: `Your GM entry for company '${entry.company_name || 'Unknown'}' has been approved by the Account Manager. Please upload the required documents in the PMS module.`,
            type: "SUCCESS",
            targetUrl: "/pms/approvals"
          });
        } catch (notifErr) {
          console.error("Failed to send account approval notification:", notifErr);
        }
      }

      return res.json({ success: true, message: "GM entry approved by Account Manager! Sales Executive has been notified.", data: entry });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve GM entry" });
    }
  });

  router.post("/gm-pool/:id/account-manager-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      // Stage 8: rejecting a GM entry requires a reason.
      if (!String(comment ?? "").trim()) {
        return res.status(400).json({ error: "A reason (comment) is required to reject a GM entry" });
      }
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'rejected_by_account_manager', final_status = 'rejected', account_manager_status = 'rejected', account_manager_approved_at = NOW(), account_manager_approved_by = $2, account_manager_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_managers' AND account_manager_status = 'pending' RETURNING *`,
        [id, req.user.userId, comment]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      res.json({ success: true, message: "Rejected by Account Manager", data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject GM entry" });
    }
  });

  router.post("/gm-pool/:id/sales-manager-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      const result = await pool.query(
        `UPDATE drm.gm_entries SET sales_manager_status = 'approved', sales_manager_approved_at = NOW(), sales_manager_approved_by = $2, sales_manager_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_managers' AND sales_manager_status = 'pending' RETURNING *`,
        [id, req.user.userId, comment || null]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      const entry = result.rows[0];
      if (entry.account_manager_status === 'approved') {
        // Patch 5 Stage 3 — the Sales Manager approval is recorded above; only the
        // FINAL flip is gated. Hold final approval for an unpaid PARTIAL / un-admin-
        // approved LOAN GM instead of erroring (SM status stays recorded).
        const gate = await enforceLoanPartialFinalApprovalGate(id);
        if (!gate.ok) {
          return res.json({
            success: true,
            finalApprovalBlocked: true,
            code: gate.body.code,
            message: `Sales Manager approval recorded. Final approval is on hold: ${String(gate.body.error)}`,
            data: entry,
          });
        }
        await pool.query(`UPDATE drm.gm_entries SET approval_status = 'approved', final_status = 'approved', updated_at = NOW() WHERE id = $1`, [id]);

        // Patch 5 Stage 4 / P6 — dormant unless timing=AFTER_FINAL_GM_APPROVAL.
        // No-op under the default ON_GM_CREATION policy; never throws.
        await generateInvoicesAfterFinalGmApproval(String(id), req.user.userId, req);

        // Notify Sales Executive
        let salesPersonId = entry.sales_person_id;
        if (!salesPersonId) {
          if (entry.customer_id) {
            const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [entry.customer_id]);
            if (custRes.rows[0]?.owner_user_id) salesPersonId = custRes.rows[0].owner_user_id;
          }
          if (!salesPersonId && entry.sales_person_name) {
            const userRes = await pool.query(
              "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
              [entry.sales_person_name.trim()]
            );
            if (userRes.rows[0]?.id) salesPersonId = userRes.rows[0].id;
          }
          if (!salesPersonId && entry.created_by) {
            salesPersonId = entry.created_by;
          }
        }

        if (salesPersonId) {
          try {
            await NotificationService.notify({
              userId: salesPersonId,
              message: `Your GM entry for company '${entry.company_name || 'Unknown'}' has been fully approved. Please upload the required documents.`,
              type: "SUCCESS",
              targetUrl: "/pms/approvals"
            });
          } catch (notifErr) {
            console.error("Failed to send multi-stage approval notification:", notifErr);
          }
        }

        return res.json({ success: true, message: "All approvals complete!", data: entry });
      }
      res.json({ success: true, message: "Approved by Sales Manager.", data: entry });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve GM entry" });
    }
  });

  router.post("/gm-pool/:id/sales-manager-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'rejected_by_sales_manager', final_status = 'rejected', sales_manager_status = 'rejected', sales_manager_approved_at = NOW(), sales_manager_approved_by = $2, sales_manager_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_managers' AND sales_manager_status = 'pending' RETURNING *`,
        [id, req.user.userId, comment || 'Rejected by Sales Manager']
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      res.json({ success: true, message: "Rejected by Sales Manager", data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject GM entry" });
    }
  });

  router.get("/gm-pool/pending-account-manager", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT * FROM drm.gm_entries WHERE approval_status = 'pending_managers' AND account_manager_status = 'pending' AND is_deleted = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM drm.gm_entries WHERE approval_status = 'pending_managers' AND account_manager_status = 'pending' AND is_deleted = false`
      );
      res.json({ entries: result.rows, meta: { total: parseInt(countResult.rows[0]?.total || '0'), page, pageSize } });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  router.get("/gm-pool/pending-sales-manager", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT * FROM drm.gm_entries WHERE is_deleted = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      const countResult = await pool.query(`SELECT COUNT(*) AS total FROM drm.gm_entries WHERE is_deleted = false`);
      res.json({ entries: result.rows, meta: { total: parseInt(countResult.rows[0]?.total || '0'), page, pageSize } });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch entries" });
    }
  });

  router.get("/gm-pool/pending-super-hod", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
      const offset = (page - 1) * pageSize;
      const result = await pool.query(
        `SELECT * FROM drm.gm_entries WHERE approval_status = 'pending_super_hod' AND is_deleted = false ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      );
      const countResult = await pool.query(
        `SELECT COUNT(*) AS total FROM drm.gm_entries WHERE approval_status = 'pending_super_hod' AND is_deleted = false`
      );
      res.json({ entries: result.rows, meta: { total: parseInt(countResult.rows[0]?.total || '0'), page, pageSize } });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  router.post("/gm-pool/:id/super-hod-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      // Patch 5 Stage 3 — block final approval of an unpaid PARTIAL / un-admin-approved LOAN GM.
      const gate = await enforceLoanPartialFinalApprovalGate(id);
      if (!gate.ok) return res.status(gate.status).json(gate.body);
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'approved', final_status = 'approved', super_hod_approved_at = NOW(), super_hod_approved_by = $2, super_hod_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_super_hod' RETURNING *`,
        [id, req.user.userId, comment || null]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });

      // Patch 5 Stage 4 / P6 — dormant unless timing=AFTER_FINAL_GM_APPROVAL.
      // No-op under the default ON_GM_CREATION policy; never throws.
      await generateInvoicesAfterFinalGmApproval(String(id), req.user.userId, req);

      res.json({ success: true, message: "Final approval by Super HOD!", data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve GM entry" });
    }
  });

  router.post("/gm-pool/:id/super-hod-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { comment } = req.body;
      const result = await pool.query(
        `UPDATE drm.gm_entries SET approval_status = 'rejected_by_super_hod', final_status = 'rejected', super_hod_approved_at = NOW(), super_hod_approved_by = $2, super_hod_comment = $3, updated_at = NOW() WHERE id = $1 AND approval_status = 'pending_super_hod' RETURNING *`,
        [id, req.user.userId, comment || 'Rejected by Super HOD']
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "GM entry not found or already processed" });
      res.json({ success: true, message: "Rejected by Super HOD", data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject GM entry" });
    }
  });

  router.patch("/gm-pool/:id/super-hod-update", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const updates = req.body;
      const fields: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;
      if (updates.orderDollar !== undefined) { fields.push(`amount_usd = $${paramIdx++}`); values.push(updates.orderDollar); }
      if (updates.customerDollar !== undefined) { fields.push(`customer_dollar = $${paramIdx++}`); values.push(updates.customerDollar); }
      if (updates.dollarRate !== undefined) { fields.push(`dollar_rate = $${paramIdx++}`); values.push(updates.dollarRate); }
      if (updates.pkr !== undefined) { fields.push(`amount_pkr = $${paramIdx++}`); values.push(updates.pkr); }
      if (updates.package !== undefined) { fields.push(`package_type = $${paramIdx++}`); values.push(updates.package); }
      if (updates.notes !== undefined) { fields.push(`notes = $${paramIdx++}`); values.push(updates.notes); }
      if (updates.paymentStatus !== undefined) { fields.push(`payment_status = $${paramIdx++}`); values.push(updates.paymentStatus); }
      if (fields.length === 0) return res.json({ success: true, message: "No changes applied" });
      fields.push("updated_at = NOW()");
      values.push(id);
      const result = await pool.query(
        `UPDATE drm.gm_entries SET ${fields.join(", ")} WHERE id = $${paramIdx} AND approval_status = 'pending_super_hod' RETURNING *`,
        values
      );
      if (!result.rowCount) return res.status(404).json({ error: "GM entry not found or not in Super HOD pending status" });
      res.json({ success: true, message: "Entry updated by Super HOD", data: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: "Failed to update GM entry" });
    }
  });

  // ─── UPDATE REQUEST WORKFLOW ──────────────────────────────────────────────

  // Sales Executive requests an update/change → goes to Super HOD for approval
  router.post("/gm-pool/:id/request-update", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE drm.gm_entries
         SET update_request_status = 'pending_super_hod',
             update_requested_by = $2,
             update_requested_at = NOW(),
             super_hod_status = NULL,
             super_hod_actioned_by = NULL,
             super_hod_actioned_at = NULL,
             updated_at = NOW()
         WHERE id = $1
           AND COALESCE(is_deleted, false) = false
           AND approval_status = 'approved'
           AND (update_request_status IS NULL OR update_request_status = 'rejected' OR update_request_status = 'super_hod_rejected')
         RETURNING id`,
        [id, req.user.userId]
      );
      if (!result.rowCount) return res.status(404).json({ error: "Entry not found or update request not allowed in current state" });
      return res.json({ success: true, message: "Update request sent to Super HOD for approval" });
    } catch (err) {
      console.error("[gm-pool] request-update error:", err);
      return res.status(500).json({ error: "Failed to send update request" });
    }
  });

  // Super HOD approves the update request → Delete option becomes visible
  router.post("/gm-pool/:id/super-hod-approve", async (req, res) => {
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
      if (!result.rowCount) return res.status(404).json({ error: "No pending update request found" });
      return res.json({ success: true, message: "Update request approved. Delete option is now available." });
    } catch (err) {
      console.error("[gm-pool] super-hod-approve error:", err);
      return res.status(500).json({ error: "Failed to approve update request" });
    }
  });

  // Super HOD rejects the update request → Both options hidden
  router.post("/gm-pool/:id/super-hod-reject", async (req, res) => {
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
      if (!result.rowCount) return res.status(404).json({ error: "No pending update request found" });
      return res.json({ success: true, message: "Update request rejected." });
    } catch (err) {
      console.error("[gm-pool] super-hod-reject error:", err);
      return res.status(500).json({ error: "Failed to reject update request" });
    }
  });

  // ─── WITHDRAW WORKFLOW ────────────────────────────────────────────────────


  // 1. Sales Executive requests withdrawal → goes to HOD
  router.post("/gm-pool/:id/request-withdraw", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const { reason } = req.body;
      // Stage 8: a withdrawal request requires a reason.
      if (!String(reason ?? "").trim()) {
        return res.status(400).json({ error: "A reason is required to request a withdrawal" });
      }
      const result = await pool.query(
        `UPDATE drm.gm_entries
         SET withdrawal_status = 'pending_hod',
             withdrawal_reason = $2,
             withdrawal_requested_by = $3,
             withdrawal_requested_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND COALESCE(is_deleted, false) = false
         AND (withdrawal_status IS NULL OR withdrawal_status = 'rejected')
         RETURNING id`,
        [id, reason || null, req.user.userId]
      );
      if (!result.rowCount) {
        // Check if it's already pending (idempotent — treat as success)
        const existing = await pool.query(
          `SELECT withdrawal_status FROM drm.gm_entries WHERE id = $1 AND COALESCE(is_deleted, false) = false`,
          [id]
        );
        if (existing.rows[0]?.withdrawal_status === 'pending_hod') {
          return res.json({ success: true, message: "Withdrawal request already pending HOD approval" });
        }
        return res.status(404).json({ error: "Entry not found or cannot be withdrawn in its current state" });
      }
      return res.json({ success: true, message: "Withdrawal request sent to HOD for approval" });
    } catch (err) {
      console.error("[gm-pool] request-withdraw error:", err);
      return res.status(500).json({ error: "Failed to send withdrawal request" });
    }
  });

  // 2. HOD approves withdrawal → entry becomes Withdrawn
  router.post("/gm-pool/:id/withdraw-approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE drm.gm_entries
         SET withdrawal_status = 'approved',
             status = 'Withdrawn',
             withdrawal_actioned_by = $2,
             withdrawal_actioned_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND withdrawal_status = 'pending_hod'
         RETURNING id`,
        [id, req.user.userId]
      );
      if (!result.rowCount) return res.status(404).json({ error: "No pending withdrawal request found" });
      return res.json({ success: true, message: "Withdrawal approved. Entry marked as Withdrawn." });
    } catch (err) {
      console.error("[gm-pool] withdraw-approve error:", err);
      return res.status(500).json({ error: "Failed to approve withdrawal" });
    }
  });

  // 3. HOD rejects withdrawal → request cleared
  router.post("/gm-pool/:id/withdraw-reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE drm.gm_entries
         SET withdrawal_status = 'rejected',
             withdrawal_actioned_by = $2,
             withdrawal_actioned_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND withdrawal_status = 'pending_hod'
         RETURNING id`,
        [id, req.user.userId]
      );
      if (!result.rowCount) return res.status(404).json({ error: "No pending withdrawal request found" });
      return res.json({ success: true, message: "Withdrawal request rejected." });
    } catch (err) {
      console.error("[gm-pool] withdraw-reject error:", err);
      return res.status(500).json({ error: "Failed to reject withdrawal" });
    }
  });

  // HOD: Get all pending withdrawal requests
  router.get("/gm-pool/pending-withdrawals", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const result = await pool.query(
        `SELECT id, drm_id, company_name, member_id, order_id, status,
                withdrawal_reason, withdrawal_requested_at, withdrawal_requested_by,
                created_at
         FROM drm.gm_entries
         WHERE withdrawal_status = 'pending_hod' AND is_deleted = false
         ORDER BY withdrawal_requested_at ASC`
      );
      return res.json({ entries: result.rows });
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch withdrawal requests" });
    }
  });

  router.post("/gm-pool/:id/withdraw", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE drm.gm_entries SET status = 'Withdrawn', updated_at = NOW() WHERE id = $1 AND is_deleted = false RETURNING id`,
        [id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "GM entry not found" });
      return res.json({ success: true, message: "Entry withdrawn" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to withdraw entry" });
    }
  });

  router.delete("/gm-pool/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const result = await pool.query(
        `UPDATE drm.gm_entries SET is_deleted = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!result.rowCount) return res.status(404).json({ error: "GM entry not found" });
      return res.json({ success: true, message: "Entry deleted" });
    } catch (err) {
      return res.status(500).json({ error: "Failed to delete entry" });
    }
  });

  // ===========================================================================
  // Patch 5 Stage 3 — Partial GM receipts (P4) + Loan GM admin/return (P5).
  // New endpoints use the api-response envelope (sendSuccess/sendError). Mutations
  // are guarded by the existing gm-sales permission middleware and audited via
  // recordGmSalesAudit (best-effort). `gm_id` is a plain varchar link to
  // drm.gm_entries(id); existence is validated here in the app layer.
  // ===========================================================================
  async function loadPartialSummary(id: string, target: number) {
    const paidRes = await pool.query(
      "SELECT COALESCE(SUM(amount_usd), 0)::numeric AS paid FROM drm.gm_partial_receipts WHERE gm_id = $1",
      [id],
    );
    const paid = Number(Number(paidRes.rows[0]?.paid || 0).toFixed(2));
    const remaining = Number((target - paid).toFixed(2));
    return { target, paid, remaining, fullyPaid: remaining <= 0.009 };
  }

  const partialReceiptSchema = z.object({
    amountUsd: z.coerce.number().positive(),
    amountPkr: z.coerce.number().nonnegative().optional(),
    dollarRate: z.coerce.number().positive().optional(),
    receiptDate: z.coerce.date().optional(),
    method: z.string().trim().max(80).optional(),
    reference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(1000).optional(),
  });

  // --- P4: list partial receipts + payment summary --------------------------
  router.get("/gm-pool/:id/partial-receipts", async (req, res) => {
    try {
      if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
      const { id } = req.params;
      const gm = await pool.query(
        "SELECT id, company_name, is_partial_payment, is_loan, COALESCE(customer_dollar, amount_usd, 0)::numeric AS target FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
        [id],
      );
      if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
      const receipts = await pool.query(
        `SELECT id, gm_id AS "gmId", amount_usd AS "amountUsd", amount_pkr AS "amountPkr",
                dollar_rate AS "dollarRate", receipt_date AS "receiptDate", method, reference,
                notes, collected_by AS "collectedBy", created_at AS "createdAt"
           FROM drm.gm_partial_receipts WHERE gm_id = $1 ORDER BY receipt_date ASC, created_at ASC`,
        [id],
      );
      const summary = await loadPartialSummary(id, Number(gm.rows[0].target || 0));
      return sendSuccess(res, {
        gmId: id,
        companyName: gm.rows[0].company_name,
        isPartialPayment: Number(gm.rows[0].is_partial_payment) === 1,
        summary,
        receipts: receipts.rows,
      });
    } catch (err) {
      console.error("[gm-pool] list partial receipts error:", err);
      return sendError(res, 500, "INTERNAL", "Failed to load partial receipts");
    }
  });

  // --- P4: record a partial receipt -----------------------------------------
  router.post(
    "/gm-pool/:id/partial-receipts",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_ADD_PARTIAL_RECEIPT, { auditUnauthorizedAttempt: true }),
    async (req, res) => {
      try {
        if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        const { id } = req.params;
        const input = partialReceiptSchema.parse(req.body ?? {});
        const gm = await pool.query(
          "SELECT id, is_partial_payment, COALESCE(customer_dollar, amount_usd, 0)::numeric AS target FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
          [id],
        );
        if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
        if (Number(gm.rows[0].is_partial_payment) !== 1) {
          return sendError(res, 409, "NOT_PARTIAL_GM", "Receipts can only be recorded against a partial-payment GM");
        }
        const target = Number(gm.rows[0].target || 0);
        const before = await loadPartialSummary(id, target);
        if (target > 0 && input.amountUsd - before.remaining > 0.009) {
          return sendError(
            res,
            409,
            "RECEIPT_EXCEEDS_BALANCE",
            `Receipt of $${input.amountUsd.toFixed(2)} exceeds the outstanding balance of $${before.remaining.toFixed(2)}`,
            before,
          );
        }
        const ins = await pool.query(
          `INSERT INTO drm.gm_partial_receipts
             (gm_id, amount_usd, amount_pkr, dollar_rate, receipt_date, method, reference, notes, collected_by)
           VALUES ($1, $2, $3, $4, COALESCE($5, now()), $6, $7, $8, $9) RETURNING *`,
          [
            id,
            input.amountUsd,
            input.amountPkr ?? null,
            input.dollarRate ?? null,
            input.receiptDate ?? null,
            input.method ?? null,
            input.reference ?? null,
            input.notes ?? null,
            req.user.userId,
          ],
        );
        const summary = await loadPartialSummary(id, target);
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_PARTIAL_RECEIPT_ADD,
          entityType: "gm_entry",
          entityId: String(id),
          reason: `Partial receipt of $${input.amountUsd.toFixed(2)} recorded`,
          after: { receiptId: ins.rows[0]?.id, ...summary },
          req,
        });
        return sendSuccess(res, { receipt: ins.rows[0], summary }, 201);
      } catch (err) {
        if (err instanceof z.ZodError) return sendError(res, 400, "VALIDATION", "Invalid receipt data", zodIssues(err));
        console.error("[gm-pool] add partial receipt error:", err);
        return sendError(res, 500, "INTERNAL", "Failed to record receipt");
      }
    },
  );

  // --- P4: confirm a partial GM is fully paid (does NOT set final_status) ----
  router.post(
    "/gm-pool/:id/finalize-partial",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_FINALIZE_PARTIAL, { auditUnauthorizedAttempt: true }),
    async (req, res) => {
      try {
        if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        const { id } = req.params;
        const gm = await pool.query(
          "SELECT id, is_partial_payment, COALESCE(customer_dollar, amount_usd, 0)::numeric AS target FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
          [id],
        );
        if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
        if (Number(gm.rows[0].is_partial_payment) !== 1) {
          return sendError(res, 409, "NOT_PARTIAL_GM", "Only a partial-payment GM can be finalised this way");
        }
        const summary = await loadPartialSummary(id, Number(gm.rows[0].target || 0));
        if (!summary.fullyPaid) {
          return sendError(
            res,
            409,
            "PARTIAL_PAYMENT_INCOMPLETE",
            `Outstanding balance of $${summary.remaining.toFixed(2)} must be fully collected before this partial GM can be finalised`,
            summary,
          );
        }
        // Patch 5 Stage 6 (P14): record the partial-payment milestone
        // (PARTIAL_PAYMENT_PENDING -> PARTIAL_FULLY_PAID) in the central
        // workflow-status ledger. This is a milestone-only transition: it does
        // NOT mutate gm_entries (finalize-partial has never set final_status), so
        // the executor performs no state write and the history row is the record.
        await transitionWorkflowStatus({
          entityType: WORKFLOW_ENTITY_TYPES.GM,
          entityId: String(id),
          action: "GM_PARTIAL_FINALIZED",
          fromStatus: GM_WORKFLOW_STAGES.PARTIAL_PAYMENT_PENDING,
          toStatus: GM_WORKFLOW_STAGES.PARTIAL_FULLY_PAID,
          actor: gmWorkflowActor(req),
          module: "gm-pool",
          metadata: { summary },
          req,
          execute: async () => ({
            previousStatus: GM_WORKFLOW_STAGES.PARTIAL_PAYMENT_PENDING,
            nextStatus: GM_WORKFLOW_STAGES.PARTIAL_FULLY_PAID,
          }),
        });
        // Preserve the existing GM-sales audit trail (additive).
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_PARTIAL_FINAL_APPROVE,
          entityType: "gm_entry",
          entityId: String(id),
          reason: "Partial GM confirmed fully paid; eligible for final approval",
          after: summary,
          req,
        });
        return sendSuccess(res, {
          gmId: id,
          summary,
          message: "Partial payment complete. This GM can now proceed through the normal final-approval routes.",
        });
      } catch (err) {
        if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message, err.details);
        console.error("[gm-pool] finalize-partial error:", err);
        return sendError(res, 500, "INTERNAL", "Failed to finalise partial payment");
      }
    },
  );

  // --- P5: loan terms (read) ------------------------------------------------
  router.get("/gm-pool/:id/loan-terms", async (req, res) => {
    try {
      if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
      const { id } = req.params;
      const gm = await pool.query(
        "SELECT id, company_name, is_loan FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
        [id],
      );
      if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
      const lt = await pool.query("SELECT * FROM drm.gm_loan_terms WHERE gm_id = $1", [id]);
      return sendSuccess(res, {
        gmId: id,
        companyName: gm.rows[0].company_name,
        isLoan: Number(gm.rows[0].is_loan) === 1,
        terms: lt.rows[0] || null,
      });
    } catch (err) {
      console.error("[gm-pool] get loan terms error:", err);
      return sendError(res, 500, "INTERNAL", "Failed to load loan terms");
    }
  });

  // --- P5: loan terms (create / update). Changing financial terms re-arms the
  // admin gate (back to PENDING); editing only the return date keeps approval. ---
  const loanTermsSchema = z.object({
    loanAmountUsd: z.coerce.number().nonnegative().optional(),
    companyCopayUsd: z.coerce.number().nonnegative().optional(),
    agreedReturnDate: z.coerce.date().optional(),
  });
  const upsertLoanTerms = async (req: any, res: any) => {
    try {
      if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
      const { id } = req.params;
      const input = loanTermsSchema.parse(req.body ?? {});
      const gm = await pool.query(
        "SELECT id, is_loan FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
        [id],
      );
      if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
      if (Number(gm.rows[0].is_loan) !== 1) {
        return sendError(res, 409, "NOT_LOAN_GM", "Loan terms can only be set on a loan GM");
      }
      const returnDate = input.agreedReturnDate ? input.agreedReturnDate.toISOString().slice(0, 10) : null;
      const existing = await pool.query("SELECT * FROM drm.gm_loan_terms WHERE gm_id = $1", [id]);
      let row: any;
      if (!existing.rows[0]) {
        const insRes = await pool.query(
          `INSERT INTO drm.gm_loan_terms (gm_id, loan_amount_usd, company_copay_usd, agreed_return_date, created_by)
           VALUES ($1, COALESCE($2, 0), COALESCE($3, 0), $4, $5) RETURNING *`,
          [id, input.loanAmountUsd ?? null, input.companyCopayUsd ?? null, returnDate, req.user.userId],
        );
        row = insRes.rows[0];
      } else {
        const financialChanged =
          (input.loanAmountUsd !== undefined && Number(input.loanAmountUsd) !== Number(existing.rows[0].loan_amount_usd)) ||
          (input.companyCopayUsd !== undefined && Number(input.companyCopayUsd) !== Number(existing.rows[0].company_copay_usd));
        const updRes = await pool.query(
          `UPDATE drm.gm_loan_terms SET
             loan_amount_usd = COALESCE($2, loan_amount_usd),
             company_copay_usd = COALESCE($3, company_copay_usd),
             agreed_return_date = COALESCE($4, agreed_return_date),
             admin_approval_status = CASE WHEN $5 THEN 'PENDING' ELSE admin_approval_status END,
             admin_approved_by = CASE WHEN $5 THEN NULL ELSE admin_approved_by END,
             admin_approved_at = CASE WHEN $5 THEN NULL ELSE admin_approved_at END,
             updated_at = now()
           WHERE gm_id = $1 RETURNING *`,
          [id, input.loanAmountUsd ?? null, input.companyCopayUsd ?? null, returnDate, financialChanged],
        );
        row = updRes.rows[0];
      }
      await recordGmSalesAudit({
        action: GM_SALES_AUDIT_ACTIONS.GM_LOAN_TERMS_ADD,
        entityType: "gm_entry",
        entityId: String(id),
        reason: existing.rows[0] ? "Loan terms updated" : "Loan terms recorded",
        after: {
          loanAmountUsd: row?.loan_amount_usd,
          companyCopayUsd: row?.company_copay_usd,
          agreedReturnDate: row?.agreed_return_date,
          adminApprovalStatus: row?.admin_approval_status,
        },
        req,
      });
      return sendSuccess(res, { terms: row });
    } catch (err) {
      if (err instanceof z.ZodError) return sendError(res, 400, "VALIDATION", "Invalid loan terms", zodIssues(err));
      console.error("[gm-pool] upsert loan terms error:", err);
      return sendError(res, 500, "INTERNAL", "Failed to save loan terms");
    }
  };
  router.post(
    "/gm-pool/:id/loan-terms",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_UPDATE_LOAN_RETURN, { auditUnauthorizedAttempt: true }),
    upsertLoanTerms,
  );
  router.patch(
    "/gm-pool/:id/loan-terms",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_UPDATE_LOAN_RETURN, { auditUnauthorizedAttempt: true }),
    upsertLoanTerms,
  );

  // --- P5: loan admin approval queue (pending) ------------------------------
  router.get("/gm-pool/loan-admin-queue", async (req, res) => {
    try {
      if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
      const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
      const offset = (page - 1) * pageSize;
      const where = `g.is_loan = 1 AND g.is_deleted = false AND COALESCE(lt.admin_approval_status, 'PENDING') = 'PENDING'`;
      const rows = await pool.query(
        `SELECT g.id, g.company_name AS "companyName", g.drm_id AS "drmId",
                COALESCE(g.customer_dollar, g.amount_usd, 0)::numeric AS "amountUsd",
                g.approval_status AS "approvalStatus", g.final_status AS "finalStatus", g.created_at AS "createdAt",
                lt.id AS "loanTermsId", lt.loan_amount_usd AS "loanAmountUsd", lt.company_copay_usd AS "companyCopayUsd",
                lt.agreed_return_date AS "agreedReturnDate",
                COALESCE(lt.admin_approval_status, 'PENDING') AS "adminApprovalStatus",
                COALESCE(lt.return_status, 'PENDING') AS "returnStatus"
           FROM drm.gm_entries g
           LEFT JOIN drm.gm_loan_terms lt ON lt.gm_id = g.id
          WHERE ${where}
          ORDER BY g.created_at DESC LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      );
      const count = await pool.query(
        `SELECT COUNT(*) AS total FROM drm.gm_entries g
           LEFT JOIN drm.gm_loan_terms lt ON lt.gm_id = g.id WHERE ${where}`,
      );
      return sendSuccess(res, {
        entries: rows.rows,
        meta: { total: parseInt(count.rows[0]?.total || "0", 10), page, pageSize },
      });
    } catch (err) {
      console.error("[gm-pool] loan admin queue error:", err);
      return sendError(res, 500, "INTERNAL", "Failed to load loan admin queue");
    }
  });

  // --- P5: loan admin approve -----------------------------------------------
  const adminApproveSchema = z.object({ comment: z.string().trim().max(1000).optional() });
  router.post(
    "/gm-pool/:id/loan-admin-approve",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ADMIN, { auditUnauthorizedAttempt: true }),
    async (req, res) => {
      try {
        if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        const { id } = req.params;
        const input = adminApproveSchema.parse(req.body ?? {});
        const gm = await pool.query(
          "SELECT id, is_loan, company_name, created_by, sales_person_id FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
          [id],
        );
        if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
        if (Number(gm.rows[0].is_loan) !== 1) {
          return sendError(res, 409, "NOT_LOAN_GM", "Only a loan GM can receive loan admin approval");
        }
        const lt = await pool.query("SELECT * FROM drm.gm_loan_terms WHERE gm_id = $1", [id]);
        if (!lt.rows[0]) return sendError(res, 409, "LOAN_TERMS_MISSING", "Loan terms must be recorded before admin approval");
        const fromGate = (lt.rows[0].admin_approval_status as string | null) || GM_LOAN_ADMIN_GATE_STATES.PENDING;
        // Patch 5 Stage 6 (P14): the loan-admin gate flip + its history row are
        // written atomically through the central workflow-status service. The gate
        // is a sub-state machine (GM_LOAN_ADMIN_GATE_TRANSITIONS), so the central
        // service validates + records it WITHOUT moving the GM's own stage.
        const transition = await transitionWorkflowStatus<{ terms: any }>({
          entityType: WORKFLOW_ENTITY_TYPES.GM,
          entityId: String(id),
          action: "GM_LOAN_ADMIN_APPROVE",
          fromStatus: fromGate,
          toStatus: GM_LOAN_ADMIN_GATE_STATES.APPROVED,
          transitionMap: GM_LOAN_ADMIN_GATE_TRANSITIONS,
          actor: gmWorkflowActor(req),
          module: "gm-pool",
          metadata: { gate: "loan_terms_admin_approval", comment: input.comment ?? null },
          req,
          execute: async (client) => {
            // Read + lock the gate row inside the tx so the recorded
            // previousStatus reflects the true current gate even under concurrent
            // admin decisions (the outer fromGate only feeds permissive validation).
            const locked = await client.query(
              `SELECT admin_approval_status FROM drm.gm_loan_terms WHERE gm_id = $1 FOR UPDATE`,
              [id],
            );
            const prevGate =
              (locked.rows[0]?.admin_approval_status as string | null) ||
              GM_LOAN_ADMIN_GATE_STATES.PENDING;
            const r = await client.query(
              `UPDATE drm.gm_loan_terms SET admin_approval_status = 'APPROVED', admin_approved_by = $2,
                      admin_approved_at = now(), admin_comment = $3, updated_at = now()
                 WHERE gm_id = $1 RETURNING *`,
              [id, req.user!.userId, input.comment ?? null],
            );
            return {
              previousStatus: prevGate,
              nextStatus: GM_LOAN_ADMIN_GATE_STATES.APPROVED,
              updatedEntity: { terms: r.rows[0] },
            };
          },
        });
        const upd = { rows: [transition.updatedEntity?.terms] };
        // Preserve the existing GM-sales audit trail (additive).
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_LOAN_ADMIN_APPROVE,
          entityType: "gm_entry",
          entityId: String(id),
          reason: "Loan GM terms approved by Admin (Super HOD)",
          after: { adminApprovalStatus: "APPROVED" },
          req,
        });
        const notifyUser = gm.rows[0].sales_person_id || gm.rows[0].created_by;
        if (notifyUser) {
          try {
            await NotificationService.notify({
              userId: notifyUser,
              message: `Loan terms for GM '${gm.rows[0].company_name || "Unknown"}' were approved by Admin. It can now proceed to final approval.`,
              type: "SUCCESS",
              targetUrl: "/pms/approvals",
            });
          } catch (notifErr) {
            console.error("Failed to send loan admin approval notification:", notifErr);
          }
        }
        return sendSuccess(res, { terms: upd.rows[0], message: "Loan terms approved. This loan GM can now proceed through final approval." });
      } catch (err) {
        if (err instanceof z.ZodError) return sendError(res, 400, "VALIDATION", "Invalid input", zodIssues(err));
        if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message, err.details);
        console.error("[gm-pool] loan admin approve error:", err);
        return sendError(res, 500, "INTERNAL", "Failed to approve loan terms");
      }
    },
  );

  // --- P5: loan admin reject (reason required) ------------------------------
  const adminRejectSchema = z.object({ comment: z.string().trim().min(1, "A reason is required") });
  router.post(
    "/gm-pool/:id/loan-admin-reject",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_APPROVE_ADMIN, { auditUnauthorizedAttempt: true }),
    async (req, res) => {
      try {
        if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        const { id } = req.params;
        const input = adminRejectSchema.parse(req.body ?? {});
        const gm = await pool.query(
          "SELECT id, is_loan FROM drm.gm_entries WHERE id = $1 AND is_deleted = false",
          [id],
        );
        if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
        if (Number(gm.rows[0].is_loan) !== 1) {
          return sendError(res, 409, "NOT_LOAN_GM", "Only a loan GM can receive a loan admin decision");
        }
        const lt = await pool.query("SELECT * FROM drm.gm_loan_terms WHERE gm_id = $1", [id]);
        if (!lt.rows[0]) return sendError(res, 409, "LOAN_TERMS_MISSING", "Loan terms must be recorded before an admin decision");
        const fromGate = (lt.rows[0].admin_approval_status as string | null) || GM_LOAN_ADMIN_GATE_STATES.PENDING;
        // Patch 5 Stage 6 (P14): loan-admin reject flip + history, atomically via
        // the central service (reason required). Sub-state gate only — no GM stage move.
        const transition = await transitionWorkflowStatus<{ terms: any }>({
          entityType: WORKFLOW_ENTITY_TYPES.GM,
          entityId: String(id),
          action: "GM_LOAN_ADMIN_REJECT",
          fromStatus: fromGate,
          toStatus: GM_LOAN_ADMIN_GATE_STATES.REJECTED,
          transitionMap: GM_LOAN_ADMIN_GATE_TRANSITIONS,
          actor: gmWorkflowActor(req),
          requireReason: true,
          reason: input.comment,
          module: "gm-pool",
          metadata: { gate: "loan_terms_admin_approval" },
          req,
          execute: async (client) => {
            // Read + lock the gate row inside the tx so the recorded
            // previousStatus reflects the true current gate even under concurrent
            // admin decisions (the outer fromGate only feeds permissive validation).
            const locked = await client.query(
              `SELECT admin_approval_status FROM drm.gm_loan_terms WHERE gm_id = $1 FOR UPDATE`,
              [id],
            );
            const prevGate =
              (locked.rows[0]?.admin_approval_status as string | null) ||
              GM_LOAN_ADMIN_GATE_STATES.PENDING;
            const r = await client.query(
              `UPDATE drm.gm_loan_terms SET admin_approval_status = 'REJECTED', admin_approved_by = $2,
                      admin_approved_at = now(), admin_comment = $3, updated_at = now()
                 WHERE gm_id = $1 RETURNING *`,
              [id, req.user!.userId, input.comment],
            );
            return {
              previousStatus: prevGate,
              nextStatus: GM_LOAN_ADMIN_GATE_STATES.REJECTED,
              updatedEntity: { terms: r.rows[0] },
            };
          },
        });
        const upd = { rows: [transition.updatedEntity?.terms] };
        // Preserve the existing GM-sales audit trail (additive). The legacy action
        // constant (…_APPROVE) is kept intentionally to not change the audit stream.
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_LOAN_ADMIN_APPROVE,
          entityType: "gm_entry",
          entityId: String(id),
          reason: `Loan GM terms rejected by Admin: ${input.comment}`,
          after: { adminApprovalStatus: "REJECTED" },
          req,
        });
        return sendSuccess(res, { terms: upd.rows[0], message: "Loan terms rejected." });
      } catch (err) {
        if (err instanceof z.ZodError) return sendError(res, 400, "VALIDATION", "A rejection reason is required", zodIssues(err));
        if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message, err.details);
        console.error("[gm-pool] loan admin reject error:", err);
        return sendError(res, 500, "INTERNAL", "Failed to reject loan terms");
      }
    },
  );

  // --- P5: loan return-status tracking --------------------------------------
  const loanReturnSchema = z.object({
    returnStatus: z.enum(["PENDING", "RETURNED", "OVERDUE"]),
    returnedAt: z.coerce.date().optional(),
    agreedReturnDate: z.coerce.date().optional(),
  });
  router.patch(
    "/gm-pool/:id/loan-return",
    requireGmSalesActionPermission(GM_SALES_ACTION_KEYS.GM_UPDATE_LOAN_RETURN, { auditUnauthorizedAttempt: true }),
    async (req, res) => {
      try {
        if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
        const { id } = req.params;
        const input = loanReturnSchema.parse(req.body ?? {});
        const gm = await pool.query("SELECT id, is_loan FROM drm.gm_entries WHERE id = $1 AND is_deleted = false", [id]);
        if (!gm.rows[0]) return sendError(res, 404, "NOT_FOUND", "GM entry not found");
        if (Number(gm.rows[0].is_loan) !== 1) {
          return sendError(res, 409, "NOT_LOAN_GM", "Return tracking only applies to a loan GM");
        }
        const lt = await pool.query("SELECT * FROM drm.gm_loan_terms WHERE gm_id = $1", [id]);
        if (!lt.rows[0]) return sendError(res, 409, "LOAN_TERMS_MISSING", "Loan terms must be recorded before return tracking");
        const returnedAt = input.returnStatus === "RETURNED" ? (input.returnedAt ?? new Date()) : null;
        const returnDate = input.agreedReturnDate ? input.agreedReturnDate.toISOString().slice(0, 10) : null;
        const upd = await pool.query(
          `UPDATE drm.gm_loan_terms SET return_status = $2, returned_at = $3,
                  agreed_return_date = COALESCE($4, agreed_return_date), updated_at = now()
             WHERE gm_id = $1 RETURNING *`,
          [id, input.returnStatus, returnedAt, returnDate],
        );
        await recordGmSalesAudit({
          action: GM_SALES_AUDIT_ACTIONS.GM_LOAN_RETURN_UPDATE,
          entityType: "gm_entry",
          entityId: String(id),
          reason: `Loan return status set to ${input.returnStatus}`,
          after: { returnStatus: input.returnStatus, returnedAt },
          req,
        });
        return sendSuccess(res, { terms: upd.rows[0] });
      } catch (err) {
        if (err instanceof z.ZodError) return sendError(res, 400, "VALIDATION", "Invalid return update", zodIssues(err));
        console.error("[gm-pool] loan return update error:", err);
        return sendError(res, 500, "INTERNAL", "Failed to update return status");
      }
    },
  );

  // --- P5: loan return / overdue tracking report ----------------------------
  router.get("/gm-pool/loan-return-report", async (req, res) => {
    try {
      if (!req.user) return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
      const rows = await pool.query(
        `SELECT g.id, g.company_name AS "companyName", g.drm_id AS "drmId",
                COALESCE(g.customer_dollar, g.amount_usd, 0)::numeric AS "gmAmountUsd",
                g.final_status AS "finalStatus",
                lt.loan_amount_usd AS "loanAmountUsd", lt.company_copay_usd AS "companyCopayUsd",
                lt.agreed_return_date AS "agreedReturnDate",
                lt.admin_approval_status AS "adminApprovalStatus",
                lt.return_status AS "returnStatus", lt.returned_at AS "returnedAt",
                CASE
                  WHEN lt.return_status = 'RETURNED' THEN 'RETURNED'
                  WHEN lt.agreed_return_date IS NOT NULL AND lt.agreed_return_date < CURRENT_DATE THEN 'OVERDUE'
                  ELSE 'PENDING'
                END AS "derivedStatus",
                CASE
                  WHEN lt.return_status <> 'RETURNED' AND lt.agreed_return_date IS NOT NULL
                    THEN (CURRENT_DATE - lt.agreed_return_date)
                  ELSE NULL
                END AS "daysOverdue"
           FROM drm.gm_entries g
           JOIN drm.gm_loan_terms lt ON lt.gm_id = g.id
          WHERE g.is_loan = 1 AND g.is_deleted = false
          ORDER BY lt.agreed_return_date ASC NULLS LAST, g.created_at DESC`,
      );
      const summary = {
        total: rows.rows.length,
        returned: rows.rows.filter((r) => r.returnStatus === "RETURNED").length,
        overdue: rows.rows.filter((r) => r.derivedStatus === "OVERDUE").length,
        pending: rows.rows.filter((r) => r.derivedStatus === "PENDING").length,
      };
      return sendSuccess(res, { entries: rows.rows, summary });
    } catch (err) {
      console.error("[gm-pool] loan return report error:", err);
      return sendError(res, 500, "INTERNAL", "Failed to load loan return report");
    }
  });

  app.use("/api", router);
}

export default registerGmPoolRoutes;

