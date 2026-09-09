import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { isManagerialRole, normalizeRole } from "@/lib/role-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AttendanceEdit = {
  id: string;
  user_id: string;
  attendance_date: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  status: string;
  rejection_reason: string | null;
  employee_name: string | null;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
  created_at: string;
};

type UserListItem = { id: string; name: string | null; branch: string | null };

const FIELDS = ["status", "check_in", "check_out", "notes", "working_hours"];
const STATUSES = ["Present", "Absent", "Late", "HalfDay", "Leave"];

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

// apiRequestJson throws Error(`${status}: ${body}`). Recover the status + parsed body.
function parseApiError(err: any): { status: number | null; body: any } {
  const msg = String(err?.message ?? "");
  const m = msg.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) return { status: null, body: null };
  let body: any = m[2];
  try { body = JSON.parse(m[2]); } catch { /* keep raw text */ }
  return { status: Number(m[1]), body };
}

const emptyForm = {
  userId: "",
  attendanceDate: "",
  field: "status",
  beforeValue: "",
  afterValue: "",
  reason: "",
};

export default function EditAtt() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const user = {
    userId: sessionStorage.getItem("userId") || "",
    roleId: sessionStorage.getItem("userRole") || "",
  };
  const isManager = isManagerialRole(user.roleId);
  const isAdmin = normalizeRole(user.roleId) === "admin";

  const editsQuery = useQuery<{ edits: AttendanceEdit[] }>({
    queryKey: ["/api/attendance/edits"],
    queryFn: async () => apiRequestJson("GET", "/api/attendance/edits"),
  });

  // Employee picker for the request modal (privileged-only; degrade if 403).
  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ["/api/reports/users-list"],
    queryFn: async () => apiRequestJson("GET", "/api/reports/users-list"),
    enabled: isManager,
    retry: false,
  });
  const users = usersQuery.data ?? [];

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const approve = useMutation({
    mutationFn: async (vars: { id: string; overrideReason?: string }) =>
      apiRequestJson(
        "PATCH",
        `/api/attendance/edits/${vars.id}/approve`,
        vars.overrideReason ? { overrideReason: vars.overrideReason } : undefined,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request approved" });
    },
    onError: (err: any, vars) => {
      const { status, body } = parseApiError(err);
      if (status === 423 && body?.salaryLocked) {
        // Already retried with an override and still locked, or caller is not admin.
        if (vars.overrideReason || !isAdmin) {
          toast({
            title: "Salary locked",
            description: body?.error || "This month's salary is finalized. Only an admin can override.",
            variant: "destructive",
          });
          return;
        }
        const reason = window.prompt(
          "This employee's salary for that month is finalized/locked.\nEnter an admin override reason to apply this change anyway:",
        );
        if (reason && reason.trim()) {
          approve.mutate({ id: vars.id, overrideReason: reason.trim() });
        } else {
          toast({ title: "Approval cancelled" });
        }
        return;
      }
      toast({
        title: "Unable to approve",
        description: body?.error || "You may not have permission, or the request is no longer pending.",
        variant: "destructive",
      });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const rejectionReason = window.prompt("Reason for rejection:");
      if (!rejectionReason || !rejectionReason.trim()) {
        throw new Error("cancelled");
      }
      return apiRequestJson("PATCH", `/api/attendance/edits/${id}/reject`, { rejectionReason: rejectionReason.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request rejected" });
    },
    onError: (err: any) => {
      if (err?.message === "cancelled") return;
      const { body } = parseApiError(err);
      toast({
        title: "Unable to reject",
        description: body?.error || "You may not have permission, or the request is no longer pending.",
        variant: "destructive",
      });
    },
  });

  const createReq = useMutation({
    mutationFn: async () => {
      const userId = isManager ? form.userId : user.userId;
      if (!userId) throw new Error("local: Select an employee");
      if (!form.attendanceDate) throw new Error("local: Pick the attendance date");
      if (!FIELDS.includes(form.field)) throw new Error("local: Pick a field");
      if (!form.reason.trim()) throw new Error("local: A reason is required");
      if (form.field === "status" && !STATUSES.includes(form.afterValue)) {
        throw new Error("local: Pick a valid status");
      }
      return apiRequestJson("POST", "/api/attendance/edits", {
        userId,
        attendanceDate: form.attendanceDate,
        field: form.field,
        beforeValue: form.beforeValue.trim() || null,
        afterValue: form.afterValue.trim() || null,
        reason: form.reason.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Edit request submitted" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      if (msg.startsWith("local: ")) {
        toast({ title: msg.slice(7), variant: "destructive" });
        return;
      }
      const { body } = parseApiError(err);
      toast({
        title: "Could not submit request",
        description: body?.error || "Please check the fields and try again.",
        variant: "destructive",
      });
    },
  });

  const edits = editsQuery.data?.edits ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? edits.filter((e) =>
        (e.employee_name || "").toLowerCase().includes(term) ||
        (e.field || "").toLowerCase().includes(term) ||
        (e.status || "").toLowerCase().includes(term))
    : edits;

  function statusBadge(status: string) {
    const s = status.toLowerCase();
    const cls =
      s === "approved" ? "bg-[#e8f5e9] text-[#00a65a] dark:bg-green-950 dark:text-green-400" :
      s === "rejected" ? "bg-[#fdecea] text-[#d9534f] dark:bg-red-950 dark:text-red-400" :
      "bg-[#fff8e1] text-[#b8860b] dark:bg-amber-950 dark:text-amber-400";
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{status}</span>;
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-[17px] font-bold text-[#555] dark:text-zinc-300 uppercase">Edit Attendance</h1>
          <Button
            onClick={() => { setForm({ ...emptyForm }); setModalOpen(true); }}
            className="h-8 px-4 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-bold rounded-sm shadow-sm"
          >
            New Request
          </Button>
        </div>

        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-4 space-y-4">

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {isManager
                  ? "Review and approve or reject attendance edit requests."
                  : "Your attendance edit requests and their status."}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Search:</span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white dark:bg-zinc-900 border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 mt-4">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#fdf3db] dark:bg-zinc-900">
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Employee</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Date</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Field</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Before</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">After</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Reason</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Requested By</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Status</TableHead>
                    {isManager && (
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-center text-xs">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {editsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                    </TableRow>
                  ) : editsQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center py-8">
                        <div className="text-[#d9534f] mb-2">Could not load attendance edit requests.</div>
                        <Button size="sm" variant="outline" onClick={() => editsQuery.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">
                        No attendance edit requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800 transition-colors">
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 font-semibold">{e.employee_name || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{formatDate(e.attendance_date)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{e.field}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{e.before_value ?? "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{e.after_value ?? "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 max-w-[240px] truncate" title={e.reason}>{e.reason}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{e.requested_by_name || "-"}</TableCell>
                        <TableCell className="py-3 px-3">{statusBadge(e.status)}</TableCell>
                        {isManager && (
                          <TableCell className="py-3 px-3 text-center">
                            {e.status === "Pending" ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approve.mutate({ id: e.id })}
                                  disabled={approve.isPending}
                                  className="h-7 px-3 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs rounded-sm"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reject.mutate(e.id)}
                                  disabled={reject.isPending}
                                  className="h-7 px-3 border-[#d9534f] text-[#d9534f] dark:text-red-400 hover:bg-[#fdecea] dark:hover:bg-red-950 text-xs rounded-sm"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {e.reviewed_by_name ? `by ${e.reviewed_by_name}` : "-"}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New Attendance Edit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {isManager ? (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Employee</Label>
                <Select value={form.userId} onValueChange={(v) => setField("userId", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-slate-500">This request will be submitted for your own attendance.</p>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Attendance date</Label>
              <Input type="date" value={form.attendanceDate} onChange={(e) => setField("attendanceDate", e.target.value)} className="h-8 text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Field</Label>
              <Select value={form.field} onValueChange={(v) => setField("field", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Before (current)</Label>
                <Input value={form.beforeValue} onChange={(e) => setField("beforeValue", e.target.value)} placeholder="Optional" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">After (new value)</Label>
                {form.field === "status" ? (
                  <Select value={form.afterValue} onValueChange={(v) => setField("afterValue", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : form.field === "check_in" || form.field === "check_out" ? (
                  <Input type="datetime-local" value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} className="h-8 text-xs" />
                ) : form.field === "working_hours" ? (
                  <Input type="number" min="0" step="0.25" value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} className="h-8 text-xs" />
                ) : (
                  <Input value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} className="h-8 text-xs" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-500">Reason <span className="text-[#d9534f] dark:text-red-400">*</span></Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setField("reason", e.target.value)}
                placeholder="Why is this correction needed?"
                className="text-xs min-h-[72px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="h-8 px-4 text-xs">Cancel</Button>
            <Button
              onClick={() => createReq.mutate()}
              disabled={createReq.isPending}
              className="h-8 px-4 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-bold shadow-sm"
            >
              {createReq.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
