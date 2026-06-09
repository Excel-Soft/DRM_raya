import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  PRODUCT_POSTING_PHASE_KEYS,
  PRODUCT_POSTING_PHASE_LABELS,
  productPostingCommissionSlabs,
  productPostingEvidenceLinks,
  productPostingPhaseDefinitions,
  productPostingReworkHistory,
  productPostingWorkflows,
  projectDocuments,
  projects,
  taskResults,
  taskTimeExtensions,
  taskTimeLogs,
  tasks,
  users,
  productPostingInvoices,
} from "../../shared/schema";
import { db, pool } from "../db";
import {
  assertWorkflowTransition,
  maybeEscalateRework,
} from "./workflow-transition.service";

const DEFAULT_PHASES = PRODUCT_POSTING_PHASE_KEYS.map((phaseKey, index) => ({
  phaseKey,
  label: PRODUCT_POSTING_PHASE_LABELS[phaseKey],
  sortOrder: index + 1,
  isTerminal: phaseKey === "VERIFICATION_COMPLETE",
  canReturn: !["PENDING_PROJECT", "VERIFICATION_COMPLETE"].includes(phaseKey),
}));

const DEFAULT_COMMISSION_SLABS = [
  { name: "Starter", minValue: 0, maxValue: 25, commissionRate: "2.50", rateType: "percentage" },
  { name: "Growth", minValue: 26, maxValue: 100, commissionRate: "3.50", rateType: "percentage" },
  { name: "Scale", minValue: 101, maxValue: null, commissionRate: "5.00", rateType: "percentage" },
];

let workflowEnsured = false;

