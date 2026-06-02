import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/breadcrumb";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary } from "react-error-boundary";

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
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="p-6 text-center space-y-4">
      <h2 className="text-xl font-bold text-destructive">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
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
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/attendance/todo/participants");
      return res.json();
    },
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

  const listQuery = useQuery<TodoTask[]>({
    queryKey: ["/api/attendance/todo/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/attendance/todo");
      return res.json();
    },
  });

  const summaryQuery = useQuery<TodoSummary>({
    queryKey: ["/api/attendance/todo/summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/attendance/todo/summary");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: { items: TodoItem[] }) => {
      const res = await apiRequest("POST", "/api/attendance/todo", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/summary"] });
      setItems([makeBlankRow()]);
    },
  });

  const markDoneMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PATCH", `/api/attendance/todo/${taskId}/status`, { status: "FINISHED" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/todo/summary"] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update task",
        description: err?.message ?? "Please try again",
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

  const handleSubmit = async () => {
    const filtered = items.filter((i) => i.task.trim());
    if (!filtered.length) return;
    await mutation.mutateAsync({ items: filtered });
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
                          <Badge key={pid} variant="outline">
                            {p?.name || pid}
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
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading...</div>
          ) : !Array.isArray(listQuery.data) || listQuery.data.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              {!Array.isArray(listQuery.data) && listQuery.data ? (listQuery.data as any).error || "Failed to load tasks." : "No tasks yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {listQuery.data.map((t: any) => {
                if (!t) return null;
                return (
                  <div key={t.id} className="border rounded-lg p-3 flex items-start justify-between">
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
                    <Badge variant="outline">{t.status || "PENDING"}</Badge>
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

