import { Router } from "express";
import { db } from "../db";
import { tasks, taskTimeLogs, taskTimeExtensions, taskResults, projects } from "../../shared/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { requireRole } from "../middleware/auth.middleware";
import { ActivityLogService } from "../services/activity-service";
import { NotificationService } from "../services/notification-service";
import {
    getExecutionRowsForRole,
    getTaskSpentMinutes,
    transitionWorkflowByTask,
} from "../services/product-posting-workflow.service";
import { mapWorkflowError, validateExtensionRequestInput } from "../services/workflow-transition.service";

export const taskExecutionRouter = Router();

taskExecutionRouter.get("/my-executions", async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ success: false, error: "Not authenticated" });
        const roleId = req.user.roleId || "";
        const data = await getExecutionRowsForRole(roleId, req.user.userId);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch workflow executions" });
    }
});

// POST /api/tasks/:id/timers/start
taskExecutionRouter.post("/:id/timers/start", requireRole("product_posting_executive", "posting_executive", "admin", "product_posting_manager", "dd_manager", "dd_executive", "d_d_executive"), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;
        const userRole = req.user!.roleId;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!task) return res.status(404).json({ success: false, error: "Task not found" });

        // Allow start if assigned OR if user is a manager/admin
        const isManager = ["admin", "product_posting_manager", "dd_manager"].includes(userRole);
        if (task.assignedToUserId !== userId && !isManager) {
            return res.status(403).json({ success: false, error: `Insufficient permissions. Task assigned to: ${task.assignedToUserId}` });
        }

        // Stage 3: enforce a single active timer per WORKER. The invariant is
        // scoped to whoever the task is assigned to (not the caller), so a
        // manager starting a worker's task still stops that worker's other
        // running timers. Before starting (or restarting) this task's timer,
        // stop any OTHER task the assignee already has running, logging elapsed
        // time so no tracked work is lost.
        const timerOwnerId = task.assignedToUserId ?? userId;
        const otherRunning = await db.select().from(tasks).where(
            and(
                eq(tasks.assignedToUserId, timerOwnerId),
                isNotNull(tasks.timerStartedAt),
                ne(tasks.id, id),
            )
        );
        for (const running of otherRunning) {
            const startedAt = running.timerStartedAt!;
            // Atomic compare-and-set: only the request that observes this exact
            // start timestamp wins the stop, so concurrent starts can't both
            // log elapsed time for the same running interval.
            const claimed = await db.update(tasks)
                .set({ timerStartedAt: null })
                .where(and(eq(tasks.id, running.id), eq(tasks.timerStartedAt, startedAt)))
                .returning({ id: tasks.id });
            if (claimed.length === 0) continue; // another concurrent start already stopped it
            const elapsedMinutes = Math.floor((Date.now() - startedAt.getTime()) / (1000 * 60));
            if (elapsedMinutes > 0) {
                await db.insert(taskTimeLogs).values({
                    taskId: running.id,
                    userId: timerOwnerId,
                    timeSpentMinutes: elapsedMinutes,
                    logDate: new Date(),
                });
            }
            await ActivityLogService.log({
                userId: timerOwnerId,
                action: "TIMER_AUTO_STOPPED",
                resourceType: "Task",
                resourceId: running.id,
                details: `Auto-stopped (single active timer); logged ${elapsedMinutes} minutes`,
            });
        }

        if (task.timerStartedAt) {
            // If timer is already running for this task, reset and restart (idempotent behavior)
            await db.update(tasks)
                .set({ timerStartedAt: new Date(), status: "InProgress" })
                .where(eq(tasks.id, id));
            return res.json({ success: true, message: "Timer restarted" });
        }

        await transitionWorkflowByTask({
            taskId: id,
            nextPhase: "RUNNING_PROJECT",
            actorUserId: userId,
            action: "TIMER_STARTED",
            actorRoles: [...(req.user!.roles || []), req.user!.roleId],
            enforceContent: true,
            patch: { executionStartedAt: new Date() },
            applyWithinTx: async (tx) => {
                await tx.update(tasks)
                    .set({ timerStartedAt: new Date(), status: "InProgress" })
                    .where(eq(tasks.id, id));
            },
        });

        await ActivityLogService.log({
            userId,
            action: "TIMER_STARTED",
            resourceType: "Task",
            resourceId: id,
        });

        res.json({ success: true, message: "Timer started" });
    } catch (error) {
        if (mapWorkflowError(res, error)) return;
        res.status(500).json({ success: false, error: "Failed to start timer" });
    }
});

