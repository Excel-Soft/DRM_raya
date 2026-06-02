import { pool } from "../db";
import { NotificationService } from "../services/notification-service";


export type HodSummary = {
  totalProjects: number;
  pendingApprovals: number;
  teamMembers: number;
  totalRevenue: number;
};

export type ApprovalRecord = {
  id: string;
  type: string;
  amount?: string;
  referenceId: string | null;
  submittedBy: string | null;
  submittedById?: string | null;
  submittedByName: string | null;
  createdAt: Date;
  companyName?: string | null;
  status: string;
  source: string;
  paymentProofUrl?: string | null;
  items?: string | null;
};



const pendingApprovalsUnion = `
  with pending as (
    select 'Leave'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'drm.leave_requests'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.leave_requests
    where LOWER(status::text) = 'pending'
    union all
    select 'Loan'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'drm.loan_requests'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.loan_requests
    where LOWER(status::text) = 'pending'
    union all
    select 'Overtime'::text as type,
           id::text as id,
           id::text as "referenceId",
           user_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'drm.overtime_records'::text as source,
           NULL::text as "companyName",
           NULL::text as "drmId",
           NULL::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.overtime_records
    where LOWER(status::text) = 'pending'
    union all
    select 'GM Entry'::text as type,
           g.id::text as id,
           g.id::text as "referenceId",
           g.created_by::text as "submittedById",
           g.created_at as "createdAt",
           COALESCE(g.approval_status, 'Pending')::text as status,
           'gm_entries'::text as source,
           COALESCE(c.company_name, g.company_name)::text as "companyName",
           COALESCE(g.drm_id, c.drm_id)::text as "drmId",
           g.amount_usd::numeric as "orderDollar",
           g.member_id::text as "memberId",
           g.package_type::text as "packageName",
           g.payment_proof_url::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.gm_entries g
    left join drm.customers c on c.id = g.customer_id
    where g.approval_status IS NULL OR LOWER(g.approval_status) IN ('pending', 'pending_hod')
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
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           items::text as "items"
    from drm.invoices
    where LOWER(status::text) IN ('pending', 'waiting')
    union all
    select 'Invoice'::text as type,
           id::text as id,
           id::text as "referenceId",
           sales_exec_id::text as "submittedById",
           created_at as "createdAt",
           status::text as status,
           'product_posting_invoices'::text as source,
           COALESCE((COALESCE(company_name, 'N/A') || ' (' || COALESCE(project_name, 'N/A') || ')'), 'N/A')::text as "companyName",
           NULL::text as "drmId",
           amount::numeric as "orderDollar",
           project_name::text as "memberId",
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.product_posting_invoices
    where LOWER(status::text) IN ('pending_hod', 'pending')
    union all
    select 'Quotation'::text as type,
           id::text as id,
           id::text as "referenceId",
           created_by::text as "submittedById",
           created_at as "createdAt",
           save_status::text as status,
           'quotations'::text as source,
           company::text as "companyName",
           NULL::text as "drmId",
           grand_total::numeric as "orderDollar",
           NULL::text as "memberId",
           NULL::text as "packageName",
           NULL::text as "paymentProofUrl",
           NULL::text as "items"
    from drm.quotations
    where LOWER(save_status::text) = 'pending_hod'
  )
  select p.*,
         u.full_name as "submittedByName"
  from pending p
  left join drm.users u on u.id::text = p."submittedById"
`;

