"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, Clock, Eye, Plus, PlayCircle, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/legacy/alert-dialog";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";
import {
  AddLinksModal,
  FilesModal,
  formatElapsed,
  getRequiredLinksCount,
  parseRejectionReason,
  stripLinksTail,
  type TaskRow,
} from "@/modules/pms/task-shared";

type ProjectStatus = {
  id: string;
  company: string;
  assign: string;
  project: string;
  status: string;
  date: string;
  docUploaded?: boolean;
  depApproved?: boolean;
};

const NEW_TASK_INITIAL_STATE = { title: "", description: "", assignedToUserId: "unassigned", priority: "Medium", dueDate: "" };
const EMPTY_FILTERS = { department: "all", city: "all", status: "all", startDate: "", endDate: "" };

const EMPTY_PROJECTS: ProjectStatus[] = [];
const EMPTY_TASKS: TaskRow[] = [];
const EMPTY_TIME_LOGS: any[] = [];

// Roles permitted to open the project-detail drawer on this page — a
// *stricter*, independently-maintained list than Task System's (which has
// no such restriction at all). Confirmed via a direct diff against
// pms-tasks.tsx; do not merge the two gates without a product decision.
const PROJECT_DETAIL_ROLES = [
  "it_manager",
  "it_executive",
  "seo_smm_manager",
  "seo_smm_executive",
  "dd_manager",
  "dd_executive",
  "product_posting_manager",
  "product_posting_executive",
  "posting_executive",
];

