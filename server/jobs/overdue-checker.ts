import { db } from "../db";
import { tasks } from "../../shared/schema";
import { eq, and, lt, ne } from "drizzle-orm";
import { NotificationService } from "../services/notification-service";
import { ActivityLogService } from "../services/activity-service";

export async function checkOverdueTasks() {
    try {
        const now = new Date();
        // Find tasks that are not completed but their due date is in the past
        // Also, we only want to process them once, so maybe check if already flagged
        // For simplicity, we just notify if they missed the deadline and haven't been notified today.
        // Realistically, you would add an 'isOverdue' boolean or a timestamp.
        // As a simple example, we'll log it if not completed.

        const overdueTasks = await db
            .select()
            .from(tasks)
            .where(
                and(
                    ne(tasks.status, "Completed"),
                    ne(tasks.status, "READY_FOR_QA"),
                    lt(tasks.dueDate, now)
                )
            );

        for (const task of overdueTasks) {
            // In a production app, we would mark an `isOverdue` flag to prevent spamming
            // the manager every minute. We will simulate that by checking if we already
            // added an activity log for "OVERDUE_FLAGGED" on this task.

            const existingLogs = await ActivityLogService.getLogsForResource("Task", task.id);
            const alreadyFlagged = existingLogs.some(log => log.action === "OVERDUE_FLAGGED");

            if (!alreadyFlagged) {
                // Log it to prevent duplicate notifications
                await ActivityLogService.log({
                    action: "OVERDUE_FLAGGED",
                    resourceType: "Task",
                    resourceId: task.id,
                    details: `Task missed deadline of ${task.dueDate}`
                });

                // Notify the assigned user
                if (task.assignedToUserId) {
                    await NotificationService.notify({
                        userId: task.assignedToUserId,
                        message: `URGENT: Your task '${task.title}' is now OVERDUE! Please request an extension or complete it.`,
                        type: "ERROR"
                    });
                }

                // Notify Manager
                await NotificationService.notify({
                    userId: "PRODUCT_POSTING_MANAGER_ROLE",
                    message: `Task '${task.title}' is now overdue.`,
                    type: "WARNING"
                });
            }
        }
    } catch (error) {
        console.error("[OverdueChecker] failed to run:", error);
    }
}

export function startOverdueJob() {
    // Run every 5 minutes
    setInterval(checkOverdueTasks, 5 * 60 * 1000);
}
