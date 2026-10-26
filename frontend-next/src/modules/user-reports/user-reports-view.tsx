"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/legacy/card";
import { Button } from "@/components/ui/legacy/button";
import { Badge } from "@/components/ui/legacy/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/legacy/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/legacy/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/legacy/table";
import {
  FileText,
  Download,
  Mail,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Users,
  DollarSign,
  Calendar as CalendarIcon,
  BarChart3,
  Target,
  XCircle,
  Loader2
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export/export-utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { apiRequest, getAuthHeader, extractApiError } from "@/lib/query/query-client";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { isManagerialRole, isCompanyWideRole } from "@/lib/auth/role-utils";
import {
  DrmSection,
  UrExportButtonBar,
  UserReportsHeaderActionsProvider,
  UserReportsShell,
  drmFieldClass,
  urTableHeaderClass,
  urTableHeadClass,
  useUserReportsHeaderActions,
} from "@/modules/user-reports/user-reports-ui";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Button as UiButton } from "@/components/ui/button";
import { Badge as ThemeBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";

type ReportType = "loan" | "vas" | "gm" | "bv";

interface ReportMetrics {
  totalTasks: number;
  valueOfServiceSold: number;
  // Patch 2 Stage 7: BV success rate is the approved/total ratio and is `null`
  // (not 0/100) when there are no rows — render it honestly.
  successRate: number | null;
  // BV follow-ups/missed-leads have no auditable aggregate source, so they are
  // `null` at the headline level (per-report values remain visible per row).
  followUpsCompleted: number | null;
  missedLeads: number | null;
}

interface ChartDataPoint {
  date: string;
  value: number;
  count: number;
}

interface LoanDetail {
  id: string;
  employeeName: string;
  amount: number | string;
  detail: string;
  installmentAmount: number | string;
  remainingAmount: number | string;
  status: string;
  date: string;
  managerName?: string | null;
  hodName?: string | null;
}

interface ReportData {
  type: ReportType;
  dateRange: { from: string; to: string };
  metrics: ReportMetrics;
  chartData: ChartDataPoint[];
  details: any[];
  totals?: {
    totalAdvance: number;
    totalRemaining: number;
  };
}

const reportTypes: ReportType[] = ["loan", "vas", "gm", "bv"];
const isReportType = (value: string | undefined): value is ReportType =>
  !!value && reportTypes.includes(value as ReportType);
const defaultReportHeader = {
  title: "User Reports",
  description: "Role-based performance reporting",
};

const reportTypeLabels: Record<ReportType, { title: string; description: string }> = {
  loan: { title: "Loan Report", description: "Loan and advance salary requests" },
  vas: { title: "VAS Report", description: "Value-Added Services performance" },
  gm: { title: "GM Report", description: "Gold Membership reporting" },
  bv: { title: "BV Report", description: "Business Verification status" },
};

function GmReportTable({
  details,
  totals,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange,
  onRefresh
}: {
  details: any[];
  totals?: any;
  dateRange: { from: string; to: string };
  onDateChange: (field: "from" | "to", value: string) => void;
  selectedUser: string;
  onUserChange: (value: string) => void;
  onRefresh?: () => void;
}) {
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const data = await res.json();
      return data.users || [];
    },
  });

  const [filteredDetails, setFilteredDetails] = useState(details);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [entryTypeFilter, setEntryTypeFilter] = useState("all");

  const { data: packagesData } = useQuery<{ packages: any[] }>({
    queryKey: ["gm-packages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gm-packages");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const packages = packagesData?.packages || [];

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  useEffect(() => {
    setFilteredDetails(details);
  }, [details]);

  const filtered = useMemo(() => {
    return filteredDetails.filter(item => {
      if (typeFilter !== "all" && item.gmType !== typeFilter) return false;
      if (entryTypeFilter !== "all" && item.rcNew !== entryTypeFilter) return false;
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (
        item.companyName?.toLowerCase().includes(lower) ||
        item.person?.toLowerCase().includes(lower)
      );
    });
  }, [filteredDetails, searchTerm, typeFilter, entryTypeFilter]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginatedData = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-5">
      <DrmSection title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select User</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="q-wise" />
                  <Label htmlFor="q-wise" className="text-xs font-normal text-slate-500 dark:text-zinc-400">Q Wise</Label>
                  <Checkbox id="month-wise" />
                </div>
              </div>
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f4f8] border-none h-11 text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select City</Label>
              <Select>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sialkot-webexcels">Sialkot-Webexcels</SelectItem>
                  <SelectItem value="lahore">Lahore</SelectItem>
                  <SelectItem value="karachi">Karachi</SelectItem>
                  <SelectItem value="lahore-raya">Lahore-Raya</SelectItem>
                  <SelectItem value="lahore-gulberg">Lahore-GulBerg</SelectItem>
                  <SelectItem value="sialkot-welc">Sialkot-Welc</SelectItem>
                  <SelectItem value="gujranwala">Gujranwala branch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select Package</Label>
              <Select>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Packages</SelectItem>
                  {packages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.name}>
                      {pkg.name} ({pkg.orderDollar ?? pkg.priceUsd} $)
                    </SelectItem>
                  ))}

                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select Type</Label>
              <Select value={entryTypeFilter} onValueChange={(v) => { setEntryTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800" data-testid="select-gm-entry-type-filter">
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

            <div className="md:col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Payment Type</Label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800" data-testid="select-gm-type-filter">
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

            <div className="md:col-span-4 grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Start Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => onDateChange("from", e.target.value)}
                    className="bg-white border-slate-200 h-11 pr-2 dark:bg-zinc-900 dark:border-zinc-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">End Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => onDateChange("to", e.target.value)}
                    className="bg-white border-slate-200 h-11 pr-2 dark:bg-zinc-900 dark:border-zinc-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Ab Pay Date</Label>
                <Select>
                  <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="md:col-span-12 mt-2">
              <UiButton type="button" size="lg" onClick={() => onRefresh && onRefresh()}>
                View
              </UiButton>
            </div>
          </div>
      </DrmSection>

      <DrmSection
        title="Results"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Search</span>
            <Input
              className={cn(drmFieldClass, "h-9 w-44 text-sm")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm">Show</span>
            <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm">entries</span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className={urTableHeaderClass}>
                <TableRow className="border-b-0 hover:bg-emerald-50/90 dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black dark:text-zinc-300 w-10 text-center">#</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[150px]">Company</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Package</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Type</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">KWA</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">PSA</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Package Amount</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Method</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">BV Submit Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">BV Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Person</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Rc/New</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[150px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                      <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{(currentPage - 1) * perPage + idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-700 py-3 dark:text-zinc-400">{item.companyName}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.package}</TableCell>
                      <TableCell className="text-center py-3">
                        <Badge
                          variant="outline"
                          className={
                            item.gmType === "LOAN" ? "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300" :
                            item.gmType === "PARTIAL" ? "border-amber-200 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300" :
                            "border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }
                        >
                          {item.gmType === "LOAN" ? "Loan" : item.gmType === "PARTIAL" ? "Partial" : "Full"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.kwa}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.psa}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.packageAmount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.method}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bvSubmitDate}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bvDate}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.person}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.rcNew}</TableCell>
                      <TableCell className="text-slate-600 py-3 dark:text-zinc-300">
                        {item.date ? new Date(item.date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => c - 1)}
              >
                Previous
              </Button>
              <Button
                variant="default" // Active look for current page
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {currentPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(c => c + 1)}
              >
                Next
              </Button>
            </div>
          </div>
      </DrmSection>
    </div>
  );
}

// Exact option set from func (1).php's BV "Type" (account-reclassification)
// dropdown — same values as DropoutTiltle() plus "Next Que" and
// "Change Commission".
const BV_TYPE_OPTIONS = [
  { value: "1", label: "Basic Drop" },
  { value: "2", label: "Basic Plus Drop" },
  { value: "3", label: "Basic P/D" },
  { value: "4", label: "Basic Plus P/D" },
  { value: "5", label: "Pkg Update" },
  { value: "0", label: "Next Que" },
  { value: "6", label: "Change Commission" },
];

