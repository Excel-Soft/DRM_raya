import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeRole, isManagerialRole } from "@/lib/role-utils";

// Mirrors the backend SALARY_MGMT_ROLES + isManagerialRole allow-list. Used only
// to gate UI affordances; the server is always the source of truth (403s anyway).
const SALARY_MGMT_ROLES = new Set([
  "admin", "super_admin", "administrator", "super_hod", "hod",
  "account_manager", "accountant", "hr", "hr_manager",
]);
function canManageSalary(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return SALARY_MGMT_ROLES.has(r) || isManagerialRole(role);
}

type SalaryItem = {
  id?: string;
  runId?: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  basicSalary: number;
  perDaySalary: number;
  grossSalary: number;
  daysPresent: number;
  daysAbsent: number;
  daysAbsentDeducted?: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  overtimeMinutes: number;
  overtimeAmount: number;
  absenceDeduction: number;
  unpaidLeaveDeduction?: number;
  penaltyAmount: number;
  loanDeduction: number;
  bonusAmount: number;
  allowanceAmount: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
  paymentStatus?: string;
};

type PreviewResponse = {
  period: { month: number; year: number };
  items: SalaryItem[];
  totals: { totalGross: number; totalDeductions: number; totalNet: number };
  employeeCount: number;
  missingData: { employeeId: string; employeeName: string; reason: string }[];
};

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const now = new Date();

// apiRequestJson throws Error("<status>: <body>"). Parse it back so we can react
// to specific server responses (409 duplicate-finalized conflicts, etc.).
function parseApiError(err: any): { status: number; body: any } {
  const msg = String(err?.message ?? "");
  const m = msg.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) return { status: 0, body: { error: msg } };
  let body: any = m[2];
  try { body = JSON.parse(m[2]); } catch { /* keep raw text */ }
  return { status: Number(m[1]), body };
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  GENERATED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-amber-100 text-amber-800",
  FINALIZED: "bg-emerald-100 text-emerald-700",
  LOCKED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};
