import { Router } from "express";
import { pool } from "../db";
import { requireRole } from "../middleware/auth.middleware";

/**
 * Audit Log viewer (Stage 10, section G).
 *
 * Read-only window over the existing `drm.activity_logs` table (no schema
 * change). Restricted to admin / super_admin / super_hod — these logs can
 * contain sensitive financial / HR actions, so the viewer is gated and the
 * `details` JSON is returned as-is (writers are responsible for never storing
 * secrets, per audit-log.service.ts).
 *
 * Filters (all optional, AND-combined): actor (user_id), module (matched inside
 * the details JSON), entityType, entityId, action, dateFrom, dateTo.
 * Paginated with page / pageSize (capped). All values are parameterized.
 */

const router = Router();

const ROLES = ["admin", "super_admin", "super_hod"] as const;

// No caller has ever populated `details.module` in practice (checked: 0/315
// existing rows), so it's derived here from resource_type instead of relying
// on writers to set it.
const MODULE_LABELS: Record<string, string> = {
  invoice: "Invoices",
  task: "Product Posting",
  taskextension: "Product Posting",
  gm_entry: "GM Pool",
  project: "Projects",
  projectdocument: "Projects",
  temp_contact: "Leads",
  drm_promotion: "Promotions",
  user: "Users",
  allowed_ip: "Security",
  workflow: "Product Posting",
  productpostingworkflow: "Product Posting",
  penalty: "Penalties",
  productpostingevidencelink: "Product Posting",
  loan_request: "Loans",
  portfolio: "Portfolio",
};

/**
 * Best-effort resource_type+resource_id -> human label lookup, batched one
 * query per known type so the audit log's "Entity" column can show something
 * more useful than a raw UUID. Unknown types/ids simply get no label and the
 * client falls back to showing the raw type + id, same as before this existed.
 */
