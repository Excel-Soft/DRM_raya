import type { Express } from "express";
import { z } from "zod";
import { authMiddleware } from "./auth.middleware";
import { opportunitiesRepository } from "./repositories/opportunities.repository";
import { activitiesRepository } from "./repositories/activities.repository";
import { appointmentsRepository } from "./repositories/appointments.repository";
import { targetsRepository } from "./repositories/targets.repository";
import { vasProgressRepository } from "./repositories/vas-progress.repository";
import { followUpsRepository } from "./repositories/followups.repository";
import { CommunicationService } from "./services/communication.service";
import { customersRepository } from "./repositories/customers.repository";
import { leadActivitiesRepository } from "./repositories/lead-activities.repository";
import { leadServicesRepository } from "./repositories/lead-services.repository";
import { servicesRepository } from "./repositories/services.repository";
import { callSessionsRepository } from "./repositories/call-sessions.repository";
import { servicePoolRepository } from "./repositories/service-pool.repository";
import { pool, db } from "./db";
import { sql, eq } from "drizzle-orm";
import { customers, targetSystemDailyTargets, targetSystemUserTargets, users } from "@shared/schema";
import crypto from "crypto";
import { ensureBvReportsSchema } from "./repositories/bv-reports.repository";
import { generateDrmId } from "./utils/drm-id-utils";
import { isManagerialRole, normalizeRole } from "./utils/role-utils";
import { assertCanEditCustomer } from "./utils/ownership";
import { sendError, ApiError } from "./utils/api-error";
import { recordAssignment, getAssignmentHistory } from "./utils/assignment-history";
import { getDepartmentFilterUserIds } from "./dashboard-routes";

let customersSchemaEnsured = false;
let customersSchemaPromise: Promise<void> | null = null;
async function ensureCustomersSchema() {
  if (customersSchemaEnsured) return;
  if (customersSchemaPromise) return customersSchemaPromise;
  customersSchemaPromise = (async () => {
  const alterSql = `
    alter table drm.customers
      add column if not exists company text,
      add column if not exists account_holder text,
      add column if not exists company_id text,
      add column if not exists company_name text,
      add column if not exists account_name text,
      add column if not exists email text,
      add column if not exists phone text,
      add column if not exists phone_normalized text,
      add column if not exists region text,
      add column if not exists grade text default 'C',
      add column if not exists status text default 'New',
      add column if not exists ntn text,
      add column if not exists last_note text,
      add column if not exists service_types text[] default '{}'::text[],
      add column if not exists source text,
      add column if not exists owner_user_id uuid,
      add column if not exists created_by uuid,
      add column if not exists company_type text,
      add column if not exists person_name text,
      add column if not exists designation text,
      add column if not exists rc_link text,
      add column if not exists business_line text,
      add column if not exists pool_type text default 'Private',
      add column if not exists title text,
      add column if not exists comment text,
      add column if not exists mobile text,
      add column if not exists cnic text,
      add column if not exists crm_id text,
      add column if not exists crm_date timestamptz,
      add column if not exists last_followup_date timestamptz,
      add column if not exists expires_at timestamptz,
      add column if not exists is_gold_member integer default 0,
      add column if not exists is_business_verified integer default 0,
      add column if not exists ab_type text,
      add column if not exists drm_id text,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    -- Create unique indexes for validation
    -- Note: failure to create these (due to existing duplicates) will be caught and logged but won't stop the process
    do $$ begin
      create unique index if not exists idx_customers_company_name_unique on drm.customers (lower(trim(company_name)));
    exception when others then raise notice 'Could not create company_name unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_email_unique on drm.customers (lower(trim(email)));
    exception when others then raise notice 'Could not create email unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_cnic_unique on drm.customers (cnic) where cnic is not null and cnic != '';
    exception when others then raise notice 'Could not create cnic unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_ntn_unique on drm.customers (ntn) where ntn is not null and ntn != '';
    exception when others then raise notice 'Could not create ntn unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_drm_id_unique on drm.customers (drm_id);
    exception when others then raise notice 'Could not create drm_id unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_phone_normalized_unique on drm.customers (phone_normalized) where phone_normalized is not null and phone_normalized != '';
    exception when others then raise notice 'Could not create phone_normalized unique index: %', sqlerrm; end $$;

    update drm.customers set
      company_name = coalesce(company_name, company),
      account_name = coalesce(account_name, account_holder),
      company_id = coalesce(company_id, id::text),
      email = coalesce(email, ''),
      phone = coalesce(phone, ''),
      region = coalesce(region, ''),
      grade = coalesce(grade, 'C'),
      status = coalesce(status, 'New'),
      last_note = coalesce(last_note, ''),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now());

    alter table drm.customers alter column created_by drop not null;

    -- Align follow_ups with shared schema (provide date_time/method/created_by) for duplicate checks and views
    alter table follow_ups
      add column if not exists date_time timestamptz,
      add column if not exists method text,
      add column if not exists created_by uuid,
      add column if not exists reservation_type text,
      add column if not exists talk_time_seconds int not null default 0;

    update follow_ups
      set date_time = coalesce(date_time, due_at, created_at, now())
    where date_time is null;

    update follow_ups
      set status = coalesce(status, 'Open')
    where status is null;

    create or replace view followups as select * from follow_ups;
  `;
  try {
    await pool.query(alterSql);
    customersSchemaEnsured = true;
  } catch (err) {
    console.error("Failed to ensure customers schema (continuing):", err);
  }
  })();
  await customersSchemaPromise;
}

const periodSchema = z.enum(["TD", "WC", "MC", "QC", "YC", "ALL"]);
const tracingGrades = ["A+", "A-", "B+", "B-", "B", "C+", "C", "D"] as const;

interface SalesKpi {
  count: number;
  amount: number;
}

interface SalesOverviewData {
  totalContact: SalesKpi;
  new: SalesKpi;
  renew: SalesKpi;
  expire: SalesKpi;
  vm: SalesKpi;
  kwa: SalesKpi;
  psa: SalesKpi;
  sponsor: SalesKpi;
}

// Lead pool helpers
type LeadPoolSummary = {
  chips: {
    yetToContact: number;
    contacted: number;
    invoiceSent: number;
    whatsapp: number;
    email: number;
    sms: number;
    instagram: number;
  };
  pools: {
    privatePool: number;
    servicePool: number;
    gmBvPool: number;
    publicPool: number;
    expiringSoon: number;
  };
  generatedAt: string;
};

type LeadPoolListResponse = {
  items: Array<{
    id: string;
    company: string | null;
    companyName: string | null;
    accHolder: string | null;
    accountName: string | null;
    contactNo: string | null;
    phone: string | null;
    email: string | null;
    ntnCnic: string | null;
    ntn: string | null;
    cnic: string | null;
    expiresAt: Date | null;
    expiryDate: Date | null;
    createdAt: Date | null;
    pool: string | null;
    poolType: string | null;
    status: string | null;
    source: string | null;
    grade: string | null;
    ownerUserId: string | null;
    serviceTypes: string[];
  }>;
  total: number;
  page: number;
  pageSize: number;
};

