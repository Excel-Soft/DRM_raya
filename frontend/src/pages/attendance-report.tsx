import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format, differenceInMinutes } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

export default function AttendanceReport() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<{ userId: string; startDate: string; endDate: string } | null>(null);

  // Fetch users for the dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      return res.json();
    }
  });

  // Fetch attendance records based on selected params
  const { data: attendanceData = { records: [] }, isLoading } = useQuery<any>({
    queryKey: ["/api/attendance", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return { records: [] };
      const { userId, startDate, endDate } = fetchParams;
      let url = `/api/attendance?`;
      if (userId) url += `userId=${userId}&`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}`;
      
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!fetchParams
  });

  const handleView = () => {
    setFetchParams({ userId: selectedUser, startDate, endDate });
  };

  const calculateLate = (timeIn: string | null) => {
    if (!timeIn) return "-";
    const checkInDate = new Date(timeIn);
    const expectedCheckIn = new Date(checkInDate);
    expectedCheckIn.setHours(9, 0, 0, 0); // Assuming 09:00 AM is the check-in time
    
    if (checkInDate > expectedCheckIn) {
      const diffMinutes = differenceInMinutes(checkInDate, expectedCheckIn);
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}:${minutes}`;
    }
    return "0:0";
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        ATTENDANCE SYSTEM
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={handleView}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8"
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">Attendance View</h2>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead className="bg-red-100/70 dark:bg-red-900/20 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold">Time In</th>
                  <th className="py-3 px-4 font-bold">Time Out</th>
                  <th className="py-3 px-4 font-bold">Late Absent</th>
                  <th className="py-3 px-4 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-slate-500">Loading attendance data...</td>
                  </tr>
                ) : !attendanceData.records || attendanceData.records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-slate-500">No records found. Please select a user and date range.</td>
                  </tr>
                ) : (
                  attendanceData.records.map((record: any) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors bg-slate-50/30 dark:bg-zinc-900">
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {record.timeIn ? format(new Date(record.timeIn), 'HH:mm') : '-'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {record.timeOut ? format(new Date(record.timeOut), 'HH:mm') : '-'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {record.status === "Absent" ? "Absent" : calculateLate(record.timeIn)}
                      </td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400 font-medium">
                        {record.date ? format(new Date(record.date), 'yyyy-MM-dd') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
