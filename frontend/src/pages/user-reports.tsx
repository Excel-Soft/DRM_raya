import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useModuleData } from "@/hooks/use-module-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Loader2,
  Eye,
  Receipt
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
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
import { apiRequest, apiRequestJson, getAuthHeader, extractApiError } from "@/lib/queryClient";
import { downloadAuthedFile } from "@/lib/download";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groupUsersByRoleTitle } from "@/lib/user-role-groups";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

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
  userId?: string | null;
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
    totalRepaid?: number;
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
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">GM SYSTEM</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Button onClick={() => onRefresh && onRefresh()} className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8 h-11 font-bold text-lg rounded-md">
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">GM View</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Search:</span>
            <Input
              className="h-8 w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          <div className="px-4 mb-4 flex items-center gap-2">
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
              <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
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
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{gmTypeLabel(item.rcNew)}</TableCell>
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
                className="bg-[#008d4c] hover:bg-[#00733e]"
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
        </CardContent>
      </Card>
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
// BV Report "Comm" cell: admin / HOD / Account can override the commission for a GM
// (old DRM finalComm). Saved on the GM; ↺ clears it back to the computed value.
function EditableCommCell({ item, canEdit }: { item: any; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const gmId = item?.gmEntryId as string | undefined;
  const save = useMutation({
    mutationFn: async (comm: number | null) => {
      const res = await apiRequest("PATCH", `/api/reports/bv/comm/${gmId}`, { comm });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/reports"] });
      toast({ title: "Commission updated" });
    },
    onError: (err: any) => toast({ title: "Could not update commission", description: err?.message, variant: "destructive" }),
  });
  const shown = item?.comm ?? "-";
  if (!canEdit || !gmId) return <>{typeof shown === "number" ? shown.toLocaleString() : shown}</>;
  if (editing) {
    const submit = () => {
      const n = Number(value);
      if (value.trim() === "" || !Number.isFinite(n) || n < 0) {
        toast({ title: "Enter a commission of 0 or more", variant: "destructive" });
        return;
      }
      save.mutate(n);
    };
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-20 h-7 rounded border border-slate-300 px-1 text-center text-sm dark:border-zinc-700 dark:bg-zinc-900"
          disabled={save.isPending}
        />
        <button type="button" title="Save" className="text-emerald-600 font-bold" disabled={save.isPending} onClick={submit}>✓</button>
        <button type="button" title="Cancel" className="text-slate-400" onClick={() => setEditing(false)}>✕</button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        title="Edit commission"
        className={`rounded px-1 hover:bg-emerald-50 hover:underline dark:hover:bg-zinc-800 ${item?.commEdited ? "font-semibold text-amber-600" : ""}`}
        onClick={() => { setValue(String(item?.comm ?? "")); setEditing(true); }}
      >
        {typeof shown === "number" ? shown.toLocaleString() : shown}
      </button>
      {item?.commEdited && (
        <button type="button" title="Reset to computed commission" className="text-xs text-slate-400 hover:text-slate-700"
          disabled={save.isPending} onClick={() => save.mutate(null)}>↺</button>
      )}
    </div>
  );
}

// Old DRM BV report footer (func.php user_id_gm_bv_view <tfoot>) for one
// selected user — computed by the backend (getBvCompanyLegacyReport).
type BvLegacyFooter = {
  personId: string;
  targetName: string | null;
  achieved: number;
  targetQuota: number;
  teamTotal: number;
  achievePct: number;
  rewardOverride: number | null;
  rewardInFinal: boolean;
  rcRate: number;
};

type BvPersonTotals = {
  comm: number;
  reward: number;
  price: number;
  extraDisc: number;
  vas: number;
  kwa: number;
  rcCount: number;
};

// Status flow: Verified by HOD -> Pending acknowledgement -> Acknowledged -> Paid.
/** Old func.php status text for a webxl_vas_comm_final row. */
function legacyCommStatusText(r: any): string {
  if (r?.hodStatus === "Approved" && r?.userStatus === "Verified") return "Already Created";
  if (r?.hodStatus === "Approved") return "Sale Person Side Pending";
  return "Not Create By Hod";
}

function BvCommissionStatus({ record }: { record: any }) {
  if (record?.legacy) {
    const text = legacyCommStatusText(record);
    return (
      <span className="flex flex-wrap items-center gap-1">
        <Badge className={text === "Already Created" ? "bg-emerald-600 text-white hover:bg-emerald-600" : "bg-amber-500 text-white hover:bg-amber-500"}>
          Status: {text}
        </Badge>
        {record.accountPayStatus === "Paid" && (
          <Badge className="bg-green-700 text-white hover:bg-green-700">Paid</Badge>
        )}
      </span>
    );
  }
  const acknowledged = record.userStatus === "Confirmed" || record.userStatus === "Verified";
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Verified by HOD</Badge>
      {acknowledged ? (
        <Badge className="bg-sky-600 text-white hover:bg-sky-600">Acknowledged</Badge>
      ) : (
        <Badge className="bg-amber-500 text-white hover:bg-amber-500">Pending acknowledgement</Badge>
      )}
      {record.accountPayStatus === "Paid" ? (
        <Badge className="bg-green-700 text-white hover:bg-green-700">
          Paid {Number(record.finalPayAmount ?? 0).toLocaleString()}
        </Badge>
      ) : acknowledged ? (
        <Badge variant="outline">Payment pending</Badge>
      ) : null}
    </span>
  );
}

