import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool, db } from "../db";
import { projects, tasks, users, taskTimeLogs } from "@shared/schema";
import { sql, eq, and, or, gte, lte } from "drizzle-orm";
import { normalizeRole } from "../utils/role-utils";

export function registerDdManagerRoutes(app: Express) {
    app.use("/api/dd-manager", authMiddleware);

    // 1. Summary Stats
    app.get("/api/dd-manager/summary", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const statsResult = await pool.query(`
                SELECT 
                    COUNT(DISTINCT p.id)::int as "totalProjects",
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'ToDo' OR t.status = 'Blocked')::int as "verificationTasks",
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'InProgress')::int as "assignProjects",
                    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'Completed')::int as "completedProjects"
                FROM drm.projects p
                LEFT JOIN drm.tasks t ON t.project_id::text = p.id::text
                LEFT JOIN drm.product_posting_workflows wf ON wf.project_id = p.id
                WHERE p.owner_user_id::text = $1::text 
                   OR p.created_by::text = $2::text
                   OR (wf.current_phase = 'DATA_VERIFY' AND (p.name ILIKE '%mini%' OR p.name ILIKE '%listing%' OR p.name ILIKE '%product%'))
            `, [userId, userId]);


            const stats = statsResult.rows[0];

            const fs = await import("fs");
            const path = await import("path");
            const logMsg = `[${new Date().toISOString()}] User: ${userId}, API: summary\n`;
            fs.appendFileSync(path.join(process.cwd(), "debug_tasks.log"), logMsg);

            res.json({
                totalProjects: stats?.totalProjects || 0,
                verification: stats?.verificationTasks || 0,
                assignProject: stats?.assignProjects || 0,
                completedProjects: stats?.completedProjects || 0,
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
                    count(*) FILTER (WHERE status = 'Completed')::int as complete,
                    count(*) FILTER (WHERE status = 'Active')::int as pending,
                    count(*) FILTER (WHERE status = 'OnHold')::int as "onHold"
                FROM drm.projects
                WHERE owner_user_id::text = $1::text OR created_by::text = $2::text
            `, [userId, userId]);
            const counts = countsResult.rows[0];

            res.json({
                total: counts?.totalProjects || 0,
                complete: counts?.complete || 0,
                pending: counts?.pending || 0,
                free: counts?.onHold || 0,
                totalValue: 77872253, // Mock value as per requirement if not in DB
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
                SELECT p.*, wf.assigned_duration_minutes, wf.current_phase
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
                company: t.projectName || "Unknown Project",
                project: t.title,
                status: t.status,
                time: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "-",
                itemType: 'TASK'
            }));

            // Special Case: For D&D Manager include Product Posting projects
            if (statusType === "waiting" || statusType === "approved" || statusType === "delay") {
                // waiting: DATA_VERIFY phase OR PENDING_PROJECT with a fresh re-uploaded doc
                const phaseFilter = statusType === "waiting"
                    ? "DATA_VERIFY"
                    : statusType === "delay"
                    ? "RETURNED_FOR_CHANGE"
                    : "PROJECT_OVERVIEW";
                
                const ppResult = await pool.query(`
                    SELECT 
                        wf.project_id as id,
                        p.name as "projectName",
                        COALESCE(inv.project_name, p.name) as "invoiceProject",
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
                        wf.current_phase = $1
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

            res.json({
                name: user.name || user.email || "User",
                loginTime: "09:00 AM",
                totalProjects: countStats?.totalProjects || 0,
                totalTasks: countStats?.totalTasks || 0,
                totalFreeMinutes: 0,
                totalSpentMinutes: countStats?.totalMinutes || 0,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || "U")}&background=random`
            });
        } catch (error) {
            console.error("Error fetching my daily report:", error);
            res.status(500).json({ error: "Failed to fetch daily report" });
        }
    });
}