// POST /api/tasks/:id/timers/stop
taskExecutionRouter.post("/:id/timers/stop", requireRole("product_posting_executive", "posting_executive", "admin", "product_posting_manager", "dd_manager", "dd_executive", "d_d_executive"), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;
        const userRole = req.user!.roleId;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!task) return res.status(404).json({ success: false, error: "Task not found" });

        const isManager = ["admin", "product_posting_manager", "dd_manager"].includes(userRole);
        if (task.assignedToUserId !== userId && !isManager) {
            return res.status(403).json({ success: false, error: "Insufficient permissions to stop this timer" });
        }

        if (!task.timerStartedAt) {
            return res.status(400).json({ success: false, error: "Timer is not running" });
        }

        const timeSpentMs = Date.now() - task.timerStartedAt.getTime();
        const timeSpentMinutes = Math.floor(timeSpentMs / (1000 * 60));

        await db.update(tasks)
            .set({ timerStartedAt: null })
            .where(eq(tasks.id, id));

        if (timeSpentMinutes > 0) {
            await db.insert(taskTimeLogs).values({
                taskId: id,
                userId,
                timeSpentMinutes,
                logDate: new Date()
            });
        }

        await ActivityLogService.log({
            userId,
            action: "TIMER_STOPPED",
            resourceType: "Task",
            resourceId: id,
            details: `Logged ${timeSpentMinutes} minutes`
        });

        res.json({ success: true, message: "Timer stopped", timeLogged: timeSpentMinutes });
    } catch (error) {
        console.error("[TIMER_STOP_ERROR]", error);
        res.status(500).json({ success: false, error: "Failed to stop timer" });
    }
});

// POST /api/tasks/:id/extensions
taskExecutionRouter.post("/:id/extensions", requireRole("product_posting_executive", "posting_executive", "admin", "dd_executive", "d_d_executive"), async (req, res) => {
    try {
        const { id } = req.params;
        const { requestedTimeMinutes, reason } = req.body;
        const userId = req.user!.userId;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!task) return res.status(404).json({ success: false, error: "Task not found" });

        // Ownership: only the assigned executive may request an extension on a
        // task. Admins are exempted. A non-owner is rejected with 403 BEFORE any
        // write.
        const isAdmin =
            (req.user!.roles || []).includes("admin") || req.user!.roleId === "admin";
        const ownershipSatisfied = task.assignedToUserId === userId || isAdmin;
        if (!ownershipSatisfied) {
            return res.status(403).json({
                success: false,
                error: "You are not assigned to this task.",
                code: "WORKFLOW_OWNERSHIP_FORBIDDEN",
            });
        }

        // Business validation of the payload — reject (400) before any write so a
        // bad request creates no row.
        const inputError = validateExtensionRequestInput({ requestedTimeMinutes, reason });
        if (inputError) {
            return res
                .status(inputError.status)
                .json({ success: false, error: inputError.message, code: inputError.code });
        }

        // Prevent stacking: only one pending extension request per task at a time.
        const [pendingExtension] = await db
            .select()
            .from(taskTimeExtensions)
            .where(and(eq(taskTimeExtensions.taskId, id), eq(taskTimeExtensions.status, "PENDING")));
        if (pendingExtension) {
            return res.status(400).json({
                success: false,
                error: "A pending extension request already exists for this task.",
                code: "EXTENSION_DUPLICATE_PENDING",
            });
        }

        // The extension insert runs INSIDE the transition's transaction so a
        // rejected transition (ownership 403 / illegal state) leaves no row.
        let ext: any;
        await transitionWorkflowByTask({
            taskId: id,
            nextPhase: "RUNNING_PROJECT",
            actorUserId: userId,
            action: "EXTENSION_REQUESTED",
            actorRoles: [...(req.user!.roles || []), req.user!.roleId],
            ownershipSatisfied,
            enforceContent: true,
            remarks: reason,
            patch: {
                overtimeRequestedMinutes: Number(requestedTimeMinutes) || 0,
                overtimeReason: reason,
            },
            applyWithinTx: async (tx) => {
                const [row] = await tx.insert(taskTimeExtensions).values({
                    taskId: id,
                    requestedTimeMinutes,
                    reason,
                    status: "PENDING"
                }).returning();
                ext = row;
            },
        });

        await NotificationService.notify({
            userId: "product_posting_manager",
            message: `Time extension requested for task '${task.title}'. Reason: ${reason}`,
            type: "WARNING"
        });

        await ActivityLogService.log({
            userId,
            action: "EXTENSION_REQUESTED",
            resourceType: "TaskExtension",
            resourceId: ext.id,
        });

        res.json({ success: true, data: ext });
    } catch (error) {
        if (mapWorkflowError(res, error)) return;
        res.status(500).json({ success: false, error: "Failed to request extension" });
    }
});

