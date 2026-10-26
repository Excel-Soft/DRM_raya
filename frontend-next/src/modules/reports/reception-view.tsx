"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { buildFileName } from "@/lib/export/export-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type ReceptionRow = {
  id: string;
  meeting_type: string | null;
  person_name: string | null;
  status: string | null;
  meeting_date: string | null;
  start_time: string | null;
  end_time: string | null;
  total_duration_seconds: number | null;
  company_name: string | null;
  receptionist_name: string | null;
};
type TeamSummaryRow = { receptionist_id: string; receptionist_name: string | null; total_meetings: number; total_duration_seconds: number; total_gm: number };

const STATUS_OPTIONS = ["expected", "in_progress", "ended"] as const;

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}
function fmtTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(11, 16);
  return value;
}
function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function buildParams(applied: { startDate: string; endDate: string; month: string; status: string; user: string; company: string; branch: string }): URLSearchParams {
  const params = new URLSearchParams();
  if (applied.user !== "all") params.set("userId", applied.user);
  if (applied.status !== "all") params.set("status", applied.status);
  if (applied.startDate) params.set("startDate", applied.startDate);
  if (applied.endDate) params.set("endDate", applied.endDate);
  if (applied.month) params.set("month", applied.month);
  if (applied.company.trim()) params.set("company", applied.company.trim());
  if (applied.branch.trim()) params.set("branch", applied.branch.trim());
  return params;
}

