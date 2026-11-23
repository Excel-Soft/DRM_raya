import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool, db } from "../db";
import { projects, tasks, users, taskTimeLogs } from "@shared/schema";
import { sql, eq, and, or, gte, lte } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";
import { getStatsPeriodRange } from "./pms-routes";
import { sqlDepartmentFamilyIn } from "@shared/project-department-variants";

const DND_DEPARTMENT_SQL = sqlDepartmentFamilyIn("p.department_type", "dnd");

const LEGACY_DD_DEP_FILTER = `
  trim(coalesce(qs.dep_id, '')) = '10'
`;

async function fetchDdLegacyStatusCounts(): Promise<{
  upcoming: number;
  inProgress: number;
  completed: number;
  delayProjects: number;
  qaVerification: number;
  depVerification: number;
}> {
  try {
    const { rows } = await pool.query(`
      WITH dd_pro AS (
        SELECT DISTINCT trim(cp.pro_id) AS pro_id
        FROM legacy_archive.webxl_create_project cp
        LEFT JOIN legacy_archive.webxl_quotation_services qs ON trim(qs.name) = trim(cp.project)
        WHERE cp.pro_id IS NOT NULL AND trim(cp.pro_id) <> ''
          AND ${LEGACY_DD_DEP_FILTER}
      ),
      latest_assign AS (
        SELECT DISTINCT ON (trim(a.pro_id))
          trim(a.pro_id) AS pro_id,
          lower(trim(coalesce(a.stauts, ''))) AS status,
          trim(coalesce(a.qa_date, '')) AS qa_date,
          trim(coalesce(a.fy_date, '')) AS fy_date,
          trim(coalesce(a.assign_date, '')) AS assign_date,
          trim(coalesce(a.fy_status, '')) AS fy_status
        FROM legacy_archive.webxl_task_assign a
        WHERE trim(a.pro_id) IN (SELECT pro_id FROM dd_pro)
        ORDER BY trim(a.pro_id),
          coalesce(
            NULLIF(trim(a.last_update), '')::timestamptz,
            NULLIF(trim(a.assign_date), '')::timestamptz,
            now()
          ) DESC
      )
      SELECT
        count(*) FILTER (
          WHERE status IN (
            '', 'todo', 'blocked', 'wait', 'waiting', 'assign', 'pending', 'panding', 'new', 'stop'
          )
        )::int AS upcoming,
        count(*) FILTER (
          WHERE status LIKE '%run%'
             OR status LIKE '%progress%'
             OR status IN ('inprogress', 'in progress', 'start', 'started', 'working')
        )::int AS in_progress,
        count(*) FILTER (
          WHERE status IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
        )::int AS completed,
        count(*) FILTER (
          WHERE status = 'task overdue'
             OR (
               coalesce(fy_status, '') <> '1'
               AND assign_date <> ''
               AND status NOT IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
             )
        )::int AS delay_projects,
        count(*) FILTER (
          WHERE assign_date <> ''
            AND qa_date = ''
            AND coalesce(fy_status, '') <> '1'
        )::int AS qa_verification,
        count(*) FILTER (
          WHERE qa_date <> ''
            AND fy_date = ''
            AND coalesce(fy_status, '') <> '1'
        )::int AS dep_verification
      FROM latest_assign
    `);
    const row = rows[0] || {};
    return {
      upcoming: Number(row.upcoming || 0),
      inProgress: Number(row.in_progress || 0),
      completed: Number(row.completed || 0),
      delayProjects: Number(row.delay_projects || 0),
      qaVerification: Number(row.qa_verification || 0),
      depVerification: Number(row.dep_verification || 0),
    };
  } catch (err) {
    console.error("D&D legacy status counts failed (non-fatal):", err);
    return {
      upcoming: 0,
      inProgress: 0,
      completed: 0,
      delayProjects: 0,
      qaVerification: 0,
      depVerification: 0,
    };
  }
}

