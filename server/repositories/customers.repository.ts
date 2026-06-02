import { db, pool } from "../db";
import { customers, opportunities, tempContacts, type Customer, type Opportunity, type InsertCustomer } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { isManagerialRole } from "../utils/role-utils";

export type CustomerWithOpportunity = Customer & {
  opportunity?: Opportunity;
};

export type CustomerFollowUpDetail = {
  id: string;
  companyName: string;
  serviceName: string;
  serviceType: string;
  serviceIds: string[];
  serviceCodes: string[];
  subServiceIds: string[];
  subServiceCodes: string[];
  subServicesByService: Record<string, string[]>;
  reservationType: string | null;
  talkTimeSeconds: number;
  talkMinutes: number;
  talkMinutesSource: "default" | "stored" | "computed";
  grade: string;
  note: string | null;
  createdAt: Date;
  source: string | null;
};

let ensuredFollowupReservation = false;
async function ensureFollowupReservationColumn() {
  if (ensuredFollowupReservation) return;
  try {
    await pool.query(
      `alter table follow_ups 
         add column if not exists reservation_type text,
         add column if not exists talk_time_seconds int not null default 0;`
    );
  } catch (err) {
    console.error("Failed ensuring follow_ups.reservation_type (continuing):", err);
  } finally {
    ensuredFollowupReservation = true;
  }
}

let ensuredFollowupSubservices = false;
async function ensureFollowupSubservicesTables() {
  if (ensuredFollowupSubservices) return;
  const ddl = `
    create table if not exists service_subservices (
      id uuid primary key default gen_random_uuid(),
      service_id uuid not null references services(id) on delete cascade,
      code text not null unique,
      name text not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      unique(service_id, code)
    );

    create table if not exists followup_subservices (
      followup_id uuid not null references follow_ups(id) on delete cascade,
      subservice_id uuid not null references service_subservices(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (followup_id, subservice_id)
    );

    create index if not exists idx_service_subservices_service on service_subservices(service_id);
    create index if not exists idx_followup_subservices_followup on followup_subservices(followup_id);

  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring followup subservice tables (continuing):", err);
  } finally {
    ensuredFollowupSubservices = true;
  }
}

let ensuredCallSessionsTable = false;
async function ensureCallSessionsTable() {
  if (ensuredCallSessionsTable) return;
  const ddl = `
    create table if not exists call_sessions (
      id varchar primary key default gen_random_uuid(),
      user_id varchar not null,
      customer_id varchar null,
      lead_id text null,
      followup_id varchar null,
      reservation_type text not null,
      direction text not null default 'outbound',
      status text not null,
      started_at timestamptz not null,
      ended_at timestamptz null,
      duration_seconds int not null default 0,
      provider text null,
      provider_call_id text null,
      created_at timestamptz not null default now()
    );
    alter table call_sessions
      alter column id type varchar using id::varchar,
      alter column user_id type varchar using user_id::varchar,
      alter column customer_id type varchar using customer_id::varchar,
      alter column followup_id type varchar using followup_id::varchar;
    create index if not exists idx_call_sessions_user_started on call_sessions(user_id, started_at);
    create index if not exists idx_call_sessions_followup on call_sessions(followup_id);
    create unique index if not exists uq_call_sessions_provider_call on call_sessions(provider_call_id) where provider_call_id is not null;
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring call_sessions table (continuing):", err);
  } finally {
    ensuredCallSessionsTable = true;
  }
}

let ensuredTempContactsDrmId = false;
async function ensureTempContactsDrmIdColumn() {
  if (ensuredTempContactsDrmId) return;
  try {
    await pool.query(
      `alter table drm.temp_contacts add column if not exists drm_id text unique;`
    );
  } catch (err) {
    console.error("Failed ensuring temp_contacts.drm_id (continuing):", err);
  } finally {
    ensuredTempContactsDrmId = true;
  }
}

