import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DayTargetMethodRow {
  method: string;
  total: number;
}

interface DayTargetUserTable {
  userId: string | null;
  userName: string;
  rows: DayTargetMethodRow[];
}

interface DayTargetReport {
  filters: { startDate: string; endDate: string; userId: string | null; ourTeam: boolean };
  tables: DayTargetUserTable[];
}

interface FetchParams {
  userId: string;
  ourTeam: boolean;
  startDate: string;
  endDate: string;
}

export default function ReportsDayTarget() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState("all");
  const [ourTeam, setOurTeam] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);

  // Same role-grouping convention as the other Select User pickers built this
  // session (KWA History, Diagnose Report, Follow Up Report).
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const { data: report, isLoading, isError } = useQuery<DayTargetReport>({
    queryKey: ["/api/reports/day-target", fetchParams],
    queryFn: async () => {
      const p = fetchParams!;
      const params = new URLSearchParams();
      params.set("startDate", p.startDate);
      params.set("endDate", p.endDate);
      if (p.userId !== "all") params.set("userId", p.userId);
      if (p.ourTeam) params.set("ourTeam", "true");
      const res = await apiRequest("GET", `/api/reports/day-target?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || body?.error || "Failed to load the report.");
      return body;
    },
    enabled: !!fetchParams,
    retry: false,
  });

  const handleView = () => {
    if (!startDate || !endDate) {
      toast({ title: "Select both a start and end date.", variant: "destructive" });
      return;
    }
    setFetchParams({ userId: selectedUser, ourTeam, startDate, endDate });
  };

  const tables = report?.tables ?? [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest">
        Day Activities
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
                  <SelectItem value="all">All</SelectItem>
                  {groupedUsers.map(({ role, users }) => (
                    <SelectGroup key={role}>
                      <SelectLabel>{role}</SelectLabel>
                      {users.filter((u) => u.fullName || u.username).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName || u.username}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="ourTeam"
                checked={ourTeam}
                onCheckedChange={(c) => setOurTeam(!!c)}
                className="h-4 w-4"
              />
              <label htmlFor="ourTeam" className="text-sm text-slate-600 dark:text-zinc-400">
                Our Team
              </label>
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
            <Button onClick={handleView} className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8">
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">View Report</h2>
        </div>
        <CardContent className="p-6 space-y-6">
          {!fetchParams ? (
            <div className="py-8 text-center text-slate-500">Choose filters and click View to load the report.</div>
          ) : isLoading ? (
            <div className="py-8 text-center text-slate-500">Loading data...</div>
          ) : isError ? (
            <div className="py-8 text-center text-rose-600 text-sm">Failed to load the report.</div>
          ) : tables.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No activity found for these filters.</div>
          ) : (
            tables.map((table) => (
              <div key={table.userId ?? "all"} className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
                <table className="w-full text-sm text-center">
                  <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                    <tr>
                      <th className="py-3 px-4 font-bold border-b text-left">Method</th>
                      <th className="py-3 px-4 font-bold border-b text-right">{table.userName}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {table.rows.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-slate-500">No activity in this range.</td>
                      </tr>
                    ) : (
                      table.rows.map((row) => (
                        <tr key={row.method} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="py-3 px-4 text-left text-slate-600 dark:text-zinc-400">{row.method}</td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-zinc-400">{row.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
