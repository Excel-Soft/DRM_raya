import { db, pool } from "../server/db";
import { projects, productPostingInvoices, productPostingWorkflows } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

async function diagnose() {
    console.log("--- DIAGNOSING MINI SITE PROJECTS ---");
    
    // 1. Check all projects that might be minisites
    const res = await pool.query(`
        SELECT 
            p.id, 
            p.name as "project_name", 
            inv.project_name as "invoice_project",
            inv.company_name as "invoice_company",
            wf.current_phase,
            wf.id as "workflow_id"
        FROM projects p
        LEFT JOIN product_posting_invoices inv ON inv.id = p.invoice_id
        LEFT JOIN product_posting_workflows wf ON wf.project_id = p.id
        WHERE 
            LOWER(p.name) LIKE '%mini%' OR 
            LOWER(inv.project_name) LIKE '%mini%' OR
            LOWER(inv.company_name) LIKE '%mini%'
    `);
    
    console.log(`Found ${res.rows.length} potential mini projects:`);
    console.table(res.rows);

    if (res.rows.length === 0) {
        console.log("\n[WARNING] No projects found matching 'mini' keywords!");
    }
    
    // Let's check THE LATEST 5 projects regardless of name
    const latest = await pool.query(`
        SELECT 
            p.id, 
            p.name, 
            p.status,
            wf.current_phase,
            p.created_at
        FROM projects p
        LEFT JOIN product_posting_workflows wf ON wf.project_id = p.id
        ORDER BY p.created_at DESC
        LIMIT 10
    `);
    console.log("\nLatest 10 projects in DB:");
    console.table(latest.rows);

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
