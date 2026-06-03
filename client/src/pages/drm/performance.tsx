import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";

type UserOpt = {
  id: string; name: string | null; fullName: string | null; email: string | null;
  role: string | null; roleId: string | null; department: string | null; branch: string | null; isActive: boolean;
};

type Component = {
  weight: number; score: number | null; weightedScore: number | null;
  status: "available" | "N/A"; details: string; [k: string]: any;
};

type Summary = {
  employee: { id: string; name: string | null; email: string | null; role: string | null; department: string | null };
  dateRange: { startDate: string; endDate: string };
  components: { workCompletion: Component; quality: Component; targetAchievement: Component; timeliness: Component };
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
  records?: any[];
};

type FetchParams = { userId: string; startDate: string; endDate: string };

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

const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? "N/A" : `${n}`);
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 16).replace("T", " ");
};

export default function PerformancePage() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);
  const [formError, setFormError] = useState<string>("");

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

  const handleView = () => {
    setFormError("");
    if (!selectedUser) { setFormError("Please select an employee."); return; }
    if (!startDate || !endDate) { setFormError("Please select a start and end date."); return; }
    if (new Date(startDate) > new Date(endDate)) { setFormError("Start date must be on or before end date."); return; }
    setFetchParams({ userId: selectedUser, startDate, endDate });
  };

  const handleReset = () => {
    setSelectedUser("");
    setDepartment("");
    setStartDate("");
    setEndDate("");
    setFetchParams(null);
    setFormError("");
  };

  const summary = summaryQuery.data ?? null;
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

  return (
    <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950 space-y-6">
      <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase dark:text-zinc-400">
        PERFORMANCE SYSTEM
      </h1>

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

      {/* States */}
      {!fetchParams && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400 text-[14px]">
            Select an employee and date range, then click <span className="font-semibold">View</span> to calculate performance.
          </CardContent>
        </Card>
      )}

      {fetchParams && summaryQuery.isLoading && (
        <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-10 text-center text-slate-500 dark:text-zinc-400">Calculating performance…</CardContent>
        </Card>
      )}

      {fetchParams && summaryQuery.isError && (
        <Card className="border border-red-200 shadow-sm dark:bg-zinc-900 dark:border-red-900/40">
          <CardContent className="p-8 text-center text-red-600 dark:text-red-400 text-[14px]">
            {(summaryQuery.error as Error)?.message || "Failed to load performance data."}
          </CardContent>
        </Card>
      )}

      {summary && (
        <>
          {/* Employee header */}
          <Card className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="p-5 flex flex-wrap gap-x-8 gap-y-2 items-center">
              <div><span className="text-[12px] text-slate-400">Employee</span><div className="font-semibold text-[#495057] dark:text-zinc-200" data-testid="text-employee-name">{summary.employee.name || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Role</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.employee.role || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Department</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.employee.department || "—"}</div></div>
              <div><span className="text-[12px] text-slate-400">Records found</span><div className="font-medium text-[#495057] dark:text-zinc-300">{summary.totalRecords}</div></div>
            </CardContent>
          </Card>

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
              40% Work Completion + 30% Quality + 20% Target Achievement + 10% Timeliness
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
