import { useState } from "react";
import { Link } from "wouter";
import { CalendarIcon, Search, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

import { isManagerialRole } from "@/lib/role-utils";

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
  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery<any>({
    queryKey: ["/api/attendance", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);
      
      const res = await apiRequest("GET", `/api/attendance?${params.toString()}`);
      return res.json();
    }
  });

  // Fetch Summary
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery<any>({
    queryKey: ["/api/attendance/summary", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);
      
      const res = await apiRequest("GET", `/api/attendance/summary?${params.toString()}`);
      return res.json();
    }
  });

  // Fetch Salary Details
  const { data: salaryData, isLoading: isLoadingSalary } = useQuery<any>({
    queryKey: ["/api/attendance/salary", { startDate, endDate, userId: selectedUserId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate.toISOString());
      if (endDate) params.append("endDate", endDate.toISOString());
      if (isManager && selectedUserId) params.append("userId", selectedUserId);
      
      const res = await apiRequest("GET", `/api/attendance/salary?${params.toString()}`);
      return res.json();
    }
  });

  const records = attendanceData?.records || [];
  const summary = summaryData?.summary ? (Array.isArray(summaryData.summary) ? summaryData.summary : [summaryData.summary]) : [];
  const salaryDetails = salaryData?.salaryDetails ? (Array.isArray(salaryData.salaryDetails) ? salaryData.salaryDetails : [salaryData.salaryDetails]) : [];

  return (
    <div className="p-4 bg-[#f8fafc] min-h-screen font-sans dark:bg-zinc-950">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-[16px] font-bold text-slate-600 uppercase px-1 tracking-tight dark:text-zinc-300">ATTENDANCE REPORT</h1>
        
        {isManager && (
          <div className="w-64">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-[38px] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={user?.userId || ""}>My Attendance</SelectItem>
                {usersData.filter(u => u.id !== user?.userId).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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
          <button className="bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold px-8 py-2 rounded-[4px] shadow-sm transition-colors h-[38px] flex items-center gap-2">
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
                  ) : records.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-slate-400">No records found.</td></tr>
                  ) : (
                    records.map((r: any, idx: number) => (
                      <tr key={r.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.checkIn || '05:00 AM'}</td>
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.checkOut || '05:00 AM'}</td>
                        <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">{r.status || 'Absent'}</td>
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
            <table className="w-full text-left border-collapse min-w-[1500px]">
              <thead>
                <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">User Name</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Salary</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Paid Leave</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Earn Days</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Absents</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Absents RS</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Late Min</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Late Coming</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Cutting Min</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Min RS</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Per Day</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Loan</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Penalty</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">VAS</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">5% Bonus</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">AB Bonus</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Project Bonus</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">PPP Bonus</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">PP Bonus</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">OT RS</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Cutting</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Salary</th>
                  <th className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Month / Year</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSummary ? (
                   <tr><td colSpan={23} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                ) : summary.length === 0 ? (
                  <tr><td colSpan={23} className="py-10 text-center text-slate-400">No summary found.</td></tr>
                ) : (
                  summary.map((s: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-slate-50/30 dark:border-zinc-800">
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">
                        {s.userName || user?.fullName || "User"}<br /><span className="text-[10px] text-slate-300 font-normal">Main User</span>
                      </td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{Number(s.grossSalary || 0).toLocaleString()}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.paidLeaves || 2}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">26 -<br />21=5</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.absents || 19}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{Number(s.totalCutting || 0).toLocaleString()}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.lateMinutes || 0}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100"></td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">(0 -<br />120) +<br />=-120</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{Number((s.grossSalary || 0) / 30).toFixed(0)}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.loanAmount || "0-0"}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.penaltyAmount || ""}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.vasAmount || 0}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.bonusAmount || 0}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{s.overtimeAmount || 0}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{Number(s.totalCutting || 0).toLocaleString()}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{Number(s.totalSalary || 0).toLocaleString()}</td>
                      <td className="py-4 px-3 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{format(new Date(), 'M/ yyyy')}</td>
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
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">#</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">User Name</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Date</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Gross Salary</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">VAS</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">5% Bonus</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">AB Bonus</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Project Bonus</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">PPP Bonus</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">PP Bonus</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">OT RS</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Reward</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Cutting</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Salary</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] text-left dark:text-zinc-100">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSalary ? (
                  <tr><td colSpan={15} className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></td></tr>
                ) : salaryDetails.length === 0 ? (
                  <tr><td colSpan={15} className="py-10 text-center text-slate-400">No records found.</td></tr>
                ) : (
                  salaryDetails.map((sd: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <td className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">{7655 - idx * 276}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] flex items-center gap-1 dark:text-zinc-100">{sd.userName || user?.fullName || "User"} <span className="text-[10px] text-slate-300 font-normal">Main User</span></td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{(sd.month || new Date().getMonth() + 1).toString().padStart(2, '0')}-{sd.year || new Date().getFullYear()}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] font-bold dark:text-zinc-100">{Number(sd.grossSalary || 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.vasAmount || 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.bonusAmount || 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">0</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.overtimeAmount || 0}</td>
                      <td className="py-4 px-4 text-[13px] text-[#1e3a5f] dark:text-zinc-100">{sd.rewardAmount || 0}</td>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">#</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">User ID</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Total Leaves</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Availed Leaves</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">CM Leaves</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Paid/Unpaid Leaves</th>
                  <th className="py-4 px-4 text-[13px] font-bold text-[#1e3a5f] dark:text-zinc-100">Balance Leaves Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">1</td>
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">55</td>
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">24</td>
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">60</td>
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">21</td>
                  <td className="py-4 px-4 text-[13px] text-slate-500 dark:text-zinc-400">2/19-21</td>
                  <td className="py-4 px-4 text-left">
                    <span className="px-2 py-1 rounded-[4px] text-[10px] font-bold bg-[#fecdd3] text-[#be123c] dark:bg-zinc-900">
                      Not Eligible
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="p-4 mt-2">
              <p className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Note: <span className="font-medium">You are eligible for quarterly leaves if you have not availed any leaves in the last 4 months. If you joined this year, you must have completed at least 4 months to be eligible. If you wish to combine leaves, approval from your Manager, HOD, and CEO is required.</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
