import { Router } from "express";
import { pool } from "../db";

const router = Router();

// POST /api/projects/:id/documents - Upload document and project details
router.post("/:id/documents", async (req: any, res: any) => {
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

        // Insert project_documents
        // We use documentUrl if available, else evidenceUrl, else a dummy string
        const docUrl = documentUrl || evidenceUrl || 'uploaded-document';
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

        // Change project status to Active if it was Documents Pending
        await pool.query(`
            UPDATE drm.projects SET status = 'Active' WHERE id = $1 AND status = 'Documents Pending'
        `, [id]);

        res.status(200).json({ success: true, message: "Document uploaded successfully" });
    } catch (error) {
        console.error("Error uploading document:", error);
        res.status(500).json({ error: "Failed to upload document" });
    }
});

export const projectDocRouter = router;
