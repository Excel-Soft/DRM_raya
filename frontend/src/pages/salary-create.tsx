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
import { AlertTriangle, Pencil } from "lucide-react";
import { SalaryMakeDialog } from "@/components/salary-make-dialog";
import { useToast } from "@/hooks/use-toast";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

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
  // old salary-create.php columns
  legacyUserId?: string | null;
  attId?: string | null;
  gender?: string | null;
  attendanceMonthId?: string;
  month?: number;
  year?: number;
  relaxationMin?: number;
  totalLateMin?: number;
  lateComingWithoutInform?: number;
  paidLeave?: number;
  earnDays?: number;
  absentsRs?: number;
  cuttingMinRs?: number;
  perDayRs?: number;
  totalCutting?: number;
  totalSalary?: number;
  salarySource?: "old" | "new";
  suggested?: { overtimeMinutes: number; overtimeAmount: number; penalty: number; loan: number; reward: number };
  oldSlip?: OldSlip | null;
};

type OldSlip = {
  id: string; createDate: string; grossSalary: number; present: number; leave: number; cuttingMin: number;
  overtimeMin: number; overtimeRs: number; reward: number; penalty: number; loan: number;
  vas: number; commission3: number; alibaba: number; projectCommission: number; pppCommission: number;
  postingCommission: number; cusPaidLeave: number; cusUnpaidLeave: number; pendingLeave: number;
  basicCutting: number; tcutting: number; totalSalary: number; salaryStatus: string;
  name?: string; attId?: string | null; modernUserId?: string | null;
};

