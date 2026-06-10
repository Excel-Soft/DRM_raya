import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { buildReportQueryParams } from "@/lib/reportApi";

export default function ReportsDayTarget() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [ourTeam, setOurTeam] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [fetchParams, setFetchParams] = useState<{ 
    userId: string; 
    from: string; 
    to: string;
    ourTeam: boolean;
  } | null>(null);

  // Fetch users for the dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      return res.json();
    }
  });

  // Day-target report query. No mock fallback: a backend failure surfaces as a
  // real error state with retry, never fabricated rows.
  const { data: reportData, isLoading, isError, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/reports/day-target", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return { details: [] };
      const query = buildReportQueryParams({
        from: fetchParams.from,
        to: fetchParams.to,
        userId:
          fetchParams.userId && fetchParams.userId !== "all"
            ? fetchParams.userId
            : undefined,
        ourTeam: fetchParams.ourTeam ? "true" : undefined,
      });
      return apiRequestJson<{ details?: any[] }>(
        "GET",
        `/api/reports/day-target${query ? `?${query}` : ""}`,
      );
    },
    enabled: !!fetchParams,
    retry: false,
  });

  const handleView = () => {
    setFetchParams({
      userId: selectedUser,
      from: startDate,
      to: endDate,
      ourTeam
    });
  };

  const details = reportData?.details || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        DAY ACTIVITIES
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="space-y-2 w-full md:w-1/4">
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

            <div className="flex items-center gap-2 mb-2 w-full md:w-auto">
              <Checkbox 
                id="ourTeam" 
                checked={ourTeam} 
                onCheckedChange={(c) => setOurTeam(!!c)} 
                className="h-4 w-4 rounded-sm border-slate-300"
              />
              <label htmlFor="ourTeam" className="text-sm text-slate-600 dark:text-zinc-400">Our Team</label>
            </div>

            <div className="space-y-2 relative w-full md:w-1/4">
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

            <div className="space-y-2 relative w-full md:w-1/4">
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
            
            <div className="w-full md:w-auto">
              <Button 
                onClick={handleView}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8 w-full"
              >
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">View Report</h2>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-4 px-4 font-bold border-b">Name</th>
                  <th className="py-4 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading || isFetching ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={2} className="py-10 text-center text-rose-600 text-sm">
                      Failed to load the report.{" "}
                      <button onClick={() => refetch()} className="underline font-semibold ml-1">Retry</button>
                    </td>
                  </tr>
                ) : details.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  details.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">{item.name || "-"}</td>
                      <td className="py-4 px-4 text-slate-600 dark:text-zinc-400">
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
