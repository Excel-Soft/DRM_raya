import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  BarChart, Bar, Cell,
} from "recharts";
import { exportPerformancePDF, exportPerformanceExcel } from "@/lib/performance-export";

type UserOpt = {
  id: string; name: string | null; fullName: string | null; email: string | null;
  role: string | null; roleId: string | null; department: string | null; branch: string | null; isActive: boolean;
};

type Component = {
  weight: number; score: number | null; weightedScore: number | null;
  status: "available" | "N/A"; details: string; [k: string]: any;
};

type ScoringConfig = {
  weights: { workCompletion: number; quality: number; targetAchievement: number; timeliness: number };
  penalties: { revision: number; return: number; rejected: number; complaint: number };
};

type Summary = {
  employee: { id: string; name: string | null; email: string | null; role: string | null; department: string | null };
  dateRange: { startDate: string; endDate: string };
  components: { workCompletion: Component; quality: Component; targetAchievement: Component; timeliness: Component };
  scoringConfig?: ScoringConfig;
  finalScore: number | null;
  normalizedFinalScore: number | null;
  formulaCompletenessPercent: number;
  rating: string;
  dataQuality: "complete" | "partial" | "none";
  missingMetrics: string[];
  managementSuggestions: string[];
  sourceBreakdown: Record<string, { total: number; assigned: number; completed: number; approved: number; returned: number }>;
  attendanceContext: { present: number; absent: number; late: number; halfDay: number; leave: number; totalDays: number; overtimeApprovedMinutes: number; available: boolean };
  totalRecords: number;
  partialDataFailure?: boolean;
  dataWarnings?: string[];
  records?: any[];
};

type FetchParams = { userId: string; startDate: string; endDate: string };
type TeamParams = { department: string; startDate: string; endDate: string };

type TeamRow = {
  employee: { id: string; name: string | null; email: string | null; role: string | null; department: string | null };
  finalScore: number | null;
  normalizedFinalScore: number | null;
  effectiveScore: number | null;
  rating: string;
  components: { workCompletion: number | null; quality: number | null; targetAchievement: number | null; timeliness: number | null };
  formulaCompletenessPercent: number;
  dataQuality: "complete" | "partial" | "none";
  totalRecords: number;
  partialDataFailure: boolean;
};

type TeamResponse = {
  dateRange: { startDate: string; endDate: string };
  count: number;
  total?: number;
  scored?: number;
  totalScored?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  stats?: { top: number | null; average: number | null; bottom: number | null; scored: number };
  team: (TeamRow & { rank?: number })[];
};

const TEAM_PAGE_SIZE = 50;

const ratingColor = (rating: string) => {
  switch (rating) {
    case "Excellent": return "text-emerald-600 dark:text-emerald-400";
    case "Good": return "text-green-600 dark:text-green-400";
    case "Satisfactory": return "text-amber-600 dark:text-amber-400";
    case "Needs Improvement": return "text-orange-600 dark:text-orange-400";
    case "Critical": return "text-red-600 dark:text-red-400";
    default: return "text-slate-500 dark:text-zinc-400";
  }
};

const ratingFill = (rating: string) => {
  switch (rating) {
    case "Excellent": return "#059669";
    case "Good": return "#16a34a";
    case "Satisfactory": return "#d97706";
    case "Needs Improvement": return "#ea580c";
    case "Critical": return "#dc2626";
    default: return "#94a3b8";
  }
};

const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "N/A" : `${n}`);
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 16).replace("T", " ");
};

