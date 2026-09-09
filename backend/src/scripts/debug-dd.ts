import { pool } from "../db";

async function testUpload() {
    // Simulate what POST /api/projects/:id/documents does
    const projectId = "ac11272c-982c-438d-ad82-1830d6c50665"; // Listing Page Nadra
    
    try {
        // Step 1: Find project + invoice (same as route)
        const { db } = await import("./db");
        const { projects, productPostingInvoices } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");
        
        const [projectData] = await db
            .select({ project: projects, invoice: productPostingInvoices })
            .from(projects)
            .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
            .where(eq(projects.id, projectId));
        
        console.log("Project found:", projectData?.project?.name);
        console.log("Invoice found:", projectData?.invoice?.projectName);
        
        // Step 2: Try to insert a test document
        const result = await pool.query(`
            INSERT INTO drm.project_documents (project_id, document_url, uploaded_by_user_id, status)
            VALUES ($1, 'test-doc.pdf', (SELECT id FROM drm.users WHERE role_id = 'sales_executive' OR role = 'sales_executive' LIMIT 1), 'PENDING')
            RETURNING id, status, created_at
        `, [projectId]);
        
        console.log("\nTest doc inserted:", result.rows[0]);
        
        // Delete the test doc
        await pool.query("DELETE FROM drm.project_documents WHERE id = $1", [result.rows[0].id]);
        console.log("Test doc cleaned up");
        
        // Step 3: Check getOrCreateProductPostingWorkflow
        const { getOrCreateProductPostingWorkflow } = await import("./services/product-posting-workflow.service");
        const wf = await getOrCreateProductPostingWorkflow(projectId);
        console.log("\nWorkflow:", wf?.id, "phase:", wf?.currentPhase);
        
    } catch(e: any) { 
        console.error('Error at step:', e.message);
        console.error(e.stack);
    } 
    process.exit(0);
}
testUpload();
