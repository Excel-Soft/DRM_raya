import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type ReportRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  month: number | null;
  year: number | null;
  runStatus: string | null;
  basicSalary: number;
  grossSalary: number;
  absenceDeduction: number;
  penaltyAmount: number;
  loanDeduction: number;
  bonusAmount: number;
  allowanceAmount: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  payableSalary: number;
  paymentStatus: string;
};

type ReportResponse = {
  filters: { selfScoped: boolean };
  rows: ReportRow[];
  summary: { totalGross: number; totalDeductions: number; totalNet: number; employeeCount: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const now = new Date();
const ALL = "__all__";

const money = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  GENERATED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-amber-100 text-amber-800",
  FINALIZED: "bg-emerald-100 text-emerald-700",
  LOCKED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};
function Pill({ value, paid }: { value: string; paid?: boolean }) {
  const s = (value || "").toUpperCase();
  const cls = paid ? (s === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700") : STATUS_STYLES[s] || "bg-slate-100 text-slate-700";
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase ${cls}`}>{s || "-"}</span>;
}

export default function SalaryReport() {
  const { toast } = useToast();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [paymentStatus, setPaymentStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const buildParams = (forExport: boolean) => {
    const qs = new URLSearchParams();
    if (month) qs.set("month", month);
    if (year) qs.set("year", year);
    if (department.trim()) qs.set("department", department.trim());
    if (branch.trim()) qs.set("branch", branch.trim());
    if (status !== ALL) qs.set("status", status);
    if (paymentStatus !== ALL) qs.set("paymentStatus", paymentStatus);
    if (!forExport) {
      qs.set("page", String(page));
      qs.set("limit", "50");
    }
    return qs;
  };

  const report = useQuery<ReportResponse>({
    queryKey: ["/api/reports/salary", month, year, department, branch, status, paymentStatus, page],
    queryFn: () => apiRequestJson("GET", `/api/reports/salary?${buildParams(false).toString()}`),
  });

  const rows = report.data?.rows ?? [];
  const summary = report.data?.summary;
  const pagination = report.data?.pagination;
  const selfScoped = report.data?.filters?.selfScoped;

  const term = search.trim().toLowerCase();
  const filtered = term ? rows.filter((r) => (r.employeeName || "").toLowerCase().includes(term)) : rows;

  const resetToFirstPage = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiRequest("GET", `/api/reports/salary/export?${buildParams(true).toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary_report_${year}_${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not export the salary report.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-bold text-[#555] uppercase">Salary Report</h1>
          <Button onClick={handleExport} disabled={exporting || filtered.length === 0}
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded-sm h-9">
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>

        {selfScoped && (
          <div className="rounded-sm border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-700">
            Showing only your own salary records.
          </div>
        )}

        {/* Filters */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Month</Label>
                <Select value={month} onValueChange={resetToFirstPage(setMonth)}>
                  <SelectTrigger className="h-9 w-[140px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Year</Label>
                <Select value={year} onValueChange={resetToFirstPage(setYear)}>
                  <SelectTrigger className="h-9 w-[100px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Department</Label>
                <Input value={department} onChange={(e) => resetToFirstPage(setDepartment)(e.target.value)} placeholder="All"
                  className="h-9 w-[150px] bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Branch</Label>
                <Input value={branch} onChange={(e) => resetToFirstPage(setBranch)(e.target.value)} placeholder="All"
                  className="h-9 w-[150px] bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Run Status</Label>
                <Select value={status} onValueChange={resetToFirstPage(setStatus)}>
                  <SelectTrigger className="h-9 w-[140px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {["DRAFT", "GENERATED", "APPROVED", "FINALIZED", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Payment</Label>
                <Select value={paymentStatus} onValueChange={resetToFirstPage(setPaymentStatus)}>
                  <SelectTrigger className="h-9 w-[130px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All</SelectItem>
                    <SelectItem value="UNPAID">UNPAID</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 ml-auto">
                <Label className="text-xs font-bold text-[#555]">Search name</Label>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter current page"
                  className="h-9 w-[200px] bg-white border-slate-300 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            <div className="overflow-x-auto border border-slate-100">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#e0f3e8]">
                    {["#", "Name", "Dept", "Branch", "Period", "Basic", "Gross", "Absence", "Penalty", "Loan", "Bonus", "Allowance", "Other", "Deductions", "Payable", "Run", "Payment"].map((h, i) => (
                      <TableHead key={h} className={`py-2.5 px-2 font-bold text-[#333] text-xs ${i >= 5 && i <= 14 ? "text-right" : i >= 15 ? "text-center" : "text-left"}`}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {report.isLoading ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
                  ) : report.isError ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-[#d9534f] py-8">Could not load the salary report.</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={17} className="text-center text-muted-foreground py-8">No salary records match these filters.</TableCell></TableRow>
                  ) : (
                    filtered.map((r, idx) => (
                      <TableRow key={r.id} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                        <TableCell className="py-2 px-2 text-[#555]">{(pagination ? (pagination.page - 1) * pagination.limit : 0) + idx + 1}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] font-semibold">{r.employeeName || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555]">{r.department || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555]">{r.branch || "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555]">{r.month ? `${MONTHS[r.month - 1]} ${r.year}` : "-"}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.basicSalary)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.grossSalary)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.absenceDeduction)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.penaltyAmount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.loanDeduction)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.bonusAmount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.allowanceAmount)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.otherDeductions)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right">{money(r.totalDeductions)}</TableCell>
                        <TableCell className="py-2 px-2 text-[#555] text-right font-semibold">{money(r.payableSalary)}</TableCell>
                        <TableCell className="py-2 px-2 text-center"><Pill value={r.runStatus || ""} /></TableCell>
                        <TableCell className="py-2 px-2 text-center"><Pill value={r.paymentStatus} paid /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Totals + pagination */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-[#555]">
              <div className="flex flex-wrap gap-6">
                <span>Employees: <b>{summary?.employeeCount ?? 0}</b></span>
                <span>Total Gross: <b>{money(summary?.totalGross)}</b></span>
                <span>Total Deductions: <b>{money(summary?.totalDeductions)}</b></span>
                <span>Total Payable: <b className="text-[#00a65a]">{money(summary?.totalNet)}</b></span>
              </div>
              {pagination && pagination.total > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#777]">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.total} record(s)
                  </span>
                  <Button variant="outline" size="sm" className="h-8 rounded-sm" disabled={page <= 1 || report.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-sm" disabled={page >= pagination.totalPages || report.isFetching}
                    onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
