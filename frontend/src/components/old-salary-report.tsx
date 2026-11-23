// Old DRM "Salary Report" (salaryreport.php) on the copied old salary slips.
// Tabs = the old page's tabs for one month (old: the current month by slip
// create_date), plus the old "View Report", "View Month Wise" and "Print Slip".
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { exportToCSV, exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

type Slip = {
  id: string; userId: string; attId: string; name: string; gender: string; branch: string;
  grossSalary: string; present: string; leave: string; leavesRsLabel: string; cuttingMin: string;
  cuttingMinRsLabel: string; pendingLeave: string; pendingLeavesRupees: string; vas: string;
  commission3: string; alibaba: string; projectCommission: string; pppCommission: string;
  postingCommission: string; overtimeMin: string; overtimeRs: string; reward: string; penalty: string;
  loan: string; cusUnpaidLeave: string; cusPaidLeave: string; basicCutting: string; tcutting: string;
  totalSalary: number; createDate: string; salaryStatus: string; netSalary: string;
};
type Block<T> = { rows: T[]; total: number };
type SalaryLookup = {
  query: string; selectedMonth: string; workedMonth: string;
  matches: { userId: string; attId: string; name: string; inSelectedMonth: boolean; lastSlipMonth: string | null }[];
};

type MainData = {
  month: string; workedMonth: string; penaltyMonth: string; deleteEnabled: boolean;
  male: Block<Slip>; female: Block<Slip>; both: Block<Slip>; onlySalary: Block<Slip>;
  onlySalaryLahore: Block<Slip>;
  donations: Block<{ id: string; name: string; amount: number; detail: string; create_at: string }>;
  penalties: Block<{ id: string; name: string; amount: number; detail: string; create_at: string }>;
  monthlyHead: Block<{ label: string; amount: number }>;
};

type Col<T> = { header: string; get: (r: T, i: number) => string | number | null | undefined };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
};
const prevYm = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

const SALARY_COLS: Col<Slip>[] = [
  { header: "#", get: (r) => r.id },
  { header: "Att ID", get: (r) => r.attId },
  { header: "Name", get: (r) => r.name },
  { header: "Gross Salary", get: (r) => r.grossSalary },
  { header: "VAS", get: (r) => r.vas },
  { header: "3 % Bonus", get: (r) => r.commission3 },
  { header: "AB Bonus", get: (r) => r.alibaba },
  { header: "Project Bonus", get: (r) => r.projectCommission },
  { header: "PPP Bonus", get: (r) => r.pppCommission },
  { header: "PP Bonus", get: (r) => r.postingCommission },
  { header: "OT RS", get: (r) => r.overtimeRs },
  { header: "Reward", get: (r) => r.reward },
  { header: "Leaves Rupees", get: (r) => r.pendingLeavesRupees },
  { header: "Cp Leave", get: (r) => r.cusUnpaidLeave },
  { header: "Cup Leave", get: (r) => r.cusPaidLeave },
  { header: "Total Cutting", get: (r) => r.tcutting },
  { header: "Total Salary", get: (r) => r.totalSalary },
];

const ONLY_SALARY_COLS: Col<Slip>[] = [
  { header: "#", get: (r) => r.id },
  { header: "Att ID", get: (r) => r.attId },
  { header: "Name", get: (r) => r.name },
  { header: "Gross Salary", get: (r) => r.grossSalary },
  { header: "Present", get: (r) => r.present },
  { header: "Leaves", get: (r) => r.leave },
  { header: "Leaves Rs", get: (r) => r.leavesRsLabel },
  { header: "CuttingMin", get: (r) => r.cuttingMin },
  { header: "CuttingMin Rs", get: (r) => r.cuttingMinRsLabel },
  { header: "Pending Leave", get: (r) => r.pendingLeave },
  { header: "Pending RS", get: (r) => r.pendingLeavesRupees },
  { header: "Over Time Min", get: (r) => r.overtimeMin },
  { header: "Over Time RS", get: (r) => r.overtimeRs },
  { header: "Reward", get: (r) => r.reward },
  { header: "Penalty", get: (r) => r.penalty },
  { header: "Loan", get: (r) => r.loan },
  { header: "Paid Leave", get: (r) => r.cusUnpaidLeave },
  { header: "Unpaid Leave", get: (r) => r.cusPaidLeave },
  { header: "Basic Cutting", get: (r) => r.basicCutting },
  { header: "Total Cutting", get: (r) => r.tcutting },
  { header: "Total Salary", get: (r) => r.totalSalary },
  { header: "Salary Status", get: (r) => r.salaryStatus },
];

