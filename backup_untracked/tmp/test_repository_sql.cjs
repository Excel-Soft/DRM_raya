
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const userId = "some-uuid";
    const pageSize = 10;
    const offset = 0;
    const isManagerOrAdmin = true; // test both cases
    
    // Simulating listSql from customers.repository.ts
    const sqlText = `
      select * from (
        select 
          c.id::text as id,
          c.drm_id as "drmId",
          c.company_name as "companyName",
          c.account_name as "accountName",
          c.email as email,
          c.phone as phone,
          c.region,
          c.grade,
          c.status,
          c.ntn as ntn,
          c.last_note as "lastNote",
          c.country,
          c.city,
          c.address,
          c.crm_id as "crmId",
          c.crm_date as "crmDate",
          c.company_type as "companyType",
          c.title as title,
          c.person_name as "personName",
          c.cnic as cnic,
          c.website,
          c.mobile as mobile,
          c.designation,
          c.comment as comment,
          c.rc_link as "rcLink",
          c.source,
          c.service_types as "serviceTypes",
          c.business_line as "businessLine",
          'Private'::text as "poolType",
          coalesce(c.owner_user_id, c.created_by) as "ownerUserId",
          null::timestamp as "lastFollowUpDate",
          null::timestamp as "expiresAt",
          0 as "isGoldMember",
          0 as "isBusinessVerified",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          op.id as "opportunityId",
          op.stage as "opportunityStage",
          op.owner_id as "opportunityOwnerId",
          op.value as "opportunityAmount",
          op.title as "opportunityTitle",
          op.expected_close_date as "expectedCloseDate",
          op.is_deleted as "opportunityIsDeleted",
          op.created_at as "opportunityCreatedAt",
          op.updated_at as "opportunityUpdatedAt",
          false as "isTemp"
        from drm.customers c
        left join drm.opportunities op on op.customer_id = c.id and coalesce(op.is_deleted,false) = false
        
        union all
        
        select
          t.id::text as id,
          t.drm_id as "drmId",
          t.person_name as "companyName",
          t.person_name as "accountName",
          t.email as email,
          t.mobile as phone,
          'N/A' as region,
          t.grade,
          'New' as status,
          null::text as ntn,
          t.comment as "lastNote",
          null::text as country,
          null::text as city,
          null::text as address,
          null::text as "crmId",
          null::timestamptz as "crmDate",
          null::text as "companyType",
          t.title as title,
          t.person_name as "personName",
          null::text as cnic,
          null::text as website,
          t.mobile as mobile,
          null::text as designation,
          t.comment as comment,
          null::text as "rcLink",
          t.source,
          t.service_types as "serviceTypes",
          null::text as "businessLine",
          'Private'::text as "poolType",
          t.user_id::uuid as "ownerUserId",
          null::timestamptz as "lastFollowUpDate",
          null::timestamptz as "expiresAt",
          0 as "isGoldMember",
          0 as "isBusinessVerified",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          null::uuid as "opportunityId",
          'LD' as "opportunityStage",
          t.user_id::uuid as "opportunityOwnerId",
          0::numeric as "opportunityAmount",
          'Quick Lead' as "opportunityTitle",
          null::date as "expectedCloseDate",
          false as "opportunityIsDeleted",
          t.created_at as "opportunityCreatedAt",
          t.updated_at as "opportunityUpdatedAt",
          true as "isTemp"
        from drm.temp_contacts t
        where t.status = 'Pending'
      ) as combined
      order by "createdAt" desc
      limit 10 offset 0
    `;

    try {
        console.log("Testing SQL query...");
        const res = await pool.query(sqlText);
        console.log("Success! Found rows:", res.rows.length);
    } catch (err) {
        console.error("SQL Error:", err.message);
        if (err.hint) console.log("Hint:", err.hint);
    } finally {
        await pool.end();
    }
}

main();
