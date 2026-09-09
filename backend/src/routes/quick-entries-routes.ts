import type { Express, Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool } from "../db";
import { normalizeRole, isManagerialRole } from "../utils/role-utils";
import { safePage, safePageSize } from "../utils/sql-safety";

function shortLog(method: string, path: string, status: number, ms: number) {
  console.log(`[${new Date().toISOString()}] ${method} ${path} -> ${status} (${ms}ms)`);
}

function requireRoles(allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
    const role = normalizeRole(req.user.roleId);
    if (!allowed.includes(role) && !isManagerialRole(role)) {
      return res.status(403).json({ success: false, message: "Access denied: Manager/Admin required." });
    }
    next();
  };
}

export function registerQuickEntriesRoutes(app: Express) {
  app.use("/api", authMiddleware);

  // 1) Duplication Check
  app.get("/api/duplicates", requireRoles(["sales_executive", "manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;
      const company = (req.query.company as string) || "";
      const email = (req.query.email as string) || "";
      const phone = (req.query.phone as string) || "";
      const ntn = (req.query.ntn as string) || "";

      const params: any[] = [];
      let where = "where c.is_deleted = false";
      if (company) { params.push(`%${company}%`); where += ` and c.company_name ilike $${params.length}`; }
      if (email) { params.push(`%${email}%`); where += ` and cc.email ilike $${params.length}`; }
      if (phone) { params.push(`%${phone}%`); where += ` and cc.phone ilike $${params.length}`; }
      if (ntn) { params.push(`%${ntn}%`); where += ` and cc.ntn ilike $${params.length}`; }

      const listSql = `
        select c.id, c.drm_id as "drmId", c.company_name as "companyName", cc.email, cc.phone, cc.ntn, c.created_by as "ownerUserId"
          from drm.customers c
          left join customer_contacts cc on cc.customer_id = c.id and cc.is_primary = true
          ${where}
          order by c.created_at desc
          limit $${params.length + 1} offset $${params.length + 2}
      `;
      const countSql = `select count(*)::int as count from drm.customers c left join customer_contacts cc on cc.customer_id=c.id and cc.is_primary=true ${where}`;
      const [list, count] = await Promise.all([
        pool.query(listSql, [...params, pageSize, offset]),
        pool.query(countSql, params),
      ]);

      const duplicates = list.rows.map((row) => {
        let matchType = "company";
        if (email && row.email?.toLowerCase().includes(email.toLowerCase())) matchType = "email";
        else if (phone && row.phone?.includes(phone)) matchType = "phone";
        else if (ntn && row.ntn?.includes(ntn)) matchType = "ntn";
        return { ...row, matchType };
      });

      const payload = {
        success: true,
        data: { duplicates, count: duplicates.length, hasMatches: duplicates.length > 0 },
        meta: { page, pageSize },
      };
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json(payload);
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to check duplicates" });
    }
  });

  // 2) Leave Application (uses drm.leave_requests)
  app.post("/api/leaves", async (req, res) => {
    const start = Date.now();
    try {
      const { fromDate, toDate, reason } = req.body;
      if (!fromDate || !toDate) return res.status(400).json({ success: false, message: "fromDate and toDate required" });
      const result = await pool.query(
        `insert into drm.leave_requests (user_id, purpose, leave_type, alternative, from_date, to_date, description, status, created_at, updated_at)
         values ($1, $2, 'Paid', '', $3, $4, $5, 'Pending', now(), now())
         returning id`,
        [req.user!.userId, reason || "Leave", fromDate, toDate, reason || null],
      );
      shortLog(req.method, req.originalUrl, 201, Date.now() - start);
      return res.status(201).json({ success: true, data: { id: result.rows[0].id } });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to submit leave" });
    }
  });

  app.get("/api/leaves", async (req, res) => {
    const start = Date.now();
    try {
      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 20, 100);
      const status = (req.query.status as string) || "";
      const mine = String(req.query.mine ?? "true") === "true";
      const offset = (page - 1) * pageSize;

      const params: any[] = [];
      let where = " where 1=1";
      if (mine) {
        params.push(req.user!.userId);
        where += ` and lr.user_id = $${params.length}`;
      }
      if (status) {
        params.push(status);
        where += ` and lr.status = $${params.length}`;
      }

      const listSql = `select lr.id, lr.user_id as "userId", lr.from_date as "fromDate", lr.to_date as "toDate", lr.description as "description", lr.status, lr.approved_by_user_id as "approvedByUserId", lr.rejection_reason as "rejectionReason", lr.created_at as "createdAt"
                         from drm.leave_requests lr
                         ${where}
                         order by lr.created_at desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from drm.leave_requests lr ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      const payload = {
        success: true,
        data: list.rows,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      };
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json(payload);
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to fetch leaves" });
    }
  });

  app.patch("/api/leaves/:id/approve", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      await pool.query(
        `update drm.leave_requests set status='Approved', approved_by = $2, updated_at = now() where id = $1`,
        [req.params.id, req.user!.userId],
      );
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Approved" });
    } catch (error) {
      console.error("Error approving leave:", error);
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to approve" });
    }
  });

  app.patch("/api/leaves/:id/reject", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const reason = (req.body?.reason as string) ?? null;
      await pool.query(
        `update drm.leave_requests set status='Rejected', approved_by = $2, reason = coalesce($3, reason), updated_at = now() where id = $1`,
        [req.params.id, req.user!.userId, reason],
      );
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Rejected" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to reject" });
    }
  });

  // 3) Performance summary (basic)
  app.get("/api/performance/summary", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const dateFrom = req.query.dateFrom ? new Date(String(req.query.dateFrom)) : null;
      const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : null;
      const params: any[] = [];
      let custWhere = "where c.is_deleted=false";
      if (dateFrom) { params.push(dateFrom); custWhere += ` and c.created_at >= $${params.length}`; }
      if (dateTo) { params.push(dateTo); custWhere += ` and c.created_at <= $${params.length}`; }
      const oppSql = `select coalesce(sum(value),0)::float as revenue from opportunities where is_deleted=false`;
      const [custRows, oppRows, actRows, meetRows] = await Promise.all([
        pool.query(`select count(*)::int as total_customers from drm.customers c ${custWhere}`, params),
        pool.query(oppSql),
        pool.query(`select count(*)::int as activities from activities`),
        pool.query(`select count(*)::int as meetings from drm.appointments`),
      ]);
      const data = {
        totalCustomers: custRows.rows[0]?.total_customers ?? 0,
        revenue: oppRows.rows[0]?.revenue ?? 0,
        activities: actRows.rows[0]?.activities ?? 0,
        meetings: meetRows.rows[0]?.meetings ?? 0,
      };
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, data });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to fetch performance" });
    }
  });

  // 4) Overtime (uses drm.overtime_records)
  app.post("/api/overtime", async (req, res) => {
    const start = Date.now();
    try {
      const { date, minutes, reason } = req.body;
      if (!date || !minutes) return res.status(400).json({ success: false, message: "date and minutes required" });
      const result = await pool.query(
        `insert into drm.overtime_records (user_id, task_title, time_spent, task_details, date, status, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'Pending', now(), now())
         returning id`,
        [req.user!.userId, reason || "Overtime", minutes, reason || "Overtime", date],
      );
      shortLog(req.method, req.originalUrl, 201, Date.now() - start);
      return res.status(201).json({ success: true, data: { id: result.rows[0].id } });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to submit overtime" });
    }
  });

  app.get("/api/overtime", async (req, res) => {
    const start = Date.now();
    try {
      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 20, 100);
      const status = (req.query.status as string) || "";
      const mine = String(req.query.mine ?? "true") === "true";
      const offset = (page - 1) * pageSize;

      const params: any[] = [];
      let where = " where 1=1";
      if (mine) { params.push(req.user!.userId); where += ` and user_id = $${params.length}`; }
      if (status) { params.push(status); where += ` and status = $${params.length}`; }
      const listSql = `select id, user_id as "userId", task_title as "taskTitle", time_spent as "timeSpent", task_details as "taskDetails", date, status, reviewed_by_user_id as "reviewedByUserId", rejection_reason as "rejectionReason", created_at as "createdAt"
                         from drm.overtime_records
                         ${where}
                         order by created_at desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from drm.overtime_records ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      const payload = {
        success: true,
        data: list.rows,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      };
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json(payload);
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to fetch overtime" });
    }
  });

  app.patch("/api/overtime/:id/approve", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      await pool.query(
        `update drm.overtime_records set status='Approved', reviewed_by_user_id=$2, reviewed_at=now(), updated_at=now() where id=$1`,
        [req.params.id, req.user!.userId],
      );
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Approved" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to approve overtime" });
    }
  });

  app.patch("/api/overtime/:id/reject", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const reason = (req.body?.reason as string) ?? null;
      await pool.query(
        `update drm.overtime_records set status='Rejected', rejection_reason=$2, reviewed_by_user_id=$3, reviewed_at=now(), updated_at=now() where id=$1`,
        [req.params.id, reason, req.user!.userId],
      );
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Rejected" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to reject overtime" });
    }
  });

  // 5) My Tasks (reuse tasks table)
  app.post("/api/tasks", async (req, res) => {
    const start = Date.now();
    try {
      const { title, description, priority, dueDate } = req.body;
      if (!title) return res.status(400).json({ success: false, message: "title required" });
      const result = await pool.query(
        `insert into tasks (title, description, status, priority, due_at, created_by, assigned_to, created_at, updated_at)
         values ($1, $2, 'ToDo', coalesce($3,'Medium'), $4, $5, $5, now(), now())
         returning id`,
        [title, description ?? null, priority ?? null, dueDate ?? null, req.user!.userId],
      );
      shortLog(req.method, req.originalUrl, 201, Date.now() - start);
      return res.status(201).json({ success: true, data: { id: result.rows[0].id } });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to create task" });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    const start = Date.now();
    try {
      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 20, 100);
      const status = (req.query.status as string) || "";
      const offset = (page - 1) * pageSize;
      const isManager = isManagerialRole(req.user!.roleId);

      const params: any[] = [];
      let where = " where coalesce(t.is_deleted,false)=false";
      if (!isManager) { params.push(req.user!.userId); where += ` and t.assigned_to = $${params.length}`; }
      if (status) { params.push(status); where += ` and t.status = $${params.length}`; }

      const listSql = `select id, title, description, status, priority, due_at as "dueAt", created_at as "createdAt", updated_at as "updatedAt", assigned_to as "assignedTo"
                         from tasks t
                         ${where}
                         order by created_at desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from tasks t ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({
        success: true,
        data: list.rows,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to fetch tasks" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const start = Date.now();
    try {
      const isManager = isManagerialRole(req.user!.roleId);
      const params: any[] = [];
      let where = "where id = $1";
      params.push(req.params.id);
      if (!isManager) { params.push(req.user!.userId); where += ` and assigned_to = $${params.length}`; }
      const fields: string[] = [];
      if (req.body.title) { params.push(req.body.title); fields.push(`title = $${params.length}`); }
      if (req.body.description !== undefined) { params.push(req.body.description); fields.push(`description = $${params.length}`); }
      if (req.body.status) { params.push(req.body.status); fields.push(`status = $${params.length}`); }
      if (req.body.priority) { params.push(req.body.priority); fields.push(`priority = $${params.length}`); }
      if (req.body.dueDate) { params.push(req.body.dueDate); fields.push(`due_at = $${params.length}`); }
      if (!fields.length) return res.status(400).json({ success: false, message: "No fields to update" });
      params.push(new Date()); fields.push(`updated_at = $${params.length}`);
      const sql = `update tasks set ${fields.join(", ")} ${where} returning id`;
      const result = await pool.query(sql, params);
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Task not found" });
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Updated" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    const start = Date.now();
    try {
      const isManager = isManagerialRole(req.user!.roleId);
      const params: any[] = [req.params.id];
      let where = "where id = $1";
      if (!isManager) { params.push(req.user!.userId); where += ` and assigned_to = $${params.length}`; }
      const result = await pool.query(`update tasks set is_deleted = true, updated_at = now() ${where} returning id`, params);
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Task not found" });
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Deleted" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to delete task" });
    }
  });

  // 6) Team Targets (reuse targets table)
  app.get("/api/team-targets", requireRoles(["manager", "hod", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const page = safePage(req.query.page, 1);
      const pageSize = safePageSize(req.query.pageSize, 20, 100);
      const offset = (page - 1) * pageSize;
      const userId = req.query.userId as string | undefined;
      const periodType = (req.query.periodType as string) || "monthly";
      const periodKey = (req.query.periodKey as string) || "";
      const params: any[] = [];
      let where = " where 1=1";
      if (userId) { params.push(userId); where += ` and user_id = $${params.length}`; }
      if (periodType === "monthly" && periodKey.includes("-")) {
        const [y, m] = periodKey.split("-");
        params.push(Number(m)); where += ` and month = $${params.length}`;
        params.push(Number(y)); where += ` and year = $${params.length}`;
      }
      const listSql = `select id, user_id as "userId", month, year, ab_target as "abTarget", vas_target as "vasTarget"
                         from targets
                         ${where}
                         order by year desc, month desc
                         limit ${pageSize} offset ${offset}`;
      const countSql = `select count(*)::int as count from targets ${where}`;
      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({
        success: true,
        data: list.rows,
        meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to fetch team targets" });
    }
  });

  app.post("/api/team-targets", requireRoles(["manager", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const { userId, periodType, periodKey, targetAmount } = req.body;
      if (!userId || !periodKey || periodType !== "monthly") return res.status(400).json({ success: false, message: "userId, periodType=monthly, periodKey required" });
      const [yearStr, monthStr] = periodKey.split("-");
      const month = Number(monthStr);
      const year = Number(yearStr);
      await pool.query(
        `insert into targets (user_id, month, year, ab_target, vas_target, created_at, updated_at)
         values ($1, $2, $3, $4, 0, now(), now())`,
        [userId, month, year, targetAmount ?? 0],
      );
      shortLog(req.method, req.originalUrl, 201, Date.now() - start);
      return res.status(201).json({ success: true, message: "Target created" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to create target" });
    }
  });

  app.patch("/api/team-targets/:id", requireRoles(["manager", "admin"]), async (req, res) => {
    const start = Date.now();
    try {
      const fields: string[] = [];
      const params: any[] = [];
      if (req.body.targetAmount !== undefined) { params.push(req.body.targetAmount); fields.push(`ab_target = $${params.length}`); }
      if (req.body.achievedAmount !== undefined) { params.push(req.body.achievedAmount); fields.push(`vas_target = $${params.length}`); }
      if (!fields.length) return res.status(400).json({ success: false, message: "No fields to update" });
      params.push(new Date()); fields.push(`updated_at = $${params.length}`);
      params.push(req.params.id);
      const sql = `update targets set ${fields.join(", ")} where id = $${params.length} returning id`;
      const result = await pool.query(sql, params);
      if (!result.rows[0]) return res.status(404).json({ success: false, message: "Target not found" });
      shortLog(req.method, req.originalUrl, 200, Date.now() - start);
      return res.json({ success: true, message: "Updated" });
    } catch (error) {
      shortLog(req.method, req.originalUrl, 500, Date.now() - start);
      return res.status(500).json({ success: false, message: "Failed to update target" });
    }
  });
}


