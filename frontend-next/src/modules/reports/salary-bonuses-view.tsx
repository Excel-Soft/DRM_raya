"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { normalizeRole } from "@/lib/auth/role-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type Bonus = {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  amount: string | number | null;
  reason: string | null;
  status: string;
  approved_by_name: string | null;
  approved_at: string | null;
  employee_name: string | null;
  employee_department: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const now = new Date();

function canManageBonus(role: string | null | undefined) {
  const n = normalizeRole(role);
  if (!n) return true;
  const full = n.includes("super_admin") || n.includes("administrator") || n === "admin" || n.includes("super_hod");
  const accounts = n.includes("account");
  const hr = n === "hr" || n.includes("hr_") || n.includes("human_resource");
  return full || accounts || hr;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  const cls = s === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-green-950 dark:text-green-400" : s === "REJECTED" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{s}</span>;
}

export function SalaryBonusesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: me } = useQuery<{ role?: string }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      if (!res.ok) return {};
      return res.json();
    },
  });
  const canManage = useMemo(() => canManageBonus(me?.role), [me?.role]);

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = useState("all");
  const [formEmployee, setFormEmployee] = useState("");
  const [formMonth, setFormMonth] = useState(String(now.getMonth() + 1));
  const [formYear, setFormYear] = useState(String(now.getFullYear()));
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-bonuses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) return { users: [] };
      return res.json();
    },
    enabled: canManage,
  });
  const employees = employeesQuery.data?.users ?? [];

  const qs = useMemo(() => {
    const p = new URLSearchParams({ month, year });
    if (statusFilter !== "all") p.set("status", statusFilter);
    return p.toString();
  }, [month, year, statusFilter]);

  const bonusesQuery = useQuery<{ bonuses: Bonus[] }>({
    queryKey: ["/api/salary/bonuses", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/salary/bonuses?${qs}`);
      if (!res.ok) throw new Error("Could not load bonuses.");
      return res.json();
    },
    enabled: canManage,
  });
  const bonuses = bonusesQuery.data?.bonuses ?? [];

  function describeError(message: string, fallback: string) {
    if (/403/.test(message)) return "You are not authorized for this action.";
    if (/404/.test(message)) return "The employee or bonus could not be found.";
    if (/409/.test(message)) return "Only pending bonuses can be changed.";
    if (/400/.test(message)) return "Please check the values and try again.";
    return fallback;
  }

  const createBonus = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/salary/bonuses", {
        userId: formEmployee,
        month: Number(formMonth),
        year: Number(formYear),
        amount: Number(formAmount) || 0,
        reason: formReason.trim() || null,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      setFormAmount("");
      setFormReason("");
      toast({ title: "Bonus added", description: "It is now pending approval." });
    },
    onError: (err: Error) => toast({ title: "Unable to add bonus", description: describeError(err.message, "Could not create the bonus."), variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: "APPROVED" | "REJECTED" }) => {
      const res = await apiRequest("PATCH", `/api/salary/bonuses/${vars.id}/status`, { status: vars.status });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      toast({ title: `Bonus ${vars.status.toLowerCase()}`, description: "Status updated." });
    },
    onError: (err: Error) => toast({ title: "Action failed", description: describeError(err.message, "Could not update the bonus."), variant: "destructive" }),
  });

  const removeBonus = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/salary/bonuses/${id}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      toast({ title: "Bonus removed", description: "The pending bonus was deleted." });
    },
    onError: (err: Error) => toast({ title: "Unable to remove bonus", description: describeError(err.message, "Could not delete the bonus."), variant: "destructive" }),
  });

  function handleAddBonus() {
    if (!formEmployee) {
      toast({ title: "Employee required", description: "Please select an employee from the dropdown list.", variant: "destructive" });
      return;
    }
    if (!formAmount || isNaN(Number(formAmount)) || Number(formAmount) <= 0) {
      toast({ title: "Valid amount required", description: "Please enter a bonus amount greater than 0.", variant: "destructive" });
      return;
    }
    createBonus.mutate();
  }

  const approvedTotal = bonuses.filter((b) => b.status.toUpperCase() === "APPROVED").reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const columns = useMemo((): DataTableColumn<Bonus>[] => [
    { id: "employee", header: "Employee", cell: (r) => <span className="font-medium">{r.employee_name || r.user_id}</span> },
    { id: "dept", header: "Department", cell: (r) => r.employee_department || "—" },
    { id: "period", header: "Period", cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { id: "amount", header: "Amount", className: "text-right", cell: (r) => fmt(Number(r.amount) || 0) },
    { id: "reason", header: "Reason", cell: (r) => <span className="line-clamp-1 max-w-[220px]" title={r.reason || ""}>{r.reason || "—"}</span> },
    { id: "status", header: "Status", cell: (r) => statusBadge(r.status) },
    {
      id: "approved",
      header: "Approved By",
      cell: (r) => (r.approved_by_name ? (
        <>
          {r.approved_by_name}
          {r.approved_at ? <div className="text-[10px] text-zinc-400">{new Date(r.approved_at).toLocaleDateString()}</div> : null}
        </>
      ) : "—"),
    },
    {
      id: "actions",
      header: "Actions",
      className: "text-right",
      cell: (r) => {
        const busy = setStatus.isPending || removeBonus.isPending;
        if (r.status.toUpperCase() !== "PENDING") return <span className="text-zinc-400">—</span>;
        return (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="primary" disabled={busy} onClick={() => setStatus.mutate({ id: r.id, status: "APPROVED" })}>
              Approve
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setStatus.mutate({ id: r.id, status: "REJECTED" })}>
              Reject
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => removeBonus.mutate(r.id)}>
              Delete
            </Button>
          </div>
        );
      },
    },
  ], [setStatus.isPending, removeBonus.isPending]);

  if (!canManage) {
    return (
      <ReportsShell title="Employee Bonuses">
        <DrmSection title="Not authorized">
          <p className="text-sm text-rose-600 dark:text-rose-400">You are not authorized to manage employee bonuses.</p>
        </DrmSection>
      </ReportsShell>
    );
  }

  return (
    <ReportsShell title="Employee Bonuses">
      <DrmSection title="Add Bonus">
        <div className="flex flex-wrap items-end gap-4">
          <Field id="sb-employee" label="Employee">
            <Select value={formEmployee} onValueChange={setFormEmployee}>
              <SelectTrigger id="sb-employee" className="w-56">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName || e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sb-month" label="Month">
            <Select value={formMonth} onValueChange={setFormMonth}>
              <SelectTrigger id="sb-month" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sb-year" label="Year">
            <Select value={formYear} onValueChange={setFormYear}>
              <SelectTrigger id="sb-year" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sb-amount" label="Amount">
            <Input type="number" min="0" step="0.01" value={formAmount} placeholder="0.00" onChange={(e) => setFormAmount(e.target.value)} className="w-36" />
          </Field>
          <Field id="sb-reason" label="Reason" className="min-w-[200px] flex-1">
            <Input value={formReason} placeholder="Reason (optional)" onChange={(e) => setFormReason(e.target.value)} />
          </Field>
          <Button type="button" variant="primary" disabled={createBonus.isPending} onClick={handleAddBonus}>
            {createBonus.isPending ? "Adding…" : "Add Bonus"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">New bonuses start as Pending. Only Approved bonuses for the matching period flow into the salary preview.</p>
      </DrmSection>

      <DrmSection
        title="Bonuses"
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm">
              Approved total: <b>{fmt(approvedTotal)}</b>
            </span>
          </div>
        }
      >
        <DataTable columns={columns} rows={bonuses} rowKey={(row) => row.id} loading={bonusesQuery.isLoading} emptyMessage="No bonuses for this period." className="min-w-[1000px]" />
      </DrmSection>
    </ReportsShell>
  );
}
