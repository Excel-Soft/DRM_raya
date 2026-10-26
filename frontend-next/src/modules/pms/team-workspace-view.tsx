"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type AssignmentItem = {
  projectId: string;
  projectName: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  taskCounts: { total: number };
};

type AssignmentsResponse = {
  success: boolean;
  data: { items: AssignmentItem[]; total: number; page: number; pageSize: number };
};

type ProjectTask = {
  id: string;
  title: string | null;
  description: string | null;
  status: string | null;
  priority: string | null;
  projectId: string | null;
  assigneeName: string | null;
  projectName: string | null;
  createdAt: string | null;
};

type WorkspaceChannel = { name: string; projectId: string; count?: number };
type WorkspaceGroup = { id: string; name: string; subItems: WorkspaceChannel[] };

const TASK_TYPE_OPTIONS = ["Choose…", "Long Term", "Short Term", "Immediately"];

function useDDExecutives() {
  return useQuery<string[]>({
    queryKey: ["/api/users", { role: "dd_executive" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?role=dd_executive");
      if (!res.ok) return ["To-Do List"];
      const data = await res.json();
      const users: any[] = data?.users ?? [];
      // rawRole (exact DB value) — NOT the normalized role, which maps every
      // *_executive to dd_executive and would over-include other departments.
      const ddOnly = users.filter(
        (u) => u.isActive !== false && (u.rawRole === "dd_executive" || u.rawRole === "d_d_executive"),
      );
      return ["To-Do List", ...ddOnly.map((u) => (u.fullName || u.email || "Unknown").trim())];
    },
    staleTime: 0,
  });
}

function priorityBadgeClass(priority: string | null) {
  if (priority === "Urgent") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  if (priority === "High") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
}

export function TeamWorkspacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personOptions = ["To-Do List"] } = useDDExecutives();

  const { data: assignmentsResp, isLoading: workspacesLoading, isError: workspacesError } = useQuery<AssignmentsResponse>({
    queryKey: ["/api/pms/team-workspace/assignments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/team-workspace/assignments?page=1&pageSize=100");
      if (!res.ok) throw new Error("Failed to load workspaces.");
      return res.json();
    },
  });

  const workspaces = useMemo<WorkspaceGroup[]>(() => {
    const items = assignmentsResp?.data?.items ?? [];
    const map = new Map<string, WorkspaceGroup>();
    for (const item of items) {
      const ownerName = item.owner?.name?.trim() || "Unassigned";
      if (!map.has(ownerName)) {
        map.set(ownerName, { id: ownerName, name: `${ownerName} Tasks`, subItems: [] });
      }
      map.get(ownerName)!.subItems.push({
        name: item.projectName || "Untitled Project",
        projectId: item.projectId,
        count: item.taskCounts?.total || undefined,
      });
    }
    return Array.from(map.values());
  }, [assignmentsResp]);

  const [selectedChannel, setSelectedChannel] = useState<WorkspaceChannel | null>(null);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [showAddChannelFor, setShowAddChannelFor] = useState<WorkspaceGroup | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

  const [taskName, setTaskName] = useState("");
  const [taskPerson, setTaskPerson] = useState("To-Do List");
  const [taskType, setTaskType] = useState("Choose…");
  const [taskPriority, setTaskPriority] = useState("Normal");

  const { data: channelTasks = [], isLoading: tasksLoading, isError: tasksError } = useQuery<ProjectTask[]>({
    queryKey: ["/api/pms/project-tasks", selectedChannel?.projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pms/project-tasks/${selectedChannel!.projectId}`);
      if (!res.ok) throw new Error("Failed to load tasks.");
      return res.json();
    },
    enabled: !!selectedChannel?.projectId,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: { channelName: string; taskName: string; personName: string; priority: string; taskType: string }) => {
      const res = await apiRequest("POST", "/api/pms/workspace-tasks", payload);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to create task.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pms/project-tasks", selectedChannel?.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pms/team-workspace/assignments"] });
      toast({ title: "Task created", description: "The task was added successfully." });
      setShowCreateTask(false);
      setTaskName("");
      setTaskPerson("To-Do List");
      setTaskType("Choose…");
      setTaskPriority("Normal");
    },
    onError: (err: Error) => toast({ title: "Failed to create task", description: err.message, variant: "destructive" }),
  });

  const handleSaveTask = () => {
    if (!taskName.trim()) {
      toast({ title: "Task name required", description: "Please enter a task name.", variant: "destructive" });
      return;
    }
    if (!selectedChannel) return;
    createTaskMutation.mutate({
      channelName: selectedChannel.name,
      taskName: taskName.trim(),
      personName: taskPerson,
      priority: taskPriority,
      taskType,
    });
  };

  // Workspaces/channels are derived entirely from project assignments — the
  // legacy page's "Add Workspace"/"Add Channel" actions are informational
  // only (they cannot create anything server-side either); preserved as-is
  // rather than quietly dropped or given new backing that never shipped.
  const handleAddWorkspace = () => {
    toast({ title: "Workspaces are managed automatically", description: "Workspaces are derived from your project assignments and cannot be created here." });
    setShowAddWorkspace(false);
  };
  const handleAddChannel = () => {
    toast({ title: "Channels are managed automatically", description: "Channels reflect the projects you are assigned to and cannot be created here." });
    setShowAddChannelFor(null);
  };

  const indexedTaskColumns = useMemo((): DataTableColumn<ProjectTask>[] => {
    const indexOf = (row: ProjectTask) => channelTasks.findIndex((t) => t.id === row.id) + 1;
    return [
      { id: "n", header: "S.No", cell: (row) => indexOf(row) },
      { id: "company", header: "Company", cell: (row) => <span className="font-semibold text-emerald-700 dark:text-emerald-400">{row.projectName || "-"}</span> },
      { id: "task", header: "Task", cell: (row) => <span className="font-semibold">{row.title}</span> },
      { id: "created", header: "Created At", cell: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-") },
      { id: "assignee", header: "Assigned To", cell: (row) => row.assigneeName || "-" },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {row.status || "ToDo"}
          </span>
        ),
      },
      {
        id: "priority",
        header: "Priority",
        cell: (row) => <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityBadgeClass(row.priority)}`}>{row.priority || "Normal"}</span>,
      },
      { id: "detail", header: "Detail", cell: (row) => row.description || "-" },
    ];
  }, [channelTasks]);

  if (selectedChannel) {
    return (
      <PmsShell
        title={selectedChannel.name}
        actions={
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedChannel(null)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to workspaces
          </Button>
        }
      >
        <DrmSection
          title="Tasks"
          actions={
            <Button type="button" size="sm" variant="primary" onClick={() => setShowCreateTask(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add task
            </Button>
          }
        >
          <DataTable
            columns={indexedTaskColumns}
            rows={channelTasks}
            rowKey={(row) => row.id}
            loading={tasksLoading}
            error={tasksError ? "Failed to load tasks. Please try again." : null}
            emptyMessage="No tasks yet — click Add task to create one."
            className="min-w-[900px]"
          />
        </DrmSection>

        <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="wt-company" label="Company">
                <Input value={selectedChannel.name} disabled />
              </Field>
              <Field id="wt-name" label="Task Name">
                <Input placeholder="Enter task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} />
              </Field>
              <Field id="wt-person" label="Person">
                <Select value={taskPerson} onValueChange={setTaskPerson}>
                  <SelectTrigger id="wt-person">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {personOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="wt-type" label="Task Type">
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger id="wt-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field id="wt-priority" label="Priority">
              <div className="flex items-center gap-4">
                {["Urgent", "High", "Normal"].map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="wt-priority"
                      checked={taskPriority === p}
                      onChange={() => setTaskPriority(p)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </Field>
            <Field id="wt-detail" label="Detail">
              <Textarea placeholder="Type description here…" rows={4} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setShowCreateTask(false)}>
                Close
              </Button>
              <Button type="button" variant="primary" disabled={createTaskMutation.isPending} onClick={handleSaveTask}>
                {createTaskMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PmsShell>
    );
  }

  return (
    <PmsShell
      title="Work Space"
      actions={
        <Button type="button" variant="primary" onClick={() => setShowAddWorkspace(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add New Work Space
        </Button>
      }
    >
      <DrmSection title="Workspaces">
        {workspacesLoading ? (
          <p className="py-10 text-center text-sm text-zinc-500">Loading workspaces…</p>
        ) : workspacesError ? (
          <p className="py-10 text-center text-sm text-red-600 dark:text-red-400">Failed to load workspaces. Please try again.</p>
        ) : workspaces.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No workspaces found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80">
                <tr>
                  <th className="w-16 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">S.No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Work Space</th>
                  <th className="w-24 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                {workspaces.map((ws, index) => (
                  <tr key={ws.id} className="align-top">
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="mb-1 text-zinc-800 dark:text-zinc-200">{ws.name}</div>
                      <div className="space-y-1 pl-4">
                        {ws.subItems.map((sub) => (
                          <button
                            key={sub.projectId}
                            type="button"
                            onClick={() => setSelectedChannel(sub)}
                            className="flex items-center text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                          >
                            {sub.name}
                            {sub.count !== undefined ? <span className="ml-2 text-zinc-400">({sub.count})</span> : null}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" aria-label="Add channel" onClick={() => setShowAddChannelFor(ws)}>
                          <Plus className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" aria-label="Delete workspace (not available)">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DrmSection>

      <Dialog open={showAddWorkspace} onOpenChange={setShowAddWorkspace}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Work Space</DialogTitle>
          </DialogHeader>
          <Field id="ws-title" label="Work Space Title">
            <Input />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowAddWorkspace(false)}>
              Close
            </Button>
            <Button type="button" variant="primary" onClick={handleAddWorkspace}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAddChannelFor} onOpenChange={(open) => !open && setShowAddChannelFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Channel</DialogTitle>
          </DialogHeader>
          <Field id="ch-workspace" label="Work Space">
            <Input value={showAddChannelFor?.name ?? ""} disabled />
          </Field>
          <Field id="ch-title" label="Channel Title">
            <Input />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowAddChannelFor(null)}>
              Close
            </Button>
            <Button type="button" variant="primary" onClick={handleAddChannel}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PmsShell>
  );
}
