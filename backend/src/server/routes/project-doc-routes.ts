import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { pool } from "../db";

const router = Router();

// Real disk-backed file storage — mirrors portfolio-routes.ts's multer setup.
// The previous version of this route never actually received a file; the
// frontend only read the picked file's *name* client-side and sent that
// string as "documentUrl", so nothing was ever stored anywhere and the
// resulting "view document" link on any downstream dashboard could never work.
const PROJECT_DOC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "project-documents");
fs.mkdirSync(PROJECT_DOC_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PROJECT_DOC_UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
}).single("document");

// POST /api/projects/:id/documents - Upload document and project details
router.post("/:id/documents", (req, res, next) => {
    upload(req as any, res as any, (err: any) => {
        if (err) {
            console.error("Error uploading project document:", err);
            return res.status(400).json({ error: err.message || "Failed to upload document" });
        }
        next();
    });
}, async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });

        const { id } = req.params;
        const {
            packageName, minisiteUrl, phone, mobile,
            address, reference, categories, detailNotes,
            evidenceUrl, documentUrl
        } = req.body;

        // Ensure project exists
        const projectRes = await pool.query(`SELECT id FROM drm.projects WHERE id = $1`, [id]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ error: "Project not found" });
        }

        // Block re-upload once the routed department has already verified the
        // current document — matches pms-pending-approvals.tsx's own
        // isVerifiedNow logic (latest APPROVED project_documents row newer
        // than any later rejection). A rejection always re-opens uploads
        // again; this only locks the genuinely-done state.
        const verifyState = await pool.query(
            `SELECT
               (SELECT max(pd.updated_at) FROM drm.project_documents pd WHERE pd.project_id = $1 AND pd.status = 'APPROVED') as approved_at,
               (SELECT max(rh.created_at) FROM drm.product_posting_workflows wf2
                  JOIN drm.product_posting_rework_history rh ON rh.workflow_id = wf2.id
                  WHERE wf2.project_id = $1 AND rh.action = 'DOCUMENT_REJECTED') as rejected_at`,
            [id],
        );
        const { approved_at: approvedAt, rejected_at: rejectedAt } = verifyState.rows[0] || {};
        if (approvedAt && (!rejectedAt || new Date(approvedAt) > new Date(rejectedAt))) {
            return res.status(409).json({
                error: "This document has already been verified by the department. No further upload is needed.",
            });
        }

        // Upsert project_details safely without ON CONFLICT (in case of missing unique constraint)
        const checkDetails = await pool.query(`SELECT id FROM drm.project_details WHERE project_id = $1`, [id]);
        if (checkDetails.rows.length === 0) {
            await pool.query(`
                INSERT INTO drm.project_details (
                    project_id, package_name, minisite_url, phone, mobile,
                    address, reference, categories, detail_notes, evidence_url,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()
                )
            `, [
                id, packageName || null, minisiteUrl || null, phone || null, mobile || null,
                address || null, reference || null, categories || null, detailNotes || null,
                evidenceUrl || null
            ]);
        } else {
            await pool.query(`
                UPDATE drm.project_details SET
                    package_name = $2,
                    minisite_url = $3,
                    phone = $4,
                    mobile = $5,
                    address = $6,
                    reference = $7,
                    categories = $8,
                    detail_notes = $9,
                    evidence_url = $10,
                    updated_at = now()
                WHERE project_id = $1
            `, [
                id, packageName || null, minisiteUrl || null, phone || null, mobile || null,
                address || null, reference || null, categories || null, detailNotes || null,
                evidenceUrl || null
            ]);
        }

        // --- Resolve Target Department ---
        // 1. Use the project's already-assigned department_type (set at invoice approval time).
        // 2. Only if that is null, try to resolve from the project's service_type in the catalog.
        // 3. Only if that too is null, try to resolve from the packageName submitted in this form.
        // This avoids breaking document uploads for existing projects where the packageName
        // in the form (e.g. "Basic Plus") doesn't match any catalog entry.
        const projectRow = await pool.query(
            `SELECT department_type, service_type FROM drm.projects WHERE id = $1`,
            [id]
        );

        let projDept: string | null = projectRow.rows[0]?.department_type || null;

        if (!projDept) {
            // Fallback: resolve from service_type stored on the project
            const serviceType = projectRow.rows[0]?.service_type;
            if (serviceType) {
                const svcCheck = await pool.query(`
                    SELECT COALESCE(ss.project_department, s_parent.project_department, s.project_department) AS project_department
                    FROM (SELECT $1::text AS s_name) AS input
                    LEFT JOIN drm.service_subservices ss ON ss.name = input.s_name
                    LEFT JOIN drm.services s_parent ON s_parent.id = ss.service_id
                    LEFT JOIN drm.services s ON s.name = input.s_name
                    LIMIT 1
                `, [serviceType]);
                projDept = svcCheck.rows[0]?.project_department || null;
            }
        }

        if (!projDept && packageName) {
            // Last resort: try to resolve from the packageName submitted in the form
            const pkgCheck = await pool.query(`
                SELECT COALESCE(ss.project_department, s_parent.project_department, s.project_department) AS project_department
                FROM (SELECT $1::text AS s_name) AS input
                LEFT JOIN drm.service_subservices ss ON ss.name = input.s_name
                LEFT JOIN drm.services s_parent ON s_parent.id = ss.service_id
                LEFT JOIN drm.services s ON s.name = input.s_name
                LIMIT 1
            `, [packageName]);
            projDept = pkgCheck.rows[0]?.project_department || null;
        }

        if (!projDept) {
            return res.status(400).json({
                error: "Project Target Department is not assigned so first assigned it"
            });
        }
        // ------------------------------------------------

        // Real uploaded file takes priority; documentUrl/evidenceUrl strings stay
        // as a fallback for any caller that still posts a URL directly instead
        // of a file (kept for backward compatibility, not used by this page anymore).
        const docUrl = req.file ? `/uploads/project-documents/${req.file.filename}` : (documentUrl || evidenceUrl || 'uploaded-document');
        await pool.query(`
            INSERT INTO drm.project_documents (project_id, document_url, uploaded_by_user_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 'PENDING', now(), now())
        `, [id, docUrl, req.user.userId]);

        // Ensure workflow exists for product posting and update salesperson_uploaded_at
        const wfRes = await pool.query(`
            SELECT id FROM drm.product_posting_workflows WHERE project_id = $1
        `, [id]);

        if (wfRes.rows.length === 0) {
            await pool.query(`
                INSERT INTO drm.product_posting_workflows (
                    project_id, current_phase, salesperson_uploaded_at, created_at, updated_at
                ) VALUES (
                    $1, 'PENDING_PROJECT', now(), now(), now()
                )
            `, [id]);
        } else {
            await pool.query(`
                UPDATE drm.product_posting_workflows
                SET salesperson_uploaded_at = now(), updated_at = now(), current_phase = 'PENDING_PROJECT'
                WHERE project_id = $1
            `, [id]);
        }

        // Change project status to Active if it was Documents Pending, and route to the correct department
        await pool.query(`
            UPDATE drm.projects SET status = 'Active', department_type = $2 WHERE id = $1 AND status = 'Documents Pending'
        `, [id, projDept]);

        res.status(200).json({ success: true, message: "Document uploaded successfully" });
    } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ error: "Failed to upload document" });
    }
});