function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_STYLES[s] || "bg-slate-100 text-slate-700"}`}>
      {s}
    </span>
  );
}

const money = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function SalaryCreate() {
  const { toast } = useToast();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [viewItem, setViewItem] = useState<SalaryItem | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { bonusAmount: string; allowanceAmount: string }>>({});
  const [finalizeConflicts, setFinalizeConflicts] = useState<{ employeeId: string; employeeName: string }[] | null>(null);

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const me = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
  });
  const roleStr: string =
    me.data?.role ?? me.data?.roleName ?? me.data?.roleId ?? (typeof window !== "undefined" ? sessionStorage.getItem("userRole") : "") ?? "";
  const canManage = canManageSalary(roleStr);

  // Existing runs for this period — used to re-attach to a saved draft on refresh.
  const runsForPeriod = useQuery<{ runs: SalaryRun[] }>({
    queryKey: ["/api/salary/runs", "period", month, year],
    enabled: canManage,
    queryFn: () => apiRequestJson("GET", `/api/salary/runs?month=${month}&year=${year}`),
  });

  // When the period/scope changes, attach to a matching saved run (if any) so a
  // draft persists across refresh; otherwise drop back to live-preview mode.
  useEffect(() => {
    const runs = runsForPeriod.data?.runs ?? [];
    const match = runs.find(
      (r) => (r.branch ?? "") === branch.trim() && (r.department ?? "") === department.trim(),
    );
    setActiveRunId(match ? match.id : null);
    setFinalizeConflicts(null);
  }, [runsForPeriod.data, branch, department, month, year]);

  const preview = useQuery<PreviewResponse>({
    queryKey: ["/api/salary/preview", month, year, branch, department],
    enabled: canManage && !activeRunId,
    queryFn: () => {
      const qs = new URLSearchParams({ month, year });
      if (branch.trim()) qs.set("branch", branch.trim());
      if (department.trim()) qs.set("department", department.trim());
      return apiRequestJson<PreviewResponse>("GET", `/api/salary/preview?${qs.toString()}`);
    },
  });

  const runDetail = useQuery<{ run: SalaryRun; items: SalaryItem[] }>({
    queryKey: ["/api/salary/runs", activeRunId],
    enabled: !!activeRunId,
    queryFn: () => apiRequestJson("GET", `/api/salary/runs/${activeRunId}`),
  });

  // Seed editable inputs whenever the run's items load/refresh.
  useEffect(() => {
    const items = runDetail.data?.items;
    if (!items) return;
    const next: Record<string, { bonusAmount: string; allowanceAmount: string }> = {};
    for (const it of items) {
      if (it.id) next[it.id] = { bonusAmount: String(it.bonusAmount ?? 0), allowanceAmount: String(it.allowanceAmount ?? 0) };
    }
    setEdits(next);
  }, [runDetail.data]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/salary/preview"] });
  };

  const createRun = useMutation({
    mutationFn: (status: "DRAFT" | "GENERATED") =>
      apiRequestJson<{ run: SalaryRun }>("POST", "/api/salary/runs", {
        month: Number(month),
        year: Number(year),
        branch: branch.trim() || undefined,
        department: department.trim() || undefined,
        status,
      }),
    onSuccess: (data, status) => {
      setActiveRunId(data.run.id);
      invalidateAll();
      toast({ title: status === "GENERATED" ? "Salary run generated" : "Draft saved", description: `${MONTHS[Number(month) - 1]} ${year}.` });
    },
    onError: (err: any) => {
      const { status, body } = parseApiError(err);
      if (status === 409 && body?.existingRunId) {
        setActiveRunId(body.existingRunId);
        toast({ title: "Run already exists", description: "Opened the existing run for this period and scope.", variant: "destructive" });
        return;
      }
      toast({ title: "Unable to save", description: body?.error || "Could not create the salary run.", variant: "destructive" });
    },
  });

  const saveItem = useMutation({
    mutationFn: ({ id, bonusAmount, allowanceAmount }: { id: string; bonusAmount: number; allowanceAmount: number }) =>
      apiRequestJson("PATCH", `/api/salary/run-items/${id}`, { bonusAmount, allowanceAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs", activeRunId] });
      toast({ title: "Line updated" });
    },
    onError: (err: any) => {
      const { body } = parseApiError(err);
      toast({ title: "Could not update line", description: body?.error || "Edit failed.", variant: "destructive" });
    },
  });

  const changeStatus = useMutation({
    mutationFn: (status: string) => apiRequestJson("PATCH", `/api/salary/runs/${activeRunId}/status`, { status }),
    onSuccess: (_d, status) => {
      setFinalizeConflicts(null);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs", activeRunId] });
      toast({ title: `Run ${status.toLowerCase()}` });
    },
    onError: (err: any) => {
      const { status, body } = parseApiError(err);
      if (status === 409 && Array.isArray(body?.conflicts)) {
        setFinalizeConflicts(body.conflicts);
        toast({ title: "Finalize blocked", description: "Some employees already have a finalized salary for this period.", variant: "destructive" });
        return;
      }
      toast({ title: "Action failed", description: body?.error || "Could not change the run status.", variant: "destructive" });
    },
  });

  const run = runDetail.data?.run;
  const runStatus = (run?.status || "").toUpperCase();
  const editable = runStatus === "DRAFT" || runStatus === "GENERATED";
  const items = activeRunId ? runDetail.data?.items ?? [] : preview.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter((it) => it.employeeName.toLowerCase().includes(term) || it.employeeId.toLowerCase().includes(term))
    : items;

  const totals = useMemo(() => {
    if (activeRunId && run) {
      return {
        totalGross: Number(run.total_gross) || 0,
        totalDeductions: Number(run.total_deductions) || 0,
        totalNet: Number(run.total_net) || 0,
      };
    }
    return preview.data?.totals ?? { totalGross: 0, totalDeductions: 0, totalNet: 0 };
  }, [activeRunId, run, preview.data]);

  const missingData = preview.data?.missingData ?? [];
  const isLoading = activeRunId ? runDetail.isLoading : preview.isLoading;
  const isError = activeRunId ? runDetail.isError : preview.isError;

  if (me.isSuccess && !canManage) {
    return (
      <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen p-8">
        <Card className="border-none shadow-sm bg-white rounded-sm max-w-xl mx-auto">
          <CardContent className="p-8 text-center text-[#555]">
            <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-500" />
            <p className="font-semibold">You do not have access to payroll creation.</p>
            <p className="text-sm text-slate-500 mt-1">Salary creation is restricted to management, HR, and accounts roles.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[17px] font-bold uppercase text-[#555]">Salary Create</h1>
          {activeRunId && run && <StatusBadge status={run.status} />}
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 w-[150px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 w-[110px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Branch (optional)</Label>
                <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="All branches"
                  className="h-9 w-[160px] bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Department (optional)</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="All departments"
                  className="h-9 w-[160px] bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {!activeRunId ? (
                <>
                  <Button onClick={() => createRun.mutate("DRAFT")}
                    disabled={createRun.isPending || preview.isLoading || items.length === 0}
                    className="bg-[#3c8dbc] hover:bg-[#367fa9] text-white px-5 font-semibold h-9 rounded-sm">
                    {createRun.isPending ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button onClick={() => createRun.mutate("GENERATED")}
                    disabled={createRun.isPending || preview.isLoading || items.length === 0}
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">
                    Save & Generate
                  </Button>
                  <span className="text-xs text-slate-500">Preview is computed live and not yet saved.</span>
                </>
              ) : (
                <>
                  {runStatus === "DRAFT" && (
                    <Button onClick={() => changeStatus.mutate("GENERATED")} disabled={changeStatus.isPending}
                      className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">Generate</Button>
                  )}
                  {runStatus === "GENERATED" && (
                    <>
                      <Button onClick={() => changeStatus.mutate("APPROVED")} disabled={changeStatus.isPending}
                        className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">Approve</Button>
                      <Button onClick={() => changeStatus.mutate("DRAFT")} disabled={changeStatus.isPending}
                        variant="outline" className="h-9 rounded-sm">Back to Draft</Button>
                    </>
                  )}
                  {runStatus === "APPROVED" && (
                    <>
                      <Button onClick={() => changeStatus.mutate("FINALIZED")} disabled={changeStatus.isPending}
                        className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">Finalize</Button>
                      <Button onClick={() => changeStatus.mutate("GENERATED")} disabled={changeStatus.isPending}
                        variant="outline" className="h-9 rounded-sm">Back to Generated</Button>
                    </>
                  )}
                  {(runStatus === "DRAFT" || runStatus === "GENERATED" || runStatus === "APPROVED") && (
                    <Button onClick={() => changeStatus.mutate("CANCELLED")} disabled={changeStatus.isPending}
                      variant="outline" className="h-9 rounded-sm text-red-600 border-red-200 hover:bg-red-50">Cancel Run</Button>
                  )}
                  {(runStatus === "FINALIZED" || runStatus === "LOCKED") && (
                    <span className="text-xs text-emerald-700 font-semibold">This run is finalized and locked.</span>
                  )}
                </>
              )}
            </div>

            {finalizeConflicts && finalizeConflicts.length > 0 && (
              <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Cannot finalize — already finalized for this period:</div>
                <ul className="list-disc ml-6 mt-1">{finalizeConflicts.map((c) => <li key={c.employeeId}>{c.employeeName}</li>)}</ul>
              </div>
            )}

            {!activeRunId && missingData.length > 0 && (
              <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {missingData.length} employee(s) have no basic salary set — they will compute as 0:</div>
                <div className="ml-6 mt-1">{missingData.map((m) => m.employeeName).join(", ")}</div>
              </div>
            )}

            {/* Search */}
            <div className="flex justify-end">
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs font-semibold text-slate-500">Search:</span>
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400" />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 mt-2">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                    {["Name", "Basic", "Per Day", "Present", "Absent", "Unpaid Lv", "Absence RS", "Penalty", "Bonus", "Allowance", "Deductions", "Payable", "View"].map((h, i) => (
                      <TableHead key={h} className={`py-2.5 px-3 font-bold text-[#555] text-xs ${i >= 1 && i <= 11 ? "text-right" : i === 12 ? "text-center" : "text-left"}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {isLoading ? (
                    <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : isError ? (
                    <TableRow><TableCell colSpan={13} className="text-center text-[#d9534f] py-8">Could not load salary data. You may not have permission to view payroll.</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No employees found for the selected period and scope.</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => {
                      const ed = item.id ? edits[item.id] : undefined;
                      const dirty = !!(item.id && ed && (Number(ed.bonusAmount) !== item.bonusAmount || Number(ed.allowanceAmount) !== item.allowanceAmount));
                      return (
                        <TableRow key={item.id ?? item.employeeId} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                          <TableCell className="py-2 px-3 text-[#555] font-semibold">{item.employeeName || "-"}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{money(item.basicSalary)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{money(item.perDaySalary)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{item.daysPresent}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{item.daysAbsent}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{item.unpaidLeaveDays}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{money(item.absenceDeduction)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{money(item.penaltyAmount)}</TableCell>
                          {/* Bonus */}
                          <TableCell className="py-2 px-3 text-right">
                            {activeRunId && editable && item.id ? (
                              <Input type="number" min="0" value={ed?.bonusAmount ?? ""}
                                onChange={(e) => setEdits((p) => ({ ...p, [item.id!]: { bonusAmount: e.target.value, allowanceAmount: p[item.id!]?.allowanceAmount ?? String(item.allowanceAmount) } }))}
                                className="h-8 w-[90px] ml-auto text-right border-slate-200 rounded-sm text-[12px] focus-visible:ring-0" />
                            ) : money(item.bonusAmount)}
                          </TableCell>
                          {/* Allowance */}
                          <TableCell className="py-2 px-3 text-right">
                            {activeRunId && editable && item.id ? (
                              <Input type="number" min="0" value={ed?.allowanceAmount ?? ""}
                                onChange={(e) => setEdits((p) => ({ ...p, [item.id!]: { allowanceAmount: e.target.value, bonusAmount: p[item.id!]?.bonusAmount ?? String(item.bonusAmount) } }))}
                                className="h-8 w-[90px] ml-auto text-right border-slate-200 rounded-sm text-[12px] focus-visible:ring-0" />
                            ) : money(item.allowanceAmount)}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right">{money(item.totalDeductions)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] text-right font-semibold">{money(item.payableSalary)}</TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {activeRunId && editable && item.id && (
                                <Button size="sm" disabled={!dirty || saveItem.isPending}
                                  onClick={() => {
                                    const b = Number(ed?.bonusAmount); const a = Number(ed?.allowanceAmount);
                                    if (!Number.isFinite(b) || b < 0 || !Number.isFinite(a) || a < 0) {
                                      toast({ title: "Invalid value", description: "Bonus and allowance must be numbers ≥ 0.", variant: "destructive" });
                                      return;
                                    }
                                    saveItem.mutate({ id: item.id!, bonusAmount: b, allowanceAmount: a });
                                  }}
                                  className="h-7 px-2 bg-[#00a65a] hover:bg-[#008d4c] text-white text-[11px] rounded-sm">Save</Button>
                              )}
                              <button onClick={() => setViewItem(item)} className="text-[#00a65a] hover:text-[#008d4c] bg-transparent border-none cursor-pointer"><Eye className="h-4 w-4" /></button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex flex-wrap gap-6 justify-end text-[13px] text-[#555] pt-2">
              <span>Employees: <b>{filtered.length}</b></span>
              <span>Total Gross: <b>{money(totals.totalGross)}</b></span>
              <span>Total Deductions: <b>{money(totals.totalDeductions)}</b></span>
              <span>Total Payable: <b className="text-[#00a65a]">{money(totals.totalNet)}</b></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-[560px] w-[95vw]">
          <DialogHeader><DialogTitle>Salary Detail — {viewItem?.employeeName}</DialogTitle></DialogHeader>
          {viewItem && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] text-[#555]">
              {[
                ["Department", viewItem.department || "-"],
                ["Branch", viewItem.branch || "-"],
                ["Basic Salary", money(viewItem.basicSalary)],
                ["Per Day", money(viewItem.perDaySalary)],
                ["Days Present", viewItem.daysPresent],
                ["Days Absent", viewItem.daysAbsent],
                ["Unpaid Leave Days", viewItem.unpaidLeaveDays],
                ["Overtime Minutes", viewItem.overtimeMinutes],
                ["Absence Deduction", money(viewItem.absenceDeduction)],
                ["Penalty", money(viewItem.penaltyAmount)],
                ["Loan", money(viewItem.loanDeduction)],
                ["Bonus", money(viewItem.bonusAmount)],
                ["Allowance", money(viewItem.allowanceAmount)],
                ["Other Deductions", money(viewItem.otherDeductions)],
                ["Total Deductions", money(viewItem.totalDeductions)],
                ["Gross", money(viewItem.grossSalary)],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">{k}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between col-span-2 pt-1"><span className="font-bold">Payable Salary</span><span className="font-bold text-[#00a65a]">{money(viewItem.payableSalary)}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
