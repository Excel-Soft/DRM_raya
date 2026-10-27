/**
 * "Sale & Service Report" — rebuild of a legacy PHP admin report (not part of
 * this app's history; the user supplied the old PHP source as a spec). The
 * old page queried different tables entirely (MySQL `webxl_user` with numeric
 * role IDs) so this is a fresh implementation against the real drm.* schema,
 * reusing the same data sources the rest of this app already relies on for
 * targets (`target_system_user_targets` + `gm_entries`), grades
 * (`customers.grade`), and follow-up purpose (`followup_subservice_details`).
 *
 * Section 1 only ("Overall Performance report" — target/achieve/A-/prediction
 * per Sales or Service person). Section 2 ("Daily Activities") reuses the
 * already-existing GET /api/dashboard/activities. Section 3 ("Team Work
 * Performance") reuses the already-existing GET
 * /api/dashboard/team-work-performance (extended with a `scope` param).
 */
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { ROLES } from "../utils/role-utils";

const SALES_ROLES = [ROLES.SALES_MANAGER, ROLES.SALES_ASSISTANT_MANAGER, ROLES.SALES_EXECUTIVE];
const SERVICE_ROLES = [ROLES.SERVICE_MANAGER, ROLES.SERVICE_ASSISTANT_MANAGER, ROLES.SERVICE_EXECUTIVE];

