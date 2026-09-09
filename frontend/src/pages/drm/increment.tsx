import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types (match server/services/increment.service.ts shapes) ───────────────
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

const GREEN = "#00a65a";

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

function eligibilityBadge(status: string) {
  const map: Record<string, string> = {
    Eligible: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    "Review Required": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    "Not Eligible": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    "Missing Data": "bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <Badge className={`${map[status] || map["Missing Data"]} border-0 text-[11px] font-medium`}>
      {status}
    </Badge>
  );
}

export default function IncrementPage() {
  const { toast } = useToast();

  // Filter inputs (draft) vs applied (drives the report query)
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ userId: string; startDate: string; endDate: string } | null>(null);

  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  // detail + decision modal state
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [decisionRow, setDecisionRow] = useState<ReportRow | null>(null);

  // ─── Users (grouped) ───────────────────────────────────────────────────────
  const { data: usersData } = useQuery<{ groups: UserGroup[] }>({
    queryKey: ["/api/drm/increment/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/increment/users");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
  const groups = usersData?.groups ?? [];
  const allUsers = useMemo(() => groups.flatMap((g) => g.users), [groups]);
  const selectedUserLabel = useMemo(() => {
    if (selectedUserId === "all") return "All visible employees";
    const u = allUsers.find((x) => x.id === selectedUserId);
    return u ? u.fullName || u.name || u.email || u.id : "Choose...";
  }, [selectedUserId, allUsers]);

  // ─── Report ──────────────────────────────────────────────────────────────-
  const reportQuery = useQuery<ReportResult>({
    queryKey: [
      "/api/drm/increment/report",
      applied?.userId,
      applied?.startDate,
      applied?.endDate,
      page,
      limit,
      search,
    ],
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
  const totalPages = report ? Math.max(1, Math.ceil(report.total / report.limit)) : 1;

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
      <h1 className="text-[16px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">
        Increment
      </h1>

      {/* Filter Card */}
      <Card className="border border-gray-100 shadow-sm rounded-md bg-white mb-6 dark:bg-zinc-900 dark:border-zinc-800">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
            {/* Grouped searchable user select */}
            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Select User</Label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    data-testid="button-select-user"
                    className="h-9 w-full justify-between bg-white text-[13px] font-normal text-gray-600 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                  >
                    <span className="truncate">{selectedUserLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <Command>
                    <CommandInput placeholder="Search employee..." className="text-[13px]" />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all-visible"
                          onSelect={() => {
                            setSelectedUserId("all");
                            setUserPickerOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedUserId === "all" ? "opacity-100" : "opacity-0"}`} />
                          All visible employees
                        </CommandItem>
                      </CommandGroup>
                      {groups.map((g) => (
                        <CommandGroup key={g.roleId} heading={g.roleLabel}>
                          {g.users.map((u) => {
                            const label = u.fullName || u.name || u.email || u.id;
                            return (
                              <CommandItem
                                key={u.id}
                                value={`${label} ${u.email ?? ""} ${u.id}`}
                                onSelect={() => {
                                  setSelectedUserId(u.id);
                                  setUserPickerOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${selectedUserId === u.id ? "opacity-100" : "opacity-0"}`} />
                                <span className="truncate">{label}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
                className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 uppercase dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
              />
            </div>

            <div className="space-y-1.5 flex flex-col">
              <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
                className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 uppercase dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
              />
            </div>
          </div>

          <Button
            onClick={onView}
            data-testid="button-view"
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-[13px] font-medium shadow-none"
          >
            View
          </Button>
        </CardContent>
      </Card>

      {/* Summary chips */}
      {report && (
        <div className="flex flex-wrap gap-3 mb-4 text-[12px]">
          <SummaryChip label="Employees" value={report.summary.totalEmployees} />
          <SummaryChip label="Eligible" value={report.summary.eligibleCount} tone="green" />
          <SummaryChip label="Review Required" value={report.summary.reviewRequiredCount} tone="amber" />
          <SummaryChip label="Not Eligible" value={report.summary.notEligibleCount} tone="red" />
          <SummaryChip label="Missing Data" value={report.summary.missingDataCount} tone="gray" />
        </div>
      )}

      {/* Table */}
      <Card className="border border-gray-100 shadow-sm rounded-md bg-white overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <CardContent className="p-0">
          {/* Toolbar */}
          <div className="p-4 flex flex-wrap gap-3 justify-between items-center bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Show</span>
              <Select
                value={String(limit)}
                onValueChange={(v) => {
                  setLimit(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-8 text-[13px] text-gray-700 dark:text-zinc-400" data-testid="select-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Search:</span>
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                data-testid="input-search"
                className="w-[200px] h-8 text-[13px] border-gray-200 dark:border-zinc-800"
              />
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-[#f4f6f9] border-y border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                  {[
                    "No", "Name", "Salary", "Leaves x Per Day", "Amount", "Total Min", "Relaxation Min",
                    "Increment Min", "Total Leaves", "Increment Leaves", "Full Detail", "Notice",
                    "Last Increment", "Start Date", "Status", "Action",
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!applied && (
                  <tr>
                    <td colSpan={16} className="px-3 py-10 text-center text-[13px] text-gray-500 dark:text-zinc-500">
                      Select an employee and date range, then click <span className="font-semibold">View</span>.
                    </td>
                  </tr>
                )}
                {applied && reportQuery.isLoading && (
                  <tr>
                    <td colSpan={16} className="px-3 py-10 text-center text-[13px] text-gray-500 dark:text-zinc-500">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Calculating increment report...
                    </td>
                  </tr>
                )}
                {applied && reportQuery.isError && (
                  <tr>
                    <td colSpan={16} className="px-3 py-10 text-center text-[13px] text-red-600 dark:text-red-400">
                      {(reportQuery.error as Error)?.message?.includes("403")
                        ? "You are not authorized to view this employee's increment report."
                        : `Failed to load report: ${(reportQuery.error as Error)?.message ?? "Unknown error"}`}
                    </td>
                  </tr>
                )}
                {applied && !reportQuery.isLoading && !reportQuery.isError && report && report.rows.length === 0 && (
                  <tr>
                    <td colSpan={16} className="px-3 py-10 text-center text-[13px] text-gray-500 dark:text-zinc-500">
                      No increment records found for selected employee/date range.
                    </td>
                  </tr>
                )}
                {report?.rows.map((row) => (
                  <tr key={row.employeeId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.no}</td>
                    <td
                      className="px-3 py-3 text-[13px] text-[#00a65a] hover:underline cursor-pointer dark:text-emerald-400"
                      onClick={() => setDetailEmployeeId(row.employeeId)}
                      data-testid={`link-detail-${row.employeeId}`}
                    >
                      {row.name}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">
                      {row.salary === null ? <MissingTag /> : fmtMoney(row.salary)}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{row.leavesPerDayText}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">
                      {row.leaveDeductionAmount === null ? <MissingTag /> : fmtMoney(row.leaveDeductionAmount)}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[#00a65a] dark:text-emerald-400">{row.totalMin}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">
                      {row.missingData?.relaxation ? <MissingTag label={String(row.relaxationMin)} /> : row.relaxationMin}
                    </td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.incrementMin}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{row.totalLeavesText}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.incrementLeaves}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] min-w-[220px] dark:text-zinc-400">{row.fullDetail}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.noticeCount}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{fmtDate(row.lastIncrementDate)}</td>
                    <td className="px-3 py-3 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{fmtDate(row.incrementCycleStartDate)}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">{eligibilityBadge(row.eligibilityStatus)}</td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-[12px] text-[#00a65a] hover:underline dark:text-emerald-400"
                          onClick={() => setDetailEmployeeId(row.employeeId)}
                          data-testid={`button-view-detail-${row.employeeId}`}
                        >
                          View Detail
                        </button>
                        <button
                          className="text-[12px] text-blue-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed dark:text-blue-400"
                          disabled={!row.actionState.canDecide}
                          title={row.actionState.reason ?? "Decide increment"}
                          onClick={() => setDecisionRow(row)}
                          data-testid={`button-decide-${row.employeeId}`}
                        >
                          Decide
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {report && report.total > 0 && (
            <div className="p-4 flex items-center justify-between border-t border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
              <div className="text-[13px] text-[#495057] dark:text-zinc-400">
                Showing {(report.page - 1) * report.limit + 1} to{" "}
                {Math.min(report.page * report.limit, report.total)} of {report.total} entries
              </div>
              <div className="flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <button
                  className="px-3 py-1.5 text-[13px] text-[#6c757d] hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-prev"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-[13px] bg-[#00a65a] text-white">{page}</span>
                <button
                  className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 disabled:opacity-50 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  data-testid="button-next"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <DetailModal
        employeeId={detailEmployeeId}
        startDate={applied?.startDate}
        endDate={applied?.endDate}
        onClose={() => setDetailEmployeeId(null)}
      />

      {/* Decision Modal */}
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
    </div>
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

function SummaryChip({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    default: "bg-white text-[#495057] border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800",
    green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-900",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-900",
    gray: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  };
  return (
    <div className={`px-3 py-1.5 rounded-md border ${tones[tone]} flex items-center gap-2`}>
      <span className="font-semibold">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

// ─── Detail Modal ────────────────────────────────────────────────────────────
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
    <Dialog open={!!employeeId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Increment Detail</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="py-10 text-center text-[13px] text-gray-500">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading detail...
          </div>
        )}
        {isError && (
          <div className="py-10 text-center text-[13px] text-red-600">
            {(error as Error)?.message?.includes("403")
              ? "You are not authorized to view this employee."
              : `Failed to load detail: ${(error as Error)?.message}`}
          </div>
        )}
        {data && (
          <div className="space-y-5 text-[13px]">
            <Section title="Employee">
              <Field label="Name" value={data.employee?.name} />
              <Field label="Employee ID" value={data.employee?.id} />
              <Field label="Email" value={data.employee?.email} />
              <Field label="Role" value={data.employee?.role} />
              <Field label="Department" value={data.employee?.department} />
              <Field label="Joining Date" value={data.employee?.joinDate} missing={!data.employee?.joinDate} />
              <Field label="Attendance ID" value={data.employee?.attendanceId} missing={!data.employee?.attendanceId} />
            </Section>
            <Section title="Salary">
              <Field label="Basic Salary" value={data.salary?.basicSalary} missing={data.salary?.basicSalary === null} money />
              <Field label="Per Day Salary" value={data.salary?.perDaySalary} missing={data.salary?.perDaySalary === null} money />
              <Field label="Leave Deduction" value={data.salary?.leaveDeductionAmount} missing={data.salary?.leaveDeductionAmount === null} money />
              <Field label="Current Increment" value={data.salary?.currentIncrementValue} missing={data.salary?.currentIncrementValue === null} />
              <Field label="Recommended" value={data.salary?.recommendedStatus} />
            </Section>
            <Section title="Attendance / Work Minutes">
              <Field label="Total Working Days" value={data.attendance?.totalWorkingDays} />
              <Field label="Present" value={data.attendance?.presentDays} />
              <Field label="Late" value={data.attendance?.lateDays} />
              <Field label="Half Days" value={data.attendance?.halfDays} />
              <Field label="Absent" value={data.attendance?.absentDays} />
              <Field label="Approved Leave Days" value={data.attendance?.approvedLeaveDays} />
              <Field label="Total Minutes" value={data.workMinutes?.totalMin} />
              <Field label="Relaxation Minutes" value={data.workMinutes?.relaxationMin} missing={data.missingData?.relaxation} />
              <Field label="Increment Minutes" value={data.workMinutes?.incrementMin} />
            </Section>
            <Section title="Leave">
              <Field label="Total Leave Days" value={data.leave?.totalLeaveDays} />
              <Field label="Allowed Leaves" value={data.leave?.allowedLeaves} />
              <Field label="Increment Leaves" value={data.leave?.incrementLeaves} />
              <Field label="Months In Range" value={data.leave?.monthsInRange} />
              <div className="col-span-2 text-[12px] text-gray-500 dark:text-zinc-500 italic">{data.leave?.formula}</div>
            </Section>
            <Section title="Tasks / Performance">
              <Field label="Total Tasks" value={data.taskStats?.totalTasks} />
              <Field label="Pending" value={data.taskStats?.pendingTasks} />
              <Field label="Running" value={data.taskStats?.runningTasks} />
              <Field label="Completed" value={data.taskStats?.completedTasks} />
            </Section>
            <Section title="Notices / Discipline">
              <Field label="Notice Count" value={data.notices?.noticeCount} />
              {Array.isArray(data.notices?.list) && data.notices.list.length > 0 ? (
                <div className="col-span-2 space-y-1">
                  {data.notices.list.map((n: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-gray-100 py-1 dark:border-zinc-800">
                      <span>{n.title ?? "Untitled"}</span>
                      <span className="text-gray-500">{fmtDate(n.assignedAt)} · {n.readStatus ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="col-span-2 text-gray-500 dark:text-zinc-500">No notices in this period.</div>
              )}
            </Section>
            <Section title="Increment History">
              <Field label="Last Increment Date" value={data.incrementHistory?.lastIncrementDate} missing={!data.incrementHistory?.lastIncrementDate} />
              <Field label="Last Type" value={data.incrementHistory?.lastIncrementType} missing={!data.incrementHistory?.lastIncrementType} />
              <Field label="Last Value" value={data.incrementHistory?.lastIncrementValue} missing={data.incrementHistory?.lastIncrementValue === null} />
              <Field label="Cycle Start Date" value={data.incrementHistory?.incrementCycleStartDate} />
              {Array.isArray(data.incrementHistory?.previousDecisions) && data.incrementHistory.previousDecisions.length > 0 && (
                <div className="col-span-2 mt-2 space-y-1">
                  <div className="font-medium text-gray-600 dark:text-zinc-400">Previous Decisions</div>
                  {data.incrementHistory.previousDecisions.map((d: any) => (
                    <div key={d.id} className="flex justify-between border-b border-gray-100 py-1 text-[12px] dark:border-zinc-800">
                      <span>{eligibilityBadge(d.status)} {fmtDate(d.reviewStartDate)} – {fmtDate(d.reviewEndDate)}</span>
                      <span className="text-gray-500">{d.reviewedBy ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            {data.recommendation?.reasons?.length > 0 && (
              <Section title="Recommendation">
                <div className="col-span-2">
                  {eligibilityBadge(data.recommendation.eligibilityStatus)}
                  <ul className="list-disc ml-5 mt-2 text-[12px] text-gray-600 dark:text-zinc-400">
                    {data.recommendation.reasons.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-[#495057] mb-2 dark:text-zinc-300">{title}</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, missing, money }: { label: string; value: any; missing?: boolean; money?: boolean }) {
  let display: React.ReactNode;
  if (missing || value === null || value === undefined || value === "") display = <MissingTag />;
  else if (money) display = fmtMoney(Number(value));
  else display = String(value);
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 dark:text-zinc-500">{label}</span>
      <span className="text-[#495057] text-right dark:text-zinc-300">{display}</span>
    </div>
  );
}

// ─── Decision Modal ──────────────────────────────────────────────────────────
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
  const [status, setStatus] = useState<"APPROVED" | "HOLD" | "REJECTED">("APPROVED");
  const [incType, setIncType] = useState<"amount" | "percentage" | "none">("none");
  const [incValue, setIncValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!row || !startDate || !endDate) throw new Error("Missing context");
      // 1) save a fresh evaluation snapshot
      const saveRes = await apiRequest("POST", "/api/drm/increment/evaluations", {
        employeeId: row.employeeId,
        startDate,
        endDate,
        recommendedStatus: row.eligibilityStatus,
        proposedIncrementType: incType,
        proposedIncrementValue: incValue ? Number(incValue) : null,
        managerRemarks: remarks,
      });
      if (!saveRes.ok) throw new Error(await saveRes.text());
      const saved = await saveRes.json();
      const evalId = saved?.evaluation?.id;
      if (!evalId) throw new Error("Could not create evaluation");
      // 2) apply the decision
      const decRes = await apiRequest("PATCH", `/api/drm/increment/evaluations/${evalId}/decision`, {
        status,
        proposedIncrementType: incType,
        proposedIncrementValue: incValue ? Number(incValue) : null,
        effectiveDate: status === "APPROVED" ? effectiveDate || null : null,
        remarks,
      });
      if (!decRes.ok) throw new Error(await decRes.text());
      return decRes.json();
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
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Increment Decision — {row?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-[13px]">
          <div className="space-y-1.5">
            <Label className="text-[13px]">Decision</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger data-testid="select-decision-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Approve</SelectItem>
                <SelectItem value="HOLD">Hold</SelectItem>
                <SelectItem value="REJECTED">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Proposed Increment Type</Label>
            <Select value={incType} onValueChange={(v) => setIncType(v as any)}>
              <SelectTrigger data-testid="select-increment-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {incType !== "none" && (
            <div className="space-y-1.5">
              <Label className="text-[13px]">{incType === "amount" ? "Amount" : "Percentage"}</Label>
              <Input
                type="number"
                value={incValue}
                onChange={(e) => setIncValue(e.target.value)}
                data-testid="input-increment-value"
              />
            </div>
          )}
          {status === "APPROVED" && (
            <div className="space-y-1.5">
              <Label className="text-[13px]">Effective Date</Label>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                data-testid="input-effective-date"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-[13px]">{status === "REJECTED" ? "Reason" : "Remarks"}</Label>
            <Input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              data-testid="input-remarks"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            onClick={submit}
            disabled={mutation.isPending}
            data-testid="button-submit-decision"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
