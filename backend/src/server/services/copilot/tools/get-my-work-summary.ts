import { z } from "zod";
import type { ToolDefinition } from "../types";
import { nowIso } from "../types";
import { followUpsRepository } from "../../../repositories/followups.repository";
import { projectAssignmentsRepository } from "../../../repositories/project-assignments.repository";

const MAX_RESULTS = 25;

const schema = z.object({
  dueWithinDays: z.number().int().min(1).max(90).optional().default(14),
});

export const getMyWorkSummaryTool: ToolDefinition = {
  name: "get_my_work_summary",
  description:
    "Assigned work and due follow-ups for the current authenticated user only. Bounded by dueWithinDays (max 90).",
  schema,
  jsonSchema: {
    type: "object",
    properties: {
      dueWithinDays: { type: "integer", minimum: 1, maximum: 90, description: "Look-ahead window in days (default 14)." },
    },
  },
  async handler(rawArgs, ctx) {
    const args = schema.parse(rawArgs ?? {});
    const now = new Date();
    const to = new Date(now.getTime() + args.dueWithinDays * 86_400_000);

    const [followUps, assignments] = await Promise.all([
      followUpsRepository.findByUserId(ctx.identity.userId, { status: "Open", dateFrom: now, dateTo: to }),
      projectAssignmentsRepository.findByUserId(ctx.identity.userId),
    ]);

    const openFollowUps = followUps.slice(0, MAX_RESULTS).map((f) => ({
      id: f.id,
      customer: f.customer?.companyName ?? null,
      dueAt: f.dueAt,
      status: f.status,
      method: f.method ?? null,
    }));

    const activeProjects = assignments
      .filter((a) => a.project && a.project.status !== "Completed")
      .slice(0, MAX_RESULTS)
      .map((a) => ({
        id: a.project.id,
        name: a.project.name,
        status: a.project.status,
        role: a.role,
      }));

    return {
      ok: true,
      data: {
        followUpsDue: openFollowUps,
        followUpsDueCount: followUps.length,
        activeProjectAssignments: activeProjects,
        activeProjectAssignmentsCount: activeProjects.length,
        windowDays: args.dueWithinDays,
      },
      sourceRefs: [
        ...openFollowUps.map((f) => ({
          type: "follow_up",
          id: String(f.id),
          label: f.customer ?? undefined,
          route: "/customers/private-pool",
          retrievedAt: nowIso(),
        })),
        ...activeProjects.map((p) => ({
          type: "project",
          id: String(p.id),
          label: p.name,
          route: "/pms/running-projects",
          retrievedAt: nowIso(),
        })),
      ],
    };
  },
};
