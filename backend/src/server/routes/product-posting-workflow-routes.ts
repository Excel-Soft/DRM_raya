import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db";
import { NotificationService } from "./services/notification-service";
import { projectsRepository } from "../repositories/projects.repository";
import { tasksRepository } from "../repositories/tasks.repository";
import { taskStatusHistoryRepository } from "../repositories/task-status-history.repository";
import { insertTaskSchema } from "@shared/schema";
import { getStatsPeriodRange } from "./pms-routes";

const router = Router();

// Per-link QA review — a legacy workflow (sale&servicereport-style PHP spec
// supplied by the user) layered on top of the EXISTING link submission
// mechanism (drm.task_files description-only rows, see task-execution-routes.ts),
// not a replacement for the existing whole-task QA flow above (qa/queue,
// qa-review) — that one stays exactly as-is. This adds per-LINK state so a
// Product Posting Manager can forward individual submitted links to QA, and
// QA can approve/reject each one independently, matching the legacy
// "Links for QA" / "Rejected Links" / "Per-Link Verification" tabs.
let ensuredLinkQaColumns = false;
async function ensureLinkQaColumns() {
    if (ensuredLinkQaColumns) return;
    try {
        await pool.query(`alter table drm.task_files add column if not exists send_to_qa boolean not null default false`);
        await pool.query(`alter table drm.task_files add column if not exists qa_status text null`);
        await pool.query(`alter table drm.task_files add column if not exists qa_comment text null`);
        await pool.query(`alter table drm.task_files add column if not exists qa_reject_image_url text null`);
        await pool.query(`alter table drm.task_files add column if not exists qa_reviewed_at timestamptz null`);
        await pool.query(`alter table drm.task_files add column if not exists qa_reviewed_by uuid null`);
    } catch (err) {
        console.error("Failed ensuring per-link QA columns (continuing):", err);
    } finally {
        ensuredLinkQaColumns = true;
    }
}

function isProductPostingManagerRole(req: any): boolean {
    const role = String(req.user?.activeRoleId || req.user?.roleId || req.user?.role || "").toLowerCase();
    return role === "product_posting_manager" || role === "admin" || role === "super_admin";
}

const QA_REJECT_IMAGE_DIR = path.join(process.cwd(), "uploads", "qa-reject-images");
fs.mkdirSync(QA_REJECT_IMAGE_DIR, { recursive: true });
const qaRejectImageUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, QA_REJECT_IMAGE_DIR),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
}).single("image");

// Same department scope as GET /manager/queue above, so a submitted link
// "lands with the manager" via the identical, already-working mechanism —
// not a new manager_id/under_works relationship this department doesn't use.
const PRODUCT_POSTING_DEPARTMENT_TYPES_SQL = `p.department_type IN ('PRODUCT_POSTING', 'Product Posting', '9')`;

// GET /api/product-posting/manager/links/summary?mode=qa|reject — one row
// per (task, tasker) with aggregate counts, matching the legacy "Links for
// QA" / "Rejected Links" tabs exactly: Company/Project/Tasker/Pending Qty
// (the manager's required-link target from task.notes)/status counts, with
// a "View Links" action that opens the full per-link list (see
// /manager/links/by-task/:taskId below).
router.get("/manager/links/summary", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        await ensureLinkQaColumns();
        const { rows } = await pool.query(`
            select t.id as "taskId", t.notes as "taskNotes",
                   p.id as "projectId", p.name as "projectName",
                   coalesce(c.company_name, p.name) as "companyName",
                   f.uploaded_by_user_id as "taskerId",
                   coalesce(u.full_name, u.name, u.username) as "taskerName",
                   count(*) filter (where f.qa_status = 'approved')::int as "approvedQty",
                   count(*) filter (where f.send_to_qa = false and f.qa_status is null)::int as "unsentQty",
                   count(*) filter (where f.qa_status = 'rejected')::int as "rejectedQty"
              from drm.task_files f
              join drm.tasks t on t.id = f.task_id
              join drm.projects p on p.id = t.project_id
              left join drm.customers c on c.id = p.customer_id
              left join drm.users u on u.id = f.uploaded_by_user_id
             where ${PRODUCT_POSTING_DEPARTMENT_TYPES_SQL}
               and f.file_url is null and f.description is not null and f.description <> ''
             group by t.id, t.notes, p.id, p.name, c.company_name, f.uploaded_by_user_id, u.full_name, u.name, u.username
        `);

        const mapped = rows.map((r) => {
            // notes is a plain text column holding a JSON blob (duration/links)
            // set at assign-task time — not always valid JSON (older tasks may
            // hold free-text notes instead), so parse defensively rather than
            // casting in SQL (an invalid ::jsonb cast would fail the whole query).
            let requiredQty = 0;
            try { requiredQty = Number(JSON.parse(r.taskNotes || "{}")?.links) || 0; } catch { /* not JSON */ }
            return {
                taskId: r.taskId,
                projectId: r.projectId,
                projectName: r.projectName,
                companyName: r.companyName,
                taskerId: r.taskerId,
                taskerName: r.taskerName,
                requiredQty,
                approvedQty: r.approvedQty,
                unsentQty: r.unsentQty,
                rejectedQty: r.rejectedQty,
            };
        });

        const mode = String(req.query.mode || "qa");
        const data = mode === "reject" ? mapped.filter((r) => r.rejectedQty > 0) : mapped.filter((r) => r.unsentQty > 0);
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching links summary:", error);
        res.status(500).json({ error: "Failed to fetch links summary" });
    }
});

