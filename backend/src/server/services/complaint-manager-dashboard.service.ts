import { pool } from "../db";

export type ComplaintManagerTicketDto = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  createdAt: string;
  externalReference: string | null;
  customer: { companyName?: string | null } | null;
  assignedTo: { name?: string | null } | null;
};

function periodWhere(period: string): string {
  const p = (period || "LD").toUpperCase();
  if (p === "WC") {
    return `AND t.created_at >= (NOW() AT TIME ZONE 'Asia/Karachi') - INTERVAL '7 days'`;
  }
  if (p === "MN") {
    return `AND t.created_at >= (NOW() AT TIME ZONE 'Asia/Karachi') - INTERVAL '30 days'`;
  }
  return "";
}

export async function fetchComplaintManagerStats(period: string) {
  const periodFilter = periodWhere(period);
  const { rows } = await pool.query<{
    total: string;
    pending: string;
    resolved: string;
    high_priority: string;
  }>(
    `
    SELECT
      count(*)::text AS total,
      count(*) FILTER (WHERE t.status::text IN ('Open', 'InProgress'))::text AS pending,
      count(*) FILTER (WHERE t.status::text IN ('Resolved', 'Closed'))::text AS resolved,
      count(*) FILTER (WHERE t.priority::text = 'High')::text AS high_priority
    FROM drm.support_tickets t
    WHERE coalesce(t.is_deleted, false) = false
      ${periodFilter}
    `,
  );
  const row = rows[0];
  return {
    totalTickets: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    resolved: Number(row?.resolved ?? 0),
    highPriority: Number(row?.high_priority ?? 0),
  };
}

async function mapTicketRows(
  rows: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    channel: string;
    created_at: Date;
    external_reference: string | null;
    company_name: string | null;
    assignee_name: string | null;
  }>,
): Promise<ComplaintManagerTicketDto[]> {
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    priority: r.priority,
    channel: r.channel,
    createdAt: r.created_at.toISOString(),
    externalReference: r.external_reference,
    customer: r.company_name ? { companyName: r.company_name } : null,
    assignedTo: r.assignee_name ? { name: r.assignee_name } : null,
  }));
}

export async function fetchComplaintManagerTickets(): Promise<ComplaintManagerTicketDto[]> {
  const { rows } = await pool.query<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    channel: string;
    created_at: Date;
    external_reference: string | null;
    company_name: string | null;
    assignee_name: string | null;
  }>(
    `
    SELECT
      t.id::text,
      t.subject,
      t.status::text,
      t.priority::text,
      t.channel::text,
      t.created_at,
      t.external_reference,
      COALESCE(NULLIF(btrim(c.company_name), ''), NULLIF(btrim(c.account_name), '')) AS company_name,
      COALESCE(NULLIF(btrim(u.full_name), ''), NULLIF(btrim(u.name), '')) AS assignee_name
    FROM drm.support_tickets t
    LEFT JOIN drm.customers c ON c.id = t.customer_id
    LEFT JOIN drm.users u ON u.id = t.assigned_to_user_id
    WHERE coalesce(t.is_deleted, false) = false
    ORDER BY t.created_at DESC
    `,
  );
  return mapTicketRows(rows);
}