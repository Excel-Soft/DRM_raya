import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DiagnoseRow = {
  id: string;
  createDate: string | null;
  companyName: string | null;
  personName: string | null;
  startRating: string | null;
  upSalling: string | null;
  rfq: string | null;
  products: string | null;
  followRate: string | null;
  sample: string | null;
  orderInfo: string | null;
  revenue: string | null;
  happyAlibaba: string | null;
  happyWebxl: string | null;
  report: string | null;
};

type AppliedFilters = { userId: string; startDate: string; endDate: string };

export default function ReportsDiagnose() {
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(true);
  const [selectedUser, setSelectedUser] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [exporting, setExporting] = useState(false);

  // Same role-grouping convention as the other Select User pickers built this
  // session (KWA History, Target System, BV Report).
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

  const { data: reportData, isLoading } = useQuery<{ rows: DiagnoseRow[] }>({
    queryKey: ["/api/reports/diagnose", applied],
    queryFn: async () => {
      if (!applied) return { rows: [] };
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/diagnose?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: body?.error || "Failed to load the diagnose report.", variant: "destructive" });
        return { rows: [] };
      }
      return body;
    },
    enabled: !!applied,
  });

  const handleView = () => {
    setApplied({ userId: selectedUser, startDate, endDate });
  };

  const handleExport = async () => {
    if (!applied) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/diagnose/export?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diagnose_report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const rows = reportData?.rows ?? [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest flex gap-2 items-center">
          Diagnose Report <span className="text-slate-300 font-light">/</span>
          <span
            className="text-[#00a65a] cursor-pointer hover:underline transition-all select-none"
            onClick={() => setShowFilters(!showFilters)}
          >
            View Report
          </span>
        </h1>
        <Button
          onClick={handleExport}
          disabled={!applied || exporting || rows.length === 0}
          className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {showFilters && (
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Person</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="bg-white dark:bg-zinc-800">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
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

              <div className="space-y-2 relative">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start</label>
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
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End</label>
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
      )}

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">GM View</h2>
        </div>
        <CardContent className="p-6">
          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b">#</th>
                  <th className="py-3 px-4 font-bold border-b">Create</th>
                  <th className="py-3 px-4 font-bold border-b">Company</th>
                  <th className="py-3 px-4 font-bold border-b">Person</th>
                  <th className="py-3 px-4 font-bold border-b">Start Rating</th>
                  <th className="py-3 px-4 font-bold border-b">Up Salling</th>
                  <th className="py-3 px-4 font-bold border-b">Rfq</th>
                  <th className="py-3 px-4 font-bold border-b">Products</th>
                  <th className="py-3 px-4 font-bold border-b">Follow Rate</th>
                  <th className="py-3 px-4 font-bold border-b">Sample</th>
                  <th className="py-3 px-4 font-bold border-b">Order</th>
                  <th className="py-3 px-4 font-bold border-b">Revenue</th>
                  <th className="py-3 px-4 font-bold border-b">Happy Alibaba</th>
                  <th className="py-3 px-4 font-bold border-b">Happy Webxl</th>
                  <th className="py-3 px-4 font-bold border-b">Report Send</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {!applied ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-slate-500">
                      Choose a person and date range, then click <span className="font-semibold">View</span>.
                    </td>
                  </tr>
                ) : isLoading ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-slate-500">
                      Loading data...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-slate-500">
                      No follow-up records found for these filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{index + 1}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {row.createDate ? format(new Date(row.createDate), "dd-MM-yyyy hh:mm a") : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium">{row.companyName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.personName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.startRating || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.upSalling || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.rfq || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.products || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.followRate || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.sample || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.orderInfo || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.revenue || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.happyAlibaba || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.happyWebxl || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{row.report || "-"}</td>
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
