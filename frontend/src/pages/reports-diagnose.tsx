import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { buildReportQueryParams, validateDateRange } from "@/lib/reportApi";
import { useToast } from "@/hooks/use-toast";

type DiagnoseRow = {
  id: string;
  diagnosisDate: string | null;
  companyName: string | null;
  customerName: string | null;
  personName: string | null;
  diagnosisType: string | null;
  status: string | null;
  assignedToName: string | null;
  branch: string | null;
  department: string | null;
  notes: string | null;
  createdByName: string | null;
};

type DiagnoseResponse = {
  filters: { scope: "all" | "team" | "own" };
  rows: DiagnoseRow[];
  summary: { total: number; byStatus: Record<string, number> };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type AppliedFilters = {
  userId: string;
  startDate: string;
  endDate: string;
  status: string;
  diagnosisType: string;
  branch: string;
  department: string;
};

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
const ALL = "__all__";
const PAGE_SIZE = 50;

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-zinc-200 text-zinc-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function StatusPill({ value }: { value: string | null }) {
  const s = (value || "").toUpperCase();
  const cls = STATUS_STYLES[s] || "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase ${cls}`}>
      {s ? s.replace(/_/g, " ") : "-"}
    </span>
  );
}

export default function ReportsDiagnose() {
  const { toast } = useToast();
  const [selectedPerson, setSelectedPerson] = useState<string>(ALL);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [diagnosisType, setDiagnosisType] = useState<string>("");
  const [branch, setBranch] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [validationMsg, setValidationMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      return res.json();
    },
  });

  const buildParams = (a: AppliedFilters, forExport: boolean) => {
    const base: Record<string, string | undefined> = {
      userId: a.userId && a.userId !== ALL ? a.userId : undefined,
      startDate: a.startDate || undefined,
      endDate: a.endDate || undefined,
      status: a.status && a.status !== ALL ? a.status : undefined,
      diagnosisType: a.diagnosisType.trim() || undefined,
      branch: a.branch.trim() || undefined,
      department: a.department.trim() || undefined,
    };
    if (!forExport) {
      base.page = String(page);
      base.limit = String(PAGE_SIZE);
    }
    return buildReportQueryParams(base);
  };

  const {
    data: reportData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<DiagnoseResponse>({
    queryKey: ["/api/reports/diagnose", applied, page],
    queryFn: () => {
      const query = buildParams(applied!, false);
      return apiRequestJson<DiagnoseResponse>("GET", `/api/reports/diagnose${query ? `?${query}` : ""}`);
    },
    enabled: !!applied,
    retry: false,
  });

  const handleView = () => {
    const v = validateDateRange(startDate, endDate);
    if (!v.valid) {
      setValidationMsg(v.message || "Invalid date range.");
      return;
    }
    setValidationMsg("");
    setPage(1);
    setApplied({
      userId: selectedPerson,
      startDate,
      endDate,
      status: statusFilter,
      diagnosisType,
      branch,
      department,
    });
  };

  const handleExport = async () => {
    if (!applied) return;
    setExporting(true);
    try {
      const query = buildParams(applied, true);
      const res = await apiRequest("GET", `/api/reports/diagnose/export${query ? `?${query}` : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diagnosis_report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export the diagnosis report (you may not have export permission).",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const rows = reportData?.rows ?? [];
  const summary = reportData?.summary;
  const pagination = reportData?.pagination;
  const scope = reportData?.filters?.scope;

  const term = searchQuery.trim().toLowerCase();
  const filtered = term
    ? rows.filter(
        (r) =>
          (r.companyName || "").toLowerCase().includes(term) ||
          (r.customerName || "").toLowerCase().includes(term) ||
          (r.personName || "").toLowerCase().includes(term),
      )
    : rows;

  const startIndex = pagination ? (pagination.page - 1) * pagination.limit : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest flex gap-2 items-center">
          Diagnosis Report <span className="text-slate-300 font-light">/</span>
          <span
            className="text-[#00a65a] cursor-pointer hover:underline transition-all select-none"
            onClick={() => setShowFilters(!showFilters)}
          >
            View Report
          </span>
        </h1>
        <Button
          onClick={handleExport}
          disabled={!applied || exporting || filtered.length === 0}
          className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {scope && scope !== "all" && (
        <div className="rounded-sm border border-blue-200 bg-blue-50 p-2.5 text-[12px] text-blue-700">
          {scope === "own"
            ? "Showing only diagnosis records assigned to or created by you."
            : "Showing diagnosis records for your team/department."}
        </div>
      )}

      {showFilters && (
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Person</label>
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger className="bg-white dark:bg-zinc-800">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Persons</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.name || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start</label>
                <div className="relative">
                  <Input
                    type="date"
                    className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End</label>
                <div className="relative">
                  <Input
                    type="date"
                    className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-white dark:bg-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Statuses</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Diagnosis Type</label>
                <Input
                  className="bg-white dark:bg-zinc-800 text-sm"
                  placeholder="All"
                  value={diagnosisType}
                  onChange={(e) => setDiagnosisType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Branch</label>
                <Input
                  className="bg-white dark:bg-zinc-800 text-sm"
                  placeholder="All"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Department</label>
                <Input
                  className="bg-white dark:bg-zinc-800 text-sm"
                  placeholder="All"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
            </div>

            {validationMsg && (
              <div className="mt-4 text-sm text-rose-600 font-medium">{validationMsg}</div>
            )}

            <div className="mt-6">
              <Button
                onClick={handleView}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8"
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">Diagnosis View</h2>
        </div>
        <CardContent className="p-6">
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Search:</span>
              <Input
                className="h-8 w-[220px] bg-white dark:bg-zinc-800"
                placeholder="Filter current page"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b">#</th>
                  <th className="py-3 px-4 font-bold border-b">Date</th>
                  <th className="py-3 px-4 font-bold border-b">Company/Customer</th>
                  <th className="py-3 px-4 font-bold border-b">Person</th>
                  <th className="py-3 px-4 font-bold border-b">Diagnosis Type</th>
                  <th className="py-3 px-4 font-bold border-b">Status</th>
                  <th className="py-3 px-4 font-bold border-b">Assigned To</th>
                  <th className="py-3 px-4 font-bold border-b">Branch</th>
                  <th className="py-3 px-4 font-bold border-b">Notes</th>
                  <th className="py-3 px-4 font-bold border-b">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {!applied ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      Choose filters and click <span className="font-semibold">View</span> to load the diagnosis report.
                    </td>
                  </tr>
                ) : isLoading || isFetching ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-rose-600 text-sm">
                      Failed to load the diagnosis report.{" "}
                      <button onClick={() => refetch()} className="underline font-semibold ml-1">
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No diagnosis records match these filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors align-top"
                    >
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{startIndex + index + 1}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.diagnosisDate ? format(new Date(item.diagnosisDate), "yyyy-MM-dd") : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {item.companyName || "-"}
                        {item.customerName && (
                          <span className="block text-xs font-normal text-slate-400">{item.customerName}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.personName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.diagnosisType || "-"}</td>
                      <td className="py-3 px-4">
                        <StatusPill value={item.status} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.assignedToName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.branch || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 max-w-[260px] whitespace-normal">
                        {item.notes || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.createdByName || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 text-sm text-slate-500">
            <div className="flex flex-wrap gap-5">
              <span>
                Total: <b>{summary?.total ?? 0}</b>
              </span>
              {summary &&
                STATUSES.map((s) => (
                  <span key={s}>
                    {s.replace(/_/g, " ")}: <b>{summary.byStatus?.[s] ?? 0}</b>
                  </span>
                ))}
            </div>
            {pagination && pagination.total > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} record(s)
                </span>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-slate-500"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="h-8 px-3 text-slate-500"
                  disabled={page >= pagination.totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