/** Old KWA footer: the month's 'Service' commission row from webxl_vas_comm_final. */
function KwaServiceCommStatus({ personId, dateFrom }: { personId: string; dateFrom: string }) {
  const d = new Date(dateFrom);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const { data } = useQuery<any>({
    queryKey: ["/api/bv-commission-verifications", "service", personId, month, year],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bv-commission-verifications?userId=${personId}&month=${month}&year=${year}`);
      if (!res.ok) return null;
      return (await res.json()).legacyService ?? null;
    },
  });
  if (!data) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-3 text-sm">
      <span className="font-bold">Service Com: {Number(data.finalPayAmount ?? 0).toLocaleString()}</span>
      <BvCommissionStatus record={data} />
    </div>
  );
}

function BvCommissionPanelRow({
  personId,
  personName,
  totals,
  achievement,
  footer,
  commPeriod,
  canManage,
  canPay,
  currentUserId,
}: {
  personId: string;
  personName: string;
  totals: BvPersonTotals;
  achievement?: { targetName: string; targetQuota: number | null; achievedCount: number };
  footer?: BvLegacyFooter | null;
  commPeriod: { month: number; year: number };
  canManage: boolean;
  canPay: boolean;
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
  const [payInput, setPayInput] = useState("");

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

  // Old footer: Reward = column sum unless the target-reached override applies;
  // Final Com = Comm (current, incl. edited cells) + Reward only when the
  // target was reached (P >= T), + the HOD-typed Reward AB.
  const reward = footer ? (footer.rewardOverride ?? totals.reward) : totals.reward;
  const rewardForFinal = footer ? (footer.rewardInFinal ? reward : 0) : totals.reward;
  const abReward = Number(abRewardInput) || 0;
  const finalCom = totals.comm + rewardForFinal + abReward;

  const createCommMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bv-commission-verifications", {
        userId: personId,
        month: commPeriod.month,
        year: commPeriod.year,
        totalComm: totals.comm,
        // Server stores final = totalComm + totalReward + abReward.
        totalReward: rewardForFinal,
        abReward: abRewardInput.trim() ? Number(abRewardInput) : undefined,
        rewardComment: rewardCommentInput.trim() || undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Commission verified", description: `Sent to ${personName} for acknowledgement.` });
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
      queryClient.invalidateQueries({ queryKey: ["/api/bv-commission-verifications/pending-mine"] });
      toast({ title: "Acknowledged", description: "Commission acknowledged." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to acknowledge", description: err?.message || "Could not acknowledge", variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bv-commission-verifications/${commRecord?.id}/pay`, {
        finalPayAmount: payInput.trim() ? Number(payInput) : undefined,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Marked as paid" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to mark as paid", description: err?.message || "Could not update", variant: "destructive" });
    },
  });

  const isSelf = currentUserId === personId;
  const isLegacyRec = !!commRecord?.legacy;
  const acknowledged = commRecord && !isLegacyRec && (commRecord.userStatus === "Confirmed" || commRecord.userStatus === "Verified");

  const actions = commLoading ? (
    <span className="text-xs text-muted-foreground">Loading commission status...</span>
  ) : commRecord ? (
    <>
      <span className="font-bold">Final Com: {Number(commRecord.finalPayAmount ?? commRecord.totalComm).toLocaleString()}</span>
      {commRecord.abReward != null && (
        <span className="font-bold">AB Reward: {Number(commRecord.abReward).toLocaleString()}</span>
      )}
      {commRecord.rewardComment && (
        <span className="text-muted-foreground">Reward Comment: {commRecord.rewardComment}</span>
      )}
      <BvCommissionStatus record={commRecord} />
      {!acknowledged && !isLegacyRec && isSelf && (
        <Button size="sm" onClick={() => confirmCommMutation.mutate()} disabled={confirmCommMutation.isPending}>
          Acknowledge
        </Button>
      )}
      {acknowledged && commRecord.accountPayStatus !== "Paid" && canPay && (
        <>
          <Input
            type="number"
            min={0}
            placeholder={String(Number(commRecord.finalPayAmount ?? 0))}
            value={payInput}
            onChange={(e) => setPayInput(e.target.value)}
            className="h-8 w-28 text-xs"
          />
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
          >
            Pay
          </Button>
        </>
      )}
    </>
  ) : canManage ? (
    achievement || footer ? (
      <>
        <span className="font-bold">Reward AB</span>
        <Input
          type="number"
          placeholder="0"
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
        <span className="font-bold">Final Com: {finalCom.toLocaleString()}</span>
        <Button size="sm" onClick={() => createCommMutation.mutate()} disabled={createCommMutation.isPending}>
          Verify
        </Button>
      </>
    ) : (
      <span className="text-xs text-muted-foreground">
        Commission can't be verified until a target is assigned to this salesperson (Set Target).
      </span>
    )
  ) : (
    <>
      <span className="font-bold">Final Com: {finalCom.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">Not yet verified by HOD/Account.</span>
    </>
  );

  const cell = "text-center font-bold text-black dark:text-zinc-300";
  return (
    <>
      {footer && (
        // Same cells as the old footer, under the matching columns.
        <TableRow className="bg-[#e6f7f2] dark:bg-zinc-900 hover:bg-[#e6f7f2] dark:hover:bg-zinc-900">
          <TableCell className="font-bold text-black dark:text-zinc-300 whitespace-nowrap" title="Achieved / target / team new sales">
            T.No# {footer.achieved}/{Math.round(footer.targetQuota * 10) / 10}/{footer.teamTotal}
          </TableCell>
          <TableCell className="font-bold text-black dark:text-zinc-300">Achive ({footer.achievePct}%)</TableCell>
          <TableCell className="font-bold text-black dark:text-zinc-300">Team# {footer.teamTotal}</TableCell>
          <TableCell className={cell}>{totals.price.toLocaleString()}</TableCell>
          <TableCell className={cell}>{(Math.round(totals.extraDisc * 100) / 100).toLocaleString()}</TableCell>
          <TableCell className={cell}>{totals.comm.toLocaleString()}</TableCell>
          <TableCell className={cell}>{reward.toLocaleString()}</TableCell>
          <TableCell className={cell}>{totals.vas.toLocaleString()}</TableCell>
          <TableCell className={cell}>{totals.kwa.toLocaleString()}</TableCell>
          <TableCell className={cell}>Total Rc</TableCell>
          <TableCell className={cell}>{totals.rcCount}x {footer.rcRate.toLocaleString()}</TableCell>
          <TableCell className={cell}>{(totals.rcCount * footer.rcRate).toLocaleString()}</TableCell>
          <TableCell colSpan={6}></TableCell>
        </TableRow>
      )}
      <TableRow className="bg-[#e6f7f2] dark:bg-zinc-900 hover:bg-[#e6f7f2] dark:hover:bg-zinc-900">
        <TableCell colSpan={18}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold">{personName}:</span>
            {!footer &&
              (achievement ? (
                <span className="text-muted-foreground">
                  Target ({achievement.targetName}): {achievement.achievedCount}/{achievement.targetQuota ?? "-"}
                  {achievement.targetQuota ? ` (${Math.round((achievement.achievedCount / achievement.targetQuota) * 100)}%)` : ""}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No target assigned</span>
              ))}
            {actions}
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

function BvReportTable({
  details,
  totals,
  personAchievement,
  footer,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange,
  scope
}: {
  details: any[];
  totals?: any;
  personAchievement?: { personId: string; targetName: string; targetQuota: number | null; achievedCount: number }[];
  footer?: BvLegacyFooter | null;
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
  // BV commission workflow: only HOD / Admin / Account verify (Reward AB +
  // Verify); only Account / Admin mark an acknowledged commission as paid.
  const canVerifyComm = scope === "company" && isCompanyWideRole(activeRole);
  const canPayComm = scope === "company" && ["admin", "super_admin", "account_manager"].includes(normalizeRole(activeRole));
  // BV commission edit (old finalComm): admin / Super HOD / HOD / Account — the API checks the same.
  const canEditComm = scope === "company" &&
    ["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(String(activeRole || "").toLowerCase().replace(/[\s-]+/g, "_"));

  // Same role-grouping convention as the VAS/GM Select User pickers.
  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = useMemo(() => groupUsersByRoleTitle(allUsers), [allUsers]);

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
    const map = new Map<string, { personId: string; personName: string } & BvPersonTotals>();
    filtered.forEach((item) => {
      if (!item.personId) return;
      const existing = map.get(item.personId) ?? {
        personId: item.personId,
        personName: item.personName || "Unknown",
        comm: 0,
        reward: 0,
        price: 0,
        extraDisc: 0,
        vas: 0,
        kwa: 0,
        rcCount: 0,
      };
      existing.comm += typeof item.comm === "number" ? item.comm : Number(item.comm) || 0;
      existing.reward += typeof item.reward === "number" ? item.reward : Number(item.reward) || 0;
      existing.price += Number(item.price) || 0;
      existing.extraDisc += Number(item.extraDisc) || 0;
      existing.vas += Number(item.vas) || 0;
      existing.kwa += Number(item.kwa) || 0;
      // Old footer "Total Rc" counted renwal 0 rows.
      if (gmTypeLabel(item.rcNew) === "Rc") existing.rcCount += 1;
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
  // Old func.php: webxl_kwa_history rows whose pay_date falls in the selected range,
  // filtered to the person by the history row's user ("Used By").
  const { data: kwaRecords = [] } = useQuery<any[]>({
    queryKey: ["/api/target-system/kwa-usage", dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/target-system/kwa-usage?startDate=${dateRange.from.slice(0, 10)}&endDate=${dateRange.to.slice(0, 10)}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: scope === "company",
  });

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">BV SYSTEM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select User</Label>
              {canSelectUser ? (
                <RoleGroupedUserSelect
                  users={allUsers}
                  value={selectedUser}
                  onChange={onUserChange}
                  extraOptions={[{ value: "all", label: "All" }]}
                  placeholder={usersError ? "Failed to load users" : usersLoading ? "Loading users..." : "Choose..."}
                  className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                />
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
                      {/* Old type_fillter (renwal code) as the Rc/New labels the API
                          returns in `status` (Create GM page's gmTypeLabel mapping). */}
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Rc">Rc</SelectItem>
                      <SelectItem value="Ec">Ec</SelectItem>
                      <SelectItem value="Rc-Up">Rc-Up</SelectItem>
                      <SelectItem value="Kwa">Kwa</SelectItem>
                      <SelectItem value="None">None</SelectItem>
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
              <Button onClick={handleView} className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8 h-11 font-bold text-lg rounded-md">
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">BV View</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Search:</span>
            <Input
              className="h-8 w-48"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          <div className="px-4 mb-4 flex items-center gap-2">
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
                  <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                    <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
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
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">
                            <EditableCommCell item={item} canEdit={canEditComm} />
                          </TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.reward ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.vas ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.kwa ?? "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.method ?? "-"}</TableCell>
                          <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{item.personName || "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.pay ? new Date(item.pay).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bvSubmit ? new Date(item.bvSubmit).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bv ? new Date(item.bv).toLocaleDateString() : "-"}</TableCell>
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{gmTypeLabel(item.rcNew)}</TableCell>
                          {/* func.php's Dropout column and Type dropdown share the exact same
                              option codes (DropoutTiltle uses the same 0-6 values as
                              changeAcoountType) — Dropout there is just the display of
                              whatever was last picked in that same dropdown, not a separate
                              data source. Reflects the Type selection below; still not
                              persisted anywhere since there's no backend column to save it to. */}
                          <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">
                            {BV_TYPE_OPTIONS.find((opt) => opt.value === typeSelections[item.id])?.label ?? item.dropout ?? "-"}
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
                      <TableRow className="bg-[#e6f7f2] dark:bg-zinc-900 hover:bg-[#e6f7f2] dark:hover:bg-zinc-900">
                        <TableCell colSpan={3} className="font-bold text-black dark:text-zinc-300">Total</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.price.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.extraDisc.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.comm.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.reward.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.vas.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-black dark:text-zinc-300">{bvTotals.kwa.toLocaleString()}</TableCell>
                        <TableCell colSpan={9}></TableCell>
                      </TableRow>
                      {/* People without a target are listed in the red table below instead. */}
                      {personTotals.filter((p) => personAchievement?.some((a) => a.personId === p.personId)).map((p) => (
                        <BvCommissionPanelRow
                          key={p.personId}
                          personId={p.personId}
                          personName={p.personName}
                          totals={p}
                          achievement={personAchievement?.find((a) => a.personId === p.personId)}
                          footer={footer && footer.personId === p.personId ? footer : null}
                          commPeriod={commPeriod}
                          canManage={canVerifyComm}
                          canPay={canPayComm}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </TableFooter>
                  )}
                </>
              ) : (
                <>
                  <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                    <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
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
                className="bg-[#008d4c] hover:bg-[#00733e]"
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
        </CardContent>
      </Card>

      {/* Salespeople in this BV report without a target: commission can't be verified for them. */}
      {scope === "company" && (() => {
        const noTarget = personTotals.filter((p) => !personAchievement?.some((a) => a.personId === p.personId));
        if (noTarget.length === 0) return null;
        return (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-red-600 dark:bg-red-700">
                  <TableRow className="hover:bg-red-600 dark:hover:bg-red-700 border-b-0">
                    <TableHead className="w-12 text-center font-bold text-white">#</TableHead>
                    <TableHead className="font-bold text-white">No Target Assigned — Salesperson ({noTarget.length})</TableHead>
                    <TableHead className="text-center font-bold text-white">Comm</TableHead>
                    <TableHead className="text-center font-bold text-white">Reward</TableHead>
                    <TableHead className="font-bold text-white">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noTarget.map((p, i) => (
                    <TableRow key={p.personId}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="font-semibold">{p.personName}</TableCell>
                      <TableCell className="text-center">{p.comm.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{p.reward.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Commission can't be verified until a target is assigned (Set Target).
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {scope === "company" && personTotals.map((p) => {
        const personKwaRecords = kwaRecords.filter(
          (r: any) => (r.usedBy || "").trim().toLowerCase() === p.personName.trim().toLowerCase(),
        );
        if (personKwaRecords.length === 0) return null;
        const kwaTotals = personKwaRecords.reduce(
          (acc: any, r: any) => ({
            remaining: acc.remaining + Number(r.remaining || 0),
            kwa: acc.kwa + Number(r.kwa || 0),
            used: acc.used + Number(r.used || 0),
            reward: acc.reward + Number(r.reward || 0),
          }),
          { kwa: 0, remaining: 0, used: 0, reward: 0 },
        );
        return (
          <Card key={p.personId} className="border border-border shadow-sm">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">KWA Usage — {p.personName}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                    <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
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
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.sellBy || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.usedBy || "-"}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${Number(r.kwa ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{r.type || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.detail || "-"}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${Number(r.remaining ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">${Number(r.used ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{Number(r.reward ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{r.status || "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-slate-600 py-3 dark:text-zinc-300">{r.payDate ? new Date(r.payDate).toLocaleDateString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-[#e6f7f2] dark:bg-zinc-900 hover:bg-[#e6f7f2] dark:hover:bg-zinc-900">
                      <TableCell colSpan={4} className="font-bold text-black dark:text-zinc-300">Total</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">${kwaTotals.kwa.toLocaleString()}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">${kwaTotals.remaining.toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">${kwaTotals.used.toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-black dark:text-zinc-300">{kwaTotals.reward.toLocaleString()}</TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <KwaServiceCommStatus personId={p.personId} dateFrom={dateRange.from} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type LegacyVasCommission = {
  mode: "list" | "monthWise" | "allCommission";
  rows?: { period: string; person: string | null; total: number; per: number; reward: number; comm: number; amount: number }[];
  due?: number;
  totals?: { total: number; reward: number; comm: number; amount: number };
};

type VasAllRow = {
  legacyUserId: string;
  person: string | null;
  period: string;
  total: number;
  per: number;
  reward: number;
  paidReward: number;
  comm: number;
  amount: number;
  alreadyCreated: boolean;
  team: {
    members: { legacyUserId: string; name: string | null; total: number }[];
    total: number;
    per: number;
    comm: number;
    alreadyCreated: boolean;
  } | null;
};

type VasAllCommission = {
  mode: "allCommission";
  period: string;
  from: string;
  to: string;
  rows: VasAllRow[];
  totals: { total: number; reward: number; comm: number; amount: number };
};

// Old VasController "All" users table (Select User = All). Rows/slabs come
// from getVasAllUsersCommission (backend reports-routes.ts). "% test" and
// "System Reward" are editable like the old page: editing % recomputes Comm =
// round(% * Total) and Amount = Reward + Comm in the browser only; Verify
// sends the current values (POST /api/reports/vas/commission/verify).
function VasAllUsersCommissionTable({ data, onRefresh }: { data: VasAllCommission; onRefresh?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { per: string; reward: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [invoiceUser, setInvoiceUser] = useState<VasAllRow | null>(null);
  const [dupUser, setDupUser] = useState<VasAllRow | null>(null);
  useEffect(() => { setEdits({}); }, [data]);

  const fmt = (v: unknown) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const current = (r: VasAllRow) => {
    const e = edits[r.legacyUserId];
    const per = e ? Number(e.per) || 0 : r.per;
    const reward = e ? Number(e.reward) || 0 : r.reward;
    const comm = e ? Math.round((per / 100) * r.total) : r.comm;
    return { per, reward, comm, amount: e ? reward + comm : r.amount };
  };
  const setEdit = (r: VasAllRow, field: "per" | "reward", value: string) =>
    setEdits((prev) => {
      const base = prev[r.legacyUserId] ?? { per: String(r.per), reward: String(r.reward) };
      return { ...prev, [r.legacyUserId]: { ...base, [field]: value } };
    });

  const invoices = useQuery<{ rows: any[] }>({
    queryKey: ["/api/reports/vas/commission/invoices", invoiceUser?.legacyUserId, data.from, data.to],
    enabled: !!invoiceUser,
    queryFn: () => apiRequestJson("GET", `/api/reports/vas/commission/invoices?legacyUserId=${encodeURIComponent(invoiceUser!.legacyUserId)}&from=${data.from}&to=${data.to}`),
  });
  const duplicates = useQuery<{ rows: any[] }>({
    queryKey: ["/api/reports/vas/commission/duplicates", dupUser?.legacyUserId],
    enabled: !!dupUser,
    queryFn: () => apiRequestJson("GET", `/api/reports/vas/commission/duplicates?legacyUserId=${encodeURIComponent(dupUser!.legacyUserId)}`),
  });

  const verify = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    try {
      await apiRequestJson("POST", "/api/reports/vas/commission/verify", { ...body, from: data.from });
      toast({ title: "Commission verified" });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/vas/commission/duplicates"] });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: e?.message || "Failed to verify commission", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const head = "font-bold text-black dark:text-zinc-300 text-center h-12";
  const created = <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Already Created</span>;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-[#fde2e1] dark:bg-red-950/30">
          <TableRow className="border-b-0">
            {["#", "Person", "Total", "% test", "System Reward", "Paid Reward", "Comm", "Amount", "Date", "Action"].map((h) => (
              <TableHead key={h} className={head}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No Records Found</TableCell>
            </TableRow>
          ) : (
            data.rows.map((r, idx) => {
              const c = current(r);
              const e = edits[r.legacyUserId];
              return (
                <TableRow key={r.legacyUserId} className="align-top">
                  <TableCell className="text-center">{idx + 1}</TableCell>
                  <TableCell className="text-center min-w-[220px]">
                    <div className="font-semibold">{r.person || "-"}</div>
                    {r.team && (
                      <table className="mt-2 w-full border border-slate-200 text-xs dark:border-zinc-700">
                        <thead className="bg-slate-100 dark:bg-zinc-800">
                          <tr><th className="p-1">Name</th><th className="p-1">Amount</th><th className="p-1">...</th><th className="p-1">...</th></tr>
                        </thead>
                        <tbody>
                          {r.team.members.map((m) => (
                            <tr key={m.legacyUserId} className="border-t border-slate-200 dark:border-zinc-700">
                              <td className="p-1">{m.name || "-"}</td><td className="p-1">{fmt(m.total)}</td><td className="p-1">...</td><td className="p-1">...</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold dark:bg-zinc-800/60">
                          <tr className="border-t border-slate-200 dark:border-zinc-700">
                            <td className="p-1">Total</td>
                            <td className="p-1">{fmt(r.team.total)}</td>
                            <td className="p-1">{fmt(r.team.total)}-{r.team.per}% = {fmt(r.team.comm)}</td>
                            <td className="p-1 space-y-1">
                              <div>{fmt(r.team.comm)}</div>
                              {r.team.alreadyCreated ? created : (
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-xs bg-[#008d4c] hover:bg-[#00733e] text-white"
                                  disabled={busy !== null}
                                  onClick={() => verify(`team-${r.legacyUserId}`, {
                                    legacyUserId: r.legacyUserId, commType: "Team-Vas", totalAmount: r.team!.total,
                                    per: r.team!.per, comm: r.team!.comm, reward: 0, finalPayAmount: r.team!.comm,
                                  })}
                                >
                                  {busy === `team-${r.legacyUserId}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{fmt(r.total)}</TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={e ? e.per : String(r.per)}
                      onChange={(ev) => setEdit(r, "per", ev.target.value)}
                      className="h-8 w-20 mx-auto text-center"
                      aria-label={`Commission % for ${r.person ?? ""}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={e ? e.reward : String(r.reward)}
                      onChange={(ev) => setEdit(r, "reward", ev.target.value)}
                      className="h-8 w-24 mx-auto text-center"
                      aria-label={`System reward for ${r.person ?? ""}`}
                    />
                  </TableCell>
                  <TableCell className="text-center">{fmt(r.paidReward)}</TableCell>
                  <TableCell className="text-center">{fmt(c.comm)}</TableCell>
                  <TableCell className="text-center">{fmt(c.amount)}</TableCell>
                  <TableCell className="text-center whitespace-nowrap">{r.period}</TableCell>
                  <TableCell className="text-center">
                    {r.alreadyCreated ? created : (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          className="h-8 bg-[#008d4c] hover:bg-[#00733e] text-white"
                          disabled={busy !== null}
                          onClick={() => verify(`vas-${r.legacyUserId}`, {
                            legacyUserId: r.legacyUserId, commType: "Vas", totalAmount: r.total,
                            per: c.per, comm: c.comm, reward: c.reward, finalPayAmount: c.amount,
                          })}
                        >
                          {busy === `vas-${r.legacyUserId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" title="Duplicate records" onClick={() => setDupUser(r)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" title="Invoice details" onClick={() => setInvoiceUser(r)}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        <TableFooter>
          <TableRow className="bg-slate-50 dark:bg-zinc-800/60 font-bold">
            <TableCell colSpan={2} className="text-center">Total</TableCell>
            <TableCell className="text-center">{fmt(data.totals.total)}</TableCell>
            <TableCell />
            <TableCell className="text-center">{fmt(data.totals.reward)}</TableCell>
            <TableCell />
            <TableCell className="text-center">{fmt(data.totals.comm)}</TableCell>
            <TableCell className="text-center">{fmt(data.totals.amount)}</TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableFooter>
      </Table>

      <Dialog open={!!invoiceUser} onOpenChange={(o) => { if (!o) setInvoiceUser(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>{invoiceUser?.person} · {data.period}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {invoices.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : invoices.isError ? (
              <p className="py-6 text-center text-destructive">{(invoices.error as any)?.message || "Failed to load invoice details"}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Invoice ID", "Company DRM ID", "Company Name", "Amount", "Invoice Type", "Pay", "Method", "Date"].map((h) => (
                      <TableHead key={h} className="text-center">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices.data?.rows ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No Records Found</TableCell></TableRow>
                  ) : (
                    (invoices.data?.rows ?? []).map((x, i) => (
                      <TableRow key={`${x.invoiceId}-${i}`}>
                        <TableCell className="text-center">{x.invoiceId}</TableCell>
                        <TableCell className="text-center">{x.comId}</TableCell>
                        <TableCell className="text-center">{x.cname || "-"}</TableCell>
                        <TableCell className="text-center">{fmt(x.amount)}</TableCell>
                        <TableCell className="text-center">{x.item || "-"}</TableCell>
                        <TableCell className="text-center">{x.pay ?? "-"}</TableCell>
                        <TableCell className="text-center">{x.method || "-"}</TableCell>
                        <TableCell className="text-center whitespace-nowrap">{x.createDate ? String(x.createDate).replace("T", " ") : "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dupUser} onOpenChange={(o) => { if (!o) setDupUser(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Duplicate Records</DialogTitle>
            <DialogDescription>{dupUser?.person}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            {duplicates.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : duplicates.isError ? (
              <p className="py-6 text-center text-destructive">{(duplicates.error as any)?.message || "Failed to load records"}</p>
            ) : (duplicates.data?.rows ?? []).length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No duplicate records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Month", "Year", "Conversion", "Reward", "Commission Type", "Commission", "Final Comm"].map((h) => (
                      <TableHead key={h} className="text-center">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(duplicates.data?.rows ?? []).map((x) => (
                    <TableRow key={x.id}>
                      <TableCell className="text-center">{x.commMonth}</TableCell>
                      <TableCell className="text-center">{x.commYear}</TableCell>
                      <TableCell className="text-center">{x.per}</TableCell>
                      <TableCell className="text-center">{fmt(x.reward)}</TableCell>
                      <TableCell className="text-center">{x.commType}</TableCell>
                      <TableCell className="text-center">{fmt(x.comm)}</TableCell>
                      <TableCell className="text-center">{fmt(x.finalPayAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VasReportTable({
  details,
  totals,
  departmentSummary = [],
  legacyVas,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange,
  onRefresh,
}: {
  details: any[];
  totals?: { totalAdvance: number };
  /** Old-DRM "Department Wise Summary": invoice value split by item department. */
  departmentSummary?: { department: string; amount: number }[];
  /** Old-DRM Month Wise commission (one user) / all-users commission table. */
  legacyVas?: LegacyVasCommission;
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
  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = useMemo(() => groupUsersByRoleTitle(allUsers), [allUsers]);

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
    legacy_payment: "Payment",
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

  // Old VAS views computed by the backend (getVasCompanyLegacyReport): Select
  // User = All always shows the old all-users commission table (Month Wise or
  // not); one user + Month Wise shows the per-month commission rows.
  const allUsersView = legacyVas?.mode === "allCommission" ? (legacyVas as unknown as VasAllCommission) : null;
  const commissionView = isMonthWise && legacyVas?.mode === "monthWise" ? legacyVas : null;
  const money = (v: unknown) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

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
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">VAS SYSTEM</CardTitle>
        </CardHeader>
        <CardContent>
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
                <RoleGroupedUserSelect
                  users={allUsers}
                  value={selectedUser}
                  onChange={onUserChange}
                  extraOptions={[{ value: "all", label: "All" }]}
                  placeholder="Choose..."
                  className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                />
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
              <Button
                onClick={() => onRefresh && onRefresh()}
                className="w-full bg-[#008d4c] hover:bg-[#00733e] text-white h-11 font-bold text-lg rounded-md"
              >
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">VAS View</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          <div className="px-4 mb-4 flex bg-[#64748b] dark:bg-zinc-800 rounded-sm overflow-hidden w-fit">
            <button onClick={handleCopy} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">Copy</button>
            <button onClick={() => exportToExcel(filtered, vasExportColumns, "VAS_Report")} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">Excel</button>
            <button onClick={() => exportToCSV(filtered, vasExportColumns, "VAS_Report")} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">CSV</button>
            <button onClick={() => exportToPDF(filtered, vasExportColumns, "VAS_Report", { title: "VAS Report" })} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors">PDF</button>
          </div>
          {allUsersView ? (
            <VasAllUsersCommissionTable data={allUsersView} onRefresh={onRefresh} />
          ) : commissionView ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#fde2e1] dark:bg-red-950/30">
                <TableRow className="border-b-0">
                  {["#", "Date", "Person", "Total", "%", "Reward", "Comm", "Amount"].map((h) => (
                    <TableHead key={h} className="font-bold text-black dark:text-zinc-300 text-center h-12">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(commissionView.rows ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No Records Found</TableCell>
                  </TableRow>
                ) : (
                  (commissionView.rows ?? []).map((r, idx) => (
                    <TableRow key={`${r.period}-${r.person}-${idx}`}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="text-center">{r.period}</TableCell>
                      <TableCell className="text-center">{r.person || "-"}</TableCell>
                      <TableCell className="text-center">{money(r.total)}</TableCell>
                      <TableCell className="text-center">{r.per}</TableCell>
                      <TableCell className="text-center">{money(r.reward)}</TableCell>
                      <TableCell className="text-center">{money(r.comm)}</TableCell>
                      <TableCell className="text-center">{money(r.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-slate-50 dark:bg-zinc-800/60 font-bold">
                  {commissionView.mode === "monthWise" ? (
                    <>
                      <TableCell className="text-center text-red-600">Due</TableCell>
                      <TableCell className="text-center text-red-600">{money(commissionView.due)}</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={2}></TableCell>
                  )}
                  <TableCell className="text-center">Total</TableCell>
                  <TableCell className="text-center">{money(commissionView.totals?.total)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-center">{money(commissionView.totals?.reward)}</TableCell>
                  <TableCell className="text-center">{money(commissionView.totals?.comm)}</TableCell>
                  <TableCell className="text-center">{money(commissionView.totals?.amount)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
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
          )}

        </CardContent>
      </Card>
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

  const filtered = useMemo(() => {
    let data = details || [];
    if (selectedUser !== "all") {
      // Logic to filter by user if user ID is available in details (backend currently filters by creator)
      // Since backend already filters if userId passed, this might be redundant unless we want client side filter
    }
    return data;
  }, [details, selectedUser]);

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">VAS SYSTEM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select User</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="month-wise-legacy"
                    checked={isMonthWise}
                    onCheckedChange={(c) => setIsMonthWise(!!c)}
                  />
                  <label
                    htmlFor="month-wise-legacy"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-600 dark:text-zinc-300"
                  >
                    Month Wise
                  </label>
                </div>
              </div>
              <Input
                readOnly
                value={(currentUser as any)?.fullName || (currentUser as any)?.name || (currentUser as any)?.username || "Loading..."}
                className="bg-[#f0f4f8] border-none h-11 text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
              />
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
              <Button className="w-full bg-[#008d4c] hover:bg-[#00733e] text-white h-11 font-bold text-lg rounded-md">
                View
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">VAS View</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Company</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Amount</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Method</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Commission %</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Reward</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center h-12">Final Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, idx) => (
                    <TableRow key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                      <TableCell className="text-center font-bold text-slate-700 py-4 dark:text-zinc-400">{item.companyName || "-"}</TableCell>
                      <TableCell className="text-center font-medium text-slate-700 py-4 dark:text-zinc-400">{Number(item.amount || 0)}</TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">{item.method || "-"}</TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">
                        {item.date ? new Date(item.date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : "-"}
                      </TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300" title="GM commission engine's effective rate for this user's quarter (MD-16(c)) — not a per-row VAS commission, which was never a defined concept.">
                        {Number(item.commissionPercent || 0)}%
                      </TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">{Number(item.reward || 0)}</TableCell>
                      <TableCell className="text-center font-semibold text-slate-700 py-4 dark:text-zinc-300">{Number(item.finalCommission || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const LOAN_LIST_PAGE_SIZE = 10;

function buildLoanPageNumbers(current: number, total: number, maxButtons = 7): number[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function LoanListPagination({
  page,
  totalItems,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalItems === 0) return null;
  const pageNums = buildLoanPageNumbers(page, totalPages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <p className="text-[12px] text-muted-foreground">
        Showing {(page - 1) * LOAN_LIST_PAGE_SIZE + 1} to {Math.min(page * LOAN_LIST_PAGE_SIZE, totalItems)} of {totalItems} entries
        {totalPages > 1 ? ` (page ${page} of ${totalPages})` : ""}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 text-[12px] font-bold" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          {pageNums.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-8 px-1 rounded-md text-[12px] font-bold ${p === page ? "bg-[#00a65a] text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {p}
            </button>
          ))}
          <Button variant="outline" size="sm" className="h-8 text-[12px] font-bold" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function fmtMoney(n: number) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function LoanReportTable({
  loans,
  totals,
  activeSubTab,
  setActiveSubTab,
  reportScope,
}: {
  loans: LoanDetail[];
  totals?: { totalAdvance: number; totalRemaining: number; totalRepaid?: number };
  activeSubTab: "list" | "add" | "history";
  setActiveSubTab: (tab: "list" | "add" | "history") => void;
  reportScope?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [employeeLoans, setEmployeeLoans] = useState<LoanDetail[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const safeLoans = employeeLoans ?? loans ?? [];
  const [search, setSearch] = useState("");
  const [viewItem, setViewItem] = useState<LoanDetail | null>(null);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showLoanHistory, setShowLoanHistory] = useState(false);
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [historyUserId, setHistoryUserId] = useState<string>("");
  const [appliedHistoryUser, setAppliedHistoryUser] = useState<string>("");
  const [historyRequested, setHistoryRequested] = useState(false);
  const [listEmpDraft, setListEmpDraft] = useState<string>("all");
  const [listStartDraft, setListStartDraft] = useState("");
  const [listEndDraft, setListEndDraft] = useState("");
  const [appliedListEmp, setAppliedListEmp] = useState<string>("all");
  const [appliedListStart, setAppliedListStart] = useState("");
  const [appliedListEnd, setAppliedListEnd] = useState("");
  const [addLoanTargetUserId, setAddLoanTargetUserId] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payRemaining, setPayRemaining] = useState<string>("");
  const [payStatus, setPayStatus] = useState<"Pending" | "Complete">("Pending");
  const [rejectingLoanId, setRejectingLoanId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [listPage, setListPage] = useState(1);

  const uniqueEmployees = useMemo(() => {
    const names = safeLoans.map(l => l.employeeName).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [safeLoans]);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const isManager = currentUser?.role && ['admin', 'manager', 'hod', 'assistant_manager', 'super_hod', 'super_admin', 'account_manager'].some(r => currentUser.role.toLowerCase().includes(r));
  // HOD-tier: who may perform the second-stage HOD approval (mirrors the
  // backend's isHodAllowed — hod/super_hod/admin/sales_manager).
  const activeRole = (currentUser?.role || "").toLowerCase();
  const isHodTier = ["admin", "super_admin", "hod", "super_hod", "sales_manager"].includes(activeRole);

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users", "loan-report-all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      return data.users || [];
    },
  });

  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = useMemo(() => groupUsersByRoleTitle(allUsers), [allUsers]);

  // Old DRM "Loan History": pay-loan rows for one person between Start and End.
  const { data: loanHistory, isFetching: loanHistoryLoading } = useQuery<{
    person: string; remaining: number; totalPay: number;
    rows: { id: string; pay: number; detail: string | null; date: string }[];
  }>({
    queryKey: ["/api/loans/history", appliedHistoryUser, appliedStart, appliedEnd],
    enabled: showLoanHistory && historyRequested,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedHistoryUser) params.set("userId", appliedHistoryUser);
      if (appliedStart) params.set("start", appliedStart);
      if (appliedEnd) params.set("end", appliedEnd);
      const res = await apiRequest("GET", `/api/loans/history?${params}`);
      return res.json();
    },
  });

  // Managers/HOD/account_manager submit via /api/admin/loans (lets them pick
  // the target employee, and auto-approves since they already hold decision
  // authority over loans). Plain employees self-serve via /api/loans.
  const createLoanMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: string; installmentAmount: string; detail: string }) => {
      const url = isManager ? "/api/admin/loans" : "/api/loans";
      const res = await fetch(url, {
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
      toast({ title: "Success", description: isManager ? "Loan added and approved" : "Loan request created successfully" });
      setActiveSubTab("list");
      setAddLoanTargetUserId("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const decideLoanMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "manager-approve" | "hod-approve" | "reject" | "complete"; reason?: string }) => {
      const res = await fetch(`/api/loans/${id}/${action}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: action === "reject" ? JSON.stringify({ reason }) : undefined,
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", "loan"] });
      const labels: Record<string, string> = {
        "manager-approve": "Loan approved", "hod-approve": "Loan HOD-approved",
        "reject": "Loan rejected", "complete": "Loan marked completed",
      };
      toast({ title: labels[action] || "Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const payInstallmentMutation = useMutation({
    mutationFn: async ({ id, amount, remaining, status }: { id: string; amount: number; remaining: number; status: "Pending" | "Complete" }) => {
      const res = await fetch(`/api/loans/${id}/pay-installment`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount, remaining, status }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to record payment");
      }
      return res.json();
    },
    onSuccess: (record: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports", "loan"] });
      toast({ title: record?.status === "Completed" ? "Payment recorded — loan fully repaid" : "Payment recorded" });
      setViewItem(null);
      setPayAmount("");
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

  const employeeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of allUsers ?? []) {
      const id = String(u?.id ?? "");
      const name = String(u?.fullName || u?.full_name || u?.name || u?.username || "").trim();
      if (id && name) m.set(id, name);
    }
    return m;
  }, [allUsers]);

  const filtered = useMemo(() => {
    let result = [...safeLoans].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );

    if (appliedListEmp !== "all" && !employeeLoans) {
      const pick = appliedListEmp;
      const pickName = employeeNameById.get(pick)?.toLowerCase();
      result = result.filter((l) => {
        if (l.userId && String(l.userId) === pick) return true;
        const en = String(l.employeeName ?? "").toLowerCase().replace(/\s*\(main\)\s*$/i, "").trim();
        if (pickName && (en === pickName || en.includes(pickName) || pickName.includes(en))) return true;
        return false;
      });
    }
    if (appliedListStart) {
      const from = new Date(appliedListStart);
      from.setHours(0, 0, 0, 0);
      result = result.filter((l) => {
        const t = l.date ? new Date(l.date) : null;
        return t && !Number.isNaN(t.getTime()) && t >= from;
      });
    }
    if (appliedListEnd) {
      const to = new Date(appliedListEnd);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => {
        const t = l.date ? new Date(l.date) : null;
        return t && !Number.isNaN(t.getTime()) && t <= to;
      });
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
  }, [safeLoans, search, appliedListEmp, appliedListStart, appliedListEnd, employeeNameById, employeeLoans]);

  const applyListFilters = async () => {
    if (listStartDraft && listEndDraft && listStartDraft > listEndDraft) {
      toast({ title: "Invalid dates", description: "Start date must be on or before end date.", variant: "destructive" });
      return;
    }
    const emp = isManager ? listEmpDraft : "all";
    setAppliedListEmp(emp);
    setAppliedListStart(listStartDraft);
    setAppliedListEnd(listEndDraft);
    setListPage(1);
    if (emp !== "all") {
      setFilterLoading(true);
      try {
        const params = new URLSearchParams({
          from: listStartDraft || "2000-01-01",
          to: listEndDraft || "2099-12-31",
          userId: emp,
        });
        if (reportScope) params.set("scope", reportScope);
        const data = await apiRequestJson<{ details: LoanDetail[] }>("GET", `/api/reports/loan?${params}`);
        setEmployeeLoans(data.details ?? []);
      } catch {
        setEmployeeLoans(null);
        toast({ title: "Could not load employee loans", variant: "destructive" });
      } finally {
        setFilterLoading(false);
      }
    } else {
      setEmployeeLoans(null);
    }
  };

  const clearListFilters = () => {
    setListEmpDraft("all");
    setListStartDraft("");
    setListEndDraft("");
    setAppliedListEmp("all");
    setAppliedListStart("");
    setAppliedListEnd("");
    setEmployeeLoans(null);
    setSearch("");
    setListPage(1);
  };

  useEffect(() => {
    setListPage(1);
  }, [search, appliedListEmp, appliedListStart, appliedListEnd]);

  const filteredTotals = useMemo(() => {
    // Rejected / cancelled loans were never paid out, so they don't count as advance or
    // repaid (old DRM: repaid = sum of pay-loan rows = approved advance - remaining).
    const counted = filtered.filter((l) => !/reject|cancel/i.test(String(l.status || "")));
    const totalAdvance = counted.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    const totalRemaining = counted.reduce((sum, l) => sum + Number(l.remainingAmount || 0), 0);
    const totalInstalment = counted.reduce((sum, l) => sum + Number(l.installmentAmount || 0), 0);
    const totalRepaid = counted
      .filter((l) => /completed|hodapproved/i.test(String(l.status || "")))
      .reduce((sum, l) => sum + Math.max(0, Number(l.amount || 0) - Number(l.remainingAmount || 0)), 0);
    return { totalAdvance, totalRemaining, totalRepaid, totalInstalment };
  }, [filtered]);

  const listTotalPages = Math.max(1, Math.ceil(filtered.length / LOAN_LIST_PAGE_SIZE));
  const paginatedLoans = useMemo(() => {
    const start = (listPage - 1) * LOAN_LIST_PAGE_SIZE;
    return filtered.slice(start, start + LOAN_LIST_PAGE_SIZE);
  }, [filtered, listPage]);

  useEffect(() => {
    if (listPage > listTotalPages) setListPage(listTotalPages);
  }, [listPage, listTotalPages]);

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

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-3 px-0">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="uppercase text-slate-600 dark:text-zinc-400">ADVANCE SALARY LIST</span>
          <span className="text-slate-400 dark:text-zinc-600 mx-1 text-lg font-bold">/</span>
          <button
            onClick={() => setShowAddLoan(!showAddLoan)}
            className={`uppercase transition-colors hover:opacity-80 ${showAddLoan ? "text-[#00a65a]" : "text-slate-600 dark:text-zinc-400"}`}
          >
            ADD LOAN
          </button>
          <span className="text-slate-400 dark:text-zinc-600 mx-1 text-lg font-bold">/</span>
          <button
            onClick={() => setShowLoanHistory(!showLoanHistory)}
            className={`uppercase transition-colors hover:opacity-80 ${showLoanHistory ? "text-[#3c8dbc]" : "text-slate-600 dark:text-zinc-400"}`}
          >
            LOAN HISTORY
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2 px-0">
        {showAddLoan && (
          <form onSubmit={handleAddLoan} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white dark:bg-zinc-900 p-4 rounded-md border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee</Label>
              {isManager ? (
                <>
                  <RoleGroupedUserSelect
                    users={allUsers}
                    value={addLoanTargetUserId}
                    onChange={setAddLoanTargetUserId}
                    placeholder="Choose employee"
                    className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs"
                  />
                  <input type="hidden" name="userId" value={addLoanTargetUserId} />
                </>
              ) : (
                <>
                  <Input
                    readOnly
                    value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                    className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 h-9 text-xs text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0"
                  />
                  <input type="hidden" name="userId" value={currentUser?.id || currentUser?.userId || ""} />
                </>
              )}
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
            <div className="md:col-span-5 flex items-center gap-3">
              <Button type="submit" disabled={createLoanMutation.isPending || (isManager && !addLoanTargetUserId)} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-bold text-sm rounded-sm">
                {createLoanMutation.isPending ? "..." : "Submit"}
              </Button>
              {isManager && <span className="text-[11px] text-slate-400">Loans you add here are approved automatically.</span>}
            </div>
          </form>
        )}

        {showLoanHistory && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white dark:bg-zinc-900 p-4 rounded-md border border-slate-200 dark:border-zinc-800 shadow-sm">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee</Label>
              {isManager ? (
                <RoleGroupedUserSelect
                  users={allUsers}
                  value={historyUserId}
                  onChange={setHistoryUserId}
                  placeholder="Choose employee"
                  className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 h-9 text-xs"
                />
              ) : (
                <Input
                  readOnly
                  value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                  className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 h-9 text-xs text-[#555] dark:text-zinc-300 cursor-not-allowed focus-visible:ring-0"
                />
              )}
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
              <Button 
                type="button" 
                disabled={isManager && !historyUserId}
                onClick={() => {
                  setAppliedStart(historyStart);
                  setAppliedEnd(historyEnd);
                  setAppliedHistoryUser(isManager ? historyUserId : "");
                  setHistoryRequested(true);
                }}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-bold text-sm rounded-sm"
              >
                View
              </Button>
            </div>
          </div>
        )}

        {showLoanHistory && historyRequested && (
          <div className="bg-white dark:bg-zinc-900 rounded-md border border-slate-200 dark:border-zinc-800 overflow-x-auto">
            <Table className="w-full text-[13px]">
              <TableHeader>
                <TableRow className="bg-[#d1e7dd] dark:bg-emerald-950/40 hover:bg-[#d1e7dd]">
                  <TableHead className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300">#</TableHead>
                  <TableHead className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300">Person</TableHead>
                  <TableHead className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300">Pay</TableHead>
                  <TableHead className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300">Detail</TableHead>
                  <TableHead className="py-2 px-3 font-bold text-[#555] dark:text-zinc-300">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loanHistoryLoading && !loanHistory ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !loanHistory?.rows?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No data available in table</TableCell></TableRow>
                ) : (
                  loanHistory.rows.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="py-2 px-3">{i + 1}</TableCell>
                      <TableCell className="py-2 px-3">{loanHistory.person}</TableCell>
                      <TableCell className="py-2 px-3">{Number(r.pay || 0).toString()}</TableCell>
                      <TableCell className="py-2 px-3">{r.detail ?? ""}</TableCell>
                      <TableCell className="py-2 px-3 whitespace-nowrap">{r.date}</TableCell>
                    </TableRow>
                  ))
                )}
                {loanHistory && (
                  <TableRow className="font-bold">
                    <TableCell className="py-2 px-3">Remaning</TableCell>
                    <TableCell className="py-2 px-3">{Number(loanHistory.remaining || 0).toString()}</TableCell>
                    <TableCell className="py-2 px-3">{Number(loanHistory.totalPay || 0).toString()}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
          <div className="text-[12px] font-bold text-[#555] dark:text-zinc-300 uppercase">Filter advance list</div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {isManager ? (
              <div className="md:col-span-4 space-y-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee name</Label>
                <RoleGroupedUserSelect
                  grouped={false}
                  users={allUsers}
                  value={listEmpDraft}
                  onChange={setListEmpDraft}
                  extraOptions={[{ value: "all", label: "All employees" }]}
                  placeholder="All employees"
                  searchPlaceholder="Search employee..."
                  className="w-full h-9 bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-xs"
                />
              </div>
            ) : (
              <div className="md:col-span-4 space-y-1">
                <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Employee</Label>
                <Input
                  readOnly
                  className="h-9 text-xs bg-[#f0f2f5] dark:bg-zinc-800 cursor-not-allowed"
                  value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Your loans"}
                />
              </div>
            )}
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Start date</Label>
              <Input type="date" value={listStartDraft} onChange={(e) => setListStartDraft(e.target.value)}
                className="h-9 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700" />
            </div>
            <div className="md:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">End date</Label>
              <Input type="date" value={listEndDraft} onChange={(e) => setListEndDraft(e.target.value)}
                className="h-9 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700" />
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void applyListFilters()} disabled={filterLoading}
                className="h-9 flex-1 min-w-[72px] bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-bold rounded-sm">
                {filterLoading ? "..." : "View"}
              </Button>
              <Button type="button" variant="outline" onClick={clearListFilters} className="h-9 flex-1 min-w-[72px] text-xs rounded-sm">
                Clear
              </Button>
            </div>
          </div>
          {(appliedListEmp !== "all" || appliedListStart || appliedListEnd) && (
            <p className="text-[11px] text-slate-500">
              Active filter:
              {appliedListEmp !== "all" && <> employee <b>{employeeNameById.get(appliedListEmp) || appliedListEmp}</b></>}
              {appliedListStart && <> from <b>{appliedListStart}</b></>}
              {appliedListEnd && <> to <b>{appliedListEnd}</b></>}
              {" "}— {filtered.length} record(s)
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap gap-[1px] bg-[#6c757d] p-[1px] rounded-sm overflow-hidden">
            {["Copy", "Excel", "CSV", "PDF"].map((label) => (
              <Button key={label} variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={() => handleExport(label as any)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-600 dark:text-zinc-400">Quick search:</span>
            <Input
              className="w-[220px] h-8 bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 text-xs rounded-sm focus-visible:ring-0 focus-visible:border-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Detail, amount, status..."
            />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-md border border-transparent dark:border-zinc-800">
          <Table className="w-full text-[13px]">
            <TableHeader>
              <TableRow className="border-b border-[#dee2e6] dark:border-zinc-800 hover:bg-transparent">
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">No#</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Employee</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Advance</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left w-1/4">Detail</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Instalment</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Remaining</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Date</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-left">Status</TableHead>
                {isManager && <TableHead className="py-2.5 px-3 font-bold text-[#555] dark:text-zinc-400 text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-[#f8f9fa] dark:bg-zinc-900">
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-4">
                    No data available in table
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLoans.map((loan, idx) => {
                  const isRejectingThis = rejectingLoanId === loan.id;
                  const rowNo = (listPage - 1) * LOAN_LIST_PAGE_SIZE + idx + 1;
                  return (
                  <TableRow key={loan.id} className="border-b border-white dark:border-zinc-800 hover:bg-[#f1f3f5] dark:hover:bg-zinc-800 transition-colors">
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{rowNo}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 font-semibold">{loan.employeeName} (Main)</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.amount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 truncate max-w-[200px]">{loan.detail}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.installmentAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300">{Number(loan.remainingAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] dark:text-zinc-300 whitespace-nowrap">
                      {loan.date ? new Date(loan.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "-"}
                    </TableCell>
                    <TableCell className="py-3 px-3">
                      <Badge variant={
                        loan.status === "HODApproved" ? "default" :
                        loan.status === "Rejected" ? "destructive" :
                        loan.status === "Completed" ? "outline" : "secondary"
                      } className="text-[10px]">{loan.status}</Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell className="py-3 px-3 text-center">
                        {isRejectingThis ? (
                          <div className="flex items-center gap-1.5 justify-center">
                            <Input
                              autoFocus
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              placeholder="Reason"
                              className="h-7 w-28 text-[11px]"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={decideLoanMutation.isPending}
                              onClick={() => { decideLoanMutation.mutate({ id: loan.id, action: "reject", reason: rejectReason }); setRejectingLoanId(null); setRejectReason(""); }}
                              className="h-7 px-2 text-[11px]"
                            >Confirm</Button>
                            <Button size="sm" variant="secondary" onClick={() => { setRejectingLoanId(null); setRejectReason(""); }} className="h-7 px-2 text-[11px]">Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-center flex-wrap">
                            {loan.status === "Pending" && (
                              <>
                                <Button size="sm" disabled={decideLoanMutation.isPending} onClick={() => decideLoanMutation.mutate({ id: loan.id, action: "manager-approve" })} className="h-7 px-2 text-[11px] bg-[#00a65a] hover:bg-[#008d4c] text-white">Approve</Button>
                                <Button size="sm" variant="secondary" disabled={decideLoanMutation.isPending} onClick={() => setRejectingLoanId(loan.id)} className="h-7 px-2 text-[11px]">Reject</Button>
                              </>
                            )}
                            {loan.status === "ManagerApproved" && isHodTier && (
                              <>
                                <Button size="sm" disabled={decideLoanMutation.isPending} onClick={() => decideLoanMutation.mutate({ id: loan.id, action: "hod-approve" })} className="h-7 px-2 text-[11px] bg-[#00a65a] hover:bg-[#008d4c] text-white">HOD Approve</Button>
                                <Button size="sm" variant="secondary" disabled={decideLoanMutation.isPending} onClick={() => setRejectingLoanId(loan.id)} className="h-7 px-2 text-[11px]">Reject</Button>
                              </>
                            )}
                            {loan.status === "HODApproved" && (
                              <button onClick={() => { setViewItem(loan); setPayAmount(""); setPayRemaining(Number(loan.remainingAmount || 0).toString()); setPayStatus("Pending"); }} title="Pay Loan" className="text-[#00a65a] hover:text-[#008d4c] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-plus-circle" viewBox="0 0 16 16">
                                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                                </svg>
                              </button>
                            )}
                            {(loan.status === "Rejected" || loan.status === "Completed") && (
                              <span className="text-slate-400 dark:text-zinc-600">—</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })
              )}
            </TableBody>
            {filtered.length > 0 && (
              <TableFooter className="bg-[#e8f5e9] dark:bg-emerald-950/30 font-bold border-t-2 border-[#00a65a]/30">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={2} className="py-3 px-3 text-[#333] dark:text-zinc-200">
                    Total
                  </TableCell>
                  <TableCell className="py-3 px-3 text-[#333] dark:text-zinc-200" title="Total advance given (borrowed amount)">
                    {fmtMoney(filteredTotals.totalAdvance)}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-[11px] font-semibold text-slate-700 dark:text-zinc-300" title="Advance minus remaining = recovered">
                    Repaid: {fmtMoney(filteredTotals.totalRepaid)}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-[#333] dark:text-zinc-200">
                    {fmtMoney(filteredTotals.totalInstalment)}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-[#333] dark:text-zinc-200" title="Outstanding balance">
                    {fmtMoney(filteredTotals.totalRemaining)}
                  </TableCell>
                  <TableCell colSpan={isManager ? 3 : 2} />
                </TableRow>
              </TableFooter>
            )}
          </Table>
          <LoanListPagination
            page={listPage}
            totalItems={filtered.length}
            totalPages={listTotalPages}
            onPageChange={setListPage}
          />
        </div>
        {filtered.length > 0 && (
          <p className="text-[12px] text-slate-600 dark:text-zinc-400">
            <span className="font-semibold">Summary:</span>{" "}
            Total advance given <b>{fmtMoney(filteredTotals.totalAdvance)}</b>
            {" · "}Total repaid (recovered) <b>{fmtMoney(filteredTotals.totalRepaid)}</b>
            {" · "}Total remaining (due) <b>{fmtMoney(filteredTotals.totalRemaining)}</b>
            {filtered.length !== safeLoans.length ? ` — based on ${filtered.length} filtered rows` : ` — all ${safeLoans.length} loans`}
          </p>
        )}
        <Dialog open={!!viewItem} onOpenChange={(open) => { if (!open) { setViewItem(null); setPayAmount(""); } }}>
          <DialogContent className="max-w-[450px] p-0 gap-0">
            <DialogHeader className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <DialogTitle className="text-[17px] font-bold text-[#555] dark:text-zinc-100 text-left">Pay Loan</DialogTitle>
            </DialogHeader>
            {viewItem && (
              <form onSubmit={(e) => {
                e.preventDefault();
                const amt = parseFloat(payAmount || "0");
                const rem = parseFloat(payRemaining || "0");
                if (!(amt > 0) && payStatus !== "Complete") {
                  toast({ title: "Error", description: "Enter a valid payment amount", variant: "destructive" });
                  return;
                }
                if (!(rem >= 0)) {
                  toast({ title: "Error", description: "Enter a valid remaining amount", variant: "destructive" });
                  return;
                }
                payInstallmentMutation.mutate({ id: viewItem.id, amount: amt, remaining: rem, status: payStatus });
              }} className="p-5 space-y-4 bg-white dark:bg-zinc-900">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Name</Label>
                  <Input readOnly value={viewItem.employeeName} className="bg-[#f0f2f5] dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-[#555] dark:text-zinc-300 h-9 focus-visible:ring-0 cursor-not-allowed" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Remaning</Label>
                  <Input
                    type="number" step="0.01"
                    value={payRemaining} onChange={e => setPayRemaining(e.target.value)}
                    className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 text-[#555] h-9 focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Pay</Label>
                  <Input
                    type="number" step="0.01" placeholder="00:00"
                    value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="bg-white dark:bg-zinc-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-700 text-[#555] h-9 focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-400">Status</Label>
                  <select
                    value={payStatus}
                    onChange={e => setPayStatus(e.target.value as "Pending" | "Complete")}
                    className="w-full h-9 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[#555] dark:text-zinc-100 px-3 text-sm"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>

                <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <Button type="button" variant="outline" onClick={() => setViewItem(null)} className="bg-[#f0f2f5] dark:bg-zinc-800 text-[#555] dark:text-zinc-300 hover:bg-[#e4e6e9] dark:hover:bg-zinc-700 border-none px-5 h-9 text-[13px] font-semibold">
                    Close
                  </Button>
                  <Button type="submit" disabled={payInstallmentMutation.isPending} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 h-9 text-[13px] font-semibold">
                    {payInstallmentMutation.isPending ? "..." : "Save"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
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
    <div className={`space-y-6 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{reportTypeLabels[type].title}</h3>
          <p className="text-sm text-muted-foreground">{reportTypeLabels[type].description}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {type === "gm" && (
            <Link href="/reports/gm/new">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-create-gm-report"
              >
                + New GM Report
              </Button>
            </Link>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={isExporting === "csv"}
            data-testid="button-export-csv"
          >
            {isExporting === "csv" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("json")}
            disabled={isExporting === "json"}
            data-testid="button-export-json"
          >
            {isExporting === "json" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmail}
            data-testid="button-email-report"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>


      {type === "loan" && (
        <LoanReportTable
          loans={(report.details as LoanDetail[]) ?? []}
          totals={report.totals}
          activeSubTab={loanActiveSubTab}
          setActiveSubTab={setLoanActiveSubTab}
          reportScope={scope}
        />
      )}

      {type === "vas" && (
        scope === "company" ? (
          <VasReportTable
            details={report.details ?? []}
            totals={report.totals}
            departmentSummary={(report as any).departmentSummary ?? []}
            legacyVas={(report as any).legacyVas}
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
          footer={(report as any).footer}
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

import { isManagerialRole, isCompanyWideRole, normalizeRole } from "@/lib/role-utils";
import { gmTypeLabel } from "@/lib/gm-type-label";

export default function UserReports() {
  useModuleData("/reports");
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });
  const [location, setLocation] = useLocation();
  // Both sidebar groups ("User Reports" and "Reports") link to this same
  // /reports/:type route — "Reports" group's Loan Report additionally tags
  // ?scope=company so HOD/Account/Admin get the whole-company view there,
  // while the "User Reports" one (no scope param) stays personal/team-scoped.
  // useSearch() (not a plain window.location.search read) is required here —
  // wouter's route matching ignores the query string, so switching between
  // these two sidebar links doesn't remount this component; without a
  // reactive hook the scope read would go stale after the first navigation.
  const search = useSearch();
  const scope = new URLSearchParams(search).get("scope");
  const [match, params] = useRoute<{ type?: string }>("/reports/:type") || [false, null];
  const routeType = match && params?.type && isReportType(params.type) ? (params.type as ReportType) : null;
  const [activeTab, setActiveTab] = useState<ReportType>(routeType ?? "loan");
  const [loanActiveSubTab, setLoanActiveSubTab] = useState<"list" | "add" | "history">("list");

  const today = new Date();
  const defaultFromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const [dateRange, setDateRange] = useState({
    from: defaultFromDate.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  });

  useEffect(() => {
    if (routeType && routeType !== activeTab) {
      setActiveTab(routeType);
    }
    if (!routeType && location === "/reports" && activeTab !== "loan") {
      setActiveTab("loan");
    }
  }, [routeType, activeTab, location]);

  const handleDateChange = (field: "from" | "to", value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const setPresetRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    });
  };

  const handleTabChange = (value: string) => {
    const nextTab = isReportType(value) ? value : "loan";
    setActiveTab(nextTab);
    const nextPath = `/reports/${nextTab}`;
    if (location !== nextPath) {
      setLocation(nextPath);
    }
  };

  const headerContent = routeType ? reportTypeLabels[routeType] : defaultReportHeader;

  const activeRole = (typeof window !== "undefined" ? sessionStorage.getItem("userRole") : null) ?? currentUser?.roleId;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-user-reports">
      <div className="flex items-center justify-end">
        {scope === "company" && isCompanyWideRole(activeRole) && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Global View
          </Badge>
        )}
        {!(scope === "company" && isCompanyWideRole(activeRole)) &&
          isManagerialRole(activeRole) && !isCompanyWideRole(activeRole) && (
          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
            Team View
          </Badge>
        )}
      </div>

      <div className="mt-0">
        <ReportTab
          type={activeTab}
          dateRange={dateRange}
          loanActiveSubTab={loanActiveSubTab}
          setLoanActiveSubTab={setLoanActiveSubTab}
          onDateChange={handleDateChange}
          scope={scope}
        />
      </div>
    </div>
  );
}
