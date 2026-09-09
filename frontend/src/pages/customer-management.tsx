import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useScreenContext } from "@/contexts/screen-context";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CommunicationTimeline } from "@/components/communication/communication-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Search,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  MessageSquarePlus,
  History,
  Star,
  Check,
  X,
  FileText,
  AlertCircle,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserPlus,
  Loader2,
  Download,
} from "lucide-react";
import type { Customer, Opportunity, Service } from "@shared/schema";

type CustomerWithOpportunity = Customer & {
  opportunity?: Opportunity;
  isTemp?: boolean;
  salesPersonName?: string | null;
};

type FollowUpDetail = {
  id: string;
  companyName: string;
  serviceName: string;
  serviceType: string;
  grade: string;
  note: string | null;
  createdAt: string;
  source: string | null;
};

type CustomerResponse = {
  success?: boolean;
  data?: CustomerWithOpportunity[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  // legacy fields
  customers?: CustomerWithOpportunity[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

type CustomerStats = {
  success?: boolean;
  data?: {
    totalCustomers: number;
    gradeStats: Record<string, number>;
    stageStats: Record<string, number>;
  };
  gradeStats?: Record<string, number>;
  stageStats?: Record<string, number>;
};

const STAGES = [
  { value: "LD", label: "Lead" },
  { value: "QF", label: "Qualified" },
  { value: "AY", label: "Analyzed" },
  { value: "IN", label: "In Progress" },
  { value: "PM", label: "Payment" },
  { value: "GM", label: "Game" },
  { value: "BV", label: "Business Verification" },
  { value: "NC", label: "New Customer" },
  { value: "RC", label: "Renewal Customer" },
  { value: "EC", label: "Expired Customer" },
  { value: "FW", label: "Follow-up" },
  { value: "NF", label: "Not Follow" },
];

const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-gradient-to-br from-emerald-600 to-teal-700 shadow-sm shadow-emerald-200 text-white border-none",
  "A":  "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shadow-emerald-200 text-white border-none",
  "A-": "bg-gradient-to-br from-rose-600 to-pink-700 shadow-sm shadow-rose-200 text-white border-none",
  "B+": "bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm shadow-blue-200 text-white border-none",
  "B":  "bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm shadow-amber-200 text-white border-none",
  "B-": "bg-gradient-to-br from-indigo-600 to-violet-700 shadow-sm shadow-indigo-200 text-white border-none",
  "C+": "bg-gradient-to-br from-slate-600 to-slate-800 shadow-sm shadow-slate-200 text-white border-none",
  "C":  "bg-gradient-to-br from-gray-700 to-gray-900 shadow-sm shadow-gray-200 text-white border-none",
  "D":  "bg-gradient-to-br from-red-600 to-rose-700 shadow-sm shadow-red-200 text-white border-none",
};

export default function CustomerManagement() {
  const { toast } = useToast();
  const { updateVisibleData } = useScreenContext();

  // Set screen context for AI assistant
  useEffect(() => {
    updateVisibleData({
      screenName: "Customer Management",
      description: "CRM-style lead tracker and customer management interface",
      features: [
        "Search and filter customers by grade, stage, and status",
        "View and manage customer details",
        "Track follow-ups and notes",
        "Update lead grades and stages",
      ],
    });
  }, [updateVisibleData]);

  // State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteCustomer, setNoteCustomer] = useState<CustomerWithOpportunity | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showAllRecords, setShowAllRecords] = useState(true);
  const [followDialogOpen, setFollowDialogOpen] = useState(false);
  const [followCustomer, setFollowCustomer] = useState<CustomerWithOpportunity | null>(null);
  const [followCustomerDetails, setFollowCustomerDetails] = useState<CustomerWithOpportunity | null>(null);
  const [followNote, setFollowNote] = useState("");
  const [followNextDate, setFollowNextDate] = useState("");
  const [followMethod, setFollowMethod] = useState("");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [viewFollowUp, setViewFollowUp] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!followCustomer) {
      setFollowCustomerDetails(null);
      return;
    }
    let cancelled = false;
    apiRequest("GET", `/api/sales/customers/${followCustomer.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setFollowCustomerDetails((json as any)?.data ?? (json as any));
      })
      .catch(() => {
        if (cancelled) return;
        setFollowCustomerDetails(followCustomer);
      });
    return () => {
      cancelled = true;
    };
  }, [followCustomer]);

  // Build query params for customers
  const buildCustomerQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("pageSize", String(pageSize));
    if (search) params.append("search", search);
    if (stageFilter && stageFilter !== "all") params.append("stage", stageFilter);
    if (gradeFilter && gradeFilter !== "all") params.append("grade", gradeFilter);
    params.append("sortBy", sortBy);
    params.append("sortOrder", sortOrder);
    // Customer Management is the sales exec's Private Pool workspace — scope
    // to it so customers sitting in other pools (Service, Public) don't leak in.
    params.append("poolType", "Private");
    return params.toString();
  };

  // Export the customers that match the CURRENT filters (search/stage/grade/sort)
  // to a CSV file. Pulls the real, filtered rows from the API — never a cached or
  // fabricated set — and surfaces failures honestly so the user can retry.
  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("pageSize", "100000");
      if (search) params.append("search", search);
      if (stageFilter && stageFilter !== "all") params.append("stage", stageFilter);
      if (gradeFilter && gradeFilter !== "all") params.append("grade", gradeFilter);
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);
      params.append("poolType", "Private");

      const res = await apiRequest("GET", `/api/sales/customers?${params.toString()}`);
      const json = await res.json();
      const rows: CustomerWithOpportunity[] = json?.data ?? json?.customers ?? [];

      if (!rows.length) {
        toast({
          title: "Nothing to export",
          description: "No customers match the current filters.",
        });
        return;
      }

      const columns: { key: string; label: string; get: (r: any) => any }[] = [
        { key: "drmId", label: "DRM ID", get: (r) => r.drmId },
        { key: "crmId", label: "CRM ID", get: (r) => r.crmId },
        { key: "companyName", label: "Company Name", get: (r) => r.companyName },
        { key: "accountName", label: "Account Name", get: (r) => r.accountName },
        { key: "personName", label: "Contact Person", get: (r) => r.personName },
        { key: "email", label: "Email", get: (r) => r.email },
        { key: "phone", label: "Phone", get: (r) => r.phone },
        { key: "region", label: "Region", get: (r) => r.region },
        { key: "country", label: "Country", get: (r) => r.country },
        { key: "city", label: "City", get: (r) => r.city },
        { key: "grade", label: "Grade", get: (r) => r.grade },
        { key: "status", label: "Status", get: (r) => r.status },
        { key: "stage", label: "Stage", get: (r) => getStageBadge(r.opportunity?.stage) },
        { key: "source", label: "Source", get: (r) => r.source },
        { key: "createdAt", label: "Created At", get: (r) => r.createdAt },
      ];

      const escapeCell = (value: any): string => {
        if (value === null || value === undefined) return "";
        const text = Array.isArray(value) ? value.join("; ") : String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      };

      const csv = [
        columns.map((c) => escapeCell(c.label)).join(","),
        ...rows.map((row) => columns.map((c) => escapeCell(c.get(row))).join(",")),
      ].join("\n");

      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export ready",
        description: `Exported ${rows.length} customer${rows.length === 1 ? "" : "s"}.`,
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Could not export customers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch customers
  const { data: customersData, isLoading: loadingCustomers } = useQuery<CustomerResponse>({
    queryKey: ["customers", page, pageSize, search, stageFilter, gradeFilter, sortBy, sortOrder],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sales/customers?${buildCustomerQueryParams()}`);
      const json = await res.json();
      return json;
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery<CustomerStats>({
    queryKey: ["/api/sales/customers/stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/customers/stats");
      return res.json();
    },
  });

  // Fetch follow-ups for expanded customer
  const { data: followUps, isLoading: loadingFollowUps } = useQuery<FollowUpDetail[]>({
    queryKey: ["customer-followups", expandedCustomer],
    queryFn: async () => {
      if (!expandedCustomer) return [];
      const res = await apiRequest("GET", `/api/sales/customers/${expandedCustomer}/followups`);
      return res.json();
    },
    enabled: !!expandedCustomer,
  });

  const { data: servicesResponse, isLoading: loadingServices } = useQuery<{ success?: boolean; data?: Service[]; items?: Service[] }>({
    queryKey: ["/api/sales/services"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/services");
      return res.json();
    },
  });
  const services = (servicesResponse?.items ?? servicesResponse?.data ?? (servicesResponse as any)?.services ?? []) as Service[];

  // Mutations
  const updateGradeMutation = useMutation({
    mutationFn: async ({ customerId, grade }: { customerId: string; grade: string }) => {
      return apiRequest("PATCH", `/api/sales/customers/${customerId}/grade`, { grade });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers/stats"] });
      toast({ title: "Grade updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update grade", variant: "destructive" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ customerId, stage }: { customerId: string; stage: string }) => {
      return apiRequest("PATCH", `/api/sales/customers/${customerId}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers/stats"] });
      toast({ title: "Stage updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update stage", variant: "destructive" });
    },
  });

  const pickCustomerMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return apiRequest("POST", `/api/sales/customers/${customerId}/pick`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/customers/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/list"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/tracing/summary"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/pools"], exact: false });
      toast({ title: "Customer Moved to Public Pool", description: "Customer is now available in Public Pool for all Sales Executives." });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to pick customer",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const markFocusMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      return apiRequest("PATCH", "/api/sales/customers/mark-focus", { customerIds, focus: true });
    },
    onSuccess: (_data, customerIds) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedCustomers(new Set());
      toast({ title: `Marked ${customerIds.length} customer${customerIds.length > 1 ? "s" : ""} as focus` });
    },
    onError: () => {
      toast({ title: "Failed to mark as focus", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ customerId, note }: { customerId: string; note: string }) => {
      return apiRequest("PATCH", `/api/sales/customers/${customerId}/note`, { note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setNoteDialogOpen(false);
      setNoteCustomer(null);
      setNoteText("");
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const followUpMutation = useMutation({
    mutationFn: async (payload: { customer_id: string; service_ids: string[]; note?: string; next_date?: string; method?: string }) => {
      const res = await apiRequest("POST", "/api/sales/followups", payload);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({ title: "Follow-up saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (variables.customer_id) {
        queryClient.invalidateQueries({ queryKey: ["customer-followups", variables.customer_id] });
      }
      setFollowDialogOpen(false);
      setFollowCustomer(null);
      setSelectedServiceIds(new Set());
      setFollowNote("");
      setShowMoreDetails(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save follow-up",
        description: error?.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomers(new Set(customerRows.map((c) => c.id)));
    } else {
      setSelectedCustomers(new Set());
    }
  };

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    const newSelected = new Set(selectedCustomers);
    if (checked) {
      newSelected.add(customerId);
    } else {
      newSelected.delete(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const handleOpenNoteDialog = (customer: CustomerWithOpportunity) => {
    setNoteCustomer(customer);
    setNoteText(customer.lastNote || "");
    setNoteDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (noteCustomer) {
      updateNoteMutation.mutate({ customerId: noteCustomer.id, note: noteText });
    }
  };

  const handleOpenFollowDialog = (customer: CustomerWithOpportunity) => {
    setFollowCustomer(customer);
    setFollowDialogOpen(true);
    setFollowNote("");
    setFollowMethod("Call");
    setSelectedServiceIds(new Set());
    setShowMoreDetails(false);
    setFollowNextDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSelectFollowCustomer = (customerId: string) => {
    const found = customerRows.find((c) => c.id === customerId);
    if (found) {
      handleOpenFollowDialog(found);
    }
  };

  const toggleServiceSelection = (serviceId: string, checked: boolean) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });
  };

  const handleSubmitFollowUp = async () => {
    if (!followCustomer) {
      toast({ title: "Select a customer first", variant: "destructive" });
      return;
    }
    if (selectedServiceIds.size === 0) {
      toast({ title: "Select at least one service", variant: "destructive" });
      return;
    }

    try {
      const res = await apiRequest("GET", `/api/sales/customers/${followCustomer.id}/followups`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const hasFollowupToday = rows.some((item: any) => {
         if (!item.createdAt) return false;
         return item.createdAt.startsWith(todayStr);
      });

      if (hasFollowupToday) {
         const confirm = window.confirm("A follow-up has already been added for this customer today. Are you sure you want to proceed?");
         if (!confirm) return;
      }
    } catch (err) {
      console.error("Failed to check duplicate followup", err);
    }

    followUpMutation.mutate({
      customer_id: followCustomer.id,
      service_ids: Array.from(selectedServiceIds),
      note: followNote.trim() || undefined,
      next_date: followNextDate ? new Date(followNextDate).toISOString() : undefined,
      method: followMethod || undefined,
    });
  };

  const clearFilters = () => {
    setSearch("");
    setStageFilter("");
    setGradeFilter("");
    setPage(1);
  };

  const getStageBadge = (stage?: string) => {
    const stageInfo = STAGES.find((s) => s.value === stage);
    return stageInfo?.label || stage || "Unknown";
  };

  const customerRows = customersData?.data ?? customersData?.customers ?? [];
  const meta = customersData?.meta ?? {
    total: customersData?.total ?? 0,
    page: customersData?.page ?? page,
    limit: customersData?.pageSize ?? pageSize,
    totalPages:
      customersData?.totalPages ??
      Math.ceil((customersData?.total ?? 0) / (((customersData?.pageSize ?? pageSize) || 1))),
  };

  const totalCustomers = meta.total ?? 0;
  const totalPages = meta.totalPages ?? 1;
  const gradeStats = statsData?.data?.gradeStats ?? statsData?.gradeStats ?? {};
  const activeFollowCustomer = followCustomerDetails ?? followCustomer;

  return (
    <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-1 wide-page">
      <div className="max-w-full space-y-1 min-w-0">
        {/* Header section with stats */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-bold tracking-tight">Customer Management</h1>
              <p className="text-[10px] text-muted-foreground">Manage your leads and customers ({totalCustomers} total)</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-mono text-[9px] h-5">A: 1</Badge>
          </div>
          {/* Stats Summary */}
          {gradeStats && Object.keys(gradeStats).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(gradeStats).slice(0, 4).map(([grade, count]) => (
                <Badge
                  key={grade}
                  className={`${GRADE_COLORS[grade] || "bg-gray-400"} px-2.5 py-1 text-[11px] font-bold tracking-wider`}
                  data-testid={`badge-grade-stat-${grade}`}
                >
                  {grade}: {count}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <Card className="shadow-none border-none bg-transparent">
          <CardContent className="py-1 px-1">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
              {/* Search */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search company, email, phone, NTN..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>

              {/* Stage Filter */}
              <div className="w-full lg:w-[180px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead Status</label>
                <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grade Filter */}
              <div className="w-full lg:w-[150px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Grade</label>
                <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(1); }}>
                  <SelectTrigger data-testid="select-grade">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page Size */}
              <div className="w-full lg:w-[120px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Per Page</label>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-pagesize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant={showAllRecords ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setShowAllRecords(true); clearFilters(); }}
                  data-testid="button-display-all"
                >
                  Display All
                </Button>
                <Button
                  variant={!showAllRecords ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAllRecords(false)}
                  data-testid="button-filtered"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filtered
                </Button>
                {(search || stageFilter || gradeFilter) && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={isExporting}
                  data-testid="button-export-csv"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Table */}
        <Card className="shadow-none border-none">
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto min-w-0">
              <Table className="w-full table-fixed min-w-[1420px]">
                <colgroup>
                  <col className="w-[30px]" />
                  <col className="w-[80px]" />
                  <col className="w-[90px]" />
                  <col className="w-[130px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                  <col className="w-[160px]" />
                  <col className="w-[100px]" />
                  <col className="w-[80px]" />
                  <col className="w-[100px]" />
                  <col className="w-[70px]" />
                  <col className="w-[90px]" />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="py-1 px-1">
                      <Checkbox
                        checked={
                          customerRows.length
                            ? selectedCustomers.size === customerRows.length
                            : false
                        }
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">DRM ID</TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">CRM ID</TableHead>
                    <TableHead
                      className="py-1 px-1 text-[10px] font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("companyName")}
                      data-testid="header-company"
                    >
                      <div className="flex items-center gap-1">
                        Company
                        {sortBy === "companyName" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">Sale Person</TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium">Account Holder</TableHead>
                    <TableHead
                      className="py-1 px-1 text-[10px] font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleSort("email")}
                      data-testid="header-email"
                    >
                      <div className="flex items-center gap-1">
                        Email
                        {sortBy === "email" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">Phone</TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">NTN</TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap">CNIC</TableHead>
                    <TableHead
                      className="py-1 px-1 text-[10px] font-medium cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap text-center"
                      onClick={() => handleSort("grade")}
                      data-testid="header-grade"
                    >
                      <div className="flex items-center justify-center gap-1">
                        Grade
                        {sortBy === "grade" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap text-center">Stage</TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium">Last Note</TableHead>
                    <TableHead
                      className="py-1 px-1 text-[10px] font-medium cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap"
                      onClick={() => handleSort("createdAt")}
                      data-testid="header-created"
                    >
                      <div className="flex items-center gap-1">
                        Created
                        {sortBy === "createdAt" && (sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                      </div>
                    </TableHead>
                    <TableHead className="py-1 px-1 text-[10px] font-medium whitespace-nowrap text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCustomers ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={15} className="py-3 px-3">
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : customerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={15} className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No customers found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerRows.map((customer) => (
                      <>
                        <TableRow
                          key={customer.id}
                          className={`hover:bg-muted/30 transition-colors ${selectedCustomers.has(customer.id) ? "bg-muted/50" : ""}`}
                          data-testid={`row-customer-${customer.id}`}
                        >
                          <TableCell className="py-1 px-1">
                            <Checkbox
                              checked={selectedCustomers.has(customer.id)}
                              onCheckedChange={(checked) => handleSelectCustomer(customer.id, !!checked)}
                              data-testid={`checkbox-customer-${customer.id}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-1 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap bg-emerald-50/30 dark:bg-emerald-950/30">
                            {customer.drmId || (customer.id || "").slice(0, 8)}
                          </TableCell>
                          <TableCell className="py-1 px-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
                            {(customer as any).crmId || "—"}
                          </TableCell>
                          <TableCell className="py-1 px-1 font-medium text-[10px]">
                            <div className="flex items-center gap-2">
                              <button
                                className="text-left hover:underline flex items-center gap-1 min-w-0"
                                onClick={() =>
                                  setExpandedCustomer(
                                    expandedCustomer === customer.id ? null : customer.id
                                  )
                                }
                                data-testid={`button-expand-${customer.id}`}
                              >
                                <span className="truncate max-w-[110px]">{customer.companyName || "—"}</span>
                                {expandedCustomer === customer.id ? (
                                  <ChevronUp className="h-3 w-3 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                )}
                              </button>
                              {customer.isTemp && (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[9px] h-4 px-1 shrink-0">
                                  Lead
                                </Badge>
                              )}
                              {(customer as any).isFocus && (
                                <Star
                                  className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500"
                                  data-testid={`icon-focus-${customer.id}`}
                                >
                                  <title>Marked as Focus</title>
                                </Star>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 px-1 text-[10px] truncate max-w-[110px]">{customer.salesPersonName || "—"}</TableCell>
                          <TableCell className="py-1 px-1 text-[10px] truncate max-w-[100px]">{customer.accountName || "—"}</TableCell>
                          <TableCell className="py-1 px-1 text-[10px]">
                            <div className="truncate max-w-[140px]" title={customer.email || ""}>{customer.email || "—"}</div>
                          </TableCell>
                          <TableCell className="py-1 px-1 font-mono text-[10px] whitespace-nowrap">{customer.phone || "—"}</TableCell>
                          <TableCell className="py-1 px-1 text-muted-foreground whitespace-nowrap text-[10px]">{customer.ntn || "—"}</TableCell>
                          <TableCell className="py-1 px-1 text-muted-foreground whitespace-nowrap text-[10px]">{(customer as any).cnic || "—"}</TableCell>
                          <TableCell className="py-1 px-1 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge
                                  className={`${GRADE_COLORS[customer.grade] || "bg-gray-400"} cursor-pointer hover:scale-105 transition-transform text-[10px] px-2 py-0.5 rounded-full`}
                                  data-testid={`badge-grade-${customer.id}`}
                                >
                                  {customer.grade || "N/A"}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {GRADES.map((g) => (
                                  <DropdownMenuItem
                                    key={g}
                                    onClick={() => updateGradeMutation.mutate({ customerId: customer.id, grade: g })}
                                  >
                                    <Badge className={`${GRADE_COLORS[g]} mr-2 px-1.5 py-0 text-[9px] rounded-full`}>{g}</Badge>
                                    {g === customer.grade && <Check className="h-4 w-4 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="py-1 px-1 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge variant="outline" className="cursor-pointer hover:bg-muted text-[10px] px-1.5 py-0" data-testid={`badge-stage-${customer.id}`}>
                                  {getStageBadge(customer.opportunity?.stage || customer.status)}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                {STAGES.map((s) => (
                                  <DropdownMenuItem
                                    key={s.value}
                                    onClick={() => updateStageMutation.mutate({ customerId: customer.id, stage: s.value })}
                                  >
                                    {s.label}
                                    {s.value === customer.opportunity?.stage && <Check className="h-4 w-4 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="p-1">
                            <p className="truncate text-[10px] text-muted-foreground max-w-[100px]" title={customer.lastNote || ""}>
                              {customer.lastNote || "-"}
                            </p>
                          </TableCell>
                          <TableCell className="py-1 px-1 text-[10px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {customer.createdAt ? format(new Date(customer.createdAt), "MMM dd, yy") : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-1.5 text-[10px]"
                                onClick={() =>
                                  setExpandedCustomer(
                                    expandedCustomer === customer.id ? null : customer.id
                                  )
                                }
                              >
                                View
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-actions-${customer.id}`}>
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleOpenNoteDialog(customer)}>
                                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                                    Add Note
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleOpenFollowDialog(customer)}>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Follow The Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setExpandedCustomer(
                                        expandedCustomer === customer.id ? null : customer.id
                                      )
                                    }
                                  >
                                    <History className="h-4 w-4 mr-2" />
                                    View History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => pickCustomerMutation.mutate(customer.id)}>
                                    <UserPlus className="h-4 w-4 mr-2 text-emerald-600" />
                                    Move Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStageMutation.mutate({ customerId: customer.id, stage: "QF" })
                                    }
                                  >
                                    <Check className="h-4 w-4 mr-2 text-green-500" />
                                    Mark Qualified
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStageMutation.mutate({ customerId: customer.id, stage: "AY" })
                                    }
                                  >
                                    <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                    Mark Analyzed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateStageMutation.mutate({ customerId: customer.id, stage: "NF" })
                                    }
                                  >
                                    <X className="h-4 w-4 mr-2 text-red-500" />
                                    Mark Dropped
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable Follow-up Details */}
                        {expandedCustomer === customer.id && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={15} className="p-4">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm flex items-center gap-2">
                                  <History className="h-4 w-4" />
                                  Follow-up History for {customer.companyName}
                                </h4>
                                {loadingFollowUps ? (
                                  <Skeleton className="h-20 w-full" />
                                ) : followUps && followUps.length > 0 ? (
                                  <div className="rounded border">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Service</TableHead>
                                          <TableHead>Type</TableHead>
                                          <TableHead>Grade</TableHead>
                                          <TableHead>Notes</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Source</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {followUps.map((fu) => (
                                          <TableRow key={fu.id}>
                                            <TableCell className="font-medium">{fu.serviceName}</TableCell>
                                            <TableCell>{fu.serviceType}</TableCell>
                                            <TableCell>
                                              <Badge className={GRADE_COLORS[fu.grade] || "bg-gray-400"}>
                                                {fu.grade}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[250px]">
                                              <p className="truncate text-sm">{fu.note || "-"}</p>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm">
                                              {format(new Date(fu.createdAt), "MMM dd, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                              <Badge variant="outline" className="text-xs">
                                                {fu.source || "Manual"}
                                              </Badge>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="ml-2"
                                                onClick={() => setViewFollowUp(fu)}
                                                data-testid={`button-open-followup-${fu.id}`}
                                              >
                                                Open
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-muted-foreground">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                    <p>No follow-up records found</p>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCustomers)} of {totalCustomers} customers
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm px-3">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Actions Bar */}
        {selectedCustomers.size > 0 && (
          <Card className="fixed bottom-4 left-1/2 transform -translate-x-1/2 shadow-lg">
            <CardContent className="py-3 px-4 flex items-center gap-4">
              <span className="text-sm font-medium">{selectedCustomers.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => setSelectedCustomers(new Set())}>
                Clear Selection
              </Button>
              <Button
                size="sm"
                disabled={markFocusMutation.isPending}
                onClick={() => {
                  // Only real customers carry the focus flag — Temp Contact
                  // "leads" in the same list (customer.isTemp) don't have it.
                  const focusableIds = customerRows
                    .filter((c: any) => selectedCustomers.has(c.id) && !c.isTemp)
                    .map((c: any) => c.id);
                  if (focusableIds.length === 0) {
                    toast({ title: "Selected leads can't be marked as focus", description: "Only customers support the focus flag.", variant: "destructive" });
                    return;
                  }
                  markFocusMutation.mutate(focusableIds);
                }}
              >
                <Star className="h-4 w-4 mr-1" />
                {markFocusMutation.isPending ? "Marking..." : "Mark as Focus"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Follow-up detail dialog */}
        <Dialog open={!!viewFollowUp} onOpenChange={(open) => !open && setViewFollowUp(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Follow-up Detail</DialogTitle>
            </DialogHeader>
            {viewFollowUp && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Service: </span>
                  <span>{viewFollowUp.serviceName}</span>
                </div>
                <div>
                  <span className="font-medium">Type: </span>
                  <span>{viewFollowUp.serviceType}</span>
                </div>
                <div>
                  <span className="font-medium">Grade: </span>
                  <Badge className={GRADE_COLORS[viewFollowUp.grade] || "bg-gray-400"}>{viewFollowUp.grade}</Badge>
                </div>
                <div>
                  <span className="font-medium">Notes: </span>
                  <span>{viewFollowUp.note || "-"}</span>
                </div>
                <div>
                  <span className="font-medium">Date: </span>
                  <span>{format(new Date(viewFollowUp.createdAt), "MMM dd, yyyy")}</span>
                </div>
                <div>
                  <span className="font-medium">Source: </span>
                  <span>{viewFollowUp.source || "Manual"}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Follow Customer Dialog */}
        <Dialog
          open={followDialogOpen}
          onOpenChange={(open) => {
            setFollowDialogOpen(open);
            if (!open) {
              setFollowCustomer(null);
              setSelectedServiceIds(new Set());
              setShowMoreDetails(false);
              setFollowCustomerDetails(null);
              setFollowNote("");
              setFollowMethod("Call");
              setFollowNextDate("");
            }
          }}
        >
          <DialogContent className="max-w-[1100px] w-[95vw] max-h-[96vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Follow The Customer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg bg-primary text-primary-foreground p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase opacity-80">Selected Customer</p>
                  <p className="text-2xl font-semibold leading-tight">
                    {activeFollowCustomer?.companyName || "Select a customer"}
                  </p>
                  <p className="text-sm opacity-90">
                    {activeFollowCustomer?.accountName || (activeFollowCustomer as any)?.account_holder || ""}
                  </p>
                </div>
                <div className="w-full md:w-64">
                  <Select value={followCustomer?.id ?? ""} onValueChange={handleSelectFollowCustomer}>
                    <SelectTrigger className="bg-background/20 text-foreground border-foreground/20">
                      <SelectValue placeholder="Choose customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customerRows.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Company Details</p>
                  <p className="text-xs text-muted-foreground">Pre-filled from the selected customer record</p>
                </div>
                <Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={() => setShowMoreDetails(!showMoreDetails)}>
                  <span>{showMoreDetails ? "Hide" : "Show"} Additional Details</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMoreDetails ? "rotate-180" : ""}`} />
                </Button>
              </div>

              {showMoreDetails && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { label: "Company Name", value: activeFollowCustomer?.companyName },
                    { label: "Acc Holder", value: activeFollowCustomer?.accountName ?? (activeFollowCustomer as any)?.account_holder },
                    { label: "Email", value: activeFollowCustomer?.email },
                    { label: "Contact No", value: activeFollowCustomer?.phone ?? (activeFollowCustomer as any)?.mobile },
                    { label: "NTN/CNIC", value: activeFollowCustomer?.ntn ?? (activeFollowCustomer as any)?.cnic },
                    { label: "City", value: activeFollowCustomer?.city ?? activeFollowCustomer?.region },
                    { label: "Address", value: activeFollowCustomer?.address },
                    { label: "Business Type", value: activeFollowCustomer?.companyType ?? (activeFollowCustomer as any)?.businessLine },
                    { label: "Notes", value: activeFollowCustomer?.comment ?? activeFollowCustomer?.lastNote },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold text-foreground break-words">{value || "-"}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Services</p>
                    <p className="text-xs text-muted-foreground">Select one or more services to follow up on</p>
                  </div>
                  {loadingServices && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {services.length === 0 && !loadingServices ? (
                  <p className="text-sm text-muted-foreground">No services available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {services.map((svc: Service) => (
                      <label
                        key={svc.id}
                        className="flex items-center gap-3 rounded-md border bg-muted/30 p-3 hover:border-emerald-500 transition-colors"
                      >
                        <Checkbox
                          checked={selectedServiceIds.has(svc.id)}
                          onCheckedChange={(checked) => toggleServiceSelection(svc.id, !!checked)}
                        />
                        <div>
                          <p className="text-sm font-semibold">{svc.name}</p>
                          <p className="text-xs text-muted-foreground uppercase">{svc.code}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Method</label>
                  <Select value={followMethod} onValueChange={setFollowMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Call", "Email", "WhatsApp", "Visit"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Next Follow-up</label>
                  <Input
                    type="datetime-local"
                    value={followNextDate}
                    onChange={(e) => setFollowNextDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                <Textarea
                  placeholder="Add context or the next step..."
                  value={followNote}
                  onChange={(e) => setFollowNote(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              {activeFollowCustomer?.id && (
                <CommunicationTimeline
                  entityType="customer"
                  entityId={activeFollowCustomer.id}
                />
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => { setFollowDialogOpen(false); setFollowCustomer(null); }}>
                  Cancel
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmitFollowUp}
                  disabled={followUpMutation.isPending}
                >
                  {followUpMutation.isPending ? "Saving..." : "Submit Follow-up"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Note Dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note - {noteCustomer?.companyName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter your note here..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="min-h-[120px]"
                data-testid="input-note"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveNote}
                disabled={updateNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {updateNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main >
  );
}
