import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Download, AlertTriangle } from "lucide-react";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import {
  buildReportQueryParams,
  validateDateRange,
  validateRequiredFilter,
  downloadReportExport,
  safeReportFilename,
} from "@/lib/reportApi";
import { normalizeRole, isManagerialRole } from "@/lib/role-utils";
import { useToast } from "@/hooks/use-toast";

interface DayTargetRow {
  employeeId: string;
  employeeName: string | null;
  role: string | null;
  department: string | null;
  date: string;
  targetName: string | null;
  targetType: string | null;
  assignedTarget: number | null;
  achieved: number;
  pending: number | null;
  achievementPercent: number | null;
  activities: number;
  calls: number;
  followUps: number;
  meetings: number;
  gmAmount: number;
  remarks: string | null;
}

interface DayTargetReport {
  filters: Record<string, unknown>;
  rows: DayTargetRow[];
  summary: {
    totalAssigned: number;
    totalAchieved: number;
    totalPending: number;
    averageAchievementPercent: number | null;
    employeeCount: number;
  };
  pagination: { page: number; limit: number; total: number; totalPages: number };
  missingData: { employeeId: string; employeeName: string | null; reason: string }[];
}

interface FetchParams {
  userId: string;
  startDate: string;
  endDate: string;
  ourTeam: boolean;
  page: number;
}

const PAGE_LIMIT = 25;
const EXPORT_ROLES = ["admin", "super_admin", "super_hod", "account_manager", "hod"];
const TEAM_ROLES = ["admin", "super_admin", "super_hod", "hod", "hr", "hr_manager"];

