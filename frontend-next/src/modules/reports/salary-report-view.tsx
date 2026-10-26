"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
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
import { normalizeRole } from "@/lib/auth/role-utils";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { buildFileName } from "@/lib/export/export-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type ReportRow = {
  id: string;
  run_id: string;
  employee_name: string | null;
  department: string | null;
  branch: string | null;
  basic_salary: string | null;
  days_present: number | null;
  days_absent: number | null;
  allowance_amount: string | null;
  bonus_amount: string | null;
  gross_salary: string | null;
  penalty_amount: string | null;
  loan_deduction: string | null;
  total_deductions: string | null;
  net_salary: string | null;
  payable_salary: string | null;
  payment_status: string | null;
  paid_by_name: string | null;
  paid_at: string | null;
  run_status: string | null;
  period_month: number;
  period_year: number;
};
type ReportResponse = { rows: ReportRow[]; total: number; totals?: { totalGross: number; totalDeductions: number; totalNet: number; totalPayable: number } };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const now = new Date();
const SALARY_STATUSES = ["DRAFT", "GENERATED", "APPROVED", "FINALIZED", "LOCKED", "CANCELLED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID"];
const PAGE_SIZE = 50;

function canMarkPaid(role: string | null | undefined) {
  const n = normalizeRole(role);
  return n.includes("super_admin") || n.includes("administrator") || n === "admin" || n.includes("super_hod") || n.includes("account");
}