// One commission-verification panel per distinct salesperson in the current
// view (works for "All" the same as a single selected person — commission is
// inherently per-individual). A standalone component because each person
// needs its own useQuery/useMutation instances, which can't live in a loop
// inside the parent.
function BvCommissionPanelRow({
  personId,
  personName,
  totals,
  achievement,
  commPeriod,
  canManage,
  currentUserId,
}: {
  personId: string;
  personName: string;
  totals: { comm: number; reward: number };
  achievement?: { targetName: string; targetQuota: number | null; achievedCount: number };
  commPeriod: { month: number; year: number };
  canManage: boolean;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["/api/bv-commission-verifications", personId, commPeriod.month, commPeriod.year];
  // func.php's own panel (line ~23318) takes an AB Reward amount + a Reward
  // Comment BEFORE the Verify action — a manual, HOD-entered bonus on top of
  // the computed totals, not something derivable from the sale rows.
  const [abRewardInput, setAbRewardInput] = useState("");
  const [rewardCommentInput, setRewardCommentInput] = useState("");

  const { data: commRecord, isLoading: commLoading } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/bv-commission-verifications?userId=${personId}&month=${commPeriod.month}&year=${commPeriod.year}`,
      );
      const data = await res.json();
      return data.record;
    },
  });

  const createCommMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bv-commission-verifications", {
        userId: personId,
        month: commPeriod.month,
        year: commPeriod.year,
        totalComm: totals.comm,
        totalReward: totals.reward,
        abReward: abRewardInput.trim() ? Number(abRewardInput) : undefined,
        rewardComment: rewardCommentInput.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Commission verified", description: `Commission record created for ${personName}.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to verify", description: err?.message || "Could not create the commission record", variant: "destructive" });
    },
  });

  const confirmCommMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bv-commission-verifications/${commRecord?.id}/confirm`, {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Confirmed", description: "Commission confirmed." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to confirm", description: err?.message || "Could not confirm", variant: "destructive" });
    },
  });

  const isSelf = currentUserId === personId;

  return (
    <TableRow className="bg-emerald-50/90 dark:bg-zinc-900 hover:bg-emerald-50/90 dark:hover:bg-zinc-900">
      <TableCell colSpan={18}>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold">{personName}:</span>
          {achievement ? (
            <span className="text-muted-foreground">
              Target ({achievement.targetName}): {achievement.achievedCount}/{achievement.targetQuota ?? "-"}
              {achievement.targetQuota ? ` (${Math.round((achievement.achievedCount / achievement.targetQuota) * 100)}%)` : ""}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No target assigned</span>
          )}
          {commLoading ? (
            <span className="text-xs text-muted-foreground">Loading commission status...</span>
          ) : commRecord ? (
            <>
              <span className="font-bold">
                Final Com: {Number(commRecord.finalPayAmount ?? commRecord.totalComm).toLocaleString()}
              </span>
              {commRecord.abReward != null && (
                <span className="font-bold">AB Reward: {Number(commRecord.abReward).toLocaleString()}</span>
              )}
              {commRecord.rewardComment && (
                <span className="text-muted-foreground">Reward Comment: {commRecord.rewardComment}</span>
              )}
              {commRecord.userStatus === "Verified" ? (
                <Badge className="bg-green-600 text-white hover:bg-green-600">Verified</Badge>
              ) : isSelf ? (
                <Button size="sm" onClick={() => confirmCommMutation.mutate()} disabled={confirmCommMutation.isPending}>
                  Confirm
                </Button>
              ) : (
                <Badge className="bg-red-500 text-white hover:bg-red-500">Sale Person Side Pending</Badge>
              )}
            </>
          ) : canManage ? (
            achievement ? (
              <>
                <Input
                  type="number"
                  placeholder="AB Reward"
                  value={abRewardInput}
                  onChange={(e) => setAbRewardInput(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
                <Input
                  placeholder="Enter Reward Description"
                  value={rewardCommentInput}
                  onChange={(e) => setRewardCommentInput(e.target.value)}
                  className="h-8 w-48 text-xs"
                />
                <Button size="sm" onClick={() => createCommMutation.mutate()} disabled={createCommMutation.isPending}>
                  Verify (Final Com: {(totals.comm + totals.reward + (Number(abRewardInput) || 0)).toLocaleString()})
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                Commission can't be verified until a target is assigned to this salesperson (Set Target).
              </span>
            )
          ) : (
            <span className="text-xs text-muted-foreground">Not yet created by HOD/Account.</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function BvReportTable({
  details,
  totals,
  personAchievement,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange,
  scope
}: {
  details: any[];
  totals?: any;
  personAchievement?: { personId: string; targetName: string; targetQuota: number | null; achievedCount: number }[];
  dateRange: { from: string; to: string };
  onDateChange: (field: "from" | "to", value: string) => void;
  selectedUser: string;
  onUserChange: (value: string) => void;
  scope?: string | null;
}) {
  const { data: allUsers = [], isLoading: usersLoading, isError: usersError } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const data = await res.json();
      return data.users || [];
    },
  });

  const [filteredDetails, setFilteredDetails] = useState(details);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [viewFilters, setViewFilters] = useState({ status: "all" });
  // func (1).php's "Type" column (line ~23247 onward) is actually the
  // account-reclassification dropdown ("changeAcoountType") shown only to
  // specific legacy roles — same option set as the Dropout column
  // (DropoutTiltle), plus "Next Que" and "Change Commission". It is an admin
  // action control there, not a data display field (it writes back via
  // onchange="changeAcoountType(...)"). gm_entries has no equivalent
  // dropout/account-type column to write that action to, so this is wired as
  // a visual match only (per-row local selection) — not persisted anywhere
  // yet. Say so if you want the save action built.
  const [typeSelections, setTypeSelections] = useState<Record<string, string>>({});

  const handleView = () => {
    setViewFilters({ status: selectedStatus });
    setCurrentPage(1);
  };

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  // Same impersonation-aware "acting role" resolution ReportTab's own scope
  // effect uses, and the same role-based gate already used for the VAS/GM
  // Select User pickers — only roles authorized to see other users' data get
  // a real selector; everyone else keeps the existing readonly own-name view.
  // Also gated on scope=company (the "Reports" sidebar group's BV Report
  // link) so "User Reports" -> BV Report (no scope) stays exactly as it was
  // before — same single shared component, no duplicate page.
  const activeRole = sessionStorage.getItem("userRole") ?? (currentUser as any)?.roleId;
  const canSelectUser = scope === "company" && (isManagerialRole(activeRole) || isCompanyWideRole(activeRole));

  // Same role-grouping convention as the VAS/GM Select User pickers.
  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (allUsers || []).forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [allUsers]);

  useEffect(() => {
    setFilteredDetails(details);
  }, [details]);

  const filtered = useMemo(() => {
    return filteredDetails.filter(item => {
      if (viewFilters.status !== "all" && item.status?.toLowerCase() !== viewFilters.status.toLowerCase()) {
        return false;
      }
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (
        item.companyName?.toLowerCase().includes(lower) ||
        item.title?.toLowerCase().includes(lower) ||
        item.authorName?.toLowerCase().includes(lower) ||
        item.personName?.toLowerCase().includes(lower)
      );
    });
  }, [filteredDetails, searchTerm, viewFilters]);

  // Total row for the scope=company view — summed over whatever is actually
  // filtered/visible (search + Select Status), not the unfiltered backend
  // totals, so it always matches what's shown in the table above it.
  const bvTotals = useMemo(() => {
    const sumNumeric = (key: string) =>
      filtered.reduce((sum, item) => sum + (typeof item[key] === "number" ? item[key] : Number(item[key]) || 0), 0);
    return {
      price: sumNumeric("price"),
      extraDisc: sumNumeric("extraDisc"),
      comm: sumNumeric("comm"),
      reward: sumNumeric("reward"),
      vas: sumNumeric("vas"),
      kwa: sumNumeric("kwa"),
    };
  }, [filtered]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginatedData = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // func (1).php's commission panel keys by month/year derived from the
  // filter range's start date (same as $VasMouth/$VasYear there).
  const commPeriod = useMemo(() => {
    const d = new Date(dateRange.from);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, [dateRange.from]);

  // One panel per distinct salesperson actually present in the filtered rows
  // — works the same whether "All" or one specific person is selected,
  // because commission is inherently per-individual (same as func.php: the
  // Verify button always targeted one $user_gm, never an aggregate).
  const personTotals = useMemo(() => {
    const map = new Map<string, { personId: string; personName: string; comm: number; reward: number }>();
    filtered.forEach((item) => {
      if (!item.personId) return;
      const existing = map.get(item.personId) ?? {
        personId: item.personId,
        personName: item.personName || "Unknown",
        comm: 0,
        reward: 0,
      };
      existing.comm += typeof item.comm === "number" ? item.comm : Number(item.comm) || 0;
      existing.reward += typeof item.reward === "number" ? item.reward : Number(item.reward) || 0;
      map.set(item.personId, existing);
    });
    return Array.from(map.values());
  }, [filtered]);

  const currentUserId = (currentUser as any)?.userId || (currentUser as any)?.id;

  // func.php's BV report page has a second, separate "KWA" usage ledger table
  // below the main one (webxl_kwa records — company/sell-by/used-by/kwa/type/
  // detail/remaining/used/reward/status/dates). target_system_kwa_records is
  // the modern equivalent (used by the standalone Add Kwa/Kwa History pages).
  // It has no salesPersonId — "employee" is a free-text name, same as this
  // table's other person fields, so matched by name against whoever is
  // currently showing in personTotals below.
  const { data: kwaRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-records"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/target-system/kwa-records");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: scope === "company",
  });

  return (
    <div className="space-y-5">
      <DrmSection title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select User</Label>
              {canSelectUser ? (
                <Select value={selectedUser} onValueChange={onUserChange}>
                  <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800" data-testid="select-bv-user">
                    <SelectValue placeholder={usersLoading ? "Loading users..." : "Choose..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {usersError ? (
                      <div className="px-2 py-1.5 text-sm text-destructive">Failed to load users</div>
                    ) : !usersLoading && groupedUsers.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No users found</div>
                    ) : (
                      groupedUsers.map(({ role, users }) => (
                        <SelectGroup key={role}>
                          <SelectLabel>{role}</SelectLabel>
                          {users.filter(u => u.fullName || u.username).map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName || u.username}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  readOnly
                  value={(currentUser as any)?.fullName || (currentUser as any)?.name || (currentUser as any)?.username || "Loading..."}
                  className="bg-white border-slate-200 h-11 text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
                />
              )}
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {scope === "company" ? (
                    <>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Renew">Renew</SelectItem>
                      <SelectItem value="Expire">Expire</SelectItem>
                      <SelectItem value="Rc/Up">Rc/Up</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Submitted">Submitted</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Start Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="bg-white border-slate-200 h-11 pr-2 dark:bg-zinc-900 dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">End Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="bg-white border-slate-200 h-11 pr-2 dark:bg-zinc-900 dark:border-zinc-800"
                />
              </div>
            </div>

            <div className="md:col-span-12 mt-2">
              <UiButton type="button" size="lg" onClick={handleView}>
                View
              </UiButton>
            </div>
          </div>
      </DrmSection>

      <DrmSection
        title="Results"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Search</span>
            <Input
              className={cn(drmFieldClass, "h-9 w-44 text-sm")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        }
      >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm">Show</span>
            <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm">entries</span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              {scope === "company" ? (
                <>
                  <TableHeader className={urTableHeaderClass}>
                    <TableRow className="border-b-0 hover:bg-emerald-50/90 dark:hover:bg-zinc-800">
                      <TableHead className="font-bold text-black dark:text-zinc-300 w-10 text-center">#</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[150px]">Company</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[120px]">Package</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">ExtraDisc++</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Comm</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">VAS</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">KWA</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Method</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[130px]">Person</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Pay</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center" title="User BV Submit Date">BV Submit</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">BV</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Rc/New</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Dropout</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Type</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[120px]">Receive Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                          No Records Found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((item, idx) => (
                        <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                          <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{(currentPage - 1) * perPage + idx + 1}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.companyName || "-"}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.package || "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.price != null ? Number(item.price).toLocaleString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.extraDisc != null ? Number(item.extraDisc).toLocaleString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.comm ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.reward ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.vas ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.kwa ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.method ?? "-"}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.personName || "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.pay ? new Date(item.pay).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bvSubmit ? new Date(item.bvSubmit).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bv ? new Date(item.bv).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.rcNew || "-"}</TableCell>
                          {/* func.php's Dropout column and Type dropdown share the exact same
                              option codes (DropoutTiltle uses the same 0-6 values as
                              changeAcoountType) — Dropout there is just the display of
                              whatever was last picked in that same dropdown, not a separate
                              data source. Reflects the Type selection below; still not
                              persisted anywhere since there's no backend column to save it to. */}
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">
                            {BV_TYPE_OPTIONS.find((opt) => opt.value === typeSelections[item.id])?.label ?? "-"}
                          </TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">
                            <Select
                              value={typeSelections[item.id] ?? ""}
                              onValueChange={(v) => setTypeSelections((prev) => ({ ...prev, [item.id]: v }))}
                            >
                              <SelectTrigger className="h-8 w-[130px] mx-auto text-xs">
                                <SelectValue placeholder="choose..." />
                              </SelectTrigger>
                              <SelectContent>
                                {BV_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.date ? new Date(item.date).toLocaleDateString() : "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {paginatedData.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-emerald-50/90 dark:bg-zinc-900 hover:bg-emerald-50/90 dark:hover:bg-zinc-900">
                        <TableCell colSpan={3} className="font-bold text-black dark:text-zinc-300">Total</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.price.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.extraDisc.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.comm.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.reward.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.vas.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.kwa.toLocaleString()}</TableCell>
                        <TableCell colSpan={9}></TableCell>
                      </TableRow>
                      {personTotals.map((p) => (
                        <BvCommissionPanelRow
                          key={p.personId}
                          personId={p.personId}
                          personName={p.personName}
                          totals={{ comm: p.comm, reward: p.reward }}
                          achievement={personAchievement?.find((a) => a.personId === p.personId)}
                          commPeriod={commPeriod}
                          canManage={canSelectUser}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </TableFooter>
                  )}
                </>
              ) : (
                <>
                  <TableHeader className={urTableHeaderClass}>
                    <TableRow className="border-b-0 hover:bg-emerald-50/90 dark:hover:bg-zinc-800">
                      <TableHead className="font-bold text-black dark:text-zinc-300 w-10 text-center">#</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[120px]">Date</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[150px]">Title</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[150px]">Company</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 min-w-[130px]">Author</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Status</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Total Tasks</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Value Sold</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Success Rate</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Follow-ups</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Missed Leads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                          No Records Found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((item, idx) => (
                        <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                          <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{(currentPage - 1) * perPage + idx + 1}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.date ? new Date(item.date).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="font-bold text-slate-700 py-3 dark:text-zinc-400">{item.title || "-"}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.companyName || "-"}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.authorName || "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.status || "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.totalTasks ?? 0}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{Number(item.valueSold ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.successRate == null ? "—" : `${item.successRate}%`}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.followUpsDone ?? 0}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.missedLeads ?? 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </>
              )}
            </Table>
          </div>

          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * perPage + 1} to {Math.min(currentPage * perPage, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(c => c - 1)}
              >
                Previous
              </Button>
              <Button
                variant="default" // Active look for current page
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {currentPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(c => c + 1)}
              >
                Next
              </Button>
            </div>
          </div>
      </DrmSection>

      {scope === "company" && personTotals.map((p) => {
        const personKwaRecords = kwaRecords.filter(
          (r: any) => (r.employee || "").trim().toLowerCase() === p.personName.trim().toLowerCase(),
        );
        if (personKwaRecords.length === 0) return null;
        const kwaTotals = personKwaRecords.reduce(
          (acc: any, r: any) => ({
            remaining: acc.remaining + Number(r.remaining || 0),
            used: acc.used + (Number(r.kwa || 0) - Number(r.remaining || 0)),
            reward: acc.reward + Number(r.reward || 0),
          }),
          { remaining: 0, used: 0, reward: 0 },
        );
        return (
          <Card key={p.personId} className="border border-border shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">KWA Usage — {p.personName}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className={urTableHeaderClass}>
                    <TableRow className="border-b-0 hover:bg-emerald-50/90 dark:hover:bg-zinc-800">
                      <TableHead className="font-bold text-black dark:text-zinc-300 w-10 text-center">No#</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Company</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Sell By</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Used By</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Kwa</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Type</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Detail</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Remaining</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Used</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Status</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Create Date</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300">Pay Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personKwaRecords.map((r: any, idx: number) => (
                      <TableRow key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                        <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{idx + 1}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.company || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.employee || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.usedBy || "-"}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${Number(r.kwa ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{r.type || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.detail || "-"}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${Number(r.remaining ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${(Number(r.kwa ?? 0) - Number(r.remaining ?? 0)).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{Number(r.reward ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{r.status || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.payDate ? new Date(r.payDate).toLocaleDateString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-emerald-50/90 dark:bg-zinc-900 hover:bg-emerald-50/90 dark:hover:bg-zinc-900">
                      <TableCell colSpan={7} className="font-bold text-black dark:text-zinc-300">Total</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">${kwaTotals.remaining.toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">${kwaTotals.used.toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">{kwaTotals.reward.toLocaleString()}</TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function VasReportTable({
  details,
  totals,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange,
  onRefresh,
}: {
  details: any[];
  totals?: { totalAdvance: number };
  dateRange: { from: string; to: string };
  onDateChange: (field: "from" | "to", value: string) => void;
  selectedUser: string;
  onUserChange: (value: string) => void;
  onRefresh?: () => void;
}) {
  const { toast } = useToast();
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const data = await res.json();
      return data.users || [];
    },
  });
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const [isMonthWise, setIsMonthWise] = useState(false);

  // Same impersonation-aware "acting role" resolution the page already uses
  // (ReportTab's scope effect) to decide who may pick a different user.
  const activeRole = sessionStorage.getItem("userRole") ?? (currentUser as any)?.roleId;
  const canSelectUser = isManagerialRole(activeRole) || isCompanyWideRole(activeRole);

  // Same role-grouping convention already used for the user picker in
  // LoanReportTable's "Add Loan" form (groupedUsers), reused here for consistency.
  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (allUsers || []).forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(u);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [allUsers]);

  // The backend already scopes `details` to the selected user/date range
  // (GET /api/reports/vas) — nothing further to filter client-side.
  const filtered = details || [];

  // "Month Wise" groups the already-fetched records by calendar month of
  // report_date and shows a per-month subtotal, instead of a flat list.
  // vas_reports has no target/commission concept to compute month-by-month
  // (unlike the legacy PHP report), so this is a display-only regrouping of
  // the same real data — no figures are invented.
  const monthGroups = useMemo(() => {
    if (!isMonthWise) return null;
    const groups = new Map<string, any[]>();
    filtered.forEach((item) => {
      const d = item.date ? new Date(item.date) : null;
      const key = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        const label = key === "unknown"
          ? "Unknown Date"
          : new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const totalTasks = items.reduce((sum, it) => sum + (it.totalTasks ?? 0), 0);
        const valueSold = items.reduce((sum, it) => sum + (it.valueSold ?? 0), 0);
        const followUpsDone = items.reduce((sum, it) => sum + (it.followUpsDone ?? 0), 0);
        const missedLeads = items.reduce((sum, it) => sum + (it.missedLeads ?? 0), 0);
        const avgSuccessRate = items.length
          ? items.reduce((sum, it) => sum + (it.successRate ?? 0), 0) / items.length
          : null;
        return { key, label, items, totalTasks, valueSold, followUpsDone, missedLeads, avgSuccessRate };
      });
  }, [filtered, isMonthWise]);

  // Confirmed business rule (user-confirmed tier thresholds/rewards, matching
  // the existing legacy VAS commission report): applied once to the grand
  // total Amount across every row currently shown, not per-row — there is no
  // per-transaction commission concept, only a total-based tier lookup.
  const vasCommission = useMemo(() => {
    const totalAmount = filtered.reduce((sum, item) => sum + (item.valueSold ?? 0), 0);
    let per = 0;
    let reward = 0;
    if (totalAmount >= 150000) {
      per = 15; reward = 8000;
    } else if (totalAmount >= 100000) {
      per = 15; reward = 5000;
    } else if (totalAmount >= 50000) {
      per = 15; reward = 2500;
    } else if (totalAmount >= 1000) {
      per = 10; reward = 0;
    }
    const comm = (per / 100) * totalAmount;
    const finalComm = reward + comm;
    return { totalAmount, per, reward, comm, finalComm };
  }, [filtered]);

  const sourceLabels: Record<string, string> = {
    vas_reports: "VAS Report",
    product_posting_invoice: "Invoice (Product Posting)",
    invoice: "Invoice",
  };

  const vasExportColumns: ExportColumn[] = [
    { key: "source", header: "Source", format: (v) => sourceLabels[v] || "VAS Report" },
    { key: "company", header: "Company", format: (v) => v ?? "" },
    { key: "valueSold", header: "Amount", format: (v) => Number(v ?? 0) },
    { key: "method", header: "Method", format: (v) => v ?? "" },
    { key: "status", header: "Status" },
    { key: "date", header: "Date", format: (v) => (v ? new Date(v).toLocaleDateString() : "") },
  ];

  const handleCopy = async () => {
    if (!filtered.length) return;
    const header = vasExportColumns.map((c) => c.header).join("\t");
    const rows = filtered.map((item) =>
      vasExportColumns.map((c) => c.format ? c.format((item as any)[c.key as string], item) : (item as any)[c.key as string] ?? "").join("\t")
    );
    try {
      await navigator.clipboard.writeText([header, ...rows].join("\n"));
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const renderRow = (item: any, idx: number) => (
    <TableRow key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
      <TableCell className="text-center font-bold text-slate-700 py-4 dark:text-zinc-400">{idx + 1}</TableCell>
      <TableCell className="text-center text-slate-500 py-4 dark:text-zinc-400">
        <span className="inline-block rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium">
          {sourceLabels[item.source] || "VAS Report"}
        </span>
      </TableCell>
      {/* vas_reports rows have no company/method (that table doesn't store either) —
          "-" is honest here, not a loading state; invoice rows show their real values. */}
      <TableCell className="text-center font-bold text-slate-700 py-4 dark:text-zinc-400">{item.company || item.title || "-"}</TableCell>
      <TableCell className="text-center font-medium text-slate-700 py-4 dark:text-zinc-400">{Number(item.valueSold ?? 0).toLocaleString()}</TableCell>
      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">{item.method || "-"}</TableCell>
      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">{item.status || "-"}</TableCell>
      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">
        {item.date ? new Date(item.date).toLocaleDateString() : "-"}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-5">
      <DrmSection title="Filters">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select User</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="month-wise"
                    checked={isMonthWise}
                    onCheckedChange={(c) => setIsMonthWise(!!c)}
                  />
                  <label
                    htmlFor="month-wise"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600 dark:text-zinc-300"
                  >
                    Month Wise
                  </label>
                </div>
              </div>
              {canSelectUser ? (
                <Select value={selectedUser} onValueChange={onUserChange}>
                  <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800" data-testid="select-vas-user">
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
              ) : (
                <Input
                  readOnly
                  value={(currentUser as any)?.fullName || (currentUser as any)?.name || (currentUser as any)?.username || "Loading..."}
                  className="bg-[#f0f4f8] border-none h-11 text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
                />
              )}
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Start Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => onDateChange("from", e.target.value)}
                  className="bg-white border-slate-200 h-11 pr-10 dark:bg-zinc-900 dark:border-zinc-800"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">End Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => onDateChange("to", e.target.value)}
                  className="bg-white border-slate-200 h-11 pr-10 dark:bg-zinc-900 dark:border-zinc-800"
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-2">
              <UiButton type="button" size="lg" className="w-full" onClick={() => onRefresh && onRefresh()}>
                View
              </UiButton>
            </div>
          </div>
      </DrmSection>

      <DrmSection title="Results">
          <div className="mb-4">
            <UrExportButtonBar
              labels={["Copy", "Excel", "CSV", "PDF"]}
              onAction={(label) => {
                if (label === "Copy") void handleCopy();
                else if (label === "Excel") exportToExcel(filtered, vasExportColumns, "VAS_Report");
                else if (label === "CSV") exportToCSV(filtered, vasExportColumns, "VAS_Report");
                else exportToPDF(filtered, vasExportColumns, "VAS_Report", { title: "VAS Report" });
              }}
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className={urTableHeaderClass}>
                <TableRow className="border-b-0 hover:bg-emerald-50/90 dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">#</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Source</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Company</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Amount</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Method</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Status</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : isMonthWise && monthGroups ? (
                  monthGroups.map((group) => (
                    <Fragment key={group.key}>
                      <TableRow className="bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                        <TableCell colSpan={7} className="font-bold text-slate-700 dark:text-zinc-300 py-2">
                          {group.label} ({group.items.length})
                        </TableCell>
                      </TableRow>
                      {group.items.map((item: any, idx: number) => renderRow(item, idx))}
                      <TableRow className="border-b border-slate-200 dark:border-zinc-700">
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2">—</TableCell>
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2">—</TableCell>
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2"><b>Subtotal</b></TableCell>
                        <TableCell className="text-center font-semibold text-slate-700 dark:text-zinc-300 py-2">{group.valueSold.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2">—</TableCell>
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2">—</TableCell>
                        <TableCell className="text-center text-slate-500 dark:text-zinc-400 py-2">—</TableCell>
                      </TableRow>
                    </Fragment>
                  ))
                ) : (
                  filtered.map((item, idx) => renderRow(item, idx))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-slate-50 dark:bg-zinc-800/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60 border-t-2 border-slate-300 dark:border-zinc-700">
                    <TableCell className="text-center text-slate-500 dark:text-zinc-400">—</TableCell>
                    <TableCell className="text-center text-slate-500 dark:text-zinc-400">—</TableCell>
                    <TableCell className="text-center font-bold text-slate-700 dark:text-zinc-300">Total</TableCell>
                    <TableCell className="text-center font-bold text-slate-700 dark:text-zinc-300">{vasCommission.totalAmount.toLocaleString()}</TableCell>
                    <TableCell className="text-center text-slate-600 dark:text-zinc-300">
                      {vasCommission.totalAmount.toLocaleString()}-{vasCommission.per}% = {vasCommission.comm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center text-slate-600 dark:text-zinc-300">{vasCommission.reward.toLocaleString()}</TableCell>
                    <TableCell className="text-center font-bold text-slate-700 dark:text-zinc-300">
                      {vasCommission.finalComm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
      </DrmSection>
    </div>
  );
}

// "User Reports" sidebar group's VAS Report (plain /reports/vas) — kept
// exactly as it was before the vas_reports fix, a separate, pre-existing
// report the business still relies on as-is. Only the "Reports" sidebar
// group's VAS Report (/reports/vas?scope=company, VasReportTable above) was
// migrated to vas_reports. Do not merge these back together without an
// explicit decision to retire one of them.
function LegacyVasReportTable({
  details,
  totals,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange
}: {
  details: any[];
  totals?: { totalAdvance: number };
  dateRange: { from: string; to: string };
  onDateChange: (field: "from" | "to", value: string) => void;
  selectedUser: string;
  onUserChange: (value: string) => void;
}) {
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const data = await res.json();
      return data.users || [];
    },
  });
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const [isMonthWise, setIsMonthWise] = useState(false);

  const filtered = useMemo(() => details || [], [details]);

  const legacyVasColumns: DataTableColumn<any>[] = useMemo(
    () => [
      {
        id: "company",
        header: "Company",
        headerClassName: "text-center",
        className: "text-center font-medium",
        cell: (row) => row.companyName || "—",
      },
      {
        id: "amount",
        header: "Amount",
        headerClassName: "text-center",
        className: "text-center tabular-nums",
        cell: (row) => Number(row.amount || 0).toLocaleString(),
      },
      {
        id: "method",
        header: "Method",
        headerClassName: "text-center",
        className: "text-center",
        cell: (row) => row.method || "—",
      },
      {
        id: "date",
        header: "Date",
        headerClassName: "text-center",
        className: "text-center whitespace-nowrap text-zinc-600 dark:text-zinc-400",
        cell: (row) =>
          row.date
            ? new Date(row.date).toLocaleString([], {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).replace(",", "")
            : "—",
      },
      {
        id: "commission",
        header: "Commission %",
        headerClassName: "text-center",
        className: "text-center tabular-nums",
        cell: (row) => `${Number(row.commissionPercent || 0)}%`,
      },
      {
        id: "reward",
        header: "Reward",
        headerClassName: "text-center",
        className: "text-center tabular-nums",
        cell: (row) => Number(row.reward || 0).toLocaleString(),
      },
      {
        id: "final",
        header: "Final commission",
        headerClassName: "text-center",
        className: "text-center font-semibold tabular-nums",
        cell: (row) => Number(row.finalCommission || 0).toLocaleString(),
      },
    ],
    [],
  );

  const userDisplay =
    (currentUser as any)?.fullName ||
    (currentUser as any)?.name ||
    (currentUser as any)?.username ||
    "Loading…";

  return (
    <div className="space-y-5">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <Field id="vas-legacy-user" label="User">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input readOnly value={userDisplay} className={cn(drmFieldClass, "h-9 flex-1")} />
                <label
                  htmlFor="month-wise-legacy"
                  className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  <Checkbox
                    id="month-wise-legacy"
                    checked={isMonthWise}
                    onCheckedChange={(c) => setIsMonthWise(!!c)}
                  />
                  Month wise
                </label>
              </div>
            </Field>
          </div>
          <Field id="vas-legacy-from" label="Start date" className="md:col-span-3">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => onDateChange("from", e.target.value)}
              className={cn(drmFieldClass, "h-9")}
            />
          </Field>
          <Field id="vas-legacy-to" label="End date" className="md:col-span-3">
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => onDateChange("to", e.target.value)}
              className={cn(drmFieldClass, "h-9")}
            />
          </Field>
          <div className="md:col-span-2">
            <UiButton type="button" size="lg" className="mt-6 w-full md:mt-0">
              View
            </UiButton>
          </div>
        </div>
      </DrmSection>

      <DrmSection title="Results">
        <DataTable
          caption="VAS report rows"
          columns={legacyVasColumns}
          rows={filtered}
          rowKey={(row) => String(row.id ?? `${row.companyName}-${row.date}`)}
          emptyMessage="No records found."
        />
      </DrmSection>
    </div>
  );
}

function LoanReportTable({
  loans,
  totals,
  activeSubTab,
  setActiveSubTab
}: {
  loans: LoanDetail[];
  totals?: { totalAdvance: number; totalRemaining: number };
  activeSubTab: "list" | "add" | "history";
  setActiveSubTab: (tab: "list" | "add" | "history") => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const safeLoans = loans ?? [];
  const [search, setSearch] = useState("");
  const [viewItem, setViewItem] = useState<LoanDetail | null>(null);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showLoanHistory, setShowLoanHistory] = useState(false);
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  const uniqueEmployees = useMemo(() => {
    const names = safeLoans.map(l => l.employeeName).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [safeLoans]);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const isManager = currentUser?.role && ['admin', 'manager', 'hod', 'assistant_manager', 'super_hod', 'super_admin'].some(r => currentUser.role.toLowerCase().includes(r));

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const data = await res.json();
      return data.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    (allUsers || []).forEach((user) => {
      const role = user.role || 'Unassigned Role';
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(user);
    });
    return Object.entries(grouped)
      .map(([role, users]) => ({ role, users }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [allUsers]);

  // Mutation for creating loans (admin endpoint)
  const createLoanMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: string; installmentAmount: string; detail: string }) => {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create loan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", "loan"] });
      toast({ title: "Success", description: "Loan request created successfully" });
      setActiveSubTab("list");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddLoan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userId = formData.get("userId") as string;
    const amount = formData.get("amount") as string;
    const installmentAmount = formData.get("installmentAmount") as string;
    const detail = formData.get("detail") as string;

    if (!userId || !amount || !installmentAmount || !detail) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }

    createLoanMutation.mutate({ userId, amount, installmentAmount, detail });
  };

  const filtered = useMemo(() => {
    let result = safeLoans;

    if (showLoanHistory) {
      if (appliedStart) {
        const start = new Date(appliedStart);
        start.setHours(0, 0, 0, 0);
        result = result.filter(l => l.date && new Date(l.date).getTime() >= start.getTime());
      }
      if (appliedEnd) {
        const end = new Date(appliedEnd);
        end.setHours(23, 59, 59, 999);
        result = result.filter(l => l.date && new Date(l.date).getTime() <= end.getTime());
      }
    }

    if (selectedEmployee !== "all") {
      result = result.filter(l => l.employeeName === selectedEmployee);
    }
    const term = search.trim().toLowerCase();
    if (!term) return result;
    return result.filter((l) =>
      [
        l.employeeName,
        l.detail,
        l.status,
        l.managerName || "",
        l.hodName || "",
        String(l.amount || ""),
        String(l.installmentAmount || ""),
        String(l.remainingAmount || ""),
        l.date ? new Date(l.date).toLocaleDateString() : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [safeLoans, search, selectedEmployee, showLoanHistory, appliedStart, appliedEnd]);

  const totalAdvance = totals?.totalAdvance ?? safeLoans.reduce((sum, l) => sum + Number(l.amount || 0), 0);
  const totalRemaining = totals?.totalRemaining ?? safeLoans.reduce((sum, l) => sum + Number(l.remainingAmount || 0), 0);
  const exportRows = filtered.map((loan, idx) => ({
    no: idx + 1,
    employee: loan.employeeName,
    advance: Number(loan.amount || 0),
    detail: loan.detail,
    installment: Number(loan.installmentAmount || 0),
    remaining: Number(loan.remainingAmount || 0),
    manager: loan.managerName ?? "-",
    hod: loan.hodName ?? "-",
    date: loan.date ? new Date(loan.date).toLocaleDateString() : "-",
  }));
  const headers = ["No", "Employee", "Advance", "Detail", "Installment", "Remaining", "Manager", "Hod", "Date"];

  const downloadBlob = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: "Copy" | "CSV" | "Excel" | "PDF") => {
    const rows = [headers, ...exportRows.map(r => [
      r.no,
      r.employee ?? "",
      r.advance,
      r.detail ?? "",
      r.installment,
      r.remaining,
      r.manager ?? "",
      r.hod ?? "",
      r.date ?? "",
    ])];

    const toCsv = (data: (string | number)[][]) =>
      data
        .map(row =>
          row
            .map(value => {
              const str = value === undefined || value === null ? "" : String(value);
              return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
            })
            .join(",")
        )
        .join("\n");

    try {
      switch (type) {
        case "Copy": {
          const tsv = rows.map(r => r.join("\t")).join("\n");
          await navigator.clipboard.writeText(tsv);
          toast({ title: "Copied to clipboard" });
          break;
        }
        case "CSV": {
          const csv = toCsv(rows);
          downloadBlob(csv, "loan-report.csv", "text/csv");
          toast({ title: "CSV downloaded" });
          break;
        }
        case "Excel": {
          const csv = toCsv(rows);
          downloadBlob(csv, "loan-report.xls", "application/vnd.ms-excel");
          toast({ title: "Excel downloaded" });
          break;
        }
        case "PDF": {
          const html = `
            <html>
              <head><title>Loan Report</title></head>
              <body>
                <h3>Loan Report</h3>
                <table border="1" cellspacing="0" cellpadding="4">
                  <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
                  <tbody>
                    ${exportRows
              .map(
                r =>
                  `<tr><td>${r.no}</td><td>${r.employee ?? ""}</td><td>${r.advance}</td><td>${r.detail ?? ""}</td><td>${r.installment}</td><td>${r.remaining}</td><td>${r.manager}</td><td>${r.hod}</td><td>${r.date}</td></tr>`
              )
              .join("")}
                  </tbody>
                </table>
              </body>
            </html>`;
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const win = window.open(url);
          if (win) {
            win.addEventListener("load", () => {
              win.print();
              win.close();
            });
          }
          toast({ title: "PDF ready to print" });
          break;
        }
      }
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message || "Please try again", variant: "destructive" });
    }
  };

  const loanTab = showAddLoan ? "add" : showLoanHistory ? "history" : "list";

  const loanSectionNav = (
    <nav
      className="inline-flex flex-wrap rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/50"
      aria-label="Loan report sections"
    >
      {(
        [
          { id: "list" as const, label: "List", onClick: () => { setShowAddLoan(false); setShowLoanHistory(false); } },
          { id: "add" as const, label: "Add loan", onClick: () => { setShowAddLoan(true); setShowLoanHistory(false); } },
          { id: "history" as const, label: "History", onClick: () => { setShowAddLoan(false); setShowLoanHistory(true); } },
        ] as const
      ).map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={tab.onClick}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition",
            loanTab === tab.id
              ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );

  return (
    <DrmSection title="Advance salary" actions={loanSectionNav}>
      <div className="space-y-6">
        {showAddLoan && (
          <form onSubmit={handleAddLoan} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee</Label>
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 h-9 text-xs text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0"
              />
              <input type="hidden" name="userId" value={currentUser?.id || currentUser?.userId || ""} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Amount:</Label>
              <Input name="amount" type="number" step="0.01" required placeholder="00:00" className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Instalment:</Label>
              <Input name="installmentAmount" type="number" step="0.01" required placeholder="Instalment" className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Detail</Label>
              <Textarea name="detail" required placeholder="add detail" className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 min-h-[36px] py-1.5 text-xs resize-none" />
            </div>
            <div className="md:col-span-5">
              <UiButton type="submit" disabled={createLoanMutation.isPending}>
                {createLoanMutation.isPending ? "..." : "Submit"}
              </UiButton>
            </div>
          </form>
        )}

        {showLoanHistory && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee</Label>
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 h-9 text-xs text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start:</Label>
              <Input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End:</Label>
              <Input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs" />
            </div>
            <div className="md:col-span-5">
              <UiButton
                type="button"
                onClick={() => {
                  setAppliedStart(historyStart);
                  setAppliedEnd(historyEnd);
                }}
              >
                View
              </UiButton>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <UrExportButtonBar labels={["Copy", "Excel", "CSV", "PDF"]} onAction={(label) => handleExport(label as "Copy" | "CSV" | "Excel" | "PDF")} />
            {isManager && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-600 dark:text-zinc-400">Filter:</span>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-[200px] h-8 bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 text-xs rounded-sm focus-visible:ring-0">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {allUsers?.filter(u => u.fullName || u.username).map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-600 dark:text-zinc-400">Search:</span>
            <Input
              className="w-[200px] h-8 bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 text-xs rounded-sm focus-visible:ring-0 focus-visible:border-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <Table className="w-full text-[13px]">
            <TableHeader className={urTableHeaderClass}>
              <TableRow className="border-b border-zinc-200 hover:bg-transparent dark:border-zinc-800">
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>No#</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>Employee</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>Advance</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left w-1/4", urTableHeadClass)}>Detail</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>Instalment</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>Remaining</TableHead>
                <TableHead className={cn("py-2.5 px-3 text-left", urTableHeadClass)}>Date</TableHead>
                {isManager && <TableHead className={cn("py-2.5 px-3 text-center", urTableHeadClass)}>Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-zinc-950">
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={isManager ? 8 : 7} className="text-center text-muted-foreground py-4">
                    No data available in table
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((loan, idx) => (
                  <TableRow key={loan.id} className="border-b border-white dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800 transition-colors">
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{idx + 1}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 font-semibold">{loan.employeeName} (Main)</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.amount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 truncate max-w-[200px]">{loan.detail}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.installmentAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.remainingAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 whitespace-nowrap">
                      {loan.date ? new Date(loan.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "-"}
                    </TableCell>
                    {isManager && (
                      <TableCell className="py-3 px-3 text-center">
                        <button onClick={() => setViewItem(loan)} className="text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-plus-circle" viewBox="0 0 16 16">
                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                          </svg>
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {safeLoans.length} entries
        </p>
        <Dialog open={!!viewItem} onOpenChange={(open) => setViewItem(open ? viewItem : null)}>
          <DialogContent className="max-w-[450px] p-0 gap-0">
            <DialogHeader className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <DialogTitle className="text-[17px] font-bold text-[#555] dark:text-zinc-100 text-left">Pay Loan</DialogTitle>
            </DialogHeader>
            {viewItem && (
              <form onSubmit={(e) => {
                e.preventDefault();
                // TODO: implement loan payment submission logic
                setViewItem(null);
              }} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Name</Label>
                  <Input readOnly value={viewItem.employeeName} className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-[#555] dark:text-zinc-300 h-9 focus-visible:ring-0 cursor-not-allowed" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Remaning</Label>
                  <Input readOnly value={Number(viewItem.remainingAmount || 0).toString()} className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-[#555] dark:text-zinc-300 h-9 focus-visible:ring-0" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Pay</Label>
                  <Input type="number" step="0.01" placeholder="00:00" className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 text-[#555] h-9 focus-visible:ring-0" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Status</Label>
                  <Select defaultValue="Pending">
                    <SelectTrigger className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 text-[#555] h-9 focus-visible:ring-0">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setViewItem(null)} className="bg-[#f0f2f5] dark:bg-zinc-800 text-[#555] dark:text-zinc-300 hover:bg-[#e4e6e9] dark:hover:bg-zinc-700 border-none px-5 h-9 text-[13px] font-semibold">
                    Close
                  </Button>
                  <UiButton type="submit" size="sm">
                    Save
                  </UiButton>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DrmSection>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color = "text-primary",
  suffix,
  testId
}: {
  title: string;
  value: number | string;
  icon: typeof TrendingUp;
  color?: string;
  suffix?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`} data-testid={`${testId}-value`}>
              {value}{suffix}
            </p>
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-80`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ReportChart({ data, type, details }: { data: ChartDataPoint[]; type: ReportType; details?: any[] }) {
  const formattedData = useMemo(() => data.map(d => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  })), [data]);

  const statusData = useMemo(() => {
    if (type !== 'loan' || !details) return [];
    const counts: Record<string, number> = {};
    details.forEach(l => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [type, details]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-sm border-border/50 bg-white backdrop-blur-sm dark:bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Loan Disbursement Tren (Monthly)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData || []}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2b76b9" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#2b76b9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val.toLocaleString()}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Amount"
                  stroke="#2b76b9"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {type === 'loan' && statusData.length > 0 && (
        <Card className="shadow-sm border-border/50 bg-white backdrop-blur-sm dark:bg-zinc-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Loan Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ border: 'none', borderRadius: '8px', backgroundColor: 'hsl(var(--card))', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportDetails({ details, type }: { details: any[]; type: ReportType }) {
  if (!details || details.length === 0) {
    return (
      <Card data-testid="card-report-details">
        <CardContent className="p-6 text-center text-muted-foreground">
          No records found for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-report-details">
      <CardHeader>
        <CardTitle className="text-lg">Detailed Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {type === "loan" && (
                  <>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Amount</th>
                    <th className="text-left p-2">Installment</th>
                    <th className="text-left p-2">Status</th>
                  </>
                )}
                {type === "vas" && (
                  <>
                    <th className="text-left p-2">Period</th>
                    <th className="text-left p-2">Amount</th>
                    <th className="text-left p-2">Target</th>
                    <th className="text-left p-2">Achievement</th>
                    <th className="text-left p-2">Follow-ups</th>
                    <th className="text-left p-2">Missed Leads</th>
                    <th className="text-left p-2">Title/Status</th>
                  </>
                )}
                {type === "gm" && (
                  <>
                    <th className="text-left p-2">Company</th>
                    <th className="text-left p-2">Account</th>
                    <th className="text-left p-2">Grade</th>
                    <th className="text-left p-2">Date</th>
                  </>
                )}
                {type === "bv" && (
                  <>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Value</th>
                    <th className="text-left p-2">Success Rate</th>
                    <th className="text-left p-2">Date</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {details.slice(0, 10).map((item, idx) => (
                <tr key={item.id || idx} className="border-b hover-elevate" data-testid={`row-report-${idx}`}>
                  {type === "loan" && (
                    <>
                      <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="p-2 font-medium">${parseFloat(item.amount).toLocaleString()}</td>
                      <td className="p-2">${parseFloat(item.installmentAmount).toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant={item.status === "HODApproved" || item.status === "Completed" ? "default" : "secondary"}>
                          {item.status}
                        </Badge>
                      </td>
                    </>
                  )}
                  {type === "vas" && (
                    <>
                      <td className="p-2">{item.month}/{item.year}</td>
                      <td className="p-2 font-medium">${parseFloat(item.amount).toLocaleString()}</td>
                      <td className="p-2">${parseFloat(item.targetAmount).toLocaleString()}</td>
                      <td className="p-2">
                        <Badge variant={parseFloat(item.amount) >= parseFloat(item.targetAmount) ? "default" : "secondary"}>
                          {Math.round((parseFloat(item.amount) / parseFloat(item.targetAmount)) * 100)}%
                        </Badge>
                      </td>
                      <td className="p-2">{item.followUpsDone ?? 0}</td>
                      <td className="p-2">{item.missedLeads ?? 0}</td>
                      <td className="p-2">{item.title || "-"} / {item.status || "-"}</td>
                    </>
                  )}
                  {type === "gm" && (
                    <>
                      <td className="p-2 font-medium">{item.companyName}</td>
                      <td className="p-2">{item.accountName}</td>
                      <td className="p-2">
                        <Badge variant="outline">{item.grade}</Badge>
                      </td>
                      <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                    </>
                  )}
                  {type === "bv" && (
                    <>
                      <td className="p-2 font-medium">{item.title || "-"}</td>
                      <td className="p-2">{item.status || "-"}</td>
                      <td className="p-2">${Number(item.valueSold || 0).toLocaleString()}</td>
                      <td className="p-2">{Number(item.successRate || 0)}%</td>
                      <td className="p-2">
                        {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {details.length > 10 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing 10 of {details.length} records
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportTab({
  type,
  dateRange,
  loanActiveSubTab,
  setLoanActiveSubTab,
  onDateChange,
  scope,
}: {
  type: ReportType;
  dateRange: { from: string; to: string };
  loanActiveSubTab: "list" | "add" | "history";
  setLoanActiveSubTab: (tab: "list" | "add" | "history") => void;
  onDateChange: (field: "from" | "to", value: string) => void;
  scope?: string | null;
}) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const [selectedUser, setSelectedUser] = useState<string>("all");

  // Switching between the "User Reports" and "Reports" sidebar links doesn't
  // remount this component (same route, only ?scope differs), so re-arm the
  // smart-default effect below whenever scope changes — otherwise whatever
  // selectedUser got resolved for the FIRST link visited would stick forever.
  useEffect(() => {
    setSelectedUser("all");
  }, [scope]);

  // Default scope:
  //  - "Reports" group link (?scope=company) + HOD/Account/Admin -> stays "all" (whole company).
  //  - "User Reports" group link (no scope) + a manager with a team -> "team" (their direct reports).
  //  - Everyone else (plain executives, or HOD/Account/Admin on their personal link) -> their own record.
  useEffect(() => {
    if (!currentUser || selectedUser !== "all") return;
    // The currently-ACTING role (impersonation-aware) lives in sessionStorage,
    // same as every other role-gated view in this app — currentUser.roleId
    // from /api/auth/me reflects the underlying authenticated identity, not
    // the active "acting as" role, so it's the wrong source for this check.
    const role = sessionStorage.getItem("userRole") ?? currentUser.roleId;
    if (scope === "company" && isCompanyWideRole(role)) return;
    if (isManagerialRole(role) && !isCompanyWideRole(role)) {
      setSelectedUser("team");
    } else {
      setSelectedUser(currentUser.userId || currentUser.id);
    }
  }, [currentUser, selectedUser, scope]);

  const { data: report, isLoading, isFetching, isError, refetch } = useQuery<ReportData>({
    queryKey: ["/api/reports", type, dateRange.from, dateRange.to, selectedUser, scope],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        userId: selectedUser
      });
      if (scope) params.set("scope", scope);
      const response = await apiRequest("GET", `/api/reports/${type}?${params}`);
      return response.json();
    },
    retry: 1,
    // Changing a filter (user/date) changes the queryKey, which React Query
    // otherwise treats as a brand-new, uncached query — isLoading goes true
    // and the whole page below is replaced with a small spinner box, then
    // swaps back once data arrives. That collapse/expand on every filter
    // change is what reads as "the page scrolling". Keeping the previous
    // page's data on screen during the refetch (isFetching still reflects
    // the in-flight request for a subtle loading cue) avoids the layout jump.
    placeholderData: keepPreviousData,
  });

  const handleExport = async (format: string) => {
    setIsExporting(format);
    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        format,
        userId: selectedUser,
      });
      if (scope) params.set("scope", scope);
      await downloadAuthedFile(
        `/api/reports/${type}/export?${params}`,
        `${type}_report.${format}`,
      );

      toast({
        title: "Export Complete",
        description: `Report downloaded as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Could not export the report",
        variant: "destructive",
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleEmail = async () => {
    try {
      await apiRequest("POST", `/api/reports/${type}/email`, {
        includeDetails: true,
      });
      toast({
        title: "Email Queued",
        description: "Report will be sent to your email shortly",
      });
    } catch (error) {
      toast({
        title: "Email Failed",
        description: "Could not send the report",
        variant: "destructive",
      });
    }
  };

  const setHeaderActions = useUserReportsHeaderActions();

  useEffect(() => {
    if (isLoading || isError || !report) {
      setHeaderActions(null);
      return;
    }
    setHeaderActions(
      <>
        <UiButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handleExport("csv")}
          disabled={isExporting === "csv"}
          data-testid="button-export-csv"
        >
          {isExporting === "csv" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          CSV
        </UiButton>
        <UiButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => handleExport("json")}
          disabled={isExporting === "json"}
          data-testid="button-export-json"
        >
          {isExporting === "json" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          JSON
        </UiButton>
        <UiButton type="button" variant="secondary" size="sm" onClick={handleEmail} data-testid="button-email-report">
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Email
        </UiButton>
      </>,
    );
    return () => setHeaderActions(null);
  }, [isLoading, isError, report, isExporting, setHeaderActions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-report">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <Card data-testid="error-report">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-muted-foreground">Failed to load report data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-5 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
      {type === "loan" && (
        <LoanReportTable
          loans={(report.details as LoanDetail[]) ?? []}
          totals={report.totals}
          activeSubTab={loanActiveSubTab}
          setActiveSubTab={setLoanActiveSubTab}
        />
      )}

      {type === "vas" && (
        scope === "company" ? (
          <VasReportTable
            details={report.details ?? []}
            totals={report.totals}
            dateRange={dateRange}
            onDateChange={onDateChange}
            selectedUser={selectedUser}
            onUserChange={setSelectedUser}
            onRefresh={refetch}
          />
        ) : (
          <LegacyVasReportTable
            details={report.details ?? []}
            totals={report.totals}
            dateRange={dateRange}
            onDateChange={onDateChange}
            selectedUser={selectedUser}
            onUserChange={setSelectedUser}
          />
        )
      )}

      {type === "gm" && (
          <GmReportTable
          details={report.details ?? []}
          totals={report.totals}
          dateRange={dateRange}
          onDateChange={onDateChange}
          selectedUser={selectedUser}
          onUserChange={setSelectedUser}
          onRefresh={refetch}
        />
      )}

      {type === "bv" && (
        <BvReportTable
          details={report.details ?? []}
          totals={report.totals}
          personAchievement={(report as any).personAchievement}
          dateRange={dateRange}
          onDateChange={onDateChange}
          selectedUser={selectedUser}
          onUserChange={setSelectedUser}
          scope={scope}
        />
      )}

      {type !== "loan" && type !== "vas" && type !== "gm" && type !== "bv" && (
        <ReportDetails details={report.details} type={type} />
      )}
    </div>
  );
}

