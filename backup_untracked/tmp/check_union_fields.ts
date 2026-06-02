import { pool } from "../server/db";

async function run() {
    try {
        const q1 = `
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
        from customers c
        left join opportunities op on op.customer_id = c.id
        limit 1
    `;
        const res1 = await pool.query(q1);
        const fields1 = res1.fields.map(f => ({ name: f.name, typeId: f.dataTypeID }));

        const q2 = `
      select
          t.id::text as id,
          t.id::text as "drmId",
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
          null::timestamp as "crmDate",
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
          t.user_id as "ownerUserId",
          null::timestamp as "lastFollowUpDate",
          null::timestamp as "expiresAt",
          0 as "isGoldMember",
          0 as "isBusinessVerified",
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          null as "opportunityId",
          'LD' as "opportunityStage",
          t.user_id as "opportunityOwnerId",
          '0' as "opportunityAmount",
          'Quick Lead' as "opportunityTitle",
          null as "expectedCloseDate",
          false as "opportunityIsDeleted",
          t.created_at as "opportunityCreatedAt",
          t.updated_at as "opportunityUpdatedAt",
          true as "isTemp"
        from temp_contacts t
        limit 1
    `;
        const res2 = await pool.query(q2);
        const fields2 = res2.fields.map(f => ({ name: f.name, typeId: f.dataTypeID }));

        for (let i = 0; i < fields1.length; i++) {
            if (fields1[i].typeId !== fields2[i].typeId) {
                console.log(`Mismatch on ${fields1[i].name}: Query1=${fields1[i].typeId}, Query2=${fields2[i].typeId}`);
            }
        }

    } catch (err) {
        console.error(err);
    }
    process.exit();
}
run();