const LIST_COLS: Col<{ name: string; amount: number; detail: string; create_at: string }>[] = [
  { header: "#", get: (_r, i) => i + 1 },
  { header: "Name", get: (r) => r.name },
  { header: "Amount", get: (r) => r.amount },
  { header: "Detail", get: (r) => r.detail },
  { header: "Create", get: (r) => r.create_at },
];

type ViewRow = {
  kind: string; id: string; create: string; name: string; grossSalary: string; vas: string;
  commission3: string; alibaba: string; projectCommission: string; pppCommission: string;
  postingCommission: string; overtimeRs: string; reward: string; tcutting: string; totalSalary: number;
};
const VIEW_COLS: Col<ViewRow>[] = [
  { header: "#", get: (r) => r.id },
  { header: "Create", get: (r) => r.create },
  { header: "Name", get: (r) => r.name },
  { header: "Gross Salary", get: (r) => r.grossSalary },
  { header: "VAS", get: (r) => r.vas },
  { header: "3 % Bonus", get: (r) => r.commission3 },
  { header: "AB Bonus", get: (r) => r.alibaba },
  { header: "Project Bonus", get: (r) => r.projectCommission },
  { header: "PPP Bonus", get: (r) => r.pppCommission },
  { header: "PP Bonus", get: (r) => r.postingCommission },
  { header: "OT RS", get: (r) => r.overtimeRs },
  { header: "Reward", get: (r) => r.reward },
  { header: "Total Cutting", get: (r) => r.tcutting },
  { header: "Total Salary", get: (r) => r.totalSalary },
];

