"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
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
import { isManagerialRole, normalizeRole } from "@/lib/auth/role-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type PreviewItem = {
  userId: string;
  employeeName: string;
  department: string | null;
  basicSalary: number;
  daysPresent: number;
  daysAbsent: number;
  unpaidLeaveDays: number;
  overtimeMinutes: number;
  allowanceAmount: number;
  bonusAmount: number;
  overtimeAmount: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  penaltyAmount: number;
  loanDeduction: number;
  otherDeductions: number;
};
type PreviewResponse = { items: PreviewItem[]; finalizedConflicts: string[] };
type SalaryRun = {
  id: string;
  period_month: number;
  period_year: number;
  branch: string | null;
  department: string | null;
  status: string;
  employee_count: number;
  total_gross: string | null;
  total_deductions: string | null;
  total_net: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const now = new Date();
type ManualKey = "allowanceAmount" | "bonusAmount" | "overtimeAmount" | "loanDeduction" | "otherDeductions";
const MANUAL_KEYS: ManualKey[] = ["allowanceAmount", "bonusAmount", "overtimeAmount", "loanDeduction", "otherDeductions"];

function roleFlags(role: string | null | undefined) {
  const n = normalizeRole(role);
  const full = n.includes("super_admin") || n.includes("administrator") || n === "admin" || n.includes("super_hod");
  const accounts = n.includes("account");
  const hr = n === "hr" || n.includes("hr_") || n.includes("human_resource");
  const hod = isManagerialRole(role) && n.includes("hod") && !n.includes("super_hod");
  return {
    canGenerate: full || accounts || hr,
    canApprove: full || accounts || hr || hod,
    canFinalize: full || accounts,
    canEdit: full || accounts || hr,
    canCancel: full || accounts || hr,
  };
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-zinc-100 text-zinc-600",
    GENERATED: "bg-blue-50 text-blue-700",
    APPROVED: "bg-amber-50 text-amber-700",
    FINALIZED: "bg-green-50 text-green-700",
    LOCKED: "bg-green-50 text-green-700",
    CANCELLED: "bg-red-50 text-red-600",
  };
  return <span className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold ${map[status] || "bg-zinc-100 text-zinc-600"}`}>{status}</span>;
}

export function SalaryCreatePage() {
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
  const flags = useMemo(() => roleFlags(me?.role), [me?.role]);

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branch, setBranch] = useState("all");
  const [department, setDepartment] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [search, setSearch] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, Partial<Record<ManualKey, string>>>>({});
  const [pendingAction, setPendingAction] = useState<{ id: string; status: "FINALIZED" | "CANCELLED"; period: string } | null>(null);
  const [actionReason, setActionReason] = useState("");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-create"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) return { users: [] };
      return res.json();
    },
    enabled: flags.canGenerate,
  });
  const employees = employeesQuery.data?.users ?? [];

  const qs = useMemo(() => {
    const p = new URLSearchParams({ month, year });
    if (branch !== "all") p.set("branch", branch);
    if (department !== "all") p.set("department", department);
    if (employeeId !== "all") p.set("employeeId", employeeId);
    return p.toString();
  }, [month, year, branch, department, employeeId]);

  const preview = useQuery<PreviewResponse>({
    queryKey: ["/api/salary/preview", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/salary/preview?${qs}`);
      if (!res.ok) throw new Error("Could not load the salary preview.");
      return res.json();
    },
    enabled: flags.canGenerate,
  });

  const runsQuery = useQuery<{ runs: SalaryRun[] }>({
    queryKey: ["/api/salary/runs", "create-panel"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/salary/runs?pageSize=20");
      if (!res.ok) throw new Error("Could not load salary runs.");
      return res.json();
    },
  });

  function buildAdjustments() {
    const out: Record<string, Record<string, number>> = {};
    for (const [uid, fields] of Object.entries(adjustments)) {
      const entry: Record<string, number> = {};
      let any = false;
      for (const k of MANUAL_KEYS) {
        const raw = fields[k];
        if (raw !== undefined && raw !== "") {
          entry[k] = Number(raw) || 0;
          any = true;
        }
      }
      if (any) out[uid] = entry;
    }
    return out;
  }

  const saveRun = useMutation({
    mutationFn: async (mode: "DRAFT" | "GENERATED") => {
      const res = await apiRequest("POST", "/api/salary/runs", {
        month: Number(month),
        year: Number(year),
        branch: branch === "all" ? null : branch,
        department: department === "all" ? null : department,
        employeeId: employeeId === "all" ? undefined : employeeId,
        mode,
        manualAdjustments: buildAdjustments(),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: (_data, mode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({ title: mode === "GENERATED" ? "Salary run generated" : "Draft saved", description: `${MONTHS[Number(month) - 1]} ${year}.` });
    },
    onError: (err: Error) => {
      const msg = /409/.test(err.message) ? "A finalized salary already exists for some of these employees in this period." : /403/.test(err.message) ? "You are not authorized to generate salary." : "Could not save the salary run.";
      toast({ title: "Unable to save salary run", description: msg, variant: "destructive" });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: string; reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/salary/runs/${vars.id}/status`, { status: vars.status, ...(vars.reason?.trim() ? { reason: vars.reason.trim() } : {}) });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({ title: `Run ${vars.status.toLowerCase()}`, description: "Status updated." });
    },
    onError: (err: Error) => {
      const msg = /409/.test(err.message) ? "This transition is not allowed, or a finalized salary already exists for some employees." : /403/.test(err.message) ? "You are not authorized for this action." : "Could not update the run.";
      toast({ title: "Action failed", description: msg, variant: "destructive" });
    },
  });

  function liveRow(item: PreviewItem) {
    const adj = adjustments[item.userId] || {};
    const num = (k: ManualKey, fallback: number) => (adj[k] !== undefined && adj[k] !== "" ? Number(adj[k]) || 0 : fallback);
    const allowance = num("allowanceAmount", item.allowanceAmount);
    const bonus = num("bonusAmount", item.bonusAmount);
    const overtime = num("overtimeAmount", item.overtimeAmount);
    const loan = num("loanDeduction", item.loanDeduction);
    const other = num("otherDeductions", item.otherDeductions);
    const gross = item.basicSalary + allowance + bonus + overtime;
    const totalDed = item.unpaidLeaveDeduction + item.absenceDeduction + item.lateDeduction + item.penaltyAmount + loan + other;
    const net = gross - totalDed;
    return { gross, totalDed, net, payable: Math.max(0, net) };
  }

  const items = preview.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term ? items.filter((it) => it.employeeName.toLowerCase().includes(term)) : items;
  const conflicts = preview.data?.finalizedConflicts ?? [];
  const runs = runsQuery.data?.runs ?? [];

  function manualInput(item: PreviewItem, key: ManualKey) {
    const adj = adjustments[item.userId] || {};
    const fallback = (item as any)[key] as number;
    return (
      <Input
        type="number"
        min="0"
        step="0.01"
        value={adj[key] ?? (fallback ? String(fallback) : "")}
        placeholder="0"
        disabled={!flags.canEdit}
        onChange={(e) => setAdjustments((prev) => ({ ...prev, [item.userId]: { ...prev[item.userId], [key]: e.target.value } }))}
        className="h-7 w-20 px-1.5 text-xs"
      />
    );
  }

  const previewColumns = useMemo((): DataTableColumn<PreviewItem>[] => [
    { id: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.employeeName}</span> },
    { id: "dept", header: "Dept", cell: (r) => r.department || "-" },
    { id: "basic", header: "Basic", cell: (r) => fmt(r.basicSalary) },
    { id: "present", header: "Present", cell: (r) => r.daysPresent },
    { id: "absent", header: "Absent", cell: (r) => r.daysAbsent },
    { id: "allowance", header: "Allowance", cell: (r) => manualInput(r, "allowanceAmount") },
    { id: "bonus", header: "Bonus", cell: (r) => manualInput(r, "bonusAmount") },
    { id: "ot", header: "OT Amt", cell: (r) => manualInput(r, "overtimeAmount") },
    { id: "loan", header: "Loan", cell: (r) => manualInput(r, "loanDeduction") },
    { id: "other", header: "Other", cell: (r) => manualInput(r, "otherDeductions") },
    { id: "penalty", header: "Penalty", cell: (r) => fmt(r.penaltyAmount) },
    { id: "gross", header: "Gross", cell: (r) => fmt(liveRow(r).gross) },
    { id: "ded", header: "Deductions", cell: (r) => <span className="text-red-600 dark:text-red-400">{fmt(liveRow(r).totalDed)}</span> },
    { id: "net", header: "Net", cell: (r) => <span className="font-semibold">{fmt(liveRow(r).net)}</span> },
    { id: "payable", header: "Payable", cell: (r) => <span className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(liveRow(r).payable)}</span> },
  ], [adjustments, flags.canEdit]);

  const runColumns = useMemo((): DataTableColumn<SalaryRun>[] => [
    { id: "period", header: "Period", cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}` },
    { id: "branch", header: "Branch", cell: (r) => r.branch || "-" },
    { id: "dept", header: "Dept", cell: (r) => r.department || "-" },
    { id: "count", header: "Employees", cell: (r) => r.employee_count },
    { id: "gross", header: "Gross", cell: (r) => fmt(Number(r.total_gross || 0)) },
    { id: "ded", header: "Deductions", cell: (r) => <span className="text-red-600 dark:text-red-400">{fmt(Number(r.total_deductions || 0))}</span> },
    { id: "net", header: "Net", cell: (r) => fmt(Number(r.total_net || 0)) },
    { id: "status", header: "Status", cell: (r) => <StatusBadge status={(r.status || "DRAFT").toUpperCase()} /> },
    {
      id: "actions",
      header: "Actions",
      cell: (r) => {
        const status = (r.status || "DRAFT").toUpperCase();
        const locked = ["FINALIZED", "LOCKED", "CANCELLED"].includes(status);
        return (
          <div className="flex gap-1.5">
            {status === "DRAFT" && flags.canGenerate ? (
              <Button size="sm" variant="primary" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: "GENERATED" })}>
                Generate
              </Button>
            ) : null}
            {status === "GENERATED" && flags.canApprove ? (
              <Button size="sm" variant="secondary" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: r.id, status: "APPROVED" })}>
                Approve
              </Button>
            ) : null}
            {status === "APPROVED" && flags.canFinalize ? (
              <Button
                size="sm"
                variant="primary"
                disabled={setStatus.isPending}
                onClick={() => {
                  setActionReason("");
                  setPendingAction({ id: r.id, status: "FINALIZED", period: `${MONTHS[r.period_month - 1]} ${r.period_year}` });
                }}
              >
                Finalize
              </Button>
            ) : null}
            {!locked && flags.canCancel ? (
              <Button
                size="sm"
                variant="danger"
                disabled={setStatus.isPending}
                onClick={() => {
                  setActionReason("");
                  setPendingAction({ id: r.id, status: "CANCELLED", period: `${MONTHS[r.period_month - 1]} ${r.period_year}` });
                }}
              >
                Cancel
              </Button>
            ) : null}
            {locked ? <span className="text-xs text-zinc-400">—</span> : null}
          </div>
        );
      },
    },
  ], [flags, setStatus.isPending]);

  return (
    <ReportsShell title="Salary Create">
      {!flags.canGenerate ? (
        <DrmSection title="Not authorized">
          <p className="text-sm text-rose-600 dark:text-rose-400">You are not authorized to create or preview salary runs.</p>
        </DrmSection>
      ) : (
        <DrmSection title="Preview">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <Field id="sc-month" label="Month">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="sc-month" className="w-36">
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
            <Field id="sc-year" label="Year">
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="sc-year" className="w-28">
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
            <Field id="sc-branch" label="Branch">
              <Input value={branch === "all" ? "" : branch} placeholder="All branches" onChange={(e) => setBranch(e.target.value || "all")} className="w-36" />
            </Field>
            <Field id="sc-dept" label="Department">
              <Input value={department === "all" ? "" : department} placeholder="All departments" onChange={(e) => setDepartment(e.target.value || "all")} className="w-40" />
            </Field>
            <Field id="sc-employee" label="Employee">
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="sc-employee" className="w-48">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName || e.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="button" variant="secondary" disabled={saveRun.isPending || preview.isLoading || items.length === 0} onClick={() => saveRun.mutate("DRAFT")}>
              {saveRun.isPending ? "Saving…" : "Save as Draft"}
            </Button>
            <Button type="button" variant="primary" disabled={saveRun.isPending || preview.isLoading || items.length === 0} onClick={() => saveRun.mutate("GENERATED")}>
              {saveRun.isPending ? "Saving…" : "Generate Run"}
            </Button>
          </div>

          <p className="mb-3 text-xs text-zinc-500">
            Preview from live HR data. Gross = basic + allowance + bonus + overtime. Deductions = unpaid-leave + absence + penalties + loan + other. Net = gross − deductions (payable is never
            below 0).
          </p>

          {conflicts.length > 0 ? (
            <div className="mb-3 flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>These employees already have a finalized salary for this period and will block finalize: {conflicts.join(", ")}.</span>
            </div>
          ) : null}

          <div className="mb-3 flex justify-end">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…" className="h-8 w-56" />
          </div>

          <DataTable
            columns={previewColumns}
            rows={filtered}
            rowKey={(row) => row.userId}
            loading={preview.isLoading}
            error={preview.isError ? "Could not load the salary preview." : null}
            onRetry={() => preview.refetch()}
            emptyMessage="No employees found for the selected period/scope."
            className="min-w-[1700px]"
          />
        </DrmSection>
      )}

      <DrmSection title="Recent Salary Runs">
        <DataTable
          columns={runColumns}
          rows={runs}
          rowKey={(row) => row.id}
          loading={runsQuery.isLoading}
          error={runsQuery.isError ? "Could not load salary runs." : null}
          onRetry={() => runsQuery.refetch()}
          emptyMessage="No salary runs yet."
          className="min-w-[1100px]"
        />
      </DrmSection>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) { setPendingAction(null); setActionReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.status === "FINALIZED" ? "Finalize this salary run?" : "Cancel this salary run?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.status === "FINALIZED" ? (
                <>Finalizing locks the run for <span className="font-semibold">{pendingAction?.period}</span>. A finalized run cannot be edited or re-generated.</>
              ) : (
                <>Cancelling the run for <span className="font-semibold">{pendingAction?.period}</span> is permanent and cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field id="sc-action-reason" label="Reason (optional)">
            <Textarea rows={3} value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Add a note for the audit log…" />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setStatus.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={setStatus.isPending}
              onClick={() => {
                if (!pendingAction) return;
                setStatus.mutate({ id: pendingAction.id, status: pendingAction.status, reason: actionReason }, { onSettled: () => { setPendingAction(null); setActionReason(""); } });
              }}
            >
              {pendingAction?.status === "FINALIZED" ? "Finalize run" : "Cancel run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReportsShell>
  );
}