export function UserReportsView({
  reportType,
  scope,
}: {
  reportType: ReportType;
  scope?: string | null;
}) {
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then((r) => r.json()),
  });
  const [loanActiveSubTab, setLoanActiveSubTab] = useState<"list" | "add" | "history">("list");

  const today = new Date();
  const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const [dateRange, setDateRange] = useState({
    from: defaultFromDate.toISOString().split("T")[0],
    to: today.toISOString().split("T")[0],
  });

  const handleDateChange = (field: "from" | "to", value: string) => {
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const header = reportTypeLabels[reportType];
  const activeRole = currentUser?.activeRoleId ?? currentUser?.role ?? null;

  return (
    <UserReportsHeaderActionsProvider>
      <UserReportsShell
        title={header.title}
        description={header.description}
        actions={
          <>
            {scope === "company" && isCompanyWideRole(activeRole) && (
              <ThemeBadge variant="brand">Global view</ThemeBadge>
            )}
            {!(scope === "company" && isCompanyWideRole(activeRole)) &&
              isManagerialRole(activeRole) &&
              !isCompanyWideRole(activeRole) && (
                <ThemeBadge variant="neutral">Team view</ThemeBadge>
              )}
          </>
        }
      >
        <ReportTab
          type={reportType}
          dateRange={dateRange}
          loanActiveSubTab={loanActiveSubTab}
          setLoanActiveSubTab={setLoanActiveSubTab}
          onDateChange={handleDateChange}
          scope={scope ?? null}
        />
      </UserReportsShell>
    </UserReportsHeaderActionsProvider>
  );
}
