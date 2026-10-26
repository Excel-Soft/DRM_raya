"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ClipboardCheck, Eye, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type TaskStatusHistoryRecord = {
  id: string;
  taskId: string;
  fromStatus: string | null;
  toStatus: string | null;
  changedAt: string | null;
  notes: string | null;
  company?: string | null;
  timeSpentMinutes?: number;
  sentToQaAt?: string | null;
  qaReviewedAt?: string | null;
  currentStatus?: string | null;
  qaComment?: string | null;
  departmentType?: string | null;
  task?: { id: string; title: string | null } | null;
  user?: { id: string; name: string | null } | null;
};

type PendingReviewTask = {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  project: string | null;
  company: string | null;
  departmentType: string | null;
  submittedAt: string | null;
  submissionNotes: string | null;
};

type SubmittedFileEntry = {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  description: string | null;
  createdAt: string;
  uploadedByName: string | null;
};

type HistoryRow = {
  no: number;
  taskId: string;
  name: string;
  avatar: string;
  company: string;
  qa: string;
  isQaReturn: boolean;
  project: string;
  taskDesc: string;
  detail: string;
  status: string;
  spent: string;
  changedAt: string;
  links: string[];
  sentToQaAt: string | null;
  qaReviewedAt: string | null;
  currentStatus: string | null;
  departmentType: string | null;
};

const TASK_HISTORY_KEY = "/api/pms/task-history";
const PENDING_REVIEW_KEY = "/api/pms/tasks/pending-review";

// Departments that actually run through the QA -> Verification pipeline.
// Everything else (IT, Software, Service) has no QA step at all — its
// manager's own approval is the final word ("Closed Task").
const QA_PIPELINE_DEPARTMENTS = ["PRODUCT_POSTING", "SEO_SMM", "SEO/SMM", "DND", "DESIGN_DEVELOPMENT"];

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function extractSubmittedLinks(notes: string | null): string[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed?.links)) {
      return parsed.links.filter((l: unknown) => typeof l === "string" && l.trim());
    }
  } catch {
    // Not JSON — no links to show.
  }
  return [];
}

function SortHeader({ label, column, sortConfig, onSort }: {
  label: string;
  column: string;
  sortConfig: { key: string; direction: "asc" | "desc" } | null;
  onSort: (key: string) => void;
}) {
  const Icon = sortConfig?.key !== column ? ArrowUpDown : sortConfig.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button type="button" className="flex items-center gap-1 hover:text-emerald-600" onClick={() => onSort(column)}>
      {label} <Icon className="h-3 w-3 opacity-60" />
    </button>
  );
}

