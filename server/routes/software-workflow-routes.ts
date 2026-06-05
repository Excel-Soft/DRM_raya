import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { requireRole } from "../auth.middleware";
import {
  SOFTWARE_PHASE_LABELS,
  softwareCommissionSlabs,
  softwareEvidenceLinks,
  softwareWorkflows,
  projects,
  taskResults,
  taskStatusHistory,
  tasks,
  users,
} from "../../shared/schema";
import {
  ensureSoftwareWorkflowInfrastructure,
  getExecutionRowsForRole,
  getOrCreateSoftwareWorkflow,
  getTaskSpentMinutes,
  getWorkflowQueueForManager,
  transitionWorkflowByProject,
  transitionWorkflowByTask,
} from "../services/software-workflow.service";
import { ActivityLogService } from "../services/activity-service";
import { NotificationService } from "../services/notification-service";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Defense-in-depth ID validation. All DB access below already uses parameterized
// queries (Drizzle `eq()` / `sql` template tags), so this is not the injection
// boundary; it simply rejects obviously malformed identifiers early.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export const softwareWorkflowRouter = Router();

softwareWorkflowRouter.use(async (_req, _res, next) => {
  try {
    await ensureSoftwareWorkflowInfrastructure();
    next();
  } catch (error) {
    next(error);
  }
});

softwareWorkflowRouter.get("/phase-definitions", async (_req, res) => {
  const phases = Object.entries(SOFTWARE_PHASE_LABELS).map(([key, label], index) => ({
    phaseKey: key,
    label,
    sortOrder: index + 1,
  }));
  res.json({ success: true, data: phases });
});

softwareWorkflowRouter.get("/commission-slabs", async (_req, res) => {
  const slabs = await db.select().from(softwareCommissionSlabs).orderBy(softwareCommissionSlabs.minValue);
  res.json({ success: true, data: slabs });
});

softwareWorkflowRouter.get("/manager/queue", requireRole("software_manager", "software_manager", "qa_manager", "admin"), async (_req, res) => {
  const items = await getWorkflowQueueForManager();
  res.json({ success: true, data: items });
});

softwareWorkflowRouter.get("/qa/queue", requireRole("qa_manager", "admin"), async (req, res) => {
  const items = await getExecutionRowsForRole("qa_manager", req.user!.userId);
  res.json({ success: true, data: items });
});

softwareWorkflowRouter.get("/verification/queue", requireRole("verification_manager", "admin"), async (req, res) => {
  const items = await getExecutionRowsForRole("verification_manager", req.user!.userId);
  res.json({ success: true, data: items });
});

softwareWorkflowRouter.post("/workflows/:projectId/transition", requireRole("software_manager", "software_manager", "admin"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, notes } = req.body;
    const actorUserId = req.user!.userId;

    if (!isUuid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project id" });
    }

    if (status === "APPROVED") {
      await transitionWorkflowByProject({
        projectId,
        nextPhase: "PROJECT_OVERVIEW",
        actorUserId,
        action: "DATA_VERIFIED",
        patch: {
          dataVerifiedAt: new Date(),
          managerUserId: actorUserId,
        }
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "Unsupported transition status" });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to transition workflow" });
  }
});

