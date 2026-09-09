import { db } from "../db";
import { tasks } from "../models";
import { eq, and, lt, ne } from "drizzle-orm";
import { NotificationService } from "../services/notification-service";
import { ActivityLogService } from "../services/activity-service";
import { ROLES } from "../../shared/roles";

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
                await NotificationService.notifyRole(
                    ROLES.PRODUCT_POSTING_MANAGER,
                    `Task '${task.title}' is now overdue.`,
                    "WARNING"
                );
            }
        }
        // Run loan overdue check as part of the periodic task run
        await checkOverdueLoans();
    } catch (error) {
        console.error("[OverdueChecker] failed to run:", error);
    }
}

export async function checkOverdueLoans() {
    try {
        const { pool } = await import("../db");

        // Query overdue loans (where return_status is not 'RETURNED' and agreed_return_date is in the past)
        const overdueLoans = await pool.query(
            `SELECT t.gm_id, t.agreed_return_date, t.return_status, e.sales_person_id
             FROM drm.gm_loan_terms t
             JOIN drm.gm_entries e ON e.id::text = t.gm_id::text
             WHERE (t.return_status IS DISTINCT FROM 'RETURNED')
               AND t.agreed_return_date IS NOT NULL
               AND t.agreed_return_date < CURRENT_DATE`
        );

        for (const loan of overdueLoans.rows) {
            const gmId = loan.gm_id;
            const salesPersonId = loan.sales_person_id;

            // Check if we already logged this loan as overdue to avoid spamming
            const existingLogs = await ActivityLogService.getLogsForResource("gm_loan", gmId);
            const alreadyFlagged = existingLogs.some(log => log.action === "LOAN_OVERDUE_FLAGGED");

            if (!alreadyFlagged) {
                // Log it to prevent duplicate notifications
                await ActivityLogService.log({
                    action: "LOAN_OVERDUE_FLAGGED",
                    resourceType: "gm_loan",
                    resourceId: gmId,
                    details: `Loan for GM ${gmId} missed return date of ${loan.agreed_return_date}`
                });

                // Notify Sales Person (borrower)
                if (salesPersonId) {
                    await NotificationService.notify({
                        userId: salesPersonId,
                        message: `URGENT: Your loan terms for GM (ID: ${gmId}) are now OVERDUE! Please resolve it with accounts.`,
                        type: "ERROR"
                    });
                }

                // Notify Account Manager
                await NotificationService.notifyRole(
                    ROLES.ACCOUNT_MANAGER,
                    `Loan terms for GM (ID: ${gmId}) are now overdue.`,
                    "WARNING"
                );
            }
        }
    } catch (error) {
        console.error("[OverdueChecker] checkOverdueLoans failed to run:", error);
    }
}

export function startOverdueJob() {
    // Run every 5 minutes
    setInterval(checkOverdueTasks, 5 * 60 * 1000);
}
