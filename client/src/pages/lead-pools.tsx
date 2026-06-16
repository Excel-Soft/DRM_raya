import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb } from "@/components/breadcrumb";
import { FollowCustomerServicesPanel, SubserviceDetail } from "@/components/FollowCustomerServicesPanel";
import {
  Users,
  UserCheck,
  Building2,
  Globe,
  Search,
  Loader2,
  ArrowRightLeft,
  UserPlus,
  Clock,
  AlertTriangle,
  Star,
  Phone,
  Mail,
  Calendar,
  MessageCircle,
  Send,
  FileText,
  Instagram,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Upload,
  CheckCircle2,
  XCircle,
  DollarSign,
  Printer,
  History as HistoryIcon,
  Pencil,
  MoreHorizontal,
  RotateCcw,
  Activity,
  Trash2,
  ArrowDownToLine,
  User,
} from "lucide-react";
import type { Customer } from "@shared/schema";
import InvoiceCreateForm from "@/components/InvoiceCreateForm";


const GRADES = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const SERVICE_TYPES = [
  "Alibaba.com",
  "VAS (Value Added Services)",
  "KWA (Keyword Advertising)",
  "PSA (Paid Search Ads)",
  "Website Development",
  "SEO Services",
  "Social Media Marketing",
];

interface PoolCustomer extends Customer {
  ownerName?: string | null;
  company?: string | null;
  accHolder?: string | null;
  contactNo?: string | null;
  ntnCnic?: string | null;
  pool?: string | null;
  expiryDate?: string | null;
}

