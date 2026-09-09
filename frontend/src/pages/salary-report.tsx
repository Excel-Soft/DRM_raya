import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { downloadAuthedFile } from "@/lib/download";
import { safeReportFilename } from "@/lib/reportApi";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type ReportRow = {
  id: string;
  run_id: string;
  employee_name: string | null;
  department: string | null;
  branch: string | null;
  basic_salary: string | null;
  per_day_salary: string | null;
  days_present: number | null;
  days_absent: number | null;
  unpaid_leave_days: number | null;
  allowance_amount: string | null;
  bonus_amount: string | null;
  overtime_minutes: number | null;
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

type ReportResponse = {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { totalGross: number; totalDeductions: number; totalNet: number; totalPayable: number };
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const now = new Date();

const SALARY_STATUSES = ["DRAFT", "GENERATED", "APPROVED", "FINALIZED", "LOCKED", "CANCELLED"];
const PAYMENT_STATUSES = ["UNPAID", "PAID"];

function canExport() {
  return true;
}

// Accounts/admin only — matches the server's "mark_paid" action (full + accounts classes).
function canMarkPaid() {
  const r = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
  return r.includes("super_admin") || r.includes("administrator") || r === "admin" || r.includes("super_hod")
    || r.includes("account");
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

export default function SalaryReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const exportAllowed = useMemo(canExport, []);
  const markPaidAllowed = useMemo(canMarkPaid, []);

  const [month, setMonth] = useState("all");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const [generatedBy, setGeneratedBy] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [pendingRunAction, setPendingRunAction] = useState<
    { runId: string; period: string; paymentStatus: "PAID" | "UNPAID" } | null
  >(null);

  const runSummary = useQuery<{ runId: string; paid: number; unpaid: number; total: number }>({
    queryKey: ["/api/salary/runs", pendingRunAction?.runId, "payment-summary"],
    queryFn: async () => apiRequestJson("GET", `/api/salary/runs/${pendingRunAction!.runId}/payment-summary`),
    enabled: !!pendingRunAction,
  });
  const affectedCount = pendingRunAction
    ? (pendingRunAction.paymentStatus === "PAID" ? runSummary.data?.unpaid : runSummary.data?.paid)
    : undefined;

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-report"],
    queryFn: async () => apiRequestJson("GET", "/api/users"),
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
    if (generatedBy !== "all") p.set("generatedBy", generatedBy);
    if (search.trim()) p.set("search", search.trim());
    return p;
  }, [month, year, status, paymentStatus, branch, department, employeeId, generatedBy, search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams(filterParams);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [filterParams, page]);

  const report = useQuery<ReportResponse>({
    queryKey: ["/api/reports/salary", qs],
    queryFn: async () => apiRequestJson<ReportResponse>("GET", `/api/reports/salary?${qs}`),
  });

  const rows = report.data?.rows ?? [];
  const total = report.data?.total ?? 0;
  const totals = report.data?.totals;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const markPaid = useMutation({
    mutationFn: async ({ id, paymentStatus }: { id: string; paymentStatus: "PAID" | "UNPAID" }) =>
      apiRequestJson("PATCH", `/api/salary/run-items/${id}/payment`, { paymentStatus }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/salary"] });
      toast({ title: vars.paymentStatus === "PAID" ? "Marked as paid" : "Marked as unpaid" });
    },
    onError: (err: any) => {
      const msg = /403/.test(String(err?.message)) ? "You are not authorized to mark salaries as paid."
        : /409/.test(String(err?.message)) ? "Only finalized salaries can be marked paid."
        : "Could not update payment status.";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    },
  });

  const markRunPaid = useMutation({
    mutationFn: async ({ runId, paymentStatus }: { runId: string; paymentStatus: "PAID" | "UNPAID" }) =>
      apiRequestJson<{ updated: number; total: number }>("PATCH", `/api/salary/runs/${runId}/payment`, { paymentStatus }),
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/salary"] });
      const verb = vars.paymentStatus === "PAID" ? "paid" : "unpaid";
      toast({
        title: vars.paymentStatus === "PAID" ? "Run marked as paid" : "Run marked as unpaid",
        description: `${data?.updated ?? 0} of ${data?.total ?? 0} line(s) set to ${verb}.`,
      });
    },
    onError: (err: any) => {
      const msg = /403/.test(String(err?.message)) ? "You are not authorized to mark salaries as paid."
        : /409/.test(String(err?.message)) ? "Only finalized runs can be marked paid."
        : "Could not update payment status.";
      toast({ title: "Bulk update failed", description: msg, variant: "destructive" });
    },
  });

  // Distinct FINALIZED runs in the current view, with paid/unpaid counts, so
  // accounts can mark a whole run paid/unpaid in one action.
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
      await downloadAuthedFile(
        `/api/reports/salary/export?${filterParams.toString()}`,
        safeReportFilename("salary-report", {
          from: filterParams.get("year")
            ? `${filterParams.get("year")}${filterParams.get("month") ? `-${filterParams.get("month")}` : ""}`
            : undefined,
          branch: filterParams.get("branch") || undefined,
          user: filterParams.get("employeeId") || undefined,
          timestamp: true,
        }),
      );
    } catch (err: any) {
      const m = err?.status === 403 || /403/.test(String(err?.message))
        ? "You are not authorized to export salary."
        : "Export failed.";
      toast({ title: "Unable to export", description: m, variant: "destructive" });
    }
  }

  function handlePrint() {
    window.print();
  }

  function resetPageAnd(fn: () => void) { setPage(1); fn(); }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen" id="printable-salary-report">
      <style>{`
        @media print {
          nav, aside, header, [data-sidebar], .print-hide { display: none !important; }
          body { background: white !important; color: black !important; }
          #printable-salary-report { padding: 0 !important; }
        }
      `}</style>
      <div className="p-4 max-w-[1700px] mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[17px] font-bold text-[#555] dark:text-zinc-300 uppercase">SALARY REPORT</h1>
          <div className="flex gap-2 print-hide">
            {exportAllowed && (
              <Button onClick={handleExport}
                className="bg-[#3c8dbc] hover:bg-[#367fa9] text-white font-semibold rounded-sm h-9">Export CSV</Button>
            )}
            <Button onClick={handlePrint}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded-sm h-9">Print</Button>
          </div>
        </div>

        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <Filter label="Month">
                <Select value={month} onValueChange={(v) => resetPageAnd(() => setMonth(v))}>
                  <SelectTrigger className="h-9 w-[140px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Year">
                <Select value={year} onValueChange={(v) => resetPageAnd(() => setYear(v))}>
                  <SelectTrigger className="h-9 w-[110px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Salary Status">
                <Select value={status} onValueChange={(v) => resetPageAnd(() => setStatus(v))}>
                  <SelectTrigger className="h-9 w-[140px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {SALARY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Payment">
                <Select value={paymentStatus} onValueChange={(v) => resetPageAnd(() => setPaymentStatus(v))}>
                  <SelectTrigger className="h-9 w-[120px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Branch">
                <Input value={branch} placeholder="All" onChange={(e) => resetPageAnd(() => setBranch(e.target.value))}
                  className="h-9 w-[130px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </Filter>
              <Filter label="Department">
                <Input value={department} placeholder="All" onChange={(e) => resetPageAnd(() => setDepartment(e.target.value))}
                  className="h-9 w-[150px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </Filter>
              <Filter label="Employee">
                <Select value={employeeId} onValueChange={(v) => resetPageAnd(() => setEmployeeId(v))}>
                  <SelectTrigger className="h-9 w-[180px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue placeholder="All employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName || e.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Generated By">
                <Select value={generatedBy} onValueChange={(v) => resetPageAnd(() => setGeneratedBy(v))}>
                  <SelectTrigger className="h-9 w-[180px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue placeholder="Anyone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Anyone</SelectItem>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName || e.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Filter>
              <Filter label="Search">
                <Input value={search} placeholder="Employee name" onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
                  className="h-9 w-[170px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </Filter>
            </div>

            {/* Bulk per-run payment actions (accounts/admin, FINALIZED only) */}
            {markPaidAllowed && finalizedRuns.length > 0 && (
              <div className="space-y-2">
                {finalizedRuns.map((run) => (
                  <div key={run.runId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-200 dark:border-zinc-800 bg-[#f8fafc] dark:bg-zinc-900 px-3 py-2">
                    <div className="text-[12.5px] text-[#555] dark:text-zinc-300">
                      <span className="font-semibold">Finalized run — {run.period}</span>
                      <span className="ml-2 text-slate-500">
                        {run.paid} paid / {run.unpaid} unpaid (this page)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="h-8 px-3 rounded-sm text-[12px] bg-[#00a65a] hover:bg-[#008d4c] text-white"
                        disabled={markRunPaid.isPending || run.unpaid === 0}
                        onClick={() => setPendingRunAction({ runId: run.runId, period: run.period, paymentStatus: "PAID" })}>
                        Mark all as paid
                      </Button>
                      <Button variant="outline"
                        className="h-8 px-3 rounded-sm text-[12px] border-slate-200"
                        disabled={markRunPaid.isPending || run.paid === 0}
                        onClick={() => setPendingRunAction({ runId: run.runId, period: run.period, paymentStatus: "UNPAID" })}>
                        Mark all as unpaid
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800">
              <Table className="w-full text-[12.5px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#e0f3e8] dark:bg-zinc-900">
                    {["#", "Period", "Name", "Dept", "Branch", "Basic", "Present", "Absent", "Unpaid Lv",
                      "Allowance", "Bonus", "Gross", "Penalty", "Loan", "Deductions", "Net", "Payable",
                      "Status", "Payment"].map((h) => (
                      <TableHead key={h} className="py-2.5 px-2 font-bold text-[#333] dark:text-zinc-300 text-left text-[11px]">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {report.isLoading ? (
                    <TableRow><TableCell colSpan={19} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : report.isError ? (
                    <TableRow><TableCell colSpan={19} className="text-center py-8">
                      <div className="text-[#d9534f] dark:text-red-400 mb-2">Could not load the salary report. You may not have permission to view payroll.</div>
                      <Button size="sm" variant="outline" onClick={() => report.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                    </TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={19} className="text-center text-muted-foreground py-8">No salary records match these filters.</TableCell></TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={r.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800">
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{(page - 1) * pageSize + idx + 1}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{MONTHS[r.period_month - 1]?.slice(0, 3)} {r.period_year}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{r.employee_name || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{r.department || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{r.branch || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.basic_salary)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{r.days_present ?? 0}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{r.days_absent ?? 0}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{r.unpaid_leave_days ?? 0}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.allowance_amount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.bonus_amount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.gross_salary)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.penalty_amount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(r.loan_deduction)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#c0392b]">{fmt(r.total_deductions)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{fmt(r.net_salary)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#00733e] font-bold">{fmt(r.payable_salary)}</TableCell>
                        <TableCell className="py-2 px-2"><StatusBadge status={(r.run_status || "DRAFT").toUpperCase()} /></TableCell>
                        <TableCell className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-sm text-[11px] font-semibold ${(r.payment_status || "").toUpperCase() === "PAID" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}
                              title={(r.payment_status || "").toUpperCase() === "PAID" && r.paid_by_name ? `Paid by ${r.paid_by_name}${r.paid_at ? ` on ${fmtDate(r.paid_at)}` : ""}` : undefined}
                            >
                              {(r.payment_status || "UNPAID").toUpperCase()}
                            </span>
                            {(r.payment_status || "").toUpperCase() === "PAID" && r.paid_by_name && (
                              <span className="text-[10.5px] text-[#777] leading-tight">
                                by {r.paid_by_name}{r.paid_at ? ` · ${fmtDate(r.paid_at)}` : ""}
                              </span>
                            )}
                            {markPaidAllowed && (r.run_status || "").toUpperCase() === "FINALIZED" && (
                              (r.payment_status || "UNPAID").toUpperCase() === "PAID" ? (
                                <Button variant="outline"
                                  className="h-7 px-2 rounded-sm text-[11px] border-slate-200"
                                  disabled={markPaid.isPending}
                                  onClick={() => markPaid.mutate({ id: r.id, paymentStatus: "UNPAID" })}>
                                  Mark unpaid
                                </Button>
                              ) : (
                                <Button
                                  className="h-7 px-2 rounded-sm text-[11px] bg-[#00a65a] hover:bg-[#008d4c] text-white"
                                  disabled={markPaid.isPending}
                                  onClick={() => markPaid.mutate({ id: r.id, paymentStatus: "PAID" })}>
                                  Mark paid
                                </Button>
                              )
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {rows.length > 0 && totals && (
                  <tfoot>
                    <TableRow className="bg-[#f7f7f7] dark:bg-zinc-900 border-t border-slate-300 dark:border-zinc-800 font-bold">
                      <TableCell colSpan={11} className="py-2 px-2 text-right text-[#555] dark:text-zinc-300">Page totals → all-filter totals:</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(totals.totalGross)}</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell className="py-2 px-2 text-[#c0392b]">{fmt(totals.totalDeductions)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(totals.totalNet)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#00733e]">{fmt(totals.totalPayable)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-[13px] text-[#777]">
              <span>Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1} to {(page - 1) * pageSize + rows.length} of {total} entries</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="h-8 px-3 rounded-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                <span>Page {page} / {totalPages}</span>
                <Button variant="outline" className="h-8 px-3 rounded-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingRunAction} onOpenChange={(open) => { if (!open) setPendingRunAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingRunAction?.paymentStatus === "PAID" ? "Mark entire run as paid?" : "Mark entire run as unpaid?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRunAction && (
                runSummary.isLoading ? (
                  <>Checking how many lines this will affect…</>
                ) : runSummary.isError ? (
                  <>Could not load the line count for this run. You can still proceed, but please double-check the run before confirming.</>
                ) : (
                  <>
                    This will set <span className="font-semibold">{affectedCount ?? 0}</span>{" "}
                    {pendingRunAction.paymentStatus === "PAID" ? "unpaid" : "paid"} line(s) in the
                    finalized run for <span className="font-semibold">{pendingRunAction.period}</span> to{" "}
                    <span className="font-semibold">{pendingRunAction.paymentStatus === "PAID" ? "paid" : "unpaid"}</span> at once.
                    This affects the whole payroll run and cannot be undone in one step.
                  </>
                )
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={markRunPaid.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={markRunPaid.isPending || runSummary.isLoading}
              onClick={() => {
                if (!pendingRunAction) return;
                markRunPaid.mutate(
                  { runId: pendingRunAction.runId, paymentStatus: pendingRunAction.paymentStatus },
                  { onSettled: () => setPendingRunAction(null) },
                );
              }}>
              {pendingRunAction?.paymentStatus === "PAID" ? "Mark all as paid" : "Mark all as unpaid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    GENERATED: "bg-blue-50 text-blue-700",
    APPROVED: "bg-amber-50 text-amber-700",
    FINALIZED: "bg-green-50 text-green-700",
    LOCKED: "bg-green-50 text-green-700",
    CANCELLED: "bg-red-50 text-red-600",
  };
  return <span className={`px-2 py-0.5 rounded-sm text-[11px] font-semibold ${map[status] || "bg-slate-100 text-slate-600"}`}>{status}</span>;
}
