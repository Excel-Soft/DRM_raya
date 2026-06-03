/**
 * Penalty Management service — all DB access for drm.penalties.
 *
 * Honest data only. Reuses the increment service's user helpers
 * (fetchUsers / groupUsersByRole / fetchUserById) so the employee dropdown and
 * naming are consistent across HR features. Soft-delete via deleted_at; deleted
 * rows never appear in listings/details.
 */
import { pool } from "../db";
import { NotificationService } from "./notification-service";

export const PENALTY_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type PenaltyStatus = (typeof PENALTY_STATUSES)[number];

export const PENALTY_HEADS = [
  "Missed Deadline",
  "Quality Issue",
  "Policy Violation",
  "Late Arrival",
  "Late Arrival After Lunch",
  "Mobile",
  "GM Pending AC",
  "Rework / Revision",
  "Complaint",
  "Other",
];

// Columns selected for a penalty row, joined with employee/creator/approver names.
const ROW_SELECT = `
  p.id,
  p.employee_id            as "employeeId",
  coalesce(e.full_name, e.name, e.email) as "employeeName",
  e.email                  as "employeeEmail",
  p.department,
  p.penalty_head           as "penaltyHead",
  p.reason,
  p.amount,
  p.penalty_date           as "penaltyDate",
  p.approval_status        as "approvalStatus",
  p.attachment_url         as "attachmentUrl",
  p.attachment_name        as "attachmentName",
  p.manager_remarks        as "managerRemarks",
  p.hod_remarks            as "hodRemarks",
  p.created_by             as "addedById",
  coalesce(c.full_name, c.name, c.email) as "addedByName",
  coalesce(a.full_name, a.name, a.email) as "approvedByName",
  p.approved_at            as "approvedAt",
  coalesce(r.full_name, r.name, r.email) as "rejectedByName",
  p.rejected_at            as "rejectedAt",
  p.employee_acknowledged_at as "employeeAcknowledgedAt",
  p.created_at             as "createdAt",
  p.updated_at             as "updatedAt"
`;

const ROW_JOINS = `
  from drm.penalties p
  left join drm.users e on e.id = p.employee_id
  left join drm.users c on c.id = p.created_by
  left join drm.users a on a.id = p.approved_by
  left join drm.users r on r.id = p.rejected_by
`;

export interface ListFilters {
  page?: number;
  limit?: number;
  search?: string;
  employeeId?: string;
  department?: string;
  approvalStatus?: string;
  startDate?: string;
  endDate?: string;
  // When set, restrict to penalties whose employee_id is in this list (access scope).
  allowedEmployeeIds?: string[] | null;
  // When set, restrict to penalties created by this user (employee self / mine flag).
  createdBy?: string;
}