function parseDateRange(req: Request, res: Response): { from: Date; to: Date } | null {
  const startDate = String(req.query.startDate ?? "");
  const endDate = String(req.query.endDate ?? "");
  if (!startDate || !endDate) {
    res.status(400).json({ error: "BadRequest", message: "startDate and endDate are required (YYYY-MM-DD)" });
    return null;
  }
  const from = new Date(startDate);
  const to = new Date(endDate);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    res.status(400).json({ error: "BadRequest", message: "Invalid startDate or endDate" });
    return null;
  }
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export function registerSaleServiceReportRoutes(app: Express) {
  // GET /api/reports/sale-service/performance — Section 1, "Overall
  // Performance report": one row per Sales or Service person with
  // target/achieved (from the same gm_entries + target_system_user_targets
  // pair /api/sales/targets/summary uses, generalized to every person in the
  // chosen department instead of just the caller), an "A-" grade count
  // (drm.customers.grade = 'A-'), and a "Prediction" count (follow-up
  // sub-service rows with purpose = AB_PAYMENT — the modern equivalent of the
  // legacy "Ab Payment" purpose_call).
  app.get("/api/reports/sale-service/performance", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const department = String(req.query.department ?? "");
      if (department !== "sales" && department !== "service") {
        return res.status(400).json({ error: "BadRequest", message: "department must be 'sales' or 'service'" });
      }
      const range = parseDateRange(req, res);
      if (!range) return;
      const office = req.query.office ? String(req.query.office) : undefined;
      const roles = department === "sales" ? SALES_ROLES : SERVICE_ROLES;

      const userParams: any[] = [roles];
      let officeClause = "";
      if (office) {
        officeClause = `and u.branch = $2`;
        userParams.push(office);
      }
      const usersRes = await pool.query(
        `select u.id::text as user_id, coalesce(u.full_name, u.name, u.username) as name, u.branch, u.role
           from drm.users u
          where u.role = ANY($1::text[]) ${officeClause}
          order by coalesce(u.full_name, u.name, u.username)`,
        userParams,
      );
      const users = usersRes.rows;
      if (users.length === 0) {
        return res.json({ rows: [], office: office ?? null, department });
      }
      const userIds = users.map((u) => u.user_id);

      const [achievedRes, targetRes, aMinusRes, predictionRes] = await Promise.all([
        pool.query(
          `select g.created_by::text as user_id, coalesce(sum(g.amount_usd),0)::numeric as achieved
             from drm.gm_entries g
            where coalesce(g.is_deleted,false) = false
              and (g.status = 'Approved' or g.approval_status = 'approved' or g.final_status = 'approved' or g.approval_status = 'approved_by_account')
              and g.created_at >= $1 and g.created_at <= $2
              and g.created_by = ANY($3::uuid[])
            group by g.created_by`,
          [range.from, range.to, userIds],
        ),
        pool.query(
          `select u.id::text as user_id,
                  coalesce(sum(
                    case
                      when tst.target::numeric > 0 and tst.price::numeric > 0 then tst.target::numeric * tst.price::numeric
                      when tst.total::numeric > 0 then tst.total::numeric
                      else coalesce(tst.target::numeric, 0)
                    end
                  ), 0)::numeric as target
             from drm.users u
             left join drm.target_system_user_targets tst
               on (tst.user_id = u.id::text or tst.user_id = coalesce(u.full_name, u.name, u.username) or tst.user_id = u.role)
              and (tst.start_date is null or tst.start_date <= $2)
              and (tst.end_date is null or tst.end_date >= $1)
            where u.id = ANY($3::uuid[])
            group by u.id`,
          [range.from, range.to, userIds],
        ),
        pool.query(
          `select coalesce(c.owner_user_id, c.created_by)::text as user_id, count(*)::int as a_minus
             from drm.customers c
            where c.grade = 'A-'
              and c.created_at >= $1 and c.created_at <= $2
              and coalesce(c.owner_user_id, c.created_by) = ANY($3::uuid[])
            group by coalesce(c.owner_user_id, c.created_by)`,
          [range.from, range.to, userIds],
        ),
        pool.query(
          `select f.assigned_to::text as user_id, count(*)::int as prediction
             from drm.followup_subservice_details fsd
             join drm.follow_ups f on f.id = fsd.followup_id
            where coalesce(fsd.created_at, f.created_at) >= $1 and coalesce(fsd.created_at, f.created_at) <= $2
              and upper(fsd.purpose) = 'AB_PAYMENT'
              and f.assigned_to = ANY($3::uuid[])
            group by f.assigned_to`,
          [range.from, range.to, userIds],
        ),
      ]);

      const achievedMap = new Map(achievedRes.rows.map((r) => [r.user_id, Number(r.achieved)]));
      const targetMap = new Map(targetRes.rows.map((r) => [r.user_id, Number(r.target)]));
      const aMinusMap = new Map(aMinusRes.rows.map((r) => [r.user_id, Number(r.a_minus)]));
      const predictionMap = new Map(predictionRes.rows.map((r) => [r.user_id, Number(r.prediction)]));

      const rows = users.map((u, idx) => {
        const target = targetMap.get(u.user_id) ?? 0;
        const achieved = achievedMap.get(u.user_id) ?? 0;
        return {
          no: idx + 1,
          userId: u.user_id,
          name: u.name,
          branch: u.branch,
          role: u.role,
          target,
          achieved,
          remain: Math.max(0, target - achieved),
          aMinus: aMinusMap.get(u.user_id) ?? 0,
          prediction: predictionMap.get(u.user_id) ?? 0,
        };
      });

      const totals = rows.reduce(
        (acc, r) => ({
          target: acc.target + r.target,
          achieved: acc.achieved + r.achieved,
          remain: acc.remain + r.remain,
          aMinus: acc.aMinus + r.aMinus,
          prediction: acc.prediction + r.prediction,
        }),
        { target: 0, achieved: 0, remain: 0, aMinus: 0, prediction: 0 },
      );

      res.json({ rows, totals, office: office ?? null, department });
    } catch (error) {
      console.error("Error building sale-service performance report", error);
      res.status(500).json({ error: "InternalError", message: "Failed to build performance report" });
    }
  });

  // GET /api/reports/sale-service/offices — distinct branches among Sales +
  // Service staff, to populate the office filter dropdown with real values
  // instead of a hardcoded list (the legacy page hardcoded "Lahore"/"Sialkot").
  app.get("/api/reports/sale-service/offices", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const result = await pool.query(
        `select distinct u.branch
           from drm.users u
          where u.role = ANY($1::text[]) and u.branch is not null and u.branch <> ''
          order by u.branch`,
        [[...SALES_ROLES, ...SERVICE_ROLES]],
      );
      res.json({ offices: result.rows.map((r) => r.branch) });
    } catch (error) {
      console.error("Error fetching sale-service offices", error);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch offices" });
    }
  });
}
