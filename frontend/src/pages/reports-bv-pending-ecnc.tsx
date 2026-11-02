import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { apiRequest, extractApiError } from "@/lib/queryClient";

export default function ReportsBvPendingEcnc() {
  const [, setLocation] = useLocation();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [pendingBv, setPendingBv] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntries, setShowEntries] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);

  const [fetchParams, setFetchParams] = useState<{
    userId: string;
    from: string;
    to: string;
    pendingBv: boolean;
  } | null>(null);

  // Fetch users for the dropdown — same role-grouping convention as the
  // BV SYSTEM / VAS / GM / Target System Select User pickers elsewhere.
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    }
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

  const { data: reportData, isLoading, isError, error } = useQuery<any>({
    queryKey: ["/api/reports/bv", "pending", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      params.set("scope", "pending");
      if (fetchParams.pendingBv) params.set("pendingOnly", "true");
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId && fetchParams.userId !== "all") params.set("userId", fetchParams.userId);

      const res = await apiRequest("GET", `/api/reports/bv?${params}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(extractApiError(body, res.status));
      }
      return body;
    },
    enabled: !!fetchParams,
    retry: false,
  });

  const handleView = () => {
    setFetchParams({
      userId: selectedUser,
      from: startDate,
      to: endDate,
      pendingBv
    });
  };

  // Once a search is already showing, "Pending Bv" is a filter toggle, not a
  // separate field needing another "View" click — flip it and re-fetch right
  // away. Before the first View, it just arms the next search like the rest
  // of the filters do.
  const handlePendingBvChange = (checked: boolean) => {
    setPendingBv(checked);
    setFetchParams((prev) => (prev ? { ...prev, pendingBv: checked } : prev));
  };

  const details = reportData?.details || [];
  
  const filteredDetails = details.filter((item: any) => {
    if (searchQuery && !item.companyName?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filter by type if not "all"
    if (selectedType && selectedType !== "all" && item.rcNew?.toLowerCase() !== selectedType.toLowerCase()) {
      return false;
    }
    return true;
  });

  const displayLimit = parseInt(showEntries, 10) || 10;
  const totalFiltered = filteredDetails.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / displayLimit));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [showEntries, searchQuery, selectedType, fetchParams]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (safePage - 1) * displayLimit;
  const displayedData = filteredDetails.slice(pageStart, pageStart + displayLimit);
  const showingFrom = totalFiltered === 0 ? 0 : pageStart + 1;
  const showingTo = pageStart + displayedData.length;

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [totalPages]);

  const openCompanyDetail = (item: any) => {
    const customerId = item.customerId;
    const gmEntryId = item.gmEntryId || item.id;
    if (!customerId) {
      window.alert("Customer record is not linked for this company yet.");
      return;
    }
    const q = new URLSearchParams({ open: "account-gm-bv" });
    if (gmEntryId) q.set("gmEntryId", String(gmEntryId));
    setLocation(`/customers/attribute/${customerId}?${q.toString()}`);
  };

  const showBvDateColumn = !!fetchParams?.pendingBv;
  const tableColSpan = (showBvDateColumn ? 9 : 8) + 2;

  const formatReportDate = (value: unknown, pendingLabel = "Pending") => {
    if (!value) return pendingLabel;
    const d = new Date(value as string | number | Date);
    if (Number.isNaN(d.getTime())) return pendingLabel;
    return format(d, "dd-MM-yyyy");
  };

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
                      onCheckedChange={(c) => handlePendingBvChange(!!c)}
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
                    <SelectItem value="all">All</SelectItem>
                    {groupedUsers.map(({ role, users }) => (
                      <SelectGroup key={role}>
                        <SelectLabel>{role}</SelectLabel>
                        {users.filter(u => u.fullName || u.username).map((u) => (
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
                    <SelectItem value="Rc/Up">Rc/Up</SelectItem>
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
                  <th className="py-3 px-4 font-bold border-b">BV Submit</th>
                  {showBvDateColumn && (
                    <th className="py-3 px-4 font-bold border-b">BV Date</th>
                  )}
                  <th className="py-3 px-4 font-bold border-b">Person</th>
                  <th className="py-3 px-4 font-bold border-b">Rc/New</th>
                  <th className="py-3 px-4 font-bold border-b">Payment Received</th>
                  <th className="py-3 px-4 font-bold border-b">Ab Pay Date</th>
                  <th className="py-3 px-4 font-bold border-b">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-8 text-center text-slate-500">Loading data...</td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-8 text-center text-red-600">
                      {(error as Error)?.message || "Failed to load BV report"}
                    </td>
                  </tr>
                ) : displayedData.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} className="py-8 text-center text-slate-500">No entries found</td>
                  </tr>
                ) : (
                  displayedData.map((item: any, index: number) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{pageStart + index + 1}</td>
                      <td className="py-3 px-4 font-medium">
                        {item.companyName ? (
                          <button
                            type="button"
                            onClick={() => openCompanyDetail(item)}
                            className="text-[#059669] hover:text-[#047857] hover:underline text-left"
                          >
                            {item.companyName}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.package || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.method || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.bvSubmit ? format(new Date(item.bvSubmit), "yyyy-MM-dd") : "N/A"}
                      </td>
                      {showBvDateColumn && (
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                          {item.accountBvDate
                            ? format(new Date(item.accountBvDate), "yyyy-MM-dd")
                            : "Pending"}
                        </td>
                      )}
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.personName || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">{item.rcNew || "-"}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {formatReportDate(item.paymentReceived ?? item.date, "-")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {formatReportDate(item.abPayDate, "Pending")}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                        {item.date ? format(new Date(item.date), "yyyy-MM-dd HH:mm:ss") : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="text-sm text-slate-500">
              Showing {showingFrom} to {showingTo} of {totalFiltered} entries
              {totalPages > 1 ? ` (page ${safePage} of ${totalPages})` : ""}
            </div>
            {totalFiltered > 0 && (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-r-none h-8 px-3 text-slate-500"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                {pageNumbers.map((pageNum) => (
                  <Button
                    key={pageNum}
                    type="button"
                    variant={pageNum === safePage ? "default" : "outline"}
                    className={
                      pageNum === safePage
                        ? "rounded-none h-8 px-3 min-w-[2rem] bg-[#00a65a] hover:bg-[#008d4c] text-white"
                        : "rounded-none h-8 px-3 min-w-[2rem] text-slate-500"
                    }
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-l-none h-8 px-3 text-slate-500"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