const fmtNum = (v: number | null | undefined, dash = "—") =>
  v === null || v === undefined ? dash : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${fmtNum(v)}%`);

export default function ReportsDayTarget() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [ourTeam, setOurTeam] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);

  // Authoritative current role (also drives Our Team / Export availability).
  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
  });
  const role = normalizeRole(me?.role ?? me?.activeRoleId);
  const canSeeTeam = !!me && (isManagerialRole(role) || TEAM_ROLES.includes(role));
  const canExport = EXPORT_ROLES.includes(role);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      return res.json();
    },
  });

  // Day-target report. No mock fallback: a backend failure surfaces as a real
  // error state with retry, never fabricated rows.
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<DayTargetReport>({
    queryKey: ["/api/reports/day-target", fetchParams],
    queryFn: async () => {
      const p = fetchParams!;
      const query = buildReportQueryParams({
        startDate: p.startDate,
        endDate: p.endDate,
        userId: p.userId && p.userId !== "all" ? p.userId : undefined,
        ourTeam: p.ourTeam ? "true" : undefined,
        page: p.page,
        limit: PAGE_LIMIT,
      });
      return apiRequestJson<DayTargetReport>("GET", `/api/reports/day-target?${query}`);
    },
    enabled: !!fetchParams,
    retry: false,
  });

  const handleView = () => {
    const reqStart = validateRequiredFilter(startDate, "Start date");
    if (!reqStart.valid) return setValidationError(reqStart.message!);
    const reqEnd = validateRequiredFilter(endDate, "End date");
    if (!reqEnd.valid) return setValidationError(reqEnd.message!);
    const range = validateDateRange(startDate, endDate);
    if (!range.valid) return setValidationError(range.message!);
    setValidationError(null);
    setFetchParams({ userId: selectedUser, startDate, endDate, ourTeam: canSeeTeam ? ourTeam : false, page: 1 });
  };

  const handleExport = async () => {
    if (!fetchParams) return;
    setExporting(true);
    try {
      await downloadReportExport({
        url: "/api/reports/day-target/export",
        filename: safeReportFilename("daily-target", {
          from: fetchParams.startDate,
          to: fetchParams.endDate,
          user: fetchParams.userId && fetchParams.userId !== "all" ? fetchParams.userId : undefined,
          timestamp: true,
        }),
        filters: {
          startDate: fetchParams.startDate,
          endDate: fetchParams.endDate,
          userId: fetchParams.userId && fetchParams.userId !== "all" ? fetchParams.userId : undefined,
          ourTeam: fetchParams.ourTeam ? "true" : undefined,
          format: "csv",
        },
      });
      toast({ title: "Export ready", description: "Your daily target CSV is downloading." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Could not export the report.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  const pagination = data?.pagination;
  const missingData = data?.missingData ?? [];
  const COLS = 16;

  const goToPage = (page: number) => {
    if (!fetchParams) return;
    setFetchParams({ ...fetchParams, page });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest">
        Daily Target Report
      </h1>

      {/* Filters */}
      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            <div className="space-y-2 w-full md:w-1/4">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white dark:bg-zinc-800" data-testid="select-user">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.name || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 mb-2 w-full md:w-auto">
              <Checkbox
                id="ourTeam"
                checked={ourTeam}
                disabled={!canSeeTeam}
                onCheckedChange={(c) => setOurTeam(!!c)}
                className="h-4 w-4 rounded-sm border-slate-300"
                data-testid="checkbox-our-team"
              />
              <label
                htmlFor="ourTeam"
                className={`text-sm ${canSeeTeam ? "text-slate-600 dark:text-zinc-400" : "text-slate-400 dark:text-zinc-600"}`}
              >
                Our Team
              </label>
            </div>

            <div className="space-y-2 relative w-full md:w-1/4">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 relative w-full md:w-1/4">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="w-full md:w-auto">
              <Button
                onClick={handleView}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8 w-full"
                data-testid="button-view"
              >
                View
              </Button>
            </div>
          </div>

          {validationError && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" data-testid="text-validation-error">
              {validationError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="summary-cards">
          {[
            { label: "Total Assigned", value: fmtNum(summary.totalAssigned) },
            { label: "Total Achieved", value: fmtNum(summary.totalAchieved) },
            { label: "Total Pending", value: fmtNum(summary.totalPending) },
            { label: "Avg Achievement", value: fmtPct(summary.averageAchievementPercent) },
            { label: "Employees", value: fmtNum(summary.employeeCount) },
          ].map((c) => (
            <Card key={c.label} className="border-none shadow-sm dark:bg-zinc-900">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  {c.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-zinc-100">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Missing-data honesty note */}
      {missingData.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300"
          data-testid="missing-data-note"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {missingData.length} employee{missingData.length > 1 ? "s have" : " has"} no assigned target in this
            range; their assigned/pending values are shown as “—”. Activity counts are still real.
          </span>
        </div>
      )}

      {/* Report table */}
      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">View Report</h2>
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!fetchParams || rows.length === 0 || exporting}
              className="gap-2"
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          )}
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center whitespace-nowrap">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-3 font-bold border-b text-left">Name</th>
                  <th className="py-3 px-3 font-bold border-b">Role</th>
                  <th className="py-3 px-3 font-bold border-b">Department</th>
                  <th className="py-3 px-3 font-bold border-b">Date</th>
                  <th className="py-3 px-3 font-bold border-b text-left">Target</th>
                  <th className="py-3 px-3 font-bold border-b">Type</th>
                  <th className="py-3 px-3 font-bold border-b">Assigned</th>
                  <th className="py-3 px-3 font-bold border-b">Achieved</th>
                  <th className="py-3 px-3 font-bold border-b">Pending</th>
                  <th className="py-3 px-3 font-bold border-b">Achv %</th>
                  <th className="py-3 px-3 font-bold border-b">Activities</th>
                  <th className="py-3 px-3 font-bold border-b">Calls</th>
                  <th className="py-3 px-3 font-bold border-b">Follow-ups</th>
                  <th className="py-3 px-3 font-bold border-b">Meetings</th>
                  <th className="py-3 px-3 font-bold border-b">GM Amount</th>
                  <th className="py-3 px-3 font-bold border-b text-left">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {!fetchParams ? (
                  <tr>
                    <td colSpan={COLS} className="py-10 text-center text-slate-500">
                      Choose a date range and click View to load the report.
                    </td>
                  </tr>
                ) : isLoading || isFetching ? (
                  <tr>
                    <td colSpan={COLS} className="py-10 text-center text-slate-500" data-testid="state-loading">
                      Loading data…
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={COLS} className="py-10 text-center text-rose-600 text-sm" data-testid="state-error">
                      {(error as any)?.message || "Failed to load the report."}{" "}
                      <button onClick={() => refetch()} className="underline font-semibold ml-1">
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLS} className="py-10 text-center text-slate-500" data-testid="state-empty">
                      No employees match these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.employeeId}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                      data-testid={`row-${r.employeeId}`}
                    >
                      <td className="py-3 px-3 text-left text-slate-700 dark:text-zinc-300 font-medium">
                        {r.employeeName || "—"}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{r.role || "—"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{r.department || "—"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{r.date}</td>
                      <td className="py-3 px-3 text-left text-slate-600 dark:text-zinc-400">{r.targetName || "—"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{r.targetType || "—"}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{fmtNum(r.assignedTarget)}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{fmtNum(r.achieved)}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{fmtNum(r.pending)}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{fmtPct(r.achievementPercent)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{fmtNum(r.activities)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{fmtNum(r.calls)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{fmtNum(r.followUps)}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">{fmtNum(r.meetings)}</td>
                      <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">{fmtNum(r.gmAmount)}</td>
                      <td className="py-3 px-3 text-left text-slate-500 dark:text-zinc-500">{r.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-zinc-800 text-sm text-slate-600 dark:text-zinc-400">
              <span data-testid="text-pagination">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} employee
                {pagination.total > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isFetching}
                  onClick={() => goToPage(pagination.page - 1)}
                  data-testid="button-prev"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isFetching}
                  onClick={() => goToPage(pagination.page + 1)}
                  data-testid="button-next"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
