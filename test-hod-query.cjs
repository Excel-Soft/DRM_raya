require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Need to set search_path
pool.on('connect', (client) => {
       client.query("SET search_path TO drm, public");
});

const pendingApprovalsUnion = `
  with pending as (
    select 'Leave'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'leave_requests'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName"
    from drm.leave_requests
    where status::text = 'Pending'
    union all
    select 'Loan'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'loan_requests'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName"
    from drm.loan_requests
    where status::text = 'Pending'
    union all
    select 'Overtime'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'overtime_records'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName"
    from drm.overtime_records
    where status::text = 'Pending'
    union all
    select 'GM Entry'::text as type,
           g.id::text as id,
           g.id::text as "referenceId",
           g.created_by::text as "submittedById",
           g.created_at as "createdAt",
           COALESCE(g.approval_status, 'Pending')::text as status,
           'gm_entries'::text as source,
           c.company_name::text as "companyName",
           c.drm_id::text as "drmId",
           g.amount_usd::numeric as "orderDollar",
           g.member_id::text as "memberId",
           g.package_type::text as "packageName"
    from drm.gm_entries g
    left join drm.customers c on c.id = g.customer_id
    where g.approval_status IS NULL OR g.approval_status = 'Pending'
    union all
    select 'Invoice'::text as type,
           id::text as id,
           id::text as "referenceId",
           created_by_user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'invoices'::text as source,
           customer_name::text as "companyName",
           NULL::text as "drmId",
           total::numeric as "orderDollar",
           invoice_number::text as "memberId",
           NULL::text as "packageName"
    from drm.invoices
    where status::text = 'Pending'
  )
  select p.*,
         u.full_name as "submittedByName"
  from pending p
  left join drm.users u on u.id::text = p."submittedById"
`;

pool.query(`${pendingApprovalsUnion} order by "createdAt" desc limit 10 offset 0`)
       .then(res => console.log("SUCCESS:", res.rows.length, "rows fetched"))
       .catch(err => console.error("ERROR::", err.message))
       .finally(() => process.exit(0));
