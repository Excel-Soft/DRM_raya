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

        // --- Check Service Configuration for Routing ---
        // We get the project's service_type, and then find its project_department in service_subservices
        // We also check if the project already has a department_type assigned
        const routingCheck = await pool.query(`
            SELECT
                p.department_type,
                COALESCE(ss.project_department, s.project_department) AS project_department
            FROM drm.projects p
            LEFT JOIN drm.service_subservices ss ON p.service_type = ss.name
            LEFT JOIN drm.services s ON p.service_type = s.name
            WHERE p.id = $1
        `, [id]);

        const projDept = routingCheck.rows[0]?.project_department || routingCheck.rows[0]?.department_type;
        if (!projDept) {
            return res.status(400).json({
                error: "Target department not found. Please contact management to add the Target department against this service."
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
                SET salesperson_uploaded_at = now(), updated_at = now()
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

export const projectDocRouter = router;