const DD_EXEC_ROLE_SQL = `
  (
    lower(trim(coalesce(u.role, ''))) IN ('dd_executive', 'developer', 'designer')
    OR lower(trim(coalesce(u.role_id, ''))) IN ('dd_executive', 'developer', 'designer')
    OR trim(coalesce(u.role_id, '')) ~ '(^|,)41(,|$)'
    OR trim(coalesce(u.role_id, '')) ~ '(^|,)74(,|$)'
  )
`;

async function fetchDdLegacyActivityPeriodCounts(
  from?: Date,
  to?: Date,
): Promise<{ upcoming: number; inProgress: number; completed: number }> {
  if (!from || !to) return fetchDdLegacyStatusCounts();
  try {
    const { rows } = await pool.query(
      `
        WITH dd_pro AS (
          SELECT DISTINCT trim(cp.pro_id) AS pro_id
          FROM legacy_archive.webxl_create_project cp
          LEFT JOIN legacy_archive.webxl_quotation_services qs ON trim(qs.name) = trim(cp.project)
          WHERE cp.pro_id IS NOT NULL AND trim(cp.pro_id) <> ''
            AND ${LEGACY_DD_DEP_FILTER}
        )
        SELECT
          count(*) FILTER (
            WHERE lower(trim(coalesce(a.stauts, ''))) IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
          )::int AS completed,
          count(*) FILTER (
            WHERE lower(trim(coalesce(a.stauts, ''))) IN (
              '', 'todo', 'blocked', 'wait', 'waiting', 'assign', 'pending', 'panding', 'new', 'stop'
            )
          )::int AS upcoming,
          count(*) FILTER (
            WHERE lower(trim(coalesce(a.stauts, ''))) LIKE '%run%'
               OR lower(trim(coalesce(a.stauts, ''))) LIKE '%progress%'
               OR lower(trim(coalesce(a.stauts, ''))) IN ('inprogress', 'in progress', 'start', 'started', 'working')
          )::int AS in_progress
        FROM legacy_archive.webxl_task_assign a
        WHERE trim(a.pro_id) IN (SELECT pro_id FROM dd_pro)
          AND coalesce(
            NULLIF(trim(a.last_update), '')::timestamptz,
            NULLIF(trim(a.assign_date), '')::timestamptz
          ) BETWEEN $1 AND $2
      `,
      [from, to],
    );
    const row = rows[0] || {};
    return {
      upcoming: Number(row.upcoming || 0),
      inProgress: Number(row.in_progress || 0),
      completed: Number(row.completed || 0),
    };
  } catch (err) {
    console.error("D&D legacy activity period counts failed (non-fatal):", err);
    return { upcoming: 0, inProgress: 0, completed: 0 };
  }
}

