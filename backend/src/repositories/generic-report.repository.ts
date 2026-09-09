import { pool } from "../db";
import type { QueryResultRow } from "pg";
import {
  loanReports,
  vasReports,
  gmReports,
  insertLoanReportSchema,
  insertVasReportSchema,
  insertGmReportSchema,
  customers,
  type InsertLoanReport,
  type LoanReport,
  type InsertVasReport,
  type VasReport,
  type InsertGmReport,
  type GmReport,
} from "@models/schema";

type ReportTable = typeof loanReports | typeof vasReports | typeof gmReports;

function createEnsurer(table: ReportTable, tableName: string, hasLoanFields = false) {
  let ensured = false;
  return async () => {
    if (ensured) return;
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`create extension if not exists "pgcrypto";`);
      const loanExtras = hasLoanFields
        ? `,
          total_applications int not null default 0,
          approved_loans int not null default 0,
          rejected_loans int not null default 0,
          pending_loans int not null default 0,
          total_loan_amount numeric(16,2) not null default 0,
          disbursed_amount numeric(16,2) not null default 0`
        : "";
      await client.query(`
        create table if not exists ${tableName} (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references users(id),
          customer_id uuid references customers(id),
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
          ${loanExtras}
        );
      `);
      await client.query(`
        alter table ${tableName}
          alter column id type uuid using id::uuid,
          alter column user_id type uuid using user_id::uuid,
          alter column customer_id type uuid using customer_id::uuid;
      `);
      if (hasLoanFields) {
        await client.query(`
          alter table ${tableName}
            add column if not exists total_applications int not null default 0,
            add column if not exists approved_loans int not null default 0,
            add column if not exists rejected_loans int not null default 0,
            add column if not exists pending_loans int not null default 0,
            add column if not exists total_loan_amount numeric(16,2) not null default 0,
            add column if not exists disbursed_amount numeric(16,2) not null default 0;
        `);
      }
      await client.query(`
        do $$
        begin
          if exists (
            select 1 from information_schema.table_constraints
            where table_name = '${tableName}' and constraint_name = '${tableName}_user_id_fkey'
          ) then
            alter table ${tableName} drop constraint ${tableName}_user_id_fkey;
          end if;
        end$$;
      `);
      await client.query(`
        alter table ${tableName}
        add constraint ${tableName}_user_id_fkey
        foreign key (user_id) references users(id);
      `);
      ensured = true;
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      console.error(`Failed to ensure ${tableName} schema`, err);
      throw err;
    } finally {
      client.release();
    }
  };
}

const ensureLoanReportsSchema = createEnsurer(loanReports, "loan_reports", true);
const ensureVasReportsSchema = createEnsurer(vasReports, "vas_reports", false);
const ensureGmReportsSchema = createEnsurer(gmReports, "gm_reports", false);

