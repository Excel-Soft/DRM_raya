import { Router, type Request, type Response } from "express";
import { pool } from "../db";
import { requireRole } from "../middleware/auth.middleware";
import { AuditLogService } from "./services/audit-log.service";

// SEO/SMM manager's "Department Status Tracker" Pending/Approved tabs —
// sales-uploaded project documents routed to the SEO/SMM department
// (drm.projects.department_type = 'SEO_SMM'). Mirrors it-assets-routes.ts's
// /api/it/projects + /api/it/documents/:id/verify (same underlying tables,
// same reject -> rework-history -> sales-exec-reupload loop), scoped to this
// department's own roles instead of IT's.
const router = Router();

const SEO_SMM_ROLES = ["admin", "super_hod", "seo_smm_manager"];

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// GET /api/seo-smm/projects?status=pending|approved
router.get("/projects", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const status = req.query.status === "approved" ? "APPROVED" : "PENDING";
    const { rows } = await pool.query(
      `select
         p.id as "projectId",
         p.name as project,
         coalesce(c.company_name, 'Unknown') as company,
         pd.id as "documentId",
         pd.document_url as "documentUrl",
         pd.status as "documentStatus",
         pd.created_at as "uploadedAt",
         pdet.package_name as "packageName",
         pdet.minisite_url as "minisiteUrl",
         pdet.phone as "phone",
         pdet.mobile as "mobile",
         pdet.address as "address",
         pdet.reference as "reference",
         pdet.categories as "categories",
         pdet.detail_notes as "detailNotes"
       from drm.projects p
       join lateral (
         select * from drm.project_documents pd2
         where pd2.project_id = p.id
         order by pd2.created_at desc
         limit 1
       ) pd on true
       left join drm.customers c on c.id = p.customer_id
       left join drm.project_details pdet on pdet.project_id = p.id
       where p.department_type = 'SEO_SMM' and pd.status = $1
       order by pd.created_at desc`,
      [status],
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching SEO/SMM projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// PATCH /api/seo-smm/documents/:id/verify — { status: "APPROVED" | "REJECTED", reason?: string }
router.patch("/documents/:id/verify", requireRole(...SEO_SMM_ROLES), async (req: Request, res: Response) => {
  try {
    const status = req.body?.status;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "status must be APPROVED or REJECTED" });
    }
    if (status === "REJECTED" && !reason) {
      return res.status(400).json({ error: "A rejection reason is required." });
    }

    const docRes = await pool.query(
      `update drm.project_documents set status = $1, updated_at = now() where id = $2 returning id, project_id`,
      [status, req.params.id],
    );
    if (docRes.rowCount === 0) return res.status(404).json({ error: "Document not found" });

    if (status === "REJECTED") {
      const wfRes = await pool.query(
        `select id, current_phase from drm.product_posting_workflows where project_id = $1`,
        [docRes.rows[0].project_id],
      );
      if (wfRes.rows[0]) {
        await pool.query(
          `insert into drm.product_posting_rework_history (workflow_id, from_phase, to_phase, action, remarks, actor_user_id)
           values ($1, $2, 'PENDING_PROJECT', 'DOCUMENT_REJECTED', $3, $4)`,
          [wfRes.rows[0].id, wfRes.rows[0].current_phase, reason, actorId(req)],
        );
      }
    }

    await AuditLogService.record({
      actorUserId: actorId(req) ?? undefined,
      action: "seo_smm_document.verify",
      module: "seo_smm",
      entityType: "project_document",
      entityId: req.params.id,
      after: { status, reason: reason || undefined },
      req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error verifying SEO/SMM document:", error);
    res.status(500).json({ error: "Failed to verify document" });
  }
});

export default router;
