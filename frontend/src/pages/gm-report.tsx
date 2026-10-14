import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Same branch list already used for the city/branch picker elsewhere in the
// app (GmReportTable in user-reports.tsx, office-expenses.tsx) — Wazirabad
// and Faisalabad Branch are the two this page's mock list was missing.
const CITIES = [
  "Sialkot-Webexcels",
  "Lahore",
  "Karachi",
  "Lahore-Raya",
  "Lahore-GulBerg",
  "Sialkot-Welc",
  "Gujranwala branch",
  "Wazirabad Branch",
  "Faisalabad Branch",
];

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

  // Real package list, same source as the other GM report's Select Package
  // (GmReportTable in user-reports.tsx) — not hardcoded here.
  const { data: packagesData } = useQuery<{ packages: any[] }>({
    queryKey: ["gm-packages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gm-packages");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const gmPackages = packagesData?.packages || [];

  // Same role-grouping convention as the Reports -> VAS Report user picker.
  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (users || []).forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, members]) => ({ role, members }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/gm", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId && fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      // Only this page's GM View is scoped to Account-approved entries — the
      // other GM report (GmReportTable in user-reports.tsx) doesn't send this
      // and keeps showing every entry regardless of approval stage.
      params.set("onlyAccountApproved", "true");

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
    if (searchQuery && !item.companyName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const displayLimit = parseInt(showEntries) || 10;
  const displayedData = filteredDetails.slice(0, displayLimit);

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
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {groupedUsers.map(({ role, members }) => (
                    <SelectGroup key={role}>
                      <SelectLabel>{role}</SelectLabel>
                      {members.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Select City</label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {CITIES.map((city) => (
                    <SelectItem key={city} value={city.toLowerCase().replace(/\s+/g, "-")}>{city}</SelectItem>
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
                  {gmPackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>
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
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Renew">Renew</SelectItem>
                  <SelectItem value="Expire">Expire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Same "Payment Type" filter (Full/Partial/Loan, matching item.gmType)
                already present on the other GM report (GmReportTable in
                user-reports.tsx) — this page didn't have it at all. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Payment Type</label>
              <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
                <SelectTrigger className="bg-white dark:bg-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="FULL">Full</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="LOAN">Loan</SelectItem>
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

          <div className="overflow-x-auto border rounded-sm border-slate-200 dark:border-zinc-800">
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
                {isLoading ? (
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
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{index + 1}</td>
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
                        {item.payDate ? format(new Date(item.payDate), 'yyyy-MM-dd') : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.bvSubmitDate ? format(new Date(item.bvSubmitDate), 'yyyy-MM-dd HH:mm:ss') : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.bvDate ? format(new Date(item.bvDate), 'yyyy-MM-dd') : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.person || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.rcNew || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.accountantStatus || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.hodStatus || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.gmCreationDate ? format(new Date(item.gmCreationDate), 'yyyy-MM-dd HH:mm:ss') : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.hodApprovedDate ? format(new Date(item.hodApprovedDate), 'yyyy-MM-dd HH:mm:ss') : "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.lastUpdateDate ? format(new Date(item.lastUpdateDate), 'yyyy-MM-dd HH:mm:ss') : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredDetails.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-zinc-800/60 font-bold border-t-2 border-slate-300 dark:border-zinc-700">
                    <td className="py-3 px-4" colSpan={7}>Total</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                      {filteredDetails.reduce((sum: number, it: any) => sum + Number(it.discount ?? 0), 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-zinc-300">
                      {filteredDetails.reduce((sum: number, it: any) => sum + Number(it.extraDiscount ?? 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={11}></td>
                  </tr>
                </tfoot>
              )}
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