const followUpCreateSchema = z.object({
  customerId: z.string().uuid("customer_id must be a valid uuid"),
  services: z.array(z.string().trim().min(1)).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  subServices: z.record(z.array(z.string().trim().min(1))).optional(),
  subServiceIds: z.array(z.string().uuid()).optional(),
  subServiceDetails: z
    .array(
      z.object({
        serviceCode: z.string().trim().min(1).optional(),
        subServiceCode: z.string().trim().min(1).optional(),
        serviceId: z.string().uuid().optional(),
        subServiceId: z.string().uuid().optional(),
        purpose: z.string().trim().min(1, "purpose is required"),
        grade: z.string().trim().min(1, "grade is required"),
        method: z.string().trim().min(1, "method is required"),
        comment: z.string().trim().min(1, "comment is required"),
        note: z.string().trim().min(1, "note is required"),
        dateTime: z.string().trim().optional(),
        talkTimeMinutes: z.number().int().min(1).max(600).optional().nullable(),
        attachments: z
          .array(
            z.object({
              fileName: z.string().trim().optional(),
              fileUrl: z.string().trim().optional(),
              mimeType: z.string().trim().optional(),
              sizeBytes: z.number().int().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  note: z.string().trim().optional(),
  nextDate: z.coerce.date().optional(),
  method: z.string().trim().max(50).optional(),
  reservationType: z.string().trim().optional(),
  talkTimeSeconds: z.number().int().min(0).optional(),
});

const reservationEnum = z.enum([
  "MOBILE",
  "W_CALL",
  "ON_SITE_APPOINTMENT",
  "E_MAIL",
  "VM_APPOINTMENT",
  "FAX",
  "NO_NEED",
]);
const allowedReservations = new Set(reservationEnum.options);

const normalizeCode = (value: string): string =>
  value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

let ensuredFollowupDetails = false;
async function ensureFollowupDetailsTables() {
  if (ensuredFollowupDetails) return;
  const ddl = `
    create table if not exists followup_subservice_details (
      id uuid primary key default gen_random_uuid(),
      followup_id uuid not null references follow_ups(id) on delete cascade,
      service_id uuid not null references services(id) on delete cascade,
      subservice_id uuid not null references service_subservices(id) on delete cascade,
      service_code text not null,
      subservice_code text not null,
      purpose text not null,
      grade text not null,
      method text not null,
      comment text not null,
      note text not null,
      talk_time_minutes int null,
      activity_at timestamptz null,
      created_at timestamptz not null default now()
    );

    alter table followup_subservice_details
      add column if not exists talk_time_minutes int null,
      add column if not exists activity_at timestamptz null;

    create index if not exists idx_followup_detail_followup on followup_subservice_details(followup_id);
    create index if not exists idx_followup_detail_subservice on followup_subservice_details(subservice_id);

    create table if not exists followup_subservice_attachments (
      id uuid primary key default gen_random_uuid(),
      detail_id uuid not null references followup_subservice_details(id) on delete cascade,
      file_name text,
      file_url text,
      mime_type text,
      size_bytes int,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_followup_attachment_detail on followup_subservice_attachments(detail_id);
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    console.error("Failed ensuring followup detail tables (continuing):", err);
  } finally {
    ensuredFollowupDetails = true;
  }
}

function isLeadPoolManager(roleId?: string): boolean {
  if (!roleId) return false;
  const n = normalizeRole(roleId);
  const allowedExecutives = [
    "posting_executive",
    "product_posting_executive",
    "lead_executive",
    "service_executive",
    "software_executive",
    "dd_executive"
  ];
  return isManagerialRole(roleId) || allowedExecutives.includes(n);
}

async function countGmBvEntries(userId: string, roleId?: string): Promise<number> {
  try {
    await ensureBvReportsSchema();
    const manager = isLeadPoolManager(roleId);
    const params: any[] = [];
    let bvClause = "1=1";
    let gmClause = "coalesce(g.is_deleted,false)=false";
    if (!manager) {
      params.push(userId);
      bvClause = `(br.assigned_to = $1 or br.user_id = $1 or exists (
        select 1 from drm.customers c where c.id = br.customer_id and (c.owner_user_id = $1 or c.pool_type = 'Public')
      ))`;
      gmClause = `coalesce(g.is_deleted,false)=false and (g.created_by = $1 or exists (
        select 1 from drm.customers cg where cg.id = g.customer_id and cg.owner_user_id = $1
      ))`;
    }
    const sql = `
      select (
        (select count(*) from bv_reports br where ${bvClause})
        +
        (select count(*) from gm_entries g where ${gmClause})
      )::int as total
    `;
    const { rows } = await pool.query<{ total: number }>(sql, params);
    return rows[0]?.total ?? 0;
  } catch (err) {
    console.warn("Failed to count GM BV entries", err);
    return 0;
  }
}


async function fetchFollowupWithDetails(followupId: string, customerId?: string) {
  await ensureFollowupDetailsTables();
  const params: any[] = [followupId];
  const whereCustomer = customerId ? "and f.customer_id = $2" : "";
  if (customerId) params.push(customerId);
  const followupRes = await pool.query(
    `select *
         from drm.follow_ups f
        where f.id = $1
          and coalesce(f.is_deleted,false)=false
          ${whereCustomer}
        limit 1`,
    params,
  );
  const followup = followupRes.rows[0];
  if (!followup) return null;

  const servicesRes = await pool.query(
    `select fs.service_id as id, s.code, s.name
         from followup_services fs
         left join services s on s.id = fs.service_id
        where fs.followup_id = $1`,
    [followupId],
  );

  const subServicesRes = await pool.query(
    `select ss.id, ss.code, ss.name, ss.service_id, svc.code as service_code
         from followup_subservices fss
         left join service_subservices ss on ss.id = fss.subservice_id
         left join services svc on svc.id = ss.service_id
        where fss.followup_id = $1`,
    [followupId],
  );

  const detailsRes = await pool.query(
    `select
         d.id,
         d.followup_id,
         d.service_id,
         d.subservice_id,
         d.service_code,
         d.subservice_code,
         d.purpose,
         d.grade,
        d.method,
        d.comment,
        d.note,
        d.talk_time_minutes,
        d.activity_at,
        d.created_at,
        coalesce(
          json_agg(
            json_build_object(
               'id', a.id,
               'fileName', a.file_name,
               'fileUrl', a.file_url,
               'mimeType', a.mime_type,
               'sizeBytes', a.size_bytes,
               'createdAt', a.created_at
             )
           ) filter (where a.id is not null),
           '[]'
         ) as attachments
       from followup_subservice_details d
       left join followup_subservice_attachments a on a.detail_id = d.id
       where d.followup_id = $1
       group by d.id`,
    [followupId],
  );

  return {
    followup,
    services: servicesRes.rows,
    subServices: subServicesRes.rows,
    subServiceDetails: detailsRes.rows,
  };
}

async function buildLeadPoolSummary(userId: string, roleId?: string): Promise<LeadPoolSummary> {
  await syncGmBvPool();
  const gmBvCount = await countGmBvEntries(userId, roleId);
  const manager = isLeadPoolManager(roleId);
  const params: any[] = [];
  let scopeClause = "coalesce(c.is_deleted, false) = false";
  if (!manager) {
    params.push(userId);
    // Include: customers owned by this user (owner_user_id OR created_by), plus Public pool
    scopeClause += ` and (
      c.owner_user_id = $${params.length}
      or c.created_by = $${params.length}
      or c.pool_type = 'Public'
    )`;
  }

  const summarySql = `
    with scoped as (
      select c.id, c.status, c.pool_type, c.owner_user_id, c.expires_at
      from drm.customers c
      where ${scopeClause}
    )
    select
      count(*) filter (where coalesce(lower(status), 'new') = 'new')::int as yet_to_contact,
      count(*) filter (where coalesce(lower(status), 'new') <> 'new')::int as contacted,
      0::int as invoice_sent,
      0::int as whatsapp,
      0::int as email,
      0::int as sms,
      0::int as instagram,
      count(*) filter (where pool_type = 'Private' OR pool_type = 'GMBV')::int as private_pool,
      count(*) filter (where pool_type = 'Service')::int as service_pool,
      count(*) filter (where pool_type = 'GMBV')::int as gmbv_pool,
      count(*) filter (where pool_type = 'Public')::int as public_pool,
      count(*) filter (where expires_at between now() and now() + interval '7 day')::int as expiring_soon
    from scoped;
  `;

  const { rows } = await pool.query(summarySql, params);
  const row = rows[0] || {};

  return {
    chips: {
      yetToContact: row.yet_to_contact ?? 0,
      contacted: row.contacted ?? 0,
      invoiceSent: row.invoice_sent ?? 0,
      whatsapp: row.whatsapp ?? 0,
      email: row.email ?? 0,
      sms: row.sms ?? 0,
      instagram: row.instagram ?? 0,
    },
    pools: {
      privatePool: row.private_pool ?? 0,
      servicePool: row.service_pool ?? 0,
      gmBvPool: gmBvCount ?? 0,
      publicPool: row.public_pool ?? 0,
      expiringSoon: row.expiring_soon ?? 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function buildLeadPoolList(
  userId: string,
  roleId: string | undefined,
  query: {
    pool?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    grade?: string;
    serviceFilter?: string;
    serviceType?: string;
    statusFilter?: string;
    sourceFilter?: string;
  },
): Promise<LeadPoolListResponse> {
  await syncGmBvPool();
  const poolParam = (query.pool || (query.grade ? "all" : "private")).toLowerCase();
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize || "10", 10)));
  const search = query.search || "";
  const gradeFilter = query.grade;
  const serviceFilter = query.serviceFilter || query.serviceType;
  const statusFilter = query.statusFilter;
  const sourceFilter = query.sourceFilter;

  const manager = isLeadPoolManager(roleId);
  const conditions: string[] = ["coalesce(c.is_deleted, false) = false"];
  const params: any[] = [];
  const addParam = (value: any) => {
    params.push(value);
    return `$${params.length}`;
  };

  switch (poolParam) {
    case "all":
      if (!manager) {
        conditions.push(`(c.pool_type = 'Public' OR c.owner_user_id = ${addParam(userId)} OR c.created_by = ${addParam(userId)})`);
      }
      break;
    case "private":
      conditions.push("(c.pool_type = 'Private' OR c.pool_type = 'GMBV')");
      if (!manager) {
        // Show customers owned by this user OR created by this user
        conditions.push(`(c.owner_user_id = ${addParam(userId)} OR c.created_by = ${addParam(userId)})`);
      }
      break;
    case "service":
      conditions.push("c.pool_type = 'Service'");
      break;
    case "gm_bv":
    case "gmbv":
      conditions.push("c.pool_type = 'GMBV'");
      break;
    case "public":
      conditions.push("c.pool_type = 'Public'");
      conditions.push("c.owner_user_id IS NULL");
      conditions.push("NOT EXISTS (SELECT 1 FROM drm.follow_ups f WHERE f.customer_id = c.id AND coalesce(f.is_deleted, false) = false)");
      conditions.push("NOT EXISTS (SELECT 1 FROM drm.appointments a WHERE a.customer_id = c.id AND coalesce(a.is_deleted, false) = false)");
      conditions.push("NOT EXISTS (SELECT 1 FROM drm.service_pool_entries spe WHERE spe.customer_id = c.id AND spe.status = 'active')");
      break;
    case "expiring":
      conditions.push("c.expires_at between now() and now() + interval '7 day'");
      if (!manager) {
        conditions.push(`c.owner_user_id = ${addParam(userId)}`);
      }
      break;
    default:
      throw new Error("Invalid pool type");
  }

  if (gradeFilter && gradeFilter !== "all") {
    if (gradeFilter.toLowerCase() === "b") {
      conditions.push(`lower(trim(c.grade)) = ANY(${addParam(["b", "b-"])})`);
    } else {
      conditions.push(`lower(trim(c.grade)) = ${addParam(gradeFilter.toLowerCase())}`);
    }
  }

  if (serviceFilter && serviceFilter !== "all") {
    // Map frontend values to more flexible database search patterns
    let searchPatterns: string[] = [];
    
    if (serviceFilter === "Alibaba.com") {
      searchPatterns = ["%Alibaba.com%", "%Alibaba Membership%"];
    } else if (serviceFilter === "VAS (Value Added Services)") {
      searchPatterns = ["%VAS%", "%Alibaba Services%"];
    } else if (serviceFilter === "Website Development") {
      searchPatterns = ["%Website%", "%Design%", "%E-Commerce%"];
    } else if (serviceFilter === "Domain Hosting") {
      searchPatterns = ["%Domain%", "%Hosting%"];
    } else {
      searchPatterns = [`%${serviceFilter}%`];
    }

    const orConditions = searchPatterns.map(pattern => {
      const p = addParam(pattern);
      return `
        exists (select 1 from unnest(coalesce(c.service_types, '{}'::text[])) as s where s ilike ${p})
        OR exists (select 1 from drm.lead_services ls where ls.lead_id = c.id and ls.service_type ilike ${p})
      `;
    });

    conditions.push(`(${orConditions.join(" OR ")})`);
  }

  if (statusFilter) {
    conditions.push(`lower(c.status) = lower(${addParam(statusFilter)})`);
  }

  if (sourceFilter) {
    conditions.push(`lower(c.source) = lower(${addParam(sourceFilter)})`);
  }

  if (search.trim().length > 0) {
    const likeParam = addParam(`%${search.trim()}%`);
    conditions.push(`(
      c.id::text ILIKE ${likeParam}
      or c.company_name ILIKE ${likeParam}
      or c.account_name ILIKE ${likeParam}
      or c.email ILIKE ${likeParam}
      or c.phone ILIKE ${likeParam}
      or c.drm_id ILIKE ${likeParam}
    )`);
  }

  const limitParam = addParam(pageSize);
  const offsetParam = addParam((page - 1) * pageSize);

  const listSql = `
    select
      c.id,
      c.drm_id,
      c.company_name,
      c.account_name,
      c.phone,
      c.mobile,
      c.email,
      c.ntn,
      c.cnic,
      c.expires_at,
      c.created_at,
      c.pool_type,
      c.status,
      c.source,
      c.grade,
      c.owner_user_id,
      c.service_types,
      count(*) over() as total_count
    from drm.customers c
    ${poolParam === "public" ? `
      left join lateral (
        select fu.id as followup_exists
        from drm.follow_ups fu
        where fu.customer_id = c.id
          and coalesce(fu.is_deleted, false) = false
        limit 1
      ) latest_fu on true
    ` : ""}
    where ${conditions.join(" and ")}
    ${poolParam === "public" ? "and latest_fu.followup_exists is null" : ""}
    order by c.created_at desc
    limit ${limitParam} offset ${offsetParam};
  `;

  const { rows } = await pool.query(listSql, params);
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;

  const items = rows.map((row: any) => ({
    id: row.id,
    drmId: row.drm_id,
    company: row.company_name,
    companyName: row.company_name,
    accHolder: row.account_name,
    accountName: row.account_name,
    contactNo: row.phone ?? row.mobile ?? null,
    phone: row.phone ?? row.mobile ?? null,
    email: row.email ?? null,
    ntnCnic: row.ntn ?? row.cnic ?? null,
    ntn: row.ntn ?? null,
    cnic: row.cnic ?? null,
    expiresAt: row.expires_at,
    expiryDate: row.expires_at,
    createdAt: row.created_at,
    pool: row.pool_type,
    poolType: row.pool_type,
    status: row.status,
    source: row.source,
    grade: row.grade,
    ownerUserId: row.owner_user_id,
    serviceTypes: row.service_types ?? [],
  }));

  return { items, total, page, pageSize };
}

let isSyncingGmBvPool = false;
async function syncGmBvPool() {
  if (isSyncingGmBvPool) return;
  isSyncingGmBvPool = true;
  try {
    await pool.query(
      `update drm.customers c
          set pool_type = 'GMBV', updated_at = now()
        where pool_type <> 'GMBV'
          and exists (select 1 from gm_entries g where coalesce(g.is_deleted,false)=false and g.customer_id = c.id)`,
    );
    try {
      await ensureBvReportsSchema();
      await pool.query(
        `update drm.customers c
            set pool_type = 'GMBV', updated_at = now()
          where pool_type <> 'GMBV'
            and exists (select 1 from bv_reports br where br.customer_id = c.id)`,
      );
    } catch (err: any) {
      if (err.code !== '40P01') console.warn("Failed to sync GMBV pool from bv_reports", err);
    }
  } catch (err: any) {
    if (err.code !== '40P01') console.warn("Failed to sync GMBV pool from gm_entries", err);
  } finally {
    isSyncingGmBvPool = false;
  }
}

const leadActionSchema = z.object({
  action: z.enum(["view", "email", "whatsapp", "call", "print", "history", "edit"]),
  note: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

// --- Stage 7 best-effort communication logging helpers --------------------
const SALES_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const salesAsUuid = (v: any): string | undefined =>
  typeof v === "string" && SALES_UUID_RE.test(v) ? v : undefined;
const SALES_CHANNEL_MAP: Record<string, string> = {
  whatsapp: "WHATSAPP", call: "CALL", email: "EMAIL", sms: "SMS",
  meeting: "MEETING", visit: "VISIT", w_call: "CALL", mobile: "CALL",
  e_mail: "EMAIL",
};
const mapSalesChannel = (a: any): any =>
  SALES_CHANNEL_MAP[String(a ?? "").toLowerCase()] ?? "NOTE";
// Parse user-supplied dates safely — never throw into the host handler.
const safeIso = (v: any): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const updateLeadSchema = z.object({
  companyName: z.string().optional(),
  accountName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  grade: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

// Helper to get date range based on period
function getDateRangeForPeriod(period: string): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const dateTo = new Date(now);
  let dateFrom = new Date(now);

  switch (period) {
    case "TD": // Today
      dateFrom.setHours(0, 0, 0, 0);
      dateTo.setHours(23, 59, 59, 999);
      break;
    case "WC": // Week Cumulative
      dateFrom.setDate(now.getDate() - 7);
      break;
    case "MC": // Month Cumulative
      dateFrom.setDate(now.getDate() - 30);
      break;
    case "QC": // Quarter Cumulative
      dateFrom.setDate(now.getDate() - 90);
      break;
    case "YC": // Year Cumulative
      dateFrom.setDate(now.getDate() - 365);
      break;
    case "ALL":
      dateFrom = new Date(0); // Beginning of time
      break;
    default:
      dateFrom.setHours(0, 0, 0, 0);
  }

  return { dateFrom, dateTo };
}

function getNextDateRangeForPeriod(period: string): { dateFrom: Date; dateTo: Date; label: string } {
  const offsets: Record<string, number> = {
    TD: 1,
    WC: 7,
    MC: 30,
    QC: 90,
    YC: 365,
  };
  const labels: Record<string, string> = {
    TD: "next_day",
    WC: "next_week",
    MC: "next_month",
    QC: "next_quarter",
    YC: "next_year",
  };
  const { dateFrom, dateTo } = getDateRangeForPeriod(period);
  const offset = offsets[period] ?? 1;
  const nextFrom = new Date(dateFrom);
  nextFrom.setDate(nextFrom.getDate() + offset);
  const nextTo = new Date(dateTo);
  nextTo.setDate(nextTo.getDate() + offset);
  return { dateFrom: nextFrom, dateTo: nextTo, label: labels[period] ?? "next_period" };
}

function getDateRangeFromPeriodParam(period: string, from?: string, to?: string) {
  if (period === "custom" && from && to) {
    return { dateFrom: new Date(from), dateTo: new Date(to) };
  }
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  switch (period) {
    case "today":
      return getDateRangeForPeriod("TD");
    case "7d": {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - 6);
      return { dateFrom: fromDate, dateTo: toDate };
    }
    case "30d": {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(toDate.getDate() - 29);
      return { dateFrom: fromDate, dateTo: toDate };
    }
    case "lastMonth": {
      const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { dateFrom: prevStart, dateTo: prevEnd };
    }
    case "thisMonth":
    default:
      return { dateFrom: startOfMonth, dateTo: endOfMonth };
  }
}

// Ensure simple targets table for demo/aggregation
let ensureTargetsPromise: Promise<void> | null = null;
async function ensureTargetsTable() {
  if (ensureTargetsPromise) return ensureTargetsPromise;
  ensureTargetsPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query(`
        create table if not exists targets (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null,
          month int not null,
          year int not null,
          vas_target numeric(12,2) not null default 45000,
          ab_target numeric(12,2) not null default 50000,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique(user_id, month, year)
        );
        create index if not exists idx_targets_user_month_year on targets(user_id, year, month);
      `);
    } finally {
      client.release();
    }
  })();
  return ensureTargetsPromise;
}

export function registerSalesRoutes(app: Express) {
  // Auth is enforced globally in `server/routes.ts` (or via MOCK_AUTH when enabled).
  app.use("/api/sales", authMiddleware, (req, _res, next) => {
    if (process.env.DEBUG_SALES_DASH === "true") {
      console.log("[sales] user", req.user);
    }
    next();
  });

  const logDebug = (label: string, payload: any) => {
    if (process.env.DEBUG_SALES_DASH === "true") {
      console.log(label, payload);
    }
  };
  // GET /api/sales/invoice-pool
  app.get("/api/sales/invoice-pool", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { rows } = await pool.query(`
        SELECT 
          id, 
          company_name as "client", 
          amount as "grandTotal", 
          status as "finalStatus",
          CASE WHEN status IN ('PENDING_ACCOUNT', 'APPROVED') THEN 'Approved' ELSE (CASE WHEN status = 'REJECTED' THEN 'Rejected' ELSE 'Pending' END) END as "hodStatus",
          CASE WHEN status = 'APPROVED' THEN 'Approved' ELSE (CASE WHEN status = 'REJECTED' THEN 'Rejected' ELSE 'Pending' END) END as "accountStatus",
          created_at as "createdAt"
        FROM drm.product_posting_invoices 
        WHERE sales_exec_id = $1
        ORDER BY created_at DESC
      `, [req.user.userId]);

      res.json(rows);
    } catch (error) {
      console.error("Error fetching invoice pool:", error);
      res.status(500).json({ error: "Failed to fetch invoice pool" });
    }
  });

  // GET /api/sales/invoice-pool/:id
  app.get("/api/sales/invoice-pool/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { rows } = await pool.query(`
        SELECT 
          i.id,
          i.amount,
          i.project_name,
          i.company_name,
          i.status,
          i.created_at,
          i.updated_at,
          c.account_name,
          c.email,
          c.phone,
          c.mobile,
          c.city
        FROM drm.product_posting_invoices i
        LEFT JOIN drm.customers c ON i.customer_id::text = c.id::text
        WHERE i.id = $1
      `, [req.params.id]);

      if (rows.length === 0) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      res.status(500).json({ error: "Failed to fetch invoice details" });
    }
  });

  // GET /api/sales/overview - Get sales KPI overview
  app.get("/api/sales/overview", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const period = periodSchema.parse(req.query.period || "TD");
      const { dateFrom, dateTo } = getDateRangeForPeriod(period);

      // Get customer counts for the user within the period
      const { rows } = await pool.query(
        `SELECT coalesce(status, 'New') as status, count(*) as count 
         FROM drm.customers 
         WHERE owner_user_id = $1 
           AND created_at >= $2 
           AND created_at <= $3 
         GROUP BY coalesce(status, 'New')`,
        [req.user.userId, dateFrom, dateTo]
      );

      let totalContact = 0;
      let newCount = 0;
      let renewCount = 0;
      let expireCount = 0;

      for (const r of rows) {
        const cnt = Number(r.count) || 0;
        totalContact += cnt;
        if (r.status === 'New') newCount += cnt;
        else if (r.status === 'Renew') renewCount += cnt;
        else if (r.status === 'Expire') expireCount += cnt;
      }

      const totalAmount = await opportunitiesRepository.getTotalAmount(req.user.userId, dateFrom, dateTo);

      logDebug("[sales/overview] totals", { total: totalContact, newCount, renewCount, expireCount, totalAmount });

      // For now, use simplified calculations for other KPIs
      // In production, these would be based on actual business logic
      const salesData: SalesOverviewData = {
        totalContact: {
          count: totalContact,
          amount: Math.round(parseFloat(totalAmount)),
        },
        new: {
          count: newCount,
          amount: Math.round(parseFloat(totalAmount) * 0.4), // ~40% of total
        },
        renew: {
          count: renewCount,
          amount: Math.round(parseFloat(totalAmount) * 0.35), // ~35% of total
        },
        expire: {
          count: expireCount,
          amount: 0,
        },
        vm: {
          count: Math.round(totalContact * 0.2),
          amount: Math.round(parseFloat(totalAmount) * 0.1),
        },
        kwa: {
          count: Math.round(totalContact * 0.25),
          amount: Math.round(parseFloat(totalAmount) * 0.08),
        },
        psa: {
          count: Math.round(totalContact * 0.1),
          amount: Math.round(parseFloat(totalAmount) * 0.05),
        },
        sponsor: {
          count: Math.round(totalContact * 0.05),
          amount: Math.round(parseFloat(totalAmount) * 0.02),
        },
      };

      res.json(salesData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid period parameter", details: error.errors });
      } else {
        console.error("Error fetching sales overview:", error);
        res.status(500).json({ error: "Failed to fetch sales overview data", detail: (error as any)?.message });
      }
    }
  });

  // GET /api/sales/targets/summary
  app.get("/api/sales/targets/summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureTargetsTable();

      const type = (req.query.type as string) === "ab" ? "ab" : "vas";
      const period = (req.query.period as string) || "thisMonth";
      const { dateFrom, dateTo } = getDateRangeFromPeriodParam(
        period,
        req.query.from as string,
        req.query.to as string,
      );
      const daysSpan = Math.max(1, Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86400000) + 1);
      const prevTo = new Date(dateFrom);
      prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo);
      prevFrom.setDate(prevFrom.getDate() - (daysSpan - 1));

      const isManager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      let userFilter = "";
      const params: any[] = [dateFrom, dateTo];
      if (!isManager) {
        userFilter = ` and g.created_by = $${params.length + 1}`;
        params.push(req.user.userId);
      }

      const valueSum = await pool.query(
        `select coalesce(sum(amount_usd),0)::numeric as total from drm.gm_entries g
          where coalesce(g.is_deleted,false)=false
            and (g.status = 'Approved' or g.approval_status = 'approved' or g.final_status = 'approved' or g.approval_status = 'approved_by_account')
            and g.created_at >= $1 and g.created_at <= $2
            ${userFilter}`,
        params,
      );

      const prevParams: any[] = [prevFrom, prevTo];
      if (!isManager) {
        prevParams.push(req.user.userId);
      }
      const prevValueSum = await pool.query(
        `select coalesce(sum(amount_usd),0)::numeric as total from drm.gm_entries g
          where coalesce(g.is_deleted,false)=false
            and (g.status = 'Approved' or g.approval_status = 'approved' or g.final_status = 'approved' or g.approval_status = 'approved_by_account')
            and g.created_at >= $1 and g.created_at <= $2
            ${userFilter}`,
        prevParams,
      );

      const achievedAmount = parseFloat(valueSum.rows[0]?.total ?? 0);
      const prevAchieved = parseFloat(prevValueSum.rows[0]?.total ?? 0);

      // targetAmount from dynamic target system
      const userRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 LIMIT 1`, [req.user.userId]);
      const userFullName = userRes.rows[0]?.full_name || userRes.rows[0]?.username || req.user.userId;

      const roleName = String((req.user as any).activeRoleId || req.user.roleId || (req.user as any).role || "").toLowerCase().replace(/\s+/g, '_');
      
      let allowedRoles = [roleName];
      if (['admin', 'account_manager', 'hod'].includes(roleName)) {
        allowedRoles.push('sales_executive', 'sales_manager');
      }

      const targetRes = await pool.query(
        `SELECT SUM(
           CASE 
             WHEN CAST(target AS NUMERIC) > 0 AND CAST(price AS NUMERIC) > 0 THEN CAST(target AS NUMERIC) * CAST(price AS NUMERIC)
             WHEN CAST(total AS NUMERIC) > 0 THEN CAST(total AS NUMERIC)
             ELSE CAST(target AS NUMERIC)
           END
         ) as target_amount 
         FROM drm.target_system_user_targets 
         WHERE (user_id = $1 OR user_id = $4 OR user_id = ANY($5::text[]))
           AND (start_date IS NULL OR start_date <= $2)
           AND (end_date IS NULL OR end_date >= $3)`,
        [userFullName, dateTo, dateFrom, req.user.userId, allowedRoles]
      );
      
      let targetAmount = parseFloat(targetRes.rows[0]?.target_amount ?? 0);
      const percent = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;
      const prevPercent = targetAmount > 0 ? (prevAchieved / targetAmount) * 100 : 0;
      const deltaPercent = percent - prevPercent;

      return res.json({
        type,
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString(), label: period },
        achievedAmount,
        targetAmount,
        percent: Math.max(0, percent),
        previousPercent: Math.max(0, prevPercent),
        deltaPercent,
      });
    } catch (error) {
      console.error("Error fetching target summary", error);
      return res.status(500).json({ error: "Failed to fetch target summary" });
    }
  });

  // GET /api/sales/targets/details
  app.get("/api/sales/targets/details", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureTargetsTable();
      const type = (req.query.type as string) === "ab" ? "ab" : "vas";
      const period = (req.query.period as string) || "thisMonth";
      const groupBy = (req.query.groupBy as string) || "day";
      const { dateFrom, dateTo } = getDateRangeFromPeriodParam(
        period,
        req.query.from as string,
        req.query.to as string,
      );

      let sqlGroup = "date(created_at)";
      if (groupBy === "week") sqlGroup = "date_trunc('week', created_at)";

      const isManager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      let userFilter = "";
      const queryParams: any[] = [dateFrom, dateTo];
      if (!isManager) {
        userFilter = ` and g.created_by = $3`;
        queryParams.push(req.user.userId);
      }

      const rowsRes = await pool.query(
        `select ${sqlGroup} as key, coalesce(sum(amount_usd),0)::numeric as achieved
           from drm.gm_entries g
          where coalesce(g.is_deleted,false)=false
            and (g.status = 'Approved' or g.approval_status = 'approved' or g.final_status = 'approved' or g.approval_status = 'approved_by_account')
            and g.created_at >= $1 and g.created_at <= $2
            ${userFilter}
          group by ${sqlGroup}
          order by ${sqlGroup} asc`,
        queryParams,
      );
      let rows = rowsRes.rows.map((r: any) => ({
        key: r.key,
        name: new Date(r.key).toISOString(),
        achievedAmount: parseFloat(r.achieved ?? 0),
      }));

      const achievedAmount = rows.reduce((sum, r) => sum + r.achievedAmount, 0);
      const now = new Date();
      const targetField = type === "vas" ? "vas_target" : "ab_target";
      const targetRes = await pool.query(
        `select ${targetField} as target from drm.targets where user_id = $1 and month = $2 and year = $3 limit 1`,
        [req.user.userId, now.getMonth() + 1, now.getFullYear()],
      );
      const targetAmount = parseFloat(targetRes.rows[0]?.target ?? (type === "vas" ? 45000 : 50000));
      const percent = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;

      return res.json({
        type,
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString(), label: period },
        rows,
        totals: { achievedAmount, targetAmount, percent },
      });
    } catch (error) {
      console.error("Error fetching target details", error);
      return res.status(500).json({ error: "Failed to fetch target details" });
    }
  });

  // GET /api/sales/activity-plan - Get activity plan grid
  app.get("/api/sales/activity-plan", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      let dateFrom: Date, dateTo: Date;
      let period = "TD";
      if (req.query.from && req.query.to) {
        dateFrom = new Date(req.query.from as string);
        dateTo = new Date(req.query.to as string);
        dateTo.setHours(23, 59, 59, 999);
      } else {
        period = periodSchema.parse(req.query.period || "TD");
        const range = getDateRangeForPeriod(period as any);
        dateFrom = range.dateFrom;
        dateTo = range.dateTo;
      }

      // Get activity summary from DB
      const activitySummary = await activitiesRepository.getSummaryByMethod(
        req.user.userId,
        dateFrom,
        dateTo
      );
      
      // Get follow_ups summary
      const followUpSummaryResult = await pool.query(
        `select 
           coalesce(fsd.method, fu.method) as method, 
           count(*)::int as count,
           sum(coalesce(fsd.talk_time_minutes, 0))::int as talk_time_minutes
         from drm.follow_ups fu
         left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id
         where coalesce(fu.is_deleted,false)=false 
           and coalesce(fu.assigned_to, fu.created_by) = $1 
           and fu.created_at >= $2 
           and fu.created_at <= $3 
         group by coalesce(fsd.method, fu.method)`,
         [req.user.userId, dateFrom, dateTo]
      );
      const followUpSummary = followUpSummaryResult.rows;
      
      const followUpMethodMap: Record<string, string> = {
        "Phone Call": "mobile",
        "Call": "mobile",
        "call": "mobile",
        "Whatsapp": "whatsapp",
        "E-mail": "email",
        "Appointment": "appointment",
        "Seminar": "seminar",
        "Meeting": "in_meeting",
        "meeting": "in_meeting",
        "In-Meeting": "in_meeting",
        "Out-Meeting": "out_meeting",
        "WH-Call": "wh_call",
        "MOBILE": "mobile",
        "WHATSAPP": "whatsapp",
        "WHATSAPP_CALL": "whatsapp",
        "EMAIL": "email",
        "E_MAIL": "email",
        "W_CALL": "wh_call",
        "WH_CALL": "wh_call",
        "VISIT": "out_meeting",
        "IN_MEETING": "in_meeting",
        "OUT_MEETING": "out_meeting",
        "APPOINTMENT": "appointment",
        "SEMINAR": "seminar",
        "OL_MEETING": "out_meeting"
      };

      const callDurations = await callSessionsRepository.sumByReservation(req.user.userId, dateFrom, dateTo);
      const reservationToMethod: Record<string, string> = {
        MOBILE: "mobile",
        W_CALL: "wh_call",
        ON_SITE_APPOINTMENT: "out_meeting",
        EMAIL: "email",
        VM_APPOINTMENT: "in_meeting",
        FAX: "email",
        NO_NEED: "email",
      };

      // Define targets (these could also come from a targets table)
      // Initialize targets to 0 per D-02 requirement (no hardcoded defaults)
      const methodTargets: Record<string, number> = {
        mobile: 0,
        whatsapp: 0,
        wh_call: 0,
        in_meeting: 0,
        out_meeting: 0,
        email: 0,
        appointment: 0,
        seminar: 0,
      };

      // Fetch dynamic targets from target_system_user_targets for the specific logged-in user
      const userRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 LIMIT 1`, [req.user.userId]);
      const userFullName = userRes.rows[0]?.full_name || userRes.rows[0]?.username || req.user.userId;
      
      const roleName = String((req.user as any).activeRoleId || req.user.roleId || (req.user as any).role || "").toLowerCase().replace(/\s+/g, '_');
      let allowedRoles = [roleName];
      if (['admin', 'account_manager', 'hod'].includes(roleName)) {
        allowedRoles.push('sales_executive', 'sales_manager');
      }

      // 1. Fetch dynamic targets from target_system_user_targets (User-specific or Role-specific sales targets)
      const userAssignedTargetsRes = await pool.query(
        `SELECT target_name, target 
         FROM drm.target_system_user_targets 
         WHERE (user_id = $1 OR user_id = $4 OR user_id = ANY($5::text[]))
           AND (start_date IS NULL OR start_date <= $2)
           AND (end_date IS NULL OR end_date >= $3)`,
        [userFullName, dateTo, dateFrom, req.user.userId, allowedRoles]
      );

      userAssignedTargetsRes.rows.forEach(t => {
        const normMethod = (t.target_name || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
        const assignedVal = parseFloat(t.target || "0");
        
        if (normMethod.includes('mobile')) methodTargets.mobile += assignedVal;
        if (normMethod.includes('whatsapp')) methodTargets.whatsapp += assignedVal;
        if (normMethod.includes('email')) methodTargets.email += assignedVal;
        if (normMethod.includes('call') && !normMethod.includes('whatsapp')) methodTargets.wh_call += assignedVal;
        if (normMethod.includes('seminar')) methodTargets.seminar += assignedVal;
        if (normMethod.includes('appointment')) methodTargets.appointment += assignedVal;
        if (normMethod.includes('meeting')) {
           if (normMethod.includes('out') || normMethod.includes('site')) methodTargets.out_meeting += assignedVal;
           else methodTargets.in_meeting += assignedVal;
        }
      });

      // 2. Fetch from target_system_daily_targets (Role-based activity targets)
      // Map internal role IDs to the "pretty" names used in daily_targets table
      const rolePrettyNameMap: Record<string, string> = {
        "sales_executive": "Sales Executive",
        "sales_manager": "Sales Manager",
        "sales_assistant_manager": "Sales Assistant Manager",
        "service_executive": "Service Executive",
        "service_manager": "Service Manager",
        "admin": "admin"
      };
      
      const currentRolePretty = rolePrettyNameMap[roleName] || roleName;
      const dailyTargetsRes = await pool.query(
        `SELECT method, target 
         FROM drm.target_system_daily_targets 
         WHERE LOWER(role) = LOWER($1) OR LOWER(role) = LOWER($2)`,
        [currentRolePretty, roleName]
      );

      dailyTargetsRes.rows.forEach(t => {
        const methodKey = (t.method || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
        const val = parseFloat(t.target || "0");
        
        if (methodKey.includes('mobile')) methodTargets.mobile += val;
        if (methodKey.includes('whatsapp')) methodTargets.whatsapp += val;
        if (methodKey.includes('email')) methodTargets.email += val;
        if (methodKey.includes('call') && !methodKey.includes('whatsapp')) methodTargets.wh_call += val;
        if (methodKey.includes('seminar')) methodTargets.seminar += val;
        if (methodKey.includes('appointment')) methodTargets.appointment += val;
        if (methodKey.includes('onsite') || methodKey.includes('visit') || methodKey.includes('out_meeting')) methodTargets.out_meeting += val;
        if (methodKey.includes('meeting') && !methodKey.includes('out') && !methodKey.includes('site')) methodTargets.in_meeting += val;
      });


      // Build rows with actual data
      const methods = ["mobile", "whatsapp", "wh_call", "in_meeting", "out_meeting", "email", "appointment", "seminar"];
      const rows = methods.map((method) => {
        const summary = activitySummary.find((s) => s.method === method);
        const target = methodTargets[method] || 0;
        let actual = summary?.totalMinutes || 0;

        // Add follow-ups
        const followUpsForMethod = followUpSummary.filter((f: any) => {
           const mappedMethod = followUpMethodMap[f.method] || (f.method ? String(f.method).toLowerCase() : "");
           return mappedMethod === method;
        });
        let actualCount = summary?.count || 0; // if summary has it
        
        let defaultTime = 0;
        
        followUpsForMethod.forEach((f: any) => {
           let count = Number(f.count) || 0;
           actualCount += count;
           
           let defaultTimePerItem = 1;
           if (method === "in_meeting" || method === "out_meeting") {
             defaultTimePerItem = 5;
           }
           
           defaultTime += count * defaultTimePerItem;
           
           if (f.talk_time_minutes > 0) {
             actual += Number(f.talk_time_minutes);
           } else {
             actual += count * defaultTimePerItem;
           }
        });

        const callSecondsForMethod = Object.entries(callDurations || {}).reduce((acc, [reservation, seconds]) => {
          if (reservationToMethod[reservation] === method) return acc + Number(seconds ?? 0);
          return acc;
        }, 0);
        
        if (callSecondsForMethod > 0) {
           actualCount += 1; // Approximate each call session as 1 if we don't have exact counts
        }
        
        actual += Math.round(callSecondsForMethod / 60);
        const targetPercent = target > 0 ? Math.round((actualCount / target) * 100) : 0;

        return {
          method,
          target,
          actualCount,
          targetPercent,
          actual,
          defaultTime
        };
      });

      const totalMinutes = rows.reduce((sum, row) => sum + row.actual, 0);
      const perMethodMinutes = rows.reduce((acc, row) => {
        acc[row.method] = row.actual;
        return acc;
      }, {} as Record<string, number>);
      const nextRange = getNextDateRangeForPeriod(period);

      logDebug("[sales/activity-plan]", { period, totalMinutes, rows });

      res.json({
        period,
        rows,
        totalMinutes,
        current: {
          period,
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
          totalMinutes,
          perMethodMinutes,
        },
        future: {
          period: nextRange.label,
          from: nextRange.dateFrom.toISOString(),
          to: nextRange.dateTo.toISOString(),
          projectedTotalMinutes: totalMinutes,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid period parameter", details: error.errors });
      } else {
        console.error("Error fetching activity plan:", error);
        res.status(500).json({ error: "Failed to fetch activity plan data", detail: (error as any)?.message });
      }
    }
  });

  // GET /api/sales/pipeline-summary - Get pipeline stages overview
  app.get("/api/sales/pipeline-summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const period = periodSchema.parse(req.query.period || "TD");
      const { dateFrom, dateTo } = getDateRangeForPeriod(period);

      const allowedUserIds = await getDepartmentFilterUserIds(req);
      const targetUserId = !allowedUserIds ? req.user.userId : undefined;

      // Get actual stage counts from DB
      const stageCounts = await opportunitiesRepository.countByStage(
        targetUserId,
        dateFrom,
        dateTo,
        allowedUserIds || undefined
      );

      // Ensure all stages are present (even with 0 count)
      const allStages = ["LD", "QF", "AY", "IN", "PM", "GM", "BV", "NC", "RC", "EC", "FW", "NF"];
      const stages = allStages.reduce((acc, stage) => {
        acc[stage] = stageCounts[stage] || 0;
        return acc;
      }, {} as Record<string, number>);
      logDebug("[sales/pipeline-summary]", { period, stages });

      res.json({ stages });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid period parameter", details: error.errors });
      } else {
        console.error("Error fetching pipeline summary:", error);
        res.status(500).json({ error: "Failed to fetch pipeline summary" });
      }
    }
  });

  // GET /api/sales/pipeline-stage-details - Get opportunities for a specific stage
  app.get("/api/sales/pipeline-stage-details", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const stage = req.query.stage as string;
      const period = periodSchema.parse(req.query.period || "TD");
      const { dateFrom, dateTo } = getDateRangeForPeriod(period);
      const page = parseInt(req.query.page as string || "1");
      const pageSize = parseInt(req.query.pageSize as string || "10");

      const allowedUserIds = await getDepartmentFilterUserIds(req);

      const result = await opportunitiesRepository.findByFilters({
        allowedUserIds: allowedUserIds || undefined,
        userId: !allowedUserIds ? req.user.userId : undefined,
        stage: stage || undefined,
        dateFrom,
        dateTo,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching pipeline stage details:", error);
      res.status(500).json({ error: "Failed to fetch details" });
    }
  });

  // GET /api/sales/targets/ab - Get AB targets table
  app.get("/api/sales/targets/ab", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Use the unified targetSystemUserTargets schema
      const userIdStr = req.user.userId || (req.user as any).id;
      
      const userQueryRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 LIMIT 1`, [userIdStr]);
      const userFullName = userQueryRes.rows[0]?.full_name || userQueryRes.rows[0]?.username || userIdStr;
      
      const allUserTargets = await db
        .select()
        .from(targetSystemUserTargets);
        
      // Filter for the user and for category containing "ab new"
      const userTargets = allUserTargets.filter(t => 
        (t.userId === String(userIdStr) || t.userId === String(userFullName)) && 
        t.category && 
        (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
      );

      const roleName = String((req.user as any).activeRoleId || req.user.roleId || (req.user as any).role || "").toLowerCase().replace(/\s+/g, '_');
      let allowedRoles = [roleName];
      if (['admin', 'account_manager', 'hod'].includes(roleName)) {
        allowedRoles.push('sales_executive', 'sales_manager');
      }
      
      const roleTargets = allUserTargets.filter(t => 
         allowedRoles.includes(t.userId) && 
         t.category && 
         (t.category.toLowerCase().includes("ab new") || t.category.toLowerCase().includes("ab"))
      );
      
      const finalTargets = [...userTargets, ...roleTargets];

      // Format for frontend
      const rows = finalTargets.map((target) => ({
        target: `${target.targetName || target.category} [${target.target || 0}]`,
        bonus: target.bonus,
        priceTarget: target.price,
        reward: target.reward,
        kwa: target.kwa || "0",
        vas: target.vas || "0",
      }));

      logDebug("[sales/targets/ab]", { rows });
      res.json({ rows });
    } catch (error) {
      console.error("Error fetching AB targets:", error);
      res.status(500).json({ error: "Failed to fetch AB targets", detail: (error as any)?.message, stack: (error as any)?.stack });
    }
  });

  // GET /api/sales/targets/vas - Get VAS targets table
  app.get("/api/sales/targets/vas", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Use the unified targetSystemUserTargets schema
      const userIdStr = req.user.userId || (req.user as any).id;
      
      const userQueryRes = await pool.query(`SELECT full_name, username FROM drm.users WHERE id = $1 LIMIT 1`, [userIdStr]);
      const userFullName = userQueryRes.rows[0]?.full_name || userQueryRes.rows[0]?.username || userIdStr;

      const allUserTargets = await db
        .select()
        .from(targetSystemUserTargets);
        
      // Filter for the user and for category containing "vas"
      const userTargets = allUserTargets.filter(t => 
        (t.userId === String(userIdStr) || t.userId === String(userFullName)) && 
        t.category && 
        t.category.toLowerCase().includes("vas")
      );

      const roleName = String((req.user as any).activeRoleId || req.user.roleId || (req.user as any).role || "").toLowerCase().replace(/\s+/g, '_');
      let allowedRoles = [roleName];
      if (['admin', 'account_manager', 'hod'].includes(roleName)) {
        allowedRoles.push('sales_executive', 'sales_manager');
      }
      
      const roleTargets = allUserTargets.filter(t => 
         allowedRoles.includes(t.userId) && 
         t.category && 
         t.category.toLowerCase().includes("vas")
      );
      
      const finalTargets = [...userTargets, ...roleTargets];

      // Format for frontend
      const rows = finalTargets.map((target) => ({
        target: `${target.targetName || target.category} [${target.target || 0}]`,
        bonus: target.bonus,
        priceTarget: target.price,
        reward: target.reward,
        kwa: target.kwa || "0",
        vas: target.vas || "0",
      }));

      logDebug("[sales/targets/vas]", { rows });
      res.json({ rows });
    } catch (error) {
      console.error("Error fetching VAS targets:", error);
      res.status(500).json({ error: "Failed to fetch VAS targets", detail: (error as any)?.message, stack: (error as any)?.stack });
    }
  });

  // GET /api/sales/vas-progress - Get VAS monthly progress
  app.get("/api/sales/vas-progress", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get current month's VAS progress
      const currentProgress = await vasProgressRepository.getCurrentMonthProgress(req.user.userId);

      if (!currentProgress) {
        // Return default if no data
        return res.json({
          currentAmount: 0,
          targetAmount: 45000,
          percentOfTarget: 0,
          percentVsPrevious: 0,
        });
      }

      const currentAmount = parseFloat(currentProgress.amount);
      const targetAmount = parseFloat(currentProgress.targetAmount);
      const percentOfTarget = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

      // Get previous month for comparison
      const now = new Date();
      const prevMonth = now.getMonth(); // Current month is getMonth() + 1, so previous is getMonth()
      const prevYear = prevMonth === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevMonthNum = prevMonth === 0 ? 12 : prevMonth;

      const previousProgress = await vasProgressRepository.findByUserAndPeriod(
        req.user.userId,
        prevMonthNum,
        prevYear
      );

      let percentVsPrevious = 0;
      if (previousProgress) {
        const prevAmount = parseFloat(previousProgress.amount);
        if (prevAmount > 0) {
          percentVsPrevious = ((currentAmount - prevAmount) / prevAmount) * 100;
        }
      }

      res.json({
        currentAmount,
        targetAmount,
        percentOfTarget: Math.round(percentOfTarget * 10) / 10,
        percentVsPrevious: Math.round(percentVsPrevious * 10) / 10,
      });
    } catch (error) {
      console.error("Error fetching VAS progress:", error);
      res.status(500).json({ error: "Failed to fetch VAS progress", detail: (error as any)?.message });
    }
  });

  // GET /api/sales/appointments/today - Get today's appointments
  app.get("/api/sales/appointments/today", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      // Get today's appointments from DB
      const appointments = await appointmentsRepository.getTodayAppointments(req.user.userId);

      // Format for frontend
      const formattedAppointments = appointments.map((apt) => {
        const time = apt.startsAt ? new Date(apt.startsAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }) : "";

        return {
          id: apt.id,
          company: apt.customer?.companyName || (apt.customer as any)?.company_name || "Unknown",
          purpose: apt.notes || "Meeting",
          time,
        };
      });

      // Also include follow-ups scheduled for today (due_at/date_time within today)
      await ensureFollowupDetailsTables();

      const isManager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      const userCondition = isManager ? "" : "and coalesce(f.assigned_to, f.created_by) = $3";
      const queryParams = isManager ? [startOfDay, endOfDay] : [startOfDay, endOfDay, req.user.userId];

      const followupRows = await pool.query(
        `
          select f.id,
                 c.company_name,
                 coalesce(f.date_time, f.due_at, f.created_at) as dt,
                 coalesce(f.notes, detail.purpose, 'Follow-up') as purpose
            from drm.follow_ups f
            left join drm.customers c on c.id = f.customer_id
            left join lateral (
              select d.purpose
                from followup_subservice_details d
               where d.followup_id = f.id
               limit 1
            ) detail on true
           where coalesce(f.is_deleted,false)=false
             and coalesce(f.date_time, f.due_at, f.created_at) >= $1
             and coalesce(f.date_time, f.due_at, f.created_at) < $2
             ${userCondition}
        `,
        queryParams,
      );

      const followupAppointments = followupRows.rows.map((row: any) => {
        const time = row.dt
          ? new Date(row.dt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : "";
        return {
          id: row.id,
          company: row.company_name ?? "Follow-up",
          purpose: row.purpose ?? "Follow-up",
          time,
        };
      });

      const combined = [...formattedAppointments, ...followupAppointments];
      logDebug("[sales/appointments/today]", { count: formattedAppointments.length });

      res.json(combined);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments", detail: (error as any)?.message });
    }
  });

  // GET /api/sales/appointments - Get appointments for a specific date (defaults to today)
  app.get("/api/sales/appointments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const isAll = req.query.all === "true";
      const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const date = new Date(dateParam);
      const dateFrom = isAll ? undefined : new Date(date);
      if (dateFrom) dateFrom.setHours(0, 0, 0, 0);
      const dateTo = isAll ? undefined : new Date(date);
      if (dateTo) dateTo.setHours(23, 59, 59, 999);

      const appointments = await appointmentsRepository.findByUserId(req.user.userId, dateFrom, dateTo);

      const formatted = appointments.map((apt) => ({
        id: apt.id,
        company: (apt.customer as any)?.company_name || apt.customer?.companyName || "Unknown",
        purpose: apt.notes ?? (apt.customer as any)?.last_note ?? (apt.customer as any)?.lastNote ?? "Meeting",
        time: apt.startsAt ? new Date(apt.startsAt).toISOString() : "",
        startsAt: apt.startsAt ? new Date(apt.startsAt).toISOString() : null,
        endsAt: (apt as any).endsAt ? new Date((apt as any).endsAt).toISOString() : null,
        manager: (apt.customer as any)?.manager_name || (apt.customer as any)?.managerName || "System", // Or whichever way to get manager
        meetingBy: (req.user as any).username || "Self",
      }));

      res.json({ data: formatted, meta: { date: dateParam, total: formatted.length } });
    } catch (error) {
      console.error("Error fetching appointments by date", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // POST /api/sales/appointments - Create an appointment
  app.post("/api/sales/appointments", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { customerId, purpose, date, time, location } = req.body || {};
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!customerId || !uuidPattern.test(String(customerId))) {
        return res.status(400).json({ error: "Valid customerId (uuid) is required" });
      }
      if (!date || Number.isNaN(Date.parse(date))) {
        return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
      }
      const startsAt = new Date(`${date}T${time || "00:00"}`);
      const created = await appointmentsRepository.create({
        userId: req.user.userId,
        customerId,
        startsAt,
        notes: purpose,
        location,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating appointment", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // PATCH /api/sales/appointments/:id/end - End an appointment
  app.patch("/api/sales/appointments/:id/end", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      
      const sql = `update drm.appointments set ends_at = now() where id = $1 returning *`;
      const result = await pool.query(sql, [id]);
      
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      const appt = result.rows[0];
      const apptCustomerId = salesAsUuid(appt?.customer_id);
      const apptEntityId = apptCustomerId ?? (appt?.customer_id != null ? String(appt.customer_id) : undefined);
      if (apptEntityId) {
        const nextAt = safeIso(req.body?.nextFollowupAt ?? req.body?.next_followup_at);
        const APPT_OUTCOMES = new Set(["INTERESTED","NOT_INTERESTED","CALLBACK","NO_RESPONSE","CONVERTED","COMPLAINT","RENEWAL","RESOLVED","DROPOUT_RISK","OTHER"]);
        const apptOutcome = String(req.body?.outcome ?? "").toUpperCase();
        void CommunicationService.log({
          entityType: "appointment",
          entityId: apptEntityId,
          customerId: apptCustomerId,
          channel: "MEETING",
          outcome: APPT_OUTCOMES.has(apptOutcome) ? apptOutcome : undefined,
          notes: typeof req.body?.notes === "string" ? req.body.notes : (appt?.notes ?? undefined),
          status: nextAt ? "PENDING" : "COMPLETED",
          nextFollowupAt: nextAt,
          relatedAppointmentId: String(appt?.id ?? id),
        } as any, { userId: req.user.userId }, req);
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error ending appointment:", error);
      res.status(500).json({ error: "Failed to end appointment" });
    }
  });

  // GET /api/sales/important-metrics - Get important metrics counts
  app.get("/api/sales/important-metrics", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const manager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      const params: any[] = [];
      const scopeCustomers: string[] = ["coalesce(c.is_deleted,false)=false"];
      if (!manager) {
        params.push(userId);
        scopeCustomers.push("(c.owner_user_id = $1 or c.created_by = $1 or c.pool_type = 'Public')");
      }
      const whereCustomers = scopeCustomers.length ? `where ${scopeCustomers.join(" and ")}` : "";

      // Grade-based followups (customers)
      const gradeCountExact = async (grade: string | string[]) => {
        if (Array.isArray(grade)) {
          const sql = `select count(*)::int as count from drm.customers c ${whereCustomers} and lower(trim(coalesce(c.grade,''))) = ANY($${params.length + 1})`;
          return (await pool.query(sql, [...params, grade.map((g) => g.toLowerCase())])).rows[0]?.count ?? 0;
        }
        const sql = `select count(*)::int as count from drm.customers c ${whereCustomers} and lower(trim(coalesce(c.grade,''))) = $${params.length + 1}`;
        return (await pool.query(sql, [...params, grade.toLowerCase()])).rows[0]?.count ?? 0;
      };

      // A- specific for A-Followup metric
      const aFollowup = await gradeCountExact("A-");
      const bPlusFollowup = await gradeCountExact("B+");
      const bFollowup = await gradeCountExact(["B", "B-"]);
      // B Follow Up: grade B customers that already have at least one followup
      const followupRes = await pool.query(
        `
          select count(distinct c.id)::int as count
            from drm.customers c
            join follow_ups f on f.customer_id = c.id and coalesce(f.is_deleted,false)=false
           ${whereCustomers}
             and lower(trim(coalesce(c.grade,''))) = 'b'
        `,
        params,
      );
      const followup1 = followupRes.rows[0]?.count ?? 0;

      const followup30Res = await pool.query(
        `select count(*)::int as count
           from drm.follow_ups f
           left join drm.customers c on c.id = f.customer_id
          where coalesce(f.is_deleted,false)=false
            and f.due_at <= now() + interval '30 day'
            ${manager ? "" : "and f.assigned_to = $1"}`,
        manager ? [] : [userId],
      );
      const followup30 = followup30Res.rows[0]?.count ?? 0;

      // Dropout leads (using customers status if available)
      const dropoutRes = await pool.query(
        `select
            count(*) filter (where coalesce(lower(c.status),'') = 'dropout')::int as dropout_all,
            count(*) filter (where coalesce(lower(c.status),'') = 'dropout' and c.updated_at >= now() - interval '7 day')::int as dropout_7
         from drm.customers c
         ${whereCustomers}`,
        params,
      );
      const dropoutLeads = dropoutRes.rows[0]?.dropout_all ?? 0;
      const dropout7 = dropoutRes.rows[0]?.dropout_7 ?? 0;

      // Not followed yet: customers with no followups
      const notFollowRes = await pool.query(
        `select count(*)::int as count
           from drm.customers c
           left join follow_ups f on f.customer_id = c.id and coalesce(f.is_deleted,false)=false
         ${whereCustomers}
         group by c.id
         having count(f.id) = 0`,
        params,
      );
      const notFollowYet = notFollowRes.rows.length;

      // Opportunities by stage
      const oppStageRes = await pool.query(
        `select stage, count(*)::int as count
           from opportunities o
           join drm.customers c on c.id = o.customer_id
          where coalesce(o.is_deleted,false)=false
            ${manager ? "" : "and o.owner_id = $1"}
          group by stage`,
        manager ? [] : [userId],
      );
      const stageMap = oppStageRes.rows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.stage] = Number(row.count ?? 0);
        return acc;
      }, {});

      // VAS/BV/Due Payment mapped from opportunities stages (fallback across common labels)
      const bvDocument = stageMap["BV"] ?? stageMap["BVDOC"] ?? stageMap["BV_DOCUMENT"] ?? 0;
      const vasDocument = stageMap["PM"] ?? stageMap["VAS"] ?? stageMap["VASDOC"] ?? 0;
      const duePayment =
        stageMap["DP"] ??
        stageMap["DUE_PAYMENT"] ??
        stageMap["DUE PAYMENT"] ??
        stageMap["PM"] ??
        0;

      // Todo list pending
      const todoRes = await pool.query(
        `select count(*)::int as count from todo_tasks
          where coalesce(status,'PENDING') not in ('FINISHED','DONE','COMPLETED')
            ${manager ? "" : "and created_by_user_id = $1"}`,
        manager ? [] : [userId],
      );
      const todoCount = todoRes.rows[0]?.count ?? 0;

      // Complaints: open/pending tickets
      const complaintsRes = await pool.query(
        `select count(*)::int as count from support_tickets where coalesce(status,'Open') not in ('Closed','Resolved')`,
      );
      const complaints = complaintsRes.rows[0]?.count ?? 0;

      const metrics = {
        a_followup: aFollowup,
        followup_1: followup1,
        followup_30_days: followup30,
        b_followup: bFollowup,
        b_plus_followup: bPlusFollowup,
        dropout_leads: dropoutLeads,
        dropout_7_days: dropout7,
        not_follow_yet: notFollowYet,
        vas_document: vasDocument,
        todo_list: todoCount,
        complaints,
        bv_document: bvDocument,
        due_payment: duePayment,
      };
      logDebug("[sales/important-metrics]", metrics);

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching important metrics:", error);
      res.status(500).json({ error: "Failed to fetch important metrics", detail: (error as any)?.message });
    }
  });

  // GET /api/dashboard/sales-executive/customer-monthly - Monthly customers table
  app.get("/api/dashboard/sales-executive/customer-monthly", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM
      const focus = req.query.focus === "1";
      const search = (req.query.search as string)?.trim() || "";
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "10"), 10)));
      const offset = (page - 1) * pageSize;
      const [yearStr, monthStr] = monthParam.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr) - 1; // JS month 0-based
      const dateFrom = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const dateTo = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

      const manager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      const params: any[] = [dateFrom, dateTo];
      const where: string[] = [
        "coalesce(c.is_deleted,false)=false",
        "c.created_at >= $1",
        "c.created_at < $2",
      ];
      if (!manager) {
        params.push(req.user.userId);
        where.push("(c.owner_user_id = $3 or c.created_by = $3 or c.pool_type = 'Public')");
      }

      if (focus) {
        // Focus rule: higher grades (A, A-, A+, B+) or has last_note present
        const focusGrades = ["A+", "A", "A-", "B+"];
        params.push(focusGrades);
        where.push("(c.grade = ANY($4) or coalesce(c.last_note,'') <> '')");
      }

      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        where.push(
          `(coalesce(c.company_name,c.company,'') ilike $${idx} or coalesce(c.account_name,c.account_holder,'') ilike $${idx} or coalesce(c.email,'') ilike $${idx} or coalesce(c.phone,'') ilike $${idx})`,
        );
      }

      const whereSql = `where ${where.join(" and ")}`;
      const rows = await pool.query(
        `select count(*) over() as total,
                c.id,
                c.drm_id,
                coalesce(c.company_name, c.company, '') as company,
                coalesce(c.account_name, c.account_holder, '') as account_name,
                coalesce(c.email,'') as email,
                coalesce(c.phone,'') as phone,
                coalesce(c.ntn,'') as ntn,
                coalesce(c.grade,'') as grade,
                coalesce(c.last_note,'') as last_note,
                c.created_at
           from drm.customers c
          ${whereSql}
          order by c.created_at desc
          limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, pageSize, offset],
      );

      const data = rows.rows.map((r: any) => ({
        id: r.id,
        drmId: r.drm_id,
        company: r.company,
        accountName: r.account_name,
        email: r.email,
        phone: r.phone,
        ntn: r.ntn,
        grade: r.grade,
        lastNote: r.last_note,
        createdAt: r.created_at,
      }));
      if (data.length > 0) console.log("[DEBUG] customer-monthly[0]:", data[0]);

      const total = rows.rows.length > 0 ? Number(rows.rows[0].total ?? data.length) : 0;

      return res.json({
        data,
        meta: { month: monthParam, total, page, pageSize },
      });
    } catch (error) {
      console.error("Error fetching customer monthly table", error);
      return res.status(500).json({ error: "Failed to fetch customer monthly data" });
    }
  });

  // GET /api/office/vas-documents - VAS document listing (opportunities stage PM)
  app.get("/api/office/vas-documents", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const manager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      const search = (req.query.search as string)?.trim() || "";
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10)));
      const offset = (page - 1) * pageSize;

      const params: any[] = [];
      const where: string[] = ["coalesce(o.is_deleted,false)=false", "o.stage = 'PM'"];
      if (!manager) {
        params.push(req.user.userId);
        where.push(`o.owner_id = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        where.push(
          `(coalesce(c.company_name,'') ilike $${idx} or coalesce(c.account_name,'') ilike $${idx} or coalesce(o.title,'') ilike $${idx})`,
        );
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const rows = await pool.query(
        `select count(*) over() as total,
                o.id,
                coalesce(c.company_name,'') as company,
                coalesce(c.account_name,'') as account,
                coalesce(o.title,'') as project,
                coalesce(c.grade,'') as grade,
                o.stage as status,
                o.created_at
           from opportunities o
           join drm.customers c on c.id = o.customer_id
          ${whereSql}
          order by o.created_at desc
          limit $${params.length + 1} offset $${params.length + 2}`,
        [...params, pageSize, offset],
      );

      const data = rows.rows.map((r: any) => ({
        id: r.id,
        company: r.company,
        person: r.account,
        project: r.project,
        grade: r.grade,
        status: r.status,
        date: r.created_at,
      }));
      const total = rows.rows.length ? Number(rows.rows[0].total ?? data.length) : 0;

      return res.json({
        data,
        meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    } catch (error) {
      console.error("Error fetching VAS documents", error);
      return res.status(500).json({ error: "Failed to fetch VAS documents" });
    }
  });

  // ============================================
  // CUSTOMER MANAGEMENT ENDPOINTS
  // ============================================

  // GET /api/sales/customers - Get paginated customers with filters
  app.get("/api/sales/customers", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const grade = req.query.grade as string;
      const stage = req.query.stage as string;
      const sortBy = req.query.sortBy as string || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const result = await customersRepository.findByUserId(req.user.userId, {
        page,
        pageSize,
        search,
        status,
        grade,
        stage,
        sortBy,
        sortOrder,
      }, ((req.user as any).activeRoleId || req.user.roleId), (req as any).salesTable);

      const payload = {
        success: true,
        data: result.customers,
        meta: {
          total: result.total,
          page,
          limit: pageSize,
          totalPages: Math.ceil(result.total / pageSize),
        },
        // legacy fields
        customers: result.customers,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize),
      };

      res.setHeader("Cache-Control", "no-store");
      res.json(payload);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // GET /api/sales/customers/stats - Get customer stats by grade and stage
  app.get("/api/sales/customers/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const activeRole = ((req.user as any).activeRoleId || req.user.roleId);
      const [gradeStats, stageStats] = await Promise.all([
        customersRepository.getGradeStats(req.user.userId, activeRole),
        customersRepository.getStageStats(req.user.userId, activeRole),
      ]);

      res.json({
        success: true,
        data: {
          totalCustomers: Object.values(gradeStats).reduce((a, b) => a + b, 0),
          gradeStats,
          stageStats,
        },
        gradeStats,
        stageStats,
      });
    } catch (error) {
      console.error("Error fetching customer stats:", error);
      res.status(500).json({ error: "Failed to fetch customer stats" });
    }
  });

  // POST /api/sales/customers - Create a new customer (Add Customer form)
  // GET /api/sales/customers/check-company?name=...
  app.get("/api/sales/customers/check-company", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const name = (req.query.name as string)?.trim();
      if (!name) return res.json({ available: true });

      const result = await pool.query(
        "select id from drm.customers where regexp_replace(lower(coalesce(company_name, company, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g') limit 1",
        [name],
      );
      if ((result.rowCount ?? 0) > 0) {
        return res.json({ available: false, existingCustomerId: result.rows[0].id });
      }
      res.json({ available: true });
    } catch (err) {
      console.error("Error checking company name:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to check company name" });
    }
  });

  // GET /api/sales/customers/check-field?field=cnic&value=...
  app.get("/api/sales/customers/check-field", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const field = (req.query.field as string)?.trim();
      const value = (req.query.value as string)?.trim();
      if (!field || !value) return res.json({ available: true });

      const allowedFields = ['cnic', 'ntn', 'email', 'mobile', 'phone', 'crm_id'];
      if (!allowedFields.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
      }

      let query = `select id from drm.customers where ${field} = $1 limit 1`;
      let queryValue = value;

      if (field === 'email') {
        query = `select id from drm.customers where lower(trim(email)) = lower(trim($1)) limit 1`;
      } else if (field === 'mobile' || field === 'phone') {
        const normalized = value.replace(/\D/g, "");
        query = field === 'mobile' 
          ? `select id from drm.customers where regexp_replace(mobile, '\\D', '', 'g') = $1 limit 1`
          : `select id from drm.customers where phone_normalized = $1 or regexp_replace(phone, '\\D', '', 'g') = $1 limit 1`;
        queryValue = normalized;
      }

      const result = await pool.query(query, [queryValue]);
      
      if ((result.rowCount ?? 0) > 0) {
        return res.json({ available: false, existingCustomerId: result.rows[0].id });
      }
      res.json({ available: true });
    } catch (err) {
      console.error(`Error checking ${req.query.field}:`, err);
      res.status(500).json({ error: "InternalError", message: `Failed to check ${req.query.field}` });
    }
  });

  // GET /api/posting/products?active=true
  app.get("/api/posting/products", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const active = req.query.active === "true";
      const result = await pool.query(
        `select id, name, sku, price, stock from drm.products ${active ? "where stock > 0" : ""} order by name asc`,
      );

      res.json(result.rows.map(r => ({ ...r, isActive: Number(r.stock) > 0 })));
    } catch (err) {
      console.error("Error fetching products:", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch products" });
    }
  });

  app.post("/api/sales/customers", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await ensureCustomersSchema();

      const {
        company,
        companyName,
        accountHolder,
        accountHolderName,
        email,
        phone,
        mobile,
        ntn,
        cnic,
        grade,
        stage,
        lastNote,
        region,
        source,
        serviceTypes,
        country,
        abType,
        businessLine,
      } = req.body;

      const companyVal = (company || companyName)?.trim();
      const accountVal = (accountHolder || accountHolderName)?.trim();
      const emailVal = email?.trim().toLowerCase();
      const phoneVal = phone?.toString().trim();
      const mobileVal = mobile?.toString().trim();
      const countryVal = country?.trim();

      if (!companyVal || !accountVal || !phoneVal || !emailVal || !region) {
        return res.status(400).json({ success: false, message: "company, accountHolder, phone, email, and region are required" });
      }

      // Enforce allowed countries
      const allowedCountries = ["Pakistan", "USA", "UAE"];
      if (countryVal && !allowedCountries.includes(countryVal)) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: `Country must be one of: ${allowedCountries.join(", ")}`
        });
      }

      // Normalize phone (digits only)
      const normalizePhone = (p: string) => p.replace(/\D/g, "");
      const phoneNormalized = normalizePhone(phoneVal);
      const mobileNormalized = mobileVal ? normalizePhone(mobileVal) : null;

      // Uniqueness Checks
      const checkDup = async (col: string, val: string, msg: string) => {
        let sql = `select 1 from drm.customers where ${col} = $1 limit 1`;
        if (col === "company_name") {
          sql = `select 1 from drm.customers where regexp_replace(lower(coalesce(company_name, company, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g') limit 1`;
        } else if (col === "email") {
          sql = `select 1 from drm.customers where lower(trim(email)) = lower(trim($1)) limit 1`;
        }
        const res = await pool.query(sql, [val]);
        if ((res.rowCount ?? 0) > 0) throw new Error(msg);
      };

      let existingCustomer = null;
      if (req.body.upsert) {
        const q = `select id from drm.customers where regexp_replace(lower(coalesce(company_name, company, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g') or lower(trim(email)) = lower(trim($2)) limit 1`;
        const checkRes = await pool.query(q, [companyVal, emailVal]);
        if (checkRes.rows.length > 0) {
          existingCustomer = checkRes.rows[0];
        }
      }

      if (!existingCustomer) {
        try {
          await checkDup("company_name", companyVal, "Company name already exists");
          await checkDup("email", emailVal, "Email already exists");
          await checkDup("phone_normalized", phoneNormalized, "Phone number already exists");
          if (cnic?.trim()) await checkDup("cnic", cnic.trim(), "CNIC already exists");
          if (ntn?.trim()) await checkDup("ntn", ntn.trim(), "NTN already exists");
        } catch (err: any) {
          return res.status(409).json({ success: false, error: "VALIDATION_ERROR", message: err.message });
        }
      }

      let customer;
      if (existingCustomer) {
        customer = await customersRepository.update(existingCustomer.id, {
          companyName: companyVal,
          country: countryVal || null,
          city: req.body.city || null,
          address: req.body.address || null,
          website: req.body.website || null,
          region,
          status: stage || "New",
          source: source ?? null,
          grade: grade || "C",
          rcLink: req.body.rcLink || null,
          email: emailVal,
          phone: phoneVal,
          phoneNormalized,
          accountName: accountVal,
          ntn: ntn?.trim() || null,
          cnic: cnic?.trim() || null,
          mobile: mobileVal || null,
          lastNote: lastNote || null,
          serviceTypes: serviceTypes ?? [],
          businessLine: businessLine || null,
          abType: abType || null,
          designation: req.body.designation || null,
          personName: req.body.personName || null,
          title: req.body.title || null,
          crmId: req.body.crmId || null,
          crmDate: req.body.crmDate ? new Date(req.body.crmDate) : null,
        } as any);
      } else {
        // Generate Custom DRM ID: [Country] [Initials] [UniquePart]
        const drmId = generateDrmId(companyVal, countryVal || "Other", crypto.randomUUID());

        customer = await customersRepository.create(
          {
            companyName: companyVal,
            country: countryVal || null,
            city: req.body.city || null,
            address: req.body.address || null,
            website: req.body.website || null,
            region,
            status: stage || "New",
            source: source ?? null,
            grade: grade || "C",
            rcLink: req.body.rcLink || null,
            email: emailVal,
            phone: phoneVal,
            phoneNormalized,
            accountName: accountVal,
            ntn: ntn?.trim() || null,
            cnic: cnic?.trim() || null,
            mobile: mobileVal || null,
            lastNote: lastNote || null,
            serviceTypes: serviceTypes ?? [],
            businessLine: businessLine || null,
            abType: abType || null,
            drmId,
            ownerUserId: isManagerialRole(((req.user as any).activeRoleId || req.user.roleId)) ? null : req.user.userId,
            createdBy: req.user.userId,
            designation: req.body.designation || null,
            personName: req.body.personName || null,
            title: req.body.title || null,
            crmId: req.body.crmId || null,
            crmDate: req.body.crmDate ? new Date(req.body.crmDate) : null,
          } as any,
          req.user.userId,
        );
      }

      return res.status(201).json({
        success: true,
        message: "Customer created",
        data: customer,
      });
    } catch (error: any) {
      console.error("Error creating customer:", error);
      if (error?.message?.includes("Missing required")) {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || "Failed to create customer" });
    }
  });

  // ===== TRACING / CUSTOMER TRACKING =====

  app.get("/api/sales/tracing/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await ensureCustomersSchema();

      const roleIsManager = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      
      const poolParam = (req.query.pool as string || "private").toLowerCase();
      const statusFilter = req.query.statusFilter as string | undefined;

      const conditions: string[] = ["coalesce(c.is_deleted, false) = false"];
      const params: any[] = [];
      const addParam = (value: any) => {
        params.push(value);
        return `$${params.length}`;
      };

      switch (poolParam) {
        case "all":
          if (!roleIsManager) {
            conditions.push(`(c.pool_type = 'Public' OR c.owner_user_id = ${addParam(req.user.userId)} OR c.created_by = ${addParam(req.user.userId)})`);
          }
          break;
        case "private":
          conditions.push("(c.pool_type = 'Private' OR c.pool_type = 'GMBV')");
          if (!roleIsManager) {
            conditions.push(`(c.owner_user_id = ${addParam(req.user.userId)} OR c.created_by = ${addParam(req.user.userId)})`);
          }
          break;
        case "service":
          conditions.push("c.pool_type = 'Service'");
          break;
        case "gm_bv":
        case "gmbv":
          conditions.push("c.pool_type = 'GMBV'");
          break;
        case "public":
          conditions.push("c.pool_type = 'Public'");
          conditions.push("c.owner_user_id IS NULL");
          conditions.push("NOT EXISTS (SELECT 1 FROM drm.follow_ups f WHERE f.customer_id = c.id AND coalesce(f.is_deleted, false) = false)");
          conditions.push("NOT EXISTS (SELECT 1 FROM drm.appointments a WHERE a.customer_id = c.id AND coalesce(a.is_deleted, false) = false)");
          conditions.push("NOT EXISTS (SELECT 1 FROM drm.service_pool_entries spe WHERE spe.customer_id = c.id AND spe.status = 'active')");
          break;
        case "expiring":
          conditions.push("c.expires_at between now() and now() + interval '7 day'");
          if (!roleIsManager) {
            conditions.push(`c.owner_user_id = ${addParam(req.user.userId)}`);
          }
          break;
      }

      if (statusFilter) {
        conditions.push(`lower(c.status) = lower(${addParam(statusFilter)})`);
      }

      const where = conditions.join(" AND ");

      const gradeSelects = tracingGrades
        .map((g) => `count(*) filter (where lower(trim(c.grade)) = '${g.toLowerCase()}') as "${g}"`)
        .join(", ");

      const services = [
        { key: "Alibaba_Membership", patterns: ["%Alibaba.com%", "%Alibaba Membership%"] },
        { key: "Alibaba_Services", patterns: ["%VAS%", "%Alibaba Services%"] },
        { key: "Design_Development", patterns: ["%Website%", "%Design%", "%E-Commerce%"] },
        { key: "Domain_Hosting", patterns: ["%Domain%", "%Hosting%"] },
      ];

      const serviceSelects = services.map(s => {
        const orConditions = s.patterns.map(p => `exists (select 1 from unnest(coalesce(c.service_types, '{}'::text[])) as sv where sv ilike '${p}') OR exists (select 1 from drm.lead_services ls where ls.lead_id = c.id and ls.service_type ilike '${p}')`).join(' OR ');
        return `count(*) filter (where ${orConditions}) as "${s.key}"`;
      }).join(", ");

      const query = `
        select ${gradeSelects}, ${serviceSelects}
        from drm.customers c
        where ${where}
      `;

      const result = await pool.query(query, params);
      
      const counts = result.rows[0] || {};
      // Convert string counts to numbers
      for (const key in counts) {
        counts[key] = parseInt(counts[key] || "0", 10);
      }
      
      res.json(counts);
    } catch (error) {
      console.error("Error fetching tracing summary:", error);
      res.status(500).json({ error: "Failed to fetch tracing summary" });
    }
  });

  // GET /api/sales/tracing/list - paginated list with filters
  app.get("/api/sales/tracing/list", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await ensureCustomersSchema();

      const grade = req.query.grade as string | undefined;
      const search = (req.query.search as string | undefined)?.trim() || "";
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize as string) || "20", 10)));
      const offset = (page - 1) * pageSize;

      const params: any[] = [];
      let where = "coalesce(is_deleted, false) = false";
      if (grade) {
        params.push(grade.toLowerCase());
        where += ` and lower(trim(grade)) = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        params.push(`%${search}%`);
        params.push(`%${search}%`);
        where += ` and (coalesce(company, company_name) ilike $${params.length - 2} or email ilike $${params.length - 1} or phone ilike $${params.length})`;
      }
      if (!isManagerialRole(((req.user as any).activeRoleId || req.user.roleId))) {
        params.push(req.user.userId);
        where += ` and coalesce(owner_user_id, created_by) = $${params.length}`;
      }

      const countSql = `select count(*)::int as count from drm.customers where ${where}`;
      const listSql = `
        select
          id,
          drm_id as "drmId",
          coalesce(drm_id, company_id, id::text) as "companyId",
          coalesce(company, company_name) as "companyName",
          coalesce(account_name, account_holder) as "accountHolder",
          email,
          phone as "contactNo",
          coalesce(ntn, cnic) as "ntnCnic",
          grade,
          created_at as "createdAt"
        from drm.customers
        where ${where}
        order by created_at desc
        limit ${pageSize} offset ${offset}
      `;

      const client = await pool.connect();
      try {
        const [countRes, listRes] = await Promise.all([
          client.query(countSql, params),
          client.query(listSql, params),
        ]);
        res.json({
          items: listRes.rows,
          total: countRes.rows[0]?.count ?? 0,
          page,
          pageSize,
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error fetching tracing list:", error);
      res.status(500).json({ error: "Failed to fetch tracing list" });
    }
  });

  // GET /api/sales/tracing/:id - single tracing record
  app.get("/api/sales/tracing/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      const { rows } = await pool.query(
        `
          select id,
                 coalesce(company, company_name) as company_name,
                 coalesce(account_name, account_holder) as account_holder,
                 email,
                 phone,
                 mobile,
                 ntn,
                 cnic,
                 grade,
                 status,
                 source,
                 pool_type,
                 owner_user_id,
                 last_followup_date,
                 expires_at,
                 service_types,
                 company_id,
                 person_name,
                 title,
                 designation,
                 business_line,
                 address,
                 city,
                 country,
                 website,
                 rc_link,
                 crm_id,
                 crm_date,
                 created_at
            from drm.customers
           where id = $1
           limit 1
        `,
        [req.params.id],
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: "NotFound", message: "Tracing record not found" });
      res.json({ success: true, data: row });
    } catch (error) {
      console.error("Error fetching tracing record:", error);
      res.status(500).json({ error: "Failed to fetch tracing record", detail: (error as any)?.message });
    }
  });

  // POST /api/sales/tracing/add - create tracing customer
  app.post("/api/sales/tracing/add", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await ensureCustomersSchema();

      const { companyName, accountHolder, email, contactNo, ntnCnic, grade } = req.body;
      const normalizedGrade = grade || "C";

      if (!companyName || !accountHolder || !contactNo || !email || !normalizedGrade) {
        return res.status(400).json({ error: "companyName, accountHolder, contactNo, email, and grade are required" });
      }
      if (!tracingGrades.includes(normalizedGrade)) {
        return res.status(400).json({ error: "Invalid grade" });
      }

      const dupEmail = await pool.query("select 1 from drm.customers where lower(email) = lower($1) limit 1", [email]);
      if ((dupEmail.rowCount ?? 0) > 0) {
        return res.status(409).json({ error: "Customer already exists (email)" });
      }
      const dupPhone = await pool.query("select 1 from drm.customers where phone = $1 limit 1", [contactNo]);
      if ((dupPhone.rowCount ?? 0) > 0) {
        return res.status(409).json({ error: "Customer already exists (contact)" });
      }

      const drmId = generateDrmId(companyName, "Other", crypto.randomUUID());

      const [inserted] = await db
        .insert(customers)
        .values({
          companyId: drmId,
          companyName,
          accountName: accountHolder,
          email,
          phone: contactNo,
          ntn: ntnCnic ?? null,
          cnic: ntnCnic ?? null,
          grade: normalizedGrade,
          status: "New",
          poolType: "Private",
          drmId,
          ownerUserId: req.user.userId,
          createdBy: req.user.userId,
        } as any)
        .returning();

      return res.status(201).json({ success: true, data: inserted });
    } catch (error) {
      console.error("Error creating tracing customer:", error);
      res.status(500).json({ error: "Failed to create tracing customer" });
    }
  });

  // PATCH /api/sales/tracing/:id/grade - update grade
  app.patch("/api/sales/tracing/:id/grade", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await ensureCustomersSchema();

      const { grade } = req.body;
      if (!grade || !tracingGrades.includes(grade)) {
        return res.status(400).json({ error: "Invalid grade" });
      }

      const [updated] = await db
        .update(customers)
        .set({ grade, updatedAt: new Date() } as any)
        .where(eq(customers.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error updating tracing grade:", error);
      res.status(500).json({ error: "Failed to update grade" });
    }
  });

  app.get("/api/sales/services", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const list = await servicesRepository.listActiveWithSubservices();
      return res.json({ success: true, items: list });
    } catch (error) {
      console.error("Error fetching services list:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  // App-tracked call sessions
  const callStartSchema = z.object({
    customerId: z.string().optional(),
    leadId: z.string().optional(),
    followupId: z.string().optional(),
    reservationType: reservationEnum,
    direction: z.enum(["outbound", "inbound"]).optional(),
    providerCallId: z.string().optional(),
  });

  app.post("/api/calls/start", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = callStartSchema.parse(req.body);
      const session = await callSessionsRepository.start({
        userId: req.user.userId,
        customerId: parsed.customerId,
        leadId: parsed.leadId,
        followupId: parsed.followupId,
        reservationType: parsed.reservationType,
        direction: parsed.direction ?? "outbound",
        providerCallId: parsed.providerCallId ?? null,
        provider: "app",
      });
      res.json({ success: true, data: { sessionId: session.id, startedAt: session.startedAt } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid call start request", details: error.errors });
      }
      console.error("Error starting call", error);
      res.status(500).json({ error: "Failed to start call" });
    }
  });

  const callEndSchema = z.object({
    sessionId: z.string().uuid(),
  });

  app.post("/api/calls/end", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = callEndSchema.parse(req.body);
      const ended = await callSessionsRepository.end(parsed.sessionId, req.user.userId);
      if (!ended) return res.status(404).json({ error: "Active call not found" });

      if (ended.followupId && ended.durationSeconds > 0) {
        await pool.query(
          `update drm.follow_ups
             set talk_time_seconds = coalesce(talk_time_seconds,0) + $1,
                 reservation_type = coalesce(reservation_type, $2),
                 updated_at = now()
           where id = $3`,
          [ended.durationSeconds, ended.reservationType ?? null, ended.followupId],
        );
      }

      res.json({
        success: true,
        data: {
          sessionId: ended.id,
          durationSeconds: ended.durationSeconds,
          endedAt: ended.endedAt,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid call end request", details: error.errors });
      }
      console.error("Error ending call", error);
      res.status(500).json({ error: "Failed to end call" });
    }
  });

  app.get("/api/calls/active", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const active = await callSessionsRepository.findActiveByUser(req.user.userId);
      res.json({ success: true, data: active });
    } catch (error) {
      console.error("Error fetching active call", error);
      res.status(500).json({ error: "Failed to fetch active call" });
    }
  });

  app.get("/api/sales/followups/:id/details", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureFollowupDetailsTables();
      const followupId = req.params.id;
      if (!/^[0-9a-fA-F-]{36}$/.test(followupId)) {
        return res.status(400).json({ error: "Invalid followup id" });
      }
      const { rows } = await pool.query(
        `select
           d.id,
           d.followup_id,
           d.service_id,
           d.subservice_id,
           d.service_code,
           d.subservice_code,
           d.purpose,
           d.grade,
           d.method,
           d.comment,
           d.note,
           d.activity_at,
           d.created_at,
           coalesce(
             json_agg(
               json_build_object(
                 'id', a.id,
                 'fileName', a.file_name,
                 'fileUrl', a.file_url,
                 'mimeType', a.mime_type,
                 'sizeBytes', a.size_bytes,
                 'createdAt', a.created_at
               )
             ) filter (where a.id is not null),
             '[]'
           ) as attachments
         from followup_subservice_details d
         left join followup_subservice_attachments a on a.detail_id = d.id
         where d.followup_id = $1
         group by d.id`,
        [followupId],
      );
      return res.json({ success: true, data: rows });
    } catch (error) {
      console.error("Error fetching followup details", error);
      res.status(500).json({ error: "Failed to fetch followup details" });
    }
  });

  app.get("/api/sales/customers/:customerId/followups/:followupId", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      await ensureFollowupDetailsTables();
      const { customerId, followupId } = req.params;
      if (!/^[0-9a-fA-F-]{36}$/.test(customerId) || !/^[0-9a-fA-F-]{36}$/.test(followupId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const data = await fetchFollowupWithDetails(followupId, customerId);
      if (!data) return res.status(404).json({ error: "Followup not found" });

      const isPrivileged = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      if (!isPrivileged) {
        const owner = data.followup.assigned_to ?? data.followup.created_by;
        if (owner && owner !== req.user.userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const serviceCodes = (data.services || []).map((s: any) => normalizeCode(s.code || ""));
      const subServiceCodes = (data.subServices || []).map((s: any) => normalizeCode(s.code || ""));

      return res.json({
        success: true,
        data: {
          followup: {
            id: data.followup.id,
            customerId: data.followup.customer_id,
            notes: data.followup.notes,
            method: data.followup.method,
            reservationType: data.followup.reservation_type,
            talkTimeSeconds: Number(data.followup.talk_time_seconds ?? 0),
            dueAt: data.followup.due_at,
            dateTime: data.followup.date_time,
            status: data.followup.status,
          },
          services: data.services,
          serviceCodes,
          subServices: data.subServices,
          subServiceCodes,
          subServiceDetails: data.subServiceDetails,
        },
      });
    } catch (error) {
      console.error("Error fetching followup", error);
      res.status(500).json({ error: "Failed to fetch followup" });
    }
  });

  app.put("/api/sales/customers/:customerId/followups/:followupId", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      await ensureFollowupDetailsTables();
      const { customerId, followupId } = req.params;
      if (!/^[0-9a-fA-F-]{36}$/.test(customerId) || !/^[0-9a-fA-F-]{36}$/.test(followupId)) {
        return res.status(400).json({ error: "Invalid id" });
      }

      const followupRes = await pool.query(
        `select * from drm.follow_ups where id = $1 and customer_id = $2 and coalesce(is_deleted,false)=false limit 1`,
        [followupId, customerId],
      );
      const existing = followupRes.rows[0];
      if (!existing) return res.status(404).json({ error: "Followup not found" });
      const isPrivileged = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      if (!isPrivileged) {
        const owner = existing.assigned_to ?? existing.created_by;
        if (owner && owner !== req.user.userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const parsed = followUpCreateSchema.parse({
        customerId: req.body.customer_id ?? req.body.customerId ?? customerId,
        services: req.body.services ?? req.body.service_codes ?? req.body.serviceCodes,
        serviceIds: req.body.service_ids ?? req.body.serviceIds,
        subServices: req.body.subServices ?? req.body.sub_services ?? req.body.sub_service_codes,
        subServiceIds: req.body.sub_service_ids ?? req.body.subServiceIds,
        subServiceDetails: req.body.subServiceDetails ?? req.body.sub_service_details,
        note: req.body.note,
        nextDate: req.body.next_date ?? req.body.nextDate,
        method: req.body.method,
        reservationType: req.body.reservation_type ?? req.body.reservationType ?? req.body.reservation,
        talkTimeSeconds: req.body.talk_time_seconds ?? req.body.talkTimeSeconds,
      });

      const reservationNormalized = parsed.reservationType ? normalizeCode(parsed.reservationType) : undefined;
      let reservationValue: typeof reservationEnum._type | null = null;
      if (reservationNormalized) {
        const parsedReservation = reservationEnum.safeParse(reservationNormalized as any);
        if (!parsedReservation.success) {
          return res.status(400).json({
            error: "INVALID_RESERVATION",
            message: "Invalid reservation value",
            allowed: Array.from(allowedReservations),
          });
        }
        reservationValue = parsedReservation.data;
      }

      const requestedServiceCodes = (parsed.services ?? []).map(normalizeCode).filter(Boolean);
      const requestedServiceIds = parsed.serviceIds ?? [];
      if (requestedServiceCodes.length === 0 && requestedServiceIds.length === 0) {
        return res.status(400).json({ error: "Select at least one service" });
      }

      const services = requestedServiceIds.length
        ? await servicesRepository.findByIds(requestedServiceIds)
        : await servicesRepository.findByCodes(requestedServiceCodes);

      if (requestedServiceIds.length && services.length !== requestedServiceIds.length) {
        return res.status(400).json({ error: "INVALID_SERVICES", message: "One or more services are invalid" });
      }
      if (requestedServiceCodes.length) {
        const foundCodes = new Set(services.map((s) => normalizeCode(s.code)));
        const missingCodes = requestedServiceCodes.filter((code) => !foundCodes.has(code));
        if (missingCodes.length) {
          return res.status(400).json({ error: "INVALID_SERVICES", message: "One or more services are invalid", invalid: missingCodes });
        }
      }

      const serviceIdByCode = new Map(services.map((s) => [normalizeCode(s.code), s.id]));
      const selectedServiceCodes = (requestedServiceCodes.length ? requestedServiceCodes : services.map((s) => normalizeCode(s.code))).filter(
        Boolean,
      );
      const selectedServiceIds = selectedServiceCodes.map((code) => serviceIdByCode.get(code)).filter(Boolean) as string[];

      if (selectedServiceIds.length === 0) {
        return res.status(400).json({ error: "Select at least one service" });
      }
      if (selectedServiceIds.length !== selectedServiceCodes.length) {
        const missing = selectedServiceCodes.filter((code) => !serviceIdByCode.has(code));
        return res.status(400).json({ error: "INVALID_SERVICES", message: "One or more services are invalid", invalid: missing });
      }

      const selectedServiceCodeSet = new Set(selectedServiceCodes);

      const requestedPairsRaw: Array<{ serviceCode: string; subServiceCode: string }> = [];
      const subServicesMap = parsed.subServices ?? {};
      Object.entries(subServicesMap).forEach(([svcCodeRaw, subs]) => {
        if (!Array.isArray(subs)) return;
        const serviceCode = normalizeCode(svcCodeRaw);
        subs
          .map((sub) => normalizeCode(sub))
          .filter(Boolean)
          .forEach((subCode) => {
            requestedPairsRaw.push({ serviceCode, subServiceCode: subCode });
          });
      });

      const subServiceIdsFromBody = parsed.subServiceIds ?? [];
      let subsFromIds: Array<{ id: string; code: string; name: string; serviceId: string; serviceCode: string }> = [];
      if (subServiceIdsFromBody.length) {
        subsFromIds = await servicesRepository.findSubservicesByIds(subServiceIdsFromBody);
        if (subsFromIds.length !== subServiceIdsFromBody.length) {
          const foundIds = new Set(subsFromIds.map((s) => s.id));
          const invalidIds = subServiceIdsFromBody.filter((id: string) => !foundIds.has(id));
          return res.status(400).json({
            error: "INVALID_SUBSERVICES",
            message: "One or more sub-services are invalid",
            invalid: invalidIds.map((subServiceId) => ({ subServiceId })),
          });
        }
        subsFromIds.forEach((sub) =>
          requestedPairsRaw.push({ serviceCode: normalizeCode(sub.serviceCode), subServiceCode: normalizeCode(sub.code) }),
        );
      }

      const seenPairs = new Set<string>();
      const requestedPairs: Array<{ serviceCode: string; subServiceCode: string }> = [];
      for (const pair of requestedPairsRaw) {
        if (!pair.serviceCode || !pair.subServiceCode) continue;
        const key = `${pair.serviceCode}::${pair.subServiceCode}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        requestedPairs.push(pair);
      }

      const invalidPairs: Array<{ serviceCode: string; subServiceCode: string }> = [];
      const pairsToValidate: Array<{ serviceCode: string; subServiceCode: string }> = [];
      for (const pair of requestedPairs) {
        if (!selectedServiceCodeSet.has(pair.serviceCode)) {
          invalidPairs.push(pair);
        } else {
          pairsToValidate.push(pair);
        }
      }

      const subServices = pairsToValidate.length
        ? await servicesRepository.findSubservicesByCodes(pairsToValidate)
        : [];
      const validPairMap = new Map<string, { id: string; serviceId: string; serviceCode: string; code: string }>();
      subServices.forEach((sub) => {
        validPairMap.set(`${normalizeCode(sub.serviceCode)}::${normalizeCode(sub.code)}`, {
          id: sub.id,
          serviceId: sub.serviceId,
          serviceCode: normalizeCode(sub.serviceCode),
          code: normalizeCode(sub.code),
        });
      });

      pairsToValidate.forEach((pair) => {
        const key = `${pair.serviceCode}::${pair.subServiceCode}`;
        if (!validPairMap.has(key)) {
          invalidPairs.push(pair);
        }
      });

      if (invalidPairs.length) {
        return res.status(400).json({
          error: "INVALID_SUBSERVICES",
          message: "One or more sub-services are invalid for the selected services",
          invalid: invalidPairs,
        });
      }

      const detailPayloads = (parsed.subServiceDetails ?? []).map((d) => ({
        serviceCode: normalizeCode(d.serviceCode ?? ""),
        subServiceCode: normalizeCode(d.subServiceCode ?? ""),
        serviceId: d.serviceId,
        subServiceId: d.subServiceId,
        purpose: d.purpose,
        grade: d.grade,
        method: d.method,
        comment: d.comment,
        note: d.note,
        dateTime: d.dateTime,
        talkTimeMinutes: d.talkTimeMinutes ?? null,
        attachments: d.attachments ?? [],
      }));

      const invalidTalkTimes = detailPayloads.filter((d) => {
        const isCall = ["MOBILE", "WHATSAPP", "WHATSAPP_CALL", "W_CALL"].includes(normalizeCode(d.method));
        if (isCall) {
          const tt = Number(d.talkTimeMinutes ?? 0);
          if (!tt || tt < 1 || tt > 600) return true;
          d.talkTimeMinutes = tt;
        } else {
          d.talkTimeMinutes = null;
        }
        return false;
      });
      if (invalidTalkTimes.length) {
        return res.status(400).json({
          error: "TALK_TIME_REQUIRED",
          message: "Talk Time is required for Mobile/WhatsApp Call",
        });
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        const dueAt = parsed.nextDate ?? new Date();
        await client.query(
          `update drm.follow_ups
              set due_at = $1,
                  notes = $2,
                  method = $3,
                  reservation_type = $4,
                  talk_time_seconds = $5,
                  date_time = $6,
                  updated_at = now()
            where id = $7`,
          [
            dueAt,
            parsed.note ?? null,
            parsed.method ?? null,
            reservationValue ?? null,
            parsed.talkTimeSeconds ?? 0,
            parsed.nextDate ?? dueAt,
            followupId,
          ],
        );

        await client.query(`delete from followup_services where followup_id = $1`, [followupId]);
        for (const serviceId of selectedServiceIds) {
          await client.query(
            `insert into drm.followup_services (followup_id, service_id) values ($1, $2) on conflict do nothing`,
            [followupId, serviceId],
          );
        }

        await client.query(`delete from followup_subservices where followup_id = $1`, [followupId]);
        const subServiceIds = Array.from(
          new Set(
            pairsToValidate
              .map((pair) => validPairMap.get(`${pair.serviceCode}::${pair.subServiceCode}`)?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        for (const subServiceId of subServiceIds) {
          await client.query(
            `insert into drm.followup_subservices (followup_id, subservice_id) values ($1, $2) on conflict do nothing`,
            [followupId, subServiceId],
          );
        }

        await client.query(
          `delete from followup_subservice_attachments where detail_id in (select id from followup_subservice_details where followup_id = $1)`,
          [followupId],
        );
        await client.query(`delete from followup_subservice_details where followup_id = $1`, [followupId]);

        if (detailPayloads.length) {
          const codePairToMeta = new Map(
            subServices.map((s) => [`${normalizeCode(s.serviceCode)}::${normalizeCode(s.code)}`, s]),
          );

          for (const detail of detailPayloads) {
            const key = `${detail.serviceCode}::${detail.subServiceCode}`;
            const meta =
              (detail.subServiceId && subServices.find((s) => s.id === detail.subServiceId)) ||
              codePairToMeta.get(key);
            if (!meta) continue;
            const activityAt = detail.dateTime ? new Date(detail.dateTime) : null;
            const detailRes = await client.query(
              `insert into drm.followup_subservice_details
                (followup_id, service_id, subservice_id, service_code, subservice_code, purpose, grade, method, comment, note, talk_time_minutes, activity_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               returning id`,
              [
                followupId,
                meta.serviceId,
                meta.id,
                meta.serviceCode,
                meta.code,
                detail.purpose,
                detail.grade,
                detail.method,
                detail.comment,
                detail.note,
                detail.method && ["MOBILE", "WHATSAPP", "WHATSAPP_CALL", "W_CALL"].includes(normalizeCode(detail.method))
                  ? detail.talkTimeMinutes ?? null
                  : null,
                activityAt,
              ],
            );
            const detailId = detailRes.rows[0]?.id;
            if (detailId && Array.isArray(detail.attachments)) {
              for (const att of detail.attachments) {
                await client.query(
                  `insert into drm.followup_subservice_attachments (detail_id, file_name, file_url, mime_type, size_bytes)
                   values ($1,$2,$3,$4,$5)`,
                  [detailId, att.fileName ?? null, att.fileUrl ?? null, att.mimeType ?? null, att.sizeBytes ?? null],
                );
              }
            }
          }
        }

        await client.query("update drm.customers set last_followup_date = $1 where id = $2", [dueAt, customerId]);
        await client.query("commit");

        const refreshed = await fetchFollowupWithDetails(followupId, customerId);
        return res.json({ success: true, data: refreshed });
      } catch (error) {
        await client.query("rollback");
        console.error("Error updating followup", error);
        return res.status(500).json({ error: "Failed to update followup" });
      } finally {
        client.release();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid follow-up request", details: error.errors });
      }
      console.error("Error updating followup", error);
      res.status(500).json({ error: "Failed to update followup" });
    }
  });

  app.post("/api/sales/followups", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      await ensureCustomersSchema();
      await ensureFollowupDetailsTables();

      const parsed = followUpCreateSchema.parse({
        customerId: req.body.customer_id ?? req.body.customerId,
        services: req.body.services ?? req.body.service_codes ?? req.body.serviceCodes,
        serviceIds: req.body.service_ids ?? req.body.serviceIds,
        subServices: req.body.subServices ?? req.body.sub_services ?? req.body.sub_service_codes,
        subServiceIds: req.body.sub_service_ids ?? req.body.subServiceIds,
        subServiceDetails: req.body.subServiceDetails ?? req.body.sub_service_details,
        note: req.body.note,
        nextDate: req.body.next_date ?? req.body.nextDate,
        method: req.body.method,
        reservationType: req.body.reservation_type ?? req.body.reservationType ?? req.body.reservation,
        talkTimeSeconds: req.body.talk_time_seconds ?? req.body.talkTimeSeconds,
      });

      // Stage 8: a follow-up may only be logged on a lead/customer the caller owns
      // (managers: their team; admin/super_admin: any). Throws 403/404.
      await assertCanEditCustomer(req, parsed.customerId, "customer");

      const reservationNormalized = parsed.reservationType ? normalizeCode(parsed.reservationType) : undefined;
      let reservationValue: typeof reservationEnum._type | null = null;
      if (reservationNormalized) {
        const parsedReservation = reservationEnum.safeParse(reservationNormalized as any);
        if (!parsedReservation.success) {
          return res.status(400).json({
            error: "INVALID_RESERVATION",
            message: "Invalid reservation value",
            allowed: Array.from(allowedReservations),
          });
        }
        reservationValue = parsedReservation.data;
      }

      let requestedServiceCodes = (parsed.services ?? []).map(normalizeCode).filter(Boolean);
      let requestedServiceIds = parsed.serviceIds ?? [];

      let services = requestedServiceIds.length
        ? await servicesRepository.findByIds(requestedServiceIds)
        : await servicesRepository.findByCodes(requestedServiceCodes);

      if (!services || services.length === 0) {
         try {
           const allReq = await pool.query('SELECT * FROM drm.services LIMIT 1');
           if (allReq.rows.length > 0) {
             services = [{ id: allReq.rows[0].id, code: allReq.rows[0].code, name: allReq.rows[0].name }] as any;
             requestedServiceCodes = [allReq.rows[0].code];
             requestedServiceIds = [];
           } else {
             return res.status(400).json({ error: "System requires at least one initialized service to log followups" });
           }
         } catch(e) {
           return res.status(400).json({ error: "System failed to find fallback service" });
         }
      }

      const serviceIdByCode = new Map(services.map((s) => [normalizeCode(s.code), s.id]));
      const selectedServiceCodes = (requestedServiceCodes.length ? requestedServiceCodes : services.map((s) => normalizeCode(s.code))).filter(
        Boolean,
      );
      const selectedServiceIds = selectedServiceCodes.map((code) => serviceIdByCode.get(code)).filter(Boolean) as string[];

      if (selectedServiceIds.length === 0 && services.length > 0) {
        selectedServiceIds.push(services[0].id);
        selectedServiceCodes.push(normalizeCode(services[0].code));
      }

      const selectedServiceCodeSet = new Set(selectedServiceCodes);

      const requestedPairsRaw: Array<{ serviceCode: string; subServiceCode: string }> = [];
      const subServicesMap = parsed.subServices ?? {};
      Object.entries(subServicesMap).forEach(([svcCodeRaw, subs]) => {
        if (!Array.isArray(subs)) return;
        const serviceCode = normalizeCode(svcCodeRaw);
        subs
          .map((sub) => normalizeCode(sub))
          .filter(Boolean)
          .forEach((subCode) => {
            requestedPairsRaw.push({ serviceCode, subServiceCode: subCode });
          });
      });

      const subServiceIdsFromBody = parsed.subServiceIds ?? [];
      let subsFromIds: Array<{ id: string; code: string; name: string; serviceId: string; serviceCode: string }> = [];
      if (subServiceIdsFromBody.length) {
        subsFromIds = await servicesRepository.findSubservicesByIds(subServiceIdsFromBody);
        if (subsFromIds.length !== subServiceIdsFromBody.length) {
          const foundIds = new Set(subsFromIds.map((s) => s.id));
          const invalidIds = subServiceIdsFromBody.filter((id: string) => !foundIds.has(id));
          return res.status(400).json({
            error: "INVALID_SUBSERVICES",
            message: "One or more sub-services are invalid",
            invalid: invalidIds.map((subServiceId) => ({ subServiceId })),
          });
        }
        subsFromIds.forEach((sub) =>
          requestedPairsRaw.push({ serviceCode: normalizeCode(sub.serviceCode), subServiceCode: normalizeCode(sub.code) }),
        );
      }

      const seenPairs = new Set<string>();
      const requestedPairs: Array<{ serviceCode: string; subServiceCode: string }> = [];
      for (const pair of requestedPairsRaw) {
        if (!pair.serviceCode || !pair.subServiceCode) continue;
        const key = `${pair.serviceCode}::${pair.subServiceCode}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        requestedPairs.push(pair);
      }

      const invalidPairs: Array<{ serviceCode: string; subServiceCode: string }> = [];
      const pairsToValidate: Array<{ serviceCode: string; subServiceCode: string }> = [];
      for (const pair of requestedPairs) {
        if (!selectedServiceCodeSet.has(pair.serviceCode)) {
          invalidPairs.push(pair);
        } else {
          pairsToValidate.push(pair);
        }
      }

      const subServices = pairsToValidate.length
        ? await servicesRepository.findSubservicesByCodes(pairsToValidate)
        : [];
      const validPairMap = new Map<string, { id: string; serviceId: string }>();
      subServices.forEach((sub) => {
        validPairMap.set(`${normalizeCode(sub.serviceCode)}::${normalizeCode(sub.code)}`, { id: sub.id, serviceId: sub.serviceId });
      });

      pairsToValidate.forEach((pair) => {
        const key = `${pair.serviceCode}::${pair.subServiceCode}`;
        if (!validPairMap.has(key)) {
          invalidPairs.push(pair);
        }
      });

      if (invalidPairs.length) {
        console.warn("Ignoring invalid pairs in followup payload", invalidPairs);
      }

      const subServiceIds = Array.from(
        new Set(
          pairsToValidate
            .map((pair) => validPairMap.get(`${pair.serviceCode}::${pair.subServiceCode}`)?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      const detailPayloads = (parsed.subServiceDetails ?? []).map((d) => ({
        serviceCode: normalizeCode(d.serviceCode ?? ""),
        subServiceCode: normalizeCode(d.subServiceCode ?? ""),
        serviceId: d.serviceId,
        subServiceId: d.subServiceId,
        purpose: d.purpose,
        grade: d.grade,
        method: d.method,
        comment: d.comment,
        note: d.note,
        dateTime: d.dateTime,
        talkTimeMinutes: d.talkTimeMinutes ?? null,
        attachments: d.attachments ?? [],
      }));

      const client = await pool.connect();
      try {
        await client.query("begin");
        const dueAt = parsed.nextDate ?? new Date();
        const followupResult = await client.query(
          `insert into drm.follow_ups (customer_id, assigned_to, created_by, due_at, status, notes, method, reservation_type, talk_time_seconds, date_time, created_at, updated_at, is_deleted)
             values ($1, $2, $2, $3, 'Open', $4, $5, $6, $7, $8, now(), now(), false)
             returning *`,
          [
            parsed.customerId,
            req.user.userId,
            dueAt,
            parsed.note ?? null,
            parsed.method ?? null,
            reservationValue ?? null,
            parsed.talkTimeSeconds ?? 0,
            parsed.nextDate ?? dueAt,
          ],
        );
        const followup = followupResult.rows[0];

        for (const serviceId of selectedServiceIds) {
          await client.query(
            `insert into drm.followup_services (followup_id, service_id) values ($1, $2) on conflict do nothing`,
            [followup.id, serviceId],
          );
        }
        for (const subServiceId of subServiceIds) {
          await client.query(
            `insert into drm.followup_subservices (followup_id, subservice_id) values ($1, $2) on conflict do nothing`,
            [followup.id, subServiceId],
          );
        }

        if (detailPayloads.length) {
          // Build maps for lookup
          const subIdToMeta = new Map(subServices.map((s) => [s.id, s]));
          const codePairToMeta = new Map(
            subServices.map((s) => [`${normalizeCode(s.serviceCode)}::${normalizeCode(s.code)}`, s]),
          );

          for (const detail of detailPayloads) {
            const key = `${detail.serviceCode}::${detail.subServiceCode}`;
            const meta =
              (detail.subServiceId && subIdToMeta.get(detail.subServiceId)) ||
              codePairToMeta.get(key);
            if (!meta) continue;

            // Robust date parsing for activity date
            const activityAtRaw = detail.dateTime || (detail as any).date_time || (detail as any).date;
            let activityAt = null;
            if (activityAtRaw) {
              const d = new Date(activityAtRaw);
              if (!isNaN(d.getTime())) {
                activityAt = d;
              } else {
                // Try parsing DD/MM/YYYY HH:MM AM/PM or similar
                const str = String(activityAtRaw);
                const parts = str.split(/[/\s-:]/);
                if (parts.length >= 3) {
                  const day = parseInt(parts[0], 10);
                  const month = parseInt(parts[1], 10) - 1;
                  const year = parseInt(parts[2], 10);
                  let hour = parts[3] ? parseInt(parts[3], 10) : 0;
                  const min = parts[4] ? parseInt(parts[4], 10) : 0;
                  const isPM = str.toUpperCase().includes("PM");
                  if (isPM && hour < 12) hour += 12;
                  if (!isPM && hour === 12) hour = 0;

                  const d2 = new Date(year, month, day, hour, min);
                  if (!isNaN(d2.getTime())) activityAt = d2;
                }
              }
            }

            const detailRes = await client.query(
              `insert into drm.followup_subservice_details
                (followup_id, service_id, subservice_id, service_code, subservice_code, purpose, grade, method, comment, note, talk_time_minutes, activity_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
               returning id`,
              [
                followup.id,
                meta.serviceId,
                meta.id,
                meta.serviceCode,
                meta.code,
                detail.purpose,
                detail.grade,
                detail.method,
                detail.comment,
                detail.note,
                detail.talkTimeMinutes ?? null,
                activityAt,
              ],
            );

            // Add to service pool
            await servicePoolRepository.upsertFromFollowup({
              customerId: followup.customer_id,
              salesPersonId: (req as any).user.userId,
              serviceCode: meta.serviceCode,
              subserviceCode: meta.code
            });

            const detailId = detailRes.rows[0]?.id;
            if (detailId && Array.isArray(detail.attachments)) {
              for (const att of detail.attachments) {
                await client.query(
                  `insert into drm.followup_subservice_attachments (detail_id, file_name, file_url, mime_type, size_bytes)
                   values ($1,$2,$3,$4,$5)`,
                  [detailId, att.fileName ?? null, att.fileUrl ?? null, att.mimeType ?? null, att.sizeBytes ?? null],
                );
              }
            }
          }
        }

        await client.query("update drm.customers set last_followup_date = $1 where id = $2", [dueAt, parsed.customerId]);

        await client.query("commit");
        return res.status(201).json({
          success: true,
          data: { ...followup, services },
        });
      } catch (error) {
        await client.query("rollback");
        console.error("Error creating followup", error);
        return res.status(500).json({ error: "Failed to create followup" });
      } finally {
        client.release();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid follow-up request", details: error.errors });
      }
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error creating followup", error);
      res.status(500).json({ error: "Failed to create followup" });
    }
  });

  // GET /api/sales/customers/:id - Get single customer details
  app.get("/api/sales/customers/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const customerId = req.params.id;
      if (!/^[0-9a-fA-F-]{36}$/.test(customerId)) {
        return res.status(400).json({ error: "Invalid customer id format" });
      }

      const customer = await customersRepository.findById(customerId);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ error: "Failed to fetch customer", detail: (error as any)?.message });
    }
  });

  // GET /api/sales/customers/:id/followups - Get customer follow-up details
  app.get("/api/sales/customers/:id/followups", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const customerId = req.params.id;
      if (!/^[0-9a-fA-F-]{36}$/.test(customerId)) {
        return res.status(400).json({ error: "Invalid customer id" });
      }

      const followUps = await customersRepository.getFollowUpDetails(customerId);
      if ((followUps as any)?.success === false) {
        return res.status(500).json(followUps);
      }
      res.json(followUps);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch follow-up details" });
    }
  });

  // GET /api/sales/customers/:id/gm-entries - Get customer GM history
  app.get("/api/sales/customers/:id/gm-entries", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { id } = req.params;
      const items = await customersRepository.getCustomerGmEntries(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching customer GM entries:", error);
      res.status(500).json({ error: "Failed to fetch customer GM entries" });
    }
  });

  // PATCH /api/sales/customers/:id/grade - Update customer grade
  app.patch("/api/sales/customers/:id/grade", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { grade } = req.body;
      if (!grade) {
        return res.status(400).json({ error: "Grade is required" });
      }

      await assertCanEditCustomer(req, req.params.id, "customer");
      const customer = await customersRepository.updateGrade(req.params.id, grade);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error updating grade:", error);
      res.status(500).json({ error: "Failed to update grade" });
    }
  });

  // PATCH /api/sales/customers/:id/note - Update customer note
  app.patch("/api/sales/customers/:id/note", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { note } = req.body;
      if (note === undefined) {
        return res.status(400).json({ error: "Note is required" });
      }

      await assertCanEditCustomer(req, req.params.id, "customer");
      const customer = await customersRepository.updateNote(req.params.id, note);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.json(customer);
    } catch (error) {
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  // PATCH /api/sales/customers/:id/stage - Update customer stage
  app.patch("/api/sales/customers/:id/stage", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { stage } = req.body;
      if (!stage) {
        return res.status(400).json({ error: "Stage is required" });
      }

      const validStages = ["LD", "QF", "AY", "IN", "PM", "GM", "BV", "NC", "RC", "EC", "FW", "NF"];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ error: "Invalid stage" });
      }

      await assertCanEditCustomer(req, req.params.id, "customer");
      await customersRepository.updateStage(req.params.id, req.user.userId, stage);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error updating stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  // ============================================
  // DUPLICATE CHECKER ENDPOINTS
  // ============================================

  // GET /api/check-duplicate - Check for duplicate customers
  app.get("/api/check-duplicate", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await ensureCustomersSchema();

      const company = req.query.company as string;
      const email = req.query.email as string;
      const phone = req.query.phone as string;

      if (!company && !email && !phone) {
        return res.json({ duplicates: [], message: "No search criteria provided" });
      }

      const isPrivileged = isManagerialRole(((req.user as any).activeRoleId || req.user.roleId));
      const ownerUserId = isPrivileged ? null : req.user.userId;

      const normalizedCompany = typeof company === "string" ? company.trim() : "";
      const normalizedEmail = typeof email === "string" ? email.trim() : "";
      const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

      const result = await pool.query(
        `
        with last_follow as (
          select
            customer_id,
            max(date_time) as last_follow_date
          from followups
          group by customer_id
        )
        select
          c.id,
          c.drm_id as "drmId",
          c.company_name as "companyName",
          c.country,
          c.account_name as "accountName",
          c.email as email,
          c.phone as phone,
          c.owner_user_id as "salesPersonId",
          u.name as "salesPersonName",
          lf.last_follow_date as "lastFollowDate",
          case
            when $2 <> '' and c.email ilike ('%' || $2 || '%') then 'email'
            when $3 <> '' and c.phone ilike ('%' || $3 || '%') then 'phone'
            when $1 <> '' and c.company_name ilike ('%' || $1 || '%') then 'company'
            else 'company'
          end as "matchType"
        from drm.customers c
        left join users u on u.id = c.owner_user_id
        left join last_follow lf on lf.customer_id = c.id
        where
          (
            ($1 <> '' and c.company_name ilike ('%' || $1 || '%'))
            or ($2 <> '' and c.email ilike ('%' || $2 || '%'))
            or ($3 <> '' and c.phone ilike ('%' || $3 || '%'))
          )
          and ($4::uuid is null or c.owner_user_id = $4::uuid)
        order by c.created_at desc
        limit 20
        `,
        [normalizedCompany, normalizedEmail, normalizedPhone, ownerUserId ?? null],
      );

      const duplicates = result.rows;

      res.json({
        duplicates,
        count: duplicates.length,
        hasMatches: duplicates.length > 0,
      });
    } catch (error) {
      console.error("Error checking duplicates:", error);
      res.status(500).json({ error: "Failed to check for duplicates" });
    }
  });

  // GET /api/sales/customers/recent - Get recently added customers by user
  app.get("/api/sales/customers/recent", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const recentCustomers = await customersRepository.findRecentByUserId(req.user.userId, limit);

      res.json(recentCustomers);
    } catch (error) {
      console.error("Error fetching recent customers:", error);
      res.status(500).json({ error: "Failed to fetch recent customers" });
    }
  });

  // ============================================
  // ADD CUSTOMER ENDPOINT
  // ============================================

  // POST /api/customers/add - Create a new customer
  app.post("/api/customers/add", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate required fields
      const { companyName, accountName, email, phone, region, grade } = req.body;

      if (!companyName || !accountName || !email || !phone || !region || !grade) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["companyName", "accountName", "email", "phone", "region", "grade"]
        });
      }

      // Generate Custom DRM ID
      const drmId = generateDrmId(companyName, req.body.country || "Other", crypto.randomUUID());

      // Create the customer
      const customer = await customersRepository.create({
        companyName,
        accountName,
        email,
        phone,
        region,
        grade,
        status: req.body.status || "New",
        ntn: req.body.ntn,
        lastNote: req.body.comment,
        // Company Detail fields
        country: req.body.country,
        city: req.body.city,
        address: req.body.address,
        crmId: req.body.crmId,
        crmDate: req.body.crmDate ? new Date(req.body.crmDate) : undefined,
        companyType: req.body.companyType,
        // Primary Detail fields
        title: req.body.title,
        personName: req.body.personName,
        cnic: req.body.cnic,
        website: req.body.website,
        mobile: req.body.mobile,
        designation: req.body.designation,
        comment: req.body.comment,
        // Lead Detail fields
        rcLink: req.body.rcLink,
        source: req.body.source,
        serviceTypes: req.body.serviceTypes || [],
        businessLine: req.body.businessLine,
        drmId,
        ownerUserId: isManagerialRole(((req.user as any).activeRoleId || req.user.roleId)) ? undefined : req.user.userId,
      }, req.user.userId);

      res.status(201).json(customer);
    } catch (error: any) {
      console.error("Error creating customer in /api/customers/add:", error);
      if (error instanceof Error && error.message.includes("Missing required")) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || "Failed to create customer" });
    }
  });

  // GET /api/sales/targets/trend
  app.get("/api/sales/targets/trend", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const type = (req.query.type as string) === "ab" ? "ab" : "vas";
      const period = (req.query.period as string) || "thisMonth";
      const bucket = (req.query.bucket as string) || "daily";
      const { dateFrom, dateTo } = getDateRangeFromPeriodParam(
        period,
        req.query.from as string,
        req.query.to as string,
      );

      if (bucket !== "daily") {
        return res.status(400).json({ error: "Only daily bucket supported" });
      }

      const rowsRes = await pool.query(
        `select date(created_at) as dt, coalesce(sum(value),0)::numeric as achieved
           from opportunities
          where owner_id = $1 and coalesce(is_deleted,false)=false
            and created_at >= $2 and created_at <= $3
          group by date(created_at)
          order by date(created_at) asc`,
        [req.user.userId, dateFrom, dateTo],
      );

      const now = new Date();
      const targetField = type === "vas" ? "vas_target" : "ab_target";
      const targetRes = await pool.query(
        `select ${targetField} as target from drm.targets where user_id = $1 and month = $2 and year = $3 limit 1`,
        [req.user.userId, now.getMonth() + 1, now.getFullYear()],
      );
      const targetAmount = parseFloat(targetRes.rows[0]?.target ?? (type === "vas" ? 45000 : 50000));

      const points = rowsRes.rows.map((r: any) => {
        const achievedAmount = parseFloat(r.achieved ?? 0);
        const percent = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;
        return {
          date: r.dt,
          achievedAmount,
          targetAmount,
          percent,
        };
      });

      const achievedAmount = points.reduce((sum, p) => sum + p.achievedAmount, 0);
      const percent = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;

      return res.json({
        type,
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString(), label: period },
        points,
        totals: { achievedAmount, targetAmount, percent },
      });
    } catch (error) {
      console.error("Error fetching target trend", error);
      return res.status(500).json({ error: "Failed to fetch target trend" });
    }
  });

  // ===== Lead Pools (refresh support) =====
  app.get("/api/sales/lead-pools/summary", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await ensureCustomersSchema();

      const summary = await buildLeadPoolSummary(req.user.userId, ((req.user as any).activeRoleId || req.user.roleId));
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json(summary);
    } catch (error) {
      console.error("Error fetching lead pool summary", error);
      return res.status(500).json({ error: "Failed to fetch lead pool summary" });
    }
  });

  app.get("/api/sales/lead-pools/list", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await ensureCustomersSchema();

      const list = await buildLeadPoolList(req.user.userId, ((req.user as any).activeRoleId || req.user.roleId), req.query as any);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json(list);
    } catch (error) {
      console.error("Error fetching lead pool list", error);
      return res.status(500).json({ error: "Failed to fetch lead pool list" });
    }
  });

  app.post("/api/sales/lead-pools/refresh", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      await ensureCustomersSchema();

      const pool = (req.body?.pool as string | undefined) ?? (req.query.pool as string | undefined) ?? "private";
      const list = await buildLeadPoolList(req.user.userId, ((req.user as any).activeRoleId || req.user.roleId), {
        pool,
        page: (req.body?.page as string) || (req.query.page as string),
        pageSize: (req.body?.pageSize as string) || (req.query.pageSize as string),
        search: (req.body?.search as string) || (req.query.search as string),
        grade: (req.body?.grade as string) || (req.query.grade as string),
        serviceFilter: (req.body?.serviceFilter as string) || (req.query.serviceFilter as string),
        statusFilter: (req.body?.statusFilter as string) || (req.query.statusFilter as string),
        sourceFilter: (req.body?.sourceFilter as string) || (req.query.sourceFilter as string),
      });

      const summary = await buildLeadPoolSummary(req.user.userId, ((req.user as any).activeRoleId || req.user.roleId));

      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      return res.json({ summary, list });
    } catch (error) {
      console.error("Error refreshing lead pools", error);
      return res.status(500).json({ error: "Failed to refresh lead pools" });
    }
  });

  // ===== Lead Actions & History =====
  app.post("/api/sales/leads/:id/actions", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();

      const leadExists = await pool.query(`select 1 from drm.customers where id = $1 limit 1`, [req.params.id]);
      if (!leadExists.rowCount) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const parsed = leadActionSchema.parse(req.body);

      const activity = await leadActivitiesRepository.log({
        customerId: req.params.id,
        action: parsed.action,
        performedBy: req.user.userId,
        note: parsed.note,
        meta: parsed.meta as any,
      });

      if (["whatsapp", "call", "email"].includes(parsed.action)) {
        void CommunicationService.log({
          entityType: "lead",
          entityId: req.params.id,
          customerId: salesAsUuid(req.params.id),
          channel: mapSalesChannel(parsed.action),
          notes: parsed.note,
          status: "COMPLETED",
        }, { userId: req.user.userId }, req);
      }

      return res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error logging lead action", error);
      return res.status(500).json({ error: "Failed to log lead action" });
    }
  });

  app.get("/api/sales/leads/:id/history", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();

      const leadExists = await pool.query(`select 1 from drm.customers where id = $1 limit 1`, [req.params.id]);
      if (!leadExists.rowCount) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const history = await leadActivitiesRepository.listByCustomer(req.params.id);
      return res.json(history);
    } catch (error) {
      console.error("Error fetching lead history", error);
      return res.status(500).json({ error: "Failed to fetch lead history" });
    }
  });

  app.patch("/api/sales/leads/:id", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();

      // Stage 8: ownership enforcement — executives may only edit their own
      // leads; managers their team; admin/super_admin any. Throws 403/404.
      await assertCanEditCustomer(req, req.params.id, "lead");

      const payload = updateLeadSchema.parse(req.body);
      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      // Stage 8: moving a lead to a contraction state requires a reason.
      if (payload.status === "Expire" && !String((req.body as any)?.reason ?? "").trim()) {
        return res.status(400).json({ error: "A reason is required to expire a lead" });
      }

      const updates: Record<string, unknown> = {};
      if (payload.companyName !== undefined) updates.companyName = payload.companyName;
      if (payload.accountName !== undefined) updates.accountName = payload.accountName;
      if (payload.email !== undefined) updates.email = payload.email;
      if (payload.phone !== undefined) updates.phone = payload.phone;
      if (payload.grade !== undefined) updates.grade = payload.grade;
      if (payload.status !== undefined) updates.status = payload.status;
      if (payload.source !== undefined) updates.source = payload.source;
      if (payload.city !== undefined) updates.city = payload.city;
      if (payload.country !== undefined) updates.country = payload.country;
      if (payload.ownerUserId !== undefined) updates.ownerUserId = payload.ownerUserId;
      updates.updatedAt = new Date();

      const [updated] = await db
        .update(customers)
        .set(updates as any)
        .where(eq(customers.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (payload.ownerUserId !== undefined) {
        let newOwnerId = payload.ownerUserId;
        if (newOwnerId === null) {
          newOwnerId = updated.createdBy || req.user.userId;
        }
        await pool.query(
          `UPDATE drm.opportunities SET owner_id = $1, updated_at = now() WHERE customer_id = $2`,
          [newOwnerId, req.params.id]
        );
      }

      await leadActivitiesRepository.log({
        customerId: req.params.id,
        action: "edit",
        performedBy: req.user.userId,
        note: "Lead updated",
        meta: payload as any,
      });

      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof ApiError) return sendError(res, error);
      console.error("Error updating lead", error);
      return res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.post("/api/sales/leads/:id/assign", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();

      // Capture the previous owner so the audit trail records from -> to.
      const [existing] = await db
        .select({ ownerUserId: customers.ownerUserId })
        .from(customers)
        .where(eq(customers.id, req.params.id))
        .limit(1);
      if (!existing) return res.status(404).json({ error: "Lead not found" });

      const fromUserId = (existing as any).ownerUserId ?? null;
      // Optional explicit target (reassignment); defaults to self-assign.
      const toUserId = (req.body?.toUserId as string) || req.user.userId;
      // Authz: anyone may self-assign, but assigning a lead to a *different*
      // user is a managerial action. Guard against privilege escalation.
      if (toUserId !== req.user.userId) {
        const requesterRole = ((req.user as any).activeRoleId || req.user.roleId) as string | undefined;
        if (!isManagerialRole(requesterRole)) {
          return res.status(403).json({ error: "Only managers can assign leads to other users." });
        }
      }
      const reason =
        typeof req.body?.reason === "string" && req.body.reason.trim()
          ? req.body.reason.trim()
          : toUserId === req.user.userId
            ? "Assigned to self"
            : "Reassigned";

      const [updated] = await db
        .update(customers)
        .set({ ownerUserId: toUserId as any, updatedAt: new Date() as any })
        .where(eq(customers.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Lead not found" });

      await leadActivitiesRepository.log({
        customerId: req.params.id,
        action: "Assign" as any,
        performedBy: req.user.userId,
        note: reason,
        meta: { fromUserId, toUserId, reason, at: new Date().toISOString() } as any,
      });
      await recordAssignment({
        entityType: "lead",
        entityId: req.params.id,
        fromUserId,
        toUserId,
        reason,
        req,
      });
      return res.json(updated);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to assign lead" });
    }
  });

  // Lead profile (summary + services + last contact)
  app.get("/api/sales/leads/:id/profile", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();

      const [lead] = await db.select().from(customers).where(eq(customers.id, req.params.id)).limit(1);
      if (!lead) return res.status(404).json({ error: "Lead not found" });

      const services = await leadServicesRepository.listByLead(req.params.id);
      const activities = await leadActivitiesRepository.listByCustomer(req.params.id);
      const lastContact = activities.find((a) => a.action === "call" || a.action === "whatsapp" || a.action === "email");
      const assignmentHistory = await getAssignmentHistory("lead", req.params.id);

      return res.json({
        lead,
        services,
        lastContactAt: lastContact?.createdAt ?? null,
        phones: [lead.phone, (lead as any).mobile].filter(Boolean),
        assignmentHistory,
      });
    } catch (error) {
      console.error("Error fetching lead profile", error);
      return res.status(500).json({ error: "Failed to fetch lead profile" });
    }
  });

  app.get("/api/sales/leads/:id/expiry", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      const services = await leadServicesRepository.listByLead(req.params.id);
      return res.json(services);
    } catch (error) {
      console.error("Error fetching lead expiry", error);
      return res.status(500).json({ error: "Failed to fetch lead expiry" });
    }
  });

  app.get("/api/sales/leads/:id/history", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      const type = (req.query.type as string) || "contact";

      const history = await leadActivitiesRepository.listByCustomer(req.params.id);
      switch (type) {
        case "contact":
          return res.json(history);
        case "company":
          return res.json(history.filter((h) => h.action === "edit"));
        case "quotation":
        case "invoice":
        case "templates":
          return res.json([]); // placeholder until data is present
        default:
          return res.status(400).json({ error: "Invalid history type" });
      }
    } catch (error) {
      console.error("Error fetching lead history", error);
      return res.status(500).json({ error: "Failed to fetch lead history" });
    }
  });

  app.post("/api/sales/leads/:id/actions/followup", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      const note = typeof req.body?.note === "string" ? req.body.note : req.body?.meta?.notes;
      const meta = req.body?.meta || req.body;
      
      const activity = await leadActivitiesRepository.log({
        customerId: req.params.id,
        action: "followup",
        performedBy: req.user.userId,
        note,
        meta: meta as any,
      });

      // Update lead parameters if provided
      const updates: any = { updatedAt: new Date() };
      if (meta?.nextDate || meta?.dueAt) updates.lastFollowupDate = new Date(meta.nextDate || meta.dueAt);
      if (meta?.type) updates.grade = meta.type;
      
      await db.update(customers).set(updates).where(eq(customers.id, req.params.id));

      const nextAt = safeIso(meta?.nextDate || meta?.dueAt);
      void CommunicationService.log({
        entityType: "lead",
        entityId: req.params.id,
        customerId: salesAsUuid(req.params.id),
        channel: mapSalesChannel(meta?.method),
        notes: note,
        nextAction: meta?.purpose || meta?.nextAction || undefined,
        status: nextAt ? "PENDING" : "COMPLETED",
        nextFollowupAt: nextAt,
      }, { userId: req.user.userId }, req);

      return res.status(201).json(activity);
    } catch (error) {
      console.error("Error logging followup", error);
      return res.status(500).json({ error: "Failed to log followup" });
    }
  });

  app.post("/api/sales/leads/:id/actions/whatsapp", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      await ensureCustomersSchema();
      const note = typeof req.body?.note === "string" ? req.body.note : undefined;
      const activity = await leadActivitiesRepository.log({
        customerId: req.params.id,
        action: "whatsapp",
        performedBy: req.user.userId,
        note,
        meta: req.body?.meta as any,
      });
      void CommunicationService.log({
        entityType: "lead",
        entityId: req.params.id,
        customerId: salesAsUuid(req.params.id),
        channel: "WHATSAPP",
        notes: note,
        status: "COMPLETED",
      }, { userId: req.user.userId }, req);
      return res.status(201).json(activity);
    } catch (error) {
      console.error("Error logging whatsapp", error);
      return res.status(500).json({ error: "Failed to log whatsapp" });
    }
  });

  app.post("/api/sales/duplicates/find", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const company = (req.body?.company as string) || "";
      const email = (req.body?.email as string) || "";
      const phone = (req.body?.phone as string) || "";
      const rows = await pool.query(
        `select id, company_name, email, phone, grade, status
         from drm.customers
         where coalesce(is_deleted,false)=false
           and (
             ($1 <> '' and company_name ilike ('%' || $1 || '%')) or
             ($2 <> '' and email ilike ('%' || $2 || '%')) or
             ($3 <> '' and phone ilike ('%' || $3 || '%'))
           )
         limit 20`,
        [company, email, phone],
      );
      return res.json(rows.rows);
    } catch (error) {
      console.error("Error finding duplicates", error);
      return res.status(500).json({ error: "Failed to find duplicates" });
    }
  });

  // Debug schema (dev only)
  app.get("/api/sales/targets/debug/schema", async (_req, res) => {
    if (process.env.NODE_ENV === "production") return res.status(404).end();
    const cols = await pool.query(
      "select table_name, array_agg(column_name order by ordinal_position) as cols from information_schema.columns where table_schema='public' and table_name in ('opportunities','targets') group by table_name",
    );
    return res.json(cols.rows);
  });
}
