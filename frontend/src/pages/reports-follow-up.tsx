import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type FollowUpRow = {
  id: string;
  date: string | null;
  companyName: string | null;
  purpose: string | null;
  service: string | null;
  subService: string | null;
  method: string | null;
  note: string | null;
};

type AppliedFilters = { userId: string; method: string; startDate: string; endDate: string };

export default function ReportsFollowUp() {
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

  // Same role-grouping convention as the other Select User pickers built this
  // session (KWA History, Diagnose Report, Target System, BV Report).
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

  // Legacy's exact Contact Method option set (followreport.php). Matched
  // case-insensitively on the backend since real data uses different casing
  // conventions across entry points (e.g. "MOBILE" vs this list's "Mobile").
  const CONTACT_METHODS = ["Mobile", "OnSite Visit", "E-mail", "Fax"];

  const { data: reportData, isLoading } = useQuery<{ rows: FollowUpRow[] }>({
    queryKey: ["/api/reports/follow-up", applied],
    queryFn: async () => {
      if (!applied) return { rows: [] };
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.method) params.set("method", applied.method);
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/follow-up?${params}`);
      if (!res.ok) return { rows: [] };
      return res.json();
    },
    enabled: !!applied,
  });

  const handleView = () => {
    setApplied({ userId: selectedUser, method: selectedMethod, startDate, endDate });
  };

  const rows = reportData?.rows || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        Follow Up System
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

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Contact Method</label>
              <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CONTACT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
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
        <CardContent className="p-6">
          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
            <table className="w-full text-sm text-center">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b text-left">Company</th>
                  <th className="py-3 px-4 font-bold border-b">Purpose</th>
                  <th className="py-3 px-4 font-bold border-b">Service</th>
                  <th className="py-3 px-4 font-bold border-b">Sub Service</th>
                  <th className="py-3 px-4 font-bold border-b">Method</th>
                  <th className="py-3 px-4 font-bold border-b">Note</th>
                  <th className="py-3 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {!applied ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Choose filters and click <span className="font-semibold">View</span> to load the report.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  rows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium text-left">{item.companyName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.purpose || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.service || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.subService || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.method || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.note || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.date ? format(new Date(item.date), "yyyy-MM-dd HH:mm:ss") : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {applied && rows.length > 0 && (
            <div className="mt-4 text-sm text-slate-500">
              Total: <b>{rows.length}</b>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