// GET /documents/pending - Stub endpoint for pending documents
router.get("/documents/pending", async (req: any, res: any) => {
    // This endpoint was called by the frontend but not implemented.
    // The product-posting-dashboard relies on /manager/queue instead,
    // so we return an empty array here to prevent 500 errors.
    return res.json([]);
});

// PUT /documents/:id/verify - Verify project document
router.put("/documents/:id/verify", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { id } = req.params;
        const { action, reason } = req.body;
        
        const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        
        const docRes = await pool.query(
            `UPDATE drm.project_documents SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, project_id`,
            [status, id]
        );
        
        if (docRes.rowCount === 0) return res.status(404).json({ error: "Document not found" });
        
        const projectId = docRes.rows[0].project_id;
        
        if (status === 'REJECTED') {
            const wfRes = await pool.query(
                `SELECT id, current_phase FROM drm.product_posting_workflows WHERE project_id = $1`,
                [projectId]
            );
            if (wfRes.rows.length > 0) {
                await pool.query(
                    `INSERT INTO drm.product_posting_rework_history (workflow_id, from_phase, to_phase, action, remarks, actor_user_id)
                     VALUES ($1, $2, 'PENDING_PROJECT', 'DOCUMENT_REJECTED', $3, $4)`,
                    [wfRes.rows[0].id, wfRes.rows[0].current_phase, reason, req.user?.userId || req.user?.id]
                );
                
                await pool.query(
                    `UPDATE drm.product_posting_workflows SET current_phase = 'RETURNED_FOR_CHANGE' WHERE id = $1`,
                    [wfRes.rows[0].id]
                );
            }
        } else {
            // If approved, move phase to VERIFICATION_COMPLETE
            await pool.query(
                `UPDATE drm.product_posting_workflows SET current_phase = 'VERIFICATION_COMPLETE' WHERE project_id = $1`,
                [projectId]
            );
        }
        
        return res.json({ success: true });
    } catch (error) {
        console.error("Error verifying document:", error);
        return res.status(500).json({ error: "Failed to verify document" });
    }
});

