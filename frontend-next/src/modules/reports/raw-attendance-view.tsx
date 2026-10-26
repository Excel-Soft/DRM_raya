"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { buildFileName } from "@/lib/export/export-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type RawRow = {
  id: string;
  employeeName: string | null;
  branch: string | null;
  department: string | null;
  date: string | null;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
  workingMinutes: number | null;
  isLate: boolean;
  remarks: string | null;
};

type RawResponse = { rows: RawRow[]; total: number };
type UserListItem = { id: string; name: string | null; branch: string | null };

const STATUSES = ["Present", "Absent", "Late", "HalfDay", "Leave"];
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
  if (a.branch !== ALL) p.set("branch", a.branch);
  if (a.department.trim()) p.set("department", a.department.trim());
  if (a.userId !== ALL) p.set("userId", a.userId);
  if (a.attendanceStatus !== ALL) p.set("attendanceStatus", a.attendanceStatus);
  if (includePaging) {
    p.set("page", String(a.page));
    p.set("limit", String(a.limit));
  }
  return p.toString();
}

export function RawAttendanceReportPage() {
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

  const usersQuery = useQuery<UserListItem[]>({
    queryKey: ["/api/reports/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reports/users-list");
      if (!res.ok) return [];
      return res.json();
    },
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
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/raw-attendance?${buildQuery(applied, true)}`);
      if (!res.ok) throw new Error("Failed to fetch raw attendance");
      return res.json();
    },
    retry: 1,
  });

  const rows = reportQuery.data?.rows ?? [];
  const total = reportQuery.data?.total ?? 0;

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

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadAuthedFile(`/api/reports/raw-attendance/export?${buildQuery(applied, false)}`, buildFileName("raw_attendance", "csv"));
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Could not export CSV.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const columns = useMemo((): DataTableColumn<RawRow>[] => [
    { id: "date", header: "Date", cell: (r) => fmtDate(r.date) },
    { id: "employee", header: "Employee", cell: (r) => <span className="font-semibold">{r.employeeName || "-"}</span> },
    { id: "branch", header: "Branch", cell: (r) => r.branch || "-" },
    { id: "dept", header: "Department", cell: (r) => r.department || "-" },
    { id: "status", header: "Status", cell: (r) => r.status || "-" },
    { id: "in", header: "Check In", cell: (r) => fmtTime(r.checkIn) },
    { id: "out", header: "Check Out", cell: (r) => fmtTime(r.checkOut) },
    { id: "worked", header: "Worked (min)", cell: (r) => r.workingMinutes ?? "-" },
    {
      id: "late",
      header: "Late",
      cell: (r) =>
        r.isLate ? (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">Late</span>
        ) : (
          <span className="text-xs text-zinc-400">-</span>
        ),
    },
    { id: "remarks", header: "Remarks", cell: (r) => <span className="line-clamp-1 max-w-[240px]" title={r.remarks || ""}>{r.remarks || "-"}</span> },
  ], []);

  return (
    <ReportsShell
      title="Raw Attendance Report"
      actions={
        <Button type="button" variant="primary" disabled={exporting || reportQuery.isLoading} onClick={exportCsv}>
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      }
    >
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Field id="ra-start" label="Start date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="ra-end" label="End date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field id="ra-branch" label="Branch">
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger id="ra-branch">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ra-dept" label="Department">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Any" />
          </Field>
          <Field id="ra-employee" label="Employee">
            <Select value={userId} onValueChange={setUserId} disabled={users.length === 0}>
              <SelectTrigger id="ra-employee">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ra-status" label="Status">
            <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
              <SelectTrigger id="ra-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" variant="primary" onClick={applyFilters}>
              View
            </Button>
            <span className="text-xs text-zinc-400">{reportQuery.isFetching ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Per page
            <select
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </DrmSection>

      <DrmSection title="Records">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={reportQuery.isLoading}
          error={reportQuery.isError ? "Could not load the raw attendance report." : null}
          onRetry={() => reportQuery.refetch()}
          emptyMessage="No attendance records match these filters."
          className="min-w-[1200px]"
        />
        {total > 0 ? (
          <PaginationBar page={applied.page} pageSize={applied.limit} total={total} onPageChange={(page) => setApplied((a) => ({ ...a, page }))} className="mt-4" />
        ) : null}
      </DrmSection>
    </ReportsShell>
  );
}