async function resolveEntityLabels(
  rows: { resource_type: string | null; resource_id: string | null }[],
): Promise<Map<string, string>> {
  const byType: Record<string, Set<string>> = {};
  for (const r of rows) {
    if (!r.resource_id) continue;
    const t = (r.resource_type || "").toLowerCase();
    (byType[t] ??= new Set()).add(r.resource_id);
  }
  const idsFor = (t: string) => Array.from(byType[t] ?? []);
  const labels = new Map<string, string>();
  const setLabel = (type: string, id: string, label: unknown) => {
    if (typeof label === "string" && label.trim()) labels.set(`${type}:${id}`, label);
  };

  const tasks = [...idsFor("task"), ...idsFor("taskextension")];
  if (tasks.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, title FROM drm.tasks WHERE id::text = ANY($1::text[])`,
      [tasks],
    );
    for (const row of rows) {
      setLabel("task", row.id, row.title);
      setLabel("taskextension", row.id, row.title);
    }
  }

  const projects = idsFor("project");
  if (projects.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, name, project_number FROM drm.projects WHERE id::text = ANY($1::text[])`,
      [projects],
    );
    for (const row of rows) {
      setLabel("project", row.id, row.project_number ? `${row.name} (#${row.project_number})` : row.name);
    }
  }

  const projectDocs = idsFor("projectdocument");
  if (projectDocs.length) {
    const { rows } = await pool.query(
      `SELECT pd.id::text as id, p.name as project_name
         FROM drm.project_documents pd LEFT JOIN drm.projects p ON p.id = pd.project_id
        WHERE pd.id::text = ANY($1::text[])`,
      [projectDocs],
    );
    for (const row of rows) setLabel("projectdocument", row.id, row.project_name ? `Document · ${row.project_name}` : null);
  }

  const invoices = idsFor("invoice");
  if (invoices.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, project_name, company_name FROM drm.product_posting_invoices WHERE id::text = ANY($1::text[])`,
      [invoices],
    );
    for (const row of rows) {
      setLabel("invoice", row.id, [row.project_name, row.company_name].filter(Boolean).join(" · "));
    }
  }

  const gmEntries = idsFor("gm_entry");
  if (gmEntries.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, company_name FROM drm.gm_entries WHERE id::text = ANY($1::text[])`,
      [gmEntries],
    );
    for (const row of rows) setLabel("gm_entry", row.id, row.company_name);
  }

  const tempContacts = idsFor("temp_contact");
  if (tempContacts.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, COALESCE(raw_name, person_name) as name FROM drm.temp_contacts WHERE id::text = ANY($1::text[])`,
      [tempContacts],
    );
    for (const row of rows) setLabel("temp_contact", row.id, row.name);
  }

  const promotions = idsFor("drm_promotion");
  if (promotions.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, title FROM drm.promotions WHERE id::text = ANY($1::text[])`,
      [promotions],
    );
    for (const row of rows) setLabel("drm_promotion", row.id, row.title);
  }

  const users = idsFor("user");
  if (users.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, COALESCE(full_name, name, email) as name FROM drm.users WHERE id::text = ANY($1::text[])`,
      [users],
    );
    for (const row of rows) setLabel("user", row.id, row.name);
  }

  const workflows = [...idsFor("workflow"), ...idsFor("productpostingworkflow")];
  if (workflows.length) {
    // Some call sites label the resource "ProductPostingWorkflow" but actually
    // store the *project* id as resourceId, not the workflow row's own id — so
    // this tries both: the workflow's own id, then falls back to treating the
    // id as a project id directly.
    const { rows } = await pool.query(
      `SELECT id, label FROM (
         SELECT wf.id::text as id, COALESCE(p.name, inv.project_name) as label
           FROM drm.product_posting_workflows wf
           LEFT JOIN drm.projects p ON p.id = wf.project_id
           LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
          WHERE wf.id::text = ANY($1::text[])
         UNION ALL
         SELECT p.id::text as id, COALESCE(p.name, inv.project_name) as label
           FROM drm.projects p
           LEFT JOIN drm.product_posting_invoices inv ON inv.id = p.invoice_id
          WHERE p.id::text = ANY($1::text[])
       ) x`,
      [workflows],
    );
    for (const row of rows) {
      setLabel("workflow", row.id, row.label);
      setLabel("productpostingworkflow", row.id, row.label);
    }
  }

  const loans = idsFor("loan_request");
  if (loans.length) {
    const { rows } = await pool.query(
      `SELECT lr.id::text as id, COALESCE(u.full_name, u.name) as employee
         FROM drm.loan_requests lr LEFT JOIN drm.users u ON u.id = lr.user_id
        WHERE lr.id::text = ANY($1::text[])`,
      [loans],
    );
    for (const row of rows) setLabel("loan_request", row.id, row.employee ? `Loan · ${row.employee}` : null);
  }

  const portfolios = idsFor("portfolio");
  if (portfolios.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, keyword FROM drm.portfolios WHERE id::text = ANY($1::text[])`,
      [portfolios],
    );
    for (const row of rows) setLabel("portfolio", row.id, row.keyword);
  }

  const penalties = idsFor("penalty");
  if (penalties.length) {
    const { rows } = await pool.query(
      `SELECT pn.id::text as id, pn.penalty_head, COALESCE(u.full_name, u.name) as employee
         FROM drm.penalties pn LEFT JOIN drm.users u ON u.id = pn.employee_id
        WHERE pn.id::text = ANY($1::text[])`,
      [penalties],
    );
    for (const row of rows) setLabel("penalty", row.id, [row.penalty_head, row.employee].filter(Boolean).join(" · "));
  }

  const evidenceLinks = idsFor("productpostingevidencelink");
  if (evidenceLinks.length) {
    const { rows } = await pool.query(
      `SELECT id::text as id, url FROM drm.product_posting_evidence_links WHERE id::text = ANY($1::text[])`,
      [evidenceLinks],
    );
    for (const row of rows) setLabel("productpostingevidencelink", row.id, row.url);
  }

  return labels;
}

