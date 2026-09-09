import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/breadcrumb";
import { Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

type Participant = { id: string; name: string };
type TodoItem = {
  task: string;
  category: string;
  time: string;
  date: string;
  participants: string[];
  priority: "HIGH" | "MEDIUM" | "LOW";
  repeat: "HOUR" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "NONE";
  reminder: "same_day" | "5m" | "10m" | "15m" | "1d";
  description: string;
  attachmentName?: string | null;
};

type TodoSummary = {
  assign: number;
  unreceived: number;
  received: number;
  pending: number;
  finished: number;
};

type TodoTask = {
  id: string;
  title: string;
  category: string | null;
  description?: string | null;
  priority: string;
  repeat: string;
  reminder: string;
  due_date: string;
  due_time: string | null;
  participants?: string[] | null;
  status: string;
};
function ErrorFallback({ error }: FallbackProps) {
  return (
    <div className="p-6 text-center space-y-4">
      <h2 className="text-xl font-bold text-destructive">Something went wrong</h2>
      <p className="text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <Button onClick={() => window.location.reload()}>Reload Page</Button>
    </div>
  );
}

export default function AttendanceTodo() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AttendanceTodoContent />
    </ErrorBoundary>
  );
}

function AttendanceTodoContent() {
  const [items, setItems] = useState<TodoItem[]>([makeBlankRow()]);
  const [categories, setCategories] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ["/api/attendance/todo/participants"],
    queryFn: async () => apiRequestJson("GET", "/api/attendance/todo/participants"),
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/attendance/todo/categories");
        setCategories(await res.json());
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  const [filters, setFilters] = useState({
    status: "ALL",
    category: "ALL",
    priority: "ALL",
    participant: "ALL",
    from: "",
    to: "",
  });

  const buildListUrl = () => {
    const q = new URLSearchParams();
    if (filters.status !== "ALL") q.set("status", filters.status);
    if (filters.category !== "ALL") q.set("category", filters.category);
    if (filters.priority !== "ALL") q.set("priority", filters.priority);
    if (filters.participant !== "ALL") q.set("participant", filters.participant);
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
    const qs = q.toString();
    return qs ? `/api/attendance/todo?${qs}` : "/api/attendance/todo";
  };

  const listQuery = useQuery<TodoTask[]>({
    queryKey: ["/api/attendance/todo/list", filters],
    queryFn: async () => apiRequestJson("GET", buildListUrl()),
  });

  const summaryQuery = useQuery<TodoSummary>({
    queryKey: ["/api/attendance/todo/summary"],
    queryFn: async () => apiRequestJson("GET", "/api/attendance/todo/summary"),
  });

  const mutation = useMutation({
    mutationFn: async (payload: { items: TodoItem[] }) =>
      apiRequestJson("POST", "/api/attendance/todo", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/summary"] });
      setItems([makeBlankRow()]);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) =>
      apiRequestJson("PATCH", `/api/attendance/todo/${taskId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/summary"] });
    },
    onError: () => {
      toast({
        title: "Couldn't update the task",
        description: "You may not have permission, or something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleChange = (idx: number, field: keyof TodoItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleAddRow = () => setItems((prev) => [...prev, makeBlankRow()]);

  const handleRemoveRow = (idx: number) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleRemoveParticipant = (idx: number, pid: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], participants: next[idx].participants.filter((p) => p !== pid) };
      return next;
    });
  };

  const handleSubmit = async () => {
    const filtered = items.filter((i) => i.task.trim());
    if (!filtered.length) {
      toast({
        title: "Add a task first",
        description: "Enter a task title in at least one row before submitting.",
        variant: "destructive",
      });
      return;
    }
    const missingDate = filtered.some((i) => !i.date);
    if (missingDate) {
      toast({
        title: "Date required",
        description: "Each task needs a due date.",
        variant: "destructive",
      });
      return;
    }
    try {
      await mutation.mutateAsync({ items: filtered });
      toast({ title: "Tasks submitted", description: `${filtered.length} task(s) created.` });
    } catch {
      toast({
        title: "Couldn't submit tasks",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "HR & Attendance" }, { label: "Attendance" }, { label: "To Do List" }]} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">TO DO LIST</h1>
          <p className="text-muted-foreground text-sm">Create and track your attendance tasks.</p>
        </div>
      </div>

      <TodoSummaryBar loading={summaryQuery.isLoading} data={summaryQuery.data} />

      <Card>
        <CardHeader>
          <CardTitle>Create To Do List</CardTitle>
          <CardDescription>Add one or more tasks then submit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {items.map((row, idx) => (
            <div key={idx} className="border rounded-xl p-4 space-y-3 relative">
              <button
                type="button"
                onClick={() => handleRemoveRow(idx)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-destructive"
                aria-label="Remove row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Task</Label>
                  <Input
                    placeholder="enter banner title"
                    value={row.task}
                    onChange={(e) => handleChange(idx, "task", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input
                    type="file"
                    onChange={(e) => handleChange(idx, "attachmentName", e.target.files?.[0]?.name ?? null)}
                  />
                  {row.attachmentName && <p className="text-xs text-muted-foreground">{row.attachmentName}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={row.category}
                    onValueChange={(v) => handleChange(idx, "category", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={row.time} onChange={(e) => handleChange(idx, "time", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={row.date} onChange={(e) => handleChange(idx, "date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Participants</Label>
                  <Select
                    value=""
                    onValueChange={(v) => handleChange(idx, "participants", Array.from(new Set([...row.participants, v])))}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {participants.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {row.participants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {row.participants.map((pid) => {
                        const p = participants.find((x) => x.id === pid);
                        return (
                          <Badge key={pid} variant="outline" className="flex items-center gap-1 pr-1">
                            {p?.name || pid}
                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(idx, pid)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${p?.name || pid}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <RadioGroup
                    value={row.priority}
                    onValueChange={(v) => handleChange(idx, "priority", v as TodoItem["priority"])}
                    className="flex flex-wrap gap-4"
                  >
                    {["HIGH", "MEDIUM", "LOW"].map((p) => (
                      <div key={p} className="flex items-center space-x-2">
                        <RadioGroupItem value={p} id={`priority-${idx}-${p}`} />
                        <Label htmlFor={`priority-${idx}-${p}`}>{p}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Repeat Task</Label>
                  <RadioGroup
                    value={row.repeat}
                    onValueChange={(v) => handleChange(idx, "repeat", v as TodoItem["repeat"])}
                    className="flex flex-wrap gap-4"
                  >
                    {["HOUR", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map((p) => (
                      <div key={p} className="flex items-center space-x-2">
                        <RadioGroupItem value={p} id={`repeat-${idx}-${p}`} />
                        <Label htmlFor={`repeat-${idx}-${p}`}>{p}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>Reminder</Label>
                  <RadioGroup
                    value={row.reminder}
                    onValueChange={(v) => handleChange(idx, "reminder", v as TodoItem["reminder"])}
                    className="flex flex-wrap gap-4"
                  >
                    {[
                      { value: "same_day", label: "Same with due date" },
                      { value: "5m", label: "5 minutes before" },
                      { value: "10m", label: "10 minutes before" },
                      { value: "15m", label: "15 minutes before" },
                      { value: "1d", label: "1 day before" },
                    ].map((r) => (
                      <div key={r.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={r.value} id={`rem-${idx}-${r.value}`} />
                        <Label htmlFor={`rem-${idx}-${r.value}`}>{r.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={4}
                  placeholder="Add a description..."
                  value={row.description}
                  onChange={(e) => handleChange(idx, "description", e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleAddRow}>
              <Plus className="w-4 h-4 mr-2" />
              Add Row
            </Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks</CardTitle>
          <CardDescription>Filter and review submitted tasks.</CardDescription>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ALL", "ASSIGNED", "RECEIVED", "PENDING", "REOPENED", "FINISHED"].map((s) => (
                    <SelectItem key={s} value={s}>{s === "ALL" ? "All statuses" : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="filter-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
                <SelectTrigger data-testid="filter-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ALL", "HIGH", "MEDIUM", "LOW"].map((p) => (
                    <SelectItem key={p} value={p}>{p === "ALL" ? "All priorities" : p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Participant</Label>
              <Select value={filters.participant} onValueChange={(v) => setFilters((f) => ({ ...f, participant: v }))}>
                <SelectTrigger data-testid="filter-participant"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All participants</SelectItem>
                  {participants.map((pp) => (
                    <SelectItem key={pp.id} value={pp.id}>{pp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} data-testid="filter-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} data-testid="filter-to" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading...</div>
          ) : listQuery.isError ? (
            <div className="text-sm text-destructive py-4">Couldn't load tasks. Please try again.</div>
          ) : !Array.isArray(listQuery.data) || listQuery.data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              {!Array.isArray(listQuery.data) && listQuery.data ? "Couldn't load tasks. Please try again." : "No tasks yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {listQuery.data.map((t: any) => {
                if (!t) return null;
                return (
                  <div key={t.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{t.title || "Untitled Task"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.category ? `${t.category} · ` : ""}{t.priority || "MEDIUM"} · {(() => {
                          try {
                            return t.due_date ? format(new Date(t.due_date), "PPP") : "No date";
                          } catch {
                            return String(t.due_date || "Invalid date");
                          }
                        })()}
                      </div>
                      {t.description && (
                        <div className="text-sm text-muted-foreground line-clamp-2">{t.description}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline">{t.status || "PENDING"}</Badge>
                      {(() => {
                        const s = String(t.status || "").toUpperCase();
                        const isFinished = s === "FINISHED" || s === "DONE" || s === "COMPLETED";
                        if (isFinished) {
                          return (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ taskId: t.id, status: "REOPENED" })}
                              data-testid={`button-reopen-${t.id}`}
                            >
                              Reopen
                            </Button>
                          );
                        }
                        return (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {s !== "RECEIVED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ taskId: t.id, status: "RECEIVED" })}
                                data-testid={`button-received-${t.id}`}
                              >
                                Mark Received
                              </Button>
                            )}
                            {s !== "PENDING" && s !== "REOPENED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ taskId: t.id, status: "PENDING" })}
                                data-testid={`button-pending-${t.id}`}
                              >
                                Mark Pending
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ taskId: t.id, status: "FINISHED" })}
                              data-testid={`button-done-${t.id}`}
                            >
                              Mark Done
                            </Button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function TodoSummaryBar({ loading, data }: { loading: boolean; data?: TodoSummary }) {
  const summary: TodoSummary = data ?? {
    assign: 0,
    unreceived: 0,
    received: 0,
    pending: 0,
    finished: 0,
  };

  const cards: Array<{ label: string; value: number; testId: string }> = [
    { label: "Assign To Do Task", value: summary.assign, testId: "todo-summary-assign" },
    { label: "Un-received", value: summary.unreceived, testId: "todo-summary-unreceived" },
    { label: "Received", value: summary.received, testId: "todo-summary-received" },
    { label: "Pending", value: summary.pending, testId: "todo-summary-pending" },
    { label: "Finished", value: summary.finished, testId: "todo-summary-finished" },
  ];

  return (
    <Card data-testid="card-todo-summary">
      <CardHeader className="pb-3">
        <CardTitle>To Do List Task</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border p-3 shadow-sm">
              <div className="text-sm text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-bold mt-1" data-testid={c.testId}>
                {loading ? <Skeleton className="h-6 w-12" /> : (c.value ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function makeBlankRow(): TodoItem {
  const today = new Date();
  return {
    task: "",
    category: "",
    time: "",
    date: format(today, "yyyy-MM-dd"),
    participants: [],
    priority: "MEDIUM",
    repeat: "NONE",
    reminder: "same_day",
    description: "",
    attachmentName: null,
  };
}

