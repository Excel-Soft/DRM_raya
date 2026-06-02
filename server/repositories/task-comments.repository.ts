import { db } from "../db";
import { taskComments, users, type TaskComment, type InsertTaskComment } from "@shared/schema";
import { eq } from "drizzle-orm";

export type TaskCommentWithUser = TaskComment & {
  user: typeof users.$inferSelect;
};

export class TaskCommentsRepository {
  async create(data: InsertTaskComment): Promise<TaskComment> {
    const [comment] = await db.insert(taskComments).values(data).returning();
    return comment;
  }

  async findByTaskId(taskId: string): Promise<TaskCommentWithUser[]> {
    const results = await db
      .select()
      .from(taskComments)
      .innerJoin(users, eq(taskComments.userId, users.id))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);

    return results.map((row) => ({
      ...row.task_comments,
      user: row.users,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(taskComments).where(eq(taskComments.id, id));
    return result.rowCount! > 0;
  }
}

export const taskCommentsRepository = new TaskCommentsRepository();
