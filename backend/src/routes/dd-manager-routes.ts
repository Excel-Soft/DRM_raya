import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool, db } from "../db";
import { projects, tasks, users, taskTimeLogs } from "@models/schema";
import { sql, eq, and, or, gte, lte } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";
import { getStatsPeriodRange } from "./pms-routes";

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
            const params: any[] = [userId, userId];
            let dateFilterSql = "";
            if (from) { params.push(from); dateFilterSql += ` AND p.created_at >= $${params.length}`; }
            if (to) { params.push(to); dateFilterSql += ` AND p.created_at <= $${params.length}`; }

            const statsResult = await pool.query(`
                SELECT
                    COUNT(DISTINCT p.id)::int as "totalProjects",
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'ToDo' OR t.status = 'Blocked')::int as "verificationTasks",
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'InProgress')::int as "assignProjects",
                    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'Completed')::int as "completedProjects"
                FROM drm.projects p
                LEFT JOIN drm.tasks t ON t.project_id::text = p.id::text
                LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
                WHERE (p.owner_user_id::text = $1::text
                   OR p.created_by::text = $2::text
                   OR (wf.current_phase = 'DATA_VERIFY' AND (p.name ILIKE '%mini%' OR p.name ILIKE '%listing%' OR p.name ILIKE '%product%')))
                   ${dateFilterSql}
            `, params);


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
                WHERE (p.name ILIKE '%mini%' OR p.name ILIKE '%listing%' OR p.name ILIKE '%product%'
                       OR inv.project_name ILIKE '%mini%' OR inv.project_name ILIKE '%listing%')
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
            const ddTeamRoles = new Set(["dd_executive", "posting_executive", "product_posting_executive"]);
            const pendingLeaves = leaveRowsResult.rows.filter((r: any) => ddTeamRoles.has(normalizeRole(r.role_id || r.role))).length;

            const totalProjects = stats?.totalProjects || 0;
            const assignProject = stats?.assignProjects || 0;
            const completedProjects = stats?.completedProjects || 0;

            res.json({
                totalProjects,
                verification: stats?.verificationTasks || 0,
                assignProject,
                completedProjects,
                // Available/idle capacity: same formula as the HOD dashboard's real
                // "free" stat (Math.max(0, total - inProgress - completed)).
                free: Math.max(0, totalProjects - assignProject - completedProjects),
                delayProjects: phaseCounts?.delayProjects || 0,
                qaVerification: phaseCounts?.qaVerification || 0,
                depVerification: phaseCounts?.depVerification || 0,
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

            const countsResult = await pool.query(`
                SELECT
                    count(*)::int as "totalProjects",
                    count(*) FILTER (WHERE p.status = 'Completed')::int as complete,
                    count(*) FILTER (WHERE p.status = 'Active')::int as pending,
                    count(*) FILTER (WHERE p.status = 'OnHold')::int as "onHold",
                    COALESCE(SUM(inv.amount), 0)::numeric as "totalValue"
                FROM drm.projects p
                LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                WHERE p.owner_user_id::text = $1::text OR p.created_by::text = $2::text
            `, [userId, userId]);
            const counts = countsResult.rows[0];

            res.json({
                total: counts?.totalProjects || 0,
                complete: counts?.complete || 0,
                pending: counts?.pending || 0,
                free: counts?.onHold || 0,
                // Real sum of linked invoice amounts for this manager's projects
                // (was previously a hardcoded mock value).
                totalValue: Number(counts?.totalValue) || 0,
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

            const userPerformanceResult = await pool.query(`
                SELECT 
                    u.id::text,
                    u.full_name as name,
                    u.role,
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'Completed' AND t.updated_at >= $1)::int as "completedTasks",
                    COALESCE(SUM(ttl.duration_minutes) FILTER (WHERE ttl.created_at >= $2), 0)::int as "totalTimeMinutes"
                FROM drm.users u
                LEFT JOIN drm.tasks t ON t.assigned_to_user_id::text = u.id::text
                LEFT JOIN drm.task_time_logs ttl ON ttl.user_id::text = u.id::text
                WHERE LOWER(u.role_id) LIKE '%designer%'
                   OR LOWER(u.role_id) LIKE '%developer%'
                   OR LOWER(u.role_id) LIKE '%manager%'
                GROUP BY u.id, u.full_name, u.role
            `, [today, today]);
            const userPerformance = userPerformanceResult.rows;

            res.json(userPerformance.map(u => ({
                name: u.name || "Unknown",
                method: u.role || "Developer",
                methodColor: "bg-[#42a376]",
                target: `90 (${u.completedTasks})`,
                targetVal: u.completedTasks.toString(),
                time: Math.round((u.totalTimeMinutes || 0) / 60).toString(),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || "U")}&background=random`
            })));
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
                WHERE p.owner_user_id::text = $1::text OR p.created_by::text = $2::text
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
                    p.project_number as "projectNumber",
                    t.status,
                    t.updated_at as "updatedAt",
                    'TASK' as "itemType"
                FROM drm.tasks t
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                WHERE ${statusSql}
                  AND (t.owner_user_id::text = $1::text OR t.assigned_to_user_id::text = $2::text OR t.created_by::text = $3::text)
                LIMIT 50
            `, [userId, userId, userId]);

            let combinedList = listResult.rows.map(t => ({
                id: t.id,
                projectNumber: t.projectNumber,
                company: t.projectName || "Unknown Project",
                project: t.title,
                status: t.status,
                time: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "-",
                itemType: 'TASK'
            }));

            // Special Case: For D&D Manager include Product Posting projects
            if (statusType === "waiting" || statusType === "approved" || statusType === "delay") {
                // waiting: DATA_VERIFY (not yet started) OR RUNNING_PROJECT (executive
                // has submitted and it's awaiting manager review) OR PENDING_PROJECT
                // with a fresh re-uploaded doc.
                const phaseFilter = statusType === "waiting"
                    ? ["DATA_VERIFY", "RUNNING_PROJECT"]
                    : statusType === "delay"
                    ? ["RETURNED_FOR_CHANGE"]
                    : ["PROJECT_OVERVIEW"];
                
                const ppResult = await pool.query(`
                    SELECT 
                        wf.project_id as id,
                        p.project_number as "projectNumber",
                        p.name as "projectName",
                        COALESCE(NULLIF(CASE WHEN p.name LIKE '%•%' THEN NULL ELSE p.name END, ''), inv.project_name, p.name) as "invoiceProject",
                        COALESCE(c.company_name, inv.company_name, p.name) as "company",
                        wf.current_phase as status,
                        wf.updated_at as "updatedAt",
                        (SELECT id FROM drm.project_documents WHERE project_id = wf.project_id AND status IN ('PENDING', 'APPROVED') ORDER BY created_at DESC LIMIT 1) as "docId",
                        (SELECT created_at FROM drm.project_documents WHERE project_id = wf.project_id AND status IN ('PENDING', 'APPROVED') ORDER BY created_at DESC LIMIT 1) as "docCreatedAt"
                    FROM drm.product_posting_workflows wf
                    INNER JOIN drm.projects p ON p.id = wf.project_id
                    LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                    LEFT JOIN drm.customers c ON c.id = COALESCE(p.customer_id, inv.customer_id)
                    WHERE (
                        wf.current_phase = ANY($1::text[])
                        OR (
                            $2::text = 'waiting'
                            AND wf.current_phase = 'PENDING_PROJECT'
                            AND EXISTS (
                                SELECT 1 FROM drm.project_documents pd
                                WHERE pd.project_id = wf.project_id
                                  AND pd.status = 'PENDING'
                                  AND pd.created_at >= now() - interval '7 days'
                            )
                        )
                    )
                      AND (p.name ILIKE '%listing%' OR p.name ILIKE '%minisite%' OR inv.project_name ILIKE '%listing%' OR inv.project_name ILIKE '%minisite%')
                    ORDER BY wf.updated_at DESC
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