export function TaskHistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: historyRecords = [], isLoading, isError, error, refetch } = useQuery<TaskStatusHistoryRecord[]>({
    queryKey: [TASK_HISTORY_KEY],
    queryFn: async () => {
      const res = await apiRequest("GET", TASK_HISTORY_KEY);
      if (!res.ok) throw new Error("Failed to load task history.");
      return res.json();
    },
  });

  // Server-gated (GET /api/pms/tasks/pending-review returns [] for any
  // non-managerial role) — the client isManager check below only decides
  // whether to render the section at all, it isn't the real gate.
  const { data: pendingReview = [], isLoading: isPendingReviewLoading } = useQuery<PendingReviewTask[]>({
    queryKey: [PENDING_REVIEW_KEY],
    queryFn: async () => {
      const res = await apiRequest("GET", PENDING_REVIEW_KEY);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: me } = useQuery<{ role?: string }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      if (!res.ok) return {};
      return res.json();
    },
  });
  const currentRole = (me?.role || "").toLowerCase();
  const isManager = currentRole.includes("manager") || currentRole.includes("admin") || currentRole.includes("hod");

  const invalidateReview = () => {
    queryClient.invalidateQueries({ queryKey: [PENDING_REVIEW_KEY] });
    queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
  };

  async function patchTaskStatus(taskId: string, body: Record<string, unknown>) {
    const res = await apiRequest("PATCH", `/api/pms/task/${taskId}/status`, body);
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Request failed.");
    return res.json();
  }
  async function postTaskAction(taskId: string, action: string) {
    const res = await apiRequest("POST", `/api/pms/tasks/${taskId}/${action}`, {});
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Request failed.");
    return res.json();
  }

  const approveMutation = useMutation({
    mutationFn: (taskId: string) => patchTaskStatus(taskId, { status: "Completed" }),
    onSuccess: () => {
      invalidateReview();
      toast({ title: "Approved", description: "The task is complete — finish it from Completed Projects below." });
    },
    onError: (err: Error) => toast({ title: "Could not approve task", description: err.message, variant: "destructive" }),
  });

  const sendToQaMutation = useMutation({
    mutationFn: (taskId: string) => postTaskAction(taskId, "send-to-qa"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
      toast({ title: "Sent to QA" });
    },
    onError: (err: Error) => toast({ title: "Could not send to QA", description: err.message, variant: "destructive" }),
  });

  const sendToVerificationMutation = useMutation({
    mutationFn: (taskId: string) => postTaskAction(taskId, "send-to-verification"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
      toast({ title: "Sent to Verification" });
    },
    onError: (err: Error) => toast({ title: "Could not send to Verification", description: err.message, variant: "destructive" }),
  });

  const closeTaskMutation = useMutation({
    mutationFn: (taskId: string) => postTaskAction(taskId, "close"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
      toast({ title: "Task Closed", description: "Moved to Complete and Closed Project." });
    },
    onError: (err: Error) => toast({ title: "Could not close task", description: err.message, variant: "destructive" }),
  });

  const assignToExecMutation = useMutation({
    mutationFn: (taskId: string) => patchTaskStatus(taskId, { status: "ToDo", reason: "Sent back by Manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
      toast({ title: "Reassigned to Executive" });
    },
    onError: (err: Error) => toast({ title: "Could not reassign task", description: err.message, variant: "destructive" }),
  });

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingTask, setRejectingTask] = useState<PendingReviewTask | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!rejectingTask) return Promise.resolve();
      return patchTaskStatus(rejectingTask.id, { status: "Blocked", reason: rejectReason.trim() });
    },
    onSuccess: () => {
      invalidateReview();
      setRejectDialogOpen(false);
      setRejectingTask(null);
      setRejectReason("");
      toast({ title: "Rejected", description: "Sent back to the executive for rework." });
    },
    onError: (err: Error) => toast({ title: "Could not reject task", description: err.message, variant: "destructive" }),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [viewingTask, setViewingTask] = useState<PendingReviewTask | null>(null);
  const { data: viewingFilesRes, isLoading: isViewingFilesLoading, isError: isViewingFilesError } = useQuery<{ success: boolean; data: SubmittedFileEntry[] }>({
    queryKey: [`/api/tasks/${viewingTask?.id}/files`],
    enabled: !!viewingTask,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${viewingTask!.id}/files`);
      if (!res.ok) throw new Error("Could not load files/description.");
      return res.json();
    },
  });
  const viewingFiles = viewingFilesRes?.data || [];

  const history = useMemo<HistoryRow[]>(() => {
    return (historyRecords || []).map((record, idx) => {
      const userName = record.user?.name || "Unknown";
      let parsedLinks: string[] = [];
      let detailText = record.notes || "";

      if (record.notes) {
        try {
          const parsed = JSON.parse(record.notes);
          if (parsed.qaReturn) {
            detailText = parsed.reason ? `QA Return: ${parsed.reason}` : "QA Returned Project";
          } else if (typeof parsed.reason === "string" && parsed.reason) {
            detailText = `Rejected: ${parsed.reason}`;
          } else if (Array.isArray(parsed?.links)) {
            parsedLinks = parsed.links.filter((l: unknown) => typeof l === "string" && l.trim());
            detailText = parsedLinks.length > 0 ? `${parsedLinks.length} link(s) submitted` : "";
          }
        } catch {
          // Not JSON — keep the raw notes text as-is.
        }
      }

      const isQaReturn = record.currentStatus === "Blocked";

      return {
        no: idx + 1,
        taskId: record.task?.id || record.taskId,
        name: userName,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`,
        company: record.company || "—",
        qa: record.qaComment || "N/A",
        isQaReturn,
        project: record.task?.title || "—",
        taskDesc: record.fromStatus ? `${record.fromStatus} → ${record.toStatus ?? ""}` : (record.toStatus ?? ""),
        detail: detailText,
        status: record.toStatus || "",
        spent: formatDuration(record.timeSpentMinutes || 0),
        changedAt: record.changedAt ? new Date(record.changedAt).toLocaleString() : "",
        links: parsedLinks,
        sentToQaAt: record.sentToQaAt || null,
        qaReviewedAt: record.qaReviewedAt || null,
        currentStatus: record.currentStatus || null,
        departmentType: record.departmentType || null,
      };
    });
  }, [historyRecords]);

  const filteredHistory = useMemo(() => {
    let current = history;
    if (statusFilter === "changing") current = current.filter((row) => row.isQaReturn);
    if (!searchQuery.trim()) return current;
    const q = searchQuery.toLowerCase();
    return current.filter((row) =>
      [row.no, row.name, row.company, row.qa, row.project, row.taskDesc, row.detail, row.status]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [searchQuery, history, statusFilter]);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const handleSort = (key: string) => {
    setSortConfig((prev) => (prev?.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  const sortedHistory = useMemo(() => {
    if (!sortConfig) return filteredHistory;
    const { key, direction } = sortConfig;
    const sorted = [...filteredHistory].sort((a, b) => {
      const av = (a as any)[key];
      const bv = (b as any)[key];
      if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
      if (bv == null || bv === "") return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    });
    return direction === "asc" ? sorted : sorted.reverse();
  }, [filteredHistory, sortConfig]);

  const columns = useMemo((): DataTableColumn<HistoryRow>[] => [
    { id: "no", header: <SortHeader label="No." column="no" sortConfig={sortConfig} onSort={handleSort} />, cell: (r) => r.no },
    {
      id: "name",
      header: <SortHeader label="Name" column="name" sortConfig={sortConfig} onSort={handleSort} />,
      cell: (r) => (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.avatar} alt="" className="h-7 w-7 rounded-full bg-zinc-100 object-cover dark:bg-zinc-800" />
          <span>{r.name}</span>
        </div>
      ),
    },
    { id: "company", header: <SortHeader label="Company" column="company" sortConfig={sortConfig} onSort={handleSort} />, cell: (r) => <span className="uppercase">{r.company}</span> },
    { id: "qa", header: <SortHeader label="QA Comment" column="qa" sortConfig={sortConfig} onSort={handleSort} />, cell: (r) => r.qa },
    {
      id: "project",
      header: <SortHeader label="Project" column="project" sortConfig={sortConfig} onSort={handleSort} />,
      cell: (r) => (
        <div className="flex items-start gap-2">
          <div className="flex flex-col">
            <span className="font-bold text-zinc-800 dark:text-zinc-100">{r.project}</span>
            <span className="text-xs text-zinc-500">
              <span className="opacity-80">Task:</span> {r.taskDesc}
            </span>
            <span className="text-xs text-zinc-400">
              <span className="opacity-80">Detail:</span> {r.detail}
            </span>
          </div>
          <button
            type="button"
            title="View submitted links/files"
            onClick={() =>
              setViewingTask({
                id: r.taskId,
                title: r.project,
                description: null,
                projectId: "",
                assigneeId: null,
                assigneeName: r.name,
                project: r.project,
                company: r.company,
                departmentType: r.departmentType,
                submittedAt: r.changedAt,
                submissionNotes: null,
              })
            }
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <Eye className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        </div>
      ),
    },
    {
      id: "status",
      header: <SortHeader label="Status" column="status" sortConfig={sortConfig} onSort={handleSort} />,
      cell: (r) => (
        <span className={`inline-flex rounded px-2.5 py-1 text-[10.5px] font-bold leading-none text-white ${r.status === "Blocked" ? "bg-rose-500" : "bg-emerald-500"}`}>
          {r.status}
        </span>
      ),
      className: "text-center",
    },
    { id: "spent", header: <SortHeader label="Spent" column="spent" sortConfig={sortConfig} onSort={handleSort} />, cell: (r) => r.spent, className: "text-center" },
    {
      id: "action",
      header: "QA",
      className: "text-center min-w-[200px]",
      cell: (r) =>
        r.isQaReturn ? (
          <Button size="sm" variant="secondary" disabled={assignToExecMutation.isPending} onClick={() => assignToExecMutation.mutate(r.taskId)}>
            Assign to Exec
          </Button>
        ) : r.status !== "Completed" ? null : !QA_PIPELINE_DEPARTMENTS.includes(r.departmentType || "") ? (
          <Button size="sm" variant="primary" disabled={closeTaskMutation.isPending} onClick={() => closeTaskMutation.mutate(r.taskId)}>
            Closed Task
          </Button>
        ) : currentRole === "qa_manager" ? (
          r.qaReviewedAt ? (
            <span className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-600" title={`Sent to Verification on ${new Date(r.qaReviewedAt).toLocaleString()}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Sent
            </span>
          ) : (
            <Button size="sm" variant="primary" disabled={sendToVerificationMutation.isPending} onClick={() => sendToVerificationMutation.mutate(r.taskId)}>
              Send to Verification
            </Button>
          )
        ) : r.sentToQaAt ? (
          <span className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-600" title={`Sent to QA on ${new Date(r.sentToQaAt).toLocaleString()}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Sent
          </span>
        ) : (
          <Button size="sm" variant="primary" disabled={sendToQaMutation.isPending} onClick={() => sendToQaMutation.mutate(r.taskId)}>
            Send to QA
          </Button>
        ),
    },
  ], [sortConfig, currentRole, assignToExecMutation.isPending, closeTaskMutation.isPending, sendToVerificationMutation.isPending, sendToQaMutation.isPending]);

  return (
    <PmsShell title="Complete Project" description="Manager review queue and task status history.">
      {isManager ? (
        <DrmSection title="Pending My Review">
          {isPendingReviewLoading ? (
            <p className="py-6 text-center text-sm text-zinc-400">Loading…</p>
          ) : pendingReview.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">Nothing waiting on your review right now.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pendingReview.map((task) => {
                const links = extractSubmittedLinks(task.submissionNotes);
                return (
                  <div key={task.id} className="flex flex-col justify-between gap-3 py-4 md:flex-row md:items-center">
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-800 dark:text-zinc-100">{task.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {task.project || "—"} <span className="opacity-60">·</span> {task.company || "—"}
                        <span className="opacity-60"> · submitted by </span>
                        <span className="font-semibold">{task.assigneeName || "Unknown"}</span>
                        {task.submittedAt ? <span className="opacity-60"> on {new Date(task.submittedAt).toLocaleString()}</span> : null}
                      </p>
                      {links.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {links.map((link, i) => (
                            <a
                              key={i}
                              href={link.startsWith("http") ? link : `https://${link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[220px] truncate text-xs font-semibold text-indigo-500 underline hover:text-indigo-700"
                            >
                              {link}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setViewingTask(task)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="primary" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate(task.id)}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approved
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={rejectMutation.isPending}
                        onClick={() => {
                          setRejectingTask(task);
                          setRejectReason("");
                          setRejectDialogOpen(true);
                        }}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DrmSection>
      ) : null}

      <DrmSection
        title="Completed Projects"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="changing">Changing</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-52"
              aria-label="Search task history"
            />
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={sortedHistory}
          rowKey={(row) => `${row.taskId}-${row.no}`}
          loading={isLoading}
          error={isError ? (error instanceof Error ? error.message : "Failed to load task history.") : null}
          onRetry={() => refetch()}
          emptyMessage="No task history found."
          className="min-w-[1200px]"
        />
      </DrmSection>

      {/* Reject reason — required before a Pending My Review task can be sent
          back (Blocked) to its executive for rework. */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectingTask(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Task</DialogTitle>
            <DialogDescription>
              {rejectingTask?.title} will go back to <span className="font-semibold">{rejectingTask?.assigneeName || "the executive"}</span> for rework.
            </DialogDescription>
          </DialogHeader>
          <Field id="reject-reason" label="Reason">
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain what needs to change…" rows={4} />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setRejectDialogOpen(false); setRejectingTask(null); }}>
              Cancel
            </Button>
            <Button variant="danger" disabled={rejectMutation.isPending || !rejectReason.trim()} onClick={() => rejectMutation.mutate()}>
              {rejectMutation.isPending ? "Rejecting…" : "Reject & Send Back"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View submission — what the executive actually did, so the manager
          can check the work before Approve/Reject instead of deciding blind. */}
      <Dialog open={!!viewingTask} onOpenChange={(open) => { if (!open) setViewingTask(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingTask?.title}</DialogTitle>
            <DialogDescription>
              Submitted by <span className="font-semibold">{viewingTask?.assigneeName || "Unknown"}</span>
              {viewingTask?.submittedAt ? ` on ${new Date(viewingTask.submittedAt).toLocaleString()}` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto py-2">
            <div>
              <h4 className="mb-1.5 text-sm font-bold">Submitted Links</h4>
              {(() => {
                const links = extractSubmittedLinks(viewingTask?.submissionNotes ?? null);
                return links.length === 0 ? (
                  <p className="text-sm text-zinc-400">No links submitted.</p>
                ) : (
                  <div className="space-y-1">
                    {links.map((link, i) => (
                      <a key={i} href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-500 underline hover:text-indigo-700">
                        {link}
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>

            {isViewingFilesError ? (
              <p className="text-sm text-rose-500">Couldn't load files/description.</p>
            ) : (
              <>
                <div>
                  <h4 className="mb-1.5 text-sm font-bold">Uploaded Files</h4>
                  {isViewingFilesLoading ? (
                    <p className="text-sm text-zinc-400">Loading…</p>
                  ) : viewingFiles.filter((f) => f.fileUrl).length === 0 ? (
                    <p className="text-sm text-zinc-400">No files uploaded.</p>
                  ) : (
                    <div className="space-y-1">
                      {viewingFiles.filter((f) => f.fileUrl).map((f) => (
                        <a key={f.id} href={f.fileUrl!} target="_blank" rel="noopener noreferrer" className="block text-sm text-emerald-600 hover:underline">
                          {f.fileName || "File"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="mb-1.5 text-sm font-bold">Description</h4>
                  {isViewingFilesLoading ? (
                    <p className="text-sm text-zinc-400">Loading…</p>
                  ) : viewingFiles.filter((f) => f.description).length === 0 ? (
                    <p className="text-sm text-zinc-400">No description submitted.</p>
                  ) : (
                    <div className="space-y-2">
                      {viewingFiles.filter((f) => f.description).map((f) =>
                        !f.fileUrl && /^https?:\/\//i.test(f.description || "") ? (
                          <a key={f.id} href={f.description!} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-500 underline hover:text-indigo-700">
                            {f.description}
                          </a>
                        ) : (
                          <p key={f.id} className="text-sm text-zinc-600 dark:text-zinc-400">
                            {f.description}
                          </p>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setViewingTask(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PmsShell>
  );
}
