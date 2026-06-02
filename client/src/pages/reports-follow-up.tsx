import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ReportsFollowUp() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [fetchParams, setFetchParams] = useState<{ 
    userId: string; 
    from: string; 
    to: string;
  } | null>(null);

  // Fetch users for the dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      return res.json();
    }
  });

  // Placeholder query (can be replaced with actual follow-ups endpoint)
  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/follow-up", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return { details: [] };
      const params = new URLSearchParams();
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId && fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      
      // using gm as a placeholder since the screenshot has same placeholder data
      const res = await apiRequest("GET", `/api/reports/gm?${params}`);
      return res.json();
    },
    enabled: !!fetchParams
  });

  const handleView = () => {
    setFetchParams({
      userId: selectedUser,
      from: startDate,
      to: endDate
    });
  };

  const details = reportData?.details || [];
  
  const filteredDetails = details.filter((item: any) => {
    if (selectedMethod && selectedMethod !== "all" && item.method?.toLowerCase() !== selectedMethod.toLowerCase()) {
      return false;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        FOLLOW UP SYSTEM
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
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

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Contact Method</label>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input 
                  type="date" 
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10 text-sm"
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
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">View Report</h2>
        </div>
        <CardContent className="p-6">
          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
            <table className="w-full text-sm text-center">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b text-left">Company</th>
                  <th className="py-3 px-4 font-bold border-b">Purpose</th>
                  <th className="py-3 px-4 font-bold border-b">Service For</th>
                  <th className="py-3 px-4 font-bold border-b">Method</th>
                  <th className="py-3 px-4 font-bold border-b">Note</th>
                  <th className="py-3 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : filteredDetails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  filteredDetails.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium text-left">{item.companyName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.purpose || "10000"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.serviceFor || "364"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.method || "10000"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.note || "364"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.date ? format(new Date(item.date), 'yyyy-MM-dd HH:mm:ss') : "-"}
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
