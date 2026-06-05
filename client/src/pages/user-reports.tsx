import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Loader2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
import { apiRequest, getAuthHeader } from "@/lib/queryClient";
import { Link, useLocation, useRoute } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportType = "loan" | "vas" | "gm" | "bv";

interface ReportMetrics {
  totalTasks: number;
  valueOfServiceSold: number;
  successRate: number;
  followUpsCompleted: number;
  missedLeads: number;
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
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (
        item.companyName?.toLowerCase().includes(lower) ||
        item.person?.toLowerCase().includes(lower)
      );
    });
  }, [filteredDetails, searchTerm]);

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
                className="bg-[#f0f4f8] border-none h-11 text-[#555] cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
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
              <Select>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="renew">Renew</SelectItem>
                  <SelectItem value="expire">Expire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-2">
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
            </div>

            <div className="md:col-span-12 mt-2">
              <div className="sm:w-48">
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
              <div className="mt-4">
                <Button onClick={() => onRefresh && onRefresh()} className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8 h-11 font-bold text-lg rounded-md">
                  View
                </Button>
              </div>
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
                  <TableHead className="font-bold text-black w-10 text-center">#</TableHead>
                  <TableHead className="font-bold text-black min-w-[150px]">Company</TableHead>
                  <TableHead className="font-bold text-black text-center">Package</TableHead>
                  <TableHead className="font-bold text-black text-center">KWA</TableHead>
                  <TableHead className="font-bold text-black text-center">PSA</TableHead>
                  <TableHead className="font-bold text-black text-center">Package Amount</TableHead>
                  <TableHead className="font-bold text-black text-center">Method</TableHead>
                  <TableHead className="font-bold text-black text-center">BV Submit Date</TableHead>
                  <TableHead className="font-bold text-black text-center">BV Date</TableHead>
                  <TableHead className="font-bold text-black text-center">Person</TableHead>
                  <TableHead className="font-bold text-black text-center">Rc/New</TableHead>
                  <TableHead className="font-bold text-black min-w-[150px]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                      <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{(currentPage - 1) * perPage + idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-700 py-3 dark:text-zinc-400">{item.companyName}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.package}</TableCell>
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

function BvReportTable({
  details,
  totals,
  dateRange,
  onDateChange,
  selectedUser,
  onUserChange
}: {
  details: any[];
  totals?: any;
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

  const [filteredDetails, setFilteredDetails] = useState(details);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewFilters, setViewFilters] = useState({ type: "all" });

  const handleView = () => {
    setViewFilters({ type: selectedType });
    setCurrentPage(1);
  };

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  useEffect(() => {
    setFilteredDetails(details);
  }, [details]);

  const filtered = useMemo(() => {
    return filteredDetails.filter(item => {
      if (viewFilters.type !== "all" && item.type?.toLowerCase() !== viewFilters.type.toLowerCase()) {
        return false;
      }
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (
        item.companyName?.toLowerCase().includes(lower) ||
        item.personName?.toLowerCase().includes(lower)
      );
    });
  }, [filteredDetails, searchTerm, viewFilters]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginatedData = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

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
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-white border-slate-200 h-11 text-[#555] cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
              />
            </div>

            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-zinc-400">Select Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                  <SelectValue placeholder="Choose..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="renew">Renew</SelectItem>
                  <SelectItem value="expire">Expire</SelectItem>
                  <SelectItem value="rc/up">Rc/Up</SelectItem>
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
              <TableHeader className="bg-[#e6f7f2] dark:bg-zinc-900">
                <TableRow className="border-b-0 hover:bg-[#e6f7f2] dark:hover:bg-zinc-800">
                  <TableHead className="font-bold text-black w-10 text-center">#</TableHead>
                  <TableHead className="font-bold text-black min-w-[150px]">Company</TableHead>
                  <TableHead className="font-bold text-black text-center">Package</TableHead>
                  <TableHead className="font-bold text-black text-center">Price</TableHead>
                  <TableHead className="font-bold text-black text-center">Comm</TableHead>
                  <TableHead className="font-bold text-black text-center">Reward</TableHead>
                  <TableHead className="font-bold text-black text-center">VAS</TableHead>
                  <TableHead className="font-bold text-black text-center">KWA</TableHead>
                  <TableHead className="font-bold text-black text-center">Method</TableHead>
                  <TableHead className="font-bold text-black text-center">Person</TableHead>
                  <TableHead className="font-bold text-black text-center">Pay</TableHead>
                  <TableHead className="font-bold text-black text-center">BV</TableHead>
                  <TableHead className="font-bold text-black text-center">Rc/New</TableHead>
                  <TableHead className="font-bold text-black text-center">Type</TableHead>
                  <TableHead className="font-bold text-black min-w-[150px]">Receive Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                      <TableCell className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">{(currentPage - 1) * perPage + idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-700 py-3 dark:text-zinc-400">{item.companyName}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.packageType}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.amount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.commission}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.reward}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.vasAmount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.kwaAmount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.method}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.personName}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.payAmount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.bvAmount}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.entryType}</TableCell>
                      <TableCell className="text-center text-slate-600 py-3 dark:text-zinc-300">{item.type}</TableCell>
                      <TableCell className="text-slate-600 py-3 dark:text-zinc-300">
                        {item.receivedAt ? new Date(item.receivedAt).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : "-"}
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