const TABS = [
  { key: "male", label: "Male" },
  { key: "female", label: "Female" },
  { key: "both", label: "Both Male & Female" },
  { key: "onlySalary", label: "Only Salary" },
  { key: "onlySalaryLahore", label: "Only Salary Lahore" },
  { key: "donations", label: "Donations" },
  { key: "penalties", label: "Penalty" },
  { key: "monthlyHead", label: "Monthly Head" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function toMMYYYY(ym: string) {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

/** Table with per-tab search, Copy / Excel / CSV, sticky header and an old-style footer. */
function OldTable<T>({
  name, cols, rows, footer, action, reportMonth,
}: {
  name: string;
  cols: Col<T>[];
  rows: T[];
  footer?: { label: string; value: string | number; colIndex: number };
  action?: (r: T) => React.ReactNode;
  reportMonth?: string;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const searchHeaders = useMemo(
    () => new Set(["Name", "Att ID"].filter((h) => cols.some((c) => c.header === h))),
    [cols],
  );
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
  const searchCols = searchHeaders.size > 0 ? cols.filter((c) => searchHeaders.has(c.header)) : cols;
    return rows.filter((r, i) =>
      searchCols.some((c) => String(c.get(r, i) ?? "").toLowerCase().includes(t)),
    );
  }, [q, rows, cols, searchHeaders]);
  const lookup = useQuery<SalaryLookup>({
    queryKey: ["/api/reports/old-salary/lookup", reportMonth, q],
    queryFn: async () =>
      apiRequestJson("GET", `/api/reports/old-salary/lookup?month=${encodeURIComponent(reportMonth!)}&q=${encodeURIComponent(q.trim())}`),
    enabled: !!reportMonth && !!q.trim() && filtered.length === 0 && searchHeaders.has("Att ID"),
  });
  const exportCols: ExportColumn<{ cells: string[] }>[] = cols.map((c, i) => ({
    key: "cells", header: c.header, format: (_v, row) => row.cells[i],
  }));
  const exportRows = () => filtered.map((r, i) => ({ cells: cols.map((c) => String(c.get(r, i) ?? "")) }));
  const copy = async () => {
    const text = [cols.map((c) => c.header).join("\t"), ...exportRows().map((r) => r.cells.join("\t"))].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `Copied ${filtered.length} rows` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  const colSpan = cols.length + (action ? 1 : 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 print-hide">
        <div className="flex gap-1">
          <Button variant="outline" className="h-7 px-2 text-[11px] rounded-sm" onClick={copy}>Copy</Button>
          <Button variant="outline" className="h-7 px-2 text-[11px] rounded-sm" onClick={() => exportToExcel(exportRows(), exportCols, name)}>Excel</Button>
          <Button variant="outline" className="h-7 px-2 text-[11px] rounded-sm" onClick={() => exportToCSV(exportRows(), exportCols, name)}>CSV</Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">
            Search · {rows.length} rows{q.trim() ? ` · ${filtered.length} shown` : ""}
          </span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or Att ID"
            className="h-7 w-[200px] text-xs rounded-sm"
          />
          {q.trim() ? (
            <Button variant="ghost" className="h-7 px-2 text-[11px]" type="button" onClick={() => setQ("")}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <div className="max-h-[65vh] overflow-auto border border-slate-100 dark:border-zinc-800">
        <table className="w-full text-[12px] whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-[#e0f3e8] dark:bg-zinc-800">
            <tr>
              {cols.map((c) => <th key={c.header} className="py-2 px-2 text-left font-bold text-[#333] dark:text-zinc-200">{c.header}</th>)}
              {action && <th className="py-2 px-2 text-left font-bold text-[#333] dark:text-zinc-200 print-hide">Action</th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-zinc-900">
            {filtered.length === 0 ? (
              <tr><td colSpan={colSpan} className="py-6 text-center text-slate-500">No records.</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800">
                {cols.map((c) => <td key={c.header} className="py-1.5 px-2 text-[#555] dark:text-zinc-300">{c.get(r, i) ?? ""}</td>)}
                {action && <td className="py-1.5 px-2 print-hide">{action(r)}</td>}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="sticky bottom-0 bg-[#f7f7f7] dark:bg-zinc-800 font-bold">
              <tr>
                {cols.map((c, i) => (
                  <td key={c.header} className="py-2 px-2 text-[#333] dark:text-zinc-200">
                    {i === 0 ? footer.label : i === footer.colIndex ? footer.value : ""}
                  </td>
                ))}
                {action && <td className="print-hide" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {q.trim() ? (
        <div className="text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
          <div>Filter active: {filtered.length} of {rows.length} rows match. Clear search to see everyone in this tab.</div>
          {lookup.data?.matches?.length ? (
            <ul className="list-disc pl-4 space-y-0.5">
              {lookup.data.matches.map((m) => (
                <li key={m.userId}>
                  <b>{m.name}</b> (Att {m.attId || "—"})
                  {m.inSelectedMonth ? " — in this month." : m.lastSlipMonth ? (
                    <> — not in this month. Last slip saved in <b>{monthLabel(m.lastSlipMonth)}</b>
                      {m.lastSlipMonth !== reportMonth ? (
                        <> · switch month dropdown or open <Link href="/reports/salary-create" className="underline text-[#00a65a]">Salary Create</Link> for {monthLabel(lookup.data.workedMonth)} worked month.</>
                      ) : null}
                    </>
                  ) : (
                    <> — no salary slip on file. Use <Link href="/reports/salary-create" className="underline text-[#00a65a]">Salary Create</Link>.</>
                  )}
                </li>
              ))}
            </ul>
          ) : lookup.isFetched && !lookup.isLoading ? (
            <div>No employee matches this Att ID / name in legacy users.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type ViewReportHint = {
  attId?: string;
  name?: string;
  lastSlipMonth?: string | null;
  lastSlipDate?: string | null;
  rangeStart?: string;
  rangeEnd?: string;
  slipsInRange?: number;
};

type Result =
  | { kind: "view"; title: string; rows: ViewRow[]; total: number; hint?: ViewReportHint | null }
  | { kind: "monthWise"; title: string; rows: { n: number; month: string; total: number }[]; total: number }
  | { kind: "slips"; title: string; rows: Slip[] }
  | null;

export function OldSalaryReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("both");
  const [result, setResult] = useState<Result>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // "View Report" / "View Month Wise" / "Print Slip" inputs.
  const [vrGender, setVrGender] = useState("All");
  const [vrStart, setVrStart] = useState("");
  const [vrEnd, setVrEnd] = useState("");
  const [vrAllMonths, setVrAllMonths] = useState(false);
  const [vrCommission, setVrCommission] = useState(false);
  const [mwStart, setMwStart] = useState("");
  const [mwEnd, setMwEnd] = useState("");
  const [slipGender, setSlipGender] = useState("Male");

  const monthsQuery = useQuery<{ months: { month: string; slips: number }[]; current: string; latest: string }>({
    queryKey: ["/api/reports/old-salary/months"],
    queryFn: async () => apiRequestJson("GET", "/api/reports/old-salary/months"),
  });
  useEffect(() => {
    if (!month && monthsQuery.data) {
      const d = monthsQuery.data;
      // Old page = current month; fall back to the latest month that has slips.
      setMonth(d.months.some((m) => m.month === d.current) ? d.current : d.latest);
    }
  }, [monthsQuery.data, month]);
  useEffect(() => {
    if (month && !vrStart) { setVrStart(month); setVrEnd(month); setMwStart(month); setMwEnd(month); }
  }, [month, vrStart]);

  const usersQuery = useQuery<{ users: any[] }>({
    queryKey: ["/api/users", "salary-report"],
    queryFn: async () => apiRequestJson("GET", "/api/users"),
  });

  const main = useQuery<MainData>({
    queryKey: ["/api/reports/old-salary", month],
    queryFn: async () => apiRequestJson("GET", `/api/reports/old-salary?month=${month}`),
    enabled: !!month,
  });

  const del = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/reports/old-salary/slips/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/old-salary"] });
      toast({ title: "Salary slip deleted" });
    },
    onError: (err: any) => {
      let detail = "Could not delete the slip.";
      const m = String(err?.message ?? "").match(/^\d{3}:\s*([\s\S]*)$/);
      if (m) { try { detail = JSON.parse(m[1])?.error || detail; } catch { /* keep */ } }
      toast({ title: "Delete failed", description: detail, variant: "destructive" });
    },
  });

  async function run(fn: () => Promise<Result>) {
    setLoadingResult(true);
    try {
      setResult(await fn());
    } catch (err: any) {
      toast({ title: "Could not load", description: String(err?.message ?? ""), variant: "destructive" });
    } finally {
      setLoadingResult(false);
    }
  }

  const viewReport = () => run(async () => {
    const p = new URLSearchParams({ gender: vrGender });
    if (vrAllMonths) p.set("start", "All");
    else { p.set("start", toMMYYYY(vrStart)); p.set("end", toMMYYYY(vrEnd || vrStart)); }
    if (vrCommission) p.set("addCommission", "1");
    const d = await apiRequestJson<{ rows: ViewRow[]; total: number; hint?: ViewReportHint | null }>(
      "GET", `/api/reports/old-salary/view-report?${p}`);
    return { kind: "view", title: "View Report", rows: d.rows, total: d.total, hint: d.hint ?? null };
  });
  const viewMonthWise = () => run(async () => {
    const d = await apiRequestJson<{ rows: { n: number; month: string; total: number }[]; total: number }>(
      "GET", `/api/reports/old-salary/month-wise?start=${mwStart}&end=${mwEnd || mwStart}`);
    return { kind: "monthWise", title: "Month Wise", rows: d.rows, total: d.total };
  });
  const printSlips = () => {
    if (!main.data) return;
    const rows = slipGender === "Male" ? main.data.male.rows : slipGender === "Female" ? main.data.female.rows : main.data.both.rows;
    setResult({ kind: "slips", title: `Salary Slips — ${slipGender} — ${monthLabel(month)}`, rows });
    setTimeout(() => window.print(), 300);
  };

  const d = main.data;
  const genderOptions = [
    { value: "All", label: "All" },
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
  ];
  const deleteAction = d?.deleteEnabled
    ? (r: Slip) => (
        <button
          type="button"
          className="text-[#d9534f] hover:text-red-700"
          title="Delete slip"
          disabled={del.isPending}
          onClick={() => { if (window.confirm(`Delete salary slip #${r.id} (${r.name})?`)) del.mutate(r.id); }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )
    : undefined;

  return (
    <div className="space-y-4" id="old-salary-report">
      <style>{`
        @media print {
          #old-salary-report .print-hide { display: none !important; }
          #old-salary-report .max-h-\\[65vh\\] { max-height: none !important; overflow: visible !important; }
          .old-slip { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* Controls (old page header forms) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-3 print-hide">
        <div className="space-y-1.5 rounded-sm border border-slate-200 dark:border-zinc-800 p-3">
          <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">Month (when slip was saved)</Label>
          <Select value={month} onValueChange={(v) => { setMonth(v); setResult(null); }}>
            <SelectTrigger className="h-9 text-[13px]"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {(monthsQuery.data?.months ?? []).map((m) => (
                <SelectItem key={m.month} value={m.month}>
                  {monthLabel(m.month)} ({m.slips}) — worked {monthLabel(prevYm(m.month))}
                  {m.month === monthsQuery.data?.current ? " · current" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-[11px] text-slate-500">Print Slip</Label>
              <Select value={slipGender} onValueChange={setSlipGender}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {genderOptions.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="h-8 text-xs bg-[#3c8dbc] hover:bg-[#367fa9] text-white rounded-sm" disabled={!d} onClick={printSlips}>Print Slip</Button>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-1.5 rounded-sm border border-slate-200 dark:border-zinc-800 p-3">
          <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">View Report</Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[200px]">
              <RoleGroupedUserSelect
                grouped={false}
                users={usersQuery.data?.users ?? []}
                value={vrGender}
                onChange={setVrGender}
                extraOptions={genderOptions}
                placeholder="All"
                className="h-8 text-xs"
              />
            </div>
            <Input type="month" value={vrStart} disabled={vrAllMonths} onChange={(e) => setVrStart(e.target.value)} className="h-8 w-[150px] text-xs" />
            <Input type="month" value={vrEnd} disabled={vrAllMonths} onChange={(e) => setVrEnd(e.target.value)} className="h-8 w-[150px] text-xs" />
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
              <input type="checkbox" checked={vrAllMonths} onChange={(e) => setVrAllMonths(e.target.checked)} /> All months (one employee)
            </label>
            <p className="w-full text-[11px] text-slate-500">
              Month range = when the slip was <b>saved</b> (not worked month). If empty, tick &quot;All months&quot; or pick the month their slip was saved in.
            </p>
            <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
              <input type="checkbox" checked={vrCommission} onChange={(e) => setVrCommission(e.target.checked)} /> Add commission
            </label>
            <Button className="h-8 text-xs bg-[#00a65a] hover:bg-[#008d4c] text-white rounded-sm" disabled={loadingResult || (!vrAllMonths && !vrStart)} onClick={viewReport}>View Report</Button>
          </div>
        </div>

        <div className="space-y-1.5 rounded-sm border border-slate-200 dark:border-zinc-800 p-3">
          <Label className="text-xs font-bold text-[#555] dark:text-zinc-300">View Month Wise</Label>
          <div className="flex flex-wrap items-end gap-2">
            <Input type="month" value={mwStart} onChange={(e) => setMwStart(e.target.value)} className="h-8 w-[140px] text-xs" />
            <Input type="month" value={mwEnd} onChange={(e) => setMwEnd(e.target.value)} className="h-8 w-[140px] text-xs" />
            <Button className="h-8 text-xs bg-[#00a65a] hover:bg-[#008d4c] text-white rounded-sm" disabled={loadingResult || !mwStart} onClick={viewMonthWise}>View Month Wise</Button>
          </div>
        </div>
      </div>

      {result ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between print-hide">
            <h3 className="text-sm font-bold text-[#555] dark:text-zinc-300">{result.title}</h3>
            <div className="flex gap-2">
              {result.kind === "slips" && <Button variant="outline" className="h-7 px-3 text-xs" onClick={() => window.print()}>Print</Button>}
              <Button variant="outline" className="h-7 px-3 text-xs" onClick={() => setResult(null)}>Back to tabs</Button>
            </div>
          </div>
          {result.kind === "view" && (
            <div className="space-y-2">
              {result.rows.length === 0 && result.hint && (
                <div className="rounded-sm border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-200">
                  <b>{result.hint.name}</b>
                  {result.hint.attId ? ` (Att ${result.hint.attId})` : ""} has no slip saved between{" "}
                  <b>{result.hint.rangeStart}</b> and <b>{result.hint.rangeEnd}</b>.
                  {result.hint.lastSlipMonth ? (
                    <>
                      {" "}Last saved slip: <b>{monthLabel(result.hint.lastSlipMonth)}</b>
                      {result.hint.lastSlipDate ? ` (${result.hint.lastSlipDate})` : ""}.
                      <span className="flex flex-wrap gap-2 mt-2 print-hide">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            const lm = result.hint?.lastSlipMonth;
                            if (!lm) return;
                            setVrStart(lm);
                            setVrEnd(lm);
                            setVrAllMonths(false);
                            setMonth(lm);
                            void run(async () => {
                              const p = new URLSearchParams({
                                gender: vrGender,
                                start: toMMYYYY(lm),
                                end: toMMYYYY(lm),
                              });
                              if (vrCommission) p.set("addCommission", "1");
                              const d = await apiRequestJson<{ rows: ViewRow[]; total: number; hint?: ViewReportHint | null }>(
                                "GET", `/api/reports/old-salary/view-report?${p}`);
                              return { kind: "view" as const, title: "View Report", rows: d.rows, total: d.total, hint: d.hint ?? null };
                            });
                          }}
                        >
                          Use {result.hint.lastSlipMonth ? monthLabel(result.hint.lastSlipMonth) : "last month"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            setVrAllMonths(true);
                            void run(async () => {
                              const p = new URLSearchParams({ gender: vrGender, start: "All" });
                              if (vrCommission) p.set("addCommission", "1");
                              const d = await apiRequestJson<{ rows: ViewRow[]; total: number; hint?: ViewReportHint | null }>(
                                "GET", `/api/reports/old-salary/view-report?${p}`);
                              return { kind: "view" as const, title: "View Report", rows: d.rows, total: d.total, hint: d.hint ?? null };
                            });
                          }}
                        >
                          All months for this employee
                        </Button>
                        <Link href="/reports/salary-create" className="text-[#00a65a] underline self-center text-[11px]">
                          Salary Create (if no slip for this worked month)
                        </Link>
                      </span>
                    </>
                  ) : (
                    <> No salary slip on file — use Salary Create.</>
                  )}
                </div>
              )}
              <OldTable name="salary_view_report" cols={VIEW_COLS} rows={result.rows}
                footer={{ label: "Total", value: result.total, colIndex: VIEW_COLS.length - 1 }} />
            </div>
          )}
          {result.kind === "monthWise" && (
            <OldTable name="salary_month_wise"
              cols={[{ header: "#", get: (r: { n: number }) => r.n }, { header: "Month", get: (r: { month: string }) => r.month }, { header: "Total Salary", get: (r: { total: number }) => r.total }] as Col<{ n: number; month: string; total: number }>[]}
              rows={result.rows}
              footer={{ label: "Total", value: result.total, colIndex: 2 }} />
          )}
          {result.kind === "slips" && <SlipSheets rows={result.rows} month={month} />}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-zinc-800 print-hide">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-t-sm ${tab === t.key ? "bg-[#00a65a] text-white" : "text-[#555] dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {!month || main.isLoading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Loading old salary data…</div>
          ) : main.isError || !d ? (
            <div className="py-8 text-center text-[#d9534f] text-sm">Could not load the old salary report. You may not have permission to view salary.</div>
          ) : (
            <>
              <div className="text-[12px] text-slate-500">
                Slips <b>saved</b> in <b>{monthLabel(d.month)}</b> = salary for worked month <b>{monthLabel(d.workedMonth ?? prevYm(d.month))}</b>
                {" "}({d.both.rows.length} employees with a slip).
                {tab === "male" && <> Showing male ({d.male.rows.length}).</>}
                {tab === "female" && <> Showing female ({d.female.rows.length}).</>}
                {tab === "penalties" && <> · penalties of <b>{monthLabel(d.penaltyMonth)}</b> (previous month)</>}
                {!d.deleteEnabled && (tab === "male" || tab === "female") && <> · delete needs the salary-slip migration</>}
              </div>
              {tab === "male" && <OldTable reportMonth={d.month} name={`salary_male_${d.month}`} cols={SALARY_COLS} rows={d.male.rows} action={deleteAction}
                footer={{ label: "Total", value: d.male.total, colIndex: SALARY_COLS.length - 1 }} />}
              {tab === "female" && <OldTable reportMonth={d.month} name={`salary_female_${d.month}`} cols={SALARY_COLS} rows={d.female.rows} action={deleteAction}
                footer={{ label: "Total", value: d.female.total, colIndex: SALARY_COLS.length - 1 }} />}
              {tab === "both" && <OldTable reportMonth={d.month} name={`salary_both_${d.month}`} cols={SALARY_COLS} rows={d.both.rows}
                footer={{ label: "Total", value: d.both.total, colIndex: SALARY_COLS.length - 1 }} />}
              {tab === "onlySalary" && <OldTable reportMonth={d.month} name={`only_salary_${d.month}`} cols={ONLY_SALARY_COLS} rows={d.onlySalary.rows}
                footer={{ label: "Total", value: d.onlySalary.total, colIndex: ONLY_SALARY_COLS.length - 2 }} />}
              {tab === "onlySalaryLahore" && <OldTable reportMonth={d.month} name={`only_salary_lahore_${d.month}`} cols={ONLY_SALARY_COLS} rows={d.onlySalaryLahore.rows}
                footer={{ label: "Total", value: d.onlySalaryLahore.total, colIndex: ONLY_SALARY_COLS.length - 2 }} />}
              {tab === "donations" && <OldTable name="donations" cols={LIST_COLS} rows={d.donations.rows}
                footer={{ label: "Total", value: d.donations.total, colIndex: 2 }} />}
              {tab === "penalties" && <OldTable name={`penalties_${d.penaltyMonth}`} cols={LIST_COLS} rows={d.penalties.rows}
                footer={{ label: "Total", value: d.penalties.total, colIndex: 2 }} />}
              {tab === "monthlyHead" && <OldTable name={`monthly_head_${d.month}`}
                cols={[{ header: "#", get: (_r: { label: string }, i: number) => i + 1 }, { header: "Head", get: (r: { label: string }) => r.label }, { header: "Amount", get: (r: { amount: number }) => r.amount }] as Col<{ label: string; amount: number }>[]}
                rows={d.monthlyHead.rows}
                footer={{ label: "Total", value: d.monthlyHead.total, colIndex: 2 }} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Printable slips (slip.php is not on the server): one block per saved slip. */
function SlipSheets({ rows, month }: { rows: Slip[]; month: string }) {
  if (rows.length === 0) return <div className="py-6 text-center text-slate-500 text-sm">No salary slips for this month.</div>;
  const line = (label: string, value: string | number) => (
    <tr><td className="py-0.5 pr-3 text-slate-500">{label}</td><td className="py-0.5 font-medium text-right">{value}</td></tr>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((r) => (
        <div key={r.id} className="old-slip rounded-sm border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-[12px]">
          <div className="flex justify-between font-bold text-[13px] mb-1">
            <span>{r.name}</span><span>{monthLabel(month)}</span>
          </div>
          <div className="text-slate-500 mb-2">Slip #{r.id} · Att ID {r.attId} · {r.branch} · {String(r.createDate).slice(0, 10)}</div>
          <div className="grid grid-cols-2 gap-x-4">
            <table className="w-full"><tbody>
              {line("Gross Salary", r.grossSalary)}
              {line("Present", r.present)}
              {line("Leaves", r.leave)}
              {line("Cutting Min", r.cuttingMin)}
              {line("VAS", r.vas)}
              {line("3 % Bonus", r.commission3)}
              {line("AB Bonus", r.alibaba)}
              {line("Project Bonus", r.projectCommission)}
              {line("PPP Bonus", r.pppCommission)}
              {line("PP Bonus", r.postingCommission)}
            </tbody></table>
            <table className="w-full"><tbody>
              {line("Over Time RS", r.overtimeRs)}
              {line("Reward", r.reward)}
              {line("Leaves Rupees", r.pendingLeavesRupees)}
              {line("Penalty", r.penalty)}
              {line("Loan", r.loan || "0")}
              {line("Basic Cutting", r.basicCutting)}
              {line("Total Cutting", r.tcutting)}
              {line("Total Salary", r.totalSalary)}
              {line("Status", r.salaryStatus || "-")}
            </tbody></table>
          </div>
        </div>
      ))}
    </div>
  );
}
