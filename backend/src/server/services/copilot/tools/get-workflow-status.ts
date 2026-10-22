import { z } from "zod";
import { eq } from "drizzle-orm";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { pool } from "../../../db";
import { db } from "../../../db";
import { gmEntries } from "../../../../shared/schema";
import { projectsRepository } from "../../../repositories/projects.repository";

const schema = z.object({
  recordType: z.enum(["quotation", "gm", "project"]),
  recordId: z.string().min(1).max(64),
});

// NOTE: workflow-status.service.ts / cross-department-status.service.ts (the
// purpose-built aggregators referenced by older code) are stub placeholders
// with no real implementation in this checkout — see docs/copilot/PROGRESS.md.
// This tool reads each source directly instead of depending on them.
export const getWorkflowStatusTool: ToolDefinition = {
  name: "get_workflow_status",
  description:
    "Actual status + supported blockers for a quotation, GM entry, or project the current user is authorised to view. There is no cross-department aggregator in this system yet — only these three record types are supported.",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      recordType: { type: "string", enum: ["quotation", "gm", "project"] },
      recordId: { type: "string", minLength: 1, maxLength: 64 },
    },
    required: ["recordType", "recordId"],
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});

    if (args.recordType === "quotation") {
      const { rows } = await pool.query(
        `select id, customer_id, created_by, save_status, hod_status, hod_reviewed_at, confirmed_at
           from quotations where id::text = $1::text limit 1`,
        [args.recordId],
      );
      const row = rows[0];
      if (!row) return { ok: false, unavailable: "quotation not found", sourceRefs: [] };
      if (!ctx.identity.isFullAccess && String(row.created_by) !== ctx.identity.userId) {
        return { ok: false, unavailable: "not authorised to view this quotation", sourceRefs: [] };
      }
      const blocked = !row.confirmed_at
        ? "awaiting creator confirmation"
        : !row.hod_status
          ? "awaiting HOD review"
          : row.hod_status === "rejected"
            ? "rejected by HOD"
            : null;
      return {
        ok: true,
        data: {
          recordType: "quotation",
          saveStatus: row.save_status,
          hodStatus: row.hod_status,
          confirmedAt: row.confirmed_at,
          hodReviewedAt: row.hod_reviewed_at,
          blocked,
        },
        sourceRefs: [{ type: "quotation", id: String(row.id), route: "/sales/quotation", retrievedAt: nowIso() }],
      };
    }

    if (args.recordType === "gm") {
      const [row] = await db.select().from(gmEntries).where(eq(gmEntries.id, args.recordId)).limit(1);
      if (!row) return { ok: false, unavailable: "GM entry not found", sourceRefs: [] };
      if (!ctx.identity.isFullAccess && String(row.salesPersonId) !== ctx.identity.userId) {
        return { ok: false, unavailable: "not authorised to view this GM entry", sourceRefs: [] };
      }
      const blocked =
        row.status === "Pending"
          ? "awaiting approval"
          : row.status === "Rejected"
            ? "rejected"
            : row.paymentStatus && row.paymentStatus !== "Paid"
              ? `payment ${row.paymentStatus}`
              : null;
      return {
        ok: true,
        data: {
          recordType: "gm",
          status: row.status,
          paymentStatus: row.paymentStatus,
          companyName: row.companyName,
          blocked,
        },
        sourceRefs: [{ type: "gm_entry", id: String(row.id), route: "/account/gm-entries", retrievedAt: nowIso() }],
      };
    }

    // project
    const projects = await projectsRepository.findByOwner(ctx.identity.isFullAccess ? undefined : ctx.identity.userId);
    const project = projects.find((p) => String(p.id) === args.recordId);
    if (!project) return { ok: false, unavailable: "project not found or not authorised", sourceRefs: [] };
    return {
      ok: true,
      data: {
        recordType: "project",
        status: project.status,
        name: project.name,
        blocked: project.status === "OnHold" ? "on hold" : null,
      },
      sourceRefs: [{ type: "project", id: String(project.id), label: project.name, route: "/pms/running-projects", retrievedAt: nowIso() }],
    };
  },
};
