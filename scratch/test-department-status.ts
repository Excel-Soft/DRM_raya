import { pool } from "../server/db";

async function main() {
  const userId = "64b855c8-1136-4d7a-bc8c-17f172e65199";
  const userRole = "posting_executive";
  
  const roleFilter = `AND EXISTS (SELECT 1 FROM drm.tasks t WHERE t.project_id = p.id AND t.assigned_to_user_id = '${userId}')`;
  
  const queryStr = `
    SELECT 
      p.id,
      COALESCE(i.company_name, c.company_name, 'Unknown') as "company",
      COALESCE(i.project_name, p.name) as "project",
      p.status,
      u.name as "assign",
      p.created_at as "date",
      COALESCE(fin.total_amount, 0) as "amount",
      i.status as "invoiceStatus",
      (SELECT COUNT(*) FROM drm.tasks t WHERE t.project_id = p.id) as "totalTasks",
      (SELECT SUM(duration_minutes) FROM drm.task_time_logs tl JOIN drm.tasks t ON tl.task_id = t.id WHERE t.project_id = p.id) as "totalTime"
    FROM drm.projects p
    LEFT JOIN drm.product_posting_invoices i ON p.invoice_id = i.id
    LEFT JOIN drm.customers c ON p.customer_id = c.id
    LEFT JOIN drm.users u ON p.owner_user_id = u.id
    LEFT JOIN drm.project_financials fin ON fin.project_id = p.id
    WHERE coalesce(p.is_deleted, false) = false
    ${roleFilter}
    ORDER BY p.updated_at DESC
  `;
  
  const { rows } = await pool.query(queryStr);
  console.log("Department status rows for Faisal:", JSON.stringify(rows, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