// GET /api/product-posting/manager/links/by-task/:taskId — every submitted
// link for one task (all statuses), for the "View Links" / "View Rejected
// Links" modal.
router.get("/manager/links/by-task/:taskId", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        await ensureLinkQaColumns();
        const { rows } = await pool.query(`
            select f.id, f.description as link, f.send_to_qa as "sendToQa", f.qa_status as "qaStatus",
                   f.qa_comment as "qaComment", f.qa_reject_image_url as "qaRejectImageUrl",
                   f.created_at as "createdAt"
              from drm.task_files f
              join drm.tasks t on t.id = f.task_id
              join drm.projects p on p.id = t.project_id
             where f.task_id = $1
               and ${PRODUCT_POSTING_DEPARTMENT_TYPES_SQL}
               and f.file_url is null and f.description is not null and f.description <> ''
             order by f.created_at asc
        `, [req.params.taskId]);

        const data = rows.map((r) => ({
            id: r.id,
            link: r.link,
            createdAt: r.createdAt,
            qaComment: r.qaComment,
            qaRejectImageUrl: r.qaRejectImageUrl,
            status: r.qaStatus === "approved" ? "approved" : r.qaStatus === "rejected" ? "rejected" : r.sendToQa ? "pending_qa" : "unsent",
        }));
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching links for task:", error);
        res.status(500).json({ error: "Failed to fetch links" });
    }
});

// POST /api/product-posting/manager/links/send-to-qa — { linkIds: string[] }
router.post("/manager/links/send-to-qa", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isProductPostingManagerRole(req)) return res.status(403).json({ error: "Only the Product Posting Manager can send links to QA." });
        await ensureLinkQaColumns();
        const linkIds = Array.isArray(req.body?.linkIds) ? req.body.linkIds.filter(Boolean) : [];
        if (linkIds.length === 0) return res.status(400).json({ error: "linkIds is required" });
        const result = await pool.query(
            `update drm.task_files set send_to_qa = true
               where id = any($1::uuid[]) and send_to_qa = false and qa_status is null
             returning id`,
            [linkIds],
        );
        res.json({ success: true, sent: result.rowCount });
    } catch (error) {
        console.error("Error sending links to QA:", error);
        res.status(500).json({ error: "Failed to send links to QA" });
    }
});

// POST /api/product-posting/manager/links/:id/resubmit — { link? } optionally
// corrects the link text, then resends it to QA (same as the legacy
// "Resubmit" action).
router.post("/manager/links/:id/resubmit", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isProductPostingManagerRole(req)) return res.status(403).json({ error: "Only the Product Posting Manager can resubmit a link." });
        await ensureLinkQaColumns();
        const newLink = typeof req.body?.link === "string" ? req.body.link.trim() : "";
        const result = await pool.query(
            `update drm.task_files
                set description = coalesce(nullif($2, ''), description),
                    send_to_qa = true, qa_status = null, qa_comment = null,
                    qa_reject_image_url = null, qa_reviewed_at = null, qa_reviewed_by = null
              where id = $1 and qa_status = 'rejected'
             returning id`,
            [req.params.id, newLink],
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Rejected link not found" });
        res.json({ success: true });
    } catch (error) {
        console.error("Error resubmitting link:", error);
        res.status(500).json({ error: "Failed to resubmit link" });
    }
});

// Helper to get userId from req (if not present, fallback for safe typing)
function getUserId(req: any): string {
    return req.user?.userId || req.user?.id || "";
}

// Maps a product_posting_invoices.invoice_type value to its matching
// /drm/attributes "Service for Quotation" catalog entry (drm.services.name),
// so project creation can look up the real, admin-configured project_department.
const INVOICE_TYPE_TO_SERVICE_NAME: Record<string, string> = {
    LISTING_PAGE: 'Listing Page',
    MINIWEBSITE: 'Alibaba Minisite',
    PRODUCT_POSTING: 'Alibaba Product Posting',
};

// GET /api/product-posting-invoices - List product posting invoices
router.get("/", async (req: any, res: any) => {
    try {
        const userId = getUserId(req);
        const role = String(req.user?.activeRoleId || req.user?.roleId || "").toLowerCase();
        
        let query = `SELECT p.id, p.customer_id as "customerId", p.invoice_number as "invoiceNumber",
                    p.invoice_type as "invoiceType", p.project_name as "projectName",
                    p.company_name as "companyName", p.sales_exec_id as "salesExecId",
                    COALESCE(u.name, u.username) as "personName", p.amount,
                    p.status, p.created_at as "createdAt",
                    p.auto_generated as "autoGenerated", p.payment_method as "paymentMethod",
                    p.gm_id as "gmId", gm.approval_status as "gmApprovalStatus",
                    c.email as "customerEmail", c.phone as "customerPhone", c.address as "customerAddress"
             FROM drm.product_posting_invoices p
             LEFT JOIN drm.users u ON u.id = p.sales_exec_id
             LEFT JOIN drm.gm_entries gm ON gm.id::text = p.gm_id
             LEFT JOIN drm.customers c ON c.id = p.customer_id`;
             
        let params = [];
        if (role === 'sales_executive') {
            query += ` WHERE p.sales_exec_id = $1`;
            params.push(userId);
        }
        
        query += ` ORDER BY p.created_at DESC`;

        const { rows } = await pool.query(query, params);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching product posting invoices:", error);
        return res.status(500).json({ error: "Failed to fetch invoices" });
    }
});

// POST /api/product-posting-invoices - Create new manual product posting invoice
router.post("/", async (req: any, res: any) => {
    try {
        const { companyName, invoiceType, customerId, amount, paymentMethod } = req.body;
        const userId = getUserId(req);
        const { rows } = await pool.query(
            `INSERT INTO drm.product_posting_invoices (
                invoice_number, amount, sales_exec_id, customer_id, project_name,
                company_name, status, invoice_type, auto_generated, payment_method, generated_by, generated_at
             ) VALUES (
                'INV-' || LPAD(nextval('drm.global_invoice_number_seq')::text, 5, '0'),
                $1, $2, $3, $4, $5, 'PENDING_HOD', $4, false, $6, $2, now()
             ) RETURNING *`,
            [amount || 0, userId, customerId || null, invoiceType || 'Product Posting', companyName || '', paymentMethod || null]
        );
        return res.json(rows[0]);
    } catch (error) {
        console.error("Error creating product posting invoice:", error);
        return res.status(500).json({ error: "Failed to create invoice" });
    }
});