function fmt(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";
}
function fmtDate(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

export function SalaryReportPage() {
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
  const markPaidAllowed = useMemo(() => canMarkPaid(me?.role), [me?.role]);

  const [month, setMonth] = useState("all");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingRunAction, setPendingRunAction] = useState<{ runId: string; period: string; paymentStatus: "PAID" | "UNPAID" } | null>(null);

  const runSummary = useQuery<{ paid: number; unpaid: number }>({
    queryKey: ["/api/salary/runs", pendingRunAction?.runId, "payment-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/salary/runs/${pendingRunAction!.runId}/payment-summary`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!pendingRunAction,
  });
  const affectedCount = pendingRunAction ? (pendingRunAction.paymentStatus === "PAID" ? runSummary.data?.unpaid : runSummary.data?.paid) : undefined;

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) return { users: [] };
      return res.json();
    },
  });
  const employees = employeesQuery.data?.users ?? [];

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (month !== "all") p.set("month", month);
    if (year !== "all") p.set("year", year);
    if (status !== "all") p.set("status", status);
    if (paymentStatus !== "all") p.set("paymentStatus", paymentStatus);
    if (branch.trim()) p.set("branch", branch.trim());
    if (department.trim()) p.set("department", department.trim());
    if (employeeId !== "all") p.set("employeeId", employeeId);
    if (search.trim()) p.set("search", search.trim());
    return p;
  }, [month, year, status, paymentStatus, branch, department, employeeId, search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams(filterParams);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return p.toString();
  }, [filterParams, page]);

  const report = useQuery<ReportResponse>({
    queryKey: ["/api/reports/salary", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/salary?${qs}`);
      if (!res.ok) throw new Error("Could not load the salary report. You may not have permission to view payroll.");
      return res.json();
    },
  });

  const rows = report.data?.rows ?? [];
  const total = report.data?.total ?? 0;
  const totals = report.data?.totals;

  const markPaid = useMutation({
    mutationFn: async ({ id, paymentStatus: ps }: { id: string; paymentStatus: "PAID" | "UNPAID" }) => {
      const res = await apiRequest("PATCH", `/api/salary/run-items/${id}/payment`, { paymentStatus: ps });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/salary"] });
      toast({ title: vars.paymentStatus === "PAID" ? "Marked as paid" : "Marked as unpaid" });
    },
    onError: (err: Error) => {
      const msg = /403/.test(err.message) ? "You are not authorized to mark salaries as paid." : /409/.test(err.message) ? "Only finalized salaries can be marked paid." : "Could not update payment status.";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    },
  });

  const markRunPaid = useMutation({
    mutationFn: async ({ runId, paymentStatus: ps }: { runId: string; paymentStatus: "PAID" | "UNPAID" }) => {
      const res = await apiRequest("PATCH", `/api/salary/runs/${runId}/payment`, { paymentStatus: ps });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<{ updated: number; total: number }>;
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/salary"] });
      const verb = vars.paymentStatus === "PAID" ? "paid" : "unpaid";
      toast({ title: vars.paymentStatus === "PAID" ? "Run marked as paid" : "Run marked as unpaid", description: `${data?.updated ?? 0} of ${data?.total ?? 0} line(s) set to ${verb}.` });
    },
    onError: (err: Error) => {
      const msg = /403/.test(err.message) ? "You are not authorized to mark salaries as paid." : /409/.test(err.message) ? "Only finalized runs can be marked paid." : "Could not update payment status.";
      toast({ title: "Bulk update failed", description: msg, variant: "destructive" });
    },
  });

  const finalizedRuns = useMemo(() => {
    const map = new Map<string, { runId: string; period: string; paid: number; unpaid: number }>();
    for (const r of rows) {
      if ((r.run_status || "").toUpperCase() !== "FINALIZED" || !r.run_id) continue;
      const period = `${MONTHS[r.period_month - 1]?.slice(0, 3) ?? r.period_month} ${r.period_year}`;
      const entry = map.get(r.run_id) ?? { runId: r.run_id, period, paid: 0, unpaid: 0 };
      if ((r.payment_status || "UNPAID").toUpperCase() === "PAID") entry.paid += 1;
      else entry.unpaid += 1;
      map.set(r.run_id, entry);
    }
    return Array.from(map.values());
  }, [rows]);

  async function handleExport() {
    try {
      await downloadAuthedFile(`/api/reports/salary/export?${filterParams}`, buildFileName("salary_report", "csv"));
    } catch (err: any) {
      const m = err?.status === 403 ? "You are not authorized to export salary." : "Export failed.";
      toast({ title: "Unable to export", description: m, variant: "destructive" });
    }
  }

  function resetPageAnd(fn: () => void) {
    setPage(1);
    fn();
  }

  const columns = useMemo((): DataTableColumn<ReportRow>[] => [
    { id: "period", header: "Period", cell: (r) => `${MONTHS[r.period_month - 1]?.slice(0, 3)} ${r.period_year}` },
    { id: "name", header: "Name", cell: (r) => <span className="font-semibold">{r.employee_name || "-"}</span> },
    { id: "dept", header: "Dept", cell: (r) => r.department || "-" },
    { id: "branch", header: "Branch", cell: (r) => r.branch || "-" },
    { id: "basic", header: "Basic", cell: (r) => fmt(r.basic_salary) },
    { id: "present", header: "Present", cell: (r) => r.days_present ?? 0 },
    { id: "absent", header: "Absent", cell: (r) => r.days_absent ?? 0 },
    { id: "allowance", header: "Allowance", cell: (r) => fmt(r.allowance_amount) },
    { id: "bonus", header: "Bonus", cell: (r) => fmt(r.bonus_amount) },
    { id: "gross", header: "Gross", cell: (r) => fmt(r.gross_salary) },
    { id: "penalty", header: "Penalty", cell: (r) => fmt(r.penalty_amount) },
    { id: "loan", header: "Loan", cell: (r) => fmt(r.loan_deduction) },
    { id: "ded", header: "Deductions", cell: (r) => <span className="text-red-600">{fmt(r.total_deductions)}</span> },
    { id: "net", header: "Net", cell: (r) => <span className="font-semibold">{fmt(r.net_salary)}</span> },
    { id: "payable", header: "Payable", cell: (r) => <span className="font-bold text-emerald-700">{fmt(r.payable_salary)}</span> },
    { id: "status", header: "Status", cell: (r) => <StatusBadge status={(r.run_status || "DRAFT").toUpperCase()} /> },
    {
      id: "payment",
      header: "Payment",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold ${(r.payment_status || "").toUpperCase() === "PAID" ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-600"}`}>
            {(r.payment_status || "UNPAID").toUpperCase()}
          </span>
          {(r.payment_status || "").toUpperCase() === "PAID" && r.paid_by_name ? (
            <span className="text-[10.5px] leading-tight text-zinc-500">
              by {r.paid_by_name}
              {r.paid_at ? ` · ${fmtDate(r.paid_at)}` : ""}
            </span>
          ) : null}
          {markPaidAllowed && (r.run_status || "").toUpperCase() === "FINALIZED" ? (
            (r.payment_status || "UNPAID").toUpperCase() === "PAID" ? (
              <Button size="sm" variant="secondary" disabled={markPaid.isPending} onClick={() => markPaid.mutate({ id: r.id, paymentStatus: "UNPAID" })}>
                Mark unpaid
              </Button>
            ) : (
              <Button size="sm" variant="primary" disabled={markPaid.isPending} onClick={() => markPaid.mutate({ id: r.id, paymentStatus: "PAID" })}>
                Mark paid
              </Button>
            )
          ) : null}
        </div>
      ),
    },
  ], [markPaidAllowed, markPaid.isPending]);

  return (
    <ReportsShell
      title="Salary Report"
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleExport}>
            Export CSV
          </Button>
          <Button type="button" variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      }
    >
      <DrmSection title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="sr-month" label="Month">
            <Select value={month} onValueChange={(v) => resetPageAnd(() => setMonth(v))}>
              <SelectTrigger id="sr-month" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sr-year" label="Year">
            <Select value={year} onValueChange={(v) => resetPageAnd(() => setYear(v))}>
              <SelectTrigger id="sr-year" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sr-status" label="Salary Status">
            <Select value={status} onValueChange={(v) => resetPageAnd(() => setStatus(v))}>
              <SelectTrigger id="sr-status" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {SALARY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sr-payment" label="Payment">
            <Select value={paymentStatus} onValueChange={(v) => resetPageAnd(() => setPaymentStatus(v))}>
              <SelectTrigger id="sr-payment" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="sr-branch" label="Branch">
            <Input value={branch} placeholder="All" onChange={(e) => resetPageAnd(() => setBranch(e.target.value))} className="w-32" />
          </Field>
          <Field id="sr-dept" label="Department">
            <Input value={department} placeholder="All" onChange={(e) => resetPageAnd(() => setDepartment(e.target.value))} className="w-36" />
          </Field>
          <Field id="sr-employee" label="Employee">
            <Select value={employeeId} onValueChange={(v) => resetPageAnd(() => setEmployeeId(v))}>
              <SelectTrigger id="sr-employee" className="w-44">
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
          <Field id="sr-search" label="Search">
            <Input value={search} placeholder="Employee name" onChange={(e) => resetPageAnd(() => setSearch(e.target.value))} className="w-44" />
          </Field>
        </div>

        {markPaidAllowed && finalizedRuns.length > 0 ? (
          <div className="mt-4 space-y-2">
            {finalizedRuns.map((run) => (
              <div key={run.runId} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-xs">
                  <span className="font-semibold">Finalized run — {run.period}</span>
                  <span className="ml-2 text-zinc-500">
                    {run.paid} paid / {run.unpaid} unpaid (this page)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" disabled={markRunPaid.isPending || run.unpaid === 0} onClick={() => setPendingRunAction({ runId: run.runId, period: run.period, paymentStatus: "PAID" })}>
                    Mark all as paid
                  </Button>
                  <Button size="sm" variant="secondary" disabled={markRunPaid.isPending || run.paid === 0} onClick={() => setPendingRunAction({ runId: run.runId, period: run.period, paymentStatus: "UNPAID" })}>
                    Mark all as unpaid
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </DrmSection>

      <DrmSection title="Salary Records">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={report.isLoading}
          error={report.isError ? "Could not load the salary report. You may not have permission to view payroll." : null}
          onRetry={() => report.refetch()}
          emptyMessage="No salary records match these filters."
          className="min-w-[1900px]"
        />
        {totals ? (
          <div className="mt-2 flex flex-wrap justify-end gap-4 border-t border-zinc-200 pt-2 text-sm font-bold dark:border-zinc-800">
            <span>Gross: {fmt(totals.totalGross)}</span>
            <span className="text-red-600">Deductions: {fmt(totals.totalDeductions)}</span>
            <span>Net: {fmt(totals.totalNet)}</span>
            <span className="text-emerald-700">Payable: {fmt(totals.totalPayable)}</span>
          </div>
        ) : null}
        {total > 0 ? <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} className="mt-4" /> : null}
      </DrmSection>

      <AlertDialog open={!!pendingRunAction} onOpenChange={(open) => { if (!open) setPendingRunAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingRunAction?.paymentStatus === "PAID" ? "Mark entire run as paid?" : "Mark entire run as unpaid?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRunAction ? (
                runSummary.isLoading ? (
                  <>Checking how many lines this will affect…</>
                ) : runSummary.isError ? (
                  <>Could not load the line count for this run. You can still proceed, but please double-check the run before confirming.</>
                ) : (
                  <>
                    This will set <span className="font-semibold">{affectedCount ?? 0}</span> {pendingRunAction.paymentStatus === "PAID" ? "unpaid" : "paid"} line(s) in the finalized run for{" "}
                    <span className="font-semibold">{pendingRunAction.period}</span> to <span className="font-semibold">{pendingRunAction.paymentStatus === "PAID" ? "paid" : "unpaid"}</span> at
                    once. This affects the whole payroll run and cannot be undone in one step.
                  </>
                )
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markRunPaid.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={markRunPaid.isPending || runSummary.isLoading}
              onClick={() => {
                if (!pendingRunAction) return;
                markRunPaid.mutate({ runId: pendingRunAction.runId, paymentStatus: pendingRunAction.paymentStatus }, { onSettled: () => setPendingRunAction(null) });
              }}
            >
              {pendingRunAction?.paymentStatus === "PAID" ? "Mark all as paid" : "Mark all as unpaid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ReportsShell>
  );
}
