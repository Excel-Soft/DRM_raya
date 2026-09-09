import type { Express } from "express";
import { authMiddleware } from "./auth.middleware";
import { z } from "zod";
import { customersRepository } from "./repositories/customers.repository";
import { followUpsRepository } from "./repositories/followups.repository";
import { insertFollowUpSchema } from "@shared/schema";
import { pool } from "./db";
import { normalizeRole } from "./utils/role-utils";

const gradeValues = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"] as const;

import { isManagerialRole } from "./utils/role-utils";

function requireManager(req: any, res: any, next: any) {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  if (!isManagerialRole(req.user.roleId)) {
    return res.status(403).json({ success: false, message: "Access denied: Manager/Admin required." });
  }
  next();
}

export function registerManagerRoutes(app: Express) {
  // Auth is enforced globally in `server/routes.ts` (or via MOCK_AUTH when enabled).
  app.use("/api/manager", authMiddleware);
  app.use("/api/manager", requireManager);

  // Team performance (aggregate per user)
  app.get("/api/crm/team-performance", async (req, res) => {
    try {
      const month = parseInt(String(req.query.month ?? new Date().getMonth() + 1), 10);
      const year = parseInt(String(req.query.year ?? new Date().getFullYear()), 10);
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10));
      const offset = (page - 1) * pageSize;

      const perfSql = `
        with cte as (
          select 
            u.id,
            u.full_name,
            count(c.id) as total_customers,
            count(c.id) filter (where c.status = 'New') as new_customers,
            coalesce(act.activities,0) as activities,
            coalesce(meet.meetings,0) as meetings,
            coalesce(fin.revenue,0) as revenue
          from drm.users u
          left join drm.customers c on c.created_by = u.id and coalesce(c.is_deleted,false)=false and date_part('month', c.created_at) = $1 and date_part('year', c.created_at) = $2
          left join (
            select user_id, count(*) as activities
              from drm.activities
             where date_part('month', created_at) = $1 and date_part('year', created_at) = $2
             group by user_id
          ) act on act.user_id = u.id
          left join (
            select user_id, count(*) as meetings
              from drm.appointments
             where date_part('month', date_time) = $1 and date_part('year', date_time) = $2
             group by user_id
          ) meet on meet.user_id = u.id
          left join (
            select op.owner_id as user_id, coalesce(sum(op.value),0) as revenue
              from drm.opportunities op
             where op.is_deleted = false
               and date_part('month', op.created_at) = $1
               and date_part('year', op.created_at) = $2
             group by op.owner_id
          ) fin on fin.user_id = u.id
          where lower(u.role) in ('sales executive','sales_executive','sales-executive','manager','admin')
          group by u.id, u.full_name, act.activities, meet.meetings, fin.revenue
        )
        select * from cte
        order by revenue desc nulls last
        limit $3 offset $4
      `;
      const countSql = `
        select count(*)::int as count
          from drm.users u
         where lower(u.role) in ('sales executive','sales_executive','sales-executive','manager','admin')
      `;
      const [rows, totalRes] = await Promise.all([
        pool.query(perfSql, [month, year, pageSize, offset]),
        pool.query(countSql),
      ]);
      const total = totalRes.rows[0]?.count ?? 0;
      res.json({
        success: true,
        data: {
          performance: rows.rows.map((r) => ({
            userId: r.id,
            name: r.full_name,
            totalCustomers: Number(r.total_customers ?? 0),
            newCustomers: Number(r.new_customers ?? 0),
            activities: Number(r.activities ?? 0),
            meetings: Number(r.meetings ?? 0),
            revenue: Number(r.revenue ?? 0),
          })),
          meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        },
      });
    } catch (error) {
      console.error("Error fetching team performance:", error);
      res.status(500).json({ success: false, message: "Failed to fetch team performance" });
    }
  });

  // Activities list (paginated)
  app.get("/api/crm/activities", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10));
      const offset = (page - 1) * pageSize;
      const type = req.query.type as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;

      const params: any[] = [];
      let where = " where 1=1";
      if (type) {
        params.push(type);
        where += ` and method = $${params.length}`;
      }
      if (dateFrom) {
        params.push(dateFrom);
        where += ` and created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` and created_at <= $${params.length}`;
      }

      const listSql = `select id, user_id as "userId", customer_id as "customerId", method, duration_minutes as "durationMinutes", created_at as "createdAt"
                         from drm.activities
                         ${where}
                         order by created_at desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from drm.activities ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      res.json({
        success: true,
        data: {
          activities: list.rows,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ success: false, message: "Failed to fetch activities" });
    }
  });

  // Activities summary by type
  app.get("/api/manager/dashboard/activities/summary", async (req, res) => {
    try {
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
      const params: any[] = [];
      let where = " where 1=1";
      if (dateFrom) {
        params.push(dateFrom);
        where += ` and created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` and created_at <= $${params.length}`;
      }
      const rows = await pool.query(
        `select method, count(*)::int as count from drm.activities ${where} group by method`,
        params,
      );
      const byType: Record<string, number> = {};
      for (const r of rows.rows) {
        byType[r.method] = Number(r.count);
      }
      const total = Object.values(byType).reduce((a, b) => a + b, 0);
      res.json({ success: true, data: { byType, total } });
    } catch (error) {
      console.error("Error fetching activity summary:", error);
      res.status(500).json({ success: false, message: "Failed to fetch activity summary" });
    }
  });

  // Meetings
  app.get("/api/crm/meetings", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10));
      const offset = (page - 1) * pageSize;
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
      const params: any[] = [];
      let where = " where 1=1";
      if (dateFrom) {
        params.push(dateFrom);
        where += ` and date_time >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        where += ` and date_time <= $${params.length}`;
      }
      const listSql = `select id, user_id as "userId", customer_id as "customerId", purpose, date_time as "dateTime", created_at as "createdAt"
                         from drm.appointments
                         ${where}
                         order by date_time desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from drm.appointments ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      res.json({
        success: true,
        data: {
          meetings: list.rows,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (error) {
      console.error("Error fetching meetings:", error);
      res.status(500).json({ success: false, message: "Failed to fetch meetings" });
    }
  });

  // Queue sales
  app.get("/api/crm/queue-sales", async (req, res) => {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.max(1, parseInt(String(req.query.pageSize ?? "50"), 10));
      const offset = (page - 1) * pageSize;
      const status = String(req.query.status ?? "Waiting");
      const listSql = `select id, customer_id as "customerId", sales_person_id as "salesPersonId", priority, status, queue_number as "queueNumber", estimated_time as "estimatedTime", notes, assigned_at as "assignedAt", completed_at as "completedAt"
                         from drm.queue_sales_entries
                        where status = $1
                        order by assigned_at desc nulls last
                        limit $2 offset $3`;
      const countSql = `select count(*)::int as count from drm.queue_sales_entries where status = $1`;
      const [list, count] = await Promise.all([pool.query(listSql, [status, pageSize, offset]), pool.query(countSql, [status])]);
      const total = count.rows[0]?.count ?? 0;
      res.json({
        success: true,
        data: {
          queue: list.rows,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    } catch (error) {
      console.error("Error fetching queue sales:", error);
      res.status(500).json({ success: false, message: "Failed to fetch queue sales" });
    }
  });
  app.get("/api/manager/dashboard/kpis", async (req, res) => {
    try {
      const dateFrom = (req.query.dateFrom as string) ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = (req.query.dateTo as string) ? new Date(String(req.query.dateTo)) : null;
      const params: any[] = [];
      let dateFilter = "";
      if (dateFrom) {
        params.push(dateFrom);
        dateFilter += ` and c.created_at >= $${params.length}`;
      }
      if (dateTo) {
        params.push(dateTo);
        dateFilter += ` and c.created_at <= $${params.length}`;
      }

      const [kpiRows, followupRows, teamRows, renewRows, expiredRows, gradeRows] = await Promise.all([
        pool.query(
          `select 
             count(*) filter (where c.is_deleted = false) as total_leads,
             count(*) filter (where c.is_deleted = false and c.status != 'Expire') as active_leads,
             count(*) filter (where c.is_deleted = false and (c.status = 'Renew' or coalesce(c.is_gold_member,0)=1)) as closed_leads
           from drm.customers c
           where c.is_deleted = false ${dateFilter}`,
          params,
        ),
        pool.query(
          `select count(*) as followups_today
             from drm.follow_ups f
            where coalesce(f.is_deleted,false)=false
              and date(f.due_at) = current_date`,
        ),
        pool.query(`select count(*) as team_members from drm.users where lower(role) in ('sales executive','sales_executive','sales-executive','manager','admin')`),
        pool.query(`select count(*) as renewals from drm.customers where status='Renew' and is_deleted=false`),
        pool.query(`select count(*) as expired from drm.customers where status='Expire' and is_deleted=false`),
        pool.query(
          `select grade, count(*)::int as count
             from drm.customers
            where is_deleted=false
            group by grade`,
        ),
      ]);

      const gradeDistribution: Record<string, number> = {};
      for (const g of gradeValues) gradeDistribution[g] = 0;
      for (const row of gradeRows.rows) {
        if (row.grade && gradeDistribution.hasOwnProperty(row.grade)) {
          gradeDistribution[row.grade] = Number(row.count);
        }
      }

      res.json({
        success: true,
        data: {
          totalLeads: Number(kpiRows.rows[0]?.total_leads ?? 0),
          activeLeads: Number(kpiRows.rows[0]?.active_leads ?? 0),
          closedLeads: Number(kpiRows.rows[0]?.closed_leads ?? 0),
          followupsToday: Number(followupRows.rows[0]?.followups_today ?? 0),
          teamMembers: Number(teamRows.rows[0]?.team_members ?? 0),
          renewals: Number(renewRows.rows[0]?.renewals ?? 0),
          expiredCustomers: Number(expiredRows.rows[0]?.expired ?? 0),
          gradeDistribution,
        },
      });
    } catch (error) {
      console.error("Error fetching manager KPIs:", error);
      res.status(500).json({ success: false, message: "Failed to fetch KPIs" });
    }
  });

  app.get("/api/manager/leads", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const search = req.query.search as string;
      const gradeFilter = req.query.grade as string;
      const statusFilter = req.query.status as string;
      const sortBy = req.query.sortBy as string || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const result = await customersRepository.findByUserId(req.user.userId, {
        page,
        pageSize,
        search,
        grade: gradeFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      }, req.user.roleId);

      const leads = result.customers.map(customer => ({
        id: customer.id,
        companyName: customer.companyName,
        accountName: customer.accountName,
        grade: customer.grade,
        status: customer.status,
        email: customer.email,
        mobile: customer.mobile || customer.phone,
        phone: customer.phone,
        lastFollowUpDate: customer.lastFollowUpDate,
        ownerUserId: customer.ownerUserId,
        createdAt: customer.createdAt,
      }));

      res.json({
        leads,
        total: result.total,
        page,
        pageSize,
        totalPages: Math.ceil(result.total / pageSize),
      });
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/manager/followup", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const dueAt = req.body.nextFollowUpDate ? new Date(req.body.nextFollowUpDate) : new Date();
      const validatedData = insertFollowUpSchema.parse({
        customerId: req.body.customerId,
        assignedTo: req.user.userId,
        createdBy: req.user.userId,
        dueAt,
        status: req.body.status ?? "Open",
        notes: req.body.note ?? req.body.notes ?? req.body.purpose,
        method: req.body.method,
        dateTime: req.body.dateTime ? new Date(req.body.dateTime) : dueAt,
      });

      const followUp = await followUpsRepository.create(validatedData);

      if (req.body.gradeUpdate && req.body.customerId) {
        await customersRepository.updateGrade(req.body.customerId, req.body.gradeUpdate);
      }

      res.status(201).json(followUp);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating follow-up:", error);
      res.status(500).json({ error: "Failed to create follow-up" });
    }
  });

  app.patch("/api/manager/lead/:id/grade", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { grade } = req.body;
      if (!grade || !gradeValues.includes(grade)) {
        return res.status(400).json({ error: "Valid grade is required" });
      }

      const customer = await customersRepository.updateGrade(req.params.id, grade);
      if (!customer) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(customer);
    } catch (error) {
      console.error("Error updating lead grade:", error);
      res.status(500).json({ error: "Failed to update grade" });
    }
  });

  app.get("/api/manager/lead/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const customer = await customersRepository.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(customer);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.get("/api/manager/lead/:id/followups", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const followUps = await followUpsRepository.findByCustomerId(req.params.id);
      res.json(followUps);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch follow-ups" });
    }
  });
}
