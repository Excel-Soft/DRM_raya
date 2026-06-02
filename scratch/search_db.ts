import { pool } from "../server/db";

async function main() {
    try {
        console.log("Searching projects for 'Bradford' or 'Bilal'...");
        const resProj = await pool.query(
            "select id, name, customer_id, invoice_id from drm.projects where name ilike '%Bradford%' or name ilike '%Bilal%'"
        );
        console.log("Projects found:", resProj.rows);

        const resCust = await pool.query(
            "select id, company_name, account_name from drm.customers where company_name ilike '%Bradford%' or company_name ilike '%Bilal%'"
        );
        console.log("Customers found:", resCust.rows);

        const resTask = await pool.query(
            "select id, title, project_id from drm.tasks where title ilike '%Bradford%' or title ilike '%Bilal%'"
        );
        console.log("Tasks found:", resTask.rows);

        const resWork = await pool.query(
            "select id, project_id, task_id, current_phase from drm.product_posting_workflows"
        );
        console.log("Workflows total count:", resWork.rows.length);

        if (resProj.rows.length > 0) {
            const pIds = resProj.rows.map(r => r.id);
            const resLinks = await pool.query(
                `select * from drm.product_posting_evidence_links where project_id = any($1)`,
                [pIds]
            );
            console.log("Evidence links for found projects:", resLinks.rows);
        }
    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

main();