function buildRepo<TInsert, TSelect extends QueryResultRow>(
  tableName: string,
  ensureFn: () => Promise<void>,
  schema: any
) {
  const hasLoanFields = tableName === "loan_reports";
  const updateSchema =
    schema && typeof (schema as any).partial === "function"
      ? (schema as any).partial()
      : require("zod").z.object({});
  return {
    async create(userId: string, payload: unknown): Promise<TSelect> {
      await ensureFn();
      const parsed = schema.parse(payload);
      let customerId: string | null = parsed.customerId ?? null;
      if (customerId) {
        const exists = await pool.query<{ id: string }>(
          `select id from drm.customers where id = $1 limit 1`,
          [customerId]
        );
        if (exists.rowCount === 0) {
          const err = new Error("INVALID_CUSTOMER");
          (err as any).code = "INVALID_CUSTOMER";
          throw err;
        }
      }
      const columns = [
        "user_id",
        "customer_id",
        "report_date",
        "status",
        "title",
        "summary",
        "notes",
        "total_tasks",
        "value_sold",
        "success_rate",
        "follow_ups_done",
        "missed_leads",
        "meta",
      ];
      const values = [
        userId,
        customerId,
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
      ];
      if (hasLoanFields) {
        columns.push(
          "total_applications",
          "approved_loans",
          "rejected_loans",
          "pending_loans",
          "total_loan_amount",
          "disbursed_amount"
        );
        values.push(
          parsed.totalApplications ?? 0,
          parsed.approvedLoans ?? 0,
          parsed.rejectedLoans ?? 0,
          parsed.pendingLoans ?? 0,
          parsed.totalLoanAmount ?? 0,
          parsed.disbursedAmount ?? 0
        );
      }
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(",");
      const res = await pool.query<TSelect>(
        `insert into ${tableName} (${columns.join(",")}) values (${placeholders}) returning *`,
        values
      );
      return res.rows[0];
    },
    async update(userId: string, id: string, payload: unknown): Promise<TSelect | null> {
      await ensureFn();
      const parsed = updateSchema.parse(payload);
      const fields: string[] = [];
      const values: any[] = [];
      const baseIdx = 2;
      const pushField = (column: string, val: any) => {
        fields.push(`${column} = $${baseIdx + values.length + 1}`);
        values.push(val);
      };
      if (parsed.customerId !== undefined) pushField("customer_id", parsed.customerId);
      if (parsed.reportDate !== undefined) pushField("report_date", parsed.reportDate);
      if (parsed.status !== undefined) pushField("status", parsed.status);
      if (parsed.title !== undefined) pushField("title", parsed.title);
      if (parsed.summary !== undefined) pushField("summary", parsed.summary);
      if (parsed.notes !== undefined) pushField("notes", parsed.notes);
      if (parsed.totalTasks !== undefined) pushField("total_tasks", parsed.totalTasks);
      if (parsed.valueSold !== undefined) pushField("value_sold", parsed.valueSold);
      if (parsed.successRate !== undefined) pushField("success_rate", parsed.successRate);
      if (parsed.followUpsDone !== undefined) pushField("follow_ups_done", parsed.followUpsDone);
      if (parsed.missedLeads !== undefined) pushField("missed_leads", parsed.missedLeads);
      if (parsed.meta !== undefined) pushField("meta", parsed.meta);
      if (hasLoanFields) {
        if (parsed.totalApplications !== undefined) pushField("total_applications", parsed.totalApplications);
        if (parsed.approvedLoans !== undefined) pushField("approved_loans", parsed.approvedLoans);
        if (parsed.rejectedLoans !== undefined) pushField("rejected_loans", parsed.rejectedLoans);
        if (parsed.pendingLoans !== undefined) pushField("pending_loans", parsed.pendingLoans);
        if (parsed.totalLoanAmount !== undefined) pushField("total_loan_amount", parsed.totalLoanAmount);
        if (parsed.disbursedAmount !== undefined) pushField("disbursed_amount", parsed.disbursedAmount);
      }
      if (!fields.length) return this.getById(userId, id);
      const query = `
        update ${tableName}
           set ${fields.join(", ")}, updated_at = now()
         where id = $1 and user_id = $2
         returning *`;
      const res = await pool.query<TSelect>(query, [id, userId, ...values]);
      return res.rows[0] ?? null;
    },
    async getById(userId: string, id: string): Promise<TSelect | null> {
      await ensureFn();
      const res = await pool.query<TSelect>(
        `select * from ${tableName} where id = $1 and user_id = $2 limit 1`,
        [id, userId],
      );
      return res.rows[0] ?? null;
    },
    async list(userId: string, from?: Date, to?: Date): Promise<TSelect[]> {
      await ensureFn();
      const clauses: string[] = [`user_id = $1`];
      const params: any[] = [userId];
      let idx = 2;
      if (from) {
        clauses.push(`report_date >= $${idx++}`);
        params.push(from);
      }
      if (to) {
        clauses.push(`report_date <= $${idx++}`);
        params.push(to);
      }
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const res = await pool.query<TSelect>(
        `select * from ${tableName} ${where} order by report_date desc, created_at desc`,
        params,
      );
      return res.rows;
    },
  };
}

export const loanReportsRepository = buildRepo<InsertLoanReport, LoanReport>(
  "loan_reports",
  ensureLoanReportsSchema,
  insertLoanReportSchema
);
export const vasReportsRepository = buildRepo<InsertVasReport, VasReport>(
  "vas_reports",
  ensureVasReportsSchema,
  insertVasReportSchema
);
export const gmReportsRepository = buildRepo<InsertGmReport, GmReport>(
  "gm_reports",
  ensureGmReportsSchema,
  insertGmReportSchema
);

export { ensureLoanReportsSchema, ensureVasReportsSchema, ensureGmReportsSchema };
