import type { Express, Request, Response } from "express";
import { pool } from "./db";
import { sendError, ApiError } from "./utils/api-error";
import { AuditLogService } from "./services/audit-log.service";
import {
  findDuplicates,
  canOverrideDuplicates,
} from "./utils/duplicate-policy";
import { getRequestUserId, getRequestRole } from "./utils/ownership";

/**
 * Stage 8 — CRM duplicate review & merge workflow.
 *
 * Builds on the shared Stage 6 duplicate-policy. Listing/compare are read-only;
 * merge and skip mutate and are restricted to the duplicate-override roles
 * (admin / super_admin / sales_manager) and always audited. Merge never deletes
 * linked data — every child row referencing the losing customer is repointed to
 * the surviving customer before the loser is soft-deleted.
 */

// Columns on drm.customers that a merge may take from the losing record.
const MERGEABLE_COLUMNS: Record<string, string> = {
  companyName: "company_name",
  accountName: "account_name",
  email: "email",
  phone: "phone",
  mobile: "mobile",
  region: "region",
  grade: "grade",
  status: "status",
  ntn: "ntn",
  country: "country",
  city: "city",
  address: "address",
  website: "website",
  personName: "person_name",
  designation: "designation",
  source: "source",
  comment: "comment",
  lastNote: "last_note",
};

async function ensureDuplicateDecisionsTable(): Promise<void> {
  await pool.query(`
    create table if not exists drm.duplicate_decisions (
      id uuid primary key default gen_random_uuid(),
      primary_customer_id text not null,
      duplicate_customer_id text,
      decision text not null,
      reason text,
      actor_user_id text,
      created_at timestamptz not null default now()
    )
  `);
}

