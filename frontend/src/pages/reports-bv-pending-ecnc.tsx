import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ReportsBvPendingEcnc() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [pendingBv, setPendingBv] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntries, setShowEntries] = useState("10");

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

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/bv", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId && fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      
      const res = await apiRequest("GET", `/api/reports/bv?${params}`);
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
    if (searchQuery && !item.companyName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filter by type if not "all"
    if (selectedType && selectedType !== "all" && item.entryType?.toLowerCase() !== selectedType.toLowerCase()) {
      return false;
    }
    return true;
  });

  const displayLimit = parseInt(showEntries) || 10;
  const displayedData = filteredDetails.slice(0, displayLimit);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        BV CHECK SYSTEM
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
                  <div className="flex items-center gap-1">
                    <Checkbox 
                      id="pendingBv" 
                      checked={pendingBv} 
                      onCheckedChange={(c) => setPendingBv(!!c)} 
                      className="h-3 w-3"
                    />
                    <label htmlFor="pendingBv" className="text-[10px] text-slate-500">Pending Bv</label>
                  </div>
                </div>
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
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select Type</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="bg-white dark:bg-zinc-800">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="rc">Rc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">BV View</h2>
        </div>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Show</span>
              <Select value={showEntries} onValueChange={setShowEntries}>
                <SelectTrigger className="w-[70px] h-8 bg-white dark:bg-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-slate-500">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Search:</span>
              <Input 
                className="h-8 w-[200px] bg-white dark:bg-zinc-800" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b">#</th>
                  <th className="py-3 px-4 font-bold border-b">Company</th>
                  <th className="py-3 px-4 font-bold border-b">Package</th>
                  <th className="py-3 px-4 font-bold border-b">Method</th>
                  <th className="py-3 px-4 font-bold border-b">BV</th>
                  <th className="py-3 px-4 font-bold border-b">Person</th>
                  <th className="py-3 px-4 font-bold border-b">Rc/New</th>
                  <th className="py-3 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : displayedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  displayedData.map((item: any, index: number) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{index + 1}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium">{item.companyName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.packageType || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.method || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.bvAmount || item.amount || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.personName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.entryType || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.date ? format(new Date(item.date), 'yyyy-MM-dd HH:mm:ss') : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">
              Showing {displayedData.length > 0 ? 1 : 0} to {displayedData.length} of {filteredDetails.length} entries
            </div>
            <div className="flex items-center">
              <Button variant="outline" className="rounded-r-none h-8 px-3 text-slate-500" disabled>Previous</Button>
              <Button className="rounded-none h-8 px-3 bg-[#00a65a] hover:bg-[#008d4c] text-white">1</Button>
              <Button variant="outline" className="rounded-l-none h-8 px-3 text-slate-500" disabled>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