type PoolType = "Private" | "Service" | "GMBV" | "Public";
type MainTab = "pools" | "gm-pool" | "project-activity";
type GmPoolRow = {
  id: string;
  memberId: string | null;
  orderId: string | null;
  company: string | null;
  salesPerson: string | null;
  packageName: string | null;
  dollarRate: number | null;
  discountPercent: number | string | null;
  status: string | null;
  hodStatus: string | null;
  accountantStatus: string | null;
  createdAt?: string | null;
};
type GmPoolResponse = {
  data: GmPoolRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

type ProjectActivityRow = {
  id: string;
  companyName: string | null;
  personName: string | null;
  projectName: string | null;
  status: string | null;
  docUploadStatus?: string | boolean | null;
  depApprovedStatus?: string | boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ProjectActivityResponse = {
  data: ProjectActivityRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

const statusBarItems = [
  { key: "yetToContact", label: "Yet to Contact", count: 0, color: "emerald", status: "New" },
  { key: "contacted", label: "Contact", count: 0, color: "rose", status: "Contacted" },
  { key: "invoiceSent", label: "Invoice Sent", count: 0, color: "teal", status: "Invoice Sent" },
  { key: "whatsapp", label: "WhatsApp", count: 0, color: "blue", status: "WhatsApp" },
  { key: "email", label: "Email", count: 0, color: "orange", status: "Email" },
  { key: "sms", label: "SMS", count: 0, color: "slate", status: "SMS" },
  { key: "instagram", label: "Instagram", count: 0, color: "pink", status: "Instagram" },
];

type LeadPoolSummary = {
  chips: {
    yetToContact: number;
    contacted: number;
    invoiceSent: number;
    whatsapp: number;
    email: number;
    sms: number;
    instagram: number;
  };
  pools: {
    privatePool: number;
    servicePool: number;
    gmBvPool: number;
    publicPool: number;
    expiringSoon: number;
  };
  generatedAt: string;
};

type LeadPoolListResponse = {
  items: PoolCustomer[];
  total: number;
  page: number;
  pageSize: number;
};

type GmBvItem = {
  id: string;
  customerId?: string | null;
  companyName: string | null;
  accountName?: string | null;
  contactNo?: string | null;
  email?: string | null;
  status?: string | null;
  reportDate?: string | null;
  createdAt?: string | null;
};

type GmBvListResponse = {
  items: GmBvItem[];
  total: number;
  page: number;
  pageSize: number;
};

type FollowupSubserviceOption = { id: string; code: string; name: string };
type FollowupServiceOption = { id: string; code: string; name: string; subServices?: FollowupSubserviceOption[] };

const normalizeCode = (value: string) => value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

const GM_BV_LINK_KEY = "/api/gm-bv-pool";

export default function LeadPools() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [mainTab, setMainTab] = useState<MainTab>("pools");
  const [activePool, setActivePool] = useState<PoolType>("Private");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<PoolCustomer | null>(null);
  const [historyLead, setHistoryLead] = useState<PoolCustomer | null>(null);
  const [historyItems, setHistoryItems] = useState<Array<any>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [quotationHistory, setQuotationHistory] = useState<Array<any>>([]);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [gmHistory, setGmHistory] = useState<Array<any>>([]);
  const [gmLoading, setGmLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewLead, setViewLead] = useState<PoolCustomer | null>(null);
  const [followupLead, setFollowupLead] = useState<PoolCustomer | null>(null);
  const [editLead, setEditLead] = useState<PoolCustomer | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [historyTab, setHistoryTab] = useState("contact");

  const userRoleName = (typeof window !== "undefined" ? sessionStorage.getItem("userRole") : "")?.toLowerCase().replace(/\s+/g, "_") || "";
  const canCreateInvoice = userRoleName === "sales_executive";

  const [editForm, setEditForm] = useState({
    companyName: "",
    accountName: "",
    email: "",
    phone: "",
    grade: "",
    status: "",
    source: "",
    serviceTypes: [] as string[],
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [followupServices, setFollowupServices] = useState<FollowupServiceOption[]>([]);
  const [selectedServiceCodes, setSelectedServiceCodes] = useState<Set<string>>(new Set());
  const [selectedSubservices, setSelectedSubservices] = useState<Record<string, Set<string>>>({});
  const [subserviceDetails, setSubserviceDetails] = useState<Record<string, SubserviceDetail>>({});
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [serviceDetails, setServiceDetails] = useState<Record<string, any>>({});
  const [followupNote, setFollowupNote] = useState("");
  const [followupNextDate, setFollowupNextDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [followupMethod, setFollowupMethod] = useState("Call");
  const [followupReservation, setFollowupReservation] = useState<string | null>(null);
  const [followupReservationError, setFollowupReservationError] = useState<string | null>(null);
  const [followupTalkMinutes, setFollowupTalkMinutes] = useState<number | null>(null);
  const [followupEditId, setFollowupEditId] = useState<string | null>(null);
  const [followupPrefillLoading, setFollowupPrefillLoading] = useState(false);
  const [followupServicesLoading, setFollowupServicesLoading] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [gmDocOpen, setGmDocOpen] = useState(false);
  const [gmDocForm, setGmDocForm] = useState({
    package: "",
    status: "",
    gmDate: "",
    note: "",
    docs: {
      ntn: false,
      form181: false,
      idCard: false,
      bankStatement: false,
      phoneBill: false,
      deed: false,
    },
  });
  const [gmBvOpen, setGmBvOpen] = useState(false);
  const [gmBvForm, setGmBvForm] = useState({
    package: "",
    status: "",
    submitDate: "",
  });
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);


  const resolveCustomerId = (lead: PoolCustomer) =>
    activePool === "GMBV" ? ((lead as any).customerId as string | null | undefined) ?? null : lead.id;

  const updateGmBvCache = (gmBvId: string, customerId: string) => {
    queryClient.setQueryData<any>([GM_BV_LINK_KEY, page, pageSize, searchQuery, statusFilter], (oldData: any) => {
      if (!oldData?.items) return oldData;
      return {
        ...oldData,
        items: oldData.items.map((item: any) =>
          item.id === gmBvId ? { ...item, customerId } : item
        ),
      };
    });
  };

  const ensureCustomerId = async (lead: PoolCustomer, actionLabel: string): Promise<string | null> => {
    const cid = resolveCustomerId(lead);
    if (cid) return cid;
    if (activePool !== "GMBV") {
      toast({
        title: "No linked customer",
        description: `Cannot ${actionLabel} because this entry is not linked to a customer.`,
        variant: "destructive",
      });
      return null;
    }
    const gmBvId = (lead as any).gmBvId || lead.id;
    try {
      const res = await apiRequest("POST", `/api/gm-bv-pool/${gmBvId}/link-customer`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.customerId) {
        updateGmBvCache(gmBvId, data.customerId);
        (lead as any).customerId = data.customerId;
        return data.customerId;
      }
      throw new Error(data?.error || "Unable to link GM BV entry to customer");
    } catch (err: any) {
      toast({
        title: "No linked customer",
        description: err?.message || `Cannot ${actionLabel} because this GM BV entry is not linked to a customer.`,
        variant: "destructive",
      });
      return null;
    }
  };

  const [gmSearchQuery, setGmSearchQuery] = useState("");
  const [gmPage, setGmPage] = useState(1);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [projectPage, setProjectPage] = useState(1);
  const [projectSearchDebounced, setProjectSearchDebounced] = useState("");
  const [projectViewRow, setProjectViewRow] = useState<ProjectActivityRow | null>(null);
  const [gmPageSize] = useState(10);
  const updateGmStatus = useMutation({
    mutationFn: async (payload: { id: string; status?: string; hodStatus?: string; accountantStatus?: string }) => {
      await apiRequest("PATCH", `/api/gm-pool/${payload.id}`, {
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.hodStatus ? { hodStatus: payload.hodStatus } : {}),
        ...(payload.accountantStatus ? { accountantStatus: payload.accountantStatus } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
      toast({ title: "Status Updated", description: "GM entry status updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update GM entry status",
        variant: "destructive",
      });
    },
  });

  const createGmBvEntry = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/gm-bv-pool", payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to create GM BV entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "GM BV entry saved" });
      setGmBvOpen(false);
      setGmBvForm({ package: "", status: "", submitDate: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/gm-bv-pool"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/summary"], exact: false });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save GM BV entry",
        variant: "destructive",
      });
    },
  });

  // ── GM BV Edit/Update state ──
  const [gmBvEditOpen, setGmBvEditOpen] = useState(false);
  const [gmBvEditId, setGmBvEditId] = useState<string | null>(null);
  const [gmBvEditForm, setGmBvEditForm] = useState({ package: "", status: "", submitDate: "", companyName: "" });

  // ── GM BV Withdraw/Delete confirm state ──
  const [gmBvWithdrawId, setGmBvWithdrawId] = useState<string | null>(null);
  const [gmBvDeleteId, setGmBvDeleteId] = useState<string | null>(null);
  const [transferLead, setTransferLead] = useState<PoolCustomer | null>(null);
  const [transferUserId, setTransferUserId] = useState<string>("");

  const updateGmBvEntry = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/gm-bv-pool/${id}`, payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update GM BV entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "GM BV entry updated" });
      setGmBvEditOpen(false);
      setGmBvEditId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/gm-bv-pool"], exact: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const withdrawGmBvEntry = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/gm-bv-pool/${id}/withdraw`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to withdraw GM BV entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "GM BV entry withdrawn" });
      queryClient.invalidateQueries({ queryKey: ["/api/gm-bv-pool"], exact: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGmBvEntry = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/gm-bv-pool/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to delete GM BV entry");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "GM BV entry deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/gm-bv-pool"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/summary"], exact: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const poolFromQuery = params.get("pool") as PoolType | null;
    const path = window.location.pathname;
    let pool: PoolType | null = poolFromQuery;
    if (!pool) {
      if (path.includes("/customers/private-pool")) pool = "Private";
      else if (path.includes("/customers/service-pool")) pool = "Service";
      else if (path.includes("/customers/gmbv-pool")) pool = "GMBV";
      else if (path.includes("/customers/public-pool")) pool = "Public";
    }
    if (pool && ["Private", "Service", "GMBV", "Public"].includes(pool)) {
      setActivePool(pool);
    }
    const important = params.get("important");
    if (important) {
      // Map important filters to grade presets where possible
      if (["a_followup"].includes(important)) {
        setGradeFilter("A-"); // show newly added A- follow-ups
      } else if (["b_plus_followup"].includes(important)) {
        setGradeFilter("B+");
      } else if (["b_followup"].includes(important)) {
        setGradeFilter("B");
      }
    }
  }, [location]);

  useEffect(() => {
    if (historyTab === "quotation" && viewLead) {
      fetchQuotationHistory(viewLead.id);
    }
    if (historyTab === "gm" && viewLead) {
      fetchGmHistory(viewLead.id);
    }
  }, [historyTab, viewLead]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setProjectSearchDebounced(projectSearchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [projectSearchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: summary, refetch: refetchSummary } = useQuery<LeadPoolSummary>({
    queryKey: ["/api/sales/lead-pools/summary"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sales/lead-pools/summary");
      return response.json();
    },
  });

  const { data: tracingSummary, refetch: refetchTracingSummary } = useQuery<Record<string, number>>({
    queryKey: ["/api/sales/tracing/summary", activePool, statusFilter, serviceFilter],
    queryFn: async () => {
      const poolParam = poolParamMap[activePool];
      const params = new URLSearchParams({ pool: poolParam });
      if (statusFilter) params.append("statusFilter", statusFilter);
      if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
      const response = await apiRequest("GET", `/api/sales/tracing/summary?${params.toString()}`);
      return response.json();
    },
  });

  const poolParamMap: Record<PoolType, string> = {
    Private: "private",
    Service: "service",
    GMBV: "gm_bv",
    Public: "public",
  };

  const {
    data: listData,
    isFetching: isLoadingList,
    refetch: refetchList,
  } = useQuery<LeadPoolListResponse>({
    queryKey: ["/api/sales/lead-pools/list", activePool, page, pageSize, gradeFilter, serviceFilter, debouncedSearch, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        pool: poolParamMap[activePool],
        page: String(page),
        pageSize: String(pageSize),
      });
      if (gradeFilter !== "all" && !debouncedSearch) params.append("grade", gradeFilter);
      if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter && !debouncedSearch) params.append("statusFilter", statusFilter);
      const response = await apiRequest("GET", `/api/sales/lead-pools/list?${params.toString()}`);
      return response.json();
    },
    placeholderData: keepPreviousData,
    enabled: activePool !== "GMBV",
  });

  const claimMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiRequest("POST", "/api/pools/claim", { customerId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lead Claimed",
        description: "The lead has been added to your private pool.",
      });
      setClaimDialogOpen(false);
      setSelectedCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/list"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/summary"], exact: false });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to claim lead.",
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: { customerId: string; ownerUserId: string }) => {
      const res = await apiRequest("PATCH", `/api/sales/leads/${data.customerId}`, { ownerUserId: data.ownerUserId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead transferred successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/list"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/summary"], exact: false });
      setTransferLead(null);
      setTransferUserId("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const { data: allUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      const data = await res.json();
      return data.users || [];
    },
    enabled: !!transferLead
  });

  const handleClaim = (customer: PoolCustomer) => {
    setSelectedCustomer(customer);
    setClaimDialogOpen(true);
  };

  const confirmClaim = () => {
    if (selectedCustomer) {
      claimMutation.mutate(selectedCustomer.id);
    }
  };

  const {
    data: gmBvList,
    isFetching: isLoadingGmBvList,
    isError: isGmBvError,
  } = useQuery<GmBvListResponse>({
    queryKey: ["/api/gm-bv-pool", page, pageSize, debouncedSearch, statusFilter],
    enabled: activePool === "GMBV",
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (statusFilter && !debouncedSearch) params.set("status", statusFilter);
      const response = await apiRequest("GET", `/api/gm-bv-pool?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch GM BV pool");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
  });

  const {
    data: gmPoolResponse,
    isFetching: isLoadingGmPool,
    isError: isGmPoolError,
  } = useQuery<GmPoolResponse>({
    queryKey: ["/api/gm-pool", gmPage, gmPageSize, gmSearchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(gmPage),
        pageSize: String(gmPageSize),
      });
      if (gmSearchQuery.trim()) params.set("search", gmSearchQuery.trim());
      const response = await apiRequest("GET", `/api/gm-pool?${params.toString()}`);
      return response.json();
    },
  });

  const {
    data: projectActivityResponse,
    isFetching: isLoadingProjectActivity,
    isError: isProjectActivityError,
  } = useQuery<ProjectActivityResponse>({
    queryKey: ["/api/project-activity", projectPage, pageSize, projectSearchDebounced],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(projectPage),
        pageSize: String(pageSize),
      });
      if (projectSearchDebounced) params.set("search", projectSearchDebounced);
      const response = await apiRequest("GET", `/api/project-activity?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch project activity");
      }
      return response.json();
    },
    placeholderData: keepPreviousData,
  });

  const getGradeBadgeVariant = (grade: string | null): "default" | "secondary" | "outline" | "destructive" => {
    if (!grade) return "outline";
    if (grade.startsWith("A")) return "default";
    if (grade.startsWith("B")) return "secondary";
    return "outline";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    if (!status) return <Badge variant="outline">Pending</Badge>;
    switch (status) {
      case "Active":
      case "Completed":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">{status}</Badge>;
      case "Pending":
      case "Pending Review":
        return <Badge className="bg-amber-500 hover:bg-amber-600">{status}</Badge>;
      case "In Progress":
        return <Badge className="bg-blue-500 hover:bg-blue-600">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getApprovalBadge = (status: string) => {
    if (!status) status = "Pending";
    switch (status) {
      case "Approved":
      case "Verified":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600"><CheckCircle2 className="w-3 h-3 mr-1" />{status}</Badge>;
      case "Pending":
        return <Badge className="bg-amber-500 hover:bg-amber-600"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
      case "Rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const mapProjectStatus = (status: string | null): "In Progress" | "Pending Review" | "Completed" => {
    const normalized = (status || "").toLowerCase();
    if (normalized.includes("complete")) return "Completed";
    if (normalized.includes("progress") || normalized === "active" || normalized === "in_progress") {
      return "In Progress";
    }
    return "Pending Review";
  };

  const getProjectStatusBadge = (status: string | null) => {
    const label = mapProjectStatus(status);
    if (label === "Completed") {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">Completed</Badge>;
    }
    if (label === "In Progress") {
      return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
    }
    return <Badge className="bg-amber-500 hover:bg-amber-600">Pending Review</Badge>;
  };

  const getDocUploadBadge = (status?: string | boolean | null) => {
    const uploaded = typeof status === "string" ? status.toLowerCase() === "uploaded" : !!status;
    if (uploaded) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Uploaded
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Upload className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getDepApprovedBadge = (status?: string | boolean | null) => {
    const approved = typeof status === "string" ? status.toLowerCase() === "approved" : !!status;
    if (approved) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-500/30">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const gmBvCustomers = ((gmBvList?.items ?? []).map((item) => ({
    id: item.customerId ?? item.id,
    customerId: item.customerId ?? null,
    gmBvId: item.id,
    drmId: (item as any).drmId || null,
    company: item.companyName,
    companyName: item.companyName,
    accountName: item.accountName || "",
    accHolder: item.accountName || "",
    contactNo: item.contactNo || "",
    phone: item.contactNo || "",
    email: item.email || "",
    ntnCnic: null,
    ntn: null,
    cnic: null,
    expiresAt: null,
    expiryDate: null,
    createdAt: item.reportDate || item.createdAt || null,
    pool: "GMBV",
    poolType: "GMBV",
    status: item.status || null,
    source: null,
    grade: null,
    ownerUserId: item.customerId || null,
    serviceTypes: [],
    approvalStatus: (item as any).approvalStatus || null,
    hodStatus: (item as any).hodStatus || null,
  })) as unknown) as PoolCustomer[];

  const customers: PoolCustomer[] = activePool === "GMBV" ? gmBvCustomers : listData?.items ?? [];
  const total = activePool === "GMBV" ? gmBvList?.total ?? 0 : listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isLoadingActiveList = activePool === "GMBV" ? isLoadingGmBvList : isLoadingList;
  const chipCounts = summary?.chips;
  const statusBar = statusBarItems.map((item) => ({
    ...item,
    count: chipCounts ? (chipCounts as any)[item.key] ?? 0 : 0,
    active: statusFilter === item.status,
  }));
  const visibleIds: string[] = customers.map((c: PoolCustomer) => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.has(id));
  const partiallySelected = visibleIds.some((id) => selectedRows.has(id)) && !allSelected;

  const poolCardBase =
    "group hover:-translate-y-1 transition-all duration-300 shadow-sm border dark:border-slate-800 rounded-2xl bg-white dark:bg-zinc-950 overflow-hidden relative";

  const logLeadAction = async (leadId: string, action: string, meta?: Record<string, any>) => {
    try {
      await apiRequest("POST", `/api/sales/leads/${leadId}/actions`, { action, meta });
    } catch (err) {
      console.warn("Failed to log action", err);
    }
  };

  const normalizePhone = (value?: string) => (value || "").replace(/\D+/g, "");

  const openHistory = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "load history");
    if (!cid) return;
    setHistoryLead({ ...lead, id: cid });
    setHistoryLoading(true);
    await logLeadAction(cid, "history");
    try {
      const res = await apiRequest("GET", `/api/sales/customers/${cid}/followups`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setHistoryItems(rows);
    } catch (err) {
      toast({
        title: "Unable to load history",
        description: err instanceof Error ? err.message : "Failed to fetch history",
        variant: "destructive",
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchQuotationHistory = async (leadId: string) => {
    try {
      setQuotationLoading(true);
      const res = await apiRequest("GET", `/api/quotations?leadId=${leadId}`);
      const data = await res.json().catch(() => ({}));
      const rows = Array.isArray(data?.data) ? data.data : data?.data?.items ?? [];
      setQuotationHistory(rows);
    } catch (err) {
      toast({
        title: "Unable to load quotation history",
        description: err instanceof Error ? err.message : "Failed to fetch quotations",
        variant: "destructive",
      });
    } finally {
      setQuotationLoading(false);
    }
  };

  const fetchGmHistory = async (leadId: string) => {
    try {
      setGmLoading(true);
      const res = await apiRequest("GET", `/api/sales/customers/${leadId}/gm-entries`);
      const data = await res.json();
      setGmHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({
        title: "Unable to load GM history",
        description: err instanceof Error ? err.message : "Failed to fetch GM entries",
        variant: "destructive",
      });
    } finally {
      setGmLoading(false);
    }
  };

  const handleEditOpen = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "edit lead");
    if (!cid) return;
    setEditLead({ ...lead, id: cid });
    setEditForm({
      companyName: lead.companyName || (lead as any).company || "",
      accountName: lead.accountName || (lead as any).accHolder || "",
      email: (lead as any).email || "",
      phone: lead.phone || (lead as any).contactNo || (lead as any).mobile || "",
      grade: lead.grade || "",
      status: (lead as any).status || "",
      source: (lead as any).source || "",
      serviceTypes: (lead as any).service_types || lead.serviceTypes || [],
    });
    logLeadAction(lead.id, "edit");
  };

  const handleEditSave = async () => {
    if (!editLead) return;
    try {
      const res = await apiRequest("PATCH", `/api/sales/leads/${editLead.id}`, editForm);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update lead");
      }
      toast({ title: "Lead updated" });
      setEditLead(null);
      await Promise.all([refetchList(), refetchSummary()]);
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Failed to update lead",
        variant: "destructive",
      });
    }
  };

  const handleView = async (lead: PoolCustomer) => {
    const targetId = await ensureCustomerId(lead, "view profile");
    if (!targetId) return;
    setViewLead({ ...lead, id: targetId });
    setProfileData(null); // Clear previous profile data to avoid flashing stale info
    try {
      const res = await apiRequest("GET", `/api/sales/leads/${targetId}/profile`);
      const data = await res.json();
      setProfileData(data);
      // Pull history for contact tab at the same time
      try {
        setHistoryLoading(true);
        const historyRes = await apiRequest("GET", `/api/sales/customers/${targetId}/followups`);
        const historyData = await historyRes.json();
        const rows = Array.isArray(historyData) ? historyData : Array.isArray(historyData?.data) ? historyData.data : [];
        setHistoryItems(rows);
      } catch (err) {
        console.warn("Failed to load history for profile", err);
      } finally {
        setHistoryLoading(false);
      }
      await fetchQuotationHistory(targetId);
    } catch (err) {
      toast({ title: "Failed to load profile", variant: "destructive" });
    }
    await logLeadAction(targetId, "view");
  };

  const handleEmail = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "send email");
    if (!cid) return;
    const email = (lead as any).email || "";
    if (!email) {
      toast({ title: "No email available", variant: "destructive" });
      return;
    }
    await logLeadAction(cid, "email", { email });
    window.location.href = `mailto:${email}`;
  };

  const handleWhatsApp = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "open WhatsApp");
    if (!cid) return;
    const phone = normalizePhone(lead.phone || (lead as any).contactNo || (lead as any).mobile || "");
    if (!phone) {
      toast({ title: "No phone available", variant: "destructive" });
      return;
    }
    await logLeadAction(cid, "whatsapp", { phone });
    window.open(`https://wa.me/${phone}`, "_blank");
  };

  const handleCall = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "start call");
    if (!cid) return;
    const phone = normalizePhone(lead.phone || (lead as any).contactNo || (lead as any).mobile || "");
    if (!phone) {
      toast({ title: "No phone available", variant: "destructive" });
      return;
    }
    await logLeadAction(cid, "call", { phone });
    window.location.href = `tel:${phone}`;
  };

  const handlePrint = async (lead: PoolCustomer) => {
    const cid = await ensureCustomerId(lead, "print");
    if (!cid) return;
    await logLeadAction(cid, "print", { companyName: lead.companyName || (lead as any).company });
    window.print();
  };

  const currentGmBvCustomerId =
    viewLead?.id ||
    selectedCustomer?.id ||
    historyLead?.id ||
    followupLead?.id ||
    editLead?.id ||
    null;

  const handleSubmitGmBv = () => {
    const payload = {
      customerId: currentGmBvCustomerId,
      companyName:
        viewLead?.companyName ||
        (viewLead as any)?.company ||
        selectedCustomer?.companyName ||
        (selectedCustomer as any)?.company ||
        null,
      title: gmBvForm.package?.trim() || viewLead?.companyName || "GM BV Entry",
      status: gmBvForm.status?.trim() || "Draft",
      reportDate: gmBvForm.submitDate || new Date().toISOString().slice(0, 10),
      notes: gmBvForm.status?.trim() || null,
      meta: {
        package: gmBvForm.package || null,
        submitDate: gmBvForm.submitDate || null,
      },
    };
    createGmBvEntry.mutate(payload);
  };

  const resetFollowupForm = () => {
    setSelectedServiceCodes(new Set());
    setSelectedSubservices({});
    setSubserviceDetails({});
    setExpandedServices(new Set());
    setServiceDetails({});
    setFollowupNote("");
    setFollowupMethod("Call");
    setFollowupNextDate(new Date().toISOString().slice(0, 16));
    setShowAdditionalDetails(false);
    setFollowupReservation(null);
    setFollowupReservationError(null);
    setFollowupTalkMinutes(null);
  };

  const handleCloseFollowup = () => {
    resetFollowupForm();
    setFollowupLead(null);
    setFollowupEditId(null);
    setFollowupPrefillLoading(false);
  };

  const prefillFollowupFromData = (payload: any, svcList: FollowupServiceOption[]) => {
    const codeToSvc = new Map<string, FollowupServiceOption>();
    svcList.forEach((svc) => codeToSvc.set(normalizeCode(svc.code), svc));

    const serviceCodes: string[] = (payload?.serviceCodes || payload?.services || []).map((c: string) => normalizeCode(c)).filter(Boolean);
    const serviceIds: string[] = payload?.serviceIds || [];
    const subServices: Array<any> = payload?.subServices || payload?.sub_services || [];
    const subServiceDetails: Array<any> = payload?.subServiceDetails || payload?.sub_service_details || [];

    const finalCodes = serviceCodes.length
      ? serviceCodes
      : (serviceIds || [])
        .map((id: string) => svcList.find((s) => s.id === id))
        .map((svc) => (svc ? normalizeCode(svc.code) : ""))
        .filter(Boolean);

    if (finalCodes.length) {
      setSelectedServiceCodes(new Set(finalCodes));
    }

    const subSelections: Record<string, Set<string>> = {};
    const subServicesByService = payload?.subServicesByService || payload?.sub_services_by_service;
    if (subServicesByService && typeof subServicesByService === "object") {
      Object.entries(subServicesByService as Record<string, string[]>).forEach(([svcCodeRaw, subs]) => {
        const svcCode = normalizeCode(svcCodeRaw);
        const svc = codeToSvc.get(svcCode);
        if (!svc || !svc.subServices?.length) return;
        const codeSet = new Set((subs || []).map((c) => normalizeCode(c)));
        const matchedIds = svc.subServices.filter((sub) => codeSet.has(normalizeCode(sub.code))).map((sub) => sub.id);
        if (matchedIds.length) {
          subSelections[svcCode] = new Set(matchedIds);
        }
      });
    } else {
      subServices.forEach((sub: any) => {
        const svcCode = normalizeCode(sub.serviceCode || sub.service_code || "");
        if (!svcCode || !sub.id) return;
        if (!subSelections[svcCode]) subSelections[svcCode] = new Set();
        subSelections[svcCode].add(sub.id);
      });
    }
    if (Object.keys(subSelections).length) {
      setSelectedSubservices(subSelections);
    }

    const expanded = new Set<string>();
    finalCodes.forEach((code) => {
      const svc = codeToSvc.get(code);
      if (svc) expanded.add(svc.id);
    });
    Object.keys(subSelections).forEach((code) => {
      const svc = codeToSvc.get(code);
      if (svc) expanded.add(svc.id);
    });
    if (expanded.size) setExpandedServices(expanded);

    const subDetailsMap: Record<string, SubserviceDetail> = {};
    subServiceDetails.forEach((detail: any) => {
      const subId = detail.subservice_id || detail.subServiceId;
      if (!subId) return;
      
      const ttValue = detail.talk_time_minutes ?? detail.talkTimeMinutes;
      const actValue = detail.activity_at || detail.activityAt;
      
      const attachments = detail.attachments ?? [];
      const fileName = attachments.length > 0 ? (attachments[0].fileName || attachments[0].file_name) : undefined;
      
      subDetailsMap[subId] = {
        purpose: detail.purpose ?? "",
        grade: detail.grade ?? "",
        method: detail.method ?? "",
        comment: detail.comment ?? "",
        talkTimeMinutes: detail.method && ttValue != null ? Number(ttValue) : null,
        note: detail.note ?? detail.comment ?? "",
        date: actValue ? new Date(actValue).toISOString().slice(0, 16) : (detail.dateTime ?? ""),
        attachments,
        fileName,
      };
    });
    if (Object.keys(subDetailsMap).length) {
      setSubserviceDetails(subDetailsMap);
    }

    const followupMeta = payload?.followup || payload;
    if (followupMeta) {
      setFollowupNote(followupMeta.notes ?? "");
      setFollowupMethod(followupMeta.method ?? "Call");
      const next = followupMeta.dateTime || followupMeta.dueAt || new Date().toISOString().slice(0, 16);
      setFollowupNextDate(next ? new Date(next).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
      const reservation = followupMeta.reservationType || followupMeta.reservation_type || null;
      if (reservation) {
        setFollowupReservation(reservation);
        setShowAdditionalDetails(true);
      }
      const talkSeconds = Number(followupMeta.talkTimeSeconds ?? followupMeta.talk_time_seconds ?? 0);
      const defaultMinutes = reservation && ["MOBILE", "W_CALL", "VM_APPOINTMENT"].includes(reservation) ? null : null;
      setFollowupTalkMinutes(talkSeconds > 0 ? Math.ceil(talkSeconds / 60) : defaultMinutes);
    }
  };

  const handleFollowupOpen = async (lead: PoolCustomer, followupId?: string) => {
    const cid = await ensureCustomerId(lead, "open follow-up");
    if (!cid) return;
    setFollowupLead({ ...lead, id: cid });
    setFollowupEditId(followupId ?? null);
    resetFollowupForm();
    try {
      const svcList = await loadFollowupServices();
      if (!svcList.length) return;
      setFollowupPrefillLoading(true);
      // Prefill previously selected services (latest follow-up)
      try {
        if (followupId) {
          const followupRes = await apiRequest("GET", `/api/sales/customers/${lead.id}/followups/${followupId}`);
          const followupData = await followupRes.json();
          if (followupData?.data) {
            prefillFollowupFromData(followupData.data, svcList || []);
          }
        } else {
          const followupRes = await apiRequest("GET", `/api/sales/customers/${lead.id}/followups`);
          const followupData = await followupRes.json();
          const latest = Array.isArray(followupData) ? followupData[0] : followupData?.data?.[0];
          if (latest && latest.id && latest.type !== 'gm_entry') {
            const fullLatestRes = await apiRequest("GET", `/api/sales/customers/${lead.id}/followups/${latest.id}`);
            const fullLatestData = await fullLatestRes.json();
            if (fullLatestData?.data) {
              prefillFollowupFromData(fullLatestData.data, svcList || []);
            }
          } else if (latest) {
            prefillFollowupFromData(latest, svcList || []);
          }
        }
      } catch {
        // ignore prefill errors
      } finally {
        setFollowupPrefillLoading(false);
      }
    } catch (err) {
      toast({ title: "Failed to load services", variant: "destructive" });
      setFollowupPrefillLoading(false);
    }
  };

  const handleEditFollowup = async (lead: PoolCustomer, followupId: string) => {
    if (!followupId) return;
    await handleFollowupOpen(lead, followupId);
  };

  const handleToggleService = (serviceId: string, checked: boolean) => {
    const svc = followupServices.find((s) => s.id === serviceId);
    const serviceCode = svc ? normalizeCode(svc.code) : null;
    if (!serviceCode) return;
    setSelectedServiceCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serviceCode);
      else next.delete(serviceCode);
      return next;
    });
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });
    if (!checked) {
      setSelectedSubservices((prev) => {
        const next = { ...prev };
        delete next[serviceCode];
        return next;
      });
      setSubserviceDetails((prev) => {
        const next = { ...prev };
        (svc?.subServices || []).forEach((sub) => {
          delete next[sub.id];
        });
        return next;
      });
    }
  };

  const handleToggleSubservice = (serviceId: string, subserviceId: string, checked: boolean) => {
    const svc = followupServices.find((s) => s.id === serviceId);
    const serviceCode = svc ? normalizeCode(svc.code) : null;
    if (!serviceCode) return;
    if (checked) {
      setSelectedServiceCodes((prev) => {
        const next = new Set(prev);
        next.add(serviceCode);
        return next;
      });
      setExpandedServices((prev) => {
        const next = new Set(prev);
        next.add(serviceId);
        return next;
      });
    }
    setSelectedSubservices((prev) => {
      const next = { ...prev };
      const current = new Set(next[serviceCode] ?? []);
      if (checked) current.add(subserviceId);
      else current.delete(subserviceId);
      if (current.size > 0) next[serviceCode] = current;
      else delete next[serviceCode];
      return next;
    });
    if (!checked) {
      setSubserviceDetails((prev) => {
        const next = { ...prev };
        delete next[subserviceId];
        return next;
      });
    }
  };

  const handleServiceDetailChange = (serviceCode: string, key: string, value: any) => {
    setServiceDetails((prev) => ({
      ...prev,
      [serviceCode]: {
        ...(prev[serviceCode] || {}),
        [key]: value,
      },
    }));
  };

  const validateFollowup = () => {
    if (!followupLead) {
      toast({ title: "Select a lead first", variant: "destructive" });
      return false;
    }
    if (selectedServiceCodes.size === 0) {
      toast({ title: "Select at least one service", variant: "destructive" });
      return false;
    }
    if (showAdditionalDetails) {
      if (!followupReservation) {
        setFollowupReservationError("Reservation is required");
        toast({ title: "Reservation is required", variant: "destructive" });
        return false;
      }
      const isCallType = ["MOBILE", "W_CALL", "VM_APPOINTMENT"].includes(followupReservation);
      if (isCallType && (followupTalkMinutes === null || followupTalkMinutes === undefined)) {
        setFollowupReservationError("Talk time is required");
        toast({ title: "Talk time is required", variant: "destructive" });
        return false;
      }
    }
    setFollowupReservationError(null);
    // Validate required fields for selected services
    const missing: string[] = [];
    const selectedCodes = followupServices
      .filter((s) => selectedServiceCodes.has(normalizeCode(s.code)))
      .map((s) => s.code);
    for (const code of selectedCodes) {
      const fields = serviceFieldConfig[code] || [];
      fields.forEach((f) => {
        if (f.required) {
          const val = serviceDetails[code]?.[f.key];
          if (val === undefined || val === null || val === "") {
            missing.push(`${f.label} (${code})`);
          }
        }
      });
    }
    if (missing.length) {
      toast({ title: "Missing required fields", description: missing.join(", "), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmitFollowup = async () => {
    if (!validateFollowup() || !followupLead) return;

    if (!followupEditId) {
      try {
        const res = await apiRequest("GET", `/api/sales/customers/${followupLead.id}/followups`);
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
    }

    setSubmittingFollowup(true);
    const selectedCodes = followupServices
      .filter((s) => selectedServiceCodes.has(normalizeCode(s.code)))
      .map((s) => normalizeCode(s.code));
    const detailsPayload: Record<string, any> = {};
    selectedCodes.forEach((code) => {
      if (serviceDetails[code]) detailsPayload[code] = serviceDetails[code];
    });
    const subIdToMeta = new Map<string, { serviceId: string; subCode: string; serviceCode: string }>();
    followupServices.forEach((svc) => {
      const svcCode = normalizeCode(svc.code);
      svc.subServices?.forEach((sub) => {
        subIdToMeta.set(sub.id, { serviceId: svc.id, subCode: normalizeCode(sub.code), serviceCode: svcCode });
      });
    });

    const subServicesPayload: Record<string, string[]> = {};
    Object.entries(selectedSubservices || {}).forEach(([serviceCode, set]) => {
      if (!selectedServiceCodes.has(serviceCode)) return;
      if (!serviceCode) return;
      const codes = Array.from(set || [])
        .map((subId) => subIdToMeta.get(subId))
        .filter((meta): meta is { serviceId: string; subCode: string; serviceCode: string } => Boolean(meta && meta.subCode))
        .map((meta) => meta.subCode);
      if (codes.length) {
        subServicesPayload[serviceCode] = Array.from(new Set(codes));
      }
    });

    const detailPayloads: Array<any> = [];
    const invalid: string[] = [];
    Object.entries(selectedSubservices || {}).forEach(([serviceCode, set]) => {
      if (!selectedServiceCodes.has(serviceCode)) return;
      set?.forEach((subId) => {
        const meta = subIdToMeta.get(subId);
        if (!meta) return;
        const detail = subserviceDetails[subId] || {};
        const purpose = detail.purpose ?? "";
        const grade = detail.grade ?? "";
        const method = detail.method ?? "";
        const isCall = !!method;
        const comment = detail.comment ?? "";
        const noteValue = detail.note ?? comment ?? "Note";
        if ([purpose, grade, method, comment, noteValue].every((v) => !v)) return;
        if (isCall && (!detail.talkTimeMinutes || detail.talkTimeMinutes < 1)) {
          invalid.push(`Talk time required for ${meta.subCode}`);
        }
        detailPayloads.push({
          serviceCode: meta.serviceCode,
          subServiceCode: meta.subCode,
          serviceId: meta.serviceId,
          subServiceId: subId,
          purpose,
          grade,
          method,
          comment,
          note: noteValue,
          dateTime: detail.date ? new Date(detail.date).toISOString() : "",
          talkTimeMinutes: isCall ? detail.talkTimeMinutes ?? null : null,
          attachments: detail.attachments ?? [],
        });
      });
    });

    if (invalid.length) {
      toast({ title: "Talk time required", description: invalid.join(", "), variant: "destructive" });
      setSubmittingFollowup(false);
      return;
    }

    const payload = {
      customerId: followupLead.id,
      services: selectedCodes,
      subServices: subServicesPayload,
      subServiceDetails: detailPayloads,
      note: followupNote || undefined,
      nextDate: followupNextDate ? new Date(followupNextDate).toISOString() : undefined,
      method: followupMethod,
      service_details: detailsPayload,
      reservationType: followupReservation ?? undefined,
      reservation: followupReservation ?? undefined,
      talkTimeSeconds: Math.max(0, Math.floor((followupTalkMinutes ?? 0) * 60)),
    };

    console.log("FOLLOWUP_PAYLOAD", {
      services: payload.services,
      subServices: payload.subServices,
    });

    try {
      const isEdit = !!followupEditId;
      const endpoint = isEdit
        ? `/api/sales/customers/${followupLead.id}/followups/${followupEditId}`
        : "/api/sales/followups";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiRequest(method, endpoint, payload);
      await res.json();
      toast({ title: isEdit ? "Follow-up updated" : "Follow-up logged" });
      handleCloseFollowup();
      // refresh data to show backend state
      await Promise.all([refetchList(), refetchSummary()]);
      // refresh dashboard followups widget without manual page reload
      await queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey as any[])?.some?.(
            (k: any) => typeof k === "string" && k.includes("/api/dashboard/followups"),
          ),
      });
      if (viewLead && viewLead.id === followupLead.id) {
        handleView(viewLead);
      }
    } catch (err) {
      toast({ title: "Failed to log follow-up", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSubmittingFollowup(false);
    }
  };


  const serviceFieldConfig: Record<string, Array<{ key: string; label: string; required?: boolean; type?: string }>> = {
    domain_hosting: [
      { key: "domain", label: "Domain Name", required: true },
      { key: "plan", label: "Hosting Plan", required: true },
      { key: "expiry", label: "Expiry Date", type: "date" },
    ],
    design_dev: [
      { key: "type", label: "Design Type", required: true },
      { key: "pages", label: "Pages", type: "number" },
      { key: "ref_url", label: "Reference URL", type: "url" },
    ],
    alibaba_membership: [],
    alibaba_services: [],
  };

  const reservationOptions: Array<{ code: string; label: string }> = [
    { code: "MOBILE", label: "Mobile" },
    { code: "W_CALL", label: "W-Call" },
    { code: "ON_SITE_APPOINTMENT", label: "On-Site Appointment" },
    { code: "E_MAIL", label: "E-mail" },
    { code: "VM_APPOINTMENT", label: "Vm Appointment" },
    { code: "FAX", label: "Fax" },
    { code: "NO_NEED", label: "No Need" },
  ];
  const reservationPlaceholderValue = "SELECT_RESERVATION";

  const handleToggleRow = (id: string, checked: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean, ids: string[]) => {
    setSelectedRows((prev) => {
      if (!checked) return new Set();
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  useEffect(() => {
    // Drop selections that are no longer visible in the current list
    const currentIds = new Set((listData?.items ?? []).map((c: PoolCustomer) => c.id));
    setSelectedRows((prev) => {
      const next = new Set(Array.from(prev).filter((id) => currentIds.has(id)));
      return next;
    });
  }, [listData]);

  const followupCompanyName =
    followupLead?.companyName ||
    (followupLead as any)?.company ||
    (followupLead as any)?.businessName ||
    "Customer";

  const loadFollowupServices = async (): Promise<FollowupServiceOption[]> => {
    if (followupServices.length) return followupServices;
    if (followupServicesLoading) return followupServices;
    setFollowupServicesLoading(true);
    try {
      const res = await apiRequest("GET", "/api/sales/services");
      const data = await res.json();
      const svcList = (data?.items ?? data?.data ?? data) as FollowupServiceOption[];
      setFollowupServices(svcList || []);
      return svcList || [];
    } catch (err) {
      toast({ title: "Failed to load services", variant: "destructive" });
      setFollowupServices([]);
      return [];
    } finally {
      setFollowupServicesLoading(false);
    }
  };

  useEffect(() => {
    // Prefetch follow-up services early so the modal renders options instantly
    loadFollowupServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="flex-1 overflow-auto wide-page">
        <div className="p-1 space-y-4">
          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} className="space-y-4">
            <TabsContent value="pools" className="space-y-6">
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide pt-2">
                {statusBar.map((item) => {
                  const colorMap: Record<string, { gradient: string, shadow: string, border: string, text: string, iconColor: string }> = {
                    emerald: { gradient: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-200", border: "border-emerald-200", text: "text-emerald-50", iconColor: "text-emerald-100" },
                    rose: { gradient: "from-rose-500 to-pink-600", shadow: "shadow-rose-200", border: "border-rose-200", text: "text-rose-50", iconColor: "text-rose-100" },
                    teal: { gradient: "from-teal-500 to-cyan-600", shadow: "shadow-teal-200", border: "border-teal-200", text: "text-teal-50", iconColor: "text-teal-100" },
                    blue: { gradient: "from-blue-500 to-indigo-600", shadow: "shadow-blue-200", border: "border-blue-200", text: "text-blue-50", iconColor: "text-blue-100" },
                    orange: { gradient: "from-orange-500 to-amber-600", shadow: "shadow-orange-200", border: "border-orange-200", text: "text-orange-50", iconColor: "text-orange-100" },
                    slate: { gradient: "from-slate-600 to-slate-700", shadow: "shadow-slate-200", border: "border-slate-200", text: "text-slate-50", iconColor: "text-slate-100" },
                    pink: { gradient: "from-pink-500 to-fuchsia-600", shadow: "shadow-pink-200", border: "border-pink-200", text: "text-pink-50", iconColor: "text-pink-100" },
                  };
                  const colors = colorMap[item.color] || colorMap.slate;
                  const isActive = item.active;
                  
                  return (
                    <button
                      key={item.key}
                      className={`flex-1 min-w-[140px] flex flex-col p-4 rounded-2xl transition-all duration-300 relative group overflow-hidden bg-gradient-to-br ${colors.gradient} ${colors.shadow} ${
                        isActive 
                          ? `shadow-lg scale-105 ring-4 ring-white/30 z-10` 
                          : "hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] opacity-90 hover:opacity-100"
                      }`}
                      onClick={() => {
                        const next = isActive ? null : item.status ?? null;
                        setStatusFilter(next);
                        setPage(1);
                      }}
                      type="button"
                    >
                      {/* Decorative background element */}
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                      
                      <span className={`text-[10px] font-black uppercase tracking-[0.1em] mb-1 ${isActive ? "text-white" : "text-white/80"}`}>
                        {item.label}
                      </span>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-2xl font-black text-white">
                          {item.count}
                        </span>
                        {!isActive && (
                          <div className={`w-2 h-2 rounded-full bg-white/50`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Users className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold uppercase tracking-tight">Customer List</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Search Customer</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                          className="pl-9 h-10 bg-muted/30 border-none focus-visible:ring-1"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Team Customer</label>
                      <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
                        <SelectTrigger className="h-10 bg-muted/30 border-none focus-visible:ring-1">
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {SERVICE_TYPES.map(service => (
                            <SelectItem key={service} value={service}>{service}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-bold uppercase tracking-tight">Tracing</h2>
                  </div>

                  {activePool === "Private" && (
                    <div className="flex w-full rounded overflow-hidden mb-2">
                      {[
                        { label: "Alibaba Membership", value: "Alibaba.com", color: "bg-[#34d399]", count: tracingSummary?.["Alibaba_Membership"] ?? 0 },
                        { label: "Alibaba Services", value: "VAS (Value Added Services)", color: "bg-[#f43f5e]", count: tracingSummary?.["Alibaba_Services"] ?? 0 },
                        { label: "Design Development", value: "Website Development", color: "bg-[#3b82f6]", count: tracingSummary?.["Design_Development"] ?? 0 },
                        { label: "Domain Hosting", value: "Domain Hosting", color: "bg-[#334155]", count: tracingSummary?.["Domain_Hosting"] ?? 0 },
                      ].map((tab, idx) => {
                        const isActive = serviceFilter === tab.value;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (isActive) {
                                setServiceFilter("all");
                              } else {
                                setServiceFilter(tab.value);
                              }
                              setPage(1);
                            }}
                            className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-90 ${isActive ? "bg-[#059669]" : tab.color}`}
                          >
                            {tab.label} {tab.count}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-4 lg:grid-cols-9 gap-2">
                    {["A+", "A-", "B+", "B-", "B", "C+", "C", "D"].map((grade) => {
                      const count = tracingSummary?.[grade] ?? 0;
                      if (tracingSummary && count === 0) return null;
                      const isActive = gradeFilter === grade;
                      const colorMap: Record<string, string> = {
                        "A+": "from-emerald-600 to-teal-700 shadow-emerald-200",
                        "A-": "from-rose-600 to-pink-700 shadow-rose-200",
                        "B+": "from-blue-600 to-indigo-700 shadow-blue-200",
                        "B-": "from-indigo-600 to-violet-700 shadow-indigo-200",
                        "B": "from-amber-500 to-orange-600 shadow-amber-200",
                        "C+": "from-slate-600 to-slate-800 shadow-slate-200",
                        "C": "from-gray-700 to-gray-900 shadow-gray-200",
                        "D": "from-red-600 to-rose-700 shadow-red-200",
                      };
                      const gradientClass = colorMap[grade] || colorMap.C;
                      return (
                        <button
                          key={grade}
                          onClick={() => {
                            const next = isActive ? "all" : grade;
                            setGradeFilter(next);
                            setPage(1);
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-300 bg-gradient-to-br ${gradientClass} text-white shadow-sm ${
                            isActive 
                              ? `shadow-lg scale-105 ring-4 ring-white/30 z-10` 
                              : "opacity-90 hover:opacity-100 hover:scale-[1.02] hover:-translate-y-0.5"
                          }`}
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider">{grade}</span>
                          <span className="text-[13px] font-black ml-2 text-white drop-shadow-sm">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {/* Private Pool */}
                <Card
                  className={`${poolCardBase} cursor-pointer ${
                    activePool === "Private"
                      ? "ring-2 ring-emerald-500/50 border-emerald-500 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 shadow-md shadow-emerald-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-1.5 after:h-full after:bg-gradient-to-b after:from-emerald-400 after:to-teal-500"
                      : "border-gray-100/80 hover:border-emerald-200"
                  }`}
                  onClick={() => setActivePool("Private")}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">Private Pool</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-zinc-100" data-testid="stat-private">{summary?.pools?.privatePool || 0}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${activePool === "Private" ? "bg-emerald-500 text-white shadow-inner" : "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60"}`}>
                        <UserCheck className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Service Pool */}
                <Card
                  className={`${poolCardBase} cursor-pointer ${
                    activePool === "Service"
                      ? "ring-2 ring-purple-500/50 border-purple-500 bg-gradient-to-br from-purple-50/50 to-fuchsia-50/50 shadow-md shadow-purple-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-1.5 after:h-full after:bg-gradient-to-b after:from-purple-400 after:to-fuchsia-500"
                      : "border-gray-100/80 hover:border-purple-200"
                  }`}
                  onClick={() => setActivePool("Service")}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">Service Pool</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-zinc-100" data-testid="stat-service">{summary?.pools?.servicePool || 0}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${activePool === "Service" ? "bg-purple-500 text-white shadow-inner" : "bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/60"}`}>
                        <Building2 className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* GM BV Pool */}
                <Card
                  className={`${poolCardBase} cursor-pointer ${
                    activePool === "GMBV"
                      ? "ring-2 ring-amber-500/50 border-amber-500 bg-gradient-to-br from-amber-50/50 to-orange-50/50 shadow-md shadow-amber-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-1.5 after:h-full after:bg-gradient-to-b after:from-amber-400 after:to-orange-500"
                      : "border-gray-100/80 hover:border-amber-200"
                  }`}
                  onClick={() => setActivePool("GMBV")}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">GM BV Pool</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-zinc-100" data-testid="stat-gmbv">{summary?.pools?.gmBvPool || 0}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${activePool === "GMBV" ? "bg-amber-500 text-white shadow-inner" : "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/60"}`}>
                        <Star className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Public Pool */}
                <Card
                  className={`${poolCardBase} cursor-pointer ${
                    activePool === "Public"
                      ? "ring-2 ring-blue-500/50 border-blue-500 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-md shadow-blue-100 after:content-[''] after:absolute after:top-0 after:left-0 after:w-1.5 after:h-full after:bg-gradient-to-b after:from-blue-400 after:to-indigo-500"
                      : "border-gray-100/80 hover:border-blue-200"
                  }`}
                  onClick={() => setActivePool("Public")}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">Public Pool</p>
                        <p className="text-2xl font-black text-slate-800 dark:text-zinc-100" data-testid="stat-public">{summary?.pools?.publicPool || 0}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl ${activePool === "Public" ? "bg-blue-500 text-white shadow-inner" : "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60"}`}>
                        <Globe className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expiring Soon (Not clickable as a pool, but stylistically matched) */}
                <Card className={`${poolCardBase} border-rose-100 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800/50`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 truncate">Expiring Soon</p>
                        <p className="text-2xl font-black text-rose-700" data-testid="stat-expiring">{summary?.pools.expiringSoon || 0}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/60 group-hover:text-rose-700 dark:group-hover:text-rose-300 transition-colors">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-black uppercase tracking-tighter">
                      {activePool === "GMBV" ? "Gold Member Business Verified" : `${activePool} Pool`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold uppercase" onClick={() => {
                        refetchList();
                        refetchSummary();
                        refetchTracingSummary();
                      }}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {activePool === "GMBV" && isGmBvError ? (
                    <div className="flex items-center justify-center gap-2 text-destructive py-6">
                      <AlertTriangle className="w-5 h-5" />
                      Failed to load GM BV pool. Please try again.
                    </div>
                  ) : isLoadingActiveList && !listData ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium">No leads in this pool</h3>
                      <p className="text-muted-foreground mt-1">
                        {searchQuery || gradeFilter !== "all" || serviceFilter !== "all"
                          ? "Try adjusting your filters"
                          : "No leads have been assigned to this pool yet"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto border border-border/50 rounded-lg bg-card">
                        <Table className="w-full table-fixed min-w-[1000px]">
                          <TableHeader className="bg-muted/50">
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[48px] py-4">
                                <Checkbox
                                  aria-label="Select all leads"
                                  checked={allSelected ? true : partiallySelected ? "indeterminate" : false}
                                  onCheckedChange={(checked) => handleToggleAll(!!checked, visibleIds)}
                                />
                              </TableHead>
                              <TableHead className="w-[100px] text-[10px] font-bold uppercase py-2">Company ID</TableHead>
                              <TableHead className="w-[150px] text-[10px] font-bold uppercase py-2">Co Name</TableHead>
                              <TableHead className="w-[120px] text-[10px] font-bold uppercase py-2">Acc Holder</TableHead>
                              <TableHead className="w-[180px] text-[10px] font-bold uppercase py-2">Email</TableHead>
                              <TableHead className="w-[120px] text-[10px] font-bold uppercase py-2">Contact No</TableHead>
                              <TableHead className="w-[100px] text-[10px] font-bold uppercase py-2">NTN / CNIC</TableHead>
                              <TableHead className="w-[110px] text-[10px] font-bold uppercase py-2">Account Create Date</TableHead>
                              <TableHead className="text-[10px] font-bold uppercase py-2 text-center">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customers.map((customer: PoolCustomer) => {
                              const companyName = customer.companyName || (customer as any).company || "-";
                              const accountName = customer.accountName || (customer as any).accHolder || "-";
                              const phone = customer.phone || (customer as any).contactNo || (customer as any).mobile || "";
                              const email = (customer as any).email || "";
                              const ntnCnic = (customer as any).ntn || (customer as any).cnic || (customer as any).ntnCnic || null;
                              const expiresAt = (customer as any).expiresAt || (customer as any).expiryDate || null;
                              const createdAt = (customer as any).createdAt;
                              const isApproved = (customer as any).approvalStatus === 'approved';
                              return (
                                <TableRow
                                  key={customer.id}
                                  data-testid={`row-customer-${customer.id}`}
                                  className="group cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                                  onClick={() => handleFollowupOpen(customer)}
                                >
                                  <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                                    <Checkbox
                                      aria-label={`Select ${companyName}`}
                                      checked={selectedRows.has(customer.id)}
                                      onCheckedChange={(checked) => handleToggleRow(customer.id, !!checked)}
                                    />
                                  </TableCell>
                                  <TableCell className="py-2 font-mono text-[9px] text-muted-foreground whitespace-nowrap truncate">
                                    {customer.drmId || (customer.id || "").slice(0, 8) || "—"}
                                  </TableCell>
                                  <TableCell className="py-2 font-bold text-[11px] text-foreground truncate">{companyName}</TableCell>
                                  <TableCell className="py-2 text-[11px] text-muted-foreground truncate">{accountName}</TableCell>
                                  <TableCell className="py-2 text-[11px] text-muted-foreground truncate">
                                    {email || "-"}
                                  </TableCell>
                                  <TableCell className="py-2 text-[11px] text-muted-foreground whitespace-nowrap">
                                    {phone || "-"}
                                  </TableCell>
                                  <TableCell className="py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap text-center">
                                    {(ntnCnic && String(ntnCnic).toLowerCase() !== "null") ? ntnCnic : "—"}
                                  </TableCell>
                                  <TableCell className="py-2 text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatDate(createdAt)}
                                  </TableCell>
                                  <TableCell className="py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-0.5 px-0.5">
                                      <ActionIcon onClick={() => handleView(customer)} icon={User} label="User Profile" />
                                      <ActionIcon onClick={() => handleView(customer)} icon={Eye} label="View" />
                                      <ActionIcon onClick={() => handleFollowupOpen(customer)} icon={Clock} label="Follow up" />
                                      <ActionIcon onClick={() => handleEmail(customer)} icon={Mail} label="Email" />
                                      <ActionIcon onClick={() => handleWhatsApp(customer)} icon={MessageCircle} label="WhatsApp" />
                                      <ActionIcon onClick={() => handleCall(customer)} icon={Phone} label="Call" />
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className={`h-5 px-1.5 rounded-sm text-white text-[8px] font-medium uppercase transition-all shadow-sm ${canCreateInvoice ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 opacity-50 cursor-not-allowed"}`}
                                        onClick={(e) => {
                                          if (!canCreateInvoice) {
                                            e.preventDefault();
                                            toast({ title: "Access Denied", description: "Only Sales Executives can create invoices.", variant: "destructive" });
                                            return;
                                          }
                                          console.log("Navigating to invoice for customer:", customer.id);
                                          setLocation(`/sales/create-invoice/${customer.id}`);
                                        }}
                                        disabled={!canCreateInvoice}
                                      >
                                        <FileText className="w-2.5 h-2.5 mr-1" />
                                        Invoice
                                      </Button>
                                      {(!isApproved || activePool !== "GMBV") && (
                                        <ActionIcon onClick={() => handleEditOpen(customer)} icon={Pencil} label="Edit" />
                                      )}
                                      <ActionIcon onClick={() => handlePrint(customer)} icon={Printer} label="Print" />
                                      {activePool === "Public" && (
                                        <ActionIcon onClick={() => handleClaim(customer)} icon={UserPlus} label="Claim" />
                                      )}
                                      {/* ── GMBV-specific actions ── */}
                                      {activePool === "GMBV" && (() => {
                                        const gmId = (customer as any).gmBvId || customer.id;
                                        return (
                                          <>
                                            {!isApproved && (
                                              <ActionIcon
                                                icon={Pencil}
                                                label="Update GM BV"
                                                onClick={() => {
                                                  setGmBvEditId(gmId);
                                                  setGmBvEditForm({
                                                    companyName: customer.companyName || (customer as any).company || "",
                                                    package: (customer as any).meta?.package || "",
                                                    status: (customer as any).status || "",
                                                    submitDate: (customer as any).createdAt?.slice(0, 10) || "",
                                                  });
                                                  setGmBvEditOpen(true);
                                                }}
                                              />
                                            )}
                                            {!isApproved && (
                                              <ActionIcon
                                                icon={ArrowDownToLine}
                                                label="Withdraw"
                                                onClick={() => {
                                                  setGmBvWithdrawId(gmId);
                                                }}
                                              />
                                            )}
                                            {!isApproved && (
                                              <ActionIcon
                                                icon={Trash2}
                                                label="Delete"
                                                onClick={() => {
                                                  setGmBvDeleteId(gmId);
                                                }}
                                              />
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing {customers.length} of {total} leads
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            data-testid="button-prev-page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm">Page {page} of {totalPages || 1}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            data-testid="button-next-page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gm-pool" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      GM Pool Management
                    </CardTitle>
                    <CardDescription>Gold Member orders and package management</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search GM Pool..."
                      value={gmSearchQuery}
                      onChange={(e) => { setGmSearchQuery(e.target.value); setGmPage(1); }}
                      className="pl-9 w-[200px]"
                      data-testid="input-search-gm"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const rows = gmPoolResponse?.data ?? [];
                    const total = gmPoolResponse?.meta?.total ?? 0;
                    const totalPages = Math.max(1, Math.ceil(total / gmPageSize));
                    const start = total === 0 ? 0 : (gmPage - 1) * gmPageSize + 1;
                    const end = Math.min(total, gmPage * gmPageSize);

                    if (isGmPoolError) {
                      return (
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-5 h-5" />
                          Failed to load GM Pool data. Please try again.
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Member ID</TableHead>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Sales Person</TableHead>
                                <TableHead>Package</TableHead>
                                <TableHead>Dollar Rate</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>HOD</TableHead>
                                <TableHead>Accountant</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isLoadingGmPool ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Loading GM Pool...
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : rows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    No data available in table
                                  </TableCell>
                                </TableRow>
                              ) : (
                                rows.map((row: GmPoolRow, index: number) => (
                                  <TableRow key={row.id || index} data-testid={`row-gm-${index}`}>
                                    <TableCell className="font-mono font-medium">{row.memberId || "-"}</TableCell>
                                    <TableCell className="font-mono text-sm">{row.orderId || "-"}</TableCell>
                                    <TableCell className="font-medium">{row.company || "-"}</TableCell>
                                    <TableCell>{row.salesPerson || "-"}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline">{row.packageName || "-"}</Badge>
                                    </TableCell>
                                    <TableCell className="font-mono">
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                                        {row.dollarRate ?? "-"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-emerald-600">{row.discountPercent ?? "-"}</TableCell>
                                    <TableCell>
                                      <Select
                                        value={(row.status || "Pending").toLowerCase()}
                                        onValueChange={(val) =>
                                          row.id && updateGmStatus.mutate({ id: row.id, status: val === "done" ? "Done" : "Pending" })
                                        }
                                        disabled={updateGmStatus.isPending}
                                      >
                                        <SelectTrigger className="w-[140px]" data-testid={`select-gm-status-${row.id}`}>
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="done">Done</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={(row.hodStatus || "Pending").toLowerCase()}
                                        onValueChange={(val) =>
                                          row.id &&
                                          updateGmStatus.mutate({ id: row.id, hodStatus: val === "done" ? "Done" : "Pending" })
                                        }
                                        disabled={updateGmStatus.isPending}
                                      >
                                        <SelectTrigger className="w-[140px]" data-testid={`select-gm-hod-status-${row.id}`}>
                                          <SelectValue placeholder="HOD status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="done">Done</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={(row.accountantStatus || "Pending").toLowerCase()}
                                        onValueChange={(val) =>
                                          row.id &&
                                          updateGmStatus.mutate({
                                            id: row.id,
                                            accountantStatus: val === "done" ? "Done" : "Pending",
                                          })
                                        }
                                        disabled={updateGmStatus.isPending}
                                      >
                                        <SelectTrigger className="w-[140px]" data-testid={`select-gm-accountant-status-${row.id}`}>
                                          <SelectValue placeholder="Accountant status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="done">Done</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm text-muted-foreground">
                            Showing {start} to {end} of {total} entries
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setGmPage(p => Math.max(1, p - 1))}
                              disabled={gmPage === 1 || isLoadingGmPool}
                              data-testid="button-gm-prev-page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">Page {gmPage} of {totalPages || 1}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setGmPage(p => Math.min(totalPages, p + 1))}
                              disabled={gmPage >= totalPages || isLoadingGmPool}
                              data-testid="button-gm-next-page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="project-activity" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      Project Activity
                    </CardTitle>
                    <CardDescription>Track project progress and document uploads</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={projectSearchQuery}
                      onChange={(e) => { setProjectSearchQuery(e.target.value); setProjectPage(1); }}
                      className="pl-9 w-[200px]"
                      data-testid="input-search-project"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const rows = projectActivityResponse?.data ?? [];
                    const total = projectActivityResponse?.meta.total ?? 0;
                    const projectTotalPages = Math.max(1, Math.ceil(total / pageSize));
                    const start = total === 0 ? 0 : (projectPage - 1) * pageSize + 1;
                    const end = Math.min(total, projectPage * pageSize);

                    if (isProjectActivityError) {
                      return (
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-5 h-5" />
                          Failed to load project activity. Please try again.
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Person</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Doc Upload</TableHead>
                                <TableHead>Dep Approved</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {isLoadingProjectActivity && rows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    <div className="flex items-center justify-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Loading project activity...
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : rows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No data available in table
                                  </TableCell>
                                </TableRow>
                              ) : (
                                rows.map((row: ProjectActivityRow, index: number) => (
                                  <TableRow key={index} data-testid={`row-project-${index}`}>
                                    <TableCell className="font-medium">{row.companyName || "-"}</TableCell>
                                    <TableCell>{row.personName || "-"}</TableCell>
                                    <TableCell>{row.projectName || "-"}</TableCell>
                                    <TableCell>{getProjectStatusBadge(row.status)}</TableCell>
                                    <TableCell>{getDocUploadBadge(row.docUploadStatus)}</TableCell>
                                    <TableCell>{getDepApprovedBadge(row.depApprovedStatus)}</TableCell>
                                    <TableCell className="text-right">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setProjectViewRow(row)}
                                        data-testid={`button-view-project-${index}`}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <p className="text-sm text-muted-foreground">
                            Showing {start} to {end} of {total} entries
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setProjectPage(p => Math.max(1, p - 1))}
                              disabled={projectPage === 1 || isLoadingProjectActivity}
                              data-testid="button-project-prev-page"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm">Page {projectPage} of {projectTotalPages || 1}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setProjectPage(p => Math.min(projectTotalPages, p + 1))}
                              disabled={projectPage >= projectTotalPages || isLoadingProjectActivity}
                              data-testid="button-project-next-page"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim Lead</DialogTitle>
              <DialogDescription>
                Are you sure you want to claim "{selectedCustomer?.companyName}"? This will add the lead to your private pool.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>Cancel</Button>
              <Button onClick={confirmClaim} disabled={claimMutation.isPending}>
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Claim Lead
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!viewLead} onOpenChange={() => setViewLead(null)}>
          <DialogContent className="lead-profile-modal sm:max-w-[1200px] w-[98vw] overflow-y-auto max-h-[95vh] bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
            <DialogHeader>
              <DialogTitle>ATTRIBUTE</DialogTitle>
              <DialogDescription>{viewLead?.companyName || (viewLead as any)?.company}</DialogDescription>
            </DialogHeader>
            {viewLead && (
              <div className="space-y-4">
                <div className="lead-top-grid">
                  <div className="lead-history border rounded-lg p-4 bg-card shadow-sm">
                    <div className="lead-card-body text-center space-y-2">
                      <p className="text-sm font-semibold">{viewLead.companyName || (viewLead as any).company}</p>
                      <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-sm font-bold">
                        {viewLead.grade || "N/A"}
                      </div>
                      <p className="text-sm font-medium">{(profileData?.lead?.accountName) || viewLead.accountName || (viewLead as any).accHolder}</p>
                      <p className="text-xs text-muted-foreground">{(profileData?.lead?.email) || (viewLead as any).email || "-"}</p>
                      <div className="flex justify-center gap-2 mt-2">
                        {(profileData?.phones || []).map((p: string, idx: number) => (
                          <button key={idx} className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs">{p}</button>
                        ))}
                      </div>
                      <div className="flex justify-center gap-4 mt-3 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 font-semibold text-xs">{viewLead.grade || "N/A"}</span>
                          <span className="text-muted-foreground text-xs">Grade</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600 font-semibold text-xs">1</span>
                          <span className="text-muted-foreground text-xs">Contact</span>
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-semibold px-3 py-2 rounded-md bg-slate-900 text-white">
                        Last Contact: {profileData?.lastContactAt ? formatDate(profileData.lastContactAt) : "N/A"}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3 justify-center">
                        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2" onClick={() => handleFollowupOpen(viewLead)}>
                          <Clock className="w-4 h-4" />
                          Followup
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-slate-100 text-slate-800 border-slate-300 gap-2 dark:text-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
                          onClick={() => {
                            if (viewLead) {
                              setLocation(`/sales/quotation?leadId=${viewLead.id}`);
                            } else {
                              toast({ title: "No lead selected", variant: "destructive" });
                            }
                          }}
                        >
                          <FileText className="w-4 h-4" />
                          Quotation
                        </Button>
                        <Button
                          size="sm"
                          className={`text-white gap-2 ${canCreateInvoice ? "bg-indigo-500 hover:bg-indigo-600" : "bg-slate-400 opacity-50 cursor-not-allowed"}`}
                          onClick={(e) => {
                            if (!canCreateInvoice) {
                              e.preventDefault();
                              toast({ title: "Access Denied", description: "Only Sales Executives can create invoices.", variant: "destructive" });
                              return;
                            }
                            if (viewLead) {
                              setLocation(`/sales/create-invoice/${viewLead.id}`);
                            }
                          }}
                          disabled={!canCreateInvoice}
                        >
                          <FileText className="w-4 h-4" />
                          Invoice
                        </Button>
                        <Button
                          size="sm"
                          className="bg-rose-500 hover:bg-rose-600 text-white gap-2"
                          onClick={() => setGmDocOpen(true)}
                        >
                          <FileText className="w-4 h-4" />
                          GM Doc
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 bg-amber-50 gap-2"
                          onClick={() => setGmBvOpen(true)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          GM BV submit
                        </Button>
                        <Button
                          size="sm"
                          className="bg-sky-500 hover:bg-sky-600 text-white gap-2"
                          onClick={() => openHistory(viewLead)}
                        >
                          <HistoryIcon className="w-4 h-4" />
                          Action History
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="lead-history border rounded-lg p-4 bg-card shadow-sm">
                    <div className="lead-card-body">
                      <p className="font-semibold mb-2">Expiry Date</p>
                      <div className="space-y-3">
                        {["domain", "ssl", "hosting"].map((svc) => {
                          const entry = (profileData?.services || []).find((s: any) => s.serviceType === svc);
                          return (
                            <div key={svc} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-600">●</span>
                                <span className="capitalize">{svc}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                  {entry?.expiryDate ? formatDate(entry.expiryDate) : "Date"}
                                </Button>
                                <span className="text-rose-600 text-xs bg-rose-50 px-2 py-1 rounded-md">Day Left</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="lead-history border rounded-lg p-4 bg-card shadow-sm">
                    <div className="lead-card-body">
                      <p className="font-semibold">Whatsapp Message</p>
                      <textarea
                        className="w-full mt-2 border rounded-md p-2 text-sm"
                        placeholder="Message..."
                        rows={4}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, source: e.target.value }))}
                      />
                      <Button
                        className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleWhatsApp(viewLead)}
                      >
                        Whatsapp
                      </Button>
                    </div>
                    <div className="border rounded-md p-3 bg-emerald-50">
                      <p className="font-semibold text-sm mb-2 text-emerald-800">Duplicate Company Details</p>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => openHistory(viewLead)}
                      >
                        Find Duplicate Companies
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="lead-history border rounded-lg p-4 bg-card shadow-sm">
                  <p className="font-semibold mb-2">History</p>
                  <Tabs value={historyTab} onValueChange={setHistoryTab}>
                    <TabsList>
                      <TabsTrigger value="contact">Contact History</TabsTrigger>
                      <TabsTrigger value="company">Company History</TabsTrigger>
                      <TabsTrigger value="quotation">Quotation History</TabsTrigger>
                      <TabsTrigger value="invoice">Invoice History</TabsTrigger>
                      <TabsTrigger value="gm">GM History</TabsTrigger>
                      <TabsTrigger value="templates">Quotation Templates</TabsTrigger>
                    </TabsList>
                    <TabsContent value="contact">
                      <div className="overflow-x-auto mt-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Note</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No history</TableCell>
                              </TableRow>
                            ) : (
                              historyItems.map((item: any) => (
                                <TableRow key={item.id}>
                                  <TableCell>{item.createdAt ? formatDate(item.createdAt) : "-"}</TableCell>
                                  <TableCell>{item.note || item.action}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 px-3"
                                      onClick={() => {
                                        if (viewLead) handleEditFollowup(viewLead, item.id);
                                        else if (historyLead) handleEditFollowup(historyLead, item.id);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="company">
                      <p className="text-sm text-muted-foreground mt-3">No company history</p>
                    </TabsContent>
                    <TabsContent value="quotation">
                      <div className="overflow-x-auto mt-3">
                        {quotationLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading quotations...
                          </div>
                        ) : quotationHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No quotation history</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Grand Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {quotationHistory.map((q: any) => (
                                <TableRow key={q.id}>
                                  <TableCell>{q.createdAt ? formatDate(q.createdAt) : "-"}</TableCell>
                                  <TableCell>{q.grandTotal ?? q.totalAmount ?? "-"}</TableCell>
                                  <TableCell>{q.saveStatus ?? "Saved"}</TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setLocation(`/sales/quotation?id=${q.id}${viewLead ? `&leadId=${viewLead.id}` : ""}`)}
                                    >
                                      View / Edit
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="invoice">
                      <p className="text-sm text-muted-foreground mt-3">No invoice history</p>
                    </TabsContent>
                    <TabsContent value="gm">
                      <div className="overflow-x-auto mt-3">
                        {gmLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading GM history...
                          </div>
                        ) : gmHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No GM history found</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Package</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {gmHistory.map((gm: any) => (
                                <TableRow key={gm.id}>
                                  <TableCell>{gm.createdAt ? formatDate(gm.createdAt) : "-"}</TableCell>
                                  <TableCell className="font-mono text-xs">{gm.orderId || "-"}</TableCell>
                                  <TableCell>{gm.package || "-"}</TableCell>
                                  <TableCell>{getApprovalBadge(gm.status)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) }
                      </div>
                    </TabsContent>
                    <TabsContent value="templates">
                      <p className="text-sm text-muted-foreground mt-3">No templates</p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Sheet open={gmDocOpen} onOpenChange={setGmDocOpen}>
          <SheetContent side="right" className="max-w-md w-full overflow-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>GM Doc</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Package</label>
                <Input
                  placeholder="Package"
                  value={gmDocForm.package}
                  onChange={(e) => setGmDocForm({ ...gmDocForm, package: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                <Input
                  placeholder="Status"
                  value={gmDocForm.status}
                  onChange={(e) => setGmDocForm({ ...gmDocForm, status: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">GM Date</label>
                <Input
                  type="date"
                  value={gmDocForm.gmDate}
                  onChange={(e) => setGmDocForm({ ...gmDocForm, gmDate: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Note</label>
                <Textarea
                  rows={3}
                  value={gmDocForm.note}
                  onChange={(e) => setGmDocForm({ ...gmDocForm, note: e.target.value })}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">
                  Please check the Relevant Doc which is submitted in GM BV
                </p>
                <div className="space-y-2 pl-1">
                  {[
                    { key: "ntn", label: "NTN" },
                    { key: "form181", label: "Latest 181 Form" },
                    { key: "idCard", label: "ID card" },
                    { key: "bankStatement", label: "Bank Statement" },
                    { key: "phoneBill", label: "Phone bill" },
                    { key: "deed", label: "Deed (If company have partner)" },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={(gmDocForm.docs as any)[opt.key]}
                        onCheckedChange={(checked) =>
                          setGmDocForm((prev) => ({
                            ...prev,
                            docs: { ...prev.docs, [opt.key]: !!checked },
                          }))
                        }
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={gmBvOpen} onOpenChange={setGmBvOpen}>
          <SheetContent side="right" className="max-w-md w-full overflow-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>User GM BV Submit Date</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Package</label>
                <Input
                  placeholder="Package"
                  value={gmBvForm.package}
                  onChange={(e) => setGmBvForm({ ...gmBvForm, package: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                <Input
                  placeholder="Status"
                  value={gmBvForm.status}
                  onChange={(e) => setGmBvForm({ ...gmBvForm, status: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">User GM BV Submit Date</label>
                <Input
                  type="date"
                  value={gmBvForm.submitDate}
                  onChange={(e) => setGmBvForm({ ...gmBvForm, submitDate: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setGmBvOpen(false)}>Cancel</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSubmitGmBv}
                  disabled={createGmBvEntry.isPending}
                >
                  {createGmBvEntry.isPending ? "Saving..." : "Save GM BV"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={!!historyLead} onOpenChange={() => setHistoryLead(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Action History</DialogTitle>
              <DialogDescription>{historyLead?.companyName || (historyLead as any)?.company}</DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-auto">
                {historyItems.map((item: any) => (
                  <div key={item.id} className="border rounded-md p-3">
                    <div className="font-medium capitalize">{item.action}</div>
                    {item.note && <div className="text-sm text-muted-foreground">{item.note}</div>}
                    <div className="text-xs text-muted-foreground">
                      {item.createdAt ? formatDate(item.createdAt) : "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>{editLead?.companyName || (editLead as any)?.company}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Company" value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} />
              <Input placeholder="Account" value={editForm.accountName} onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })} />
              <Input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              <Input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              <Select value={editForm.grade || "unassigned"} onValueChange={(val) => setEditForm({ ...editForm, grade: val === "unassigned" ? "" : val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No Grade</SelectItem>
                  {["A+", "A-", "B+", "B-", "B", "C+", "C", "D"].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} />
              <Input placeholder="Source" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} />
              <Select value={editForm.serviceTypes?.[0] || "none"} onValueChange={(val) => setEditForm({ ...editForm, serviceTypes: val === "none" ? [] : [val] })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Service</SelectItem>
                  {SERVICE_TYPES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="Domain Hosting">Domain Hosting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditLead(null)}>Cancel</Button>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleEditSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Followup Modal */}
      <Dialog open={!!followupLead} onOpenChange={(open) => {
        if (!open) handleCloseFollowup();
        else if (!followupLead) resetFollowupForm();
      }}>
        <DialogContent className="max-w-[1600px] w-[98vw] max-h-[96vh] overflow-y-auto rounded-xl shadow-2xl border-slate-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>Follow The Customer</DialogTitle>
            <DialogDescription>{followupCompanyName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Customer</label>
              <Input
                readOnly
                value={followupCompanyName}
                className="h-12 text-lg font-semibold bg-muted/50 border-emerald-200"
              />
            </div>

            <FollowCustomerServicesPanel
              services={followupServices}
              selectedServiceCodes={selectedServiceCodes}
              selectedSubservices={selectedSubservices}
              subserviceDetails={subserviceDetails}
              onToggleService={handleToggleService}
              onToggleSubservice={handleToggleSubservice}
              onUpdateDetail={(subId, patch) =>
                setSubserviceDetails((prev: Record<string, SubserviceDetail>): Record<string, SubserviceDetail> => ({
                  ...prev,
                  [subId]: { ...prev[subId], ...patch },
                }))
              }
              onCallMethodSelect={() => {
                setShowAdditionalDetails(true);
              }}
            />

            {showAdditionalDetails && (
              <div className="space-y-3 rounded-md border p-3 bg-muted/40">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Reservation<span className="text-destructive ml-1">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                    <div className="space-y-1 overflow-visible">
                      <label className="text-xs font-medium text-muted-foreground block">Reservation</label>
                      <Select
                        value={followupReservation ?? reservationPlaceholderValue}
                        onValueChange={(v) => {
                          const next = v === reservationPlaceholderValue ? null : v;
                          setFollowupReservation(next);
                          setFollowupReservationError(null);
                          if (next !== "MOBILE" && next !== "W_CALL") {
                            setFollowupTalkMinutes(null);
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select Reservation" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[80]">
                          <SelectItem key="placeholder" value={reservationPlaceholderValue}>
                            Select Reservation
                          </SelectItem>
                          {reservationOptions.map((opt) => (
                            <SelectItem key={opt.code} value={opt.code}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {followupReservationError && (
                        <p className="text-xs text-destructive">{followupReservationError}</p>
                      )}
                    </div>

                    {(followupReservation === "MOBILE" || followupReservation === "W_CALL") && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground block">Talk Time (Minutes)</label>
                        <Input
                          type="number"
                          min={1}
                          max={600}
                          value={followupTalkMinutes ?? ""}
                          onChange={(e) => setFollowupTalkMinutes(e.target.value ? Number(e.target.value) : null)}
                          className="h-10 w-full"
                          placeholder="Enter minutes"
                        />
                      </div>
                    )}
                  </div>
                  {followupReservationError && (
                    <p className="text-xs text-destructive">{followupReservationError}</p>
                  )}
                </div>

                {followupServices
                  .filter((svc) => selectedServiceCodes.has(normalizeCode(svc.code)))
                  .map((svc) => {
                    const fields = serviceFieldConfig[svc.code] || [];
                    if (fields.length === 0) {
                      return (
                        <div key={svc.id} className="text-sm text-muted-foreground">
                          No extra fields for {svc.name}
                        </div>
                      );
                    }
                    return (
                      <div key={svc.id} className="space-y-2">
                        <p className="text-sm font-semibold">{svc.name}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {fields.map((field) => (
                            <div key={field.key}>
                              <label className="text-xs font-medium text-muted-foreground block mb-1">
                                {field.label}
                                {field.required ? " *" : ""}
                              </label>
                              <Input
                                type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                                value={serviceDetails[svc.code]?.[field.key] ?? ""}
                                onChange={(e) => handleServiceDetailChange(svc.code, field.key, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Next Follow-up</label>
                    <Input
                      type="datetime-local"
                      value={followupNextDate}
                      onChange={(e) => setFollowupNextDate(e.target.value)}
                      className="h-10 w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
                    <Textarea
                      placeholder="Add context..."
                      value={followupNote}
                      onChange={(e) => setFollowupNote(e.target.value)}
                      rows={1}
                      className="min-h-[42px] h-10 w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full border-emerald-600 text-emerald-700 justify-center"
                onClick={() => setShowAdditionalDetails((v) => !v)}
              >
                {showAdditionalDetails ? "Hide Additional Details" : "Show Additional Details"}
              </Button>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSubmitFollowup}
                disabled={submittingFollowup || followupPrefillLoading}
              >
                {followupPrefillLoading
                  ? "Loading..."
                  : submittingFollowup
                    ? "Saving..."
                    : followupEditId
                      ? "Update"
                      : "Submit"}
              </Button>
            </div>
          </div>

          {/* Footer removed to match streamlined single submit action */}
        </DialogContent>
      </Dialog>

      <Dialog open={!!projectViewRow} onOpenChange={() => setProjectViewRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Activity</DialogTitle>
            <DialogDescription>Details for the selected project activity row.</DialogDescription>
          </DialogHeader>
          {projectViewRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p className="font-medium">{projectViewRow.companyName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Person</p>
                  <p className="font-medium">{projectViewRow.personName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Project</p>
                  <p className="font-medium">{projectViewRow.projectName || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="mt-1">{getProjectStatusBadge(projectViewRow.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Doc Upload</p>
                  <div className="mt-1">{getDocUploadBadge(projectViewRow.docUploadStatus)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Department Approval</p>
                  <div className="mt-1">{getDepApprovedBadge(projectViewRow.depApprovedStatus)}</div>
                </div>
              </div>
              <pre className="bg-muted/50 rounded-md p-3 text-xs overflow-auto">
                {JSON.stringify(projectViewRow, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto p-0">
          <InvoiceCreateForm
            lead={viewLead}
            onSave={(data) => {
              console.log("Invoice data:", data);
              toast({ title: "Invoice calculated", description: `Grand Total: ${data.grandTotal}` });
              setShowInvoiceForm(false);
            }}
            onClose={() => setShowInvoiceForm(false)}
          />
        </DialogContent>
      </Dialog>


      {/* ── GM BV Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={gmBvEditOpen} onOpenChange={setGmBvEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-500" />
              Update GM BV Entry
            </DialogTitle>
            <DialogDescription>Edit the details of this Gold Member Business Verified entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company Name</label>
              <Input
                value={gmBvEditForm.companyName}
                onChange={(e) => setGmBvEditForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Package</label>
              <Select
                value={gmBvEditForm.package}
                onValueChange={(v) => setGmBvEditForm((f) => ({ ...f, package: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {["Gold", "Silver", "Platinum", "Standard"].map((pkg) => (
                    <SelectItem key={pkg} value={pkg}>{pkg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
              <Select
                value={gmBvEditForm.status}
                onValueChange={(v) => setGmBvEditForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {["Draft", "Submitted", "Approved", "Rejected", "Withdrawn"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Submit Date</label>
              <Input
                type="date"
                value={gmBvEditForm.submitDate}
                onChange={(e) => setGmBvEditForm((f) => ({ ...f, submitDate: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGmBvEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={updateGmBvEntry.isPending}
              onClick={() => {
                if (!gmBvEditId) return;
                updateGmBvEntry.mutate({
                  id: gmBvEditId,
                  payload: {
                    companyName: gmBvEditForm.companyName || undefined,
                    status: gmBvEditForm.status || undefined,
                    reportDate: gmBvEditForm.submitDate || undefined,
                    meta: gmBvEditForm.package ? { package: gmBvEditForm.package } : undefined,
                  },
                });
              }}
            >
              {updateGmBvEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GM BV Withdraw Confirm Dialog ───────────────────────────────── */}
      <Dialog open={!!gmBvWithdrawId} onOpenChange={(o) => { if (!o) setGmBvWithdrawId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="w-4 h-4 text-amber-500" />
              Withdraw GM BV Entry
            </DialogTitle>
            <DialogDescription>
              This entry will be marked as <strong>Withdrawn</strong>. You can view it but it will no longer be active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGmBvWithdrawId(null)}>Cancel</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={withdrawGmBvEntry.isPending}
              onClick={() => {
                if (gmBvWithdrawId) withdrawGmBvEntry.mutate(gmBvWithdrawId);
                setGmBvWithdrawId(null);
              }}
            >
              {withdrawGmBvEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownToLine className="w-4 h-4 mr-2" />}
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GM BV Delete Confirm Dialog ──────────────────────────────────── */}
      <Dialog open={!!gmBvDeleteId} onOpenChange={(o) => { if (!o) setGmBvDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-4 h-4" />
              Delete GM BV Entry
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to <strong>permanently delete</strong> this GM BV entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGmBvDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteGmBvEntry.isPending}
              onClick={() => {
                if (gmBvDeleteId) deleteGmBvEntry.mutate(gmBvDeleteId);
                setGmBvDeleteId(null);
              }}
            >
              {deleteGmBvEntry.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Transfer Lead Dialog */}
      <Dialog open={!!transferLead} onOpenChange={(open) => !open && setTransferLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Lead</DialogTitle>
            <DialogDescription>
              Assign "{transferLead?.companyName}" to another Sales Executive.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Select Sales Executive</label>
            <Select value={transferUserId} onValueChange={setTransferUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers?.filter(u => (u.roleId || u.role || "").toLowerCase().trim().replace(/\s+/g, '_') === 'sales_executive').map(user => (
                  <SelectItem key={user.id} value={user.id}>{user.fullName || user.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferLead(null)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (transferLead && transferUserId) {
                  transferMutation.mutate({ customerId: transferLead.id, ownerUserId: transferUserId });
                }
              }} 
              disabled={!transferUserId || transferMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActionIcon({
  href,
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  href?: string;
  icon: any;
  label: string;
  onClick?: () => void;
  variant?: "default" | "danger";
}) {
  const isExternal = href && (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("https://wa.me/"));
  const colorClass = variant === "danger"
    ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50 dark:border-rose-900/50"
    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200/60 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:border-zinc-800";

  const body = (
    <div
      className={`h-6 w-6 rounded-full flex items-center justify-center transition-all border shadow-sm shrink-0 ${colorClass}`}
      title={label}
      role={onClick ? "button" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick?.();
      }}
    >
      <Icon className="h-3 w-3" />
    </div>
  );

  if (href && !onClick) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.stopPropagation();
          if (isExternal) return;
          e.preventDefault();
          window.location.href = href;
        }}
      >
        {body}
      </a>
    );
  }
  if (href && onClick) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.stopPropagation();
          if (isExternal) return;
          e.preventDefault();
          onClick();
        }}
      >
        {body}
      </a>
    );
  }
  return body;
}
