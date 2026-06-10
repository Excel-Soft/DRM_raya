import { Router } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, pool } from "../db";
import { requireRole } from "../auth.middleware";
import {
  PRODUCT_POSTING_PHASE_LABELS,
  productPostingCommissionSlabs,
  productPostingEvidenceLinks,
  productPostingWorkflows,
  projects,
  taskResults,
  taskStatusHistory,
  tasks,
  users,
} from "../../shared/schema";
import {
  ensureProductPostingWorkflowInfrastructure,
  getExecutionRowsForRole,
  getOrCreateProductPostingWorkflow,
  getTaskSpentMinutes,
  getWorkflowQueueForManager,
  transitionWorkflowByProject,
  transitionWorkflowByTask,
} from "../services/product-posting-workflow.service";
import { mapWorkflowError } from "../services/workflow-transition.service";
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

export const productPostingWorkflowRouter = Router();

productPostingWorkflowRouter.use(async (_req, _res, next) => {
  try {
    await ensureProductPostingWorkflowInfrastructure();
    next();
  } catch (error) {
    next(error);
  }
});

productPostingWorkflowRouter.get("/phase-definitions", async (_req, res) => {
  const phases = Object.entries(PRODUCT_POSTING_PHASE_LABELS).map(([key, label], index) => ({
    phaseKey: key,
    label,
    sortOrder: index + 1,
  }));
  res.json({ success: true, data: phases });
});

productPostingWorkflowRouter.get("/commission-slabs", async (_req, res) => {
  const slabs = await db.select().from(productPostingCommissionSlabs).orderBy(productPostingCommissionSlabs.minValue);
  res.json({ success: true, data: slabs });
});

productPostingWorkflowRouter.get("/manager/queue", requireRole("product_posting_manager", "dd_manager", "qa_manager", "admin"), async (req, res) => {
  const callerRole = (req.user as any)?.roleId || (req.user as any)?.role || "";
  const items = await getWorkflowQueueForManager(callerRole);
  res.json({ success: true, data: items });
});

productPostingWorkflowRouter.get("/qa/queue", requireRole("qa_manager", "admin"), async (req, res) => {
  const items = await getExecutionRowsForRole("qa_manager", req.user!.userId);
  res.json({ success: true, data: items });
});

productPostingWorkflowRouter.get("/verification/queue", requireRole("verification_manager", "admin"), async (req, res) => {
  const items = await getExecutionRowsForRole("verification_manager", req.user!.userId);
  res.json({ success: true, data: items });
});

productPostingWorkflowRouter.post("/workflows/:projectId/transition", requireRole("product_posting_manager", "dd_manager", "admin"), async (req, res) => {
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
        actorRoles: [...(req.user!.roles || []), req.user!.roleId],
        enforceContent: true,
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
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to transition workflow" });
  }
});