export class HodRepository {
  async getSummary(): Promise<HodSummary> {
    try {
      const [totalProjectsRes, pendingApprovalsRes, teamMembersRes, revenueRes] = await Promise.all([
        pool.query(
          `select count(*)::int as count
           from drm.gm_entries`,
        ),
        pool.query(
          `select count(*)::int as count from (
             ${pendingApprovalsUnion}
           ) as p`,
        ),
        pool.query(`select count(*)::int as count from drm.users`),
        pool.query(
          `select coalesce(sum(CAST(amount_pkr as numeric)), 0)::float as amount
           from drm.gm_entries`,
        ),
      ]);

      const result = {
        totalProjects: totalProjectsRes.rows[0]?.count ?? 0,
        pendingApprovals: pendingApprovalsRes.rows[0]?.count ?? 0,
        teamMembers: teamMembersRes.rows[0]?.count ?? 0,
        totalRevenue: revenueRes.rows[0]?.amount ?? 0,
      };
      console.log("[HOD REPOSITORY] getSummary result:", result);
      return result;
    } catch (error) {
      console.error("[HOD] getSummary failed", { error });
      throw error;
    }
  }

  async getPendingApprovals(page: number, limit: number): Promise<{ items: ApprovalRecord[]; total: number }> {
    const offset = (page - 1) * limit;

    try {
      const listPromise = pool.query<ApprovalRecord>(
        `${pendingApprovalsUnion}
         order by "createdAt" desc
         limit $1 offset $2`,
        [limit, offset],
      );

      const totalPromise = pool.query<{ count: number }>(
        `select count(*)::int as count from (${pendingApprovalsUnion}) as p`,
      );

      const [list, total] = await Promise.all([listPromise, totalPromise]);

      console.log("[HOD REPOSITORY] getPendingApprovals result:", { itemsCount: list.rows.length, total: total.rows[0]?.count });
      return {
        items: list.rows,
        total: total.rows[0]?.count ?? 0,
      };
    } catch (error) {
      console.error("[HOD] getPendingApprovals failed", { error, page, limit });
      throw error;
    }
  }

