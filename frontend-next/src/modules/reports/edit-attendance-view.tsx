"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { isManagerialRole, normalizeRole } from "@/lib/auth/role-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type AttendanceEdit = {
  id: string;
  attendance_date: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  status: string;
  employee_name: string | null;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
};

type UserListItem = { id: string; name: string | null };

const FIELDS = ["status", "check_in", "check_out", "notes", "working_hours"];
const STATUSES = ["Present", "Absent", "Late", "HalfDay", "Leave"];

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function parseApiError(message: string): { status: number | null; body: any } {
  const m = message.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) return { status: null, body: null };
  let body: any = m[2];
  try {
    body = JSON.parse(m[2]);
  } catch {
    /* keep raw text */
  }
  return { status: Number(m[1]), body };
}

const emptyForm = { userId: "", attendanceDate: "", field: "status", beforeValue: "", afterValue: "", reason: "" };

export function EditAttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: me } = useQuery<{ id?: string; role?: string }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      if (!res.ok) return {};
      return res.json();
    },
  });
  const isManager = isManagerialRole(me?.role);
  const isAdmin = normalizeRole(me?.role) === "admin";

  const editsQuery = useQuery<{ edits: AttendanceEdit[] }>({
    queryKey: ["/api/attendance/edits"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/attendance/edits");
      if (!res.ok) throw new Error("Could not load attendance edit requests.");
      return res.json();
    },
  });

  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ["/api/reports/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reports/users-list");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isManager,
    retry: false,
  });
  const users = usersQuery.data ?? [];

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function patchEdit(id: string, path: string, body?: unknown) {
    const res = await apiRequest("PATCH", `/api/attendance/edits/${id}/${path}`, body);
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  }

  const approve = useMutation({
    mutationFn: (vars: { id: string; overrideReason?: string }) => patchEdit(vars.id, "approve", vars.overrideReason ? { overrideReason: vars.overrideReason } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request approved" });
    },
    onError: (err: Error, vars) => {
      const { status, body } = parseApiError(err.message);
      if (status === 423 && body?.salaryLocked) {
        if (vars.overrideReason || !isAdmin) {
          toast({ title: "Salary locked", description: body?.error || "This month's salary is finalized. Only an admin can override.", variant: "destructive" });
          return;
        }
        const reason = window.prompt("This employee's salary for that month is finalized/locked.\nEnter an admin override reason to apply this change anyway:");
        if (reason && reason.trim()) {
          approve.mutate({ id: vars.id, overrideReason: reason.trim() });
        } else {
          toast({ title: "Approval cancelled" });
        }
        return;
      }
      toast({ title: "Unable to approve", description: body?.error || "You may not have permission, or the request is no longer pending.", variant: "destructive" });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const rejectionReason = window.prompt("Reason for rejection:");
      if (!rejectionReason || !rejectionReason.trim()) throw new Error("cancelled");
      return patchEdit(id, "reject", { rejectionReason: rejectionReason.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request rejected" });
    },
    onError: (err: Error) => {
      if (err.message === "cancelled") return;
      const { body } = parseApiError(err.message);
      toast({ title: "Unable to reject", description: body?.error || "You may not have permission, or the request is no longer pending.", variant: "destructive" });
    },
  });

  const createReq = useMutation({
    mutationFn: async () => {
      const userId = isManager ? form.userId : me?.id;
      if (!userId) throw new Error("local: Select an employee");
      if (!form.attendanceDate) throw new Error("local: Pick the attendance date");
      if (!form.reason.trim()) throw new Error("local: A reason is required");
      if (form.field === "status" && !STATUSES.includes(form.afterValue)) throw new Error("local: Pick a valid status");
      const res = await apiRequest("POST", "/api/attendance/edits", {
        userId,
        attendanceDate: form.attendanceDate,
        field: form.field,
        beforeValue: form.beforeValue.trim() || null,
        afterValue: form.afterValue.trim() || null,
        reason: form.reason.trim(),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Edit request submitted" });
      setModalOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      if (msg.startsWith("local: ")) {
        toast({ title: msg.slice(7), variant: "destructive" });
        return;
      }
      const { body } = parseApiError(msg);
      toast({ title: "Could not submit request", description: body?.error || "Please check the fields and try again.", variant: "destructive" });
    },
  });

  const edits = editsQuery.data?.edits ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term ? edits.filter((e) => [e.employee_name, e.field, e.status].some((v) => (v || "").toLowerCase().includes(term))) : edits;

  function statusBadge(status: string) {
    const s = status.toLowerCase();
    const cls =
      s === "approved"
        ? "bg-emerald-100 text-emerald-700 dark:bg-green-950 dark:text-green-400"
        : s === "rejected"
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>{status}</span>;
  }

  const columns = useMemo((): DataTableColumn<AttendanceEdit>[] => {
    const cols: DataTableColumn<AttendanceEdit>[] = [
      { id: "employee", header: "Employee", cell: (r) => <span className="font-semibold">{r.employee_name || "-"}</span> },
      { id: "date", header: "Date", cell: (r) => formatDate(r.attendance_date) },
      { id: "field", header: "Field", cell: (r) => r.field },
      { id: "before", header: "Before", cell: (r) => r.before_value ?? "-" },
      { id: "after", header: "After", cell: (r) => r.after_value ?? "-" },
      { id: "reason", header: "Reason", cell: (r) => <span className="line-clamp-1 max-w-[240px]" title={r.reason}>{r.reason}</span> },
      { id: "requested", header: "Requested By", cell: (r) => r.requested_by_name || "-" },
      { id: "status", header: "Status", cell: (r) => statusBadge(r.status) },
    ];
    if (isManager) {
      cols.push({
        id: "actions",
        header: "Actions",
        className: "text-center",
        cell: (r) =>
          r.status === "Pending" ? (
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="primary" disabled={approve.isPending} onClick={() => approve.mutate({ id: r.id })}>
                Approve
              </Button>
              <Button size="sm" variant="danger" disabled={reject.isPending} onClick={() => reject.mutate(r.id)}>
                Reject
              </Button>
            </div>
          ) : (
            <span className="text-xs text-zinc-400">{r.reviewed_by_name ? `by ${r.reviewed_by_name}` : "-"}</span>
          ),
      });
    }
    return cols;
  }, [isManager, approve.isPending, reject.isPending]);

  return (
    <ReportsShell
      title="Edit Attendance"
      actions={
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            setForm({ ...emptyForm });
            setModalOpen(true);
          }}
        >
          New Request
        </Button>
      }
    >
      <DrmSection
        title={isManager ? "Review and approve or reject attendance edit requests." : "Your attendance edit requests and their status."}
        actions={<Input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-52" />}
      >
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={editsQuery.isLoading}
          error={editsQuery.isError ? "Could not load attendance edit requests." : null}
          onRetry={() => editsQuery.refetch()}
          emptyMessage="No attendance edit requests found."
          className="min-w-[1100px]"
        />
      </DrmSection>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Attendance Edit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {isManager ? (
              <Field id="ea-employee" label="Employee">
                <Select value={form.userId} onValueChange={(v) => setField("userId", v)}>
                  <SelectTrigger id="ea-employee">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <p className="text-xs text-zinc-500">This request will be submitted for your own attendance.</p>
            )}
            <Field id="ea-date" label="Attendance date">
              <Input type="date" value={form.attendanceDate} onChange={(e) => setField("attendanceDate", e.target.value)} />
            </Field>
            <Field id="ea-field" label="Field">
              <Select value={form.field} onValueChange={(v) => setField("field", v)}>
                <SelectTrigger id="ea-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELDS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="ea-before" label="Before (current)">
                <Input value={form.beforeValue} onChange={(e) => setField("beforeValue", e.target.value)} placeholder="Optional" />
              </Field>
              <Field id="ea-after" label="After (new value)">
                {form.field === "status" ? (
                  <Select value={form.afterValue} onValueChange={(v) => setField("afterValue", v)}>
                    <SelectTrigger id="ea-after">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : form.field === "check_in" || form.field === "check_out" ? (
                  <Input type="datetime-local" value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} />
                ) : form.field === "working_hours" ? (
                  <Input type="number" min="0" step="0.25" value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} />
                ) : (
                  <Input value={form.afterValue} onChange={(e) => setField("afterValue", e.target.value)} />
                )}
              </Field>
            </div>
            <Field id="ea-reason" label="Reason *">
              <Textarea rows={3} value={form.reason} onChange={(e) => setField("reason", e.target.value)} placeholder="Why is this correction needed?" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={createReq.isPending} onClick={() => createReq.mutate()}>
              {createReq.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportsShell>
  );
}