export default function PerformancePage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"individual" | "team">("individual");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);
  const [teamParams, setTeamParams] = useState<TeamParams | null>(null);
  const [teamPage, setTeamPage] = useState<number>(1);
  const [formError, setFormError] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<UserOpt[]>({
    queryKey: ["/api/drm/performance/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/performance/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => u.department && set.add(u.department));
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(
    () => (department ? users.filter((u) => u.department === department) : users),
    [users, department],
  );

  const summaryQuery = useQuery<Summary | null>({
    queryKey: ["/api/drm/performance/summary", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const { userId, startDate, endDate } = fetchParams;
      const url = `/api/drm/performance/summary?userId=${encodeURIComponent(userId)}&startDate=${startDate}&endDate=${endDate}&includeRecords=true`;
      const res = await apiRequest("GET", url);
      if (res.status === 403) throw new Error("You are not authorized to view this employee's performance.");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to load performance data.");
      }
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const trendsQuery = useQuery<{ trend: any[] }>({
    queryKey: ["/api/drm/performance/trends", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return { trend: [] };
      const { userId, startDate, endDate } = fetchParams;
      const url = `/api/drm/performance/trends?userId=${encodeURIComponent(userId)}&startDate=${startDate}&endDate=${endDate}&interval=daily`;
      const res = await apiRequest("GET", url);
      if (!res.ok) return { trend: [] };
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const scoringConfigQuery = useQuery<{ config: ScoringConfig; canEdit: boolean }>({
    queryKey: ["/api/drm/performance/scoring-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/performance/scoring-config");
      if (!res.ok) throw new Error("Failed to load scoring configuration");
      return res.json();
    },
  });

  const teamQuery = useQuery<TeamResponse | null>({
    queryKey: ["/api/drm/performance/team", teamParams, teamPage],
    queryFn: async () => {
      if (!teamParams) return null;
      const { department, startDate, endDate } = teamParams;
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: String(teamPage),
        pageSize: String(TEAM_PAGE_SIZE),
      });
      if (department) params.set("department", department);
      const res = await apiRequest("GET", `/api/drm/performance/team?${params.toString()}`);
      if (res.status === 403) throw new Error("You are not authorized to view team performance.");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to load team comparison.");
      }
      return res.json();
    },
    enabled: !!teamParams,
  });

  const handleView = () => {
    setFormError("");
    if (!startDate || !endDate) { setFormError("Please select a start and end date."); return; }
    if (new Date(startDate) > new Date(endDate)) { setFormError("Start date must be on or before end date."); return; }
    if (mode === "team") {
      setTeamPage(1);
      setTeamParams({ department, startDate, endDate });
      return;
    }
    if (!selectedUser) { setFormError("Please select an employee."); return; }
    setFetchParams({ userId: selectedUser, startDate, endDate });
  };

  const handleReset = () => {
    setSelectedUser("");
    setDepartment("");
    setStartDate("");
    setEndDate("");
    setFetchParams(null);
    setTeamParams(null);
    setTeamPage(1);
    setFormError("");
  };

  const switchMode = (next: "individual" | "team") => {
    if (next === mode) return;
    setMode(next);
    setFormError("");
    setFetchParams(null);
    setTeamParams(null);
    setTeamPage(1);
  };

  const summary = summaryQuery.data ?? null;

  const handleExport = (format: "pdf" | "excel") => {
    if (!summary) return;
    try {
      if (format === "pdf") exportPerformancePDF(summary);
      else exportPerformanceExcel(summary);
      toast({ title: "Exported", description: `Performance report downloaded as ${format === "pdf" ? "PDF" : "Excel"}.` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Could not generate the report.", variant: "destructive" });
    }
  };

  const components = summary?.components;
  const componentRows = components
    ? [
        { key: "Work Completion", c: components.workCompletion, src: components.workCompletion.status === "available" ? `${components.workCompletion.assigned ?? 0} assigned / ${components.workCompletion.completed ?? 0} completed` : components.workCompletion.details },
        { key: "Quality", c: components.quality, src: components.quality.status === "available" ? `${components.quality.approved ?? 0}/${components.quality.reviewed ?? 0} approved` : components.quality.details },
        { key: "Target Achievement", c: components.targetAchievement, src: components.targetAchievement.status === "available" ? `${components.targetAchievement.achievedTarget ?? 0}/${components.targetAchievement.assignedTarget ?? 0}` : components.targetAchievement.details },
        { key: "Timeliness", c: components.timeliness, src: components.timeliness.status === "available" ? `${components.timeliness.onTime ?? 0} on-time / ${components.timeliness.late ?? 0} late` : components.timeliness.details },
      ]
    : [];

  const effectiveScore = summary ? (summary.normalizedFinalScore ?? summary.finalScore) : null;
  const records = summary?.records ?? [];

  // Prefer the config that produced the displayed score; fall back to the live one.
  const activeConfig = summary?.scoringConfig ?? scoringConfigQuery.data?.config ?? null;
  const canEditConfig = scoringConfigQuery.data?.canEdit ?? false;
  const formulaText = activeConfig
    ? `${activeConfig.weights.workCompletion}% Work Completion + ${activeConfig.weights.quality}% Quality + ${activeConfig.weights.targetAchievement}% Target Achievement + ${activeConfig.weights.timeliness}% Timeliness`
    : "40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness";

  return (
    <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950 space-y-6">
      <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase dark:text-zinc-400">
        PERFORMANCE SYSTEM
      </h1>

      {/* Mode toggle */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800" data-testid="mode-toggle">
        <button
          type="button"
          onClick={() => switchMode("individual")}
          className={`px-4 h-9 rounded-md text-[13px] font-semibold transition-colors ${mode === "individual" ? "bg-[#00a65a] text-white" : "text-[#495057] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
          data-testid="button-mode-individual"
        >
          Individual
        </button>
        <button
          type="button"
          onClick={() => switchMode("team")}
          className={`px-4 h-9 rounded-md text-[13px] font-semibold transition-colors ${mode === "team" ? "bg-[#00a65a] text-white" : "text-[#495057] dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
          data-testid="button-mode-team"
        >
          Team comparison
        </button>
      </div>

      {/* A. Filter Section */}
      <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Department</label>
              <Select value={department || "all"} onValueChange={(v) => { setDepartment(v === "all" ? "" : v); setSelectedUser(""); }}>
                <SelectTrigger className="h-10 text-[13px]" data-testid="select-department"><SelectValue placeholder="All Departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode === "individual" && (
              <div className="flex flex-col gap-2">
                <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Employee</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-10 text-[13px]" data-testid="select-employee"><SelectValue placeholder="Choose employee..." /></SelectTrigger>
                  <SelectContent>
                    {filteredUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName || u.name || u.email}{u.role ? ` — ${u.role}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-2 relative">
              <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input type="date" className="h-10 text-[13px] pr-10" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-start-date" />
                <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative">
              <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input type="date" className="h-10 text-[13px] pr-10" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="input-end-date" />
                <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          {formError && <p className="text-[13px] text-red-600 mt-4">{formError}</p>}
          <div className="mt-6 flex gap-3">
            <Button onClick={handleView} className="h-10 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide" data-testid="button-view">View</Button>
            <Button onClick={handleReset} variant="outline" className="h-10 px-8 font-semibold" data-testid="button-reset">Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* Admin: scoring configuration editor */}
      {canEditConfig && scoringConfigQuery.data && (
        <ScoringConfigEditor
          initial={scoringConfigQuery.data.config}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/drm/performance/scoring-config"] });
            queryClient.invalidateQueries({ queryKey: ["/api/drm/performance/summary"] });
          }}
        />
      )}

      {/* States */}
      {mode === "individual" && !fetchParams && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400 text-[14px]">
            Select an employee and date range, then click <span className="font-semibold">View</span> to calculate performance.
          </CardContent>
        </Card>
      )}

      {mode === "team" && !teamParams && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400 text-[14px]">
            Pick a date range (and optionally a department), then click <span className="font-semibold">View</span> to compare your whole team side by side.
          </CardContent>
        </Card>
      )}

      {mode === "team" && teamParams && teamQuery.isLoading && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400">Comparing team performance…</CardContent>
        </Card>
      )}

      {mode === "team" && teamParams && teamQuery.isError && (
        <Card className="border border-red-200 shadow-sm dark:bg-zinc-900 dark:border-red-900/40">
          <CardContent className="p-8 text-center text-red-600 dark:text-red-400 text-[14px]">
            {(teamQuery.error as Error)?.message || "Failed to load team comparison."}
          </CardContent>
        </Card>
      )}

      {mode === "team" && teamQuery.data && (
        <TeamComparison
          data={teamQuery.data}
          page={teamPage}
          onPageChange={setTeamPage}
          isFetching={teamQuery.isFetching}
        />
      )}

      {mode === "individual" && fetchParams && summaryQuery.isLoading && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400">Calculating performance…</CardContent>
        </Card>
      )}

      {mode === "individual" && fetchParams && summaryQuery.isError && (
        <Card className="border border-red-200 shadow-sm dark:bg-zinc-900 dark:border-red-900/40">
          <CardContent className="p-8 text-center text-red-600 dark:text-red-400 text-[14px]">
            {(summaryQuery.error as Error)?.message || "Failed to load performance data."}
          </CardContent>
        </Card>
      )}

      {mode === "individual" && summary && (
        <>
          {/* Employee header */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="p-5 flex flex-wrap gap-x-8 gap-y-2 items-center">
              <div><span className="text-[12px] text-slate-400">Employee</span><div className="font-semibold text-[#495057] dark:text-zinc-200" data-testid="text-employee-name">{summary.employee.name || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Role</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.employee.role || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Department</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.employee.department || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Records found</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.totalRecords}</div></div>
              <div className="ml-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-10 px-5 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide" data-testid="button-export">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
                      <FileText className="w-4 h-4 mr-2" />
                      Download PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("excel")} data-testid="button-export-excel">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {summary.partialDataFailure && (summary.dataWarnings?.length ?? 0) > 0 && (
            <Card className="border border-amber-300 bg-amber-50 shadow-sm dark:bg-amber-950/30 dark:border-amber-800" data-testid="card-data-warnings">
              <CardContent className="p-4 text-[12px] text-amber-800 dark:text-amber-300">
                <div className="font-semibold mb-1">Some data sources could not be loaded</div>
                <div className="text-amber-700 dark:text-amber-400">
                  The score below is based only on the sources that loaded successfully; the following could not be read and were skipped (not treated as zero):
                </div>
                <ul className="mt-1 list-disc pl-5">
                  {summary.dataWarnings!.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* B. Score summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            <ScoreCard label="Final Score" value={fmtScore(effectiveScore)} highlight testid="card-final-score" />
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-center">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Rating</span>
              <span className={`text-[18px] font-bold ${ratingColor(summary.rating)}`} data-testid="text-rating">{summary.rating}</span>
            </div>
            <ScoreCard label="Work Completion" value={fmtScore(components?.workCompletion.score)} testid="card-work" />
            <ScoreCard label="Quality" value={fmtScore(components?.quality.score)} testid="card-quality" />
            <ScoreCard label="Target" value={fmtScore(components?.targetAchievement.score)} testid="card-target" />
            <ScoreCard label="Timeliness" value={fmtScore(components?.timeliness.score)} testid="card-timeliness" />
            <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 flex flex-col justify-center">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Formula / Data</span>
              <span className="text-[15px] font-bold text-[#495057] dark:text-zinc-200">{summary.formulaCompletenessPercent}% complete</span>
              <span className="text-[12px] capitalize text-slate-500 dark:text-zinc-400">{summary.dataQuality} data</span>
            </div>
          </div>

          {/* C. Formula display */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="p-4 text-[13px] text-slate-600 dark:text-zinc-300">
              <span className="font-semibold">Final Score = </span>
              {formulaText}
              {summary.missingMetrics.length > 0 && (
                <span className="block mt-2 text-[12px] text-amber-600 dark:text-amber-400">
                  Missing components (excluded from normalized score): {summary.missingMetrics.join(", ")}
                </span>
              )}
            </CardContent>
          </Card>

          {/* D. Component breakdown table */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">Component Breakdown</div>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#daf1e2] hover:bg-[#daf1e2] dark:bg-zinc-800 dark:hover:bg-zinc-800">
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100">Component</TableHead>
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100 text-center">Weight</TableHead>
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100 text-center">Score</TableHead>
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100 text-center">Weighted</TableHead>
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100">Source Data</TableHead>
                    <TableHead className="font-bold text-[#212529] dark:text-zinc-100 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {componentRows.map((row) => (
                    <TableRow key={row.key} data-testid={`row-component-${row.key}`}>
                      <TableCell className="font-medium text-[#495057] dark:text-zinc-300">{row.key}</TableCell>
                      <TableCell className="text-center text-slate-600 dark:text-zinc-400">{row.c.weight}%</TableCell>
                      <TableCell className="text-center text-slate-600 dark:text-zinc-400">{fmtScore(row.c.score)}</TableCell>
                      <TableCell className="text-center text-slate-600 dark:text-zinc-400">{fmtScore(row.c.weightedScore)}</TableCell>
                      <TableCell className="text-[12.5px] text-slate-500 dark:text-zinc-400">{row.src}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[12px] font-semibold ${row.c.status === "available" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                          {row.c.status === "available" ? "Available" : "N/A"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* F. Trend section */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">Productivity Trend</div>
            <CardContent className="p-4 h-[280px]">
              {trendsQuery.data && trendsQuery.data.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsQuery.data.trend} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Line type="monotone" dataKey="completed" stroke="#00a65a" strokeWidth={2} name="Completed" />
                    <Line type="monotone" dataKey="assigned" stroke="#6366f1" strokeWidth={2} name="Assigned" />
                    <Line type="monotone" dataKey="score" stroke="#f59e0b" strokeWidth={2} name="Completion %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">No trend data available for this range.</div>
              )}
            </CardContent>
          </Card>

          {/* E. Performance records table */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">Performance Records</div>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#daf1e2] hover:bg-[#daf1e2] dark:bg-zinc-800 dark:hover:bg-zinc-800">
                    {["Date", "Source", "Activity", "Client/Company", "Task/Project", "Value", "Status", "On Time", "Quality", "Revisions", "Remarks"].map((h) => (
                      <TableHead key={h} className="font-bold text-[#212529] dark:text-zinc-100 whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-slate-500 dark:text-zinc-400">
                        No performance records found for this employee / date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((r: any) => (
                      <TableRow key={`${r.sourceModule}-${r.sourceId}`} data-testid="row-record">
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">{fmtDate(r.completedAt || r.assignedAt)}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400 capitalize">{r.sourceModule}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400">{r.activityType}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400">{r.clientCompany || "-"}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400">{r.title || "-"}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400">{r.taskValue ?? "-"}</TableCell>
                        <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400">{r.status || "-"}</TableCell>
                        <TableCell className="text-[12px] text-center">{r.isOnTime === null ? "-" : r.isOnTime ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-[12px] text-center">{r.isApproved ? "Approved" : r.isRejected ? "Rejected" : r.isReturned ? "Returned" : "-"}</TableCell>
                        <TableCell className="text-[12px] text-center">{r.revisionCount ?? 0}</TableCell>
                        <TableCell className="text-[12px] text-slate-500 dark:text-zinc-400 max-w-[200px] truncate">{r.remarks || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* G. Management suggestions */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">Management Suggestions</div>
            <CardContent className="p-5">
              <ul className="list-disc pl-5 space-y-1 text-[13px] text-slate-600 dark:text-zinc-300">
                {summary.managementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>

          {/* H. Attendance context */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">
              Attendance Context <span className="text-[12px] font-normal text-slate-400">(supporting only — not part of the score)</span>
            </div>
            <CardContent className="p-5">
              {summary.attendanceContext.available ? (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                  <CtxStat label="Present" value={summary.attendanceContext.present} />
                  <CtxStat label="Absent" value={summary.attendanceContext.absent} />
                  <CtxStat label="Late" value={summary.attendanceContext.late} />
                  <CtxStat label="Half Day" value={summary.attendanceContext.halfDay} />
                  <CtxStat label="Leave" value={summary.attendanceContext.leave} />
                  <CtxStat label="OT (min)" value={summary.attendanceContext.overtimeApprovedMinutes} />
                </div>
              ) : (
                <p className="text-[13px] text-slate-400">No attendance/overtime data available for this range.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, value, highlight, testid }: { label: string; value: string; highlight?: boolean; testid?: string }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm flex flex-col justify-center ${highlight ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900/40" : "border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800"}`} data-testid={testid}>
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-[22px] font-bold ${highlight ? "text-emerald-700 dark:text-emerald-300" : "text-[#495057] dark:text-zinc-200"}`}>{value}</span>
    </div>
  );
}

function CtxStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[20px] font-bold text-[#495057] dark:text-zinc-200">{value}</div>
      <div className="text-[12px] text-slate-400">{label}</div>
    </div>
  );
}

function ScoringConfigEditor({ initial, onSaved }: { initial: ScoringConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState(initial.weights);
  const [penalties, setPenalties] = useState(initial.penalties);
  const [error, setError] = useState<string>("");
  const [savedMsg, setSavedMsg] = useState<string>("");

  // Keep the form in sync if the server config changes (e.g. after a save).
  useEffect(() => {
    setWeights(initial.weights);
    setPenalties(initial.penalties);
  }, [initial]);

  const weightSum = weights.workCompletion + weights.quality + weights.targetAchievement + weights.timeliness;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/drm/performance/scoring-config", { weights, penalties });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to save scoring configuration");
      }
      return res.json();
    },
    onSuccess: () => {
      setError("");
      setSavedMsg("Scoring configuration saved.");
      onSaved();
      setTimeout(() => setSavedMsg(""), 4000);
    },
    onError: (e: Error) => {
      setSavedMsg("");
      setError(e.message);
    },
  });

  const handleSave = () => {
    setError("");
    setSavedMsg("");
    const values = [weights.workCompletion, weights.quality, weights.targetAchievement, weights.timeliness,
      penalties.revision, penalties.return, penalties.rejected, penalties.complaint];
    if (values.some((v) => !Number.isFinite(v) || v < 0)) {
      setError("All values must be numbers greater than or equal to 0.");
      return;
    }
    if (Math.round(weightSum * 10) / 10 !== 100) {
      setError(`Component weights must sum to 100 (currently ${Math.round(weightSum * 10) / 10}).`);
      return;
    }
    saveMutation.mutate();
  };

  const handleResetDefaults = () => {
    setWeights({ workCompletion: 40, quality: 30, targetAchievement: 20, timeliness: 10 });
    setPenalties({ revision: 2, return: 2, rejected: 5, complaint: 5 });
    setError("");
    setSavedMsg("");
  };

  const numField = (label: string, value: number, onChange: (n: number) => void, testid: string, suffix?: string) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">{label}{suffix ? <span className="text-slate-400 font-normal"> {suffix}</span> : null}</label>
      <Input
        type="number" min={0} step="0.1" className="h-9 text-[13px]"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        data-testid={testid}
      />
    </div>
  );

  return (
    <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800" data-testid="card-scoring-config">
      <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="font-bold text-[15px] text-[#495057] dark:text-zinc-300">Scoring Configuration <span className="text-[12px] font-normal text-slate-400">(admin)</span></div>
        <Button variant="outline" className="h-8 px-4 text-[12px] font-semibold" onClick={() => setOpen((o) => !o)} data-testid="button-toggle-scoring-config">
          {open ? "Hide" : "Edit Weights & Penalties"}
        </Button>
      </div>
      {open && (
        <CardContent className="p-5 space-y-5">
          <div>
            <div className="text-[13px] font-semibold text-[#495057] dark:text-zinc-300 mb-2">Component Weights <span className="text-[12px] font-normal text-slate-400">(must total 100%)</span></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {numField("Work Completion", weights.workCompletion, (n) => setWeights((w) => ({ ...w, workCompletion: n })), "input-weight-work", "%")}
              {numField("Quality", weights.quality, (n) => setWeights((w) => ({ ...w, quality: n })), "input-weight-quality", "%")}
              {numField("Target Achievement", weights.targetAchievement, (n) => setWeights((w) => ({ ...w, targetAchievement: n })), "input-weight-target", "%")}
              {numField("Timeliness", weights.timeliness, (n) => setWeights((w) => ({ ...w, timeliness: n })), "input-weight-timeliness", "%")}
            </div>
            <div className={`mt-2 text-[12px] font-semibold ${Math.round(weightSum * 10) / 10 === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} data-testid="text-weight-sum">
              Total: {Math.round(weightSum * 10) / 10}%
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#495057] dark:text-zinc-300 mb-2">Quality Penalties <span className="text-[12px] font-normal text-slate-400">(points deducted per occurrence)</span></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {numField("Per Revision", penalties.revision, (n) => setPenalties((p) => ({ ...p, revision: n })), "input-penalty-revision")}
              {numField("Per Return", penalties.return, (n) => setPenalties((p) => ({ ...p, return: n })), "input-penalty-return")}
              {numField("Per Rejection", penalties.rejected, (n) => setPenalties((p) => ({ ...p, rejected: n })), "input-penalty-rejected")}
              {numField("Per Open Complaint", penalties.complaint, (n) => setPenalties((p) => ({ ...p, complaint: n })), "input-penalty-complaint")}
            </div>
          </div>
          {error && <p className="text-[13px] text-red-600 dark:text-red-400" data-testid="text-config-error">{error}</p>}
          {savedMsg && <p className="text-[13px] text-emerald-600 dark:text-emerald-400" data-testid="text-config-saved">{savedMsg}</p>}
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="h-9 px-6 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide" data-testid="button-save-scoring-config">
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button onClick={handleResetDefaults} variant="outline" className="h-9 px-6 font-semibold" data-testid="button-reset-scoring-config">Reset to Defaults</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function TeamComparison({
  data,
  page,
  onPageChange,
  isFetching,
}: {
  data: TeamResponse;
  page: number;
  onPageChange: (p: number) => void;
  isFetching: boolean;
}) {
  const team = data.team ?? [];
  // Stats are computed server-side across the WHOLE scored scope so the summary
  // cards and TOP/LOW badges stay stable while paging. Fall back to the current
  // page only if the server didn't send stats (older response shape).
  const pageScored = team.filter((r) => r.effectiveScore !== null);
  const topScore = data.stats?.top ?? (pageScored.length ? pageScored[0].effectiveScore : null);
  const bottomScore =
    data.stats?.bottom ?? (pageScored.length ? pageScored[pageScored.length - 1].effectiveScore : null);
  const avgScore = data.stats?.average ?? null;
  const scoredCount = data.stats?.scored ?? pageScored.length;
  const totalScored = data.totalScored ?? team.length;
  const pageSize = data.pageSize ?? TEAM_PAGE_SIZE;
  const totalPages = data.totalPages ?? 1;
  const currentPage = data.page ?? page;
  const startRank = (currentPage - 1) * pageSize;

  const chartData = team.map((r, i) => ({
    name: r.employee.name || r.employee.email || "—",
    score: r.effectiveScore,
    rating: r.rating,
    hasScore: r.effectiveScore !== null,
    rank: r.rank ?? startRank + i + 1,
  }));
  const chartHeight = Math.max(240, chartData.length * 32);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Employees" value={`${totalScored}`} testid="card-team-count" />
        <ScoreCard label="Top Score" value={fmtScore(topScore)} highlight testid="card-team-top" />
        <ScoreCard label="Average Score" value={fmtScore(avgScore)} testid="card-team-avg" />
        <ScoreCard label="Lowest Score" value={fmtScore(bottomScore)} testid="card-team-bottom" />
      </div>

      <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">
          Score Comparison <span className="text-[12px] font-normal text-slate-400">(final score per employee, colored by rating)</span>
        </div>
        <CardContent className="p-4">
          {chartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-slate-400 text-[13px]">
              No employees found in your scope for this date range.
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 440 }} data-testid="chart-team-comparison">
              <div style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 24, bottom: 5, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} interval={0} />
                    <RTooltip formatter={(value: any, _name, item: any) => [item?.payload?.hasScore ? value : "No score", "Final Score"]} />
                    <Bar dataKey="score" name="Final Score" radius={[0, 4, 4, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.hasScore ? ratingFill(d.rating) : "#cbd5e1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
        <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-300 dark:border-zinc-800">
          Team Leaderboard <span className="text-[12px] font-normal text-slate-400">(ranked by final score; normalized over available components)</span>
        </div>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#daf1e2] hover:bg-[#daf1e2] dark:bg-zinc-800 dark:hover:bg-zinc-800">
                {["#", "Employee", "Role", "Department", "Final", "Rating", "Work", "Quality", "Target", "Timeliness", "Data", "Records"].map((h) => (
                  <TableHead key={h} className="font-bold text-[#212529] dark:text-zinc-100 whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-slate-500 dark:text-zinc-400">
                    No employees found in your scope for this date range.
                  </TableCell>
                </TableRow>
              ) : (
                team.map((r, i) => {
                  const rank = r.rank ?? startRank + i + 1;
                  const isTop = r.effectiveScore !== null && r.effectiveScore === topScore;
                  const isBottom = r.effectiveScore !== null && r.effectiveScore === bottomScore && scoredCount > 1;
                  return (
                    <TableRow key={r.employee.id} data-testid="row-team-member">
                      <TableCell className="text-[12px] font-semibold text-slate-600 dark:text-zinc-400">{rank}</TableCell>
                      <TableCell className="text-[13px] font-medium text-[#495057] dark:text-zinc-200 whitespace-nowrap">
                        {r.employee.name || r.employee.email || "—"}
                        {isTop && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">TOP</span>}
                        {isBottom && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">LOW</span>}
                      </TableCell>
                      <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">{r.employee.role || "—"}</TableCell>
                      <TableCell className="text-[12px] text-slate-600 dark:text-zinc-400 whitespace-nowrap">{r.employee.department || "—"}</TableCell>
                      <TableCell className="text-[13px] font-bold text-[#495057] dark:text-zinc-200">{fmtScore(r.effectiveScore)}</TableCell>
                      <TableCell className={`text-[12px] font-semibold whitespace-nowrap ${ratingColor(r.rating)}`}>{r.rating}</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-600 dark:text-zinc-400">{fmtScore(r.components.workCompletion)}</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-600 dark:text-zinc-400">{fmtScore(r.components.quality)}</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-600 dark:text-zinc-400">{fmtScore(r.components.targetAchievement)}</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-600 dark:text-zinc-400">{fmtScore(r.components.timeliness)}</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-500 dark:text-zinc-400">{r.formulaCompletenessPercent}%</TableCell>
                      <TableCell className="text-[12px] text-center text-slate-500 dark:text-zinc-400">{r.totalRecords}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-zinc-800"
            data-testid="team-pagination"
          >
            <div className="text-[12px] text-slate-500 dark:text-zinc-400">
              Showing {team.length === 0 ? 0 : startRank + 1}–{startRank + team.length} of {totalScored} ranked employees
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isFetching}
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                data-testid="button-team-prev"
              >
                Previous
              </Button>
              <span className="text-[12px] font-medium text-slate-600 dark:text-zinc-300">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isFetching}
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                data-testid="button-team-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
