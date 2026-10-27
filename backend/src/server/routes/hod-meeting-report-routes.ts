/**
 * HOD "Follow-Up Meeting Report" — rebuild of a legacy PHP report
 * (sale_meeting_report.php) that ran against a different MySQL system
 * (webxl_hod_meeting, webxl_user with numeric roleId 2/25/48). Real
 * implementation against the current drm.* schema:
 *
 *  - The legacy "meeting" concept (start/end time, manager who logged it,
 *    type, detail, department/HOD comment) maps directly onto the
 *    already-live drm.meetings table (used elsewhere for "Team Meeting"
 *    start/stop tracking — see DashboardController.startTeamMeeting /
 *    endTeamMeeting). user_id = the person the meeting is about, created_by
 *    = the manager who logged it, total_duration_seconds/start_time/
 *    end_time back Duration/Start/End directly.
 *
 *  - "Dep.Comment" and "HOD Comment" didn't exist on drm.meetings — added
 *    dept_comment/hod_comment below, following the same
 *    `alter table ... add column if not exists` convention used in
 *    hod-follow-up-report-routes.ts. The legacy PHP only ever showed the
 *    Dep.Comment "add" icon for one hardcoded legacy account (role===2 &&
 *    userId===54427) — not a reproducible real-world rule, so here the
 *    add-comment actions are simply available to whoever can reach this HOD
 *    report.
 *
 *  - The Activities section (Sales-Manager -> agent hierarchy, per-method
 *    breakdown, A-/B+ counts) reuses computeActivityRows() — the exact same
 *    aggregation DashboardController.getActivities uses for the dashboard
 *    widget and the Sale & Service Report's Daily Activities section — but
 *    scoped to Sales roles only (the legacy PHP's Activities section only
 *    ever iterates roleId=2/25, i.e. Sales Managers and their agents, never
 *    Service). On top of that it merges in per-person meeting minutes/
 *    comments from drm.meetings for the same date range, giving M-Time/
 *    M-Comment/Dept-Comment/HOD-Comment. The legacy TT-Time/D-Time split is
 *    PHP-specific derived math with no backing concept here — Spent is the
 *    same talk+appointment minutes computeActivityRows already totals, and
 *    Free = max(0, 480 - Spent) (8-hour day), matching the legacy formula.
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { ROLES } from "../../shared/roles";
import { computeActivityRows } from "../controllers/dashboard.controller";

const SALES_ROLES = [ROLES.SALES_MANAGER, ROLES.SALES_ASSISTANT_MANAGER, ROLES.SALES_EXECUTIVE];

let ensured = false;
async function ensureMeetingCommentColumns() {
  if (ensured) return;
  try {
    await pool.query(`alter table drm.meetings add column if not exists dept_comment text`);
    await pool.query(`alter table drm.meetings add column if not exists hod_comment text`);
  } catch (err) {
    console.error("Failed ensuring drm.meetings comment columns (continuing):", err);
  } finally {
    ensured = true;
  }
}

function parseDateRange(req: Request, res: Response): { from: string; to: string } | null {
  const startDate = String(req.query.startDate ?? "");
  const endDate = String(req.query.endDate ?? "");
  if (!startDate || !endDate) {
    res.status(400).json({ error: "BadRequest", message: "startDate and endDate are required (YYYY-MM-DD)" });
    return null;
  }
  if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate))) {
    res.status(400).json({ error: "BadRequest", message: "Invalid startDate or endDate" });
    return null;
  }
  return { from: startDate, to: endDate };
}

export function registerHodMeetingReportRoutes(app: Express) {
  // ─── Meetings table ─────────────────────────────────────────────────────

  app.get("/api/reports/hod-meeting/meetings", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureMeetingCommentColumns();
      const range = parseDateRange(req, res);
      if (!range) return;
      const search = req.query.search ? String(req.query.search).trim() : "";
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

      const conditions = ["m.start_time >= $1", "m.start_time < ($2::date + interval '1 day')"];
      const params: any[] = [range.from, range.to];
      if (search) {
        params.push(`%${search}%`);
        conditions.push(
          `(coalesce(su.full_name, su.name, su.username, m.person_name) ILIKE $${params.length} OR coalesce(mu.full_name, mu.name, mu.username) ILIKE $${params.length} OR m.meeting_type ILIKE $${params.length} OR m.notes ILIKE $${params.length})`,
        );
      }
      const where = conditions.join(" and ");

      const countRes = await pool.query(
        `select count(*)::int as total
           from drm.meetings m
           left join drm.users su on su.id = m.user_id
           left join drm.users mu on mu.id = m.created_by
          where ${where}`,
        params,
      );
      const total = Number(countRes.rows[0]?.total ?? 0);

      params.push(limit, (page - 1) * limit);
      const dataRes = await pool.query(
        `select m.id, m.created_at, coalesce(su.full_name, su.name, su.username, m.person_name) as sale_person,
                coalesce(mu.full_name, mu.name, mu.username) as manager, m.meeting_type, m.notes,
                m.total_duration_seconds, m.start_time, m.end_time, m.status, m.dept_comment, m.hod_comment
           from drm.meetings m
           left join drm.users su on su.id = m.user_id
           left join drm.users mu on mu.id = m.created_by
          where ${where}
          order by m.start_time desc
          limit $${params.length - 1} offset $${params.length}`,
        params,
      );

      const rows = dataRes.rows.map((r, idx) => {
        const durationSeconds =
          r.total_duration_seconds != null
            ? Number(r.total_duration_seconds)
            : r.start_time && r.end_time
              ? Math.max(0, Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 1000))
              : null;
        return {
          no: (page - 1) * limit + idx + 1,
          id: r.id,
          createDate: r.created_at,
          salePerson: r.sale_person ?? "-",
          manager: r.manager ?? "-",
          type: r.meeting_type ?? "-",
          detail: r.notes ?? "-",
          durationSeconds,
          status: r.status === "ended" ? "Complete" : "In Progress",
          startsAt: r.start_time,
          endsAt: r.end_time,
          deptComment: r.dept_comment,
          hodComment: r.hod_comment,
        };
      });
      res.json({ rows, total, page, limit });
    } catch (error) {
      console.error("Error building hod meeting report data", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load the meeting report" });
    }
  });

  app.post("/api/reports/hod-meeting/:id/dept-comment", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureMeetingCommentColumns();
      const comment = String(req.body?.comment ?? "").trim();
      if (!comment) return res.status(400).json({ error: "BadRequest", message: "comment is required" });
      const result = await pool.query(
        `update drm.meetings set dept_comment = $2, updated_at = now() where id = $1 returning id, dept_comment`,
        [req.params.id, comment],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "NotFound", message: "Meeting not found" });
      res.json({ success: true, deptComment: result.rows[0].dept_comment });
    } catch (error) {
      console.error("Error saving dept comment (meeting)", error);
      res.status(500).json({ error: "InternalError", message: "Failed to save comment" });
    }
  });

  app.post("/api/reports/hod-meeting/:id/hod-comment", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureMeetingCommentColumns();
      const comment = String(req.body?.comment ?? "").trim();
      if (!comment) return res.status(400).json({ error: "BadRequest", message: "comment is required" });
      const result = await pool.query(
        `update drm.meetings set hod_comment = $2, updated_at = now() where id = $1 returning id, hod_comment`,
        [req.params.id, comment],
      );
      if (!result.rows[0]) return res.status(404).json({ error: "NotFound", message: "Meeting not found" });
      res.json({ success: true, hodComment: result.rows[0].hod_comment });
    } catch (error) {
      console.error("Error saving hod comment (meeting)", error);
      res.status(500).json({ error: "InternalError", message: "Failed to save comment" });
    }
  });

  // ─── Activities section (Sales Manager -> agent hierarchy) ─────────────

  app.get("/api/reports/hod-meeting/activities", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      await ensureMeetingCommentColumns();
      const range = parseDateRange(req, res);
      if (!range) return;

      req.query.from = range.from;
      req.query.to = range.to;
      const activityData = await computeActivityRows(req, SALES_ROLES);

      const userIds = activityData.rows.map((r: any) => r.userId).filter(Boolean);
      let meetingTotalsByUser: Record<string, { minutes: number; count: number }> = {};
      let latestMeetingByUser: Record<
        string,
        { id: string; notes: string | null; deptComment: string | null; hodComment: string | null }
      > = {};

      if (userIds.length > 0) {
        const totalsRes = await pool.query(
          `select user_id::text as user_id,
                  coalesce(sum(coalesce(total_duration_seconds,
                    extract(epoch from (coalesce(end_time, now()) - start_time)))), 0)::float as total_seconds,
                  count(*)::int as meeting_count
             from drm.meetings
            where start_time >= $1 and start_time < ($2::date + interval '1 day')
              and user_id = ANY($3::uuid[])
            group by user_id`,
          [range.from, range.to, userIds],
        );
        meetingTotalsByUser = totalsRes.rows.reduce((acc: any, row: any) => {
          acc[row.user_id] = { minutes: Math.round(Number(row.total_seconds) / 60), count: Number(row.meeting_count) };
          return acc;
        }, {});

        const latestRes = await pool.query(
          `select distinct on (user_id) user_id::text as user_id, id, notes, dept_comment, hod_comment
             from drm.meetings
            where start_time >= $1 and start_time < ($2::date + interval '1 day')
              and user_id = ANY($3::uuid[])
            order by user_id, start_time desc`,
          [range.from, range.to, userIds],
        );
        latestMeetingByUser = latestRes.rows.reduce((acc: any, row: any) => {
          acc[row.user_id] = {
            id: row.id,
            notes: row.notes ?? null,
            deptComment: row.dept_comment ?? null,
            hodComment: row.hod_comment ?? null,
          };
          return acc;
        }, {});
      }

      const rows = activityData.rows.map((r: any) => {
        const meeting = meetingTotalsByUser[r.userId] ?? { minutes: 0, count: 0 };
        const latest = latestMeetingByUser[r.userId] ?? null;
        const spentMinutes = r.totals.timeMinutes;
        const freeMinutes = Math.max(0, 480 - spentMinutes);
        return {
          ...r,
          meetingMinutes: meeting.minutes,
          meetingCount: meeting.count,
          spentMinutes,
          freeMinutes,
          latestMeetingId: latest?.id ?? null,
          mComment: latest?.notes ?? null,
          deptComment: latest?.deptComment ?? null,
          hodComment: latest?.hodComment ?? null,
        };
      });

      res.json({ ...activityData, rows });
    } catch (error) {
      console.error("Error building hod meeting activities", error);
      res.status(500).json({ error: "InternalError", message: "Failed to load activities" });
    }
  });
}