export class CustomersRepository {
  async findById(id: string): Promise<CustomerWithOpportunity | undefined> {
    const result = await db
      .select()
      .from(customers)
      .leftJoin(opportunities, eq(customers.id, opportunities.customerId))
      .where(eq(customers.id, id))
      .limit(1);

    if (!result[0]) return undefined;

    return {
      ...result[0].customers,
      opportunity: result[0].opportunities || undefined,
    };
  }

  async findByUserId(
    userId: string,
    filters?: {
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      grade?: string;
      stage?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
    roleId?: string,
    salesTable?: string
  ): Promise<{ customers: CustomerWithOpportunity[]; total: number }> {
    await ensureTempContactsDrmIdColumn();
    const { status, search, page = 1, pageSize = 10, grade, stage, sortBy = "createdAt", sortOrder = "desc" } = filters || {};
    const offset = (page - 1) * pageSize;

    const whereParts = ["1=1"];
    const params: any[] = [];
    let p = 1;

    const normalizedRole = roleId?.toLowerCase?.() ?? "";
    const isManagerOrAdmin = isManagerialRole(roleId) || normalizedRole.includes("reception");
    if (!isManagerOrAdmin) {
      whereParts.push(`coalesce(op.owner_id::text, c.owner_user_id::text, c.created_by::text) = $${p++}::text`);
      params.push(userId);
    }

    if (status) {
      whereParts.push(`c.status = $${p++}`);
      params.push(status);
    }
    if (grade) {
      whereParts.push(`c.grade = $${p++}`);
      params.push(grade);
    }
    if (stage) {
      whereParts.push(`op.stage = $${p++}`);
      params.push(stage);
    }
    if (search) {
      whereParts.push(`(
        c.company_name ILIKE $${p}
        OR c.rc_link ILIKE $${p}
        OR c.region ILIKE $${p}
      )`);
      params.push(`%${search}%`);
      p++;
    }

    const orderColumn =
      sortBy === "companyName" ? "c.company_name" :
        sortBy === "grade" ? "c.grade" :
          sortBy === "stage" ? "op.stage" :
            sortBy === "email" ? "c.company_name" :
              "c.created_at";

    const orderDir = sortOrder === "asc" ? "asc" : "desc";

    const whereSql = whereParts.length ? `where ${whereParts.join(" and ")}` : "";
    const targetTable = salesTable && salesTable.startsWith("drm.") ? salesTable : "drm.customers";

    const countSql = `
      select count(*)::int as count from (
        select c.id::text as id
        from ${targetTable} c
        left join drm.opportunities op on op.customer_id = c.id and coalesce(op.is_deleted,false) = false
        ${whereSql}
        union all
        select t.id::text as id
        from drm.temp_contacts t
        where t.status = 'Pending' -- Only show pending leads in the main list
        ${(stage && stage !== 'LD') ? 'and 1=0' : ""}
        ${search ? `and (t.person_name ILIKE $${params.indexOf(`%${search}%`) + 1} or t.email ILIKE $${params.indexOf(`%${search}%`) + 1})` : ""}
        ${grade ? `and t.grade = $${params.indexOf(grade) + 1}` : ""}
        ${!isManagerOrAdmin ? `and t.user_id::text = $${params.indexOf(userId) + 1}::text` : ""}
      ) as combined
    `;

    const listSql = `
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
        from ${targetTable} c
        left join drm.opportunities op on op.customer_id = c.id and coalesce(op.is_deleted,false) = false
        ${whereSql}
        
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
        ${(stage && stage !== 'LD') ? 'and 1=0' : ""}
        ${search ? `and (t.person_name ILIKE $${params.indexOf(`%${search}%`) + 1} or t.email ILIKE $${params.indexOf(`%${search}%`) + 1})` : ""}
        ${grade ? `and t.grade = $${params.indexOf(grade) + 1}` : ""}
        ${!isManagerOrAdmin ? `and t.user_id::text = $${params.indexOf(userId) + 1}::text` : ""}
      ) as combined
      order by ${orderColumn === "c.company_name" ? '"companyName"' : orderColumn === "c.grade" ? "grade" : orderColumn === "op.stage" ? '"opportunityStage"' : '"createdAt"'} ${orderDir}
      limit ${pageSize} offset ${offset}
    `;



    const client = await pool.connect();
    try {
      const [countRes, listRes] = await Promise.all([
        client.query<{ count: number }>(countSql, params),
        client.query(listSql, params),
      ]);

      const customersWithOpportunities: CustomerWithOpportunity[] = listRes.rows.map((row: any) => ({
        id: row.id,
        drmId: row.drmId,
        companyName: row.companyName,
        accountName: row.accountName ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        region: row.region ?? "",
        grade: row.grade ?? "",
        status: row.status ?? "New",
        ntn: row.ntn ?? null,
        lastNote: row.lastNote ?? null,
        country: row.country ?? null,
        city: row.city ?? null,
        address: row.address ?? null,
        crmId: row.crmId ?? null,
        crmDate: row.crmDate ?? null,
        companyType: row.companyType ?? null,
        title: row.title ?? null,
        personName: row.personName ?? null,
        cnic: row.cnic ?? null,
        website: row.website ?? null,
        mobile: row.mobile ?? null,
        designation: row.designation ?? null,
        comment: row.comment ?? null,
        rcLink: row.rcLink ?? null,
        source: row.source ?? null,
        serviceTypes: row.serviceTypes ?? [],
        businessLine: row.businessLine ?? null,
        poolType: row.poolType ?? "Private",
        ownerUserId: row.ownerUserId ?? null,
        lastFollowUpDate: row.lastFollowUpDate ?? null,
        expiresAt: row.expiresAt ?? null,
        isGoldMember: Number(row.isGoldMember ?? 0),
        isBusinessVerified: Number(row.isBusinessVerified ?? 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        opportunity: row.opportunityId
          ? {
            id: row.opportunityId,
            customerId: row.id,
            ownerUserId: row.opportunityOwnerId,
            stage: row.opportunityStage,
            amount: row.opportunityAmount ?? "0",
            expectedCloseDate: row.expectedCloseDate,
            title: row.opportunityTitle,
            isDeleted: row.opportunityIsDeleted ?? false,
            createdAt: row.opportunityCreatedAt,
            updatedAt: row.opportunityUpdatedAt,
          } as Opportunity
          : undefined,
      }));

      return { customers: customersWithOpportunities, total: countRes.rows[0]?.count ?? 0 };
    } finally {
      client.release();
    }
  }

  async search(query: string, userId?: string, isManager?: boolean, limit = 10): Promise<Customer[]> {
    const client = await pool.connect();
    try {
      const params: any[] = [`%${query}%`, limit];
      let whereClause = `
         (c.company_name ilike $1
         or c.account_name ilike $1
         or c.email ilike $1
         or c.phone ilike $1
         or c.ntn ilike $1
         or c.drm_id ilike $1)
      `;

      if (userId && !isManager) {
        params.push(userId);
        whereClause += ` and (c.pool_type = 'Public' or coalesce(c.owner_user_id::text, c.created_by::text) = $3::text)`;
      }

      const res = await client.query(
        `select c.*
         from drm.customers c
         where ${whereClause}
         order by c.created_at desc
         limit $2`,
        params,
      );
      return res.rows as any;
    } finally {
      client.release();
    }
  }

  async getFollowUpDetails(customerId: string): Promise<CustomerFollowUpDetail[] | { success: false; message: string }> {
    try {
      await ensureFollowupReservationColumn();
      await ensureFollowupSubservicesTables();
      await ensureCallSessionsTable();
      await ensureTempContactsDrmIdColumn();
      const sqlText = `
        (
          select
            f.id::text,
            c.drm_id as "drmId",
            c.company_name,
            c.grade,
            f.notes,
            f.created_at,
            f.status,
            f.method,
            f.reservation_type,
            coalesce(f.talk_time_seconds,0) as stored_seconds,
            (
              select coalesce(sum(cs.duration_seconds),0)
              from drm.call_sessions cs
              where cs.followup_id::text = f.id::text
                and cs.status = 'ENDED'
            ) as session_seconds,
            array_remove(array_agg(s.name) filter (where s.id is not null), null) as service_names,
            array_remove(array_agg(s.id) filter (where s.id is not null), null) as service_ids,
            array_remove(array_agg(s.code) filter (where s.id is not null), null) as service_codes,
            array_remove(array_agg(ss.code) filter (where ss.id is not null), null) as subservice_codes,
            array_remove(array_agg(ss.id) filter (where ss.id is not null), null) as subservice_ids,
            coalesce(
              json_agg(
                json_build_object(
                  'serviceCode', s2.code,
                  'serviceId', s2.id,
                  'code', ss.code,
                  'id', ss.id
                )
              ) filter (where ss.id is not null),
              '[]'
            ) as subservice_pairs,
            'followup' as type
          from drm.follow_ups f
          left join drm.customers c on c.id::text = f.customer_id::text
          left join drm.followup_services fs on fs.followup_id::text = f.id::text
          left join drm.services s on s.id::text = fs.service_id::text
          left join drm.followup_subservices fss on fss.followup_id::text = f.id::text
          left join drm.service_subservices ss on ss.id::text = fss.subservice_id::text
          left join drm.services s2 on s2.id::text = ss.service_id::text
          where f.customer_id::text = $1::text
            and coalesce(f.is_deleted,false)=false
          group by f.id, c.drm_id, c.company_name, c.grade, f.notes, f.created_at, f.status, f.method
        )
        union all
        (
          select
            g.id::text,
            c.drm_id as "drmId",
            c.company_name,
            c.grade,
            coalesce(g.package_type, '') || ' (' || coalesce(g.status, 'New') || ') - ' || coalesce(g.sales_person_name, 'Unknown') as notes,
            g.created_at,
            g.status,
            'GM Entry' as method,
            'GM' as reservation_type,
            0 as stored_seconds,
            0 as session_seconds,
            array[coalesce(g.package_type, 'GM Entry')] as service_names,
            array[]::uuid[] as service_ids,
            array[]::text[] as service_codes,
            array[]::text[] as subservice_codes,
            array[]::uuid[] as subservice_ids,
            '[]'::json as subservice_pairs,
            'gm_entry' as type
          from drm.gm_entries g
          left join drm.customers c on c.id::text = g.customer_id::text
          where g.customer_id::text = $1::text
            and coalesce(g.is_deleted,false)=false
        )
        order by created_at desc
      `;
      const result = await pool.query(sqlText, [customerId]);

      return result.rows.map((row: any) => {
        const pairs: Array<{ serviceCode?: string; serviceId?: string; code?: string; id?: string }> = row.subservice_pairs ?? [];
        const subServicesByService: Record<string, string[]> = {};
        for (const pair of pairs) {
          const key = pair.serviceCode || pair.serviceId || "";
          if (!key) continue;
          if (!subServicesByService[key]) subServicesByService[key] = [];
          if (pair.code) subServicesByService[key].push(pair.code);
        }

        return {
          id: row.id,
          companyName: row.company_name,
          serviceName: row.service_names?.length ? row.service_names.join(", ") : "Follow-up",
          serviceType: row.method || row.status || "Follow-up",
          grade: row.grade,
          note: row.notes,
          createdAt: row.created_at,
          source: row.status || "Manual",
          serviceIds: row.service_ids ?? [],
          serviceCodes: row.service_codes ?? [],
          subServiceIds: row.subservice_ids ?? [],
          subServiceCodes: row.subservice_codes ?? [],
          subServicesByService,
          reservationType: row.reservation_type ?? null,
          talkTimeSeconds: Number(row.stored_seconds ?? 0) + Number(row.session_seconds ?? 0),
          talkMinutes: (() => {
            const combined = Number(row.stored_seconds ?? 0) + Number(row.session_seconds ?? 0);
            if (combined > 0) return Math.ceil(combined / 60);
            const callTypes = new Set(["MOBILE", "W_CALL", "VM_APPOINTMENT"]);
            return callTypes.has(row.reservation_type ?? "") ? 10 : 0;
          })(),
          talkMinutesSource: (() => {
            if (Number(row.session_seconds ?? 0) > 0) return "computed";
            if (Number(row.stored_seconds ?? 0) > 0) return "stored";
            return "default";
          })(),
        };
      });
    } catch (err) {
      console.error("Failed fetching follow-up details:", err);
      return { success: false, message: "Failed to fetch follow-up details" };
    }
  }

  async updateGrade(customerId: string, grade: string): Promise<Customer | undefined> {
    const result = await db
      .update(customers)
      .set({ grade, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning();

    if (result.length > 0) return result[0];

    // Try updating temp_contacts
    const tempResult = await db
      .update(tempContacts)
      .set({ grade, updatedAt: new Date() })
      .where(eq(tempContacts.id, customerId))
      .returning();

    if (tempResult.length > 0) {
      const t = tempResult[0];
      return { id: t.id, companyName: t.personName, grade: t.grade } as any;
    }
    return undefined;
  }

  async updateNote(customerId: string, note: string): Promise<Customer | undefined> {
    const result = await db
      .update(customers)
      .set({ lastNote: note, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning();

    if (result.length > 0) return result[0];

    // Try updating temp_contacts (comment field)
    const tempResult = await db
      .update(tempContacts)
      .set({ comment: note, updatedAt: new Date() })
      .where(eq(tempContacts.id, customerId))
      .returning();

    if (tempResult.length > 0) {
      const t = tempResult[0];
      return { id: t.id, companyName: t.personName, lastNote: t.comment } as any;
    }
    return undefined;
  }

  async updateStage(customerId: string, userId: string, stage: string): Promise<void> {
    // Stage updates for customers update the opportunity
    const result = await db
      .update(opportunities)
      .set({ stage: stage as any, updatedAt: new Date() })
      .where(and(
        eq(opportunities.customerId, customerId),
        eq(opportunities.ownerUserId, userId),
        eq(opportunities.isDeleted, false),
      )!);

    // If it's a temporary contact, we don't have separate opportunities yet.
    // Changing stage from 'LD' (Lead) for a temp contact should probably promote it,
    // but for now, we'll just allow it to stay as 'LD' visually or do nothing.
    // However, the query uses 'LD' as virtual stage for temp contacts.
  }

  async getGradeStats(userId: string, roleId?: string): Promise<Record<string, number>> {
    const isManagerOrAdmin = isManagerialRole(roleId);
    let custWhere = and(eq(opportunities.isDeleted, false))!;
    if (!isManagerOrAdmin) {
      custWhere = and(custWhere, eq(opportunities.ownerUserId, userId))!;
    }

    const custGrades = await db
      .select({
        grade: customers.grade,
        count: sql<number>`count(*)`,
      })
      .from(customers)
      .innerJoin(opportunities, eq(customers.id, opportunities.customerId))
      .where(custWhere)
      .groupBy(customers.grade);

    let tempWhere = eq(tempContacts.status, 'Pending') as any;
    if (!isManagerOrAdmin) {
      tempWhere = and(tempWhere, eq(tempContacts.userId, userId))!;
    }

    const tempGrades = await db
      .select({
        grade: tempContacts.grade,
        count: sql<number>`count(*)`,
      })
      .from(tempContacts)
      .where(tempWhere)
      .groupBy(tempContacts.grade);

    const stats: Record<string, number> = {};
    [...custGrades, ...tempGrades].forEach(row => {
      stats[row.grade] = (stats[row.grade] || 0) + Number(row.count);
    });

    return stats;
  }

  async getStageStats(userId: string, roleId?: string): Promise<Record<string, number>> {
    const isManagerOrAdmin = isManagerialRole(roleId);
    let custWhere = and(eq(opportunities.isDeleted, false))!;
    if (!isManagerOrAdmin) {
      custWhere = and(custWhere, eq(opportunities.ownerUserId, userId))!;
    }

    const custStages = await db
      .select({
        stage: opportunities.stage,
        count: sql<number>`count(*)`,
      })
      .from(opportunities)
      .where(custWhere)
      .groupBy(opportunities.stage);

    let tempWhere = eq(tempContacts.status, 'Pending') as any;
    if (!isManagerOrAdmin) {
      tempWhere = and(tempWhere, eq(tempContacts.userId, userId))!;
    }

    const tempCount = await db
      .select({
        count: sql<number>`count(*)`
      })
      .from(tempContacts)
      .where(tempWhere);

    const stats: Record<string, number> = {};
    custStages.forEach(row => {
      stats[row.stage] = Number(row.count);
    });

    // All temporary contacts are virtual 'LD' stage
    if (tempCount.length > 0) {
      stats['LD'] = (stats['LD'] || 0) + Number(tempCount[0].count);
    }

    return stats;
  }
}

// Duplicate check result type
export type DuplicateCheckResult = {
  id: string;
  companyName: string;
  accountName: string;
  email: string;
  phone: string;
  salesPersonId: string | null;
  salesPersonName: string | null;
  lastFollowDate: Date | null;
  matchType: 'company' | 'email' | 'phone';
};

export class CustomersRepositoryExtended extends CustomersRepository {
  // Check for duplicate customers by company name, email, or phone
  async checkDuplicates(params: {
    company?: string;
    email?: string;
    phone?: string;
    ownerUserId?: string;
  }): Promise<DuplicateCheckResult[]> {
    const { company, email, phone, ownerUserId } = params;
    if (!company && !email && !phone) return [];

    const conditions: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (company && company.length >= 2) {
      conditions.push(`c.company_name ilike $${i++}`);
      values.push(`%${company}%`);
    }
    if (email && email.length >= 3) {
      conditions.push(`c.email ilike $${i++}`);
      values.push(`%${email}%`);
    }
    if (phone && phone.length >= 4) {
      conditions.push(`c.phone ilike $${i++}`);
      values.push(`%${phone}%`);
    }
    if (conditions.length === 0) return [];

    const whereOwner = ownerUserId ? `and c.owner_user_id = $${i++}` : "";
    if (ownerUserId) values.push(ownerUserId);

    const sqlText = `
      select
        c.id,
        c.company_name,
        c.company_name as account_name,
        null::text as email,
        null::text as phone,
        null::text as ntn,
        coalesce(c.owner_user_id, c.created_by) as sales_person_id,
        u.name as sales_person_name,
        c.created_at,
        op.stage
      from drm.customers c
      left join drm.opportunities op on op.customer_id = c.id and coalesce(op.is_deleted,false) = false
      left join drm.users u on u.id = c.owner_user_id
      where (${conditions.join(" or ")}) ${whereOwner}
      order by c.created_at desc
      limit 20
    `;

    if (process.env.DEBUG_SALES_DASH === "true") {
      console.log(`[checkDuplicates] sql: ${sqlText}`);
      console.log(`[checkDuplicates] params: ${JSON.stringify(values)}`);
    }

    const client = await pool.connect();
    try {
      const res = await client.query(sqlText, values);
      return res.rows.map((r: any) => {
        let matchType: 'company' | 'email' | 'phone' = 'company';
        if (email && r.email && r.email.toLowerCase().includes(email.toLowerCase())) matchType = 'email';
        else if (phone && r.phone && r.phone.includes(phone)) matchType = 'phone';

        return {
          id: r.id,
          companyName: r.company_name,
          accountName: r.account_name,
          email: r.email,
          phone: r.phone,
          salesPersonId: r.sales_person_id,
          salesPersonName: r.sales_person_name,
          lastFollowDate: null,
          matchType,
        };
      });
    } finally {
      client.release();
    }
  }

  // Create a new customer with opportunity
  async create(data: Partial<InsertCustomer>, userId: string): Promise<Customer> {
    const requiredCompany = data.companyName ?? (data as any).company ?? undefined;
    const requiredAccount = data.accountName ?? (data as any).accountHolderName ?? (data as any).accountHolder ?? undefined;
    const requiredPhone = data.phone ?? undefined;
    const requiredEmail = data.email ?? undefined;
    const requiredRegion = data.region ?? (data as any).region ?? undefined;

    if (!requiredCompany || !requiredAccount || !requiredPhone || !requiredEmail || !requiredRegion) {
      throw new Error("Missing required customer fields");
    }

    return db.transaction(async (tx) => {
      const [customer] = await tx.insert(customers).values({
        companyName: requiredCompany,
        accountName: requiredAccount,
        email: requiredEmail,
        phone: requiredPhone,
        region: requiredRegion,
        grade: data.grade ?? "C",
        status: (data as any).status ?? "New",
        ntn: (data as any).ntn ?? null,
        lastNote: (data as any).lastNote ?? null,
        country: (data as any).country ?? null,
        city: (data as any).city ?? null,
        address: (data as any).address ?? null,
        crmId: (data as any).crmId ?? null,
        crmDate: (data as any).crmDate ? new Date((data as any).crmDate) : null,
        companyType: (data as any).companyType ?? null,
        title: (data as any).title ?? null,
        personName: (data as any).personName ?? null,
        cnic: (data as any).cnic ?? null,
        website: (data as any).website ?? null,
        mobile: (data as any).mobile ?? null,
        designation: (data as any).designation ?? null,
        comment: (data as any).comment ?? null,
        rcLink: (data as any).rcLink ?? null,
        source: (data as any).source ?? null,
        serviceTypes: (data as any).serviceTypes ?? [],
        businessLine: (data as any).businessLine ?? null,
        poolType: (data as any).poolType ?? "Private",
        ownerUserId: (data as any).ownerUserId !== undefined ? (data as any).ownerUserId : userId,
        createdBy: userId,
        lastFollowUpDate: (data as any).lastFollowUpDate ?? null,
        expiresAt: (data as any).expiresAt ?? null,
        isGoldMember: (data as any).isGoldMember ?? 0,
        isBusinessVerified: (data as any).isBusinessVerified ?? 0,
        drmId: data.drmId || null,
      }).returning();

      await tx.insert(opportunities).values({
        customerId: customer.id,
        ownerUserId: userId,
        title: (data as any).title ?? customer.companyName,
        stage: (data as any).stage ?? "LD",
        amount: (data as any).amount ?? "0",
        expectedCloseDate: (data as any).expectedCloseDate ?? null,
        isDeleted: false,
      });

      return customer;
    });
  }

  // Update an existing customer
  async update(id: string, data: Partial<InsertCustomer>): Promise<Customer> {
    const [updated] = await db.update(customers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  // Get customers added by a specific user
  async findRecentByUserId(userId: string, limit: number = 10): Promise<Customer[]> {
    const results = await db
      .select({
        customer: customers,
      })
      .from(customers)
      .innerJoin(opportunities, eq(customers.id, opportunities.customerId))
      .where(and(eq(opportunities.ownerUserId, userId), eq(opportunities.isDeleted, false))!)
      .orderBy(desc(customers.createdAt))
      .limit(limit);

    return results.map(r => r.customer);
  }

  async getCustomerGmEntries(customerId: string): Promise<any[]> {
    const client = await pool.connect();
    try {
      const res = await client.query(`
        SELECT 
          id,
          member_id as "memberId",
          order_id as "orderId",
          company_name as "company",
          package_type as "package",
          status,
          hod_status as "hodStatus",
          accountant_status as "accountantStatus",
          created_at as "createdAt"
        FROM drm.gm_entries
        WHERE customer_id = $1 OR (company_name = (SELECT company_name from drm.customers WHERE id = $1) AND customer_id IS NULL)
        ORDER BY created_at DESC
      `, [customerId]);
      return res.rows;
    } finally {
      client.release();
    }
  }
}

export const customersRepository = new CustomersRepositoryExtended();
