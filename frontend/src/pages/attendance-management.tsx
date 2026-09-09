import { useState } from "react";
import { Link } from "wouter";
import { CalendarIcon, Search, Loader2, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInCalendarDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { isManagerialRole } from "@/lib/role-utils";

const SELF_ATTENDANCE_VALUE = "__self__";

export default function AttendanceManagement() {
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

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen font-sans dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-[16px] font-bold text-slate-600 uppercase px-1 tracking-tight dark:text-zinc-300">ATTENDANCE REPORT</h1>
        
        {isManager && (
          <div className="w-64">
            <Select
              value={selectedUserId || SELF_ATTENDANCE_VALUE}
              onValueChange={(v) => setSelectedUserId(v === SELF_ATTENDANCE_VALUE ? "" : v)}
            >
              <SelectTrigger className="h-[38px] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF_ATTENDANCE_VALUE}>My Attendance</SelectItem>
                {usersData.filter(u => u.id !== user?.userId).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Check-In / Check-Out Card */}
      <div className="bg-white p-5 rounded-[4px] shadow-sm border border-slate-100 mb-4 flex items-center justify-between gap-4 dark:bg-zinc-900 dark:border-zinc-800">
        <div>
          <p className="text-[13px] font-semibold text-slate-600 dark:text-zinc-300">Today, {format(new Date(), 'dd MMM yyyy')}</p>
          {isLoadingToday ? (
            <p className="text-[12px] text-slate-400 mt-1">Loading status...</p>
          ) : todayRecord?.timeIn && todayRecord?.timeOut ? (
            <p className="text-[12px] text-slate-500 mt-1 dark:text-zinc-400">
              Checked in at {format(new Date(todayRecord.timeIn), 'hh:mm a')} &middot; Checked out at {format(new Date(todayRecord.timeOut), 'hh:mm a')}
            </p>
          ) : todayRecord?.timeIn ? (
            <p className="text-[12px] text-slate-500 mt-1 dark:text-zinc-400">
              Checked in at {format(new Date(todayRecord.timeIn), 'hh:mm a')} &middot; not checked out yet
            </p>
          ) : (
            <p className="text-[12px] text-slate-500 mt-1 dark:text-zinc-400">You haven't checked in today.</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {todayRecord?.timeIn && todayRecord?.timeOut ? (
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#059669]">
              <CheckCircle2 className="h-4 w-4" /> Day complete
            </span>
          ) : todayRecord?.timeIn ? (
            <button
              className="bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-bold px-6 py-2 rounded-[4px] shadow-sm transition-colors h-[38px] flex items-center gap-2 disabled:opacity-60"
              disabled={checkOutMutation.isPending}
              onClick={() => checkOutMutation.mutate()}
            >
              {checkOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Check Out
            </button>
          ) : (
            <button
              className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-6 py-2 rounded-[4px] shadow-sm transition-colors h-[38px] flex items-center gap-2 disabled:opacity-60"
              disabled={checkInMutation.isPending || isLoadingToday}
              onClick={() => checkInMutation.mutate()}
            >
              {checkInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Check In
            </button>
          )}
        </div>
      </div>

      {/* Date Filters Card */}
      <div className="bg-white p-5 rounded-[4px] shadow-sm border border-slate-100 mb-4 flex flex-col md:flex-row gap-4 md:items-end dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex-1">
          <label className="text-[13px] font-semibold text-slate-600 mb-1.5 block dark:text-zinc-300">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex w-full items-center border border-slate-200 rounded-[4px] overflow-hidden hover:border-[#059669] transition-colors bg-white cursor-pointer h-[38px] dark:bg-zinc-900 dark:border-zinc-800">
                <span className={`flex-1 px-3 text-[13px] outline-none truncate select-none leading-none pt-1 ${startDate ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                  {startDate ? format(startDate, 'dd MMM, yyyy') : 'dd M, yyyy'}
                </span>
                <div className="px-3 border-l border-slate-200 text-slate-400 bg-[#f8fafc] h-full flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800">
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex-1">
          <label className="text-[13px] font-semibold text-slate-600 mb-1.5 block dark:text-zinc-300">End Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex w-full items-center border border-slate-200 rounded-[4px] overflow-hidden hover:border-[#059669] transition-colors bg-white cursor-pointer h-[38px] dark:bg-zinc-900 dark:border-zinc-800">
                <span className={`flex-1 px-3 text-[13px] outline-none truncate select-none leading-none pt-1 ${endDate ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                  {endDate ? format(endDate, 'dd MMM, yyyy') : 'dd M, yyyy'}
                </span>
                <div className="px-3 border-l border-slate-200 text-slate-400 bg-[#f8fafc] h-full flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800">
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <button
            className="bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold px-8 py-2 rounded-[4px] shadow-sm transition-colors h-[38px] flex items-center gap-2"
            onClick={() => {
              refetchAttendance();
              refetchSummary();
              refetchSalary();
            }}
          >
            <Search className="h-4 w-4" /> Search
          </button>
        </div>
      </div>

      {/* Main Tabs Card */}
      <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-5 dark:bg-zinc-900 dark:border-zinc-800">
        {/* Custom Tab Bar */}
        <div className="grid grid-cols-4 gap-2 mb-6 text-center border-b border-slate-50 pb-4 dark:border-zinc-800">
          <div
            onClick={() => setActiveTab('daily')}
            className={`py-2 px-2 rounded-[4px] cursor-pointer text-[13px] font-bold transition-colors ${activeTab === 'daily' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
          >
            Daily Details
          </div>
          <div
            onClick={() => setActiveTab('monthly')}
            className={`py-2 px-2 rounded-[4px] cursor-pointer text-[13px] font-bold transition-colors ${activeTab === 'monthly' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
          >
            Monthly Details
          </div>
          <div
            onClick={() => setActiveTab('salary')}
            className={`py-2 px-2 rounded-[4px] cursor-pointer text-[13px] font-bold transition-colors ${activeTab === 'salary' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
          >
            Salary Detail
          </div>
          <div
            onClick={() => setActiveTab('annual')}
            className={`py-2 px-2 rounded-[4px] cursor-pointer text-[13px] font-bold transition-colors flex items-center justify-center gap-2 ${activeTab === 'annual' ? 'bg-[#059669] text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900'}`}
          >
            Annual Leaves
            <span className="bg-[#ef4444] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold dark:bg-zinc-900">New Feature!</span>
          </div>
        </div>

        {/* Tab Content: Daily Details */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            <div className="flex justify-between items-end mb-2 px-1">
              <div>
                <label className="text-xs text-slate-500 block mb-1 dark:text-zinc-400">Show</label>
                <div className="flex items-center gap-2">
                  <Select defaultValue="10">
                    <SelectTrigger className="w-[70px] h-8 text-xs border-slate-200 dark:border-zinc-800">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-500 block dark:text-zinc-400">entries</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block text-right mb-1 dark:text-zinc-400">Search:</label>
                <input type="text" className="h-8 border border-slate-200 rounded-[4px] px-2 w-[180px] text-xs focus:outline-none focus:border-[#059669] bg-transparent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Time In</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Time Out</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Late - Absent</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingAttendance ? (
                    <tr><td colSpan={4} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                  ) : isErrorAttendance ? (
                    <tr><td colSpan={4} className="py-10 text-center text-red-500">{(errorAttendance as Error)?.message || "Failed to load attendance records."}</td></tr>
                  ) : records.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-slate-400">No records found.</td></tr>
                  ) : (
                    records.map((r: any, idx: number) => (
                      <tr key={r.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.timeIn ? format(new Date(r.timeIn), 'hh:mm a') : '-'}</td>
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.timeOut ? format(new Date(r.timeOut), 'hh:mm a') : '-'}</td>
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.status || 'Absent'}{r.isLate ? ` (${r.lateMinutes}m late)` : ''}</td>
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.date ? format(new Date(r.date), 'dd-MM-yyyy') : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Monthly Details */}
        {activeTab === 'monthly' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">User Name</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Days</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Working Days</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Present</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Late</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Half Day</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Leave</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Absent</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSummary ? (
                   <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                ) : isErrorSummary ? (
                  <tr><td colSpan={8} className="py-10 text-center text-red-500">{(errorSummary as Error)?.message || "Failed to load summary."}</td></tr>
                ) : summary.length === 0 ? (
                  <tr><td colSpan={8} className="py-10 text-center text-slate-400">No summary found.</td></tr>
                ) : (
                  summary.map((s: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors bg-slate-50/30 dark:bg-zinc-900 dark:border-zinc-800">
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">
                        {user?.fullName || "User"}
                      </td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.totalDays ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.workingDays ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.present ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.late ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.halfDay ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.leave ?? 0}</td>
                      <td className="py-4 px-3 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{s.absent ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: Salary Detail */}
        {activeTab === 'salary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">User Name</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Period</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Gross Salary</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Working Days</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Days Present</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Days Late</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Days Absent</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Days On Leave</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Late Minutes</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Cutting</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Salary</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] text-left dark:text-zinc-100">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSalary ? (
                  <tr><td colSpan={12} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                ) : isErrorSalary ? (
                  <tr><td colSpan={12} className="py-10 text-center text-red-500">{(errorSalary as Error)?.message || "Failed to load salary details."}</td></tr>
                ) : salaryDetails.length === 0 ? (
                  <tr><td colSpan={12} className="py-10 text-center text-slate-400">No records found.</td></tr>
                ) : (
                  salaryDetails.map((sd: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.userName || user?.fullName || "User"}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">
                        {startDate ? format(startDate, 'dd MMM') : format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'dd MMM')}
                        {' – '}
                        {endDate ? format(endDate, 'dd MMM yyyy') : format(new Date(), 'dd MMM yyyy')}
                      </td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] font-bold dark:text-zinc-100">{Number(sd.grossSalary || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.totalWorkingDays ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.daysPresent ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.daysLate ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.daysAbsent ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.daysOnLeave ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.lateMinutes ?? sd.totalLateMinutes ?? 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{Number(sd.totalCutting || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] font-bold dark:text-zinc-100">{Number(sd.totalSalary || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-left">
                        <button
                          onClick={() => handlePaymentToggle(idx)}
                          className={`px-3 py-1.5 rounded-[4px] text-[11px] font-bold text-white transition-colors cursor-pointer border-none shadow-sm ${
                            paymentStatuses[idx] ? "bg-[#059669] hover:bg-[#047857]" : "bg-amber-500 hover:bg-amber-600"
                          }`}
                        >
                          {paymentStatuses[idx] ? "Pay Received" : "Mark Received"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content: Annual Leaves */}
        {activeTab === 'annual' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="border border-slate-100 rounded-[4px] p-3 dark:border-zinc-800">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Approved Days Used ({currentYear})</p>
                <p className="text-[20px] font-bold text-[#1e3a5f] dark:text-zinc-100">{availedLeaveDays}</p>
              </div>
              <div className="border border-slate-100 rounded-[4px] p-3 dark:border-zinc-800">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Pending Requests</p>
                <p className="text-[20px] font-bold text-amber-500">{pendingLeaveRequests}</p>
              </div>
              <div className="border border-slate-100 rounded-[4px] p-3 dark:border-zinc-800">
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">Total Requests ({currentYear})</p>
                <p className="text-[20px] font-bold text-[#1e3a5f] dark:text-zinc-100">{leaveRequestsThisYear.length}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">From</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">To</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Days</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Type</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Duration</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Reason</th>
                    <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] text-left dark:text-zinc-100">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLeaves ? (
                    <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                  ) : leaveRequestsThisYear.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-slate-400">No leave requests this year.</td></tr>
                  ) : (
                    leaveRequestsThisYear.map((lr: any) => {
                      const statusColors: Record<string, string> = {
                        Approved: "bg-emerald-100 text-emerald-700",
                        Pending: "bg-amber-100 text-amber-700",
                        Rejected: "bg-rose-100 text-rose-700",
                        Cancelled: "bg-slate-100 text-slate-600",
                      };
                      return (
                        <tr key={lr.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{format(new Date(lr.fromDate), 'dd MMM yyyy')}</td>
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{format(new Date(lr.toDate), 'dd MMM yyyy')}</td>
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{leaveDaySpan(lr)}</td>
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{lr.type || "-"}</td>
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{lr.duration || "Full Day"}</td>
                          <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400 truncate max-w-[240px]">{lr.reason || "-"}</td>
                          <td className="py-4 px-4 text-left">
                            <span className={`px-2 py-1 rounded-[4px] text-[10px] font-bold dark:bg-zinc-900 ${statusColors[lr.status] || "bg-slate-100 text-slate-600"}`}>
                              {lr.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 mt-2">
              <p className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Note: <span className="font-medium">You are eligible for quarterly leaves if you have not availed any leaves in the last 4 months. If you joined this year, you must have completed at least 4 months to be eligible. If you wish to combine leaves, approval from your Manager, HOD, and CEO is required.</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