export async function ensureProductPostingWorkflowInfrastructure() {
  if (workflowEnsured) return;
  workflowEnsured = true;

  await pool.query(`
    create table if not exists drm.product_posting_phase_definitions (
      phase_key varchar(64) primary key,
      label text not null,
      sort_order integer not null default 0,
      is_terminal boolean not null default false,
      can_return boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists drm.product_posting_workflows (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null unique references drm.projects(id) on delete cascade,
      task_id uuid unique references drm.tasks(id) on delete set null,
      current_phase text not null default 'PENDING_PROJECT',
      salesperson_uploaded_at timestamptz,
      data_verified_at timestamptz,
      assigned_at timestamptz,
      assigned_duration_minutes integer not null default 0,
      execution_started_at timestamptz,
      executive_submitted_at timestamptz,
      manager_completed_at timestamptz,
      qa_reviewed_at timestamptz,
      verification_reviewed_at timestamptz,
      manager_user_id uuid references drm.users(id),
      executive_user_id uuid references drm.users(id),
      qa_user_id uuid references drm.users(id),
      verification_user_id uuid references drm.users(id),
      overtime_requested_minutes integer not null default 0,
      overtime_approved_minutes integer not null default 0,
      overtime_reason text,
      output_notes text,
      qa_remarks text,
      verification_remarks text,
      return_count integer not null default 0,
      last_return_reason text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists drm.product_posting_evidence_links (
      id uuid primary key default gen_random_uuid(),
      workflow_id uuid not null references drm.product_posting_workflows(id) on delete cascade,
      project_id uuid not null references drm.projects(id) on delete cascade,
      task_id uuid references drm.tasks(id) on delete cascade,
      url text not null,
      label text,
      link_type text not null default 'output',
      created_by_user_id uuid not null references drm.users(id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists drm.product_posting_rework_history (
      id uuid primary key default gen_random_uuid(),
      workflow_id uuid not null references drm.product_posting_workflows(id) on delete cascade,
      from_phase text,
      to_phase text not null,
      action text not null,
      remarks text,
      actor_user_id uuid not null references drm.users(id),
      metadata jsonb default '{}'::jsonb,
      created_at timestamptz not null default now()
    );

    create table if not exists drm.product_posting_commission_slabs (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      min_value integer not null default 0,
      max_value integer,
      commission_rate numeric(10,2) not null default 0,
      rate_type text not null default 'percentage',
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists drm.project_details (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null unique references drm.projects(id) on delete cascade,
      package_name text,
      minisite_url text,
      phone text,
      mobile text,
      address text,
      reference text,
      categories text,
      detail_notes text,
      evidence_url text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  for (const phase of DEFAULT_PHASES) {
    await db
      .insert(productPostingPhaseDefinitions)
      .values(phase)
      .onConflictDoUpdate({
        target: productPostingPhaseDefinitions.phaseKey,
        set: {
          label: phase.label,
          sortOrder: phase.sortOrder,
          isTerminal: phase.isTerminal,
          canReturn: phase.canReturn,
          updatedAt: new Date(),
        },
      });
  }

  const [slabCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productPostingCommissionSlabs);

  if (!slabCount?.count) {
    await db.insert(productPostingCommissionSlabs).values(DEFAULT_COMMISSION_SLABS as any);
  }
}

export async function getOrCreateProductPostingWorkflow(projectId: string) {
  await ensureProductPostingWorkflowInfrastructure();

  const [existing] = await db
    .select()
    .from(productPostingWorkflows)
    .where(eq(productPostingWorkflows.projectId, projectId));

  if (existing) return existing;

  const [created] = await db
    .insert(productPostingWorkflows)
    .values({
      projectId,
      currentPhase: "PENDING_PROJECT",
    } as any)
    .returning();

  return created;
}

export async function appendWorkflowHistory(
  input: {
    workflowId: string;
    fromPhase?: string | null;
    toPhase: string;
    action: string;
    remarks?: string | null;
    actorUserId: string;
    metadata?: Record<string, unknown>;
  },
  executor?: { insert: typeof db.insert },
) {
  // When running inside a transaction the infrastructure is already ensured by
  // the caller (getOrCreate*Workflow); only ensure on the standalone path.
  if (!executor) await ensureProductPostingWorkflowInfrastructure();
  const exec = executor ?? db;
  await exec.insert(productPostingReworkHistory).values({
    workflowId: input.workflowId,
    fromPhase: input.fromPhase ?? null,
    toPhase: input.toPhase,
    action: input.action,
    remarks: input.remarks ?? null,
    actorUserId: input.actorUserId,
    metadata: input.metadata ?? {},
  } as any);
}

/**
 * Bridge the executor's return-count patch to the centralized rework escalation.
 * Only QA/Verification returns carry a `returnCount` patch; others are no-ops.
 */
async function escalateReworkIfNeeded(
  module: "product-posting" | "software",
  workflowId: string,
  input: { action: string; patch?: Record<string, unknown>; actorUserId: string; remarks?: string | null; projectId?: string; taskId?: string },
) {
  const isReturn = input.action === "QA_RETURNED" || input.action === "VERIFICATION_RETURNED";
  const returnCount = Number((input.patch as any)?.returnCount);
  if (!isReturn || !Number.isFinite(returnCount)) return;
  await maybeEscalateRework({
    module,
    workflowId,
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    returnCount,
    actorUserId: input.actorUserId,
    reason: input.remarks ?? null,
  });
}

export async function transitionWorkflowByProject(input: {
  projectId: string;
  nextPhase: string;
  actorUserId: string;
  action: string;
  remarks?: string | null;
  patch?: Record<string, unknown>;
  actorRole?: string | null;
  actorRoles?: readonly string[] | null;
  ownershipSatisfied?: boolean;
  evidenceCount?: number;
  enforceContent?: boolean;
  override?: boolean;
  applyWithinTx?: (tx: any) => Promise<void>;
}) {
  const workflow = await getOrCreateProductPostingWorkflow(input.projectId);

  // Centralized guard — throws WorkflowTransitionError (400/403) before any write.
  assertWorkflowTransition({
    from: workflow.currentPhase,
    to: input.nextPhase,
    action: input.action,
    actorRole: input.actorRole,
    actorRoles: input.actorRoles,
    ownershipSatisfied:
      input.ownershipSatisfied ??
      (input.action === "EXECUTIVE_SUBMITTED"
        ? !(workflow as any).executiveUserId ||
          (workflow as any).executiveUserId === input.actorUserId
        : undefined),
    reason: input.remarks,
    evidenceCount: input.evidenceCount,
    enforceContent: input.enforceContent,
    override: input.override,
  });

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(productPostingWorkflows)
      .set({
        currentPhase: input.nextPhase,
        updatedAt: new Date(),
        ...(input.patch || {}),
      } as any)
      .where(eq(productPostingWorkflows.id, workflow.id))
      .returning();

    // Moving to DATA_VERIFY / PENDING_PROJECT / RUNNING_PROJECT marks project Active.
    if (['DATA_VERIFY', 'PENDING_PROJECT', 'RUNNING_PROJECT'].includes(input.nextPhase)) {
      await tx
        .update(projects)
        .set({ status: 'Active', updatedAt: new Date() })
        .where(eq(projects.id, input.projectId));
    }

    await appendWorkflowHistory(
      {
        workflowId: workflow.id,
        fromPhase: workflow.currentPhase,
        toPhase: input.nextPhase,
        action: input.action,
        remarks: input.remarks,
        actorUserId: input.actorUserId,
        metadata: input.patch,
      },
      tx,
    );

    // Run the caller's related-record writes inside the SAME transaction so a
    // rejected/failed transition leaves no partial update (atomic with history).
    if (input.applyWithinTx) await input.applyWithinTx(tx);

    return row;
  });

  await escalateReworkIfNeeded("product-posting", workflow.id, input);

  return updated;
}

export async function transitionWorkflowByTask(input: {
  taskId: string;
  nextPhase: string;
  actorUserId: string;
  action: string;
  remarks?: string | null;
  patch?: Record<string, unknown>;
  actorRole?: string | null;
  actorRoles?: readonly string[] | null;
  ownershipSatisfied?: boolean;
  evidenceCount?: number;
  enforceContent?: boolean;
  override?: boolean;
  applyWithinTx?: (tx: any) => Promise<void>;
}) {
  await ensureProductPostingWorkflowInfrastructure();
  const [workflow] = await db
    .select()
    .from(productPostingWorkflows)
    .where(eq(productPostingWorkflows.taskId, input.taskId));

  if (!workflow) {
    throw new Error("Workflow not found for task");
  }

  // Centralized guard — throws WorkflowTransitionError (400/403) before any write.
  assertWorkflowTransition({
    from: workflow.currentPhase,
    to: input.nextPhase,
    action: input.action,
    actorRole: input.actorRole,
    actorRoles: input.actorRoles,
    ownershipSatisfied:
      input.ownershipSatisfied ??
      (input.action === "EXECUTIVE_SUBMITTED"
        ? !(workflow as any).executiveUserId ||
          (workflow as any).executiveUserId === input.actorUserId
        : undefined),
    reason: input.remarks,
    evidenceCount: input.evidenceCount,
    enforceContent: input.enforceContent,
    override: input.override,
  });

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(productPostingWorkflows)
      .set({
        currentPhase: input.nextPhase,
        updatedAt: new Date(),
        ...(input.patch || {}),
      } as any)
      .where(eq(productPostingWorkflows.id, workflow.id))
      .returning();

    await appendWorkflowHistory(
      {
        workflowId: workflow.id,
        fromPhase: workflow.currentPhase,
        toPhase: input.nextPhase,
        action: input.action,
        remarks: input.remarks,
        actorUserId: input.actorUserId,
        metadata: input.patch,
      },
      tx,
    );

    // Run the caller's related-record writes inside the SAME transaction so a
    // rejected/failed transition leaves no partial update (atomic with history).
    if (input.applyWithinTx) await input.applyWithinTx(tx);

    return row;
  });

  await escalateReworkIfNeeded("product-posting", workflow.id, { ...input, taskId: input.taskId });

  return updated;
}

export async function getTaskSpentMinutes(taskId: string) {
  const [totals] = await db
    .select({ total: sql<number>`coalesce(sum(${taskTimeLogs.timeSpentMinutes}), 0)::int` })
    .from(taskTimeLogs)
    .where(eq(taskTimeLogs.taskId, taskId));
  return totals?.total || 0;
}

export async function getWorkflowQueueForManager(callerRole?: string) {
  await ensureProductPostingWorkflowInfrastructure();

  const rows = await db
    .select({
      workflow: productPostingWorkflows,
      project: projects,
      task: tasks,
      invoiceProjectName: productPostingInvoices.projectName,
    })
    .from(productPostingWorkflows)
    .innerJoin(projects, eq(productPostingWorkflows.projectId, projects.id))
    .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
    .leftJoin(tasks, eq(productPostingWorkflows.taskId, tasks.id))
    .orderBy(desc(productPostingWorkflows.updatedAt));

  const projectIds = rows.map((row) => row.project.id);
  const taskIds = rows.map((row) => row.workflow.taskId).filter(Boolean) as string[];

  const docs = projectIds.length
    ? await db.select().from(projectDocuments).where(inArray(projectDocuments.projectId, projectIds)).orderBy(desc(projectDocuments.createdAt))
    : [];
  const links = taskIds.length
    ? await db.select().from(productPostingEvidenceLinks).where(inArray(productPostingEvidenceLinks.taskId, taskIds))
    : [];

  const docsByProject = new Map<string, typeof docs>();
  for (const doc of docs) {
    const list = docsByProject.get(doc.projectId) || [];
    list.push(doc);
    docsByProject.set(doc.projectId, list);
  }

  const linksByTask = new Map<string, typeof links>();
  for (const link of links) {
    if (!link.taskId) continue;
    const list = linksByTask.get(link.taskId) || [];
    list.push(link);
    linksByTask.set(link.taskId, list);
  }

  const allItems = await Promise.all(
    rows.map(async ({ workflow, project, task, invoiceProjectName }) => {
      const spentMinutes = workflow.taskId ? await getTaskSpentMinutes(workflow.taskId) : 0;
      const invName = (invoiceProjectName || "").toLowerCase();
      return {
        ...workflow,
        invoiceProjectName: invoiceProjectName || null,
        phaseLabel: PRODUCT_POSTING_PHASE_LABELS[workflow.currentPhase as keyof typeof PRODUCT_POSTING_PHASE_LABELS] || workflow.currentPhase,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          companyName: (project as any).companyName || (project as any).workSpace || project.name,
          notes: project.notes,
        },
        notes: task?.notes || null,
        documents: docsByProject.get(project.id) || [],
        evidenceLinks: workflow.taskId ? (linksByTask.get(workflow.taskId) || []) : [],
        spentMinutes,
        remainingMinutes: Math.max((workflow.assignedDurationMinutes || 0) - spentMinutes, 0),
        overtimeExceededBy: Math.max(spentMinutes - ((workflow.assignedDurationMinutes || 0) + (workflow.overtimeApprovedMinutes || 0)), 0),
        _invName: invName,
      };
    }),
  );

  // Role-based filtering: each manager only sees their relevant invoice types
  if (callerRole === "product_posting_manager") {
    // Only show Alibaba Product Posting invoices
    return allItems.filter(item =>
      !item._invName || // no invoice linked: show by default
      (item._invName.includes("product posting") && !item._invName.includes("minisite") && !item._invName.includes("listing"))
    );
  } else if (callerRole === "dd_manager" || callerRole === "d_d_manager") {
    // Only show Alibaba Minisite + Listing Page invoices
    return allItems.filter(item =>
      !item._invName || // no invoice linked: show by default
      item._invName.includes("minisite") ||
      item._invName.includes("mini site") ||
      item._invName.includes("listing")
    );
  }

  // Admin / other roles: show everything
  return allItems;
}

export async function getExecutionRowsForRole(roleId: string, userId: string) {
  console.log(`[getExecutionRowsForRole] roleId: "${roleId}", userId: "${userId}"`);
  await ensureProductPostingWorkflowInfrastructure();

  let conditions;
  if (["product_posting_executive", "posting_executive", "dd_executive"].includes(roleId)) {
    conditions = eq(productPostingWorkflows.executiveUserId, userId);
  } else if (roleId === "qa_manager") {
    conditions = inArray(productPostingWorkflows.currentPhase, ["QA_REVIEW", "RETURNED_FOR_CHANGE"]);
  } else if (roleId === "verification_manager") {
    conditions = inArray(productPostingWorkflows.currentPhase, ["VERIFICATION_PENDING", "QA_COMPLETE"]);
  } else if (roleId === "admin" || roleId === "product_posting_manager" || roleId === "dd_manager") {
    conditions = sql`true`;
  } else {
    // Default to only seeing tasks specifically assigned to them as executive
    conditions = eq(productPostingWorkflows.executiveUserId, userId);
  }

  const rows = await db
    .select({
      workflow: productPostingWorkflows,
      project: projects,
      task: tasks,
      assignee: users,
    })
    .from(productPostingWorkflows)
    .leftJoin(projects, eq(productPostingWorkflows.projectId, projects.id))
    .leftJoin(tasks, eq(productPostingWorkflows.taskId, tasks.id))
    .leftJoin(users, eq(productPostingWorkflows.executiveUserId, users.id))
    .where(conditions as any)
    .orderBy(desc(productPostingWorkflows.updatedAt));

  return Promise.all(
    rows.map(async ({ workflow, project, task, assignee }) => {
      const spentMinutes = workflow.taskId ? await getTaskSpentMinutes(workflow.taskId) : 0;
      const [result] = workflow.taskId
        ? await db.select().from(taskResults).where(eq(taskResults.taskId, workflow.taskId))
        : [null];
      const evidence = workflow.taskId
        ? await db.select().from(productPostingEvidenceLinks).where(eq(productPostingEvidenceLinks.taskId, workflow.taskId))
        : [];
      const reworkHistory = await db
        .select()
        .from(productPostingReworkHistory)
        .where(eq(productPostingReworkHistory.workflowId, workflow.id))
        .orderBy(desc(productPostingReworkHistory.createdAt));
      const extensions = workflow.taskId
        ? await db.select().from(taskTimeExtensions).where(eq(taskTimeExtensions.taskId, workflow.taskId)).orderBy(desc(taskTimeExtensions.createdAt))
        : [];

      return {
        id: workflow.id,
        workflowId: workflow.id,
        projectId: workflow.projectId,
        taskId: workflow.taskId,
        title: task?.title || project?.name,
        name: project?.name,
        workSpace: project?.workSpace,
        companyName: (project as any)?.companyName || project?.workSpace || project?.name,
        status: workflow.currentPhase,
        phaseLabel: PRODUCT_POSTING_PHASE_LABELS[workflow.currentPhase as keyof typeof PRODUCT_POSTING_PHASE_LABELS] || workflow.currentPhase,
        assignedDurationMinutes: workflow.assignedDurationMinutes || 0,
        spentMinutes,
        overtimeRequestedMinutes: workflow.overtimeRequestedMinutes || 0,
        overtimeApprovedMinutes: workflow.overtimeApprovedMinutes || 0,
        overtimeExceededBy: Math.max(spentMinutes - ((workflow.assignedDurationMinutes || 0) + (workflow.overtimeApprovedMinutes || 0)), 0),
        overtimeReason: workflow.overtimeReason,
        timerStartedAt: task?.timerStartedAt || null,
        executiveSubmittedAt: workflow.executiveSubmittedAt,
        managerCompletedAt: workflow.managerCompletedAt,
        qaReviewedAt: workflow.qaReviewedAt,
        verificationReviewedAt: workflow.verificationReviewedAt,
        createdAt: task?.createdAt || workflow.createdAt,
        notes: task?.notes || null,
        evidenceLinks: evidence,
        evidenceCount: evidence.length,
        linksPosted: result?.linksPosted || evidence.length,
        totalDurationMinutes: result?.totalDurationMinutes || spentMinutes,
        returnCount: workflow.returnCount || 0,
        lastReturnReason: workflow.lastReturnReason,
        reworkHistory,
        extensions,
        assignee: assignee ? { id: assignee.id, name: assignee.name || assignee.fullName || assignee.email } : null,
      };
    }),
  );
}
