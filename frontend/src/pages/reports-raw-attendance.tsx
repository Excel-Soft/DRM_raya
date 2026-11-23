import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { downloadAuthedFile } from "@/lib/download";
import { safeReportFilename } from "@/lib/reportApi";
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
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

// Old DRM "Raw Attendance": one row per biometric machine punch.
type RawRow = {
  id: string;
  employeeId: string | null;
  employeeName: string | null;
  deviceUserId: string | null;
  office: string | null;
  deviceIp: string | null;
  state: string | null;
  type: string | null;
  date: string | null;
  time: string | null;
  receivedAt: string | null;
};

type RawResponse = {
  rows: RawRow[];
  total: number;
  page: number;
  limit: number;
  offices?: string[];
  source: string;
};

type UserListItem = { id: string; name?: string | null; fullName?: string | null; branch?: string | null };

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
  const [y, m, d] = value.split("-");
  return d && m && y ? `${d}/${m}/${y}` : value;
}

type Applied = {
  startDate: string;
  endDate: string;
  branch: string;
  userId: string;
  page: number;
  limit: number;
};

function buildQuery(a: Applied, includePaging: boolean): string {
  const p = new URLSearchParams();
  p.set("startDate", a.startDate);
  p.set("endDate", a.endDate);
  if (a.branch && a.branch !== ALL) p.set("branch", a.branch);
  if (a.userId && a.userId !== ALL) p.set("userId", a.userId);
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
  const [userId, setUserId] = useState(ALL);
  const [limit, setLimit] = useState(25);
  const [exporting, setExporting] = useState(false);

  const [applied, setApplied] = useState<Applied>(() => ({
    startDate: defaultStart(),
    endDate: ymd(new Date()),
    branch: ALL,
    userId: ALL,
    page: 1,
    limit: 25,
  }));

  // Employee filter: same user list the other report pages use.
  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ["/api/users", "raw-attendance"],
    queryFn: async () => {
      const data: any = await apiRequestJson("GET", "/api/users");
      return Array.isArray(data) ? data : data?.users ?? [];
    },
    retry: false,
  });
  const users = usersQuery.data ?? [];

  const reportQuery = useQuery<RawResponse>({
    queryKey: ["/api/reports/raw-attendance", applied],
    queryFn: async () =>
      apiRequestJson("GET", `/api/reports/raw-attendance?${buildQuery(applied, true)}`),
    retry: 1,
  });

  const rows = reportQuery.data?.rows ?? [];
  const branches = reportQuery.data?.offices ?? [];
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
    setApplied({ startDate, endDate, branch, userId, page: 1, limit });
  }

  function goToPage(next: number) {
    setApplied((a) => ({ ...a, page: Math.min(Math.max(1, next), totalPages) }));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadAuthedFile(
        `/api/reports/raw-attendance/export?${buildQuery(applied, false)}`,
        safeReportFilename("raw-attendance", {
          from: applied.startDate,
          to: applied.endDate,
          user: applied.userId && applied.userId !== "all" ? applied.userId : undefined,
          branch: applied.branch || undefined,
          timestamp: true,
        }),
      );
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Could not export CSV.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[17px] font-bold text-[#555] dark:text-zinc-300 uppercase">Raw Attendance Report</h1>
          <Button
            onClick={exportCsv}
            disabled={exporting || reportQuery.isLoading}
            className="h-8 px-4 bg-[#5c7cfa] hover:bg-[#4c6ef5] text-white text-xs rounded-sm"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>

        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                <label className="text-xs font-semibold text-slate-500">Employee</label>
                <RoleGroupedUserSelect
                  grouped={false}
                  users={users}
                  value={userId}
                  onChange={setUserId}
                  extraOptions={[{ value: ALL, label: "All employees" }]}
                  placeholder="All employees"
                  className="h-8 text-xs"
                />
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

            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent bg-[#fdf3db] dark:bg-zinc-900">
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">#</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Date</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Time</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Employee</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Device User ID</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Office</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Device IP</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">State</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Type</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-300 text-left text-xs">Received At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
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
                        No machine punches match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, i) => (
                      <TableRow key={r.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800 transition-colors">
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{(applied.page - 1) * applied.limit + i + 1}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{fmtDate(r.date)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.time || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 font-semibold">{r.employeeName || <span className="text-slate-400 font-normal">Unknown</span>}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.deviceUserId || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.office || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.deviceIp || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.state || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.type || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{r.receivedAt || "-"}</TableCell>
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
