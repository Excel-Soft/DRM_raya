import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { groupUsersByRoleTitle } from "@/lib/user-role-groups";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";
import { gmTypeLabel } from "@/lib/gm-type-label";

// Old DRM GM SYSTEM (func.php user_id_gm_view). City / Package options come
// from GET /api/reports/gm-system/options (old branch + package names, so the
// values match webxl_user.branch / webxl_verify_gm.package). Select Type uses
// the Create GM page's gmTypeLabel set; Payment Type is the old webxl_behalf.
const TYPE_OPTIONS = ["New", "Rc", "Ec", "Rc-Up", "Kwa", "None"];
const PAYMENT_TYPES = ["Full", "Installment", "Delay", "Extra Discount"];

type GmFetchParams = {
  userId: string;
  from: string;
  to: string;
  city: string;
  pkg: string;
  type: string;
  paymentType: string;
  qWise: boolean;
  abPayDate: boolean;
};

const fmt = (v: unknown, pattern: string) => {
  if (!v) return "-";
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? "-" : format(d, pattern);
};

export default function GMReport() {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [qWise, setQWise] = useState(false);
  const [abPayDate, setAbPayDate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntries, setShowEntries] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);

  const [fetchParams, setFetchParams] = useState<GmFetchParams | null>(null);

  // Fetch users for the dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // A non-2xx body is JSON too (e.g. {error:"..."}) — guard so a
      // permission/server error can never be .forEach'd as if it were the
      // user array and crash the whole page.
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: optionsData } = useQuery<{ packages: string[]; cities: string[] }>({
    queryKey: ["/api/reports/gm-system/options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reports/gm-system/options");
      if (!res.ok) return { packages: [], cities: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const packageOptions = optionsData?.packages ?? [];
  const cityOptions = optionsData?.cities ?? [];

  // Same role-grouping convention as the Reports -> VAS Report user picker.
  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = useMemo(() => groupUsersByRoleTitle(users).map((g) => ({ role: g.role, members: g.users })), [users]);

  const { data: reportData, isLoading, isFetching } = useQuery<any>({
    queryKey: ["/api/reports/gm", fetchParams, currentPage, showEntries],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId && fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      params.set("page", String(currentPage));
      params.set("pageSize", String(parseInt(showEntries, 10) || 25));
      // Only this page's GM View is scoped to Account-approved entries — the
      // other GM report (GmReportTable in user-reports.tsx) doesn't send this
      // and keeps showing every entry regardless of approval stage.
      params.set("onlyAccountApproved", "true");
      // Old-DRM rules + filters (backend getGmSystemLegacyReport).
      params.set("gmSystem", "1");
      if (fetchParams.city && fetchParams.city !== "all") params.set("city", fetchParams.city);
      if (fetchParams.pkg && fetchParams.pkg !== "all") params.set("package", fetchParams.pkg);
      if (fetchParams.type && fetchParams.type !== "all") params.set("type", fetchParams.type);
      if (fetchParams.paymentType && fetchParams.paymentType !== "all") params.set("paymentType", fetchParams.paymentType);
      if (fetchParams.qWise) params.set("qWise", "true");
      if (fetchParams.abPayDate) params.set("abPayDate", "true");

      const res = await apiRequest("GET", `/api/reports/gm?${params}`);
      return res.json();
    },
    enabled: !!fetchParams,
    placeholderData: keepPreviousData,
  });

  const handleView = () => {
    setCurrentPage(1);
    setFetchParams({
      userId: selectedUser,
      from: startDate,
      to: endDate,
      city: selectedCity,
      pkg: selectedPackage,
      type: selectedType,
      paymentType: paymentTypeFilter,
      qWise,
      abPayDate,
    });
  };

  const details = reportData?.details || [];
  const quarters: { year: number; quarter: string; target: number | null; count: number; achievedAmount: number }[] =
    reportData?.qWise?.quarters ?? [];
  const isQWiseView = !!fetchParams?.qWise;

  const filteredDetails = details.filter((item: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.companyName?.toLowerCase().includes(q) ||
      String(item.memberId ?? "").toLowerCase().includes(q) ||
      item.person?.toLowerCase().includes(q)
    );
  });

  const totalEntries = reportData?.pagination?.total ?? reportData?.reportCount ?? filteredDetails.length;
  const totalPages = reportData?.pagination?.totalPages
    ?? Math.max(1, Math.ceil(totalEntries / (parseInt(showEntries, 10) || 25)));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * (parseInt(showEntries, 10) || 25);
  const displayedData = filteredDetails;
  const gmTotals = reportData?.gmTotals;

  useEffect(() => {
    setCurrentPage(1);
  }, [fetchParams, searchQuery]);

  useEffect(() => {
    if (!fetchParams) return;
    // showEntries/page changes refetch via queryKey — reset to page 1 when page size changes
    setCurrentPage(1);
  }, [showEntries]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        GM SYSTEM
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
                <div className="flex items-center gap-1">
                  <Checkbox 
                    id="qwise" 
                    checked={qWise} 
                    onCheckedChange={(c) => setQWise(!!c)} 
                    className="h-3 w-3"
                  />
                  <label htmlFor="qwise" className="text-[10px] text-slate-500">Q Wise</label>
                </div>
                <div className="flex items-center gap-1">
                  <Checkbox 
                    id="abpay" 
                    checked={abPayDate} 
                    onCheckedChange={(c) => setAbPayDate(!!c)} 
                    className="h-3 w-3"
                  />
                  <label htmlFor="abpay" className="text-[10px] text-slate-500">Ab Pay Date</label>
                </div>
              </div>
              <RoleGroupedUserSelect
                users={users}
                value={selectedUser}
                onChange={setSelectedUser}
                extraOptions={[{ value: "all", label: "All Users" }]}
                placeholder="Choose..."
                className="bg-white dark:bg-zinc-800"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select City</label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cityOptions.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select Package</label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  {packageOptions.map((pkg) => (
                    <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
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
                  <SelectItem value="all">All</SelectItem>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Old "Payment Type" (webxl_behalf): Full = no behalf value. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Payment Type</label>
              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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
            <Button 
              onClick={handleView}
              disabled={isFetching}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8"
            >
              {isFetching ? "Loading…" : "View"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">GM View</h2>
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

          {isQWiseView ? (
            isLoading ? (
              <div className="py-8 text-center text-slate-500">Loading data...</div>
            ) : quarters.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No entries found</div>
            ) : (
              // Old Q Wise view: one table per Alibaba quarter overlapping the
              // range; each lists the same GMs (as the old page did) with that
              // quarter's target and the running amount total.
              quarters.map((q) => (
                <div key={`${q.year}-${q.quarter}`} className="mb-6">
                  <h6 className="mb-2 text-sm font-semibold text-slate-700 dark:text-zinc-300">{q.year}-{q.quarter}</h6>
                  <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                        <tr>
                          {["#", "Member Id", "Company", "Package", "Amount", "Method", "Pay Date", "BV Date", "Person", "Rc/New", "GM Creation Date", "HOD Approval Date"].map((h) => (
                            <th key={h} className="py-3 px-4 font-bold border-b">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {filteredDetails.map((item: any, index: number) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50">
                            <td className="py-2 px-4">{index + 1}</td>
                            <td className="py-2 px-4">{item.memberId || "-"}</td>
                            <td className="py-2 px-4 font-medium">{item.companyName || "-"}</td>
                            <td className="py-2 px-4">{item.package || "-"}</td>
                            <td className="py-2 px-4">{item.amount != null ? Number(item.amount).toLocaleString() : "-"}</td>
                            <td className="py-2 px-4">{item.method || "-"}</td>
                            <td className="py-2 px-4">{fmt(item.payDate, "yyyy-MM-dd")}</td>
                            <td className="py-2 px-4">{fmt(item.bvDate, "yyyy-MM-dd")}</td>
                            <td className="py-2 px-4">{item.person || "-"}</td>
                            <td className="py-2 px-4">{gmTypeLabel(item.rcNew)}</td>
                            <td className="py-2 px-4">{fmt(item.gmCreationDate, "yyyy-MM-dd HH:mm:ss")}</td>
                            <td className="py-2 px-4">{fmt(item.hodApprovedDate, "yyyy-MM-dd HH:mm:ss")}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 dark:bg-zinc-800/60 font-bold border-t-2 border-slate-300 dark:border-zinc-700">
                          <td className="py-3 px-4">Target</td>
                          <td className="py-3 px-4">{q.target ?? "-"}</td>
                          <td className="py-3 px-4"></td>
                          <td className="py-3 px-4">Achived</td>
                          <td className="py-3 px-4">{Number(q.achievedAmount || 0).toLocaleString()}</td>
                          <td className="py-3 px-4">{q.count}</td>
                          <td colSpan={6}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )
          ) : (
          <div className={`overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800 ${isFetching ? "opacity-70" : ""}`}>
            <table className="w-full text-sm text-left">
              <thead className="bg-[#d1f2e2] dark:bg-emerald-900/30 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-4 font-bold border-b">#</th>
                  <th className="py-3 px-4 font-bold border-b">Member Id</th>
                  <th className="py-3 px-4 font-bold border-b">Company</th>
                  <th className="py-3 px-4 font-bold border-b">Package</th>
                  <th className="py-3 px-4 font-bold border-b">KWA</th>
                  <th className="py-3 px-4 font-bold border-b">PSA</th>
                  <th className="py-3 px-4 font-bold border-b">P.A</th>
                  <th className="py-3 px-4 font-bold border-b">Discount</th>
                  <th className="py-3 px-4 font-bold border-b">Extra Discount</th>
                  <th className="py-3 px-4 font-bold border-b">Method</th>
                  <th className="py-3 px-4 font-bold border-b">Pay Date</th>
                  <th className="py-3 px-4 font-bold border-b">BV Submit</th>
                  <th className="py-3 px-4 font-bold border-b">BV Date</th>
                  <th className="py-3 px-4 font-bold border-b">Person</th>
                  <th className="py-3 px-4 font-bold border-b">Rc/New</th>
                  <th className="py-3 px-4 font-bold border-b">Accountant</th>
                  <th className="py-3 px-4 font-bold border-b">Hod</th>
                  <th className="py-3 px-4 font-bold border-b">GM Creation Date</th>
                  <th className="py-3 px-4 font-bold border-b">HOD Approval Date</th>
                  <th className="py-3 px-4 font-bold border-b">Last Update Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading && !reportData ? (
                  <tr>
                    <td colSpan={20} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : displayedData.length === 0 ? (
                  <tr>
                    <td colSpan={20} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  displayedData.map((item: any, index: number) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{pageStart + index + 1}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.memberId || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-medium">{item.companyName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.package || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.kwa || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.psa || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.packagePriceUsd ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.discount ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.extraDiscount ?? "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.method || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.payDate, "yyyy-MM-dd")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.bvSubmitDate, "yyyy-MM-dd")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.bvDate, "yyyy-MM-dd")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.person || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{gmTypeLabel(item.rcNew)}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.accountantStatus || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.hodStatus || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.gmCreationDate, "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.hodApprovedDate, "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {fmt(item.lastUpdateDate, "yyyy-MM-dd HH:mm:ss")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {totalEntries > 0 && gmTotals && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 font-bold border-t-2 border-slate-300 dark:border-zinc-700">
                    <td className="py-3 px-4" colSpan={7}>Total (all {totalEntries.toLocaleString()} in range)</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                      {Number(gmTotals.discount ?? 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                      {Number(gmTotals.extraDiscount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={11}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          )}

          {!isQWiseView && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">
              Showing {displayedData.length > 0 ? pageStart + 1 : 0} to {pageStart + displayedData.length} of {totalEntries} entries
            </div>
            <div className="flex items-center">
              <Button
                variant="outline"
                className="rounded-r-none h-8 px-3 text-slate-500"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}
              >
                Previous
              </Button>
              <Button className="rounded-none h-8 px-3 bg-[#00a65a] hover:bg-[#008d4c] text-white">
                {safePage} / {totalPages}
              </Button>
              <Button
                variant="outline"
                className="rounded-l-none h-8 px-3 text-slate-500"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
