import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson, getAuthHeader } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type RawRow = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  attendanceId: string;
  branch: string | null;
  department: string | null;
  date: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  workingMinutes: number | null;
  isLate: boolean;
  source: string;
  remarks: string | null;
};

type RawResponse = {
  rows: RawRow[];
  total: number;
  page: number;
  limit: number;
  source: string;
};

type UserListItem = { id: string; name: string | null; branch: string | null };

const STATUSES = ["Present", "Absent", "Late", "HalfDay", "Leave"];
const PAGE_SIZES = [10, 25, 50, 100];
const ALL = "__all__";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return ymd(d);
}
function fmtDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}
function fmtTime(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Applied = {
  startDate: string;
  endDate: string;
  branch: string;
  department: string;
  userId: string;
  attendanceStatus: string;
  page: number;
  limit: number;
};

function buildQuery(a: Applied, includePaging: boolean): string {
  const p = new URLSearchParams();
  p.set("startDate", a.startDate);
  p.set("endDate", a.endDate);
  if (a.branch && a.branch !== ALL) p.set("branch", a.branch);
  if (a.department.trim()) p.set("department", a.department.trim());
  if (a.userId && a.userId !== ALL) p.set("userId", a.userId);
  if (a.attendanceStatus && a.attendanceStatus !== ALL) p.set("attendanceStatus", a.attendanceStatus);
  if (includePaging) {
    p.set("page", String(a.page));
    p.set("limit", String(a.limit));
  }
  return p.toString();
}

export default function ReportsRawAttendance() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(ymd(new Date()));
  const [branch, setBranch] = useState(ALL);
  const [department, setDepartment] = useState("");
  const [userId, setUserId] = useState(ALL);
  const [attendanceStatus, setAttendanceStatus] = useState(ALL);
  const [limit, setLimit] = useState(25);
  const [exporting, setExporting] = useState(false);

  const [applied, setApplied] = useState<Applied>(() => ({
    startDate: defaultStart(),
    endDate: ymd(new Date()),
    branch: ALL,
    department: "",
    userId: ALL,
    attendanceStatus: ALL,
    page: 1,
    limit: 25,
  }));

  // Optional employee filter. Privileged-only endpoint; degrade silently if 403.
  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ["/api/reports/users-list"],
    queryFn: async () => apiRequestJson("GET", "/api/reports/users-list"),
    retry: false,
  });
  const users = usersQuery.data ?? [];
  const branches = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.branch) set.add(u.branch);
    return Array.from(set).sort();
  }, [users]);

  const reportQuery = useQuery<RawResponse>({
    queryKey: ["/api/reports/raw-attendance", applied],
    queryFn: async () =>
      apiRequestJson("GET", `/api/reports/raw-attendance?${buildQuery(applied, true)}`),
    retry: 1,
  });

  const rows = reportQuery.data?.rows ?? [];
  const total = reportQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / applied.limit));

  function applyFilters() {
    if (!startDate || !endDate) {
      toast({ title: "Date range required", description: "Pick both a start and end date.", variant: "destructive" });
      return;
    }
    if (startDate > endDate) {
      toast({ title: "Invalid range", description: "Start date must be on or before end date.", variant: "destructive" });
      return;
    }
    setApplied({ startDate, endDate, branch, department, userId, attendanceStatus, page: 1, limit });
  }

  function goToPage(next: number) {
    setApplied((a) => ({ ...a, page: Math.min(Math.max(1, next), totalPages) }));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/raw-attendance/export?${buildQuery(applied, false)}`, {
        headers: getAuthHeader(),
        credentials: "include",
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `raw_attendance_${applied.startDate}_${applied.endDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Could not export CSV.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-bold text-[#555] uppercase">Raw Attendance Report</h1>
          <Button
            onClick={exportCsv}
            disabled={exporting || reportQuery.isLoading}
            className="h-8 px-4 bg-[#5c7cfa] hover:bg-[#4c6ef5] text-white text-xs rounded-sm"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Start date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">End date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Branch</label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All branches</SelectItem>
                    {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Department</label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Any" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Employee</label>
                <Select value={userId} onValueChange={setUserId} disabled={users.length === 0}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All employees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All employees</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Status</label>
                <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Button onClick={applyFilters} className="h-8 px-4 bg-[#343a40] hover:bg-[#23272b] text-white text-xs rounded-sm">
                  View
                </Button>
                <span className="text-xs text-slate-400">
                  {reportQuery.isFetching ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Per page</span>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Date</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Employee</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Branch</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Department</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Status</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Check In</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Check Out</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Worked (min)</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Late</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {reportQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                    </TableRow>
                  ) : reportQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="text-[#d9534f] mb-2">Could not load the raw attendance report.</div>
                        <Button size="sm" variant="outline" onClick={() => reportQuery.refetch()} className="h-7 px-3 text-xs">Retry</Button>
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No attendance records match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => (
                      <TableRow key={r.id} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                        <TableCell className="py-3 px-3 text-[#555]">{fmtDate(r.date)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] font-semibold">{r.employeeName || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{r.branch || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{r.department || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{r.status || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{fmtTime(r.checkIn)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{fmtTime(r.checkOut)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{r.workingMinutes ?? "-"}</TableCell>
                        <TableCell className="py-3 px-3">
                          {r.isLate
                            ? <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#fdecea] text-[#d9534f]">Late</span>
                            : <span className="text-xs text-slate-400">-</span>}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-[#555] max-w-[240px] truncate" title={r.remarks || ""}>{r.remarks || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Page {applied.page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applied.page <= 1 || reportQuery.isFetching}
                  onClick={() => goToPage(applied.page - 1)}
                  className="h-7 px-3 text-xs"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={applied.page >= totalPages || reportQuery.isFetching}
                  onClick={() => goToPage(applied.page + 1)}
                  className="h-7 px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
