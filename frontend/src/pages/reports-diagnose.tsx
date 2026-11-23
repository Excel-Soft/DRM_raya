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
import { groupUsersByRoleTitle } from "@/lib/user-role-groups";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

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
  // Opens on the current month for everyone (like the old page after View).
  const monthStart = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [selectedUser, setSelectedUser] = useState("All");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [applied, setApplied] = useState<AppliedFilters | null>({ userId: "all", startDate: monthStart, endDate: today });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
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

  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = useMemo(() => groupUsersByRoleTitle(users), [users]);

  const { data: reportData, isLoading, isFetching } = useQuery<{ rows: DiagnoseRow[]; total?: number }>({
    queryKey: ["/api/reports/diagnose", applied, page, pageSize],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!applied) return { rows: [] };
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      params.set("userId", applied.userId && applied.userId !== "All" ? applied.userId : "all");
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
    setPage(1);
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
  const total = Number(reportData?.total ?? rows.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
                <RoleGroupedUserSelect
                  users={users}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  extraOptions={[{ value: "All", label: "All" }]}
                  placeholder="Choose..."
                  className="bg-white dark:bg-zinc-800"
                />
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
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{(page - 1) * pageSize + index + 1}</td>
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
          {applied && total > 0 && (
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 ${isFetching ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2">
                <span>
                  Showing <b>{(page - 1) * pageSize + 1}</b> to <b>{Math.min(page * pageSize, total)}</b> of <b>{total.toLocaleString()}</b>
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <span>Page <b>{page}</b> of <b>{totalPages}</b></span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