// GET /api/projects/:id/details - Fetch project details
router.get("/:id/details", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { id } = req.params;
        
        const detailsRes = await pool.query(`
            SELECT pd.*, 
                   json_build_object(
                       'id', p.id,
                       'companyName', COALESCE(c.company_name, inv.company_name, p.name)
                   ) as project
            FROM drm.project_details pd
            JOIN drm.projects p ON p.id = pd.project_id
            LEFT JOIN drm.customers c ON c.id = p.customer_id
            LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
            WHERE pd.project_id = $1
        `, [id]);
        
        if (detailsRes.rows.length === 0) {
            // Provide fallback if no details uploaded yet
            const projectRes = await pool.query(`
                SELECT p.id, COALESCE(c.company_name, inv.company_name, p.name) as "companyName", p.created_at as "createdAt"
                FROM drm.projects p
                LEFT JOIN drm.customers c ON c.id = p.customer_id
                LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                WHERE p.id = $1
            `, [id]);
            if (projectRes.rows.length > 0) {
                return res.json({ data: { project: projectRes.rows[0], createdAt: projectRes.rows[0].createdAt } });
            }
            return res.status(404).json({ error: "Project not found" });
        }
        
        const row = detailsRes.rows[0];
        res.json({
            data: {
                project: row.project,
                packageName: row.package_name,
                minisiteUrl: row.minisite_url,
                phone: row.phone,
                mobile: row.mobile,
                address: row.address,
                reference: row.reference,
                categories: row.categories,
                detailNotes: row.detail_notes,
                evidenceUrl: row.evidence_url,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }
        });
    } catch (error) {
        console.error("Error fetching project details:", error);
        res.status(500).json({ error: "Failed to fetch project details" });
    }
});

// GET /api/projects/:id/documents - Fetch project documents
router.get("/:id/documents", async (req: any, res: any) => {
    try {
        if (!req.user) return res.status(401).json({ error: "Not authenticated" });
        const { id } = req.params;
        
        const docsRes = await pool.query(`
            SELECT id, document_url as "documentUrl", status, created_at as "createdAt"
            FROM drm.project_documents
            WHERE project_id = $1
            ORDER BY created_at DESC
        `, [id]);
        
        res.json({ data: docsRes.rows });
    } catch (error) {
        console.error("Error fetching project documents:", error);
        res.status(500).json({ error: "Failed to fetch project documents" });
    }
});

export const projectDocRouter = router;
