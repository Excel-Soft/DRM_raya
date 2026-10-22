import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { projectsRepository } from "../../../repositories/projects.repository";

const schema = z.object({
  projectId: z.string().min(1).max(64).optional(),
});

export const getProjectSummaryTool: ToolDefinition = {
  name: "get_project_summary",
  description:
    "Authorised project(s): task-status breakdown and owner. Pass projectId for one project, or omit to list the current user's projects. 'Missing evidence' is not tracked anywhere in this system — always reported as unavailable, never invented.",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      projectId: { type: "string", minLength: 1, maxLength: 64, description: "Optional: a specific project id." },
    },
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});
    const ownerFilter = ctx.identity.isFullAccess ? undefined : ctx.identity.userId;
    const projects = await projectsRepository.findAllWithStats(ownerFilter);

    if (args.projectId) {
      const project = projects.find((p) => String(p.id) === args.projectId);
      if (!project) return { ok: false, unavailable: "project not found or not authorised", sourceRefs: [] };
      return {
        ok: true,
        data: {
          id: project.id,
          name: project.name,
          status: project.status,
          ownerName: (project as any).ownerName,
          taskStats: (project as any).taskStats,
          missingEvidence: "unavailable — this system does not track a concept of missing evidence",
        },
        sourceRefs: [{ type: "project", id: String(project.id), label: project.name, route: "/pms/running-projects", retrievedAt: nowIso() }],
      };
    }

    const rows = projects.slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      ownerName: (p as any).ownerName,
      taskStats: (p as any).taskStats,
    }));
    return {
      ok: true,
      data: { projects: rows, total: projects.length },
      sourceRefs: rows.map((p) => ({ type: "project", id: String(p.id), label: p.name, route: "/pms/running-projects", retrievedAt: nowIso() })),
    };
  },
};
