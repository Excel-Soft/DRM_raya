import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types mirror the server preview/run shapes.
// ---------------------------------------------------------------------------
type PreviewItem = {
  userId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  basicSalary: number;
  perDaySalary: number;
  daysPresent: number;
  daysAbsent: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  overtimeMinutes: number;
  allowanceAmount: number;
  bonusAmount: number;
  overtimeAmount: number;
  grossSalary: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  penaltyAmount: number;
  loanDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
};

type PreviewResponse = {
  period: { month: number; year: number };
  items: PreviewItem[];
  totals: { totalGross: number; totalDeductions: number; totalNet: number; totalPayable: number };
  employeeCount: number;
  finalizedConflicts: string[];
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

// Manual adjustment fields editable per employee.
type ManualKey = "allowanceAmount" | "bonusAmount" | "overtimeAmount" | "loanDeduction" | "otherDeductions";
const MANUAL_KEYS: ManualKey[] = ["allowanceAmount", "bonusAmount", "overtimeAmount", "loanDeduction", "otherDeductions"];

// UI-only role gating (server enforces the real per-action rules).
function roleFlags() {
  const r = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
  const full = r.includes("super_admin") || r.includes("administrator") || r === "admin" || r.includes("super_hod");
  const accounts = r.includes("account");
  const hr = /\bhr\b/.test(r) || r.includes("hr_") || r === "hr" || r.includes("human_resource");
  const hod = r === "hod" || (r.includes("hod") && !r.includes("super_hod"));
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

export default function SalaryCreate() {
  const { toast } = useToast();
  const flags = useMemo(roleFlags, []);

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branch, setBranch] = useState("all");
  const [department, setDepartment] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [search, setSearch] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, Partial<Record<ManualKey, string>>>>({});
  // Confirmation dialog for terminal run actions (Finalize / Cancel).
  const [pendingAction, setPendingAction] = useState<{ id: string; status: "FINALIZED" | "CANCELLED"; period: string } | null>(null);
  const [actionReason, setActionReason] = useState("");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-create"],
    queryFn: async () => apiRequestJson("GET", "/api/users"),
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
    queryFn: async () => apiRequestJson<PreviewResponse>("GET", `/api/salary/preview?${qs}`),
    enabled: flags.canGenerate,
  });

  const runsQuery = useQuery<{ runs: SalaryRun[] }>({
    queryKey: ["/api/salary/runs", "create-panel"],
    queryFn: async () => apiRequestJson("GET", "/api/salary/runs?pageSize=20"),
  });

  // Build the manualAdjustments payload (only rows with at least one value).
  function buildAdjustments() {
    const out: Record<string, Record<string, number>> = {};
    for (const [uid, fields] of Object.entries(adjustments)) {
      const entry: Record<string, number> = {};
      let any = false;
      for (const k of MANUAL_KEYS) {
        const raw = fields[k];
        if (raw !== undefined && raw !== "") { entry[k] = Number(raw) || 0; any = true; }
      }
      if (any) out[uid] = entry;
    }
    return out;
  }

  const saveRun = useMutation({
    mutationFn: async (mode: "DRAFT" | "GENERATED") =>
      apiRequestJson("POST", "/api/salary/runs", {
        month: Number(month), year: Number(year),
        branch: branch === "all" ? null : branch,
        department: department === "all" ? null : department,
        employeeId: employeeId === "all" ? undefined : employeeId,
        mode,
        manualAdjustments: buildAdjustments(),
      }),
    onSuccess: (_data, mode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({
        title: mode === "GENERATED" ? "Salary run generated" : "Draft saved",
        description: `${MONTHS[Number(month) - 1]} ${year}.`,
      });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      const m = /409/.test(msg) || /finalized salary already exists/i.test(msg)
        ? "A finalized salary already exists for some of these employees in this period."
        : /403/.test(msg) ? "You are not authorized to generate salary."
        : "Could not save the salary run.";
      toast({ title: "Unable to save salary run", description: m, variant: "destructive" });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: string; reason?: string }) =>
      apiRequestJson("PATCH", `/api/salary/runs/${vars.id}/status`, {
        status: vars.status,
        ...(vars.reason && vars.reason.trim() ? { reason: vars.reason.trim() } : {}),
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({ title: `Run ${vars.status.toLowerCase()}`, description: "Status updated." });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      const m = /409/.test(msg) && /finalized salary already exists/i.test(msg)
        ? "A finalized salary already exists for some employees in this period."
        : /409/.test(msg) ? "This transition is not allowed for the run's current status."
        : /403/.test(msg) ? "You are not authorized for this action."
        : "Could not update the run.";
      toast({ title: "Action failed", description: m, variant: "destructive" });
    },
  });

  // Live per-row recompute from manual edits.
  function liveRow(item: PreviewItem) {
    const adj = adjustments[item.userId] || {};
    const num = (k: ManualKey, fallback: number) =>
      adj[k] !== undefined && adj[k] !== "" ? Number(adj[k]) || 0 : fallback;
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
  const filtered = term
    ? items.filter((it) => it.employeeName.toLowerCase().includes(term) || it.userId.toLowerCase().includes(term))
    : items;

  const liveTotals = filtered.reduce(
    (a, it) => { const l = liveRow(it); a.gross += l.gross; a.ded += l.totalDed; a.net += l.net; a.payable += l.payable; return a; },
    { gross: 0, ded: 0, net: 0, payable: 0 },
  );

  const conflicts = preview.data?.finalizedConflicts ?? [];
  const runs = runsQuery.data?.runs ?? [];

  function manualInput(item: PreviewItem, key: ManualKey) {
    const adj = adjustments[item.userId] || {};
    const fallback = (item as any)[key] as number;
    return (
      <Input
        type="number" min="0" step="0.01"
        value={adj[key] ?? (fallback ? String(fallback) : "")}
        placeholder="0"
        disabled={!flags.canEdit}
        onChange={(e) =>
          setAdjustments((prev) => ({ ...prev, [item.userId]: { ...prev[item.userId], [key]: e.target.value } }))
        }
        className="h-7 w-[84px] text-[12px] px-1.5 border-slate-300 rounded-sm focus-visible:ring-0"
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen">
      <div className="p-4 max-w-[1700px] mx-auto space-y-6">
        <h1 className="text-[17px] font-bold uppercase text-[#555] dark:text-zinc-300">SALARY CREATE</h1>

        {!flags.canGenerate ? (
          <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
            <CardContent className="p-8 text-center text-[#d9534f] dark:text-red-400 text-sm">
              You are not authorized to create or preview salary runs.
            </CardContent>
          </Card>
        ) : (
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 w-[150px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 w-[110px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Branch</Label>
                <Input value={branch === "all" ? "" : branch} placeholder="All branches"
                  onChange={(e) => setBranch(e.target.value || "all")}
                  className="h-9 w-[150px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Department</Label>
                <Input value={department === "all" ? "" : department} placeholder="All departments"
                  onChange={(e) => setDepartment(e.target.value || "all")}
                  className="h-9 w-[170px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="h-9 w-[200px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"><SelectValue placeholder="All employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All employees</SelectItem>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName || e.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => saveRun.mutate("DRAFT")}
                disabled={saveRun.isPending || preview.isLoading || items.length === 0}
                className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-4 font-semibold h-9 rounded-sm">
                {saveRun.isPending ? "Saving..." : "Save as Draft"}
              </Button>
              <Button onClick={() => saveRun.mutate("GENERATED")}
                disabled={saveRun.isPending || preview.isLoading || items.length === 0}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">
                {saveRun.isPending ? "Saving..." : "Generate Run"}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Preview from live HR data. Gross = basic + allowance + bonus + overtime.
              Deductions = unpaid-leave + absence + penalties + loan + other. Net = gross − deductions
              (payable is never below 0). Allowance, bonus, overtime, loan and other are manual.
            </p>

            {conflicts.length > 0 && (
              <div className="flex items-start gap-2 bg-[#fcf8e3] border border-[#faebcc] text-[#8a6d3b] dark:bg-amber-950 dark:border-amber-900 dark:text-amber-400 rounded-sm px-3 py-2 text-xs">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>These employees already have a <b>finalized</b> salary for this period and will block finalize:&nbsp;
                  {conflicts.join(", ")}.</span>
              </div>
            )}

            <div className="flex justify-end">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name..."
                className="w-[220px] h-8 bg-white dark:bg-zinc-900 border-slate-300 rounded-sm text-xs focus-visible:ring-0" />
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 mt-2">
              <Table className="w-full text-[12.5px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#fdf3db] dark:bg-zinc-900">
                    {["Name", "Dept", "Basic", "Present", "Absent", "Unpaid Lv", "OT Min",
                      "Allowance", "Bonus", "OT Amt", "Loan", "Other", "Penalty",
                      "Gross", "Deductions", "Net", "Payable"].map((h) => (
                      <TableHead key={h} className="py-2.5 px-2 font-bold text-[#555] dark:text-zinc-300 text-left text-[11px]">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {preview.isLoading ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : preview.isError ? (
                    <TableRow><TableCell colSpan={17} className="text-center py-8">
                      <div className="text-[#d9534f] dark:text-red-400 mb-2">Could not load the salary preview.</div>
                      <Button size="sm" variant="outline" onClick={() => preview.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                    </TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">No employees found for the selected period/scope.</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => {
                      const l = liveRow(item);
                      return (
                        <TableRow key={item.userId} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800">
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{item.employeeName || "-"}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.department || "-"}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(item.basicSalary)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.daysPresent}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.daysAbsent}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.unpaidLeaveDays}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.overtimeMinutes}</TableCell>
                          <TableCell className="py-2 px-2">{manualInput(item, "allowanceAmount")}</TableCell>
                          <TableCell className="py-2 px-2">{manualInput(item, "bonusAmount")}</TableCell>
                          <TableCell className="py-2 px-2">{manualInput(item, "overtimeAmount")}</TableCell>
                          <TableCell className="py-2 px-2">{manualInput(item, "loanDeduction")}</TableCell>
                          <TableCell className="py-2 px-2">{manualInput(item, "otherDeductions")}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(item.penaltyAmount)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(l.gross)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#c0392b] dark:text-red-400">{fmt(l.totalDed)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{fmt(l.net)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#00733e] dark:text-green-400 font-bold">{fmt(l.payable)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {filtered.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-[#f7f7f7] dark:bg-zinc-900 border-t border-slate-300 dark:border-zinc-700 font-bold">
                      <TableCell colSpan={13} className="py-2 px-2 text-right text-[#555] dark:text-zinc-300">Totals ({filtered.length})</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(liveTotals.gross)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#c0392b] dark:text-red-400">{fmt(liveTotals.ded)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{fmt(liveTotals.net)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#00733e] dark:text-green-400">{fmt(liveTotals.payable)}</TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Recent runs + lifecycle actions */}
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-[14px] font-bold uppercase text-[#555] dark:text-zinc-300">Recent Salary Runs</h2>
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#e0f3e8] dark:bg-zinc-900">
                    {["Period", "Branch", "Dept", "Employees", "Gross", "Deductions", "Net", "Status", "Actions"].map((h) => (
                      <TableHead key={h} className="py-2.5 px-2 font-bold text-[#333] dark:text-zinc-300 text-left text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {runsQuery.isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : runsQuery.isError ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-8">
                      <div className="text-[#d9534f] dark:text-red-400 mb-2">Could not load salary runs.</div>
                      <Button size="sm" variant="outline" onClick={() => runsQuery.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                    </TableCell></TableRow>
                  ) : runs.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No salary runs yet.</TableCell></TableRow>
                  ) : (
                    runs.map((r) => {
                      const status = (r.status || "DRAFT").toUpperCase();
                      const locked = status === "FINALIZED" || status === "LOCKED" || status === "CANCELLED";
                      return (
                        <TableRow key={r.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800">
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300 font-semibold">{MONTHS[r.period_month - 1]} {r.period_year}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300">{r.branch || "-"}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300">{r.department || "-"}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300">{r.employee_count}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300">{fmt(Number(r.total_gross || 0))}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#c0392b] dark:text-red-400">{fmt(Number(r.total_deductions || 0))}</TableCell>
                          <TableCell className="py-2.5 px-2 text-[#555] dark:text-zinc-300">{fmt(Number(r.total_net || 0))}</TableCell>
                          <TableCell className="py-2.5 px-2"><StatusBadge status={status} /></TableCell>
                          <TableCell className="py-2.5 px-2">
                            <div className="flex gap-1.5">
                              {status === "DRAFT" && flags.canGenerate && (
                                <ActionBtn label="Generate" color="#00a65a" onClick={() => setStatus.mutate({ id: r.id, status: "GENERATED" })} disabled={setStatus.isPending} />
                              )}
                              {status === "GENERATED" && flags.canApprove && (
                                <ActionBtn label="Approve" color="#3c8dbc" onClick={() => setStatus.mutate({ id: r.id, status: "APPROVED" })} disabled={setStatus.isPending} />
                              )}
                              {status === "APPROVED" && flags.canFinalize && (
                                <ActionBtn label="Finalize" color="#00a65a" onClick={() => { setActionReason(""); setPendingAction({ id: r.id, status: "FINALIZED", period: `${MONTHS[r.period_month - 1]} ${r.period_year}` }); }} disabled={setStatus.isPending} />
                              )}
                              {!locked && flags.canCancel && (
                                <ActionBtn label="Cancel" color="#d9534f" onClick={() => { setActionReason(""); setPendingAction({ id: r.id, status: "CANCELLED", period: `${MONTHS[r.period_month - 1]} ${r.period_year}` }); }} disabled={setStatus.isPending} />
                              )}
                              {locked && <span className="text-[11px] text-slate-400">—</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => { if (!open) { setPendingAction(null); setActionReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.status === "FINALIZED" ? "Finalize this salary run?" : "Cancel this salary run?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.status === "FINALIZED" ? (
                <>Finalizing locks the run for <span className="font-semibold">{pendingAction?.period}</span>. A finalized run cannot be edited or re-generated.</>
              ) : (
                <>Cancelling the run for <span className="font-semibold">{pendingAction?.period}</span> is permanent and cannot be undone.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Reason (optional)</Label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={3}
              placeholder="Add a note for the audit log…"
              className="w-full rounded-sm border border-slate-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setStatus.isPending}>Back</AlertDialogCancel>
            <AlertDialogAction
              disabled={setStatus.isPending}
              onClick={() => {
                if (!pendingAction) return;
                setStatus.mutate(
                  { id: pendingAction.id, status: pendingAction.status, reason: actionReason },
                  { onSettled: () => { setPendingAction(null); setActionReason(""); } },
                );
              }}>
              {pendingAction?.status === "FINALIZED" ? "Finalize run" : "Cancel run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function ActionBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="text-[11px] font-semibold px-2 py-1 rounded-sm text-white disabled:opacity-50"
      style={{ backgroundColor: color }}>
      {label}
    </button>
  );
}