// PATCH /api/product-posting-invoices/:id - Update invoice details (e.g. from Action Modal)
router.patch("/:id", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { amount, paymentMethod } = req.body;
        
        let updates = [];
        let params = [];
        let paramIdx = 1;
        
        if (amount !== undefined) {
            updates.push(`amount = $${paramIdx++}`);
            params.push(amount);
        }
        if (paymentMethod !== undefined) {
            updates.push(`payment_method = $${paramIdx++}`);
            params.push(paymentMethod);
        }
        
        if (updates.length === 0) return res.json({ success: true });
        
        params.push(id);
        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
            params
        );
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error updating invoice:", error);
        return res.status(500).json({ error: "Failed to update invoice" });
    }
});

// POST /api/product-posting-invoices/:id/hod-approve - Approve by HOD
router.post("/:id/hod-approve", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        // HOD approval requires the invoice to be free (amount = 0)
        const checkRes = await pool.query(`SELECT amount, sales_exec_id, company_name FROM drm.product_posting_invoices WHERE id = $1`, [id]);
        if (!checkRes.rows.length) return res.status(404).json({ error: "Invoice not found" });

        if (Number(checkRes.rows[0].amount) > 0) {
            return res.status(400).json({ error: "Invoice must be marked as Free before HOD can approve." });
        }

        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices
             SET status = 'PENDING_ACCOUNT', hod_approved_by = $2, hod_approved_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, userId || null]
        );
        
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in hod-approve:", error);
        return res.status(500).json({ error: "Failed to approve" });
    }
});

// POST /api/product-posting-invoices/:id/hod-reject - Reject by HOD
router.post("/:id/hod-reject", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = getUserId(req);
        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices
             SET status = 'REJECTED_HOD', rejected_by = $2, rejected_at = NOW(), rejection_reason = $3
             WHERE id = $1 RETURNING *`,
            [id, userId || null, reason || null]
        );
        
        // Notify sales executive
        if (rows[0] && rows[0].sales_exec_id) {
            await NotificationService.notify({
                userId: rows[0].sales_exec_id,
                message: `Your product posting invoice for ${rows[0].company_name} was rejected by HOD. Reason: ${reason || 'N/A'}`,
                type: "ERROR",
                targetUrl: "/product-posting/invoices"
            }).catch((e: any) => console.error("Notification failed", e));
        }
        
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in hod-reject:", error);
        return res.status(500).json({ error: "Failed to reject" });
    }
});

// POST /api/product-posting-invoices/:id/account-approve - Approve by Account Manager
router.post("/:id/account-approve", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        const gateRes = await pool.query(
            `SELECT p.gm_id AS "gmId", gm.approval_status AS "gmApprovalStatus"
             FROM drm.product_posting_invoices p
             LEFT JOIN drm.gm_entries gm ON gm.id::text = p.gm_id
             WHERE p.id = $1`,
            [id]
        );
        if (!gateRes.rows.length) return res.status(404).json({ error: "Invoice not found" });
        const { gmId, gmApprovalStatus } = gateRes.rows[0];
        if (gmId && gmApprovalStatus !== 'approved') {
            return res.status(400).json({
                error: "This invoice's GM entry has not been approved by the Account Manager yet. Approve the GM itself before approving this invoice."
            });
        }

        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices
             SET status = 'APPROVED', accounts_approved_by = $2, accounts_approved_at = NOW()
             WHERE id = $1 RETURNING *`,
            [id, userId || null]
        );

        // Generate project for the invoice automatically on Account Approval
        if (rows[0]) {
            const invoice = rows[0];
            try {
                // Fallback guess, used only if the catalog lookup below finds nothing.
                let deptType = 'PRODUCT_POSTING';
                if (invoice.invoice_type && String(invoice.invoice_type).toLowerCase().includes('minisite')) {
                    deptType = 'DND';
                }
                // Real source of truth: the "Project Department" configured for this
                // service on the /drm/attributes catalog (drm.services.project_department).
                const catalogServiceName = invoice.invoice_type
                    ? INVOICE_TYPE_TO_SERVICE_NAME[String(invoice.invoice_type).toUpperCase()]
                    : null;
                if (catalogServiceName) {
                    const svcRes = await pool.query(
                        `SELECT project_department FROM drm.services WHERE name = $1 AND project_department IS NOT NULL LIMIT 1`,
                        [catalogServiceName]
                    );
                    if (svcRes.rows[0]?.project_department) {
                        deptType = svcRes.rows[0].project_department;
                    }
                }

                await pool.query(
                    `INSERT INTO drm.projects (
                        invoice_id, name, customer_id, owner_user_id, status, department_type, invoice_type, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, 'Active', $5, $6, now(), now()
                    )`,
                    [
                        invoice.id,
                        invoice.project_name || invoice.invoice_type || 'Product Posting',
                        invoice.customer_id,
                        invoice.sales_exec_id,
                        deptType,
                        invoice.invoice_type
                    ]
                );
                
                // Notify sales executive
                if (invoice.sales_exec_id) {
                    await NotificationService.notify({
                        userId: invoice.sales_exec_id,
                        message: `Your product posting invoice for ${invoice.company_name} was approved by Accounts. Project has been generated!`,
                        type: "SUCCESS",
                        targetUrl: "/pms"
                    }).catch((e: any) => console.error("Notification failed", e));
                }
            } catch (err) {
                console.error("Failed to generate project during account approval:", err);
            }
        }
        
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in account-approve:", error);
        return res.status(500).json({ error: "Failed to approve" });
    }
});

// POST /api/product-posting-invoices/:id/account-reject - Reject by Account Manager
router.post("/:id/account-reject", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = getUserId(req);
        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices
             SET status = 'REJECTED_ACCOUNT', rejected_by = $2, rejected_at = NOW(), rejection_reason = $3
             WHERE id = $1 RETURNING *`,
            [id, userId || null, reason || null]
        );
        
        // Notify sales executive
        if (rows[0] && rows[0].sales_exec_id) {
            await NotificationService.notify({
                userId: rows[0].sales_exec_id,
                message: `Your product posting invoice for ${rows[0].company_name} was rejected by Accounts. Reason: ${reason || 'N/A'}`,
                type: "ERROR",
                targetUrl: "/product-posting/invoices"
            }).catch((e: any) => console.error("Notification failed", e));
        }
        
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in account-reject:", error);
        return res.status(500).json({ error: "Failed to reject" });
    }
});

// POST /api/product-posting-invoices/:id/mark-free - Mark an invoice as Free
router.post("/:id/mark-free", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices SET amount = 0, payment_method = 'Free' WHERE id = $1 RETURNING *`,
            [id]
        );
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in mark-free:", error);
        return res.status(500).json({ error: "Failed to mark as free" });
    }
});