async function loadCustomer(id: string): Promise<any | null> {
  const { rows } = await pool.query(
    `select * from drm.customers where id::text = $1::text limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export function registerCrmDuplicatesRoutes(app: Express): void {
  // GET /api/crm/duplicates — clusters of customers sharing email/phone/company.
  app.get("/api/crm/duplicates", async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");

      const clusters: any[] = [];
      const dims: { type: string; keyExpr: string; whereExpr: string }[] = [
        {
          type: "email",
          keyExpr: "lower(trim(email))",
          whereExpr: "coalesce(trim(email), '') <> ''",
        },
        {
          type: "phone",
          keyExpr: "regexp_replace(coalesce(phone_normalized, phone, ''), '\\D', '', 'g')",
          whereExpr:
            "regexp_replace(coalesce(phone_normalized, phone, ''), '\\D', '', 'g') <> ''",
        },
        {
          type: "company",
          keyExpr: "regexp_replace(lower(coalesce(company_name, '')), '[^a-z0-9]', '', 'g')",
          whereExpr:
            "regexp_replace(lower(coalesce(company_name, '')), '[^a-z0-9]', '', 'g') <> ''",
        },
      ];

      for (const d of dims) {
        const { rows } = await pool.query(
          `select ${d.keyExpr} as key,
                  json_agg(json_build_object(
                    'id', id, 'companyName', company_name, 'email', email,
                    'phone', coalesce(phone, mobile), 'grade', grade,
                    'status', status, 'ownerUserId', owner_user_id,
                    'createdAt', created_at
                  ) order by created_at) as members,
                  count(*) as cnt
             from drm.customers
            where coalesce(is_deleted, false) = false
              and ${d.whereExpr}
            group by ${d.keyExpr}
           having count(*) > 1
            limit 100`,
        );
        for (const r of rows) {
          clusters.push({
            clusterKey: `${d.type}:${r.key}`,
            matchType: d.type,
            count: Number(r.cnt),
            members: r.members,
          });
        }
      }

      res.json({ success: true, clusters, total: clusters.length });
    } catch (err) {
      sendError(res, err);
    }
  });

  // GET /api/crm/duplicates/:id/compare — a customer and its duplicates, full fields.
  app.get("/api/crm/duplicates/:id/compare", async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const primary = await loadCustomer(req.params.id);
      if (!primary) throw new ApiError(404, "NOT_FOUND", "Customer not found");

      const matches = await findDuplicates(
        { email: primary.email, phone: primary.phone || primary.mobile, company: primary.company_name },
        { excludeCustomerId: primary.id },
      );
      const dupIds = matches
        .filter((m) => m.recordType === "customer")
        .map((m) => m.id);

      let duplicates: any[] = [];
      if (dupIds.length > 0) {
        const { rows } = await pool.query(
          `select * from drm.customers where id::text = any($1::text[]) and coalesce(is_deleted,false)=false`,
          [dupIds],
        );
        duplicates = rows;
      }

      res.json({ success: true, primary, duplicates, matchedOn: matches });
    } catch (err) {
      sendError(res, err);
    }
  });

  // POST /api/crm/duplicates/:id/merge — :id is the SURVIVOR. Body: { loserId, fields? }
  app.post("/api/crm/duplicates/:id/merge", async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const role = getRequestRole(req);
      if (!canOverrideDuplicates(role)) {
        throw new ApiError(403, "FORBIDDEN", "You are not authorized to merge duplicate customers.");
      }

      const survivorId = String(req.params.id);
      const loserId = String((req.body?.loserId ?? "")).trim();
      const reason = String(req.body?.reason ?? "").trim();
      const fields = (req.body?.fields ?? {}) as Record<string, "survivor" | "loser">;
      if (!loserId) throw new ApiError(400, "VALIDATION_ERROR", "loserId is required.");
      if (loserId === survivorId) {
        throw new ApiError(400, "VALIDATION_ERROR", "Cannot merge a customer into itself.");
      }

      const survivor = await loadCustomer(survivorId);
      const loser = await loadCustomer(loserId);
      if (!survivor) throw new ApiError(404, "NOT_FOUND", "Surviving customer not found.");
      if (!loser) throw new ApiError(404, "NOT_FOUND", "Duplicate (losing) customer not found.");
      if (loser.is_deleted) throw new ApiError(409, "CONFLICT", "Duplicate customer is already merged/deleted.");

      await client.query("begin");

      // 1) Repoint every drm.* child row that references the loser to the survivor.
      const { rows: refTables } = await client.query(
        `select table_name, column_name
           from information_schema.columns
          where table_schema = 'drm'
            and column_name in ('customer_id', 'promoted_to_customer_id')`,
      );
      const repointed: Record<string, number> = {};
      for (const t of refTables) {
        const tbl = t.table_name as string;
        const col = t.column_name as string;
        if (tbl === "customers") continue;
        try {
          const r = await client.query(
            `update drm.${'"' + tbl + '"'} set ${'"' + col + '"'} = $1
               where ${'"' + col + '"'}::text = $2::text`,
            [survivorId, loserId],
          );
          if (r.rowCount && r.rowCount > 0) repointed[`${tbl}.${col}`] = r.rowCount;
        } catch (e) {
          // A unique constraint or type quirk on a child table must not silently
          // drop links: abort the whole merge so nothing is half-merged.
          await client.query("rollback");
          throw new ApiError(
            409,
            "CONFLICT",
            `Merge aborted: could not repoint ${tbl}.${col}. No changes were made.`,
          );
        }
      }

      // 2) Apply chosen winning field values from the loser onto the survivor.
      const setFragments: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const [camel, choice] of Object.entries(fields)) {
        if (choice !== "loser") continue;
        const dbCol = MERGEABLE_COLUMNS[camel];
        if (!dbCol) continue;
        setFragments.push(`${dbCol} = $${idx++}`);
        values.push((loser as any)[dbCol] ?? null);
      }
      if (setFragments.length > 0) {
        values.push(survivorId);
        await client.query(
          `update drm.customers set ${setFragments.join(", ")}, updated_at = now()
             where id::text = $${idx}::text`,
          values,
        );
      }

      // 3) Soft-delete the loser, preserving the row for audit/history.
      await client.query(
        `update drm.customers set is_deleted = true, updated_at = now()
           where id::text = $1::text`,
        [loserId],
      );

      await client.query("commit");

      await AuditLogService.record({
        actorUserId: getRequestUserId(req) ?? undefined,
        action: "customer.duplicate_merge",
        module: "crm",
        entityType: "customer",
        entityId: survivorId,
        reason: reason || undefined,
        before: { loser: { id: loser.id, companyName: loser.company_name } },
        after: { survivorId, repointed, fieldChoices: fields },
        req,
      });

      res.json({ success: true, survivorId, mergedFrom: loserId, repointed });
    } catch (err) {
      try { await client.query("rollback"); } catch {}
      sendError(res, err);
    } finally {
      client.release();
    }
  });

  // POST /api/crm/duplicates/:id/skip — record a "not a duplicate" decision.
  app.post("/api/crm/duplicates/:id/skip", async (req: Request, res: Response) => {
    try {
      if (!req.user) throw new ApiError(401, "UNAUTHORIZED", "Not authenticated");
      const role = getRequestRole(req);
      if (!canOverrideDuplicates(role)) {
        throw new ApiError(403, "FORBIDDEN", "You are not authorized to dismiss duplicates.");
      }
      const primaryId = String(req.params.id);
      const duplicateId = req.body?.duplicateId ? String(req.body.duplicateId) : null;
      const reason = String(req.body?.reason ?? "").trim();

      await ensureDuplicateDecisionsTable();
      await pool.query(
        `insert into drm.duplicate_decisions
           (primary_customer_id, duplicate_customer_id, decision, reason, actor_user_id)
         values ($1, $2, 'skip', $3, $4)`,
        [primaryId, duplicateId, reason || null, getRequestUserId(req)],
      );

      await AuditLogService.record({
        actorUserId: getRequestUserId(req) ?? undefined,
        action: "customer.duplicate_skip",
        module: "crm",
        entityType: "customer",
        entityId: primaryId,
        reason: reason || undefined,
        after: { duplicateId },
        req,
      });

      res.json({ success: true });
    } catch (err) {
      sendError(res, err);
    }
  });
}

export default registerCrmDuplicatesRoutes;
