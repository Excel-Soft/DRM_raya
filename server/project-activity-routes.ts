import { Router, type Express } from "express";
import { pool } from "./db";

function parsePagination(page?: string, pageSize?: string) {
  const pageNum = Math.max(1, Number(page) || 1);
  const sizeNum = Math.max(1, Math.min(100, Number(pageSize) || 10));
  return { page: pageNum, pageSize: sizeNum };
}

function mapProjectStatus(rawStatus?: string | null): "In Progress" | "Pending Review" | "Completed" {
  const normalized = (rawStatus || "").toLowerCase();
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("progress") || normalized === "active" || normalized === "in_progress") {
    return "In Progress";
  }
  return "Pending Review";
}

export function registerProjectActivityRoutes(app: Express) {
  const router = Router();

  router.get("/project-activity", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
      const search = ((req.query.search as string | undefined) || "").trim();
      const offset = (page - 1) * pageSize;

      const searchPattern = `%${search}%`;

      const query = `
        with base as (
          select
            p.id,
            p.name as project_name,
            coalesce(p.workspace, '') as workspace,
            p.status as project_status,
            p.created_at,
            p.updated_at,
            u.name as owner_name,
            exists(select 1 from tasks t where t.project_id = p.id) as has_tasks,
            (
              select pa.status
              from project_approvals pa
              where pa.project_id = p.id
              order by pa.created_at desc
              limit 1
            ) as dep_status
          from projects p
          left join users u on u.id = p.owner_user_id
          where ($1 = '' or p.name ilike $2 or coalesce(p.workspace, '') ilike $2 or coalesce(u.name, '') ilike $2)
        ),
        counted as (
          select count(*)::int as total from base
        )
        select b.*, c.total as total_rows
        from base b
        cross join counted c
        order by b.created_at desc
        limit $3 offset $4;
      `;

      const { rows } = await pool.query(query, [search, searchPattern, pageSize, offset]);

      const total = rows[0]?.total_rows ? Number(rows[0].total_rows) : 0;

      const data = rows.map((row) => {
        const status = mapProjectStatus(row.project_status);
        const docUploadStatus = row.has_tasks ? "Uploaded" : "Pending";
        const depApprovedStatus = row.dep_status === "Approved" ? "Approved" : "Pending";
        return {
          id: row.id,
          companyName: row.workspace || row.owner_name || "N/A",
          personName: row.owner_name || "N/A",
          projectName: row.project_name || "Untitled",
          status,
          docUploadStatus,
          depApprovedStatus,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      return res.json({
        data,
        meta: {
          page,
          pageSize,
          total,
        },
      });
    } catch (error) {
      console.error("Error fetching project activity:", error);
      return res.status(500).json({ error: "Failed to fetch project activity" });
    }
  });

  app.use("/api", router);
}

export default registerProjectActivityRoutes;