export function ReceptionReportPage() {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState("Reception Report");
  const [monthWise, setMonthWise] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "team">("list");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("all");
  const [user, setUser] = useState("all");
  const [company, setCompany] = useState("");
  const [branch, setBranch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [applied, setApplied] = useState<{ startDate: string; endDate: string; month: string; status: string; user: string; company: string; branch: string } | null>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const usersByRole = useMemo(() => {
    const acc: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const roleKey = u.role || "Other";
      (acc[roleKey] ||= []).push(u);
    });
    return acc;
  }, [users]);

  const handleSelectOption = (value: string) => {
    setSelectedOption(value);
    if (value === "Reception Report") {
      setViewMode("list");
      setUser("all");
    } else if (value === "All Team") {
      setViewMode("team");
      setUser("all");
    } else {
      setViewMode("list");
      setUser(value);
    }
  };

  const isSpecificUser = selectedOption !== "Reception Report" && selectedOption !== "All Team";
  const showMonthlyBlocked = monthWise && isSpecificUser;

  const report = useQuery<{ data: ReceptionRow[]; total: number; pageSize: number }>({
    queryKey: ["/api/reports/reception", applied, page],
    enabled: !!applied && viewMode === "list" && !showMonthlyBlocked,
    queryFn: async () => {
      const params = buildParams(applied!);
      params.set("page", String(page));
      params.set("pageSize", "50");
      const res = await apiRequest("GET", `/api/reports/reception?${params}`);
      if (!res.ok) throw new Error("Failed to load reception report.");
      return res.json();
    },
  });

  const teamSummary = useQuery<{ data: TeamSummaryRow[] }>({
    queryKey: ["/api/reports/reception/team-summary", applied?.startDate, applied?.endDate],
    enabled: !!applied && viewMode === "team" && !!applied.startDate && !!applied.endDate,
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: applied!.startDate, endDate: applied!.endDate });
      const res = await apiRequest("GET", `/api/reports/reception/team-summary?${params}`);
      if (!res.ok) throw new Error("Failed to load team summary.");
      return res.json();
    },
  });

  const handleView = () => {
    setPage(1);
    setApplied({ startDate, endDate, month, status, user, company, branch });
  };

  const handleExport = async () => {
    if (!applied) return;
    setExporting(true);
    try {
      await downloadAuthedFile(`/api/reports/reception/export?${buildParams(applied)}`, buildFileName("reception_report", "csv"));
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Could not export the reception report.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const rows = report.data?.data ?? [];
  const total = report.data?.total ?? 0;
  const pageSize = report.data?.pageSize ?? 50;

  const listColumns = useMemo((): DataTableColumn<ReceptionRow>[] => [
    { id: "company", header: "Company", cell: (r) => r.company_name || "-" },
    { id: "person", header: "Person", cell: (r) => r.person_name || "-" },
    { id: "receptionist", header: "Receptionist", cell: (r) => r.receptionist_name || "-" },
    { id: "type", header: "Meeting Type", cell: (r) => r.meeting_type || "-" },
    { id: "date", header: "Date", cell: (r) => fmtDate(r.meeting_date) },
    { id: "start", header: "Start", cell: (r) => fmtTime(r.start_time) },
    { id: "end", header: "End", cell: (r) => fmtTime(r.end_time) },
    { id: "duration", header: "Duration", cell: (r) => fmtDuration(r.total_duration_seconds) },
    { id: "status", header: "Status", cell: (r) => r.status || "-" },
  ], []);

  const teamColumns = useMemo((): DataTableColumn<TeamSummaryRow>[] => [
    { id: "name", header: "Meeting By", cell: (r) => r.receptionist_name || "-" },
    { id: "total", header: "Total Meeting", cell: (r) => r.total_meetings },
    { id: "time", header: "Total Time", cell: (r) => fmtDuration(r.total_duration_seconds) },
    { id: "gm", header: "Total Gm", cell: (r) => r.total_gm },
  ], []);

  return (
    <ReportsShell title="Reception Report">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field id="rc-option" label="Select User">
            <Select value={selectedOption} onValueChange={handleSelectOption}>
              <SelectTrigger id="rc-option">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="Reception Report">Reception Report</SelectItem>
                <SelectItem value="All Team">All Team</SelectItem>
                {Object.entries(usersByRole).map(([role, roleUsers]) => (
                  <SelectGroup key={role}>
                    <SelectLabel>{role}</SelectLabel>
                    {(roleUsers as any[]).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <input type="checkbox" checked={monthWise} onChange={(e) => setMonthWise(e.target.checked)} /> Month Wise
            </label>
          </Field>
          {viewMode === "list" ? (
            <Field id="rc-status" label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="rc-status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUS_OPTIONS.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="rc-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="rc-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field id="rc-month" label="Month">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </Field>
          {viewMode === "list" ? (
            <>
              <Field id="rc-company" label="Company">
                <Input value={company} placeholder="Filter by company…" onChange={(e) => setCompany(e.target.value)} />
              </Field>
              <Field id="rc-branch" label="Branch">
                <Input value={branch} placeholder="Filter by branch…" onChange={(e) => setBranch(e.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" variant="primary" onClick={handleView}>
            View
          </Button>
          {viewMode === "list" ? (
            <Button type="button" variant="secondary" disabled={!applied || exporting} onClick={handleExport}>
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          ) : null}
        </div>
      </DrmSection>

      <DrmSection title={showMonthlyBlocked ? "Monthly Achievement" : viewMode === "team" ? "All Team Summary" : "View Reception Report"}>
        {showMonthlyBlocked ? (
          <p className="mx-auto max-w-xl py-10 text-center text-sm text-zinc-500">
            The monthly tiered commission calculator isn't available yet — it needs a payments-received record tied to a specific user, which doesn't exist in this system yet. Uncheck
            &quot;Month Wise&quot; to see this user&apos;s meeting list instead.
          </p>
        ) : viewMode === "list" ? (
          <>
            <DataTable
              columns={listColumns}
              rows={rows}
              rowKey={(row) => row.id}
              loading={!!applied && report.isLoading}
              error={report.isError ? "Could not load the reception report. Please try again." : null}
              onRetry={() => report.refetch()}
              emptyMessage={applied ? "No reception records found." : "Set your filters and click View to load the reception report."}
              className="min-w-[1000px]"
            />
            {applied && total > 0 ? <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} className="mt-4" /> : null}
          </>
        ) : (
          <DataTable
            columns={teamColumns}
            rows={teamSummary.data?.data ?? []}
            rowKey={(row) => row.receptionist_id}
            loading={!!applied && teamSummary.isLoading}
            error={teamSummary.isError ? "Could not load the team summary. Please try again." : null}
            onRetry={() => teamSummary.refetch()}
            emptyMessage={applied ? "No reception meetings found for this period." : "Set your date range and click View to load the team summary."}
            className="min-w-[700px]"
          />
        )}
      </DrmSection>
    </ReportsShell>
  );
}