softwareWorkflowRouter.post("/projects/:projectId/assign-task", requireRole("software_manager", "software_manager", "qa_manager", "admin"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { assigneeId, title, description, assignedDurationMinutes, links } = req.body;
    const managerUserId = req.user!.userId;

    if (!isUuid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project id" });
    }

    console.log(`[ASSIGN_TASK] Project: ${projectId}, Assignee: ${assigneeId}, Manager: ${managerUserId}`);

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    // Get invoice to determine correct task type label and executive dashboard URL
    let taskTypeLabel = "Product Listing";
    let executiveDashboardUrl = "/product-posting/executive"; // default: PP executive
    if ((project as any).invoiceId) {
      try {
        const invResult = await db.execute(
          sql`SELECT project_name FROM drm.product_posting_invoices WHERE id = ${(project as any).invoiceId} LIMIT 1`
        );
        const invName: string = (invResult?.rows?.[0] as any)?.project_name || "";
        if (invName) {
          taskTypeLabel = invName;
          const lower = invName.toLowerCase();
          if (lower.includes("listing") || lower.includes("minisite") || lower.includes("mini site") || lower.includes("mini-site")) {
            executiveDashboardUrl = "/dd-executive-dashboard";
          }
        }
      } catch (_e) {}
    }

    const workflow = await getOrCreateSoftwareWorkflow(projectId);
    if (!["PROJECT_OVERVIEW", "TASK_ASSIGNMENT", "RETURNED_FOR_CHANGE", "RUNNING_PROJECT"].includes(workflow.currentPhase)) {
      return res.status(400).json({ success: false, error: "Project is not ready for task assignment" });
    }

    // Automatically create a new project in PMS so it shows up in the Project Status table
    let targetProjectId = projectId;
    try {
      const [newProject] = await db.insert(projects).values({
        name: title || `${project.name}`,
        customerId: project.customerId,
        invoiceId: project.invoiceId,
        ownerUserId: assigneeId,
        status: 'Active',
        description: description || `Task assigned from ${project.name}`,
      } as any).returning();
      if (newProject) {
          targetProjectId = newProject.id;
      }
    } catch (err) {
      console.error("[ASSIGN_TASK] Failed to create sub-project in PMS:", err);
    }

    const [existingTask] = await db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(desc(tasks.createdAt));
    let taskId = existingTask?.id;

    if (existingTask) {
      await db.update(tasks).set({
        title: title || existingTask.title,
        description: description || existingTask.description,
        assignedToUserId: assigneeId,
        projectId: targetProjectId, // Move task to new project
        dueDate: assignedDurationMinutes ? new Date(Date.now() + Number(assignedDurationMinutes) * 60 * 1000) : existingTask.dueDate,
        status: "ToDo" as any,
        notes: JSON.stringify({ duration: assignedDurationMinutes, links: links || "" }),
        updatedAt: new Date(),
      }).where(eq(tasks.id, existingTask.id));
    } else {
      const [task] = await db.insert(tasks).values({
        projectId: targetProjectId,
        ownerUserId: managerUserId,
        assignedToUserId: assigneeId,
        title: title || `Product Posting - ${project.name}`,
        description: description || project.description || `Assigned for product posting workflow of ${project.name}`,
        status: "ToDo" as any,
        notes: JSON.stringify({ duration: assignedDurationMinutes, links: links || "" }),
        dueDate: assignedDurationMinutes ? new Date(Date.now() + Number(assignedDurationMinutes) * 60 * 1000) : null,
      } as any).returning();
      taskId = task.id;
    }

    console.log(`[ASSIGN_TASK] Assigning task for project ${targetProjectId} to user ${assigneeId} duration ${assignedDurationMinutes}`);

    await transitionWorkflowByProject({
      projectId,
      nextPhase: "RUNNING_PROJECT",
      actorUserId: managerUserId,
      action: "TASK_ASSIGNED",
      patch: {
        taskId,
        executiveUserId: assigneeId,
        managerUserId,
        assignedAt: new Date(),
        assignedDurationMinutes: Number(assignedDurationMinutes) || 0,
        executiveSubmittedAt: null,
        managerCompletedAt: null,
        qaReviewedAt: null,
        verificationReviewedAt: null,
      },
    });



    await ActivityLogService.log({
      userId: managerUserId,
      action: "TASK_ASSIGNED",
      resourceType: "SoftwareWorkflow",
      resourceId: projectId,
      details: `Assigned product posting task to executive with ${Number(assignedDurationMinutes) || 0} minutes`,
    });

    await NotificationService.notify({
      userId: assigneeId,
      message: `A ${taskTypeLabel} task has been assigned to you for project '${project.name}'.`,
      type: "INFO",
      targetUrl: executiveDashboardUrl,
    });

    res.json({ success: true, taskId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to assign task" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/evidence-links", requireRole("software_executive", "software_executive", "admin", "software_executive", "software_executive"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { url, label, linkType = "output" } = req.body;
    const actorUserId = req.user!.userId;

    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    if (!isValidHttpUrl(trimmedUrl)) {
      return res.status(400).json({ success: false, error: "Enter a valid URL starting with http:// or https://" });
    }

    const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });
    if (workflow.executiveUserId !== actorUserId && req.user!.roleId !== "admin") {
      return res.status(403).json({ success: false, error: "You can only upload links for your assigned task" });
    }

    const existingLinks = await db.select().from(softwareEvidenceLinks).where(eq(softwareEvidenceLinks.taskId, taskId));
    if (existingLinks.some((l) => (l.url || "").trim() === trimmedUrl)) {
      return res.status(409).json({ success: false, error: "This link has already been added for this task" });
    }

    const [link] = await db.insert(softwareEvidenceLinks).values({
      workflowId: workflow.id,
      projectId: workflow.projectId,
      taskId,
      url: trimmedUrl,
      label,
      linkType,
      createdByUserId: actorUserId,
    } as any).returning();

    await ActivityLogService.log({
      userId: actorUserId,
      action: "EVIDENCE_LINK_ADDED",
      resourceType: "SoftwareEvidenceLink",
      resourceId: link.id,
      details: url,
    });

    res.json({ success: true, data: link });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to save evidence link" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/request-overtime", requireRole("software_executive", "software_executive", "admin", "software_executive", "software_executive"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { requestedMinutes, reason } = req.body;
    const actorUserId = req.user!.userId;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required for overtime" });
    }

    const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    await db.update(softwareWorkflows).set({
      overtimeRequestedMinutes: Number(requestedMinutes) || 0,
      overtimeReason: reason,
      updatedAt: new Date(),
    } as any).where(eq(softwareWorkflows.id, workflow.id));

    await ActivityLogService.log({
      userId: actorUserId,
      action: "OVERTIME_REQUESTED",
      resourceType: "SoftwareWorkflow",
      resourceId: workflow.id,
      details: `${requestedMinutes} minutes requested`,
    });

    await NotificationService.notify({
      userId: workflow.managerUserId || "software_manager",
      message: `Overtime requested for a Product Posting task. Reason: ${reason}`,
      type: "WARNING",
      targetUrl: "/dashboard/software-manager",
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to request overtime" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/submit-to-manager", requireRole("software_executive", "software_executive", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { outputNotes } = req.body;
    const actorUserId = req.user!.userId;

    const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    const spentMinutes = await getTaskSpentMinutes(taskId);
    const evidenceCount = await db.select().from(softwareEvidenceLinks).where(eq(softwareEvidenceLinks.taskId, taskId));

    if (!evidenceCount.length) {
      return res.status(400).json({ success: false, error: "Upload at least one output/evidence link before submission" });
    }

    if (spentMinutes > (workflow.assignedDurationMinutes || 0) + (workflow.overtimeApprovedMinutes || 0) && !workflow.overtimeReason) {
      return res.status(400).json({ success: false, error: "Overtime reason is required before submission" });
    }

    await db.insert(taskResults).values({
      taskId,
      linksPosted: evidenceCount.length,
      totalDurationMinutes: spentMinutes,
    } as any).onConflictDoUpdate({
      target: taskResults.taskId,
      set: {
        linksPosted: evidenceCount.length,
        totalDurationMinutes: spentMinutes,
        updatedAt: new Date(),
      },
    });

    await db.update(tasks).set({ status: "InProgress" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    await transitionWorkflowByTask({
      taskId,
      nextPhase: "RUNNING_PROJECT",
      actorUserId,
      action: "EXECUTIVE_SUBMITTED",
      patch: {
        executiveSubmittedAt: new Date(),
        outputNotes: outputNotes || null,
      },
    });

    await NotificationService.notify({
      userId: workflow.managerUserId || "software_manager",
      message: "A Product Posting task has been submitted for manager completion review.",
      type: "INFO",
      targetUrl: "/dashboard/software-manager",
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to submit task to manager" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/manager-complete", requireRole("software_manager", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { remarks } = req.body;
    const actorUserId = req.user!.userId;

    await db.update(tasks).set({ status: "READY_FOR_QA" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    const workflow = await transitionWorkflowByTask({
      taskId,
      nextPhase: "QA_REVIEW",
      actorUserId,
      action: "MANAGER_COMPLETE",
      remarks,
      patch: {
        managerCompletedAt: new Date(),
        managerUserId: actorUserId,
      },
    });

    await NotificationService.notify({
      userId: "qa_manager",
      message: "A Product Posting task is ready for QA review.",
      type: "INFO",
      targetUrl: "/qa/manager",
    });

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to mark manager complete" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/qa-review", requireRole("qa_manager", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, remarks } = req.body;
    const actorUserId = req.user!.userId;

    if (!["complete", "return"].includes(action)) {
      return res.status(400).json({ success: false, error: "Invalid QA action" });
    }

    if (action === "return" && !remarks?.trim()) {
      return res.status(400).json({ success: false, error: "Remarks are required when returning to executive" });
    }

    const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    if (action === "complete") {
      await db.update(tasks).set({ status: "Completed" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
      const updated = await transitionWorkflowByTask({
        taskId,
        nextPhase: "VERIFICATION_PENDING",
        actorUserId,
        action: "QA_COMPLETE",
        remarks,
        patch: {
          qaReviewedAt: new Date(),
          qaUserId: actorUserId,
          qaRemarks: remarks || null,
        },
      });
      await NotificationService.notify({
        userId: "verification_manager",
        message: "A Product Posting task is ready for verification review.",
        type: "INFO",
        targetUrl: "/verification/manager",
      });
      return res.json({ success: true, data: updated });
    }

    await db.update(tasks).set({ status: "Blocked" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    const updated = await transitionWorkflowByTask({
      taskId,
      nextPhase: "RETURNED_FOR_CHANGE",
      actorUserId,
      action: "QA_RETURNED",
      remarks,
      patch: {
        qaReviewedAt: new Date(),
        qaUserId: actorUserId,
        qaRemarks: remarks,
        returnCount: (workflow.returnCount || 0) + 1,
        lastReturnReason: remarks,
      },
    });
    let targetDashboard = "/dashboard/software-manager";
    if (workflow.managerUserId) {
      const [manager] = await db.select().from(users).where(eq(users.id, workflow.managerUserId));
      if (manager && (manager.roleId === "software_manager" || manager.roleId === "software_manager" || (manager.role || "").toLowerCase().includes("dd"))) {
        targetDashboard = "/dashboard/dd-manager";
      }
    }

    await NotificationService.notify({
      userId: workflow.managerUserId || "software_manager",
      message: `QA returned a Product Posting task for changes. ${remarks}`,
      type: "WARNING",
      targetUrl: targetDashboard,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to process QA review" });
  }
});

softwareWorkflowRouter.post("/tasks/:taskId/verification-review", requireRole("verification_manager", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, remarks } = req.body;
    const actorUserId = req.user!.userId;

    if (!["complete", "return"].includes(action)) {
      return res.status(400).json({ success: false, error: "Invalid verification action" });
    }

    if (action === "return" && !remarks?.trim()) {
      return res.status(400).json({ success: false, error: "A reason is required when returning a task" });
    }

    const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    if (action === "complete") {
      await db.update(tasks).set({ status: "Completed" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
      const updated = await transitionWorkflowByTask({
        taskId,
        nextPhase: "VERIFICATION_COMPLETE",
        actorUserId,
        action: "VERIFICATION_COMPLETE",
        remarks,
        patch: {
          verificationReviewedAt: new Date(),
          verificationUserId: actorUserId,
          verificationRemarks: remarks || null,
        },
      });
      return res.json({ success: true, data: updated });
    }

    await db.update(tasks).set({ status: "Blocked" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
    const updated = await transitionWorkflowByTask({
      taskId,
      nextPhase: "QA_REVIEW",
      actorUserId,
      action: "VERIFICATION_RETURNED",
      remarks,
      patch: {
        verificationReviewedAt: new Date(),
        verificationUserId: actorUserId,
        verificationRemarks: remarks || null,
        returnCount: (workflow.returnCount || 0) + 1,
        lastReturnReason: remarks || workflow.lastReturnReason,
      },
    });

    await NotificationService.notify({
      userId: "qa_manager",
      message: `Verification returned a Product Posting task to QA. ${remarks || ""}`.trim(),
      type: "WARNING",
      targetUrl: "/qa/manager",
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to process verification review" });
  }
});

softwareWorkflowRouter.get("/task/:taskId/report-links", async (req, res) => {
  const items = await db
    .select()
    .from(softwareEvidenceLinks)
    .where(eq(softwareEvidenceLinks.taskId, req.params.taskId))
    .orderBy(desc(softwareEvidenceLinks.createdAt));
  res.json({ success: true, data: items });
});

softwareWorkflowRouter.get("/report-links", async (_req, res) => {
  const items = await db
    .select()
    .from(softwareEvidenceLinks)
    .orderBy(desc(softwareEvidenceLinks.createdAt));
  res.json({ success: true, data: items });
});

softwareWorkflowRouter.get("/task/:taskId/rework-history", async (req, res) => {
  const [workflow] = await db.select().from(softwareWorkflows).where(eq(softwareWorkflows.taskId, req.params.taskId));
  if (!workflow) return res.json({ success: true, data: [] });
  const items = await db
    .select()
    .from(taskStatusHistory)
    .where(eq(taskStatusHistory.taskId, req.params.taskId))
    .orderBy(desc(taskStatusHistory.changedAt));
  res.json({ success: true, data: items });
});