export function registerDdManagerRoutes(app: Express) {
    app.use("/api/dd-manager", authMiddleware);

    // 1. Summary Stats
    app.get("/api/dd-manager/summary", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            // Optional `period` (TD/WC/MN/...) scopes the Management Hub cards to
            // projects created within that range, using the same convention as
            // /api/pms/stats (getStatsPeriodRange).
            const { from, to } = getStatsPeriodRange(req.query.period as string | undefined);
            const params: any[] = [];
            let dateFilterSql = "";
            if (from) {
              params.push(from);
              dateFilterSql += ` AND p.created_at >= $${params.length}`;
            }
            if (to) {
              params.push(to);
              dateFilterSql += ` AND p.created_at <= $${params.length}`;
            }

            const statsResult = await pool.query(
              `
                SELECT
                    COUNT(DISTINCT p.id)::int AS "totalProjects",
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE coalesce(t.is_deleted, false) = false
                        AND t.status IN ('ToDo', 'Blocked')
                    )::int AS "verificationTasks",
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE coalesce(t.is_deleted, false) = false
                        AND t.status = 'InProgress'
                    )::int AS "assignProjects",
                    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'Completed')::int AS "completedProjects",
                    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'OnHold')::int AS "onHoldProjects"
                FROM drm.projects p
                LEFT JOIN drm.tasks t ON t.project_id::text = p.id::text
                WHERE coalesce(p.is_deleted, false) = false
                  AND ${DND_DEPARTMENT_SQL}
                  ${dateFilterSql}
            `,
              params,
            );

            const legacy = await fetchDdLegacyStatusCounts();
            const stats = statsResult.rows[0];

            // Department-queue phase counts (Delay / QA Verification / Dep Verification).
            // Mirrors the same product-posting name filter used by the Project Queue tabs
            // below (waiting/delay/approved) rather than a per-owner scope, since these are
            // shared review queues a D&D Manager needs visibility into regardless of who
            // created the underlying project.
            const phaseCountsResult = await pool.query(`
                SELECT
                    COUNT(DISTINCT wf.project_id) FILTER (WHERE wf.current_phase = 'RETURNED_FOR_CHANGE')::int as "delayProjects",
                    COUNT(DISTINCT wf.project_id) FILTER (WHERE wf.current_phase = 'QA_REVIEW')::int as "qaVerification",
                    COUNT(DISTINCT wf.project_id) FILTER (WHERE wf.current_phase = 'VERIFICATION_PENDING')::int as "depVerification"
                FROM drm.product_posting_workflows wf
                INNER JOIN drm.projects p ON p.id = wf.project_id
                LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                WHERE ${DND_DEPARTMENT_SQL}
            `);
            const phaseCounts = phaseCountsResult.rows[0];

            // Pending leave requests for the D&D team (same role set used for task
            // assignment / executives elsewhere in this dashboard). Uses normalizeRole
            // the same way /api/users does, since role/role_id storage isn't normalized.
            const leaveRowsResult = await pool.query(`
                SELECT u.role_id, u.role
                FROM drm.leave_requests lr
                INNER JOIN drm.users u ON u.id::text = lr.user_id::text
                WHERE lr.status = 'Pending'
            `);
            const ddTeamRoles = new Set(["dd_executive", "dd_manager", "designer", "developer"]);
            const pendingLeaves = leaveRowsResult.rows.filter((r: any) => {
              const role = normalizeRole(r.role_id || r.role);
              return ddTeamRoles.has(role) || role.includes("dd_");
            }).length;

            const totalProjects = Number(stats?.totalProjects || 0);
            const assignProject =
              Number(stats?.assignProjects || 0) + legacy.inProgress;
            const completedProjects =
              Number(stats?.completedProjects || 0) + legacy.completed;
            const verification =
              Number(stats?.verificationTasks || 0) + legacy.upcoming;

            res.json({
                totalProjects,
                verification,
                assignProject,
                completedProjects,
                free: Math.max(0, totalProjects - assignProject - completedProjects),
                delayProjects:
                  Number(phaseCounts?.delayProjects || 0) +
                  Number(stats?.onHoldProjects || 0) +
                  legacy.delayProjects,
                qaVerification:
                  Number(phaseCounts?.qaVerification || 0) + legacy.qaVerification,
                depVerification:
                  Number(phaseCounts?.depVerification || 0) + legacy.depVerification,
                leaveApplication: pendingLeaves,
            });
        } catch (error) {
            console.error("Error fetching D&D Manager summary:", error);
            res.status(500).json({ error: "Failed to fetch summary" });
        }
    });

    // 2. Activities Summary (Donut Chart)
    app.get("/api/dd-manager/activities-summary", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const period = String(req.query.period || "MN").toUpperCase();
            const { from, to } = getStatsPeriodRange(period);

            let complete = 0;
            let pending = 0;
            let free = 0;
            let total = 0;
            let totalValue = 0;

            if (from && to) {
              const taskStats = await pool.query(
                `
                  SELECT
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE coalesce(t.updated_at, t.created_at) BETWEEN $1 AND $2
                    )::int AS touched,
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE t.status = 'Completed'
                        AND coalesce(t.updated_at, t.created_at) BETWEEN $1 AND $2
                    )::int AS complete,
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE t.status IN ('ToDo', 'Blocked')
                        AND coalesce(t.updated_at, t.created_at) BETWEEN $1 AND $2
                    )::int AS pending,
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE t.status = 'InProgress'
                        AND coalesce(t.updated_at, t.created_at) BETWEEN $1 AND $2
                    )::int AS running
                  FROM drm.tasks t
                  INNER JOIN drm.projects p ON p.id::text = t.project_id::text
                  WHERE coalesce(t.is_deleted, false) = false
                    AND coalesce(p.is_deleted, false) = false
                    AND ${DND_DEPARTMENT_SQL}
                `,
                [from, to],
              );
              const ts = taskStats.rows[0] || {};
              const legacy = await fetchDdLegacyActivityPeriodCounts(from, to);

              complete = Number(ts.complete || 0) + legacy.completed;
              pending =
                Number(ts.pending || 0) + Number(ts.running || 0) + legacy.upcoming + legacy.inProgress;
              total = Number(ts.touched || 0) + legacy.completed + legacy.upcoming + legacy.inProgress;
              free = Math.max(0, total - complete - pending);

              const valueRow = await pool.query(
                `
                  SELECT COALESCE(SUM(inv.amount), 0)::numeric AS "totalValue"
                  FROM drm.projects p
                  LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                  WHERE coalesce(p.is_deleted, false) = false
                    AND ${DND_DEPARTMENT_SQL}
                    AND p.status = 'Completed'
                    AND coalesce(p.updated_at, p.created_at) BETWEEN $1 AND $2
                `,
                [from, to],
              );
              totalValue = Number(valueRow.rows[0]?.totalValue || 0);
            } else {
              const countsResult = await pool.query(
                `
                  SELECT
                      count(*)::int AS "totalProjects",
                      count(*) FILTER (WHERE p.status = 'Completed')::int AS complete,
                      count(*) FILTER (WHERE p.status = 'Active')::int AS pending,
                      count(*) FILTER (WHERE p.status = 'OnHold')::int AS "onHold",
                      COALESCE(SUM(inv.amount), 0)::numeric AS "totalValue"
                  FROM drm.projects p
                  LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                  WHERE coalesce(p.is_deleted, false) = false
                    AND ${DND_DEPARTMENT_SQL}
              `,
              );
              const counts = countsResult.rows[0];
              const legacy = await fetchDdLegacyStatusCounts();
              complete = Number(counts?.complete || 0) + legacy.completed;
              pending =
                Number(counts?.pending || 0) + legacy.upcoming + legacy.inProgress;
              total = Number(counts?.totalProjects || 0);
              if (total < complete + pending) total = complete + pending;
              free = Number(counts?.onHold || 0) + Math.max(0, total - complete - pending);
              totalValue = Number(counts?.totalValue || 0);
            }

            res.json({
                total,
                complete,
                pending,
                free,
                totalValue,
                period,
            });
        } catch (error) {
            console.error("Error fetching D&D Manager activities summary:", error);
            res.status(500).json({ error: "Failed to fetch activities summary" });
        }
    });

    // 3. User Performance (Daily Activities List)
    app.get("/api/dd-manager/user-performance", async (req, res) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const userPerformanceResult = await pool.query(
              `
                WITH legacy_done AS (
                  SELECT mli.modern_id AS user_id, count(*)::int AS legacy_completed
                  FROM legacy_archive.webxl_task_assign a
                  INNER JOIN migration_meta.migration_legacy_ids mli
                    ON mli.modern_table = 'users' AND mli.legacy_id = trim(a.user_id)
                  INNER JOIN legacy_archive.webxl_create_project cp ON trim(cp.pro_id) = trim(a.pro_id)
                  LEFT JOIN legacy_archive.webxl_quotation_services qs ON trim(qs.name) = trim(cp.project)
                  WHERE trim(coalesce(qs.dep_id, '')) = '10'
                    AND lower(trim(coalesce(a.stauts, ''))) IN ('end', 'completed', 'done', 'finish', 'finished', 'closed')
                    AND coalesce(
                      NULLIF(trim(a.last_update), '')::timestamptz,
                      NULLIF(trim(a.assign_date), '')::timestamptz
                    ) >= $1
                  GROUP BY mli.modern_id
                )
                SELECT
                    u.id::text,
                    coalesce(nullif(trim(u.full_name), ''), nullif(trim(u.name), ''), u.username) AS name,
                    u.role,
                    COALESCE(tgt.target_total, 0)::int AS target_total,
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE t.status = 'Completed' AND t.updated_at >= $1
                        AND ${sqlDepartmentFamilyIn("p.department_type", "dnd")}
                    )::int AS "completedTasks",
                    COUNT(DISTINCT t.id) FILTER (
                      WHERE t.status = 'InProgress'
                        AND ${sqlDepartmentFamilyIn("p.department_type", "dnd")}
                    )::int AS "runningTasks",
                    COALESCE(ld.legacy_completed, 0)::int AS legacy_completed,
                    COALESCE(SUM(ttl.duration_minutes) FILTER (WHERE ttl.created_at >= $1), 0)::int AS "totalTimeMinutes",
                    (
                      SELECT t2.title
                      FROM drm.tasks t2
                      INNER JOIN drm.projects p2 ON p2.id::text = t2.project_id::text
                      WHERE t2.assigned_to_user_id::text = u.id::text
                        AND coalesce(t2.is_deleted, false) = false
                        AND ${sqlDepartmentFamilyIn("p2.department_type", "dnd")}
                      ORDER BY
                        CASE WHEN t2.status = 'InProgress' THEN 0 WHEN t2.status IN ('ToDo', 'Blocked') THEN 1 ELSE 2 END,
                        t2.updated_at DESC NULLS LAST
                      LIMIT 1
                    ) AS current_task
                FROM drm.users u
                LEFT JOIN drm.tasks t ON t.assigned_to_user_id::text = u.id::text
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                LEFT JOIN drm.task_time_logs ttl ON ttl.user_id::text = u.id::text
                LEFT JOIN legacy_done ld ON ld.user_id = u.id::text
                LEFT JOIN LATERAL (
                  SELECT COALESCE(SUM(ut.total), 0)::numeric AS target_total
                  FROM drm.target_system_user_targets ut
                  WHERE ut.user_id::text = u.id::text
                    AND CURRENT_DATE BETWEEN ut.start_date::date AND ut.end_date::date
                ) tgt ON true
                WHERE coalesce(u.is_active, true) = true
                  AND ${DD_EXEC_ROLE_SQL}
                GROUP BY u.id, u.full_name, u.name, u.username, u.role, tgt.target_total, ld.legacy_completed
                ORDER BY name NULLS LAST
              `,
              [today],
            );

            res.json(
              userPerformanceResult.rows.map((u) => {
                const done = Number(u.completedTasks || 0) + Number(u.legacy_completed || 0);
                const target = Number(u.target_total || 0);
                const taskLabel =
                  u.current_task ||
                  (Number(u.runningTasks) > 0 ? "In Progress" : done > 0 ? "Completed today" : "—");
                return {
                  name: u.name || "Unknown",
                  method: taskLabel,
                  methodColor:
                    Number(u.runningTasks) > 0
                      ? "bg-amber-500"
                      : done > 0
                        ? "bg-[#42a376]"
                        : "bg-slate-400",
                  target: target > 0 ? `${target} (${done})` : `0 (${done})`,
                  targetVal: String(done),
                  time: String(Math.round((u.totalTimeMinutes || 0) / 60)),
                  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "U")}&background=random`,
                };
              }),
            );
        } catch (error) {
            console.error("Error fetching D&D Manager user performance:", error);
            res.status(500).json({ error: "Failed to fetch user performance" });
        }
    });

    // 4. Projects List (Daily Report Table)
    app.get("/api/dd-manager/projects", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const listResult = await pool.query(`
                SELECT p.*, wf.assigned_duration_minutes, wf.current_phase,
                    COALESCE((
                        SELECT SUM(ttl.duration_minutes)
                        FROM drm.tasks t2
                        LEFT JOIN drm.task_time_logs ttl ON ttl.task_id::text = t2.id::text
                        WHERE t2.project_id::text = p.id::text
                    ), 0)::int as "spent_minutes"
                FROM drm.projects p
                LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
                WHERE (p.owner_user_id::text = $1::text OR p.created_by::text = $2::text)
                  AND ${DND_DEPARTMENT_SQL}
                ORDER BY p.created_at DESC
                LIMIT 20
            `, [userId, userId]);
            res.json(listResult.rows);
        } catch (error) {
            console.error("Error fetching D&D Manager projects:", error);
            res.status(500).json({ error: "Failed to fetch projects" });
        }
    });

    // 5. Task Status Lists (Waiting, Delay, Approved)
    app.get("/api/dd-manager/tasks/:statusType", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const { statusType } = req.params;
            let statusSql = "(t.status = 'ToDo' OR t.status = 'InProgress')";
            if (statusType === "delay") statusSql = "t.status = 'Blocked'";
            if (statusType === "approved") statusSql = "t.status = 'Completed'";

            const listResult = await pool.query(`
                SELECT 
                    t.id,
                    t.title,
                    p.name as "projectName",
                    (SELECT mli.legacy_id FROM migration_meta.migration_legacy_ids mli WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text LIMIT 1) as "projectNumber",
                    t.status,
                    t.updated_at as "updatedAt",
                    'TASK' as "itemType"
                FROM drm.tasks t
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                WHERE ${statusSql}
                  AND (t.owner_user_id::text = $1::text OR t.assigned_to_user_id::text = $2::text)
                  AND ${DND_DEPARTMENT_SQL}
                LIMIT 50
            `, [userId, userId]);

            let combinedList = listResult.rows.map(t => ({
                id: t.id,
                projectNumber: t.projectNumber,
                company: t.projectName || "Unknown Project",
                project: t.title,
                status: t.status,
                time: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "-",
                itemType: 'TASK'
            }));

            // D&D workflow queue (minisite / listing / design-dev): only projects
            // whose department_type is in the D&D family — not Alibaba Product Posting.
            if (statusType === "waiting" || statusType === "approved" || statusType === "delay") {
                // waiting: DATA_VERIFY (not yet started) OR RUNNING_PROJECT (executive
                // has submitted and it's awaiting manager review) OR PENDING_PROJECT
                // with a fresh re-uploaded doc.
                // Document approval (project-doc-routes.ts) writes
                // current_phase = 'VERIFICATION_COMPLETE', never
                // 'PROJECT_OVERVIEW' — so the "approved" tab needs both to
                // actually show anything (product-posting-dashboard.tsx
                // already treats these two phases as equivalent elsewhere).
                const phaseFilter = statusType === "waiting"
                    ? ["DATA_VERIFY", "RUNNING_PROJECT"]
                    : statusType === "delay"
                    ? ["RETURNED_FOR_CHANGE"]
                    : ["PROJECT_OVERVIEW", "VERIFICATION_COMPLETE"];
                
                const ppResult = await pool.query(`
                    SELECT
                        p.id as id,
                        (SELECT mli.legacy_id FROM migration_meta.migration_legacy_ids mli WHERE mli.modern_table = 'projects' AND mli.modern_id = p.id::text LIMIT 1) as "projectNumber",
                        p.name as "projectName",
                        COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), inv.project_name, p.name) as "invoiceProject",
                        COALESCE(c.company_name, inv.company_name, p.name) as "company",
                        wf.current_phase as status,
                        COALESCE(wf.updated_at, p.updated_at, p.created_at) as "updatedAt",
                        (SELECT id FROM drm.project_documents WHERE project_id = p.id AND status IN ('PENDING', 'APPROVED') ORDER BY created_at DESC LIMIT 1) as "docId",
                        (SELECT created_at FROM drm.project_documents WHERE project_id = p.id AND status IN ('PENDING', 'APPROVED') ORDER BY created_at DESC LIMIT 1) as "docCreatedAt"
                    FROM drm.projects p
                    -- LEFT JOIN, not INNER: a document upload that raced/failed partway
                    -- through creating this workflow row (the exact bug that made
                    -- #1043/#1044/#1047 invisible here despite being correctly routed
                    -- to D&D) must not make the project disappear from this queue.
                    -- The "waiting" OR-branch below treats a missing row the same as
                    -- PENDING_PROJECT so a real pending document always surfaces.
                    LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
                    LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                    LEFT JOIN drm.customers c ON c.id = COALESCE(p.customer_id, inv.customer_id)
                    WHERE (
                        wf.current_phase = ANY($1::text[])
                        OR (
                            $2::text = 'waiting'
                            AND (wf.current_phase = 'PENDING_PROJECT' OR wf.current_phase IS NULL)
                            AND EXISTS (
                                SELECT 1 FROM drm.project_documents pd
                                WHERE pd.project_id = p.id
                                  AND pd.status = 'PENDING'
                                  AND pd.created_at >= now() - interval '7 days'
                            )
                        )
                    )
                      -- The name-substring match below was written only for the
                      -- Product-Posting "Listing Page"/"Alibaba Minisite" flow and
                      -- silently excluded every other project actually routed to
                      -- D&D (p.department_type is the real, authoritative signal —
                      -- set by project-doc-routes.ts when documents are sent).
                      -- Kept as an OR fallback rather than removed, in case some
                      -- legacy row has department_type unset but matches by name.
                      AND ${DND_DEPARTMENT_SQL}
                    ORDER BY COALESCE(wf.updated_at, p.updated_at, p.created_at) DESC
                    LIMIT 50
                `, [phaseFilter, statusType]);


                const ppList = ppResult.rows.map(p => ({
                    id: p.id,
                    projectNumber: p.projectNumber,
                    company: p.company,
                    project: p.invoiceProject || p.projectName,
                    status: statusType === "approved" ? "Verified" : statusType === "delay" ? "Changing" : "Verification",
                    time: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "-",
                    itemType: 'PRODUCT_POSTING',
                    isVerifiable: statusType === "waiting" && (!!p.docId || ['Alibaba Minisite', 'Listing Page'].includes(p.invoiceProject)),
                    docId: p.docId,
                    docCreatedAt: p.docCreatedAt
                }));

                combinedList = statusType === "waiting" ? [...ppList, ...combinedList] : [...combinedList, ...ppList];
            }


            res.json(combinedList);
        } catch (error) {
            console.error("Error fetching tasks by status:", error);
            res.status(500).json({ error: "Failed to fetch tasks" });
        }
    });

    // 6. Current User Daily Report Summary
    app.get("/api/dd-manager/my-daily-report", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;

            if (!userId) {
                return res.status(401).json({ error: "User context not found" });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const countStatsResult = await pool.query(`
                SELECT
                    count(distinct t.project_id)::int as "totalProjects",
                    count(distinct t.id)::int as "totalTasks",
                    coalesce(sum(ttl.duration_minutes), 0)::int as "totalMinutes"
                FROM drm.tasks t
                LEFT JOIN drm.task_time_logs ttl ON ttl.task_id::text = t.id::text
                WHERE t.assigned_to_user_id::text = $1::text
                  AND t.updated_at >= $2
            `, [userId, today]);
            const countStats = countStatsResult.rows[0];

            // Real recorded login time from the Attendance module (same pattern as
            // /api/dd-executive/summary) instead of a hardcoded clock string.
            const attendanceResult = await pool.query(`
                SELECT status, check_in as "timeIn"
                FROM drm.attendance
                WHERE user_id::text = $1::text AND date::date = CURRENT_DATE
                LIMIT 1
            `, [userId]);
            const attendanceRow = attendanceResult.rows[0];
            const loginTime = attendanceRow?.timeIn
                ? new Date(attendanceRow.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : "Not Marked";

            const totalSpentMinutes = countStats?.totalMinutes || 0;
            // Free minutes today = time elapsed since actual check-in minus time
            // already logged against tasks. Zero (not fabricated) until the user
            // has checked in for the day.
            let totalFreeMinutes = 0;
            if (attendanceRow?.timeIn) {
                const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(attendanceRow.timeIn).getTime()) / 60000));
                totalFreeMinutes = Math.max(0, elapsedMinutes - totalSpentMinutes);
            }

            res.json({
                name: user.name || user.email || "User",
                loginTime,
                totalProjects: countStats?.totalProjects || 0,
                totalTasks: countStats?.totalTasks || 0,
                totalFreeMinutes,
                totalSpentMinutes,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "U")}&background=random`
            });
        } catch (error) {
            console.error("Error fetching my daily report:", error);
            res.status(500).json({ error: "Failed to fetch daily report" });
        }
    });
}