// POST /api/product-posting-invoices/:id/generate-project - Idempotent project generation
router.post("/:id/generate-project", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        
        // Check if project already exists
        const projRes = await pool.query(`SELECT id FROM drm.projects WHERE invoice_id = $1`, [id]);
        if (projRes.rows.length > 0) {
            return res.json({ success: true, data: { status: 'Active', held: false, linked: true, created: false }});
        }
        
        const invRes = await pool.query(`SELECT * FROM drm.product_posting_invoices WHERE id = $1`, [id]);
        if (!invRes.rows.length) return res.status(404).json({ error: "Invoice not found" });
        const invoice = invRes.rows[0];
        
        // Fallback guess, used only if the catalog lookup below finds nothing.
        let deptType = 'PRODUCT_POSTING';
        if (invoice.invoice_type && String(invoice.invoice_type).toLowerCase().includes('minisite')) {
            deptType = 'DND';
        }
        // Real source of truth: the "Project Department" configured for this
        // service on the /drm/attributes catalog (drm.services.project_department).
        const genCatalogServiceName = invoice.invoice_type
            ? INVOICE_TYPE_TO_SERVICE_NAME[String(invoice.invoice_type).toUpperCase()]
            : null;
        if (genCatalogServiceName) {
            const svcRes = await pool.query(
                `SELECT project_department FROM drm.services WHERE name = $1 AND project_department IS NOT NULL LIMIT 1`,
                [genCatalogServiceName]
            );
            if (svcRes.rows[0]?.project_department) {
                deptType = svcRes.rows[0].project_department;
            }
        }

        await pool.query(
            `INSERT INTO drm.projects (
                invoice_id, name, customer_id, owner_user_id, status, department_type, invoice_type, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, 'Active', $5, $6, now(), now()
            )`,
            [
                invoice.id,
                invoice.project_name || invoice.invoice_type || 'Product Posting',
                invoice.customer_id,
                invoice.sales_exec_id,
                deptType,
                invoice.invoice_type
            ]
        );

        return res.json({ success: true, data: { status: 'Active', held: false, linked: true, created: true }});
    } catch (error) {
        console.error("Error in generate-project:", error);
        return res.status(500).json({ error: "Failed to generate project" });
    }
});

// POST /api/product-posting-invoices/:id/resubmit - Resubmit to HOD
router.post("/:id/resubmit", async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `UPDATE drm.product_posting_invoices SET status = 'PENDING_HOD' WHERE id = $1 RETURNING *`,
            [id]
        );
        return res.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error in resubmit:", error);
        return res.status(500).json({ error: "Failed to resubmit" });
    }
});

// GET /api/product-posting/manager/project-stats
router.get("/manager/project-stats", async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*)::integer as total,
                SUM(CASE WHEN p.status = 'Active' THEN 1 ELSE 0 END)::integer as pending,
                SUM(CASE WHEN p.status = 'Completed' THEN 1 ELSE 0 END)::integer as complete,
                SUM(CASE WHEN p.status = 'OnHold' THEN 1 ELSE 0 END)::integer as free
            FROM drm.projects p
            WHERE p.department_type IN ('PRODUCT_POSTING', 'Product Posting', '9')
        `);
        return res.json(rows[0] || { total: 0, pending: 0, complete: 0, free: 0 });
    } catch (error) {
        console.error("Error fetching project stats:", error);
        return res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// GET /api/product-posting/manager/daily-submissions
router.get("/manager/daily-submissions", async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                u.name, 
                COUNT(*)::integer as submitted_count, 
                MAX(w.executive_submitted_at) as last_submitted_at,
                (
                    SELECT p.name 
                    FROM drm.projects p 
                    JOIN drm.product_posting_workflows w2 ON w2.project_id = p.id
                    WHERE w2.executive_user_id = w.executive_user_id 
                    ORDER BY w2.executive_submitted_at DESC LIMIT 1
                ) as last_task_title
            FROM drm.product_posting_workflows w
            JOIN drm.users u ON u.id = w.executive_user_id
            JOIN drm.projects p ON p.id = w.project_id
            WHERE w.executive_submitted_at >= CURRENT_DATE
              AND p.department_type IN ('PRODUCT_POSTING', 'Product Posting', '9')
            GROUP BY u.name, w.executive_user_id
        `);
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching daily submissions:", error);
        return res.status(500).json({ error: "Failed to fetch daily submissions" });
    }
});

