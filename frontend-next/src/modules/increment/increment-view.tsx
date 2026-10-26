"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { IncrementShell, DrmSection, DrmFormModal } from "@/modules/increment/increment-ui";

interface ApiUser {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
  roleId: string | null;
  department: string | null;
}
interface UserGroup {
  roleId: string;
  roleLabel: string;
  users: ApiUser[];
}
interface ReportRow {
  no: number;
  employeeId: string;
  name: string;
  salary: number | null;
  leavesPerDayText: string;
  leaveDeductionAmount: number | null;
  totalMin: number;
  relaxationMin: number;
  incrementMin: number;
  totalLeavesText: string;
  incrementLeaves: number;
  fullDetail: string;
  noticeCount: number;
  lastIncrementDate: string | null;
  incrementCycleStartDate: string | null;
  eligibilityStatus: string;
  missingData: Record<string, boolean>;
  actionState: { canDecide: boolean; reason: string | null };
}
interface ReportResult {
  dateRange: { startDate: string; endDate: string };
  summary: {
    totalEmployees: number;
    eligibleCount: number;
    reviewRequiredCount: number;
    notEligibleCount: number;
    missingDataCount: number;
  };
  rows: ReportRow[];
  page: number;
  limit: number;
  total: number;
}

function fmtMoney(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString();
}
function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const ELIGIBILITY_TONE: Record<string, string> = {
  Eligible: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Review Required": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "Not Eligible": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "Missing Data": "bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function EligibilityBadge({ status }: { status: string }) {
  return (
    <Badge variant="neutral" className={`${ELIGIBILITY_TONE[status] || ELIGIBILITY_TONE["Missing Data"]} normal-case tracking-normal`}>
      {status}
    </Badge>
  );
}

function MissingTag({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label !== undefined && <span>{label}</span>}
      <span className="text-[10px] uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded dark:bg-amber-900/30 dark:text-amber-300">
        Missing
      </span>
    </span>
  );
}

const SUMMARY_TONES: Record<string, string> = {
  default: "bg-white text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900",
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900",
  gray: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
};

