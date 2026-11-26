// PMS Setting for department managers (old DRM pms-setting.php "List of Project Activity").
//
//   GET /api/pms/setting/activity   read-only
//
// Old rule: webxl_project_status rows with mag_verify = 1 whose project name (webxl_create_project.project)
// is one of the user's department's services (webxl_quotation_services.dep_id = the role's department).
// Department = the active role's department (Product Posting, D&D, SEO/SMM, Software, …).
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { departmentCandidatesForRole } from "@shared/project-department-variants";

export function registerPmsSettingActivityRoutes(app: Express) {
  app.get("/api/pms/setting/activity", async (req: Request, res: Response) => {
    try {
      const u = req.user as any;
      if (!u) return res.status(401).json({ error: "Not authenticated" });
      const role = String(u.roleId || u.role || "").toLowerCase();
      const dept = (await pool.query("SELECT department FROM drm.users WHERE id = $1", [u.userId])).rows[0]?.department || "";
      const candidates = departmentCandidatesForRole(role, dept).map((c) => String(c).trim().toLowerCase());
      if (candidates.length === 0) return res.json({ items: [] });

      const { rows } = await pool.query(
        `WITH dep AS (
           SELECT d._legacy_pk AS id FROM legacy_archive.webxl_department d
            WHERE d._source_table = 'webxl_department'
              AND (d._legacy_pk = ANY($1::text[]) OR lower(btrim(d.name)) = ANY($1::text[]))
         ),
         svc AS (
           SELECT DISTINCT lower(btrim(q.name)) AS n FROM legacy_archive.webxl_quotation_services q
            WHERE q._source_table = 'webxl_quotation_services' AND q.dep_id IN (SELECT id FROM dep)
              AND btrim(coalesce(q.name, '')) <> ''
         )
         SELECT s._legacy_pk AS id, s.pro_id AS "legacyProId", s.com_id AS "comId",
                coalesce(nullif(btrim(c.cname), ''), '-') AS company,
                coalesce(nullif(btrim(usr.name), ''), '-') AS person,
                btrim(p.project) AS project,
                coalesce(nullif(btrim(s.status), ''), '-') AS status,
                migration_meta.mig_ts(s.pro_update) AS "docUpload",
                migration_meta.mig_ts(s.vfy_date) AS "depApproved",
                pm.modern_id AS "projectId"
           FROM legacy_archive.webxl_project_status s
           JOIN legacy_archive.webxl_create_project p
             ON p._source_table = 'webxl_create_project' AND p.pro_id = s.pro_id
           LEFT JOIN legacy_archive.webxl_company c ON c._source_table = 'webxl_company' AND c._legacy_pk = s.com_id
           LEFT JOIN legacy_archive.webxl_user usr ON usr._source_table = 'webxl_user' AND usr._legacy_pk = btrim(p.user_id)
           LEFT JOIN migration_meta.migration_legacy_ids pm
             ON pm.entity_type = 'create_project_row' AND pm.legacy_table = 'webxl_create_project'
            AND pm.legacy_id = s.pro_id AND pm.modern_table = 'projects'
          WHERE s._source_table = 'webxl_project_status' AND btrim(s.mag_verify) = '1'
            AND lower(btrim(p.project)) IN (SELECT n FROM svc)
          ORDER BY nullif(regexp_replace(s.pro_id, '[^0-9]', '', 'g'), '')::bigint DESC NULLS LAST,
                   s._legacy_pk::bigint DESC`,
        [candidates],
      );
      res.json({ items: rows });
    } catch (error) {
      console.error("Error fetching PMS setting activity:", error);
      res.status(500).json({ error: "Failed to fetch project activity" });
    }
  });
}