  async approveApproval(id: string, approverId: string): Promise<ApprovalRecord | null> {
    console.log(`[HOD REPOSITORY] approveApproval start for ID: ${id} by Approver: ${approverId}`);
    const target = await this.findPendingById(id);
    console.log(`[HOD REPOSITORY] approveApproval findPendingById result:`, target);

    if (!target) return null;

    console.log("[HOD REPOSITORY] approving source:", target.source);
    let finalStatus = "Approved";

    switch (target.source) {
      case "project_approvals":
        await pool.query(
          `update drm.project_approvals
           set status = 'Approved', approver_user_id = $2, approved_at = now(), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId],
        );
        break;
      case "drm.leave_requests":
        await pool.query(
          `update drm.leave_requests
           set status = 'Approved', approved_by = $2, updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId],
        );
        break;
      case "drm.loan_requests":
        await pool.query(
          `update drm.loan_requests
           set status = 'Approved', hod_approved_by_user_id = $2, hod_approved_at = now(), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId],
        );
        break;
      case "drm.overtime_records":
        await pool.query(
          `update drm.overtime_records
           set status = 'Approved', approved_by = $2, updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId],
        );
        break;
      case "gm_entries":
        await pool.query(
          `update drm.gm_entries
           set approval_status = 'pending_managers', hod_approved_by = $2, hod_approved_at = now(), updated_at = now()
           where id = $1 and (approval_status IS NULL OR approval_status = 'Pending' OR approval_status = 'pending_hod')`,
          [id, approverId],
        );
        finalStatus = "pending_managers";
        break;
      case "invoices":
        await pool.query(
          `update drm.invoices
           set status = 'Sent', updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id],
        );
        finalStatus = "Sent";
        break;
      case "product_posting_invoices": {
        const invRes = await pool.query(
          `update drm.product_posting_invoices
             set status = 'PENDING_ACCOUNT', updated_at = now()
             where id = $1 and status::text IN ('PENDING_HOD', 'Pending', 'pending_hod')
             RETURNING sales_exec_id, company_name, project_name`,
          [id],
        );
        finalStatus = "PENDING_ACCOUNT";

        // Notify Sales Executive that HOD has approved their invoice
        const inv = invRes.rows[0];
        if (inv?.sales_exec_id) {
          try {
            await NotificationService.notify({
              userId: String(inv.sales_exec_id),
              message: `Your '${inv.project_name || 'Product Posting Invoice'}' for '${inv.company_name || 'your company'}' has been approved by the HOD and is now pending Account Manager review.`,
              type: "SUCCESS",
              targetUrl: "/pms/approvals"
            });
            console.log(`[HOD] Notified sales exec ${inv.sales_exec_id} - product posting invoice approved`);
          } catch (notifErr) {
            console.error("[HOD] Failed to notify sales exec for product posting invoice:", notifErr);
          }
        }
        break;
      }

      case "quotations":
        await pool.query(
          `update drm.quotations
           set save_status = 'pending_account_manager', updated_at = now()
           where id = $1 and save_status = 'pending_hod'`,
          [id],
        );
        finalStatus = "pending_account_manager";
        break;
      default:
        console.log("[HOD REPOSITORY] unknown source:", target.source);
        return null;
    }

    return { ...target, status: finalStatus };

  }

  async rejectApproval(id: string, approverId: string, reason?: string): Promise<ApprovalRecord | null> {
    const target = await this.findPendingById(id);
    if (!target) return null;

    switch (target.source) {
      case "project_approvals":
        await pool.query(
          `update drm.project_approvals
           set status = 'Rejected', approver_user_id = $2, rejection_reason = coalesce($3, rejection_reason), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId, reason ?? null],
        );
        break;
      case "drm.leave_requests":
        await pool.query(
          `update drm.leave_requests
           set status = 'Rejected', approved_by = $2, reason = coalesce($3, reason), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId, reason ?? null],
        );
        break;
      case "drm.loan_requests":
        await pool.query(
          `update drm.loan_requests
           set status = 'Rejected', hod_approved_by_user_id = $2, rejection_reason = coalesce($3, rejection_reason), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId, reason ?? null],
        );
        break;
      case "drm.overtime_records":
        await pool.query(
          `update drm.overtime_records
           set status = 'Rejected', approved_by = $2, reason = coalesce($3, reason), updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, approverId, reason ?? null],
        );
        break;
      case "gm_entries":
        await pool.query(
          `update drm.gm_entries
           set approval_status = 'rejected_by_hod', hod_approved_by = $2, hod_approved_at = now(), rejection_reason = coalesce($3, rejection_reason), updated_at = now()
           where id = $1 and (approval_status IS NULL OR approval_status = 'Pending' OR approval_status = 'pending_hod')`,
          [id, approverId, reason ?? null],
        );
        break;
      case "invoices":
        await pool.query(
          `update drm.invoices
           set status = 'Cancelled', notes = coalesce(notes, '') || ' | Rejected by HOD: ' || $2::text, updated_at = now()
           where id = $1 and status = 'Pending'`,
          [id, reason ?? ""],
        );
        break;
      case "product_posting_invoices":
        await pool.query(
          `update drm.product_posting_invoices
           set status = 'REJECTED', updated_at = now()
           where id = $1`,
          [id],
        );
        break;



      default:
        return null;
    }

    return { ...target, status: "Rejected" };
  }

  private async findPendingById(id: string): Promise<ApprovalRecord | null> {
    const res = await pool.query<ApprovalRecord>(
      `${pendingApprovalsUnion}
       where p.id = $1::text
       limit 1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async getProjectDeadlines(filter: string = 'WK', userId?: string) {
    try {
      const interval = filter === 'LD' ? "30 days" : "7 days";
      const query = `
        SELECT 
          id,
          name as "companyName",
          description as project,
          workspace as dep,
          end_date as deadlines
        FROM drm.projects
        WHERE end_date >= NOW() AND end_date <= NOW() + INTERVAL '${interval}'
        ${userId ? `AND owner_user_id = $1` : ""}
        ORDER BY end_date ASC
        LIMIT 20
      `;
      const result = await pool.query(query, userId ? [userId] : []);
      return result.rows;
    } catch (error) {
      console.error("[HOD] getProjectDeadlines failed", { error });
      return [];
    }
  }
}

export const hodRepository = new HodRepository();