// GET /api/product-posting/manager/queue
router.get("/manager/queue", async (req: any, res: any) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                w.id as workflow_id, w.current_phase as "currentPhase", w.task_id as "taskId",
                w.executive_submitted_at as "executiveSubmittedAt", w.updated_at as "updatedAt",
                w.overtime_requested_minutes as "overtimeRequestedMinutes",
                w.overtime_approved_minutes as "overtimeApprovedMinutes",
                w.overtime_reason as "overtimeReason",
                p.id as project_id, p.name as project_name, COALESCE(c.company_name, i.company_name) as company_name, p.project_number as project_number, p.department_type as department_type,
                i.project_name as invoice_project_name,
                COALESCE((
                    SELECT json_agg(json_build_object('id', d.id, 'documentUrl', d.document_url)) 
                    FROM drm.project_documents d 
                    WHERE d.project_id = w.project_id
                ), '[]'::json) as documents
            FROM drm.product_posting_workflows w
            JOIN drm.projects p ON p.id = w.project_id
            LEFT JOIN drm.customers c ON c.id = p.customer_id
            LEFT JOIN drm.product_posting_invoices i ON i.id = p.invoice_id
            WHERE p.department_type IN ('PRODUCT_POSTING', 'Product Posting', '9')
            ORDER BY w.updated_at DESC
        `);

        // Format data to match frontend expectations
        const data = rows.map(row => ({
            workflowId: row.workflow_id,
            currentPhase: row.currentPhase || "PENDING_PROJECT",
            phaseLabel: row.currentPhase ? row.currentPhase.replace(/_/g, ' ') : "PENDING PROJECT",
            taskId: row.taskId,
            executiveSubmittedAt: row.executiveSubmittedAt,
            updatedAt: row.updatedAt,
            overtimeRequestedMinutes: row.overtimeRequestedMinutes || 0,
            overtimeApprovedMinutes: row.overtimeApprovedMinutes || 0,
            overtimeReason: row.overtimeReason,
            overtimeExceededBy: 0, // Calculate this properly if needed based on duration
            documents: row.documents || [],
            invoiceProjectName: row.invoice_project_name,
            project: {
                id: row.project_id,
                name: row.project_name,
                companyName: row.company_name,
                projectNumber: row.project_number,
                departmentType: row.department_type
            }
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching manager queue:", error);
        return res.status(500).json({ error: "Failed to fetch manager queue" });
    }
});

// POST /api/product-posting/projects/:id/assign-task — { assigneeId, title,
// description?, links?, dueDate?, assignedDurationMinutes? }
// This route never existed (confirmed via grep -- only referenced in
// comments and a forward-looking UAT spec that was never wired up), so every
// "Assign Task" click here, on dd-manager-dashboard.tsx, and on
// product-posting-executive-widget.tsx always failed with "Assignment
// failed / Failed to assign task". Fixed by reusing the exact same real,
// working insertTaskSchema + tasksRepository mechanism POST /api/pms/tasks
// already uses. The widget that shows this project's assignment status
// re-fetches GET /api/pms/projects?withStats=true on success (see its
// onSuccess handler), which is backed by the same drm.tasks table, so a
// plain task row on the SAME project is sufficient -- no separate
// product_posting_workflows/SUBPROJECT row is created. (The generic
// endpoint's own optional `ensureProductPostingWorkflow` ->
// getOrCreateProductPostingWorkflow path is itself an unimplemented stub;
// deliberately not relied on here for the same reason.)
router.post("/projects/:id/assign-task", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const projectId = req.params.id;
        const { assigneeId, title, description, links, dueDate, assignedDurationMinutes } = req.body || {};
        if (!assigneeId || !title) {
            return res.status(400).json({ error: "assigneeId and title are required" });
        }

        const projRes = await pool.query(`select id from drm.projects where id = $1`, [projectId]);
        if (projRes.rowCount === 0) return res.status(404).json({ error: "Project not found" });

        const combinedDescription = [description, links ? `Links: ${links}` : null].filter(Boolean).join("\n\n") || undefined;
        const minutes = Number(assignedDurationMinutes) || 0;
        const computedDueDate = dueDate || (minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : undefined);
        const userId = getUserId(req);

        const validated = insertTaskSchema.parse({
            projectId,
            title,
            description: combinedDescription,
            assignedToUserId: assigneeId,
            dueDate: computedDueDate,
            notes: JSON.stringify({ duration: minutes, links: links || 0 }),
            ownerUserId: userId,
        });

        const task = await tasksRepository.create({
            ...validated,
            createdBy: userId,
        } as any);

        res.status(201).json({ taskId: task.id, ...task });
    } catch (error: any) {
        console.error("Error assigning product posting task:", error);
        if (error?.name === "ZodError") {
            return res.status(400).json({ error: "Invalid request", details: error.issues });
        }
        res.status(500).json({ error: "Failed to assign task" });
    }
});

// ---------------------------------------------------------------------------
// QA Manager dashboard (frontend/src/components/qa-manager-widget.tsx,
// served at /qa/manager) — previously called three endpoints that never
// existed anywhere in the backend (GET /qa/queue, GET /qa/stats, POST
// /tasks/:id/qa-review all 404'd via the SPA fallback), so the page was
// permanently empty regardless of any real data. Built for real here,
// sourced from drm.tasks.sent_to_qa_at (see PATCH .../send-to-qa in
// pms-routes.ts) — deliberately department-agnostic, not tied to
// product_posting_workflows, since "Send to QA" on PMS Task History works
// for any department's tasks, not just Product Posting.
// ---------------------------------------------------------------------------

function isQaManagerRole(req: any): boolean {
    const role = String(req.user?.activeRoleId || req.user?.roleId || req.user?.role || "").toLowerCase();
    return role === "qa_manager" || role === "admin" || role === "super_admin";
}

// GET /api/product-posting/qa/queue — tasks a manager has sent to QA that
// QA hasn't reviewed yet (this is the "Pending Reviews" queue + Project
// List / Changing Projects table data).
router.get("/qa/queue", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });

        const { rows } = await pool.query(`
            SELECT
                t.id as "taskId",
                t.title,
                t.status,
                t.notes,
                t.sent_to_qa_at as "executiveSubmittedAt",
                t.updated_at as "updatedAt",
                COALESCE(c.company_name, inv.company_name, rinv.customer_name, p.name) as "companyName",
                p.id as "projectId",
                COALESCE(inv.invoice_number, rinv.invoice_number) as "invoiceNumber",
                (SELECT COALESCE(SUM((item->>'quantity')::numeric), 0)
                   FROM jsonb_array_elements(COALESCE(rinv.items::jsonb, '[]'::jsonb)) AS item) as "qty",
                jsonb_build_object('id', au.id, 'name', COALESCE(au.full_name, au.name, au.username)) as "assignee",
                (SELECT count(*) FROM drm.task_status_history h
                   WHERE h.task_id = t.id AND h.to_status = 'Blocked'
                     AND h.notes LIKE '%"qaReturn":true%') as "returnCount",
                -- Whichever "sent back with a reason" event is most recent — the
                -- pre-existing document-rejection path, or this session's new
                -- Verification-Manager return (task_status_history, flagged
                -- verificationReturn:true — see /tasks/:id/verification-review).
                (SELECT reason_text FROM (
                    SELECT rh.remarks as reason_text, rh.created_at as ts
                      FROM drm.product_posting_rework_history rh
                      JOIN drm.product_posting_workflows wf ON wf.id = rh.workflow_id
                     WHERE wf.project_id = t.project_id AND rh.action = 'DOCUMENT_REJECTED'
                    UNION ALL
                    SELECT (h.notes::jsonb ->> 'reason') as reason_text, h.changed_at as ts
                      FROM drm.task_status_history h
                     WHERE h.task_id = t.id AND h.notes LIKE '%"verificationReturn":true%'
                 ) combined ORDER BY ts DESC LIMIT 1) as "vmComment"
            FROM drm.tasks t
            JOIN drm.projects p ON p.id = t.project_id
            LEFT JOIN drm.customers c ON c.id = p.customer_id
            LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
            LEFT JOIN drm.invoices rinv ON rinv.id = p.invoice_id
            LEFT JOIN drm.users au ON au.id = t.assigned_to_user_id
            WHERE COALESCE(t.is_deleted, false) = false
              AND (
                  (t.sent_to_qa_at IS NOT NULL AND t.qa_reviewed_at IS NULL)
                  OR
                  (t.status = 'Blocked' AND t.sent_to_qa_at IS NULL AND EXISTS (SELECT 1 FROM drm.task_status_history h WHERE h.task_id = t.id AND h.to_status = 'Blocked' AND h.notes LIKE '%"qaReturn":true%'))
              )
            ORDER BY COALESCE(t.sent_to_qa_at, t.updated_at) DESC
        `);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching QA queue:", error);
        res.status(500).json({ error: "Failed to fetch QA queue" });
    }
});

// GET /api/product-posting/qa/dashboard-stats?period=X
router.get("/qa/dashboard-stats", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });

        const { from, to } = getStatsPeriodRange(req.query.period as string | undefined);
        let timeFilter = "";
        const params: any[] = [];
        if (from) {
            params.push(from);
            timeFilter += ` AND COALESCE(t.sent_to_qa_at, t.qa_reviewed_at, t.updated_at) >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            timeFilter += ` AND COALESCE(t.sent_to_qa_at, t.qa_reviewed_at, t.updated_at) <= $${params.length}`;
        }

        const { rows } = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE t.sent_to_qa_at IS NOT NULL OR t.qa_reviewed_at IS NOT NULL OR EXISTS (SELECT 1 FROM drm.task_status_history h WHERE h.task_id = t.id AND h.to_status = 'Blocked' AND h.notes LIKE '%"qaReturn":true%'))::int as total,
                COUNT(*) FILTER (WHERE t.sent_to_qa_at IS NOT NULL AND t.qa_reviewed_at IS NULL)::int as pending,
                COUNT(*) FILTER (WHERE t.qa_reviewed_at IS NOT NULL)::int as complete,
                COUNT(*) FILTER (WHERE t.status = 'Blocked' AND t.sent_to_qa_at IS NULL AND EXISTS (SELECT 1 FROM drm.task_status_history h WHERE h.task_id = t.id AND h.to_status = 'Blocked' AND h.notes LIKE '%"qaReturn":true%'))::int as changing
            FROM drm.tasks t
            WHERE coalesce(t.is_deleted, false) = false ${timeFilter}
        `, params);

        res.json({
            total: rows[0]?.total ?? 0,
            pending: rows[0]?.pending ?? 0,
            complete: rows[0]?.complete ?? 0,
            changing: rows[0]?.changing ?? 0
        });
    } catch (error) {
        console.error("Error fetching QA stats:", error);
        res.status(500).json({ error: "Failed to fetch QA stats" });
    }
});

// POST /api/product-posting/tasks/:id/qa-review — { action: "complete" |
// "return", remarks?, level? }. "complete" finalizes the task (records QA's
// level/remarks, task stays Completed). "return" reopens it for rework —
// the same Blocked status + reason the manager's own reject already uses on
// PMS Task History, so the executive sees it exactly the same way regardless
// of who sent it back.
router.post("/tasks/:id/qa-review", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isQaManagerRole(req)) {
            return res.status(403).json({ error: "Only QA can review this task." });
        }

        const { action, remarks, level } = req.body || {};
        if (!["complete", "return"].includes(action)) {
            return res.status(400).json({ error: "action must be complete or return" });
        }

        const taskRes = await pool.query(
            `SELECT id, status, sent_to_qa_at, qa_reviewed_at FROM drm.tasks WHERE id = $1`,
            [req.params.id],
        );
        if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
        const task = taskRes.rows[0];
        if (!task.sent_to_qa_at || task.qa_reviewed_at) {
            return res.status(400).json({ error: "This task isn't waiting on a QA review." });
        }

        const userId = getUserId(req);

        if (action === "complete") {
            await pool.query(
                `UPDATE drm.tasks SET qa_reviewed_at = now(), qa_level = $2, qa_remarks = $3 WHERE id = $1`,
                [req.params.id, level || null, remarks || null],
            );
            // Same no-op-status audit entry the "return" branch below already
            // uses — otherwise QA approving (as opposed to returning) a task
            // leaves no trace on the Workflow Timeline at all.
            await taskStatusHistoryRepository.create({
                taskId: req.params.id,
                userId,
                fromStatus: "Completed" as any,
                toStatus: "Completed" as any,
                notes: JSON.stringify({ reason: remarks || "Approved by QA", level: level || undefined, qaComplete: true }),
            } as any);
            return res.json({ success: true });
        }

        // action === "return" — reopen for rework. Completed has no legal
        // outgoing transition in the normal PMS state machine (it's meant to
        // be terminal for the manager's own flow), so this is a deliberate,
        // QA-only exception applied directly rather than through
        // changeTaskStatus. sent_to_qa_at is cleared so the task can be sent
        // back to QA again once resubmitted and re-approved.
        await pool.query(
            `UPDATE drm.tasks SET status = 'Blocked', sent_to_qa_at = null, timer_started_at = null WHERE id = $1`,
            [req.params.id],
        );
        await taskStatusHistoryRepository.create({
            taskId: req.params.id,
            userId,
            fromStatus: "Completed" as any,
            toStatus: "Blocked" as any,
            notes: JSON.stringify({ reason: remarks || "Returned by QA", qaReturn: true }),
        } as any);

        res.json({ success: true });
    } catch (error) {
        console.error("Error recording QA review:", error);
        res.status(500).json({ error: "Failed to record QA review" });
    }
});

// GET /api/product-posting/qa/links/summary — per-link review queue, grouped
// by (task, tasker) exactly like qa_vfy_dash.php's own "Per-Link
// Verification" tab (Company/Project/Tasker/Pending Qty/Action="View
// Links", not a flat per-link list). Scoped to Product Posting only, same
// department clause the manager's own queue uses — a deliberately separate,
// narrower concept from the whole-task qa/queue above, which is
// department-agnostic. The individual links for a row are fetched via the
// existing /manager/links/by-task/:taskId (shared with the manager's own
// modal, no department/role check beyond auth so QA can call it too).
router.get("/qa/links/summary", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isQaManagerRole(req)) return res.status(403).json({ error: "Only QA can review links." });
        await ensureLinkQaColumns();
        const { rows } = await pool.query(`
            select t.id as "taskId", t.notes as "taskNotes",
                   p.id as "projectId", p.name as "projectName",
                   coalesce(c.company_name, p.name) as "companyName",
                   f.uploaded_by_user_id as "taskerId",
                   coalesce(u.full_name, u.name, u.username) as "taskerName",
                   count(*) filter (where f.send_to_qa = true and f.qa_status is null)::int as "pendingQty",
                   count(*) filter (where f.qa_status = 'approved')::int as "approvedQty",
                   count(*)::int as "submittedQty"
              from drm.task_files f
              join drm.tasks t on t.id = f.task_id
              join drm.projects p on p.id = t.project_id
              left join drm.customers c on c.id = p.customer_id
              left join drm.users u on u.id = f.uploaded_by_user_id
             where ${PRODUCT_POSTING_DEPARTMENT_TYPES_SQL}
               and f.file_url is null and f.description is not null and f.description <> ''
             group by t.id, t.notes, p.id, p.name, c.company_name, f.uploaded_by_user_id, u.full_name, u.name, u.username
            having count(*) filter (where f.send_to_qa = true and f.qa_status is null) > 0
        `);
        // totalQty prefers the assign-task required links target; falls back to
        // how many links this tasker has actually submitted for the task.
        const data = rows.map((r: any) => {
            let requiredQty = 0;
            try { requiredQty = Number(JSON.parse(r.taskNotes || "{}")?.links) || 0; } catch { /* not JSON */ }
            return {
                taskId: r.taskId,
                projectId: r.projectId,
                projectName: r.projectName,
                companyName: r.companyName,
                taskerId: r.taskerId,
                taskerName: r.taskerName,
                pendingQty: r.pendingQty,
                approvedQty: r.approvedQty,
                totalQty: requiredQty > 0 ? requiredQty : r.submittedQty,
            };
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching QA's links summary:", error);
        res.status(500).json({ error: "Failed to fetch links summary" });
    }
});

// POST /api/product-posting/qa/links/:id/approve
router.post("/qa/links/:id/approve", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isQaManagerRole(req)) return res.status(403).json({ error: "Only QA can review links." });
        await ensureLinkQaColumns();
        const result = await pool.query(
            `update drm.task_files set qa_status = 'approved', qa_reviewed_at = now(), qa_reviewed_by = $2
               where id = $1 and send_to_qa = true and qa_status is null
             returning id, task_id`,
            [req.params.id, getUserId(req)],
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Link not found or already reviewed" });

        // Do NOT auto-set sent_to_qa_at / qa_reviewed_at when the last link
        // is approved. Product Posting managers must manually click
        // "Send to QA" on Task Complete once every link is QA-approved —
        // that button stays disabled until then, then enables for a deliberate
        // hand-off (see POST /api/pms/tasks/:id/send-to-qa).

        res.json({ success: true });
    } catch (error) {
        console.error("Error approving link:", error);
        res.status(500).json({ error: "Failed to approve link" });
    }
});

// POST /api/product-posting/qa/links/:id/reject — multipart: comment (required)
// + image (required) — mirrors the legacy spec's mandatory rejection-proof image.
router.post("/qa/links/:id/reject", (req: any, res: any, next: any) => {
    qaRejectImageUpload(req, res, (err: any) => {
        if (err) {
            console.error("Error uploading QA reject image:", err);
            return res.status(400).json({ error: err.message || "Failed to upload image" });
        }
        next();
    });
}, async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isQaManagerRole(req)) return res.status(403).json({ error: "Only QA can review links." });
        await ensureLinkQaColumns();
        const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
        if (!comment) return res.status(400).json({ error: "A rejection comment is required." });
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: "A proof image is required to reject a link." });
        const imageUrl = `/uploads/qa-reject-images/${file.filename}`;
        const result = await pool.query(
            `update drm.task_files
                set qa_status = 'rejected', qa_comment = $2, qa_reject_image_url = $3,
                    qa_reviewed_at = now(), qa_reviewed_by = $4
              where id = $1 and send_to_qa = true and qa_status is null
             returning id`,
            [req.params.id, comment, imageUrl, getUserId(req)],
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Link not found or already reviewed" });
        res.json({ success: true });
    } catch (error) {
        console.error("Error rejecting link:", error);
        res.status(500).json({ error: "Failed to reject link" });
    }
});

// ---------------------------------------------------------------------------
// Verification Manager dashboard (frontend/src/components/verification-manager-widget.tsx,
// served at /verification/manager) — same never-existed-anywhere-in-the-backend
// problem as the QA dashboard above (GET /verification/queue, GET
// /verification/stats, POST /tasks/:id/verification-review all 404'd). Built
// the same way: sourced from drm.tasks, one step downstream of QA. A task
// enters this queue once QA marks it reviewed (qaReviewedAt set) and leaves
// once Verification marks it reviewed too. "Return" here is a check on QA's
// OWN review, not the executive's work — it clears qaReviewedAt (not
// sentToQaAt/status), which simply drops the task back into QA's own /qa/queue
// for QA to look at again, rather than reopening it for the executive.
// ---------------------------------------------------------------------------

function isVerificationManagerRole(req: any): boolean {
    const role = String(req.user?.activeRoleId || req.user?.roleId || req.user?.role || "").toLowerCase();
    return role === "verification_manager" || role === "admin" || role === "super_admin";
}

// GET /api/product-posting/verification/queue — tasks QA has reviewed that
// Verification hasn't reviewed yet.
router.get("/verification/queue", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });

        const { rows } = await pool.query(`
            SELECT
                t.id as "taskId",
                t.title,
                t.status,
                t.notes,
                t.qa_reviewed_at as "qaReviewedAt",
                t.updated_at as "updatedAt",
                COALESCE(c.company_name, inv.company_name, p.name) as "companyName",
                p.id as "projectId",
                inv.invoice_number as "invoiceNumber",
                jsonb_build_object('id', au.id, 'name', COALESCE(au.full_name, au.name, au.username)) as "assignee",
                (SELECT count(*) FROM drm.task_status_history h
                   WHERE h.task_id = t.id AND h.notes LIKE '%"verificationReturn":true%') as "returnCount"
            FROM drm.tasks t
            JOIN drm.projects p ON p.id = t.project_id
            LEFT JOIN drm.customers c ON c.id = p.customer_id
            LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
            LEFT JOIN drm.users au ON au.id = t.assigned_to_user_id
            WHERE COALESCE(t.is_deleted, false) = false
              AND t.qa_reviewed_at IS NOT NULL
              AND t.verification_reviewed_at IS NULL
            ORDER BY t.qa_reviewed_at DESC
        `);

        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching verification queue:", error);
        res.status(500).json({ error: "Failed to fetch verification queue" });
    }
});

// GET /api/product-posting/verification/stats?period=X — distinct tasks that
// have ever reached Verification (i.e. QA has reviewed them), same "total"
// convention as /qa/dashboard-stats.
router.get("/verification/stats", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });

        const { from, to } = getStatsPeriodRange(req.query.period as string | undefined);
        let timeFilter = "";
        const params: any[] = [];
        if (from) { params.push(from); timeFilter += ` AND t.qa_reviewed_at >= $${params.length}`; }
        if (to) { params.push(to); timeFilter += ` AND t.qa_reviewed_at <= $${params.length}`; }

        const { rows } = await pool.query(`
            SELECT count(*)::int as total
            FROM drm.tasks t
            WHERE t.qa_reviewed_at IS NOT NULL AND coalesce(t.is_deleted, false) = false ${timeFilter}
        `, params);

        res.json({ total: rows[0]?.total ?? 0 });
    } catch (error) {
        console.error("Error fetching verification stats:", error);
        res.status(500).json({ error: "Failed to fetch verification stats" });
    }
});

// POST /api/product-posting/tasks/:id/verification-review — { action:
// "complete" | "return", remarks?, level? }. "complete" finalizes
// verification (task stays Completed). "return" bounces the task all the way
// back to the Product Posting Manager (not straight back into QA's queue) —
// same Blocked state + cleared sent_to_qa_at that QA's own "return" already
// uses, so the manager sees it in Completed Projects, gets it reworked, and
// explicitly resends it to QA via the existing /send-to-qa action. A task
// only ever reaches Verification after QA has approved it, so a
// Verification return must go through QA's approval again too — never
// straight back to Verification.
router.post("/tasks/:id/verification-review", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        if (!isVerificationManagerRole(req)) {
            return res.status(403).json({ error: "Only Verification can review this task." });
        }

        const { action, remarks, level } = req.body || {};
        if (!["complete", "return"].includes(action)) {
            return res.status(400).json({ error: "action must be complete or return" });
        }

        const taskRes = await pool.query(
            `SELECT id, qa_reviewed_at, verification_reviewed_at FROM drm.tasks WHERE id = $1`,
            [req.params.id],
        );
        if (taskRes.rowCount === 0) return res.status(404).json({ error: "Task not found" });
        const task = taskRes.rows[0];
        if (!task.qa_reviewed_at || task.verification_reviewed_at) {
            return res.status(400).json({ error: "This task isn't waiting on a verification review." });
        }

        const userId = getUserId(req);

        if (action === "complete") {
            await pool.query(
                `UPDATE drm.tasks SET verification_reviewed_at = now(), verification_level = $2, verification_remarks = $3 WHERE id = $1`,
                [req.params.id, level || null, remarks || null],
            );
            await taskStatusHistoryRepository.create({
                taskId: req.params.id,
                userId,
                fromStatus: "Completed" as any,
                toStatus: "Completed" as any,
                notes: JSON.stringify({ reason: remarks || "Approved by Verification", level: level || undefined, verificationComplete: true }),
            } as any);
            return res.json({ success: true });
        }

        // action === "return" — send back to the Product Posting Manager,
        // the same Blocked + sent_to_qa_at-cleared state QA's own "return"
        // uses (see /tasks/:id/qa-review above). qa_reviewed_at is cleared
        // too so the task needs QA's approval again before it can ever come
        // back to Verification.
        await pool.query(
            `UPDATE drm.tasks SET status = 'Blocked', sent_to_qa_at = null, timer_started_at = null,
                    qa_reviewed_at = null, qa_level = null, qa_remarks = null
              WHERE id = $1`,
            [req.params.id],
        );
        await taskStatusHistoryRepository.create({
            taskId: req.params.id,
            userId,
            fromStatus: "Completed" as any,
            toStatus: "Blocked" as any,
            notes: JSON.stringify({ reason: remarks || "Returned by Verification", verificationReturn: true }),
        } as any);

        res.json({ success: true });
    } catch (error) {
        console.error("Error recording verification review:", error);
        res.status(500).json({ error: "Failed to record verification review" });
    }
});

// Dummy endpoints to satisfy WorkflowTimeline component which expects them
router.get("/task/:id/rework-history", async (req: any, res: any) => {
    res.json({ success: true, data: [] });
});

router.get("/task/:id/report-links", async (req: any, res: any) => {
    res.json({ success: true, data: [] });
});

export const productPostingWorkflowRouter = router;