router.get("/", requireRole(...ROLES), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const pageSizeRaw = parseInt(String(req.query.pageSize ?? "50"), 10) || 50;
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const where: string[] = [];
    const params: any[] = [];
    const add = (clause: string, value: any) => {
      params.push(value);
      where.push(clause.replace("$?", `$${params.length}`));
    };

    const actor = (req.query.actor as string)?.trim();
    const moduleName = (req.query.module as string)?.trim();
    const entityType = (req.query.entityType as string)?.trim();
    const entityId = (req.query.entityId as string)?.trim();
    const action = (req.query.action as string)?.trim();
    const dateFrom = (req.query.dateFrom as string)?.trim();
    const dateTo = (req.query.dateTo as string)?.trim();

    const parseDate = (v?: string): Date | null | undefined => {
      if (!v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const from = parseDate(dateFrom);
    const to = parseDate(dateTo);
    if (from === null || to === null) {
      return res.status(400).json({ error: "Invalid dateFrom/dateTo. Use an ISO date." });
    }

    if (actor) add("a.user_id = $?", actor);
    if (moduleName) add("a.details ILIKE $?", `%"module":"${moduleName}"%`);
    if (entityType) add("a.resource_type = $?", entityType);
    if (entityId) add("a.resource_id = $?", entityId);
    if (action) add("a.action ILIKE $?", `%${action}%`);
    if (from) add("a.created_at >= $?", from.toISOString());
    if (to) add("a.created_at <= $?", to.toISOString());

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM drm.activity_logs a ${whereSql}`,
      params,
    );
    const total: number = countResult.rows[0]?.total ?? 0;

    const listResult = await pool.query(
      `SELECT a.id, a.user_id, a.action, a.resource_type, a.resource_id,
              a.details, a.created_at,
              u.name AS actor_name, u.full_name AS actor_full_name,
              u.email AS actor_email, u.role_id AS actor_role
       FROM drm.activity_logs a
       LEFT JOIN drm.users u ON u.id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    const entityLabels = await resolveEntityLabels(
      listResult.rows.map((r: any) => ({ resource_type: r.resource_type, resource_id: r.resource_id })),
    );

    const items = listResult.rows.map((r: any) => {
      let module: string | undefined;
      let reason: string | undefined;
      let parsedDetails: any = undefined;
      if (r.details) {
        try {
          parsedDetails = JSON.parse(r.details);
          // recordAuditLog() stores a real {module, reason, ...} object; the far
          // more common ActivityLogService.log() just stores a plain string
          // (e.g. "Completed task with 3 links posted...") — that string IS the
          // human-readable reason, so use it directly instead of leaving the
          // column blank just because it isn't shaped like {reason: "..."}.
          if (parsedDetails && typeof parsedDetails === "object" && !Array.isArray(parsedDetails)) {
            module = parsedDetails?.module;
            reason = parsedDetails?.reason;
          } else if (typeof parsedDetails === "string") {
            reason = parsedDetails;
          }
        } catch {
          parsedDetails = r.details;
          reason = r.details;
        }
      }
      const typeKey = (r.resource_type || "").toLowerCase();
      return {
        id: r.id,
        actorId: r.user_id,
        actorName: r.actor_full_name || r.actor_name || null,
        actorEmail: r.actor_email || null,
        actorRole: r.actor_role || null,
        action: r.action,
        entityType: r.resource_type,
        entityId: r.resource_id,
        entityLabel: entityLabels.get(`${typeKey}:${r.resource_id}`) ?? null,
        module: module ?? MODULE_LABELS[typeKey] ?? null,
        reason: reason ?? null,
        details: parsedDetails ?? null,
        createdAt: r.created_at,
      };
    });

    res.json({ items, total, page, pageSize });
  } catch (error) {
    console.error("[audit-logs] list failed:", error);
    res.status(500).json({ error: "Failed to load audit logs" });
  }
});

export default router;