type PreviewResponse = {
  period: { month: number; year: number };
  items: PreviewItem[];
  totals: { totalGross: number; totalDeductions: number; totalNet: number; totalPayable: number };
  employeeCount: number;
  finalizedConflicts: string[];
  oldSlips?: { createdMonth: string; rows: OldSlip[]; total: number };
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

  // Old page default: last month.
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(String(lastMonth.getMonth() + 1));
  const [year, setYear] = useState(String(lastMonth.getFullYear()));
  const [genderTab, setGenderTab] = useState<"Male" | "Female">("Male");
  const [includePaid, setIncludePaid] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [branch, setBranch] = useState("all");
  const [department, setDepartment] = useState("all");
  const [employeeId, setEmployeeId] = useState("all");
  const [search, setSearch] = useState("");
  const [showOldSlips, setShowOldSlips] = useState(true);
  const [adjustments, setAdjustments] = useState<Record<string, Partial<Record<ManualKey, string>>>>({});
  // Confirmation dialog for terminal run actions (Finalize / Cancel).
  const [pendingAction, setPendingAction] = useState<{ id: string; status: "FINALIZED" | "CANCELLED"; period: string } | null>(null);
  const [actionReason, setActionReason] = useState("");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string; branch?: string | null; department?: string | null }[] }>({
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
    if (includePaid) p.set("includePaid", "1");
    return p.toString();
  }, [month, year, branch, department, employeeId, includePaid]);

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
  const genderOf = (it: PreviewItem) => (it.gender === "Female" ? "Female" : "Male");
  const branchOptions = useMemo(() => {
    const s = new Set<string>(["Sialkot", "Lahore", "Karachi"]);
    for (const u of employees) if (u.branch) s.add(String(u.branch).trim());
    for (const it of items) if (it.branch) s.add(String(it.branch).trim());
    return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [employees, items]);
  const departmentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const u of employees) if (u.department) s.add(String(u.department).trim());
    for (const it of items) if (it.department) s.add(String(it.department).trim());
    return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [employees, items]);
  const matchesSearch = (it: PreviewItem) =>
    !term
    || it.employeeName.toLowerCase().includes(term)
    || it.userId.toLowerCase().includes(term)
    || String(it.legacyUserId ?? "").toLowerCase().includes(term)
    || String(it.attId ?? "").toLowerCase().includes(term);
  const filteredAll = term ? items.filter(matchesSearch) : items;
  const filtered = filteredAll.filter((it) => genderOf(it) === genderTab);
  const genderCount = (g: "Male" | "Female") => filteredAll.filter((it) => genderOf(it) === g).length;
  const editItem = editUserId ? items.find((it) => it.userId === editUserId) ?? null : null;

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
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="h-9 w-[150px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branchOptions.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-9 w-[170px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All departments</SelectItem>
                    {departmentOptions.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Employee</Label>
                <RoleGroupedUserSelect
                  grouped={false}
                  users={employees}
                  value={employeeId}
                  onChange={setEmployeeId}
                  extraOptions={[{ value: "all", label: "All employees" }]}
                  placeholder="All employees"
                  className="h-9 w-[200px] bg-white dark:bg-zinc-900 border-slate-200 text-[13px] focus:ring-0"
                />
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
              Old Salary Create: worked month {MONTHS[Number(month) - 1]} {year} (attendance month); employees that already
              have a salary slip for it are hidden{includePaid ? " (shown now)" : ""}. Cutting Min = late minutes − relaxation
              (+ late coming without inform). Cutting applies only when leaves &gt; 1: absents = leaves − 2 × net/30, plus
              cutting minutes × net/30/8/60. With 0–1 leaves nothing is cut, as on the old page. The pencil opens the old
              Salary Make form (bonuses, overtime, loan, penalty, holidays); Submit saves that employee's salary.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <input type="checkbox" checked={includePaid} onChange={(e) => setIncludePaid(e.target.checked)} />
              Show employees who already have a slip for this month
            </label>

            {conflicts.length > 0 && (
              <div className="flex items-start gap-2 bg-[#fcf8e3] border border-[#faebcc] text-[#8a6d3b] dark:bg-amber-950 dark:border-amber-900 dark:text-amber-400 rounded-sm px-3 py-2 text-xs">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>These employees already have a <b>finalized</b> salary for this period and will block finalize:&nbsp;
                  {conflicts.join(", ")}.</span>
              </div>
            )}

            <div className="flex justify-end">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, Att ID, User ID..."
                className="w-[260px] h-8 bg-white dark:bg-zinc-900 border-slate-300 rounded-sm text-xs focus-visible:ring-0" />
            </div>

            {/* Old salary-create.php: Male / Female tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-zinc-800">
              {(["Male", "Female"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGenderTab(g)}
                  className={`px-4 py-1.5 text-[12.5px] font-semibold rounded-t-sm ${genderTab === g ? "bg-[#00a65a] text-white" : "text-[#555] dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}>
                  {g} ({genderCount(g)})
                </button>
              ))}
            </div>
            <div className="max-h-[70vh] overflow-auto border border-slate-100 dark:border-zinc-800 mt-2">
              <Table className="w-full text-[12.5px] whitespace-nowrap">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#fdf3db] dark:bg-zinc-900">
                    {["Att ID", "User ID", "Name", "Net Salary", "Paid Leave", "Earn Days", "Absents Days", "Absents RS",
                      "Total Late Min", "Cutting Min", "Cutting Min RS", "Per Day RS", "Total Cutting", "Total Salary",
                      "Month / Year", "Salary", "Adjustments", "Payable", "Old slip"].map((h) => (
                      <TableHead key={h} className="py-2.5 px-2 font-bold text-[#555] dark:text-zinc-300 text-left text-[11px] bg-[#fdf3db] dark:bg-zinc-900">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {preview.isLoading ? (
                    <TableRow><TableCell colSpan={19} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : preview.isError ? (
                    <TableRow><TableCell colSpan={19} className="text-center py-8">
                      <div className="text-[#d9534f] dark:text-red-400 mb-2">Could not load the salary preview.</div>
                      <Button size="sm" variant="outline" onClick={() => preview.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                    </TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={19} className="text-center text-muted-foreground py-8">No employees left to create salary for in this month.</TableCell></TableRow>
                  ) : (
                    filtered.map((item) => {
                      const l = liveRow(item);
                      const adjTotal = l.gross - item.basicSalary - ((l.totalDed) - item.absenceDeduction - item.lateDeduction - item.penaltyAmount - item.unpaidLeaveDeduction);
                      const noCutTip = (item.leaveDays ?? 0) <= 1
                        ? "Old rule: with 0-1 leaves nothing is cut (not even late minutes)."
                        : "Absents (leaves - 2) x net/30 + max(0, cutting min) x net/30/8/60";
                      return (
                        <TableRow key={item.userId} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800">
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{item.attId ?? "-"}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.legacyUserId ?? "-"}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{item.employeeName || "-"}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.basicSalary}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.paidLeave ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">26 - {item.leaveDays}={item.earnDays ?? item.daysPresent}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.daysAbsent}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.absentsRs ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.totalLateMin ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300"
                            title={item.lateComingWithoutInform ? `includes ${item.lateComingWithoutInform} min late coming without inform` : undefined}>
                            {item.totalLateMin ?? 0} - {item.relaxationMin ?? 0} = {item.lateMinutes}
                          </TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300" title={noCutTip}>{item.cuttingMinRs ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.perDayRs ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#c0392b] dark:text-red-400" title={noCutTip}>{item.totalCutting ?? 0}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300 font-semibold">{item.totalSalary ?? Math.round(item.netSalary)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{item.month ?? month} / {item.year ?? year}</TableCell>
                          <TableCell className="py-2 px-2">
                            <button type="button" className="text-[#3c8dbc] hover:text-[#367fa9]" title="Salary Make (old per-employee salary form)"
                              onClick={() => setEditUserId(item.userId)} disabled={!flags.canGenerate}>
                              <Pencil className="h-4 w-4" />
                            </button>
                          </TableCell>
                          <TableCell className={`py-2 px-2 ${adjTotal === 0 ? "text-slate-400" : adjTotal > 0 ? "text-[#00733e]" : "text-[#c0392b]"}`}>
                            {adjTotal === 0 ? "-" : fmt(adjTotal)}
                          </TableCell>
                          <TableCell className="py-2 px-2 text-[#00733e] dark:text-green-400 font-bold">{fmt(l.payable)}</TableCell>
                          <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300"
                            title={item.oldSlip ? `Old slip #${item.oldSlip.id} saved ${item.oldSlip.createDate}` : "No old slip for this month"}>
                            {item.oldSlip ? Math.round(item.oldSlip.totalSalary) : "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
                {filtered.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-[#f7f7f7] dark:bg-zinc-900 border-t border-slate-300 dark:border-zinc-700 font-bold">
                      <TableCell colSpan={12} className="py-2 px-2 text-right text-[#555] dark:text-zinc-300">Totals ({filtered.length})</TableCell>
                      <TableCell className="py-2 px-2 text-[#c0392b]">{filtered.reduce((a, it) => a + (it.totalCutting ?? 0), 0)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">{filtered.reduce((a, it) => a + (it.totalSalary ?? 0), 0)}</TableCell>
                      <TableCell colSpan={3} />
                      <TableCell className="py-2 px-2 text-[#00733e] dark:text-green-400">{fmt(liveTotals.payable)}</TableCell>
                      <TableCell className="py-2 px-2 text-[#555] dark:text-zinc-300">
                        {Math.round(filtered.reduce((a, it) => a + (it.oldSlip?.totalSalary ?? 0), 0))}
                      </TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>

            {/* Old DRM slips saved for this worked month (legacy webxl_tem_salary_ship). */}
            {preview.data?.oldSlips && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-[#555] dark:text-zinc-300">
                    Old DRM slips for {MONTHS[Number(month) - 1]} {year}
                    <span className="font-normal text-slate-500"> (saved in {preview.data.oldSlips.createdMonth}) — {preview.data.oldSlips.rows.length} slips, total {fmt(preview.data.oldSlips.total)}</span>
                  </h3>
                  {preview.data.oldSlips.rows.length > 0 && (
                    <Button variant="outline" className="h-7 px-3 text-xs" onClick={() => setShowOldSlips((v) => !v)}>
                      {showOldSlips ? "Hide" : "Show"}
                    </Button>
                  )}
                </div>
                {preview.data.oldSlips.rows.length === 0 ? (
                  <p className="text-xs text-slate-500">The old DRM saved no slips for this month.</p>
                ) : showOldSlips && (
                  <div className="max-h-[60vh] overflow-auto border border-slate-100 dark:border-zinc-800">
                    <table className="w-full text-[12px] whitespace-nowrap">
                      <thead className="sticky top-0 bg-[#e0f3e8] dark:bg-zinc-800">
                        <tr>
                          {["#", "Att ID", "Name", "Gross Salary", "Present", "Leave", "CuttingMin", "OT Min", "OT RS", "VAS",
                            "3 % Bonus", "AB Bonus", "Project Bonus", "PPP Bonus", "PP Bonus", "Reward", "Penalty", "Loan",
                            "Paid Leave", "Unpaid Leave", "Basic Cutting", "Total Cutting", "Total Salary", "Status"].map((h) => (
                            <th key={h} className="py-2 px-2 text-left font-bold text-[#333] dark:text-zinc-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-zinc-900">
                        {preview.data.oldSlips.rows
                          .filter((r) => !term || [r.name, r.attId, r.id].some((v) => String(v ?? "").toLowerCase().includes(term)))
                          .map((r) => (
                          <tr key={r.id} className="border-b border-slate-100 dark:border-zinc-800">
                            {[r.id, r.attId ?? "", r.name ?? "", r.grossSalary, r.present, r.leave, r.cuttingMin, r.overtimeMin, r.overtimeRs,
                              r.vas, r.commission3, r.alibaba, r.projectCommission, r.pppCommission, r.postingCommission, r.reward,
                              r.penalty, r.loan, r.cusUnpaidLeave, r.cusPaidLeave, r.basicCutting, r.tcutting,
                              Math.round(r.totalSalary), r.salaryStatus || "-"].map((v, i) => (
                              <td key={i} className="py-1.5 px-2 text-[#555] dark:text-zinc-300">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Pencil: the old SALARY MAKE page (salary-make=<attendance_month id>-<user_id>). */}
        <SalaryMakeDialog
          open={!!editUserId}
          onClose={() => setEditUserId(null)}
          userId={editUserId}
          month={editItem?.month ?? Number(month)}
          year={editItem?.year ?? Number(year)}
          canSubmit={flags.canGenerate}
        />

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
