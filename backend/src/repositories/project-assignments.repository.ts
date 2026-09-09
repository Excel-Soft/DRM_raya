import { db } from "../db";
import { projectAssignments, users, projects, InsertProjectAssignment, ProjectAssignment } from "@models/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

export const projectAssignmentsRepository = {
  async findById(id: string): Promise<ProjectAssignment | undefined> {
    const result = await db.select().from(projectAssignments).where(eq(projectAssignments.id, id)).limit(1);
    return result[0];
  },

  async findByProjectId(projectId: string): Promise<Array<ProjectAssignment & { user: { id: string; name: string | null; email: string; roleId: string | null } }>> {
    const result = await db
      .select({
        id: projectAssignments.id,
        projectId: projectAssignments.projectId,
        userId: projectAssignments.userId,
        role: projectAssignments.role,
        assignedAt: projectAssignments.assignedAt,
        createdAt: projectAssignments.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          roleId: users.roleId,
        },
      })
      .from(projectAssignments)
      .innerJoin(users, eq(projectAssignments.userId, users.id))
      .where(eq(projectAssignments.projectId, projectId))
      .orderBy(desc(projectAssignments.assignedAt));

    return result;
  },

  async findByUserId(userId: string): Promise<Array<ProjectAssignment & { project: typeof projects.$inferSelect }>> {
    const result = await db
      .select({
        id: projectAssignments.id,
        projectId: projectAssignments.projectId,
        userId: projectAssignments.userId,
        role: projectAssignments.role,
        assignedAt: projectAssignments.assignedAt,
        createdAt: projectAssignments.createdAt,
        project: projects,
      })
      .from(projectAssignments)
      .innerJoin(projects, eq(projectAssignments.projectId, projects.id))
      .where(eq(projectAssignments.userId, userId))
      .orderBy(desc(projectAssignments.assignedAt));

    return result.map((r) => ({
      ...r,
      project: r.project!,
    }));
  },

  async create(data: InsertProjectAssignment): Promise<ProjectAssignment> {
    const result = await db.insert(projectAssignments).values(data).returning();
    return result[0];
  },

  async updateRole(id: string, role: string): Promise<ProjectAssignment> {
    const result = await db
      .update(projectAssignments)
      .set({ role })
      .where(eq(projectAssignments.id, id))
      .returning();
    return result[0];
  },

  async remove(id: string): Promise<void> {
    await db.delete(projectAssignments).where(eq(projectAssignments.id, id));
  },

  async isUserAssigned(projectId: string, userId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(projectAssignments)
      .where(and(eq(projectAssignments.projectId, projectId), eq(projectAssignments.userId, userId)))
      .limit(1);
    return result.length > 0;
  },

  async findByMultipleProjectIds(projectIds: string[]): Promise<Record<string, Array<{ id: string; projectId: string; userId: string; role: string; assignedAt: string | null; user: { id: string; name: string | null; email: string; roleId: string | null } }>>> {
    if (projectIds.length === 0) return {};

    const result = await db
      .select({
        id: projectAssignments.id,
        projectId: projectAssignments.projectId,
        userId: projectAssignments.userId,
        role: projectAssignments.role,
        assignedAt: projectAssignments.assignedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          roleId: users.roleId,
        },
      })
      .from(projectAssignments)
      .innerJoin(users, eq(projectAssignments.userId, users.id))
      .where(inArray(projectAssignments.projectId, projectIds))
      .orderBy(desc(projectAssignments.assignedAt));

    const grouped: Record<string, Array<{ id: string; projectId: string; userId: string; role: string; assignedAt: string | null; user: { id: string; name: string | null; email: string; roleId: string | null } }>> = {};
    for (const row of result) {
      if (!grouped[row.projectId]) {
        grouped[row.projectId] = [];
      }
      grouped[row.projectId].push({
        ...row,
        assignedAt: row.assignedAt ? row.assignedAt.toISOString() : null,
      });
    }
    return grouped;
  },
};