// POST /api/tasks/:id/complete
taskExecutionRouter.post("/:id/complete", requireRole("product_posting_executive", "posting_executive", "admin", "dd_executive", "d_d_executive"), async (req, res) => {
    try {
        const { id } = req.params;
        const { linksPosted, outputNotes } = req.body;
        const userId = req.user!.userId;

        const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!task) return res.status(404).json({ success: false, error: "Task not found" });

        if (task.timerStartedAt) {
            return res.status(400).json({ success: false, error: "Cannot complete task while timer is running!" });
        }

        // Content guard mirrors the central EXECUTIVE_SUBMITTED evidence rule, run
        // BEFORE any write so a content rejection never leaves a partial result.
        if ((Number(linksPosted) || 0) < 1) {
            return res.status(400).json({
                success: false,
                error: "At least one evidence link is required to submit this task.",
                code: "WORKFLOW_EVIDENCE_REQUIRED",
            });
        }

        const totalDurationMinutes = await getTaskSpentMinutes(id);

        // Save outputNotes directly on task notes field so frontend can display submitted links
        const notesUpdate: any = { status: "InProgress" as any };
        if (outputNotes) notesUpdate.notes = outputNotes;

        // The taskResults upsert + task notes write run INSIDE the transition's
        // transaction so an ownership 403 (wrong executive) or content 400 leaves
        // no partial result row.
        await transitionWorkflowByTask({
            taskId: id,
            nextPhase: "RUNNING_PROJECT",
            actorUserId: userId,
            action: "EXECUTIVE_SUBMITTED",
            actorRoles: [...(req.user!.roles || []), req.user!.roleId],
            evidenceCount: Number(linksPosted) || 0,
            enforceContent: true,
            patch: {
                executiveSubmittedAt: new Date(),
                outputNotes: outputNotes || null,
            },
            applyWithinTx: async (tx) => {
                await tx.insert(taskResults).values({
                    taskId: id,
                    linksPosted: linksPosted || 0,
                    totalDurationMinutes
                }).onConflictDoUpdate({
                    target: taskResults.taskId,
                    set: {
                        linksPosted: linksPosted || 0,
                        totalDurationMinutes,
                        updatedAt: new Date(),
                    }
                });
                await tx.update(tasks).set(notesUpdate).where(eq(tasks.id, id));
            }
        });

        await ActivityLogService.log({
            userId,
            action: "COMPLETED",
            resourceType: "Task",
            resourceId: id,
            details: `Completed task with ${linksPosted} links posted in ${totalDurationMinutes} mins`
        });

        await NotificationService.notify({
            userId: "product_posting_manager",
            message: `Task '${task.title}' has been submitted for manager completion review.`,
            type: "INFO"
        });

        res.json({ success: true, message: "Task submitted to manager review" });
    } catch (error) {
        console.error("Task Complete Error:", error);
        if (mapWorkflowError(res, error)) return;
        res.status(500).json({ success: false, error: (error as Error).message || "Failed to complete task" });
    }
});