function SummaryChip({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-md border text-xs ${SUMMARY_TONES[tone]} flex items-center gap-2`}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

export function IncrementPage() {
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ userId: string; startDate: string; endDate: string } | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [decisionRow, setDecisionRow] = useState<ReportRow | null>(null);

  const { data: usersData, isError: usersIsError, error: usersError } = useQuery<{ groups: UserGroup[] }>({
    queryKey: ["/api/drm/increment/users"],
    retry: false,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/increment/users");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const groups = Array.isArray(usersData?.groups) ? usersData.groups : [];
  const allUsers = useMemo(() => groups.flatMap((g) => g.users), [groups]);

  const reportQuery = useQuery<ReportResult>({
    queryKey: ["/api/drm/increment/report", applied?.userId, applied?.startDate, applied?.endDate, page, limit, search],
    enabled: !!applied,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("userId", applied!.userId);
      p.set("startDate", applied!.startDate);
      p.set("endDate", applied!.endDate);
      p.set("page", String(page));
      p.set("limit", String(limit));
      if (search) p.set("search", search);
      const res = await apiRequest("GET", `/api/drm/increment/report?${p.toString()}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Request failed (${res.status})`);
      }
      return res.json();
    },
  });

  function onView() {
    if (!startDate || !endDate) {
      toast({ title: "Missing dates", description: "Please select both a start and end date.", variant: "destructive" });
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast({ title: "Invalid range", description: "Start date must be on or before end date.", variant: "destructive" });
      return;
    }
    setPage(1);
    setApplied({ userId: selectedUserId, startDate, endDate });
  }

  const report = reportQuery.data;

  if (usersIsError && String((usersError as Error)?.message ?? "").includes("under development")) {
    return (
      <IncrementShell title="Increment">
        <DrmSection title="Increment">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">This feature is under development</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            Increment Management is being rebuilt and isn&apos;t available yet. Please check back soon.
          </p>
        </DrmSection>
      </IncrementShell>
    );
  }

  const errorMessage = reportQuery.isError
    ? (reportQuery.error as Error)?.message?.includes("403")
      ? "You are not authorized to view this employee's increment report."
      : `Failed to load report: ${(reportQuery.error as Error)?.message ?? "Unknown error"}`
    : null;

  const columns: DataTableColumn<ReportRow>[] = [
    { id: "no", header: "No", cell: (r) => r.no },
    {
      id: "name",
      header: "Name",
      cell: (r) => (
        <button
          type="button"
          className="text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={() => setDetailEmployeeId(r.employeeId)}
        >
          {r.name}
        </button>
      ),
    },
    { id: "salary", header: "Salary", cell: (r) => (r.salary === null ? <MissingTag /> : fmtMoney(r.salary)) },
    { id: "leavesPerDay", header: "Leaves x Per Day", cell: (r) => <span className="whitespace-nowrap">{r.leavesPerDayText}</span> },
    { id: "amount", header: "Amount", cell: (r) => (r.leaveDeductionAmount === null ? <MissingTag /> : fmtMoney(r.leaveDeductionAmount)) },
    { id: "totalMin", header: "Total Min", cell: (r) => <span className="text-emerald-700 dark:text-emerald-400">{r.totalMin}</span> },
    { id: "relaxationMin", header: "Relaxation Min", cell: (r) => (r.missingData?.relaxation ? <MissingTag label={String(r.relaxationMin)} /> : r.relaxationMin) },
    { id: "incrementMin", header: "Increment Min", cell: (r) => r.incrementMin },
    { id: "totalLeaves", header: "Total Leaves", cell: (r) => <span className="whitespace-nowrap">{r.totalLeavesText}</span> },
    { id: "incrementLeaves", header: "Increment Leaves", cell: (r) => r.incrementLeaves },
    { id: "fullDetail", header: "Full Detail", cell: (r) => <span className="min-w-[220px] inline-block">{r.fullDetail}</span> },
    { id: "notice", header: "Notice", cell: (r) => r.noticeCount },
    { id: "lastIncrement", header: "Last Increment", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.lastIncrementDate)}</span> },
    { id: "startDate", header: "Start Date", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.incrementCycleStartDate)}</span> },
    { id: "status", header: "Status", cell: (r) => <EligibilityBadge status={r.eligibilityStatus} /> },
    {
      id: "action",
      header: "Action",
      cell: (r) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button type="button" className="text-xs text-emerald-700 hover:underline dark:text-emerald-400" onClick={() => setDetailEmployeeId(r.employeeId)}>
            View Detail
          </button>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed dark:text-blue-400"
            disabled={!r.actionState.canDecide}
            title={r.actionState.reason ?? "Decide increment"}
            onClick={() => setDecisionRow(r)}
          >
            Decide
          </button>
        </div>
      ),
    },
  ];

  return (
    <IncrementShell title="Increment">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field id="inc-user" label="Select User">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="inc-user">
                <SelectValue placeholder="Choose..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visible employees</SelectItem>
                {groups.map((g) => (
                  <SelectGroup key={g.roleId}>
                    <SelectLabel>{g.roleLabel}</SelectLabel>
                    {g.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.name || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="inc-start" label="Start Date">
            <Input id="inc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="inc-end" label="End Date">
            <Input id="inc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={onView}>View</Button>
        </div>
      </DrmSection>

      {report && (
        <div className="flex flex-wrap gap-3">
          <SummaryChip label="Employees" value={report.summary.totalEmployees} />
          <SummaryChip label="Eligible" value={report.summary.eligibleCount} tone="green" />
          <SummaryChip label="Review Required" value={report.summary.reviewRequiredCount} tone="amber" />
          <SummaryChip label="Not Eligible" value={report.summary.notEligibleCount} tone="red" />
          <SummaryChip label="Missing Data" value={report.summary.missingDataCount} tone="gray" />
        </div>
      )}

      <DrmSection title="Report">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Show</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="font-medium">entries</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Search:</span>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-[200px]" />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={report?.rows ?? []}
          rowKey={(r) => r.employeeId}
          loading={!!applied && reportQuery.isLoading}
          error={errorMessage}
          onRetry={() => reportQuery.refetch()}
          emptyMessage={!applied ? "Select an employee and date range, then click View." : "No increment records found for selected employee/date range."}
          className="min-w-[1300px]"
        />

        {report && report.total > 0 && (
          <PaginationBar page={report.page} pageSize={report.limit} total={report.total} onPageChange={setPage} className="mt-4" />
        )}
      </DrmSection>

      <DetailModal
        employeeId={detailEmployeeId}
        startDate={applied?.startDate}
        endDate={applied?.endDate}
        onClose={() => setDetailEmployeeId(null)}
      />

      <DecisionModal
        row={decisionRow}
        startDate={applied?.startDate}
        endDate={applied?.endDate}
        onClose={() => setDecisionRow(null)}
        onDone={() => {
          setDecisionRow(null);
          reportQuery.refetch();
        }}
      />
    </IncrementShell>
  );
}

function DetailModal({
  employeeId,
  startDate,
  endDate,
  onClose,
}: {
  employeeId: string | null;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}) {
  const enabled = !!employeeId && !!startDate && !!endDate;
  const { data, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/drm/increment/report", employeeId, "detail", startDate, endDate],
    enabled,
    queryFn: async () => {
      const p = new URLSearchParams({ startDate: startDate!, endDate: endDate! });
      const res = await apiRequest("GET", `/api/drm/increment/report/${employeeId}/detail?${p.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  return (
    <DrmFormModal open={!!employeeId} title="Increment Detail" onClose={onClose} size="xl">
      <div className="max-h-[70vh] overflow-y-auto">
        {isLoading && <p className="py-10 text-center text-sm text-zinc-500">Loading detail...</p>}
        {isError && (
          <p className="py-10 text-center text-sm text-red-600">
            {(error as Error)?.message?.includes("403")
              ? "You are not authorized to view this employee."
              : `Failed to load detail: ${(error as Error)?.message}`}
          </p>
        )}
        {data && (
          <div className="space-y-5 text-sm">
            <DetailSection title="Employee">
              <DetailRow label="Name" value={data.employee?.name} />
              <DetailRow label="Employee ID" value={data.employee?.id} />
              <DetailRow label="Email" value={data.employee?.email} />
              <DetailRow label="Role" value={data.employee?.role} />
              <DetailRow label="Department" value={data.employee?.department} />
              <DetailRow label="Joining Date" value={data.employee?.joinDate} missing={!data.employee?.joinDate} />
              <DetailRow label="Attendance ID" value={data.employee?.attendanceId} missing={!data.employee?.attendanceId} />
            </DetailSection>
            <DetailSection title="Salary">
              <DetailRow label="Basic Salary" value={data.salary?.basicSalary} missing={data.salary?.basicSalary === null} money />
              <DetailRow label="Per Day Salary" value={data.salary?.perDaySalary} missing={data.salary?.perDaySalary === null} money />
              <DetailRow label="Leave Deduction" value={data.salary?.leaveDeductionAmount} missing={data.salary?.leaveDeductionAmount === null} money />
              <DetailRow label="Current Increment" value={data.salary?.currentIncrementValue} missing={data.salary?.currentIncrementValue === null} />
              <DetailRow label="Recommended" value={data.salary?.recommendedStatus} />
            </DetailSection>
            <DetailSection title="Attendance / Work Minutes">
              <DetailRow label="Total Working Days" value={data.attendance?.totalWorkingDays} />
              <DetailRow label="Present" value={data.attendance?.presentDays} />
              <DetailRow label="Late" value={data.attendance?.lateDays} />
              <DetailRow label="Half Days" value={data.attendance?.halfDays} />
              <DetailRow label="Absent" value={data.attendance?.absentDays} />
              <DetailRow label="Approved Leave Days" value={data.attendance?.approvedLeaveDays} />
              <DetailRow label="Total Minutes" value={data.workMinutes?.totalMin} />
              <DetailRow label="Relaxation Minutes" value={data.workMinutes?.relaxationMin} missing={data.missingData?.relaxation} />
              <DetailRow label="Increment Minutes" value={data.workMinutes?.incrementMin} />
            </DetailSection>
            <DetailSection title="Leave">
              <DetailRow label="Total Leave Days" value={data.leave?.totalLeaveDays} />
              <DetailRow label="Allowed Leaves" value={data.leave?.allowedLeaves} />
              <DetailRow label="Increment Leaves" value={data.leave?.incrementLeaves} />
              <DetailRow label="Months In Range" value={data.leave?.monthsInRange} />
              <div className="col-span-2 text-xs italic text-zinc-500 dark:text-zinc-500">{data.leave?.formula}</div>
            </DetailSection>
            <DetailSection title="Tasks / Performance">
              <DetailRow label="Total Tasks" value={data.taskStats?.totalTasks} />
              <DetailRow label="Pending" value={data.taskStats?.pendingTasks} />
              <DetailRow label="Running" value={data.taskStats?.runningTasks} />
              <DetailRow label="Completed" value={data.taskStats?.completedTasks} />
            </DetailSection>
            <DetailSection title="Notices / Discipline">
              <DetailRow label="Notice Count" value={data.notices?.noticeCount} />
              {Array.isArray(data.notices?.list) && data.notices.list.length > 0 ? (
                <div className="col-span-2 space-y-1">
                  {data.notices.list.map((n: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-800">
                      <span>{n.title ?? "Untitled"}</span>
                      <span className="text-zinc-500">{fmtDate(n.assignedAt)} · {n.readStatus ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="col-span-2 text-zinc-500 dark:text-zinc-500">No notices in this period.</div>
              )}
            </DetailSection>
            <DetailSection title="Increment History">
              <DetailRow label="Last Increment Date" value={data.incrementHistory?.lastIncrementDate} missing={!data.incrementHistory?.lastIncrementDate} />
              <DetailRow label="Last Type" value={data.incrementHistory?.lastIncrementType} missing={!data.incrementHistory?.lastIncrementType} />
              <DetailRow label="Last Value" value={data.incrementHistory?.lastIncrementValue} missing={data.incrementHistory?.lastIncrementValue === null} />
              <DetailRow label="Cycle Start Date" value={data.incrementHistory?.incrementCycleStartDate} />
              {Array.isArray(data.incrementHistory?.previousDecisions) && data.incrementHistory.previousDecisions.length > 0 && (
                <div className="col-span-2 mt-2 space-y-1">
                  <div className="font-medium text-zinc-600 dark:text-zinc-400">Previous Decisions</div>
                  {data.incrementHistory.previousDecisions.map((d: any) => (
                    <div key={d.id} className="flex justify-between border-b border-zinc-100 py-1 text-xs dark:border-zinc-800">
                      <span><EligibilityBadge status={d.status} /> {fmtDate(d.reviewStartDate)} – {fmtDate(d.reviewEndDate)}</span>
                      <span className="text-zinc-500">{d.reviewedBy ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
            {data.recommendation?.reasons?.length > 0 && (
              <DetailSection title="Recommendation">
                <div className="col-span-2">
                  <EligibilityBadge status={data.recommendation.eligibilityStatus} />
                  <ul className="ml-5 mt-2 list-disc text-xs text-zinc-600 dark:text-zinc-400">
                    {data.recommendation.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </DetailSection>
            )}
          </div>
        )}
      </div>
    </DrmFormModal>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, missing, money }: { label: string; value: any; missing?: boolean; money?: boolean }) {
  let display: React.ReactNode;
  if (missing || value === null || value === undefined || value === "") display = <MissingTag />;
  else if (money) display = fmtMoney(Number(value));
  else display = String(value);
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500 dark:text-zinc-500">{label}</span>
      <span className="text-right text-zinc-700 dark:text-zinc-300">{display}</span>
    </div>
  );
}

function DecisionModal({
  row,
  startDate,
  endDate,
  onClose,
  onDone,
}: {
  row: ReportRow | null;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"APPROVED" | "HOLD" | "REJECTED">("APPROVED");
  const [incType, setIncType] = useState<"amount" | "percentage" | "none">("none");
  const [incValue, setIncValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || !startDate || !endDate) throw new Error("Missing context");
      const saved = await mutationRequest<{ evaluation?: { id?: string } }>("POST", "/api/drm/increment/evaluations", {
        employeeId: row.employeeId,
        startDate,
        endDate,
        recommendedStatus: row.eligibilityStatus,
        proposedIncrementType: incType,
        proposedIncrementValue: incValue ? Number(incValue) : null,
        managerRemarks: remarks,
      });
      const evalId = saved?.evaluation?.id;
      if (!evalId) throw new Error("Could not create evaluation");
      return mutationRequest("PATCH", `/api/drm/increment/evaluations/${evalId}/decision`, {
        status,
        proposedIncrementType: incType,
        proposedIncrementValue: incValue ? Number(incValue) : null,
        effectiveDate: status === "APPROVED" ? effectiveDate || null : null,
        remarks,
      });
    },
    onSuccess: () => {
      toast({ title: "Decision saved", description: `Increment ${status.toLowerCase()} for ${row?.name}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/drm/increment/report"] });
      onDone();
    },
    onError: (e: any) => {
      toast({
        title: "Could not save decision",
        description: String(e?.message ?? "").includes("403") ? "You are not authorized to decide this increment." : String(e?.message),
        variant: "destructive",
      });
    },
  });

  function submit() {
    if (status === "APPROVED" && !effectiveDate) {
      toast({ title: "Effective date required", description: "Approved increments need an effective date.", variant: "destructive" });
      return;
    }
    if (status === "REJECTED" && !remarks.trim()) {
      toast({ title: "Reason required", description: "Please add a reason for rejection.", variant: "destructive" });
      return;
    }
    mutation.mutate();
  }

  return (
    <DrmFormModal
      open={!!row}
      title={`Increment Decision — ${row?.name ?? ""}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} aria-busy={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Decision"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <Field id="dec-status" label="Decision">
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger id="dec-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="APPROVED">Approve</SelectItem>
              <SelectItem value="HOLD">Hold</SelectItem>
              <SelectItem value="REJECTED">Reject</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field id="dec-type" label="Proposed Increment Type">
          <Select value={incType} onValueChange={(v) => setIncType(v as any)}>
            <SelectTrigger id="dec-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {incType !== "none" && (
          <Field id="dec-value" label={incType === "amount" ? "Amount" : "Percentage"}>
            <Input id="dec-value" type="number" value={incValue} onChange={(e) => setIncValue(e.target.value)} />
          </Field>
        )}
        {status === "APPROVED" && (
          <Field id="dec-effective" label="Effective Date">
            <Input id="dec-effective" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </Field>
        )}
        <Field id="dec-remarks" label={status === "REJECTED" ? "Reason" : "Remarks"}>
          <Input id="dec-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
    </DrmFormModal>
  );
}