export function ProjectStatusPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filesModalTask, setFilesModalTask] = useState<TaskRow | null>(null);
  const [finishingTaskId, setFinishingTaskId] = useState<string | null>(null);
  const [rejectionDetailTask, setRejectionDetailTask] = useState<TaskRow | null>(null);
  const [endTaskConfirmOpen, setEndTaskConfirmOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
  const [overtimeTaskId, setOvertimeTaskId] = useState<string | null>(null);
  const [overtimeForm, setOvertimeForm] = useState({ minutes: "60", reason: "" });
  const [isAddTaskFormOpen, setIsAddTaskFormOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState(NEW_TASK_INITIAL_STATE);
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});
  const [tickerBaselines, setTickerBaselines] = useState<Record<string, { serverElapsed: number; capturedAtLocal: number }>>({});

  // Draft vs. applied filters — the query only re-fetches when "View" is
  // clicked, not on every keystroke/select change.
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);

  const { data: projects = EMPTY_PROJECTS, isLoading, isError, refetch: refetchProjects } = useQuery<ProjectStatus[]>({
    queryKey: ["/api/pms/department-status", appliedFilters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedFilters.department !== "all") params.set("department", appliedFilters.department);
      if (appliedFilters.city !== "all") params.set("city", appliedFilters.city);
      if (appliedFilters.status !== "all") params.set("status", appliedFilters.status);
      if (appliedFilters.startDate) params.set("startDate", appliedFilters.startDate);
      if (appliedFilters.endDate) params.set("endDate", appliedFilters.endDate);
      const qs = params.toString();
      const res = await apiRequest("GET", `/api/pms/department-status${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch project status");
      return res.json();
    },
  });

  const { data: projectTasks = EMPTY_TASKS, isLoading: isLoadingTasks, isError: isTasksError, refetch: refetchTasks } = useQuery<TaskRow[]>({
    queryKey: ["project-tasks-direct", selectedProjectId],
    enabled: !!selectedProjectId && isDetailsModalOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pms/project-tasks/${selectedProjectId}`);
      if (!res.ok) throw new Error("Failed to load tasks.");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: timeLogs = EMPTY_TIME_LOGS, isLoading: isLoadingLogs } = useQuery<any[]>({
    queryKey: ["project-time-logs", selectedProjectId, projectTasks.map((t) => t.id).join(",")],
    enabled: !!selectedProjectId && isDetailsModalOpen && projectTasks.length > 0,
    queryFn: async () => {
      const all = await Promise.all(
        projectTasks.map(async (t) => {
          const res = await apiRequest("GET", `/api/pms/tasks/${t.id}/time-logs`);
          const logs = res.ok ? await res.json() : [];
          return (Array.isArray(logs) ? logs : []).map((l: any) => ({ ...l, taskTitle: t.title || t.name }));
        }),
      );
      return all.flat().sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());
    },
  });

  const invalidateTaskData = () => {
    queryClient.invalidateQueries({ queryKey: ["project-tasks-direct", selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ["project-time-logs", selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/pms/department-status"] });
  };

  const { data: taskMeta } = useQuery<{ users: { id: string; name: string | null }[] }>({
    queryKey: ["/api/pms/tasks/meta"],
    enabled: isDetailsModalOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/tasks/meta");
      if (!res.ok) return { users: [] };
      return res.json();
    },
  });

  async function postJson(url: string, body?: unknown) {
    const res = await apiRequest("POST", url, body ?? {});
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Request failed.");
    return res.json();
  }

  const createTaskMutation = useMutation({
    mutationFn: () =>
      postJson("/api/pms/tasks", {
        projectId: selectedProjectId,
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim() || undefined,
        assignedToUserId: newTaskForm.assignedToUserId !== "unassigned" ? newTaskForm.assignedToUserId : undefined,
        priority: newTaskForm.priority,
        dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate).toISOString() : undefined,
      }),
    onSuccess: () => {
      invalidateTaskData();
      setNewTaskForm(NEW_TASK_INITIAL_STATE);
      setIsAddTaskFormOpen(false);
      toast({ title: "Task created", description: "The task was added to this project." });
    },
    onError: (err: Error) => toast({ title: "Failed to create task", description: err.message, variant: "destructive" }),
  });

  const startTimerMutation = useMutation({
    mutationFn: (taskId: string) => postJson(`/api/tasks/${taskId}/timers/start`),
    onSuccess: () => {
      invalidateTaskData();
      toast({ title: "Timer started" });
    },
    onError: (err: Error) => toast({ title: "Timer Error", description: err.message, variant: "destructive" }),
  });

  const stopTimerMutation = useMutation({
    mutationFn: (taskId: string) => postJson(`/api/tasks/${taskId}/timers/stop`),
    onSuccess: () => {
      invalidateTaskData();
      toast({ title: "Timer stopped" });
    },
    onError: (err: Error) => toast({ title: "Timer Error", description: err.message, variant: "destructive" }),
  });

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => postJson(`/api/tasks/${taskId}/complete`),
    onSuccess: () => {
      invalidateTaskData();
      if (projectTasks.every((t) => t.status === "READY_FOR_QA" || t.status === "Completed" || t.status === "Done")) {
        setTimeout(() => setIsDetailsModalOpen(false), 500);
      }
      toast({ title: "Task submitted for review", description: "Your manager will review it in Task History." });
    },
    onError: (err: Error) => toast({ title: "Submission Error", description: err.message, variant: "destructive" }),
  });

  const requestOvertimeMutation = useMutation({
    mutationFn: (data: { taskId: string; requestedMinutes: number; reason: string }) =>
      postJson(`/api/tasks/${data.taskId}/extensions`, { requestedTimeMinutes: data.requestedMinutes, reason: data.reason }),
    onSuccess: () => {
      toast({ title: "Overtime requested successfully" });
      setIsOvertimeModalOpen(false);
      setOvertimeForm({ minutes: "60", reason: "" });
      invalidateTaskData();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    const now = Date.now();
    setTickerBaselines(() => {
      const next: Record<string, { serverElapsed: number; capturedAtLocal: number }> = {};
      projectTasks.forEach((task) => {
        if (task.timerStartedAt) {
          next[task.id] = { serverElapsed: task.currentSessionElapsedSeconds || 0, capturedAtLocal: now };
        }
      });
      return next;
    });
  }, [projectTasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next: Record<string, number> = {};
      Object.entries(tickerBaselines).forEach(([taskId, baseline]) => {
        next[taskId] = baseline.serverElapsed + Math.floor((Date.now() - baseline.capturedAtLocal) / 1000);
      });
      setElapsedTimes(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [tickerBaselines]);

  const selectedProjectInfo = projects.find((p) => p.id === selectedProjectId);

  const handleToggleTimer = (task: TaskRow) => {
    if (startTimerMutation.isPending || stopTimerMutation.isPending) return;
    if (task.timerStartedAt) {
      stopTimerMutation.mutate(task.id);
      return;
    }
    const activeTask = projectTasks.find((t) => t.timerStartedAt && t.id !== task.id);
    if (activeTask) {
      toast({
        title: "A timer is already running",
        description: `Stop the timer on "${activeTask.title || activeTask.name || "another task"}" before starting a new one.`,
        variant: "destructive",
      });
      return;
    }
    startTimerMutation.mutate(task.id);
  };

  const { data: me } = useQuery<{ role?: string }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      if (!res.ok) return {};
      return res.json();
    },
  });
  const role = (me?.role || "").toLowerCase();
  const isExecutive = role.includes("executive");
  const isManager = role.includes("manager") && !role.includes("admin");
  const isAdmin = role.includes("admin");
  // Independent, *stricter* gate than Task System's Eye/Details action —
  // scoped to exactly these roles, admin included out on purpose. Confirmed
  // via direct diff against pms-tasks.tsx; this is real product behavior,
  // not an oversight to be "fixed" into parity.
  const canViewProjectDetails = PROJECT_DETAIL_ROLES.includes(role);
  const isProductPostingExecutive = role === "product_posting_executive" || role === "posting_executive";

  // Non-admin managers get their department filter auto-applied (and
  // locked) based on role — same role→department guess legacy makes.
  useEffect(() => {
    if (isManager && !isAdmin) {
      let dept = "all";
      if (role.includes("product_posting") || role.includes("posting")) dept = "Product Posting";
      else if (role.includes("software") || role.includes("it")) dept = "Development";
      else if (role.includes("seo")) dept = "SEO/SMM";
      else if (role.includes("design")) dept = "Design";
      else if (role.includes("dd_")) dept = "D&D";

      if (dept !== "all") {
        setFilters((prev) => ({ ...prev, department: dept }));
        setAppliedFilters((prev) => ({ ...prev, department: dept }));
      }
    }
  }, [isManager, isAdmin, role]);

  return (
    <PmsShell title="Project Report">
      <DrmSection title="Filters">
        <div className={`mb-6 grid grid-cols-1 gap-4 ${isExecutive ? "md:grid-cols-2" : "md:grid-cols-5"}`}>
          {!isExecutive ? (
            <Field id="ps-department" label="Department">
              <Select
                value={filters.department}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, department: v }))}
                disabled={isManager && !isAdmin}
              >
                <SelectTrigger id="ps-department">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {!isManager || isAdmin ? <SelectItem value="all">All Departments</SelectItem> : null}
                  {!isManager || isAdmin || filters.department === "SEO/SMM" ? <SelectItem value="SEO/SMM">SEO/SMM</SelectItem> : null}
                  {!isManager || isAdmin || filters.department === "Development" ? <SelectItem value="Development">Development</SelectItem> : null}
                  {!isManager || isAdmin || filters.department === "Design" ? <SelectItem value="Design">Design</SelectItem> : null}
                  {!isManager || isAdmin || filters.department === "Product Posting" ? <SelectItem value="Product Posting">Product Posting</SelectItem> : null}
                  {!isManager || isAdmin || filters.department === "D&D" ? <SelectItem value="D&D">D&D</SelectItem> : null}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {!isExecutive ? (
            <Field id="ps-city" label="Select City">
              <Select value={filters.city} onValueChange={(v) => setFilters((prev) => ({ ...prev, city: v }))}>
                <SelectTrigger id="ps-city">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  <SelectItem value="Islamabad">Islamabad</SelectItem>
                  <SelectItem value="Lahore">Lahore</SelectItem>
                  <SelectItem value="Karachi">Karachi</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {!isExecutive ? (
            <Field id="ps-status" label="Select Status">
              <Select value={filters.status} onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}>
                <SelectTrigger id="ps-status">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="OnHold">On Hold</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="ps-start" label="Start Date">
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
          </Field>
          <Field id="ps-end" label="End Date">
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="primary" onClick={() => setAppliedFilters(filters)}>
            View
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setAppliedFilters(EMPTY_FILTERS);
            }}
          >
            Reset
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="List">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-950/80">
              <tr>
                {["No#", "Company", "Person", "Project", "Date", "Status", "Doc Upload", "Dep Approved", "Action"].map((h) => (
                  <th key={h} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-500">
                    Loading project status…
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-rose-500">
                    Failed to load projects.{" "}
                    <button onClick={() => refetchProjects()} className="font-bold underline hover:text-rose-600">
                      Retry
                    </button>
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-zinc-500">
                    No projects found.
                  </td>
                </tr>
              ) : (
                projects.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                    <td className="px-3 py-3 text-center font-bold text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-3 text-center font-bold">{row.company}</td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-600">{row.assign || "Not Assigned"}</td>
                    <td className="px-3 py-3 text-center">{row.project}</td>
                    <td className="px-3 py-3 text-center text-xs font-semibold text-zinc-500">
                      {row.date ? new Date(row.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-tight ${
                          row.status === "Completed" ? "bg-emerald-100 text-emerald-700" : row.status === "Active" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${row.docUploaded ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                        {row.docUploaded ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${row.depApproved ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                        {row.depApproved ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {canViewProjectDetails ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProjectId(row.id);
                            setIsDetailsModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 text-emerald-500" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DrmSection>

      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Project Details — Verify &amp; Start Working</DialogTitle>
          </DialogHeader>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold">{selectedProjectInfo?.company || "Project"} — Tasks</h3>
            {!isExecutive ? (
              <Button type="button" size="sm" variant="primary" onClick={() => setIsAddTaskFormOpen((v) => !v)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Task
              </Button>
            ) : null}
          </div>

          {!isExecutive && isAddTaskFormOpen ? (
            <div className="mb-6 space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field id="pst-title" label="Task Title *">
                  <Input value={newTaskForm.title} onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g., Design homepage banner" />
                </Field>
                <Field id="pst-assign" label="Assign To">
                  <Select value={newTaskForm.assignedToUserId} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, assignedToUserId: v }))}>
                    <SelectTrigger id="pst-assign">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(taskMeta?.users || []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="pst-priority" label="Priority">
                  <Select value={newTaskForm.priority} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, priority: v }))}>
                    <SelectTrigger id="pst-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="pst-due" label="Due Date">
                  <Input type="date" value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </Field>
              </div>
              <Field id="pst-desc" label="Description">
                <Textarea rows={3} value={newTaskForm.description} onChange={(e) => setNewTaskForm((f) => ({ ...f, description: e.target.value }))} placeholder="Add any details about this task…" />
              </Field>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => { setIsAddTaskFormOpen(false); setNewTaskForm(NEW_TASK_INITIAL_STATE); }}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" disabled={!newTaskForm.title.trim() || createTaskMutation.isPending} onClick={() => createTaskMutation.mutate()}>
                  {createTaskMutation.isPending ? "Saving…" : "Save Task"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-[1000px] w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80">
                <tr>
                  {["Task No", "Task", "Time", "Assign Time", "Details", "Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {isLoadingTasks ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-zinc-400">
                      Fetching project tasks…
                    </td>
                  </tr>
                ) : isTasksError ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <p className="font-bold text-rose-500">Failed to load tasks</p>
                      <button onClick={() => refetchTasks()} className="mt-1 text-xs font-bold text-rose-500 underline hover:text-rose-600">
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : projectTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <p className="font-bold text-zinc-500">No Tasks Assigned</p>
                      <p className="text-xs text-zinc-400">No task is assigned on this project. Assign tasks from the PMS module.</p>
                    </td>
                  </tr>
                ) : (
                  projectTasks.map((task, idx) => {
                    let assignedMins = 0;
                    try {
                      if (task.notes) assignedMins = parseInt(JSON.parse(task.notes)?.duration) || 0;
                    } catch {
                      // ignore
                    }
                    if (!assignedMins && task.dueDate && task.createdAt) {
                      const diffMs = new Date(task.dueDate).getTime() - new Date(task.createdAt).getTime();
                      if (diffMs > 0) assignedMins = Math.round(diffMs / 60000);
                    }
                    const durationText = assignedMins > 0 ? `${Math.floor(assignedMins / 60)}:${assignedMins % 60}` : "0:0";
                    const baselineSeconds = task.remainingSecondsStored != null ? task.remainingSecondsStored : assignedMins * 60;
                    const currentSessionSeconds = task.timerStartedAt ? elapsedTimes[task.id] || 0 : 0;
                    const remainingSeconds = Math.max(0, baselineSeconds - currentSessionSeconds);

                    return (
                      <tr key={task.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-4 text-center font-bold text-zinc-500">#{idx + 1}</td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold uppercase">{task.title || task.name || "Task"}</span>
                            <div className="flex flex-col text-xs text-zinc-400">
                              <span>
                                Type: <span className="uppercase text-zinc-500">{selectedProjectInfo?.project || task.project?.name || "—"}</span>
                              </span>
                              {isProductPostingExecutive ? (
                                <>
                                  <span>
                                    Detail: <span className="line-clamp-1 max-w-[200px] text-zinc-500">{stripLinksTail(task.description) || "—"}</span>
                                  </span>
                                  {getRequiredLinksCount(task) !== null ? (
                                    <span>
                                      Links: <span className="font-extrabold text-zinc-700 dark:text-zinc-200">{task.submittedLinksCount ?? 0}/{getRequiredLinksCount(task)}</span>
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span>
                                  Detail: <span className="line-clamp-1 max-w-[200px] text-zinc-500">{task.description || "—"}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{durationText}</span>
                        </td>
                        <td className="px-4 py-4 text-center text-xs font-bold text-zinc-500">
                          {new Date(task.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {isExecutive ? (
                            <button
                              type="button"
                              onClick={() => setFilesModalTask(task)}
                              disabled={task.status === "READY_FOR_QA" || task.status === "Completed"}
                              title={task.status === "READY_FOR_QA" || task.status === "Completed" ? "Submitted — no more changes until your manager reviews it" : undefined}
                              className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-100 transition-all hover:scale-110 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ArrowUpCircle className="h-5 w-5 text-white" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFilesModalTask(task)}
                              title="View Details"
                              className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 transition-all hover:bg-zinc-300 dark:bg-zinc-800"
                            >
                              <Eye className="h-4 w-4 text-zinc-500" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {task.status === "Blocked" ? (
                            <button
                              type="button"
                              onClick={() => setRejectionDetailTask(task)}
                              className="rounded-md border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
                            >
                              Rejected — needs rework
                            </button>
                          ) : task.status === "READY_FOR_QA" ? (
                            <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold italic text-blue-600">Pending Review</span>
                          ) : (
                            <span className="rounded-md border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold italic text-amber-500">{task.status || "Pending"}</span>
                          )}
                        </td>
                        {isExecutive ? (
                          <td className="px-4 py-4 text-center">
                            <div className="relative flex items-center justify-center gap-2">
                              {task.status !== "READY_FOR_QA" && task.status !== "Completed" ? (
                                <>
                                  <div
                                    className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200/50 px-2 py-0.5 text-[10px] font-black shadow-sm ${
                                      task.timerStartedAt ? "animate-pulse bg-emerald-400 text-white" : "bg-emerald-100 text-emerald-600"
                                    }`}
                                    title="Time remaining out of the manager's assigned budget"
                                  >
                                    {formatElapsed(remainingSeconds)}
                                  </div>
                                  <button
                                    type="button"
                                    className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 ${
                                      task.timerStartedAt ? "bg-rose-600 shadow-rose-100 hover:bg-rose-700" : "bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700"
                                    }`}
                                    onClick={() => handleToggleTimer(task)}
                                    disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
                                  >
                                    {task.timerStartedAt ? <div className="h-3 w-3 rounded-sm bg-white" /> : <PlayCircle className="h-6 w-6 text-white" />}
                                  </button>
                                </>
                              ) : null}
                              {!task.timerStartedAt && task.status === "InProgress" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFinishingTaskId(task.id);
                                    setEndTaskConfirmOpen(true);
                                  }}
                                  disabled={completeTaskMutation.isPending}
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 shadow-lg shadow-emerald-100 transition-all hover:scale-110 hover:bg-emerald-700"
                                >
                                  <Plus className="h-6 w-6 stroke-[3] text-white" />
                                </button>
                              ) : null}
                              {task.status === "READY_FOR_QA" ? (
                                <span className="text-xs font-bold text-rose-600" title="This task has been submitted for review — it cannot be worked on again until your manager reviews it.">
                                  Submitted
                                </span>
                              ) : null}
                              {task.status !== "Completed" && task.status !== "READY_FOR_QA" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOvertimeTaskId(task.id);
                                    setIsOvertimeModalOpen(true);
                                  }}
                                  className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-amber-100 transition-all hover:scale-110 hover:bg-amber-600"
                                  title="Request Overtime"
                                >
                                  <TimerReset className="h-5 w-5 text-white" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        ) : (
                          <td className="px-4 py-4 text-center text-xs font-medium text-zinc-400">View Only</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <Clock className="h-4 w-4" /> Time Log History
            </h4>
            <div className="max-h-60 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950/80">
                  <tr>
                    {["Task", "User", "Time Spent", "Date"].map((h) => (
                      <th key={h} className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {isLoadingLogs ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-400">
                        Loading time logs…
                      </td>
                    </tr>
                  ) : timeLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-zinc-400">
                        No time logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    timeLogs.map((log: any) => {
                      const totalSeconds = log.timeSpentSeconds != null ? log.timeSpentSeconds : (log.timeSpentMinutes || 0) * 60;
                      const h = Math.floor(totalSeconds / 3600);
                      const m = Math.floor((totalSeconds % 3600) / 60);
                      const s = totalSeconds % 60;
                      return (
                        <tr key={log.id}>
                          <td className="px-4 py-2 text-center font-bold uppercase">{log.taskTitle || "—"}</td>
                          <td className="px-4 py-2 text-center text-zinc-500">{log.user?.name || "—"}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                              {h}h {m}m {s}s
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center text-xs text-zinc-500">
                            {log.logDate ? new Date(log.logDate).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectionDetailTask} onOpenChange={(open) => !open && setRejectionDetailTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600">Rejected by Manager</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm">{rejectionDetailTask ? parseRejectionReason(rejectionDetailTask) : ""}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectionDetailTask(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlike Task System, this page never gates submission on a required
          link count — ported faithfully, not reconciled. */}
      <AlertDialog open={endTaskConfirmOpen} onOpenChange={setEndTaskConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, this task goes to your manager for review and you won't be able to start it again unless it's rejected back to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (finishingTaskId) {
                  completeTaskMutation.mutate(finishingTaskId);
                  setEndTaskConfirmOpen(false);
                }
              }}
            >
              Yes, Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOvertimeModalOpen} onOpenChange={setIsOvertimeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Overtime</DialogTitle>
          </DialogHeader>
          <Field id="pso-minutes" label="Additional Minutes">
            <Input type="number" min="1" value={overtimeForm.minutes} onChange={(e) => setOvertimeForm((prev) => ({ ...prev, minutes: e.target.value }))} />
          </Field>
          <Field id="pso-reason" label="Reason for Overtime">
            <Textarea rows={4} value={overtimeForm.reason} onChange={(e) => setOvertimeForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Please explain why more time is needed…" />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOvertimeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={requestOvertimeMutation.isPending || !overtimeForm.reason.trim()}
              onClick={() => {
                if (overtimeTaskId) {
                  requestOvertimeMutation.mutate({ taskId: overtimeTaskId, requestedMinutes: parseInt(overtimeForm.minutes) || 0, reason: overtimeForm.reason });
                }
              }}
            >
              {requestOvertimeMutation.isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isProductPostingExecutive ? (
        <AddLinksModal task={filesModalTask} onClose={() => setFilesModalTask(null)} />
      ) : (
        <FilesModal task={filesModalTask} onClose={() => setFilesModalTask(null)} canUpload={isExecutive} />
      )}
    </PmsShell>
  );
}