function VasReportTable({
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
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f4f8] border-none h-11 text-[#555] cursor-not-allowed focus-visible:ring-0 dark:bg-zinc-900"
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
                  <TableHead className="font-bold text-black text-center h-12">Company</TableHead>
                  <TableHead className="font-bold text-black text-center h-12">Amount</TableHead>
                  <TableHead className="font-bold text-black text-center h-12">Method</TableHead>
                  <TableHead className="font-bold text-black text-center h-12">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No Records Found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, idx) => (
                    <TableRow key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                      <TableCell className="text-center font-bold text-slate-700 py-4 dark:text-zinc-400">{item.companyName || "-"}</TableCell>
                      <TableCell className="text-center font-medium text-slate-700 py-4 dark:text-zinc-400">{Number(item.amount || 0)}</TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">{item.method || "-"}</TableCell>
                      <TableCell className="text-center text-slate-600 py-4 dark:text-zinc-300">
                        {item.date ? new Date(item.date).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : "-"}
                      </TableCell>
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

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="pb-3 px-0">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          <span className="uppercase text-slate-600">ADVANCE SALARY LIST</span>
          <span className="text-slate-400 mx-1 text-lg font-bold">/</span>
          <button 
            onClick={() => setShowAddLoan(!showAddLoan)} 
            className={`uppercase transition-colors hover:opacity-80 ${showAddLoan ? "text-[#00a65a]" : "text-slate-600"}`}
          >
            ADD LOAN
          </button>
          <span className="text-slate-400 mx-1 text-lg font-bold">/</span>
          <button 
            onClick={() => setShowLoanHistory(!showLoanHistory)} 
            className={`uppercase transition-colors hover:opacity-80 ${showLoanHistory ? "text-[#3c8dbc]" : "text-slate-600"}`}
          >
            LOAN HISTORY
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2 px-0">
        {showAddLoan && (
          <form onSubmit={handleAddLoan} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white p-4 rounded-md border border-slate-200 shadow-sm">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600">Employee</Label>
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f2f5] border-slate-200 h-9 text-xs text-[#555] cursor-not-allowed focus-visible:ring-0"
              />
              <input type="hidden" name="userId" value={currentUser?.id || currentUser?.userId || ""} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600">Amount:</Label>
              <Input name="amount" type="number" step="0.01" required placeholder="00:00" className="bg-white border-slate-200 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600">Instalment:</Label>
              <Input name="installmentAmount" type="number" step="0.01" required placeholder="Instalment" className="bg-white border-slate-200 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Detail</Label>
              <Textarea name="detail" required placeholder="add detail" className="bg-white border-slate-200 h-9 min-h-[36px] py-1.5 text-xs resize-none" />
            </div>
            <div className="md:col-span-5">
              <Button type="submit" disabled={createLoanMutation.isPending} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-bold text-sm rounded-sm">
                {createLoanMutation.isPending ? "..." : "Submit"}
              </Button>
            </div>
          </form>
        )}

        {showLoanHistory && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white p-4 rounded-md border border-slate-200 shadow-sm">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs font-semibold text-slate-600">Employee</Label>
              <Input
                readOnly
                value={currentUser?.fullName || currentUser?.name || currentUser?.username || "Loading..."}
                className="bg-[#f0f2f5] border-slate-200 h-9 text-xs text-[#555] cursor-not-allowed focus-visible:ring-0"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">Start:</Label>
              <Input type="date" value={historyStart} onChange={e => setHistoryStart(e.target.value)} className="bg-white border-slate-200 h-9 text-xs" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold text-slate-600">End:</Label>
              <Input type="date" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} className="bg-white border-slate-200 h-9 text-xs" />
            </div>
            <div className="md:col-span-5">
              <Button 
                type="button" 
                onClick={() => {
                  setAppliedStart(historyStart);
                  setAppliedEnd(historyEnd);
                }}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-bold text-sm rounded-sm"
              >
                View
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap gap-[1px] bg-[#6c757d] p-[1px] rounded-sm overflow-hidden">
              {["Copy", "Excel", "CSV", "PDF"].map((label) => (
                <Button key={label} variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={() => handleExport(label as any)}>
                  {label}
                </Button>
              ))}
            </div>
            {isManager && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-slate-600">Filter:</span>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="w-[200px] h-8 bg-white border-slate-300 text-xs rounded-sm focus-visible:ring-0">
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
            <span className="text-[13px] font-semibold text-slate-600">Search:</span>
            <Input
              className="w-[200px] h-8 bg-white border-slate-300 text-xs rounded-sm focus-visible:ring-0 focus-visible:border-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="bg-white">
          <Table className="w-full text-[13px]">
            <TableHeader>
              <TableRow className="border-b border-[#dee2e6] hover:bg-transparent">
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">No#</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">Employee</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">Advance</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left w-1/4">Detail</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">Instalment</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">Remaining</TableHead>
                <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left">Date</TableHead>
                {isManager && <TableHead className="py-2.5 px-3 font-bold text-[#555] text-center">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-[#f8f9fa]">
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isManager ? 8 : 7} className="text-center text-muted-foreground py-4">
                    No data available in table
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((loan, idx) => (
                  <TableRow key={loan.id} className="border-b border-white hover:bg-[#f1f3f5] transition-colors">
                    <TableCell className="py-3 px-3 text-[#555]">{idx + 1}/{String(loan.id || '').substring(0, 5)}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] font-semibold">{loan.employeeName} (Main)</TableCell>
                    <TableCell className="py-3 px-3 text-[#555]">{Number(loan.amount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] truncate max-w-[200px]">{loan.detail}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555]">{Number(loan.installmentAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555]">{Number(loan.remainingAmount || 0).toString()}</TableCell>
                    <TableCell className="py-3 px-3 text-[#555] whitespace-nowrap">
                      {loan.date ? new Date(loan.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "-"}
                    </TableCell>
                    {isManager && (
                      <TableCell className="py-3 px-3 text-center">
                        <button onClick={() => setViewItem(loan)} className="text-[#00a65a] hover:text-[#008d4c] transition-colors">
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
            <DialogHeader className="p-4 border-b border-slate-100 bg-white">
              <DialogTitle className="text-[17px] font-bold text-[#555] text-left">Pay Loan</DialogTitle>
            </DialogHeader>
            {viewItem && (
              <form onSubmit={(e) => {
                e.preventDefault();
                // TODO: implement loan payment submission logic
                setViewItem(null);
              }} className="p-5 space-y-4 bg-white">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555]">Name</Label>
                  <Input readOnly value={viewItem.employeeName} className="bg-[#f0f2f5] border-slate-200 text-[#555] h-9 focus-visible:ring-0 cursor-not-allowed" />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555]">Remaning</Label>
                  <Input readOnly value={Number(viewItem.remainingAmount || 0).toString()} className="bg-white border-slate-200 text-[#555] h-9 focus-visible:ring-0" />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555]">Pay</Label>
                  <Input type="number" step="0.01" placeholder="00:00" className="bg-white border-slate-200 text-[#555] h-9 focus-visible:ring-0" />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-bold text-[#555]">Status</Label>
                  <Select defaultValue="Pending">
                    <SelectTrigger className="bg-white border-slate-200 text-[#555] h-9 focus-visible:ring-0">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setViewItem(null)} className="bg-[#f0f2f5] text-[#555] hover:bg-[#e4e6e9] border-none px-5 h-9 text-[13px] font-semibold">
                    Close
                  </Button>
                  <Button type="submit" className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 h-9 text-[13px] font-semibold">
                    Save
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
                    contentStyle={{ border: 'none', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
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
  onDateChange
}: {
  type: ReportType;
  dateRange: { from: string; to: string };
  loanActiveSubTab: "list" | "add" | "history";
  setLoanActiveSubTab: (tab: "list" | "add" | "history") => void;
  onDateChange: (field: "from" | "to", value: string) => void;
}) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });

  const [selectedUser, setSelectedUser] = useState<string>("all");

  useEffect(() => {
    if (currentUser && selectedUser === "all") {
      setSelectedUser(currentUser.userId || currentUser.id);
    }
  }, [currentUser, selectedUser]);

  const { data: report, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ["/api/reports", type, dateRange.from, dateRange.to, selectedUser],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        userId: selectedUser
      });
      const response = await apiRequest("GET", `/api/reports/${type}?${params}`);
      return response.json();
    },
    retry: 1,
  });

  const handleExport = async (format: string) => {
    setIsExporting(format);
    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        format,
      });
      const response = await fetch(`/api/reports/${type}/export?${params}`, {
        headers: {
          ...getAuthHeader(),
        },
        credentials: "include",
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{reportTypeLabels[type].title}</h3>
          <p className="text-sm text-muted-foreground">{reportTypeLabels[type].description}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {type === "bv" && (
            <Link href="/reports/bv/new">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-create-bv-report"
              >
                + New BV Report
              </Button>
            </Link>
          )}
          {type === "vas" && (
            <Link href="/reports/vas/new">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-create-vas-report"
              >
                + New VAS Report
              </Button>
            </Link>
          )}
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
        />
      )}

      {type === "vas" && (
        <VasReportTable
          details={report.details ?? []}
          totals={report.totals}
          dateRange={dateRange}
          onDateChange={onDateChange}
          selectedUser={selectedUser}
          onUserChange={setSelectedUser}
        />
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
          dateRange={dateRange}
          onDateChange={onDateChange}
          selectedUser={selectedUser}
          onUserChange={setSelectedUser}
        />
      )}

      {type !== "loan" && type !== "vas" && type !== "gm" && type !== "bv" && (
        <ReportDetails details={report.details} type={type} />
      )}
    </div>
  );
}

import { isManagerialRole } from "@/lib/role-utils";

export default function UserReports() {
  useModuleData("/reports");
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").then(r => r.json()),
  });
  const [location, setLocation] = useLocation();
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

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-user-reports">
      <div className="flex items-center justify-end">
        {currentUser && isManagerialRole(currentUser.roleId) && (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Global View
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
        />
      </div>
    </div>
  );
}
