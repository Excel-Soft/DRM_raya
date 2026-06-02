import { pool } from "../server/db";

async function testApi() {
    const userId = "b6d20d05-77d2-4067-898f-3e32cb5954cb"; // Roshan, dd_manager
    const statusType = "waiting";

    console.log(`--- TESTING API FOR USER ${userId} / ${statusType} ---`);

    try {
        let statusSql = "(t.status = 'ToDo' OR t.status = 'InProgress')";
        if (statusType === "delay") statusSql = "t.status = 'Blocked'";
        if (statusType === "approved") statusSql = "t.status = 'Completed'";

        const listResult = await pool.query(`
            SELECT 
                t.id,
                t.title,
                p.name as "projectName",
                t.status,
                t.updated_at as "updatedAt",
                'TASK' as "itemType"
            FROM tasks t
            LEFT JOIN projects p ON p.id::text = t.project_id::text
            WHERE ${statusSql}
                AND (t.owner_user_id::text = $1::text OR t.assigned_to_user_id::text = $2::text OR t.created_by::text = $3::text)
            LIMIT 50
        `, [userId, userId, userId]);
        
        console.log(`Found ${listResult.rows.length} standard tasks.`);

        let combinedList = listResult.rows.map(t => ({
            id: t.id,
            company: t.projectName || "Unknown Project",
            project: t.title,
            status: t.status,
            time: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "-",
            itemType: 'TASK'
        }));

        if (statusType === "waiting") {
            const ppResult = await pool.query(`
                SELECT 
                    wf.project_id as id,
                    p.name as "projectName",
                    COALESCE(inv.project_name, p.name) as "invoiceProject",
                    COALESCE(inv.company_name, 'New Minisite') as "company",
                    wf.current_phase as status,
                    wf.updated_at as "updatedAt"
                FROM drm.product_posting_workflows wf
                INNER JOIN drm.projects p ON p.id = wf.project_id
                LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                WHERE wf.current_phase = 'DATA_VERIFY'
                AND (
                    p.name ILIKE '%mini%'
                    OR inv.project_name ILIKE '%mini%'
                    OR inv.company_name ILIKE '%mini%'
                )
                LIMIT 20
            `);

            console.log(`Found ${ppResult.rows.length} product posting projects.`);
            console.table(ppResult.rows);

            const ppList = ppResult.rows.map(p => ({
                id: p.id,
                company: p.company,
                project: p.projectName || p.invoiceProject,
                status: "Verification",
                time: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-",
                itemType: 'PRODUCT_POSTING',
                isVerifiable: true
            }));

            combinedList = [...ppList, ...combinedList];
        }

        console.log("\nCombined Result:");
        console.table(combinedList);

    } catch (error) {
        console.error("API logic failed:", error);
    }

    process.exit(0);
}

testApi();