export async function listPenalties(filters: ListFilters) {
  const where: string[] = ["p.deleted_at is null"];
  const params: any[] = [];
  let i = 1;

  if (filters.employeeId) {
    where.push(`p.employee_id::text = $${i++}::text`);
    params.push(filters.employeeId);
  }
  if (filters.department) {
    where.push(`p.department = $${i++}`);
    params.push(filters.department);
  }
  if (filters.approvalStatus) {
    where.push(`p.approval_status = $${i++}`);
    params.push(filters.approvalStatus.toUpperCase());
  }
  if (filters.startDate) {
    where.push(`p.penalty_date >= $${i++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push(`p.penalty_date <= $${i++}`);
    params.push(filters.endDate);
  }
  if (filters.createdBy) {
    where.push(`p.created_by::text = $${i++}::text`);
    params.push(filters.createdBy);
  }
  if (Array.isArray(filters.allowedEmployeeIds)) {
    if (filters.allowedEmployeeIds.length === 0) {
      where.push("false");
    } else {
      where.push(`p.employee_id::text = ANY($${i++}::text[])`);
      params.push(filters.allowedEmployeeIds.map(String));
    }
  }
  if (filters.search) {
    where.push(
      `(coalesce(e.full_name, e.name, e.email) ilike $${i} or p.penalty_head ilike $${i} or p.reason ilike $${i} or p.department ilike $${i})`,
    );
    params.push(`%${filters.search}%`);
    i++;
  }

  const whereSql = `where ${where.join(" and ")}`;
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(200, Math.max(1, filters.limit || 10));
  const offset = (page - 1) * limit;

  // Summary across the whole filtered set (not just the page).
  const summaryQ = await pool.query(
    `select
       count(*)::int as "totalPenalties",
       count(*) filter (where p.approval_status = 'PENDING')::int as "pendingCount",
       count(*) filter (where p.approval_status = 'APPROVED')::int as "approvedCount",
       count(*) filter (where p.approval_status = 'REJECTED')::int as "rejectedCount",
       coalesce(sum(p.amount), 0) as "totalAmount"
     ${ROW_JOINS} ${whereSql}`,
    params,
  );
  const summary = summaryQ.rows[0] || {
    totalPenalties: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalAmount: 0,
  };

  const dataQ = await pool.query(
    `select ${ROW_SELECT} ${ROW_JOINS} ${whereSql}
     order by p.penalty_date desc, p.created_at desc
     limit $${i++} offset $${i++}`,
    [...params, limit, offset],
  );

  const total = Number(summary.totalPenalties) || 0;
  return {
    data: dataQ.rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    summary: {
      totalPenalties: Number(summary.totalPenalties) || 0,
      pendingCount: Number(summary.pendingCount) || 0,
      approvedCount: Number(summary.approvedCount) || 0,
      rejectedCount: Number(summary.rejectedCount) || 0,
      totalAmount: Number(summary.totalAmount) || 0,
    },
  };
}

export async function getPenaltyById(id: string) {
  const { rows } = await pool.query(
    `select ${ROW_SELECT} ${ROW_JOINS} where p.id::text = $1::text and p.deleted_at is null limit 1`,
    [id],
  );
  return rows[0] || null;
}

/** Raw row (incl. created_by/employee_id/status/deleted_at) for permission checks. */
export async function getPenaltyRaw(id: string) {
  const { rows } = await pool.query(
    `select id, employee_id as "employeeId", created_by as "createdBy", department,
            approval_status as "approvalStatus", deleted_at as "deletedAt"
       from drm.penalties where id::text = $1::text limit 1`,
    [id],
  );
  return rows[0] || null;
}

export interface CreatePenaltyInput {
  employeeId: string;
  department?: string | null;
  penaltyHead: string;
  reason: string;
  amount: number;
  penaltyDate: string;
  createdBy: string;
  approvalStatus?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  managerRemarks?: string | null;
}

export async function createPenalty(input: CreatePenaltyInput) {
  const status = (input.approvalStatus || "PENDING").toUpperCase();
  const isApproved = status === "APPROVED";
  const { rows } = await pool.query(
    `insert into drm.penalties
       (employee_id, department, penalty_head, reason, amount, penalty_date,
        created_by, approval_status, attachment_url, attachment_name, manager_remarks,
        approved_by, approved_at)
     values ($1::uuid,$2,$3,$4,$5,$6,$7::uuid,$8,$9,$10,$11,
        $12::uuid, case when $12::uuid is not null then now() else null end)
     returning id`,
    [
      input.employeeId,
      input.department ?? null,
      input.penaltyHead,
      input.reason,
      input.amount,
      input.penaltyDate,
      input.createdBy,
      status,
      input.attachmentUrl ?? null,
      input.attachmentName ?? null,
      input.managerRemarks ?? null,
      isApproved ? input.createdBy : null,
    ],
  );
  const id = rows[0].id;

  // Lightweight notification: employee notified of new penalty.
  try {
    await NotificationService.notify({
      userId: input.employeeId,
      message: `A penalty (${input.penaltyHead}) of ${input.amount} was recorded for you.`,
      type: "WARNING",
      targetUrl: "/drm/add-penalty",
    });
  } catch { /* non-fatal */ }

  return getPenaltyById(id);
}

export interface UpdatePenaltyInput {
  employeeId?: string;
  department?: string | null;
  penaltyHead?: string;
  reason?: string;
  amount?: number;
  penaltyDate?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  managerRemarks?: string | null;
}

export async function updatePenalty(id: string, input: UpdatePenaltyInput) {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  const map: Record<string, any> = {
    employee_id: input.employeeId,
    department: input.department,
    penalty_head: input.penaltyHead,
    reason: input.reason,
    amount: input.amount,
    penalty_date: input.penaltyDate,
    attachment_url: input.attachmentUrl,
    attachment_name: input.attachmentName,
    manager_remarks: input.managerRemarks,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      sets.push(`${col} = $${i++}`);
      params.push(val);
    }
  }
  if (sets.length === 0) return getPenaltyById(id);
  sets.push(`updated_at = now()`);
  params.push(id);
  await pool.query(
    `update drm.penalties set ${sets.join(", ")} where id::text = $${i}::text and deleted_at is null`,
    params,
  );
  return getPenaltyById(id);
}

export async function decidePenalty(
  id: string,
  decider: string,
  status: "APPROVED" | "REJECTED",
  hodRemarks?: string | null,
) {
  if (status === "APPROVED") {
    await pool.query(
      `update drm.penalties
         set approval_status = 'APPROVED', approved_by = $2, approved_at = now(),
             rejected_by = null, rejected_at = null, hod_remarks = coalesce($3, hod_remarks),
             updated_at = now()
       where id::text = $1::text and deleted_at is null`,
      [id, decider, hodRemarks ?? null],
    );
  } else {
    await pool.query(
      `update drm.penalties
         set approval_status = 'REJECTED', rejected_by = $2, rejected_at = now(),
             hod_remarks = coalesce($3, hod_remarks), updated_at = now()
       where id::text = $1::text and deleted_at is null`,
      [id, decider, hodRemarks ?? null],
    );
  }
  const updated = await getPenaltyById(id);
  // Notify the creator of the decision.
  try {
    if (updated?.addedById) {
      await NotificationService.notify({
        userId: updated.addedById,
        message: `Penalty for ${updated.employeeName ?? "employee"} was ${status.toLowerCase()}.`,
        type: status === "APPROVED" ? "SUCCESS" : "ERROR",
        targetUrl: "/drm/add-penalty",
      });
    }
  } catch { /* non-fatal */ }
  return updated;
}

export async function acknowledgePenalty(id: string) {
  await pool.query(
    `update drm.penalties set employee_acknowledged_at = now(), updated_at = now()
     where id::text = $1::text and deleted_at is null`,
    [id],
  );
  return getPenaltyById(id);
}

export async function softDeletePenalty(id: string) {
  await pool.query(
    `update drm.penalties set deleted_at = now(), updated_at = now()
     where id::text = $1::text and deleted_at is null`,
    [id],
  );
  return true;
}

export async function monthlyReport(opts: { month?: string; department?: string; employeeId?: string }) {
  const where: string[] = ["p.deleted_at is null"];
  const params: any[] = [];
  let i = 1;

  let month = opts.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    month = new Date().toISOString().slice(0, 7);
  }
  where.push(`to_char(p.penalty_date, 'YYYY-MM') = $${i++}`);
  params.push(month);

  if (opts.department) {
    where.push(`p.department = $${i++}`);
    params.push(opts.department);
  }
  if (opts.employeeId) {
    where.push(`p.employee_id::text = $${i++}::text`);
    params.push(opts.employeeId);
  }
  const whereSql = `where ${where.join(" and ")}`;

  const totals = await pool.query(
    `select count(*)::int as "totalPenalties", coalesce(sum(p.amount),0) as "totalAmount"
     ${ROW_JOINS} ${whereSql}`,
    params,
  );
  const byDepartment = await pool.query(
    `select coalesce(p.department,'(none)') as department, count(*)::int as count, coalesce(sum(p.amount),0) as amount
     ${ROW_JOINS} ${whereSql} group by p.department order by amount desc`,
    params,
  );
  const byEmployee = await pool.query(
    `select p.employee_id as "employeeId", coalesce(e.full_name,e.name,e.email) as name,
            count(*)::int as count, coalesce(sum(p.amount),0) as amount
     ${ROW_JOINS} ${whereSql} group by p.employee_id, e.full_name, e.name, e.email order by amount desc`,
    params,
  );
  const byPenaltyHead = await pool.query(
    `select p.penalty_head as "penaltyHead", count(*)::int as count, coalesce(sum(p.amount),0) as amount
     ${ROW_JOINS} ${whereSql} group by p.penalty_head order by amount desc`,
    params,
  );
  const records = await pool.query(
    `select ${ROW_SELECT} ${ROW_JOINS} ${whereSql} order by p.penalty_date desc, p.created_at desc`,
    params,
  );

  return {
    month,
    department: opts.department ?? null,
    totalPenalties: Number(totals.rows[0]?.totalPenalties) || 0,
    totalAmount: Number(totals.rows[0]?.totalAmount) || 0,
    byDepartment: byDepartment.rows,
    byEmployee: byEmployee.rows,
    byPenaltyHead: byPenaltyHead.rows,
    records: records.rows,
  };
}

// ─── Integration helpers (for Increment / Performance modules) ───────────────
// Ready for future integration: returns approved-penalty discipline data for an
// employee over a date range. Counts/sums only APPROVED, non-deleted penalties.
export async function getPenaltySummaryForEmployee(employeeId: string, startDate?: string, endDate?: string) {
  const where: string[] = ["deleted_at is null", "approval_status = 'APPROVED'", "employee_id::text = $1::text"];
  const params: any[] = [employeeId];
  let i = 2;
  if (startDate) { where.push(`penalty_date >= $${i++}`); params.push(startDate); }
  if (endDate) { where.push(`penalty_date <= $${i++}`); params.push(endDate); }
  const { rows } = await pool.query(
    `select count(*)::int as "penaltyCount", coalesce(sum(amount),0) as "totalAmount"
       from drm.penalties where ${where.join(" and ")}`,
    params,
  );
  return {
    penaltyCount: Number(rows[0]?.penaltyCount) || 0,
    totalAmount: Number(rows[0]?.totalAmount) || 0,
  };
}

export async function getPenaltyRecordsForEmployee(employeeId: string, startDate?: string, endDate?: string) {
  const where: string[] = ["p.deleted_at is null", "p.employee_id::text = $1::text"];
  const params: any[] = [employeeId];
  let i = 2;
  if (startDate) { where.push(`p.penalty_date >= $${i++}`); params.push(startDate); }
  if (endDate) { where.push(`p.penalty_date <= $${i++}`); params.push(endDate); }
  const { rows } = await pool.query(
    `select ${ROW_SELECT} ${ROW_JOINS} where ${where.join(" and ")} order by p.penalty_date desc`,
    params,
  );
  return rows;
}
