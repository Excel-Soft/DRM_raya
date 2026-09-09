import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModuleData } from "@/hooks/use-module-data";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Calendar,
  User as UserIcon,
  Folder,
  AlertTriangle,
  ListChecks,
  Ban,
  CheckCircle2,
} from "lucide-react";

type TaskStatus = "ToDo" | "InProgress" | "Blocked" | "Completed";

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: "Low" | "Medium" | "High";
  projectId: string | null;
  assignedToUserId: string | null;
  dueDate: string | null;
  createdAt: string;
  assignee?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
};

type BoardResponse = {
  items: BoardTask[];
  counts: {
    total: number;
    toDo: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
  };
};

type TaskMeta = {
  projects: { id: string; name: string | null }[];
  users: { id: string; name: string | null; roleId?: string; branch?: string }[];
  priorities: string[];
};

const COLUMNS: { key: TaskStatus; label: string; barClass: string; dotClass: string; icon: typeof ListChecks }[] = [
  { key: "ToDo", label: "To Do", barClass: "border-t-slate-400", dotClass: "bg-slate-400", icon: ListChecks },
  { key: "InProgress", label: "In Progress", barClass: "border-t-blue-500", dotClass: "bg-blue-500", icon: ListChecks },
  { key: "Blocked", label: "Blocked", barClass: "border-t-amber-500", dotClass: "bg-amber-500", icon: Ban },
  { key: "Completed", label: "Completed", barClass: "border-t-emerald-500", dotClass: "bg-emerald-500", icon: CheckCircle2 },
];

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const NEW_TASK_INITIAL_STATE = {
  title: "",
  description: "",
  projectId: "none",
  assignedToUserId: "unassigned",
  priority: "Medium",
  dueDate: "",
};