productPostingWorkflowRouter.post("/projects/:projectId/assign-task", requireRole("product_posting_manager", "dd_manager", "qa_manager", "admin"), async (req, res) => {
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

    // Get invoice to determine the correct task type label. The label is still
    // derived from the invoice's free-text project name; only the routing URL
    // below reads the structured department column.
    let taskTypeLabel = "Product Listing";
    let invNameLower = "";
    if ((project as any).invoiceId) {
      try {
        // Parameterized to avoid SQL injection via invoiceId.
        const invResult = await pool.query(
          `SELECT project_name FROM drm.product_posting_invoices WHERE id = $1 LIMIT 1`,
          [(project as any).invoiceId]
        );
        const invName: string = (invResult?.rows?.[0] as any)?.project_name || "";
        if (invName) {
          taskTypeLabel = invName;
          invNameLower = invName.toLowerCase();
        }
      } catch (_e) {}
    }

    // Choose the executive dashboard URL from the project's stored structured
    // department first. Only fall back to the fragile invoice-name match when the
    // column is null (legacy projects created before department_type existed).
    // Mapping is behavior-preserving: D&D → DND executive, everything else → PP.
    let executiveDashboardUrl = "/product-posting/executive"; // default: PP executive
    const storedDept = (project as any).departmentType as string | null | undefined;
    if (storedDept === "DND") {
      executiveDashboardUrl = "/dd-executive-dashboard";
    } else if (storedDept === "PRODUCT_POSTING" || storedDept === "SOFTWARE") {
      executiveDashboardUrl = "/product-posting/executive";
    } else if (
      invNameLower.includes("listing") ||
      invNameLower.includes("minisite") ||
      invNameLower.includes("mini site") ||
      invNameLower.includes("mini-site")
    ) {
      // Route to D&D Executive dashboard for Listing Page and Alibaba Minisite.
      // Alibaba Product Posting stays on /product-posting/executive (default).
      executiveDashboardUrl = "/dd-executive-dashboard";
    }

    const workflow = await getOrCreateProductPostingWorkflow(projectId);
    if (!["PROJECT_OVERVIEW", "TASK_ASSIGNMENT", "RETURNED_FOR_CHANGE", "RUNNING_PROJECT"].includes(workflow.currentPhase)) {
      return res.status(400).json({ success: false, error: "Project is not ready for task assignment" });
    }

    // Structured routing department for the sub-project: derive from the parent's
    // stored department_type when present, otherwise from the DND-ness already
    // resolved above (executiveDashboardUrl). Stored so downstream routing reads a
    // value instead of re-guessing from names.
    const subDepartmentType =
      (project as any).departmentType ||
      (executiveDashboardUrl === "/dd-executive-dashboard" ? "DND" : "PRODUCT_POSTING");

    // Automatically create a new project in PMS so it shows up in the Project Status table
    let targetProjectId = projectId;
    try {
      const [newProject] = await db.insert(projects).values({
        name: title || `${project.name}`,
        customerId: project.customerId,
        invoiceId: project.invoiceId,
        ownerUserId: assigneeId,
        status: 'Active',
        departmentType: subDepartmentType,
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
      actorRoles: [...(req.user!.roles || []), req.user!.roleId],
      enforceContent: true,
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
      resourceType: "ProductPostingWorkflow",
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
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to assign task" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/evidence-links", requireRole("product_posting_executive", "posting_executive", "admin", "dd_executive", "d_d_executive"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { url, label, linkType = "output" } = req.body;
    const actorUserId = req.user!.userId;

    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    if (!isValidHttpUrl(trimmedUrl)) {
      return res.status(400).json({ success: false, error: "Enter a valid URL starting with http:// or https://" });
    }

    const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });
    if (workflow.executiveUserId !== actorUserId && req.user!.roleId !== "admin") {
      return res.status(403).json({ success: false, error: "You can only upload links for your assigned task" });
    }

    const existingLinks = await db.select().from(productPostingEvidenceLinks).where(eq(productPostingEvidenceLinks.taskId, taskId));
    if (existingLinks.some((l) => (l.url || "").trim() === trimmedUrl)) {
      return res.status(409).json({ success: false, error: "This link has already been added for this task" });
    }

    const [link] = await db.insert(productPostingEvidenceLinks).values({
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
      resourceType: "ProductPostingEvidenceLink",
      resourceId: link.id,
      details: url,
    });

    res.json({ success: true, data: link });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to save evidence link" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/request-overtime", requireRole("product_posting_executive", "posting_executive", "admin", "dd_executive", "d_d_executive"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { requestedMinutes, reason } = req.body;
    const actorUserId = req.user!.userId;
    const actorRole = (req.user as any)?.roleId || "";

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, error: "Reason is required for overtime" });
    }

    const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, taskId));
    if (!workflow) {
      // No workflow found (D&D / Listing tasks) - save directly to overtime_records
      const taskRes = await pool.query("SELECT title FROM drm.tasks WHERE id = $1", [taskId]);
      const taskTitle = taskRes.rows[0]?.title || "Task";
      const hours = ((Number(requestedMinutes) || 60) / 60).toFixed(2);
      await pool.query(`INSERT INTO drm.overtime_records (id, user_id, date, hours, status, reason, task_title, task_details, created_at, updated_at) VALUES (gen_random_uuid(), $1, NOW(), $2, 'Pending', $3, $4, $5, NOW(), NOW())`, [actorUserId, hours, reason, taskTitle, `TaskID: ${taskId}`]);
      const targetManager = (actorRole === "dd_executive" || actorRole === "d_d_executive") ? "dd_manager" : "product_posting_manager";
      await NotificationService.notify({ userId: targetManager, message: `Overtime requested for task "${taskTitle}". Reason: ${reason}. Minutes: ${requestedMinutes}`, type: "WARNING", targetUrl: actorRole.includes("dd") ? "/hr/overtime" : "/product-posting/manager" });
      await ActivityLogService.log({ userId: actorUserId, action: "OVERTIME_REQUESTED", resourceType: "Task", resourceId: taskId, details: `${requestedMinutes} minutes. Reason: ${reason}` });
      return res.json({ success: true });
    }

    await db.update(productPostingWorkflows).set({
      overtimeRequestedMinutes: Number(requestedMinutes) || 0,
      overtimeReason: reason,
      updatedAt: new Date(),
    } as any).where(eq(productPostingWorkflows.id, workflow.id));

    await ActivityLogService.log({
      userId: actorUserId,
      action: "OVERTIME_REQUESTED",
      resourceType: "ProductPostingWorkflow",
      resourceId: workflow.id,
      details: `${requestedMinutes} minutes requested`,
    });

    await NotificationService.notify({
      userId: workflow.managerUserId || "product_posting_manager",
      message: `Overtime requested for a Product Posting task. Reason: ${reason}`,
      type: "WARNING",
      targetUrl: "/product-posting/manager",
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to request overtime" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/submit-to-manager", requireRole("product_posting_executive", "posting_executive", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { outputNotes } = req.body;
    const actorUserId = req.user!.userId;

    const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    const spentMinutes = await getTaskSpentMinutes(taskId);
    const evidenceCount = await db.select().from(productPostingEvidenceLinks).where(eq(productPostingEvidenceLinks.taskId, taskId));

    if (!evidenceCount.length) {
      return res.status(400).json({ success: false, error: "Upload at least one output/evidence link before submission" });
    }

    if (spentMinutes > (workflow.assignedDurationMinutes || 0) + (workflow.overtimeApprovedMinutes || 0) && !workflow.overtimeReason) {
      return res.status(400).json({ success: false, error: "Overtime reason is required before submission" });
    }

    await transitionWorkflowByTask({
      taskId,
      nextPhase: "RUNNING_PROJECT",
      actorUserId,
      action: "EXECUTIVE_SUBMITTED",
      actorRoles: [...(req.user!.roles || []), req.user!.roleId],
      evidenceCount: evidenceCount.length,
      enforceContent: true,
      patch: {
        executiveSubmittedAt: new Date(),
        outputNotes: outputNotes || null,
      },
      applyWithinTx: async (tx) => {
        await tx.insert(taskResults).values({
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
        await tx.update(tasks).set({ status: "InProgress" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
      },
    });

    await NotificationService.notify({
      userId: workflow.managerUserId || "product_posting_manager",
      message: "A Product Posting task has been submitted for manager completion review.",
      type: "INFO",
      targetUrl: "/product-posting/manager",
    });

    res.json({ success: true });
  } catch (error: any) {
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to submit task to manager" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/manager-complete", requireRole("product_posting_manager", "admin"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { remarks } = req.body;
    const actorUserId = req.user!.userId;

    const workflow = await transitionWorkflowByTask({
      taskId,
      nextPhase: "QA_REVIEW",
      actorUserId,
      action: "MANAGER_COMPLETE",
      actorRoles: [...(req.user!.roles || []), req.user!.roleId],
      enforceContent: true,
      remarks,
      patch: {
        managerCompletedAt: new Date(),
        managerUserId: actorUserId,
      },
      applyWithinTx: async (tx) => {
        await tx.update(tasks).set({ status: "READY_FOR_QA" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
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
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to mark manager complete" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/qa-review", requireRole("qa_manager", "admin"), async (req, res) => {
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

    const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    if (action === "complete") {
      const updated = await transitionWorkflowByTask({
        taskId,
        nextPhase: "VERIFICATION_PENDING",
        actorUserId,
        action: "QA_COMPLETE",
        actorRoles: [...(req.user!.roles || []), req.user!.roleId],
        enforceContent: true,
        remarks,
        patch: {
          qaReviewedAt: new Date(),
          qaUserId: actorUserId,
          qaRemarks: remarks || null,
        },
        applyWithinTx: async (tx) => {
          await tx.update(tasks).set({ status: "Completed" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
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

    const updated = await transitionWorkflowByTask({
      taskId,
      nextPhase: "RETURNED_FOR_CHANGE",
      actorUserId,
      action: "QA_RETURNED",
      actorRoles: [...(req.user!.roles || []), req.user!.roleId],
      enforceContent: true,
      remarks,
      patch: {
        qaReviewedAt: new Date(),
        qaUserId: actorUserId,
        qaRemarks: remarks,
        returnCount: (workflow.returnCount || 0) + 1,
        lastReturnReason: remarks,
      },
      applyWithinTx: async (tx) => {
        await tx.update(tasks).set({ status: "Blocked" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
      },
    });
    let targetDashboard = "/product-posting/manager";
    if (workflow.managerUserId) {
      const [manager] = await db.select().from(users).where(eq(users.id, workflow.managerUserId));
      if (manager && (manager.roleId === "dd_manager" || manager.roleId === "d_d_manager" || (manager.role || "").toLowerCase().includes("dd"))) {
        targetDashboard = "/dashboard/dd-manager";
      }
    }

    await NotificationService.notify({
      userId: workflow.managerUserId || "product_posting_manager",
      message: `QA returned a Product Posting task for changes. ${remarks}`,
      type: "WARNING",
      targetUrl: targetDashboard,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to process QA review" });
  }
});

productPostingWorkflowRouter.post("/tasks/:taskId/verification-review", requireRole("verification_manager", "admin"), async (req, res) => {
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

    const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, taskId));
    if (!workflow) return res.status(404).json({ success: false, error: "Workflow not found" });

    if (action === "complete") {
      const updated = await transitionWorkflowByTask({
        taskId,
        nextPhase: "VERIFICATION_COMPLETE",
        actorUserId,
        action: "VERIFICATION_COMPLETE",
        actorRoles: [...(req.user!.roles || []), req.user!.roleId],
        enforceContent: true,
        remarks,
        patch: {
          verificationReviewedAt: new Date(),
          verificationUserId: actorUserId,
          verificationRemarks: remarks || null,
        },
        applyWithinTx: async (tx) => {
          await tx.update(tasks).set({ status: "Completed" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
        },
      });

      // Stage 3: final-completion visibility. Notify the executive who did the
      // work and the owning manager that the task cleared verification (the final
      // workflow phase). Best-effort — notification failures never block the
      // transition response.
      try {
        const [completedTask] = await db.select().from(tasks).where(eq(tasks.id, taskId));
        const completionMessage = `Product Posting task "${completedTask?.title || taskId}" has cleared verification and is now complete.`;
        if (completedTask?.assignedToUserId) {
          await NotificationService.notify({
            userId: completedTask.assignedToUserId,
            message: completionMessage,
            type: "SUCCESS",
            targetUrl: "/product-posting/executive",
          });
        }
        await NotificationService.notify({
          userId: workflow.managerUserId || "product_posting_manager",
          message: completionMessage,
          type: "SUCCESS",
          targetUrl: "/product-posting/manager",
        });
      } catch (notifyErr) {
        console.error("[PRODUCT_POSTING_VERIFICATION_COMPLETE] notification failed (non-fatal):", notifyErr);
      }

      return res.json({ success: true, data: updated });
    }

    const updated = await transitionWorkflowByTask({
      taskId,
      nextPhase: "QA_REVIEW",
      actorUserId,
      action: "VERIFICATION_RETURNED",
      actorRoles: [...(req.user!.roles || []), req.user!.roleId],
      enforceContent: true,
      remarks,
      patch: {
        verificationReviewedAt: new Date(),
        verificationUserId: actorUserId,
        verificationRemarks: remarks || null,
        returnCount: (workflow.returnCount || 0) + 1,
        lastReturnReason: remarks || workflow.lastReturnReason,
      },
      applyWithinTx: async (tx) => {
        await tx.update(tasks).set({ status: "Blocked" as any, updatedAt: new Date() }).where(eq(tasks.id, taskId));
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
    if (mapWorkflowError(res, error)) return;
    res.status(500).json({ success: false, error: error?.message || "Failed to process verification review" });
  }
});

productPostingWorkflowRouter.get("/task/:taskId/report-links", async (req, res) => {
  const items = await db
    .select()
    .from(productPostingEvidenceLinks)
    .where(eq(productPostingEvidenceLinks.taskId, req.params.taskId))
    .orderBy(desc(productPostingEvidenceLinks.createdAt));
  res.json({ success: true, data: items });
});

productPostingWorkflowRouter.get("/report-links", async (req, res) => {
  try {
    const { userFilter, startDate, endDate } = req.query;
    const conditions = [];

    if (userFilter && userFilter !== "all") {
      conditions.push(eq(productPostingEvidenceLinks.createdByUserId, String(userFilter)));
    }

    if (startDate) {
      conditions.push(gte(productPostingEvidenceLinks.createdAt, new Date(String(startDate))));
    }
    if (endDate) {
      const end = new Date(String(endDate));
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(productPostingEvidenceLinks.createdAt, end));
    }

    const items = await db
      .select({
        id: productPostingEvidenceLinks.id,
        url: productPostingEvidenceLinks.url,
        label: productPostingEvidenceLinks.label,
        createdAt: productPostingEvidenceLinks.createdAt,
        projectId: productPostingEvidenceLinks.projectId,
        projectName: projects.name
      })
      .from(productPostingEvidenceLinks)
      .leftJoin(projects, eq(productPostingEvidenceLinks.projectId, projects.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(productPostingEvidenceLinks.createdAt));

    // Map to a structure similar to ProductPostingData so the UI table works out of the box
    // The UI currently expects: item.id, item.title, item.keywords, item.createdAt
    const mappedItems = items.map(item => ({
      id: item.id,
      title: item.projectName || "Unknown Project",
      keywords: item.url || "",
      createdAt: item.createdAt,
    }));

    res.json({ success: true, data: mappedItems });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || "Failed to fetch report links" });
  }
});

productPostingWorkflowRouter.get("/task/:taskId/rework-history", async (req, res) => {
  const [workflow] = await db.select().from(productPostingWorkflows).where(eq(productPostingWorkflows.taskId, req.params.taskId));
  if (!workflow) return res.json({ success: true, data: [] });
  const items = await db
    .select()
    .from(taskStatusHistory)
    .where(eq(taskStatusHistory.taskId, req.params.taskId))
    .orderBy(desc(taskStatusHistory.changedAt));
  res.json({ success: true, data: items });
});


