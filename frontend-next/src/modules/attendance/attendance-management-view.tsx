"use client";

import { useState } from "react";
import { CalendarIcon, Search, Loader2, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInCalendarDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/legacy/select";

import { isManagerialRole } from "@/lib/auth/role-utils";
import {
  AttendanceActionButton,
  AttendanceShell,
  AttendanceStatCard,
  AttendanceTabBar,
  AttendanceTable,
  AttendanceToolbar,
  DrmSection,
  attSelectTriggerClass,
  attTableBodyCellClass,
  attTableBodyRowClass,
  attTableHeadCellClass,
  attTableHeadRowClass,
  drmFieldClass,
} from "@/modules/attendance/attendance-ui";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const SELF_ATTENDANCE_VALUE = "__self__";

export function AttendanceManagementView() {
  const user = {
    userId: sessionStorage.getItem("userId") || "",
    fullName: sessionStorage.getItem("userName") || "",
    roleId: sessionStorage.getItem("userRole") || ""
  };
  const [activeTab, setActiveTab] = useState("daily");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.userId || "");
  const [paymentStatuses, setPaymentStatuses] = useState<Record<number, boolean>>({});

  const handlePaymentToggle = (idx: number) => {
    setPaymentStatuses(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const isManager = isManagerialRole(user?.roleId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Today's check-in/check-out status — always for the logged-in user
  // themselves, independent of whichever employee a manager has selected
  // in the dropdown above (you can only check yourself in/out).
  const { data: todayData, isLoading: isLoadingToday } = useQuery<{ record: any | null }>({
    queryKey: ["/api/attendance/today"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/attendance/today");
      return res.json();
    },
  });
  const todayRecord = todayData?.record || null;

  const checkInMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/attendance/check-in", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"], exact: false });
      toast({ title: "Checked in" });
    },
    onError: () => {
      toast({ title: "Failed to check in", variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/attendance/check-out", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"], exact: false });
      toast({ title: "Checked out" });
    },
    onError: () => {
      toast({ title: "Failed to check out", variant: "destructive" });
    },
  });

  // Fetch users for manager dropdown
  const { data: usersData = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      return data.users || [];
    },
    enabled: isManager,
  });

  // Fetch Attendance Records (Daily)
  const { data: attendanceData, isLoading: isLoadingAttendance, isError: isErrorAttendance, error: errorAttendance, refetch: refetchAttendance } = useQuery<any>({
    queryKey: ["/api/attendance", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);

      const res = await apiRequest("GET", `/api/attendance?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to fetch attendance records");
      return body;
    }
  });

  // Fetch Summary
  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary, refetch: refetchSummary } = useQuery<any>({
    queryKey: ["/api/attendance/summary", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);

      const res = await apiRequest("GET", `/api/attendance/summary?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to fetch attendance summary");
      return body;
    }
  });

  // Fetch Salary Details
  const { data: salaryData, isLoading: isLoadingSalary, isError: isErrorSalary, error: errorSalary, refetch: refetchSalary } = useQuery<any>({
    queryKey: ["/api/attendance/salary", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);

      const res = await apiRequest("GET", `/api/attendance/salary?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed to fetch salary details");
      return body;
    }
  });

  // Fetch Leave Requests (Annual Leaves) — always the logged-in user's own,
  // there is no manager "view employee X's leaves" endpoint today.
  const { data: leaveRequestsData, isLoading: isLoadingLeaves } = useQuery<any[]>({
    queryKey: ["/api/leave"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/leave");
      return res.json();
    },
    enabled: activeTab === "annual",
  });

  const records = attendanceData?.records || [];
  const summary = summaryData?.summary ? (Array.isArray(summaryData.summary) ? summaryData.summary : [summaryData.summary]) : [];
  const salaryDetails = salaryData?.salaryDetails ? (Array.isArray(salaryData.salaryDetails) ? salaryData.salaryDetails : [salaryData.salaryDetails]) : [];

  const currentYear = new Date().getFullYear();
  const leaveRequestsThisYear = (leaveRequestsData || []).filter(
    (lr: any) => new Date(lr.fromDate).getFullYear() === currentYear
  );
  const leaveDaySpan = (lr: any) => differenceInCalendarDays(new Date(lr.toDate), new Date(lr.fromDate)) + 1;
  const availedLeaveDays = leaveRequestsThisYear
    .filter((lr: any) => lr.status === "Approved")
    .reduce((sum: number, lr: any) => sum + leaveDaySpan(lr), 0);
  const pendingLeaveRequests = leaveRequestsThisYear.filter((lr: any) => lr.status === "Pending").length;

  const managerSelect = isManager ? (
    <div className="w-full min-w-[14rem] sm:w-64">
      <Select
        value={selectedUserId || SELF_ATTENDANCE_VALUE}
        onValueChange={(v) => setSelectedUserId(v === SELF_ATTENDANCE_VALUE ? "" : v)}
      >
        <SelectTrigger className={cn(drmFieldClass, "h-9 w-full text-sm")}>
          <SelectValue placeholder="Select employee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELF_ATTENDANCE_VALUE}>My attendance</SelectItem>
          {usersData.filter((u) => u.id !== user?.userId).map((u: any) => (
            <SelectItem key={u.id} value={u.id}>
              {u.fullName || u.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ) : null;

  const todayStatus = isLoadingToday
    ? "Loading status…"
    : todayRecord?.timeIn && todayRecord?.timeOut
      ? `Checked in at ${format(new Date(todayRecord.timeIn), "hh:mm a")} · checked out at ${format(new Date(todayRecord.timeOut), "hh:mm a")}`
      : todayRecord?.timeIn
        ? `Checked in at ${format(new Date(todayRecord.timeIn), "hh:mm a")} · not checked out yet`
        : "You haven't checked in today.";

  const checkInActions =
    todayRecord?.timeIn && todayRecord?.timeOut ? (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" /> Day complete
      </span>
    ) : todayRecord?.timeIn ? (
      <AttendanceActionButton
        disabled={checkOutMutation.isPending}
        onClick={() => checkOutMutation.mutate()}
        className="bg-amber-500 hover:bg-amber-600 disabled:hover:bg-amber-500"
      >
        {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Check out
      </AttendanceActionButton>
    ) : (
      <AttendanceActionButton
        disabled={checkInMutation.isPending || isLoadingToday}
        onClick={() => checkInMutation.mutate()}
      >
        {checkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Check in
      </AttendanceActionButton>
    );

  return (
    <AttendanceShell
      title="Attendance report"
      description="Check in, review daily records, salary detail, and annual leave balance."
      actions={managerSelect}
    >
      <DrmSection
        title={`Today · ${format(new Date(), "dd MMM yyyy")}`}
        description={todayStatus}
        actions={checkInActions}
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Check-in applies to your account only, even when viewing another employee&apos;s report.
        </p>
      </DrmSection>

      <DrmSection title="Date range" description="Filter records and summaries for the selected period.">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Start date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    drmFieldClass,
                    "flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm",
                  )}
                >
                  <span className={startDate ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                    {startDate ? format(startDate, "dd MMM, yyyy") : "Pick start date"}
                  </span>
                  <CalendarIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              End date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    drmFieldClass,
                    "flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm",
                  )}
                >
                  <span className={endDate ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}>
                    {endDate ? format(endDate, "dd MMM, yyyy") : "Pick end date"}
                  </span>
                  <CalendarIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <AttendanceActionButton
            onClick={() => {
              refetchAttendance();
              refetchSummary();
              refetchSalary();
            }}
          >
            <Search className="h-4 w-4" /> Apply
          </AttendanceActionButton>
        </div>
      </DrmSection>

      <DrmSection title="Report">
        <AttendanceTabBar
          className="mb-6"
          active={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "daily", label: "Daily details" },
            { id: "monthly", label: "Monthly details" },
            { id: "salary", label: "Salary detail" },
            {
              id: "annual",
              label: (
                <span className="inline-flex items-center justify-center gap-2">
                  Annual leaves
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    New
                  </span>
                </span>
              ),
            },
          ]}
        />

        {/* Tab Content: Daily Details */}
        {activeTab === "daily" && (
          <div className="space-y-4">
            <AttendanceToolbar
              left={
                <>
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Show
                    <Select defaultValue="10">
                      <SelectTrigger className={attSelectTriggerClass("mt-1 w-[5rem]")}>
                        <SelectValue placeholder="10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <span className="pb-2 text-xs text-zinc-500 dark:text-zinc-400">entries</span>
                </>
              }
              right={
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Search
                  <Input className={cn(drmFieldClass, "mt-1 h-9 w-44 text-sm")} placeholder="Filter rows…" />
                </label>
              }
            />
            <AttendanceTable>
              <thead>
                <tr className={attTableHeadRowClass}>
                  <th className={attTableHeadCellClass}>Time in</th>
                  <th className={attTableHeadCellClass}>Time out</th>
                  <th className={attTableHeadCellClass}>Late / absent</th>
                  <th className={attTableHeadCellClass}>Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAttendance ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-300" />
                    </td>
                  </tr>
                ) : isErrorAttendance ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-red-600">
                      {(errorAttendance as Error)?.message || "Failed to load attendance records."}
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-sm text-zinc-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  records.map((r: any, idx: number) => (
                    <tr key={r.id || idx} className={attTableBodyRowClass}>
                      <td className={attTableBodyCellClass}>
                        {r.timeIn ? format(new Date(r.timeIn), "hh:mm a") : "—"}
                      </td>
                      <td className={attTableBodyCellClass}>
                        {r.timeOut ? format(new Date(r.timeOut), "hh:mm a") : "—"}
                      </td>
                      <td className={attTableBodyCellClass}>
                        {r.status || "Absent"}
                        {r.isLate ? ` (${r.lateMinutes}m late)` : ""}
                      </td>
                      <td className={attTableBodyCellClass}>
                        {r.date ? format(new Date(r.date), "dd-MM-yyyy") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AttendanceTable>
          </div>
        )}

        {/* Tab Content: Monthly Details */}
        {activeTab === "monthly" && (
          <AttendanceTable minWidth="900px">
            <thead>
              <tr className={attTableHeadRowClass}>
                {["User", "Total days", "Working", "Present", "Late", "Half day", "Leave", "Absent"].map((h) => (
                  <th key={h} className={attTableHeadCellClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingSummary ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-300" />
                  </td>
                </tr>
              ) : isErrorSummary ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-red-600">
                    {(errorSummary as Error)?.message || "Failed to load summary."}
                  </td>
                </tr>
              ) : summary.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-zinc-500">
                    No summary found.
                  </td>
                </tr>
              ) : (
                summary.map((s: any, idx: number) => (
                  <tr key={idx} className={attTableBodyRowClass}>
                    <td className={cn(attTableBodyCellClass, "font-medium text-zinc-800 dark:text-zinc-200")}>
                      {user?.fullName || "User"}
                    </td>
                    <td className={attTableBodyCellClass}>{s.totalDays ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.workingDays ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.present ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.late ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.halfDay ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.leave ?? 0}</td>
                    <td className={attTableBodyCellClass}>{s.absent ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </AttendanceTable>
        )}

        {/* Tab Content: Salary Detail */}
        {activeTab === "salary" && (
          <AttendanceTable minWidth="1200px">
            <thead>
              <tr className={attTableHeadRowClass}>
                {[
                  "User",
                  "Period",
                  "Gross",
                  "Working days",
                  "Present",
                  "Late",
                  "Absent",
                  "On leave",
                  "Late min",
                  "Cutting",
                  "Net salary",
                  "Payment",
                ].map((h) => (
                  <th key={h} className={attTableHeadCellClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoadingSalary ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-300" />
                  </td>
                </tr>
              ) : isErrorSalary ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-red-600">
                    {(errorSalary as Error)?.message || "Failed to load salary details."}
                  </td>
                </tr>
              ) : salaryDetails.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-sm text-zinc-500">
                    No records found.
                  </td>
                </tr>
              ) : (
                salaryDetails.map((sd: any, idx: number) => (
                  <tr key={idx} className={attTableBodyRowClass}>
                    <td className={attTableBodyCellClass}>{sd.userName || user?.fullName || "User"}</td>
                    <td className={attTableBodyCellClass}>
                      {startDate
                        ? format(startDate, "dd MMM")
                        : format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "dd MMM")}
                      {" – "}
                      {endDate ? format(endDate, "dd MMM yyyy") : format(new Date(), "dd MMM yyyy")}
                    </td>
                    <td className={cn(attTableBodyCellClass, "font-semibold")}>
                      {Number(sd.grossSalary || 0).toLocaleString()}
                    </td>
                    <td className={attTableBodyCellClass}>{sd.totalWorkingDays ?? 0}</td>
                    <td className={attTableBodyCellClass}>{sd.daysPresent ?? 0}</td>
                    <td className={attTableBodyCellClass}>{sd.daysLate ?? 0}</td>
                    <td className={attTableBodyCellClass}>{sd.daysAbsent ?? 0}</td>
                    <td className={attTableBodyCellClass}>{sd.daysOnLeave ?? 0}</td>
                    <td className={attTableBodyCellClass}>{sd.lateMinutes ?? sd.totalLateMinutes ?? 0}</td>
                    <td className={attTableBodyCellClass}>{Number(sd.totalCutting || 0).toLocaleString()}</td>
                    <td className={cn(attTableBodyCellClass, "font-semibold")}>
                      {Number(sd.totalSalary || 0).toLocaleString()}
                    </td>
                    <td className={attTableBodyCellClass}>
                      <AttendanceActionButton
                        variant={paymentStatuses[idx] ? "primary" : "secondary"}
                        className={!paymentStatuses[idx] ? "bg-amber-500 text-white hover:bg-amber-600" : undefined}
                        onClick={() => handlePaymentToggle(idx)}
                      >
                        {paymentStatuses[idx] ? "Pay received" : "Mark received"}
                      </AttendanceActionButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </AttendanceTable>
        )}

        {/* Tab Content: Annual Leaves */}
        {activeTab === "annual" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <AttendanceStatCard
                label={`Approved days used (${currentYear})`}
                value={availedLeaveDays}
              />
              <AttendanceStatCard label="Pending requests" value={pendingLeaveRequests} />
              <AttendanceStatCard
                label={`Total requests (${currentYear})`}
                value={leaveRequestsThisYear.length}
              />
            </div>
            <AttendanceTable minWidth="800px">
              <thead>
                <tr className={attTableHeadRowClass}>
                  {["From", "To", "Days", "Type", "Duration", "Reason", "Status"].map((h) => (
                    <th key={h} className={attTableHeadCellClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingLeaves ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-zinc-300" />
                    </td>
                  </tr>
                ) : leaveRequestsThisYear.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-zinc-500">
                      No leave requests this year.
                    </td>
                  </tr>
                ) : (
                  leaveRequestsThisYear.map((lr: any) => (
                    <tr key={lr.id} className={attTableBodyRowClass}>
                      <td className={attTableBodyCellClass}>{format(new Date(lr.fromDate), "dd MMM yyyy")}</td>
                      <td className={attTableBodyCellClass}>{format(new Date(lr.toDate), "dd MMM yyyy")}</td>
                      <td className={attTableBodyCellClass}>{leaveDaySpan(lr)}</td>
                      <td className={attTableBodyCellClass}>{lr.type || "—"}</td>
                      <td className={attTableBodyCellClass}>{lr.duration || "Full Day"}</td>
                      <td className={cn(attTableBodyCellClass, "max-w-[240px] truncate")}>{lr.reason || "—"}</td>
                      <td className={attTableBodyCellClass}>
                        <Badge variant="neutral">{lr.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </AttendanceTable>
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Note:</span> Quarterly leave eligibility
              requires no leave in the last 4 months (or 4 months tenure if joined this year). Combined leave needs
              Manager, HOD, and CEO approval.
            </p>
          </div>
        )}
      </DrmSection>
    </AttendanceShell>
  );
}
