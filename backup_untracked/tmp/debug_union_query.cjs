const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    // Run the EXACT same query as the HOD repository pendingApprovalsUnion
    const result = await pool.query(`
    with pending as (
      select 'Leave'::text as type,
             id::text as id,
             id::text as "referenceId",
             user_id::text as "submittedById",
             created_at as "date",
             status,
             'leave_requests'::text as source,
             NULL::text as "companyName",
             NULL::text as "drmId",
             NULL::numeric as "orderDollar",
             NULL::text as "memberId",
             NULL::text as "packageName"
      from drm.leave_requests
      where status = 'Pending'
      union all
      select 'Loan'::text as type,
             id::text as id,
             id::text as "referenceId",
             user_id::text as "submittedById",
             created_at as "date",
             status,
             'loan_requests'::text as source,
             NULL::text as "companyName",
             NULL::text as "drmId",
             NULL::numeric as "orderDollar",
             NULL::text as "memberId",
             NULL::text as "packageName"
      from drm.loan_requests
      where status = 'Pending'
      union all
      select 'Overtime'::text as type,
             id::text as id,
             id::text as "referenceId",
             user_id::text as "submittedById",
             created_at as "date",
             status,
             'overtime_records'::text as source,
             NULL::text as "companyName",
             NULL::text as "drmId",
             NULL::numeric as "orderDollar",
             NULL::text as "memberId",
             NULL::text as "packageName"
      from drm.overtime_records
      where status = 'Pending'
      union all
      select 'GM Entry'::text as type,
             g.id::text as id,
             g.id::text as "referenceId",
             g.created_by::text as "submittedById",
             g.created_at as "date",
             COALESCE(g.approval_status, 'pending_hod') as status,
             'gm_entries'::text as source,
             c.company_name as "companyName",
             c.drm_id as "drmId",
             g.amount_usd as "orderDollar",
             g.member_id as "memberId",
             g.package_type as "packageName"
      from drm.gm_entries g
      left join drm.customers c on c.id = g.customer_id
      where g.approval_status IS NULL OR g.approval_status = 'pending_hod'
      union all
      select 'Invoice'::text as type,
             q.id::text as id,
             q.id::text as "referenceId",
             q.created_by::text as "submittedById",
             q.created_at as "date",
             case when q.save_status = 'pending_hod' then 'Pending' else q.save_status end as status,
             'quotations'::text as source,
             q.company as "companyName",
             NULL::text as "drmId",
             q.grand_total as "orderDollar",
             NULL::text as "memberId",
             NULL::text as "packageName"
      from drm.quotations q
      where q.save_status = 'pending_hod'
    )
    select p.*,
           u.full_name as "submittedByName"
    from pending p
    left join drm.users u on u.id::text = p."submittedById"
    order by p.created_at desc
    limit 20
  `);

    console.log("Total pending approvals:", result.rows.length);
    console.log("Items by type:");
    const byType = {};
    result.rows.forEach(r => {
        byType[r.type] = (byType[r.type] || 0) + 1;
        if (r.type === 'Invoice') {
            console.log("  Invoice row:", JSON.stringify(r, null, 2));
        }
    });
    console.log("Count by type:", JSON.stringify(byType, null, 2));

    await pool.end();
}

main().catch(err => {
    console.error("Error:", err.message);
    pool.end();
});
