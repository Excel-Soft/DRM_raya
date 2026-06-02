import { db } from './server/db';
import { tasks, taskTimeLogs } from './shared/schema';
import { eq } from 'drizzle-orm';
import { ActivityLogService } from './server/services/activity-service';

async function run() {
  const id = 'd30181fe-fc69-42c1-82ff-dd439ee13ad4';
  const userId = '13df757b-7b0f-48d6-a212-32a1eb5df9be'; // Some valid user ID, maybe 'talha'

  // fetch user 'talha'
  const { users } = await import('./shared/schema');
  const [user] = await db.select().from(users).where(eq(users.name, 'talha'));
  const actualUserId = user?.id || userId;

  try {
      const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!task) throw new Error("Task not found");

      if (!task.timerStartedAt) {
          throw new Error("Timer is not running");
      }

      const timeSpentMs = Date.now() - task.timerStartedAt.getTime();
      const timeSpentMinutes = Math.floor(timeSpentMs / (1000 * 60));

      console.log("timeSpentMinutes:", timeSpentMinutes);

      await db.update(tasks)
          .set({ timerStartedAt: null })
          .where(eq(tasks.id, id));
      console.log("updated tasks");

      if (timeSpentMinutes > 0) {
          await db.insert(taskTimeLogs).values({
              taskId: id,
              userId: actualUserId,
              timeSpentMinutes,
          });
      }
      console.log("inserted log");

      await ActivityLogService.log({
          userId: actualUserId,
          action: "TIMER_STOPPED",
          resourceType: "Task",
          resourceId: id,
          details: `Logged ${timeSpentMinutes} minutes`
      });
      console.log("logged activity");

  } catch (err) {
      console.error("ERROR:", err);
  }
  process.exit(0);
}
run().catch(console.error);