export default function PmsTasks() {
  useModuleData("/pms/tasks");
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(NEW_TASK_INITIAL_STATE);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const { data: board, isLoading: isBoardLoading } = useQuery<BoardResponse>({
    queryKey: ["/api/pms/tasks/board"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/tasks/board");
      if (!res.ok) throw new Error("Failed to load task board");
      return res.json();
    },
  });

  const { data: meta } = useQuery<TaskMeta>({
    queryKey: ["/api/pms/tasks/meta"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pms/tasks/meta");
      if (!res.ok) throw new Error("Failed to load task metadata");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof NEW_TASK_INITIAL_STATE) => {
      const res = await apiRequest("POST", "/api/pms/tasks", {
        title: data.title.trim(),
        description: data.description.trim() || undefined,
        projectId: data.projectId !== "none" ? data.projectId : undefined,
        assignedToUserId: data.assignedToUserId !== "unassigned" ? data.assignedToUserId : undefined,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks/board"] });
      setIsCreateOpen(false);
      setForm(NEW_TASK_INITIAL_STATE);
      toast({ title: "Task created", description: "New task added to the To Do column" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const res = await apiRequest("PATCH", `/api/pms/tasks/${id}`, { status });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update task status");
      }
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/pms/tasks/board"] });
      const previous = queryClient.getQueryData<BoardResponse>(["/api/pms/tasks/board"]);
      if (previous) {
        queryClient.setQueryData<BoardResponse>(["/api/pms/tasks/board"], {
          ...previous,
          items: previous.items.map((t) => (t.id === id ? { ...t, status } : t)),
        });
      }
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/pms/tasks/board"], context.previous);
      }
      toast({ title: "Could not move task", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks/board"] });
    },
  });

  const items = board?.items ?? [];

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, projectFilter, search]);

  const columns = COLUMNS.map((col) => ({
    ...col,
    tasks: filteredItems.filter((t) => t.status === col.key),
  }));

  const isOverdue = (task: BoardTask) =>
    !!task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "Completed";

  const moveTask = (id: string, status: TaskStatus) => {
    const task = items.find((t) => t.id === id);
    if (task && task.status !== status) {
      moveMutation.mutate({ id, status });
    }
  };

  const handleDrop = (status: TaskStatus) => {
    setDragOverColumn(null);
    if (draggedTaskId) {
      moveTask(draggedTaskId, status);
    }
    setDraggedTaskId(null);
  };

  const canSave = form.title.trim().length > 0 && !createMutation.isPending;

  return (
    <div className="p-6 space-y-6" data-testid="page-task-board">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#4338ca] to-[#6366f1]"
            data-testid="text-page-title"
          >
            Task Board
          </h1>
          <p className="text-muted-foreground font-medium">
            Create tasks and track them across To Do, In Progress, Blocked and Completed
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-create-task"
              className="bg-gradient-to-r from-[#4338ca] to-[#6366f1] hover:from-[#3730a3] hover:to-[#4f46e5] text-white shadow-xl shadow-indigo-500/25 font-black tracking-wide border-0 transition-all duration-500 active:scale-95 h-10 px-6 rounded-lg"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Task Name</Label>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Enter task name"
                  data-testid="input-task-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={form.projectId}
                    onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
                  >
                    <SelectTrigger data-testid="select-task-project">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {(meta?.projects ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || "Untitled Project"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Select
                    value={form.assignedToUserId}
                    onValueChange={(v) => setForm((f) => ({ ...f, assignedToUserId: v }))}
                  >
                    <SelectTrigger data-testid="select-task-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(meta?.users ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || "Unnamed User"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  >
                    <SelectTrigger data-testid="select-task-priority">
                      <SelectValue placeholder="Medium" />
                    </SelectTrigger>
                    <SelectContent>
                      {(meta?.priorities ?? ["Low", "Medium", "High"]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">Due Date</Label>
                  <Input
                    id="task-due"
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    data-testid="input-task-due-date"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-detail">Detail</Label>
                <Textarea
                  id="task-detail"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the task..."
                  data-testid="input-task-detail"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create-task">
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={!canSave}
                data-testid="button-submit-task"
              >
                {createMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: board?.counts?.total ?? 0 },
          { label: "To Do", value: board?.counts?.toDo ?? 0 },
          { label: "In Progress", value: board?.counts?.inProgress ?? 0 },
          { label: "Blocked", value: board?.counts?.blocked ?? 0 },
          { label: "Completed", value: board?.counts?.completed ?? 0 },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold" data-testid={`text-count-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by name..."
            className="pl-9"
            data-testid="input-search-tasks"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-56" data-testid="select-project-filter">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {(meta?.projects ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name || "Untitled Project"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban Board */}
      {isBoardLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading task board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="kanban-board">
          {columns.map((col) => {
            return (
              <div
                key={col.key}
                className={`bg-slate-50 dark:bg-zinc-900 rounded-lg border-t-4 ${col.barClass} border-x border-b border-gray-200 dark:border-zinc-800 flex flex-col min-h-[320px] transition-colors ${
                  dragOverColumn === col.key ? "ring-2 ring-indigo-400" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverColumn(col.key);
                }}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDrop(col.key)}
                data-testid={`column-${col.key}`}
              >
                <div className="p-3 flex items-center justify-between border-b border-gray-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                    <span className="text-sm font-bold text-gray-700 dark:text-zinc-300">{col.label}</span>
                  </div>
                  <Badge variant="secondary" data-testid={`badge-count-${col.key}`}>
                    {col.tasks.length}
                  </Badge>
                </div>

                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {col.tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                  ) : (
                    col.tasks.map((task) => (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onDragEnd={() => setDraggedTaskId(null)}
                        className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        data-testid={`card-task-${task.id}`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100 leading-snug">
                              {task.title}
                            </p>
                            <Badge className={`${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium} border-0 shrink-0`}>
                              {task.priority}
                            </Badge>
                          </div>

                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                          )}

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Folder className="h-3 w-3" />
                            <span className="truncate">{task.project?.name || "No project"}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <UserIcon className="h-3 w-3" />
                            <span className="truncate">{task.assignee?.name || "Unassigned"}</span>
                          </div>

                          {task.dueDate && (
                            <div
                              className={`flex items-center gap-1.5 text-xs ${
                                isOverdue(task) ? "text-red-600 font-semibold" : "text-muted-foreground"
                              }`}
                            >
                              {isOverdue(task) ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                              {isOverdue(task) && <span>Overdue</span>}
                            </div>
                          )}

                          <Select
                            value={task.status}
                            onValueChange={(value) => moveTask(task.id, value as TaskStatus)}
                          >
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-task-status-${task.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COLUMNS.map((c) => (
                                <SelectItem key={c.key} value={c.key}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
