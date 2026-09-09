import { pool } from "../db";
import { bvReports, insertBvReportSchema, type BvReport } from "@models/schema";
import { z } from "zod";

let ensuredBv = false;

export async function ensureBvReportsSchema() {
  if (ensuredBv) return;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`create extension if not exists "pgcrypto";`);
    await client.query(`
      create table if not exists bv_reports (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references users(id),
        customer_id uuid references drm.customers(id),
        report_date timestamptz not null default now(),
        status text not null default 'Draft',
        title text,
        summary text,
        notes text,
        total_tasks int not null default 0,
        value_sold numeric(14,2) not null default 0,
        success_rate numeric(6,2) not null default 0,
        follow_ups_done int not null default 0,
        missed_leads int not null default 0,
        meta jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
    await client.query(`
      alter table bv_reports
        alter column id type uuid using id::uuid,
        alter column customer_id type uuid using customer_id::uuid;
    `);
    // Ensure legacy varchar user_id is migrated to uuid and FK recreated
    await client.query(`
      do $$
      begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'bv_reports' and column_name = 'user_id' and data_type <> 'uuid'
        ) then
          alter table bv_reports alter column user_id drop default;
          alter table bv_reports alter column user_id type uuid using user_id::uuid;
        end if;
      end$$;
    `);
    await client.query(`
      do $$
      begin
        if exists (
          select 1 from information_schema.table_constraints
          where table_name = 'bv_reports' and constraint_name = 'bv_reports_user_id_fkey'
        ) then
          alter table bv_reports drop constraint bv_reports_user_id_fkey;
        end if;
      end$$;
    `);
    await client.query(`
      alter table bv_reports
      add constraint bv_reports_user_id_fkey
      foreign key (user_id) references users(id);
    `);
    await client.query(`
      do $$
      begin
        -- Drop existing constraint regardless (to allow re-creating with expanded values)
        if exists (
          select 1 from pg_constraint where conname = 'bv_reports_status_check'
        ) then
          alter table bv_reports drop constraint bv_reports_status_check;
        end if;
        alter table bv_reports
          add constraint bv_reports_status_check check (status in ('Draft','Submitted','Approved','Rejected','Withdrawn'));
      end$$;
    `);
    await client.query(`create index if not exists idx_bv_reports_user_date on bv_reports (user_id, report_date desc);`);
    await client.query(`create index if not exists idx_bv_reports_customer_date on bv_reports (customer_id, report_date desc);`);
    await client.query(`
      alter table bv_reports
        add column if not exists assigned_to uuid references users(id),
        add column if not exists company_name text;
    `);
    // A legacy import may have created assigned_to as varchar, so the
    // `add column if not exists ... uuid` above is a no-op and leaves it varchar.
    // Coalescing a varchar assigned_to with a uuid user_id then fails. Normalize
    // assigned_to to uuid (matching user_id) before any uuid-typed write touches it.
    await client.query(`
      do $$
      begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'bv_reports' and column_name = 'assigned_to' and data_type <> 'uuid'
        ) then
          alter table bv_reports alter column assigned_to type uuid using nullif(assigned_to, '')::uuid;
        end if;
      end$$;
    `);
    await client.query(`update bv_reports set assigned_to = coalesce(assigned_to, user_id) where assigned_to is null;`);
    await client.query(`create index if not exists idx_bv_reports_assigned on bv_reports (assigned_to);`);
    await client.query(`create index if not exists idx_bv_reports_status on bv_reports (status);`);
    await client.query(`create index if not exists idx_bv_reports_report_date on bv_reports (report_date);`);
    // Patch 2 Stage 7 — approval workflow metadata (idempotent; db:push is broken).
    await client.query(`
      alter table bv_reports
        add column if not exists approved_by uuid references users(id),
        add column if not exists approved_at timestamptz,
        add column if not exists rejected_by uuid references users(id),
        add column if not exists rejected_at timestamptz,
        add column if not exists rejection_reason text;
    `);
    await client.query("commit");
    ensuredBv = true;
  } catch (err) {
    await client.query("rollback");
    console.error("Failed to ensure bv_reports schema", err);
    throw err;
  } finally {
    client.release();
  }
}

const updateSchema = insertBvReportSchema.partial();

const RETURNING_COLUMNS = `
         id,
         user_id     as "userId",
         assigned_to as "assignedTo",
         customer_id as "customerId",
         company_name as "companyName",
         report_date as "reportDate",
         status,
         title,
         summary,
         notes,
         total_tasks     as "totalTasks",
         value_sold      as "valueSold",
         success_rate    as "successRate",
         follow_ups_done as "followUpsDone",
         missed_leads    as "missedLeads",
         meta,
         approved_by      as "approvedBy",
         approved_at      as "approvedAt",
         rejected_by      as "rejectedBy",
         rejected_at      as "rejectedAt",
         rejection_reason as "rejectionReason",
         created_at as "createdAt",
         updated_at as "updatedAt"`;

export const bvReportsRepository = {
  async create(userId: string, payload: unknown): Promise<BvReport> {
    await ensureBvReportsSchema();
    const parsed = insertBvReportSchema.parse(payload);
    if (parsed.customerId) {
      const exists = await pool.query<{ id: string }>(`select id from drm.customers where id = $1 limit 1`, [
        parsed.customerId,
      ]);
      if (exists.rowCount === 0) {
        const err = new Error("INVALID_CUSTOMER");
        (err as any).code = "INVALID_CUSTOMER";
        throw err;
      }
    }
    const res = await pool.query<BvReport>(
      `insert into drm.bv_reports (user_id, assigned_to, customer_id, company_name, report_date, status, title, summary, notes, total_tasks, value_sold, success_rate, follow_ups_done, missed_leads, meta)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning 
         id,
         user_id     as "userId",
         assigned_to as "assignedTo",
         customer_id as "customerId",
         company_name as "companyName",
         report_date as "reportDate",
         status,
         title,
         summary,
         notes,
         total_tasks     as "totalTasks",
         value_sold      as "valueSold",
         success_rate    as "successRate",
         follow_ups_done as "followUpsDone",
         missed_leads    as "missedLeads",
         meta,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [
        userId,
        parsed.assignedTo ?? userId,
        parsed.customerId ?? null,
        parsed.companyName ?? null,
        parsed.reportDate ?? new Date(),
        parsed.status ?? "Draft",
        parsed.title ?? null,
        parsed.summary ?? null,
        parsed.notes ?? null,
        parsed.totalTasks ?? 0,
        parsed.valueSold ?? 0,
        parsed.successRate ?? 0,
        parsed.followUpsDone ?? 0,
        parsed.missedLeads ?? 0,
        parsed.meta ?? null,
      ],
    );
    return res.rows[0];
  },

  async update(userId: string, id: string, payload: unknown): Promise<BvReport | null> {
    await ensureBvReportsSchema();
    const parsed = updateSchema.parse(payload);
    const fields: string[] = [];
    const values: any[] = [];
    const baseIdx = 2; // id=$1, user_id=$2
    if (parsed.customerId !== undefined) {
      if (parsed.customerId) {
        const exists = await pool.query<{ id: string }>(`select id from drm.customers where id = $1 limit 1`, [
          parsed.customerId,
        ]);
        if (exists.rowCount === 0) {
          const err = new Error("INVALID_CUSTOMER");
          (err as any).code = "INVALID_CUSTOMER";
          throw err;
        }
      }
      fields.push(`customer_id = $${baseIdx + values.length + 1}`);
      values.push(parsed.customerId);
    }
    if (parsed.assignedTo !== undefined) {
      fields.push(`assigned_to = $${baseIdx + values.length + 1}`);
      values.push(parsed.assignedTo);
    }
    if (parsed.companyName !== undefined) {
      fields.push(`company_name = $${baseIdx + values.length + 1}`);
      values.push(parsed.companyName);
    }
    if (parsed.reportDate !== undefined) {
      fields.push(`report_date = $${baseIdx + values.length + 1}`);
      values.push(parsed.reportDate);
    }
    if (parsed.status !== undefined) {
      fields.push(`status = $${baseIdx + values.length + 1}`);
      values.push(parsed.status);
    }
    if (parsed.title !== undefined) {
      fields.push(`title = $${baseIdx + values.length + 1}`);
      values.push(parsed.title);
    }
    if (parsed.summary !== undefined) {
      fields.push(`summary = $${baseIdx + values.length + 1}`);
      values.push(parsed.summary);
    }
    if (parsed.notes !== undefined) {
      fields.push(`notes = $${baseIdx + values.length + 1}`);
      values.push(parsed.notes);
    }
    if (parsed.totalTasks !== undefined) {
      fields.push(`total_tasks = $${baseIdx + values.length + 1}`);
      values.push(parsed.totalTasks);
    }
    if (parsed.valueSold !== undefined) {
      fields.push(`value_sold = $${baseIdx + values.length + 1}`);
      values.push(parsed.valueSold);
    }
    if (parsed.successRate !== undefined) {
      fields.push(`success_rate = $${baseIdx + values.length + 1}`);
      values.push(parsed.successRate);
    }
    if (parsed.followUpsDone !== undefined) {
      fields.push(`follow_ups_done = $${baseIdx + values.length + 1}`);
      values.push(parsed.followUpsDone);
    }
    if (parsed.missedLeads !== undefined) {
      fields.push(`missed_leads = $${baseIdx + values.length + 1}`);
      values.push(parsed.missedLeads);
    }
    if (parsed.meta !== undefined) {
      fields.push(`meta = $${baseIdx + values.length + 1}`);
      values.push(parsed.meta);
    }
    if (fields.length === 0) return this.getById(userId, id);
    const query = `
      update drm.bv_reports
         set ${fields.join(", ")}, updated_at = now()
       where id = $1 and (user_id = $2 or assigned_to = $2)
       returning 
         id,
         user_id     as "userId",
         assigned_to as "assignedTo",
         customer_id as "customerId",
         company_name as "companyName",
         report_date as "reportDate",
         status,
         title,
         summary,
         notes,
         total_tasks     as "totalTasks",
         value_sold      as "valueSold",
         success_rate    as "successRate",
         follow_ups_done as "followUpsDone",
         missed_leads    as "missedLeads",
         meta,
         created_at as "createdAt",
         updated_at as "updatedAt"`;
    const res = await pool.query<BvReport>(query, [id, userId, ...values]);
    return res.rows[0] ?? null;
  },

  async getById(userId: string, id: string): Promise<BvReport | null> {
    await ensureBvReportsSchema();
    const res = await pool.query<BvReport>(
      `select 
         id,
         user_id     as "userId",
         assigned_to as "assignedTo",
         customer_id as "customerId",
         company_name as "companyName",
         report_date as "reportDate",
         status,
         title,
         summary,
         notes,
         total_tasks     as "totalTasks",
         value_sold      as "valueSold",
         success_rate    as "successRate",
         follow_ups_done as "followUpsDone",
         missed_leads    as "missedLeads",
         meta,
         created_at as "createdAt",
         updated_at as "updatedAt"
       from drm.bv_reports 
       where id = $1 and (user_id = $2 or assigned_to = $2)
       limit 1`,
      [id, userId],
    );
    return res.rows[0] ?? null;
  },

  async list(filterUserIds: string[] | null, from?: Date, to?: Date): Promise<BvReport[]> {
    await ensureBvReportsSchema();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filterUserIds) {
      clauses.push(`(user_id = ANY($${idx}::uuid[]) or assigned_to = ANY($${idx}::uuid[]))`);
      params.push(filterUserIds);
      idx++;
    }

    if (from) {
      clauses.push(`report_date >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      clauses.push(`report_date <= $${idx++}`);
      params.push(to);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const res = await pool.query<BvReport>(
      `select 
         id,
         user_id     as "userId",
         assigned_to as "assignedTo",
         customer_id as "customerId",
         company_name as "companyName",
         report_date as "reportDate",
         status,
         title,
         summary,
         notes,
         total_tasks     as "totalTasks",
         value_sold      as "valueSold",
         success_rate    as "successRate",
         follow_ups_done as "followUpsDone",
         missed_leads    as "missedLeads",
         meta,
         created_at as "createdAt",
         updated_at as "updatedAt"
       from drm.bv_reports 
       ${where} 
       order by report_date desc, created_at desc`,
      params,
    );
    return res.rows;
  },

  /**
   * Fetch a single report. When `filterUserIds` is null the lookup is unscoped
   * (used by approvers/admins who may not own the row); otherwise it is limited
   * to rows whose author OR assignee is in the list.
   */
  async findById(filterUserIds: string[] | null, id: string): Promise<BvReport | null> {
    await ensureBvReportsSchema();
    const clauses: string[] = [`id = $1`];
    const params: any[] = [id];
    if (filterUserIds) {
      clauses.push(`(user_id = ANY($2::uuid[]) or assigned_to = ANY($2::uuid[]))`);
      params.push(filterUserIds);
    }
    const res = await pool.query<BvReport>(
      `select ${RETURNING_COLUMNS}
       from drm.bv_reports
       where ${clauses.join(" and ")}
       limit 1`,
      params,
    );
    return res.rows[0] ?? null;
  },

  /** Transition a report's status (approve/reject). Unscoped by design — the
   * route guards who may call it and validates the source status first.
   *
   * Patch 2 Stage 7 — records who acted and when. An "Approved" transition
   * stamps approved_by/approved_at; a "Rejected" transition stamps
   * rejected_by/rejected_at and persists the (route-validated) rejection reason. */
  async setStatus(
    id: string,
    status: string,
    opts: { actorId?: string; reason?: string } = {},
  ): Promise<BvReport | null> {
    await ensureBvReportsSchema();
    const sets: string[] = [`status = $2`, `updated_at = now()`];
    const params: any[] = [id, status];
    if (status === "Approved") {
      params.push(opts.actorId ?? null);
      sets.push(`approved_by = $${params.length}`);
      sets.push(`approved_at = now()`);
    } else if (status === "Rejected") {
      params.push(opts.actorId ?? null);
      sets.push(`rejected_by = $${params.length}`);
      sets.push(`rejected_at = now()`);
      params.push(opts.reason ?? null);
      sets.push(`rejection_reason = $${params.length}`);
    }
    const res = await pool.query<BvReport>(
      `update drm.bv_reports
          set ${sets.join(", ")}
        where id = $1
        returning ${RETURNING_COLUMNS}`,
      params,
    );
    return res.rows[0] ?? null;
  },
};
