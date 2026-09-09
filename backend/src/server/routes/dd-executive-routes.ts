import type { Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { pool } from "../db";

// Software Executive reuses these D&D Executive endpoints (same task-execution model),
// but must only ever see SOFTWARE-department projects, never D&D's — previously it was
// treated as an org-wide admin here, seeing every task regardless of department.
function resolveTaskFilter(user: any, userId: string, alias?: string) {
    const col = alias ? `${alias}.` : "";
    const roles = user?.roles || [];
    const isTrueAdmin = roles.includes("admin") || roles.includes("super_admin") || user?.roleId === "admin";
    const isSoftware = roles.includes("software_executive") || user?.roleId === "software_executive";
    if (isTrueAdmin) return { filterSql: "true", queryParams: [] as any[] };
    if (isSoftware) {
        return {
            filterSql: `${col}assigned_to_user_id::text = $1::text and ${col}project_id in (select id from drm.projects where department_type = 'SOFTWARE')`,
            queryParams: [userId] as any[],
        };
    }
    return { filterSql: `${col}assigned_to_user_id::text = $1::text`, queryParams: [userId] as any[] };
}

export function registerDdExecutiveRoutes(app: Express) {
    app.use("/api/dd-executive", authMiddleware);

    // 1. Summary Stats
    app.get("/api/dd-executive/summary", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const { filterSql, queryParams } = resolveTaskFilter(user, userId);

            // Period filter: TD/LD=Today, WK=Week, MH=Month, QU=Quarter.
            // The Top Selling dropdown's "Today" option is labeled "LD"
            // client-side — without this alias it matched no branch below,
            // silently applying no date filter at all (i.e. an all-time
            // total instead of today's).
            const period = (req.query.period as string) || "MH";
            let periodSql = "";
            if (period === "TD" || period === "LD") periodSql = "AND created_at >= CURRENT_DATE";
            else if (period === "WK") periodSql = "AND created_at >= date_trunc('week', CURRENT_DATE)";
            else if (period === "MH") periodSql = "AND created_at >= date_trunc('month', CURRENT_DATE)";
            else if (period === "QU") periodSql = "AND created_at >= date_trunc('quarter', CURRENT_DATE)";

            // Fetch Task counts with period filter
            const tasksResult = await pool.query(`
                SELECT 
                    COUNT(*)::int as "totalTasks",
                    COUNT(*) FILTER (WHERE status IN ('ToDo', 'Blocked'))::int as "pendingTasks",
                    COUNT(*) FILTER (WHERE status = 'InProgress')::int as "runningTasks",
                    COUNT(*) FILTER (WHERE status = 'Completed')::int as "completeTasks",
                    COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'Completed')::int as "overTimeTasks"
                FROM drm.tasks
                WHERE ${filterSql} ${periodSql}
            `, queryParams);

            // Fetch running projects count
            const projectsResult = await pool.query(`
                SELECT COUNT(DISTINCT project_id)::int as "runningProjects"
                FROM drm.tasks
                WHERE ${filterSql} AND status = 'InProgress' ${periodSql}
            `, queryParams);

            // Fetch Leave count (Pending)
            const leavesResult = await pool.query(`
                SELECT COUNT(*)::int as "pendingLeaves"
                FROM drm.leave_requests
                WHERE user_id::text = $1::text AND status = 'Pending'
            `, [userId]);

            // Fetch Attendance (Today's status)
            const attendanceResult = await pool.query(`
                SELECT status, check_in as "timeIn"
                FROM drm.attendance
                WHERE user_id::text = $1::text AND date::date = CURRENT_DATE
                LIMIT 1
            `, [userId]);

            // Fetch Portfolio counts (Real Data)
            const portfolioResult = await pool.query(`
                SELECT
                    COUNT(*)::int as "totalPortfolio",
                    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int as "addedToday"
                FROM drm.customers
                WHERE owner_user_id::text = $1::text
            `, [userId]);

            // Fetch unread notice count (Real Data)
            const noticeResult = await pool.query(`
                SELECT COUNT(*)::int as "unreadNotices"
                FROM drm.notice_assignments
                WHERE user_id::text = $1::text AND read_status = 'unread'
            `, [userId]);

            const taskStats = tasksResult.rows[0];
            const runningProjects = projectsResult.rows[0]?.runningProjects || 0;
            const pendingLeaves = leavesResult.rows[0]?.pendingLeaves || 0;
            const attendance = attendanceResult.rows[0];
            const portfolio = portfolioResult.rows[0];
            const notice = noticeResult.rows[0];

            res.json({
                totalTasks: taskStats?.totalTasks || 0,
                pendingTasks: taskStats?.pendingTasks || 0,
                runningTasks: taskStats?.runningTasks || 0,
                completeTasks: taskStats?.completeTasks || 0,
                overTimeTasks: taskStats?.overTimeTasks || 0,
                runningProjects: runningProjects,
                pendingLeaves: pendingLeaves,
                attendanceStatus: attendance?.status || "Not Marked",
                important: {
                    notice: notice?.unreadNotices || 0,
                    portfolio: `${portfolio?.totalPortfolio || 0}(${(portfolio?.totalPortfolio || 0) * 200})`, 
                    addPortfolio: portfolio?.addedToday || 0,
                    loginTime: attendance?.timeIn ? new Date(attendance.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Not Marked"
                }
            });
        } catch (error) {
            console.error("Error fetching D&D Executive summary:", error);
            res.status(500).json({ error: "Failed to fetch summary" });
        }
    });

    // 2. Task Status Lists (Today, Waiting)
    app.get("/api/dd-executive/tasks/:statusType", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const { statusType } = req.params;
            const { filterSql, queryParams } = resolveTaskFilter(user, userId, "t");
            let statusSql = filterSql;

            if (statusType === "today") {
                statusSql += " AND t.updated_at >= CURRENT_DATE";
            } else if (statusType === "waiting") {
                statusSql += " AND t.status IN ('ToDo', 'Blocked')";
            }

            const listResult = await pool.query(`
                SELECT
                    t.id,
                    t.project_id as "projectId",
                    t.title as "taskTitle",
                    t.description,
                    t.due_date as "dueDate",
                    p.name as "projectName",
                    COALESCE(c.company_name, inv.company_name, 'No Company') as "companyName",
                    t.status,
                    t.priority,
                    t.created_at as "createdAt",
                    t.updated_at as "updatedAt"
                FROM drm.tasks t
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                LEFT JOIN drm.customers c ON c.id::text = p.customer_id::text
                LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
                WHERE ${statusSql}
                  AND (inv.id IS NULL OR inv.status = 'APPROVED')
                ORDER BY t.updated_at DESC
                LIMIT 50
            `, queryParams);
            
            res.json(listResult.rows.map((row) => ({
                id: row.id,
                projectId: row.projectId,
                company: row.companyName || "No Company",
                project: row.projectName || "No Project",
                task: row.taskTitle,
                description: row.description || "",
                dueDate: row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-",
                status: row.status,
                priority: row.priority || "Medium",
                assignedDate: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-",
                time: row.updatedAt ? new Date(row.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"
            })));
        } catch (error) {
            console.error("Error fetching tasks for Executive:", error);
            res.status(500).json({ error: "Failed to fetch tasks" });
        }
    });

    // 3. Daily Report (Recent activity)
    app.get("/api/dd-executive/daily-report", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const { filterSql, queryParams } = resolveTaskFilter(user, userId, "t");

            const period = (req.query.period as string) || "daily";
            let periodSql = "";
            if (period === "daily") periodSql = "AND t.updated_at >= CURRENT_DATE";
            else if (period === "weekly") periodSql = "AND t.updated_at >= date_trunc('week', CURRENT_DATE)";
            else if (period === "monthly") periodSql = "AND t.updated_at >= date_trunc('month', CURRENT_DATE)";

            const reportResult = await pool.query(`
                SELECT
                    u.name as "userName",
                    u.email as "userEmail",
                    c.company_name as "companyName",
                    p.name as "projectName",
                    t.status,
                    t.updated_at as "updatedAt",
                    COALESCE((SELECT SUM(duration_minutes) FROM drm.task_time_logs WHERE task_id = t.id), 0)::int as "spentMinutes"
                FROM drm.tasks t
                LEFT JOIN drm.users u ON u.id::text = t.assigned_to_user_id::text
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                LEFT JOIN drm.customers c ON c.id::text = p.customer_id::text
                WHERE ${filterSql} ${periodSql}
                ORDER BY t.updated_at DESC
                LIMIT 20
            `, queryParams);

            res.json(reportResult.rows.map(row => ({
                name: row.userName?.charAt(0).toLowerCase() || "u",
                company: row.companyName || "Unknown",
                project: row.projectName || "-",
                status: row.status,
                spent: `${row.spentMinutes || 0} mins`
            })));
        } catch (error) {
            console.error("Error fetching daily report:", error);
            res.status(500).json({ error: "Failed to fetch daily report" });
        }
    });

    // 4. Monthly Complete Project
    app.get("/api/dd-executive/monthly-complete", async (req, res) => {
        try {
            const user = (req as any).user;
            const userId = user?.userId || user?.id;
            if (!userId) return res.status(401).json({ error: "User context not found" });

            const { filterSql, queryParams } = resolveTaskFilter(user, userId, "t");

            const period = (req.query.period as string) || "WK";
            let periodStartSql = "date_trunc('month', CURRENT_DATE)";
            if (period === "TD") periodStartSql = "CURRENT_DATE";
            else if (period === "WK") periodStartSql = "date_trunc('week', CURRENT_DATE)";
            else if (period === "MH" || period === "MO") periodStartSql = "date_trunc('month', CURRENT_DATE)";
            else if (period === "QU") periodStartSql = "date_trunc('quarter', CURRENT_DATE)";

            const result = await pool.query(`
                SELECT
                    u.name as "userName",
                    c.company_name as "companyName",
                    p.name as "projectName",
                    t.status,
                    t.updated_at as "updatedAt",
                    COALESCE((SELECT SUM(duration_minutes) FROM drm.task_time_logs WHERE task_id = t.id), 0)::int as "spentMinutes"
                FROM drm.tasks t
                LEFT JOIN drm.users u ON u.id::text = t.assigned_to_user_id::text
                LEFT JOIN drm.projects p ON p.id::text = t.project_id::text
                LEFT JOIN drm.customers c ON c.id::text = p.customer_id::text
                WHERE ${filterSql}
                  AND t.status = 'Completed'
                  AND t.updated_at >= ${periodStartSql}
                ORDER BY t.updated_at DESC
            `, queryParams);

            res.json(result.rows.map(row => ({
                name: row.userName?.charAt(0).toLowerCase() || "u",
                company: row.companyName || "Unknown",
                project: row.projectName || "-",
                status: row.status,
                spent: `${row.spentMinutes || 0} mins`
            })));
        } catch (error) {
            console.error("Error fetching monthly complete:", error);
            res.status(500).json({ error: "Failed to fetch monthly complete" });
        }
    });
}
