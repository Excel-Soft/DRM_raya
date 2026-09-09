import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductPostingApprovalsWidget } from "@/components/product-posting-approvals-widget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, extractApiError } from "@/lib/queryClient";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Clock,
  Users,
  DollarSign,
  Check,
  X,
  CalendarCheck,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  FileText,
  RefreshCcw,
  Briefcase,
  Building2,
  Headphones,
  Activity,
  Loader2,
  CheckCircle2,
  Target,
  ArrowRight,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { InvoiceReceipt } from "@/components/invoice/InvoiceReceipt";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface ApprovalItem {
  id: string;
  type: string;
  referenceId: string | null;
  submittedByName: string | null;
  submittedById: string | null;
  createdAt: string | Date;
  status: string;
  companyName?: string | null;
  orderDollar?: number | null;
  packageName?: string | null;
  memberId?: string | null;
  paymentProofUrl?: string | null;
}

type SummaryResponse = {
  success: boolean;
  data?: {
    totalProjects: number;
    pendingApprovals: number;
    teamMembers: number;
    totalRevenue: number;
  };
};

type ApprovalsResponse = {
  success: boolean;
  data: ApprovalItem[];
  meta: { total: number; page: number; limit: number };
};

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count.toLocaleString()}</span>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" },
  }),
};

export default function HodDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [managerPage, setManagerPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [dailyReportPage, setDailyReportPage] = useState(1);
  const [managerDepartment, setManagerDepartment] = useState<string>("all");
  const [limit, setLimit] = useState(10);
  const [topSellingPeriod, setTopSellingPeriod] = useState("LD");

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ["hod-summary", topSellingPeriod],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/hod/dashboard/summary?period=${topSellingPeriod}`);
      return res.json();
    },
  });

  const approvalsQuery = useQuery<ApprovalsResponse>({
    queryKey: ["hod-approvals", page, limit],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/hod/approvals?status=Pending&page=${page}&limit=${limit}`
      );
      return res.json();
    },
  });

  const importantStatsQuery = useQuery<{ success: boolean; data: any }>({
    queryKey: ["hod-important-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/dashboard/important-stats");
      return res.json();
    },
  });

  const [activitiesFilter, setActivitiesFilter] = useState("TD");
  const activitiesStatsQuery = useQuery<{ success: boolean; data: any }>({
    queryKey: ["hod-important-stats", "activities", activitiesFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/hod/dashboard/important-stats?period=${activitiesFilter}`);
      return res.json();
    },
  });

  // Verification tabs state
  const [verificationTab, setVerificationTab] = useState<"waiting" | "leave-form" | "gm-approval" | "update-request" | "gm-withdrawal" | "invoice">("waiting");

  // Same queryKey as ProductPostingApprovalsWidget's own /api/invoices fetch
  // (the widget that actually renders this tab) — shares its cache, so this
  // count stays in sync with what's on screen and with the widget's own
  // invalidation after approve/reject/create, instead of the mismatched
  // paginated /api/hod/approvals list this badge used to read from.
  const invoicesQuery = useQuery<{ data?: any[] }>({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invoices");
      return res.json();
    },
  });

  const invoicesCount = useMemo(() => {
    return (invoicesQuery.data?.data ?? []).filter((inv: any) => inv.status === "PENDING_HOD").length;
  }, [invoicesQuery.data?.data]);

  // Invoice preview state
  const [selectedInvoiceView, setSelectedInvoiceView] = useState<any>(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);

  const openInvoicePreview = (item: any) => {
    let rawCompany = item.companyName || item.company_name || "Client";
    
    // Extract any package in parentheses from companyName if present, e.g. "zafer trading • talha (Alibaba Minisite)"
    let extractedPackage = "";
    const match = rawCompany.match(/\(([^)]+)\)/);
    if (match) {
      extractedPackage = match[1].trim();
    }

    // Clean company name by removing (anything in parentheses)
    const cleanCompany = rawCompany.replace(/\s*\([^)]*\)/gi, "").trim();

    let parsedItems = [];
    let calculatedSubTotal = 0;

    if (item.items) {
      try {
        const rawItems = JSON.parse(item.items);
        parsedItems = rawItems.map((ri: any) => {
          const qty = Number(ri.quantity) || 1;
          const price = Number(ri.price || ri.unitPrice) || 0;
          calculatedSubTotal += (qty * price);
          return {
            name: ri.productId || ri.description || "Service",
            detail: ri.detail || ri.description || "Details",
            price: price,
            quantity: qty,
            total: qty * price
          };
        });
      } catch (e) {
        console.error("Failed to parse invoice items", e);
      }
    }

    if (parsedItems.length === 0) {
      const pkgName = item.packageName || item.packageType || item.package_type || item.entryType || item.entry_type || extractedPackage || "Product Posting Service";
      
      const lowerPkg = pkgName.toLowerCase();
      let finalItemName = pkgName;
      let finalQty = 1;
      let finalDetail = `${cleanCompany} Details`;

      if (lowerPkg.includes("minisite")) {
        finalItemName = "Alibaba Minisite Service";
        finalQty = 1;
        finalDetail = "1";
      } else if (lowerPkg.includes("listing")) {
        finalItemName = "Listing Page Service";
        finalQty = 1;
        finalDetail = "1";
      } else if (lowerPkg.includes("product posting")) {
        finalItemName = "Product Posting Service";
        finalQty = 100;
        finalDetail = "100";
      }

      parsedItems = [
        {
          name: finalItemName,
          detail: finalDetail,
          price: Number(item.orderDollar) || 0,
          quantity: finalQty,
          total: Number(item.orderDollar) || 0
        }
      ];
      calculatedSubTotal = Number(item.orderDollar) || 0;
    }

    const invoiceData = {
      invoiceNumber: item.referenceId || (item.id ? item.id.replace(/\D/g, "") : "9876"),
      date: new Date(item.createdAt),
      from: {
        name: "Web Excels",
        whatsapp: "+92-334-8086611",
        phone: "+92-52-4271592",
        email: "Support@Webexcels.com",
        address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan."
      },
      to: {
        name: cleanCompany,
        phone: "-",
        email: "-",
        address: "Address:"
      },
      items: parsedItems,
      subTotalUsd: calculatedSubTotal,
      subTotalPkr: calculatedSubTotal * 280,
      taxUsd: 0,
      discountPkr: 0,
      totalPkr: calculatedSubTotal * 280
    };
    setSelectedInvoiceView(invoiceData);
    setShowInvoicePreview(true);
  };

  // Action Modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedActionItem, setSelectedActionItem] = useState<any>(null);
  const [actionFormData, setActionFormData] = useState({ status: "", detail: "" });

  const openActionModal = (item: any) => {
    setSelectedActionItem(item);
    setActionFormData({ status: item.status || "", detail: "" });
    setIsActionModalOpen(true);
  };

  const submitAction = async () => {
    if (!selectedActionItem) return;
    
    try {
      if (actionFormData.status === "Approved") {
        await approveMutation.mutateAsync(selectedActionItem.id);
      } else if (actionFormData.status === "Cancel") {
        await rejectMutation.mutateAsync({ id: selectedActionItem.id, reason: actionFormData.detail });
      } else {
        // Handle other statuses
        await approveMutation.mutateAsync(selectedActionItem.id);
      }
      setIsActionModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Meeting dialog state
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [meetingUser, setMeetingUser] = useState("");
  const [meetingDetail, setMeetingDetail] = useState("");

  // Today's Meeting panel — reuses the real reception meetings system
  // (server/reception-routes.ts, drm.meetings table) instead of a hardcoded
  // "No meetings scheduled" row. Meetings the HOD schedules with a colleague
  // are recorded as personType "user" (vs reception's client "contact"/
  // "external" visits), so the two lists don't mix.
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaysMeetingsQuery = useQuery<{ data: any[] }>({
    queryKey: ["hod-todays-meetings", todayIso],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reception/meetings?personType=user&date=${todayIso}`);
      return res.json();
    },
  });

  const usersListQuery = useQuery<{ users: any[] }>({
    queryKey: ["hod-users-list-for-meeting"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
    enabled: isMeetingDialogOpen,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (payload: { userId: string; personName: string; meetingType: string }) => {
      const res = await apiRequest("POST", "/api/reception/meetings", {
        personType: "user",
        userId: payload.userId,
        personName: payload.personName,
        meetingType: payload.meetingType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Meeting Added", description: "The meeting has been scheduled successfully." });
      queryClient.invalidateQueries({ queryKey: ["hod-todays-meetings"] });
      setIsMeetingDialogOpen(false);
      setMeetingUser("");
      setMeetingDetail("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to schedule meeting", description: err?.message ?? "Error", variant: "destructive" });
    },
  });

  const handleSaveMeeting = () => {
    if (!meetingUser) {
      toast({ title: "Choose a user", description: "Select who the meeting is with.", variant: "destructive" });
      return;
    }
    if (!meetingDetail.trim()) {
      toast({ title: "Add a detail", description: "Enter what the meeting is about.", variant: "destructive" });
      return;
    }
    const selectedUser = usersListQuery.data?.users?.find((u: any) => u.id === meetingUser);
    createMeetingMutation.mutate({
      userId: meetingUser,
      personName: selectedUser?.fullName || selectedUser?.email || "Unknown",
      meetingType: meetingDetail.trim(),
    });
  };

  // Project Deadline filter state
  const [projectDeadlineFilter, setProjectDeadlineFilter] = useState("WK");

  // Anchor for the "Verification Of Project" card so the "Dep Verification"
  // Important-panel entry can jump straight to the GM Approval tab instead of
  // going nowhere (it previously pointed at a dead "#" link).
  const verificationCardRef = useRef<HTMLDivElement>(null);
  const goToGmApprovalVerification = () => {
    setVerificationTab("gm-approval");
    verificationCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Project Deadlines query
  const projectDeadlinesQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-project-deadlines", projectDeadlineFilter],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/hod/dashboard/project-deadlines?filter=${projectDeadlineFilter}`);
      return res.json();
    },
  });

  // Promotions — real CRUD backend already exists at server/promotion-routes.ts
  // (mounted at /api/drm/promotions) but was never rendered on any dashboard.
  // HOD is one of the roles allowed to approve/reject (see canDecide() there).
  const promotionsQuery = useQuery<{ data: any[]; total: number }>({
    queryKey: ["hod-promotions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/promotions?pageSize=10");
      return res.json();
    },
  });

  const promotionApproveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/drm/promotions/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Promotion approved" });
      queryClient.invalidateQueries({ queryKey: ["hod-promotions"] });
    },
    onError: (err: any) => toast({ title: "Approve failed", description: err?.message ?? "Error", variant: "destructive" }),
  });

  const promotionRejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("PATCH", `/api/drm/promotions/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Promotion rejected" });
      queryClient.invalidateQueries({ queryKey: ["hod-promotions"] });
    },
    onError: (err: any) => toast({ title: "Reject failed", description: err?.message ?? "Error", variant: "destructive" }),
  });

  const handleRejectPromotion = (id: string) => {
    const reason = window.prompt("Enter rejection reason (optional)", "");
    if (reason === null) return;
    promotionRejectMutation.mutate({ id, reason });
  };

  // Verification tab queries
  const gmsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-verification-gms", verificationTab],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/verification/gms");
      return res.json();
    },
    // Keeps the Gm Approval badge count accurate at all times, not just on
    // page load — matches the polling already used for GM Withdrawal below.
    refetchInterval: 15000,
  });

  const leaveRequestsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-verification-leaves", verificationTab],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/verification/leave-requests");
      return res.json();
    },
    enabled: verificationTab === "leave-form",
  });

  const waitingProjectsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-verification-waiting", verificationTab],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/verification/waiting");
      return res.json();
    },
    enabled: verificationTab === "waiting",
  });

  const updateRequestsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-verification-updates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/verification/update-requests");
      return res.json();
    },
  });

  const withdrawalsQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-verification-withdrawals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/verification/withdrawals");
      return res.json();
    },
    refetchInterval: verificationTab === "gm-withdrawal" ? 15000 : false,
  });

  const withdrawApproveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hod/verification/withdrawals/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Entry marked as Withdrawn." });
      queryClient.invalidateQueries({ queryKey: ["hod-verification-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" }),
  });

  const withdrawRejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hod/verification/withdrawals/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Withdrawal request rejected." });
      queryClient.invalidateQueries({ queryKey: ["hod-verification-withdrawals"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" }),
  });

  // Daily Report query
  const dailyReportQuery = useQuery<{ success: boolean; data: any[] }>({
    queryKey: ["hod-daily-report"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/hod/daily-report");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/hod/approvals/${id}/approve`);
      return res.json();
    },
    onSuccess: (_, id) => {
      // Optimistically remove from current page to ensure it "disappears" immediately
      queryClient.setQueryData(["hod-approvals", page, limit], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((a: any) => a.id !== id),
        };
      });

      // Also invalidate and refetch all related queries to be sure
      queryClient.invalidateQueries({ queryKey: ["hod-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["hod-verification-gms"] });
      queryClient.invalidateQueries({ queryKey: ["hod-important-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hod-summary"] });
      
      // Explicitly refetch the main approvals query
      approvalsQuery.refetch();
      
      toast({
        title: "Approved",
        description: "Document has been approved successfully.",
      });
      setIsActionModalOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Approve failed", description: error?.message ?? "Error", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/hod/approvals/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: (_, { id }) => {
      // Optimistically remove from current page
      queryClient.setQueryData(["hod-approvals", page, limit], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.filter((a: any) => a.id !== id),
        };
      });

      queryClient.invalidateQueries({ queryKey: ["hod-approvals"] });
      queryClient.invalidateQueries({ queryKey: ["hod-verification-gms"] });
      queryClient.invalidateQueries({ queryKey: ["hod-important-stats"] });
      
      // Explicitly refetch the main approvals query
      approvalsQuery.refetch();

      toast({
        title: "Rejected",
        description: "Document has been rejected.",
        variant: "destructive",
      });
      setIsActionModalOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Reject failed", description: error?.message ?? "Error", variant: "destructive" });
    },
  });

  // Quick actions state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateForm, setEscalateForm] = useState({ projectId: "", priority: "medium", reason: "", note: "" });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignForm, setReassignForm] = useState({
    entityType: "customer",
    entityId: "",
    fromUserId: "",
    toUserId: "",
    note: "",
  });
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyForm, setNotifyForm] = useState({ message: "", audience: "all", department: "" });
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportType, setReportType] = useState("sales");
  const [reportPeriod, setReportPeriod] = useState("today");
  const [reportResult, setReportResult] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [selectedGmEntry, setSelectedGmEntry] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [gmDialogOpen, setGmDialogOpen] = useState(false);
  const [gmApprovalStatus, setGmApprovalStatus] = useState("");
  // Dedicated to the reject/approve Comment box, deliberately kept OUT of the
  // sprawling `formData` blob (20+ fields updated via various handlers) so it
  // can never be silently reset by an unrelated field update on that object.
  const [gmComment, setGmComment] = useState("");
  // Whether the HOD is giving an Extra Discount at all, or explicitly declining
  // to give one. Kept separate from formData.extraDiscountHod so "No Discount"
  // is a deliberate choice, not just an empty/zero field left untouched.
  const [hodDiscountChoice, setHodDiscountChoice] = useState<"none" | "custom">("none");
  // Once HOD starts entering their own discount decision, the original
  // Sales-submitted "$ Extra Discount" locks — Extra Discount Hod must match
  // it exactly to approve, so the value being confirmed against can't be
  // edited mid-decision.
  const [hodDiscountTouched, setHodDiscountTouched] = useState(false);
  const [gmPage, setGmPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  // Whether the HOD has tried to approve this entry at least once — inline
  // "Please fill this" errors only appear after a real attempt, not while
  // the form is still being read/filled in for the first time.
  const [gmSubmitAttempted, setGmSubmitAttempted] = useState(false);

  const GM_APPROVAL_REQUIRED_FIELDS: { key: string; label: string }[] = [
    { key: "drmId", label: "Company ID" },
    { key: "company", label: "Company Name" },
    { key: "memberId", label: "Member ID" },
    { key: "orderId", label: "Order ID" },
    { key: "package", label: "Package" },
    { key: "type", label: "Type" },
    { key: "pkr", label: "Customer PKR" },
    { key: "orderDollar", label: "Order Dollar" },
    { key: "dollarRate", label: "Dollar Rate" },
    { key: "alibabaDiscount", label: "Alibaba Discount" },
    { key: "extraDiscount", label: "Extra Discount" },
    { key: "extraDiscountPkr", label: "Extra Pkr Discount" },
    { key: "extraDiscountHod", label: "Extra Discount Hod" },
  ];

  const computeGmFieldErrors = (data: any): Record<string, boolean> => {
    const errors: Record<string, boolean> = {};
    for (const { key } of GM_APPROVAL_REQUIRED_FIELDS) {
      const value = data?.[key];
      errors[key] = value === undefined || value === null || String(value).trim() === "";
    }
    return errors;
  };

  const gmFieldErrors = gmSubmitAttempted && gmApprovalStatus === "Approved"
    ? computeGmFieldErrors(formData)
    : {};

  // Extra Discount Hod must exactly match the requested $ Extra Discount to
  // approve (see handleSaveGmStatus) — flagged separately from the generic
  // "Please fill this" check since the field is usually non-empty (defaults
  // to "0"), just not yet equal to the requested amount.
  const hodDiscountMismatch =
    gmSubmitAttempted &&
    gmApprovalStatus === "Approved" &&
    !gmFieldErrors.extraDiscountHod &&
    Math.abs((Number(formData.extraDiscountHod) || 0) - (Number(formData.extraDiscount) || 0)) > 0.01;

  const updateGmForm = (field: string, value: string) => {
    const newData = { ...formData, [field]: value };

    if (field === "dollarRate") {
      const rate = parseFloat(value) || 0;
      const pkr = parseFloat(newData.pkr) || 0;
      if (rate > 0) {
        const newCustDollar = pkr / rate;
        newData.customerDollar = newCustDollar.toFixed(2);
      }
    }

    setFormData(newData);
  };

  // Extra Discount Hod is a pure confirmation field: it must exactly match
  // the requested "$ Extra Discount" for Approve to be allowed (enforced in
  // handleSaveGmStatus below), and it never touches the Partial Payment
  // Installment rows — no add, no subtract. Installments stay exactly as
  // Sales submitted them, always.
  const applyHodDiscountChange = (val: string) => {
    setFormData((prev: any) => ({ ...prev, extraDiscountHod: val }));
  };

  const loadPendingLeaves = async () => {
    setLeavesLoading(true);
    try {
      const res = await apiRequest("GET", "/api/hod/quick-actions/leaves?status=Pending&page=1&limit=20");
      const json = await res.json();
      setLeaves(json?.data ?? []);
    } catch (err: any) {
      toast({ title: "Failed to load leaves", description: err?.message ?? "Error", variant: "destructive" });
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      await apiRequest("POST", `/api/hod/quick-actions/leaves/${id}/approve`);
      toast({ title: "Leave approved" });
      loadPendingLeaves();
    } catch (err: any) {
      toast({ title: "Approve failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const handleRejectLeave = async (id: string) => {
    const reason = window.prompt("Enter rejection reason (optional)", "");
    if (reason === null) return;
    try {
      await apiRequest("POST", `/api/hod/quick-actions/leaves/${id}/reject`, { reason });
      toast({ title: "Leave rejected" });
      loadPendingLeaves();
    } catch (err: any) {
      toast({ title: "Reject failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const submitEscalation = async () => {
    try {
      await apiRequest("POST", "/api/hod/quick-actions/projects/escalate", escalateForm);
      toast({ title: "Escalation sent" });
      setEscalateOpen(false);
    } catch (err: any) {
      toast({ title: "Escalation failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const submitReassign = async () => {
    try {
      await apiRequest("POST", "/api/hod/quick-actions/gm/reassign", reassignForm);
      toast({ title: "Reassignment recorded" });
      setReassignOpen(false);
    } catch (err: any) {
      toast({ title: "Reassign failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const submitNotify = async () => {
    try {
      await apiRequest("POST", "/api/hod/quick-actions/notify-sales", notifyForm);
      toast({ title: "Notification sent" });
      setNotifyOpen(false);
    } catch (err: any) {
      toast({ title: "Notify failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const submitReports = async () => {
    try {
      const res = await apiRequest(
        "GET",
        `/api/hod/quick-actions/reports?type=${reportType}&period=${reportPeriod}`,
      );
      const json = await res.json();
      setReportResult(json?.data ?? {});
    } catch (err: any) {
      toast({ title: "Reports failed", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  const submitSync = async () => {
    setSyncLoading(true);
    try {
      const res = await apiRequest("POST", "/api/hod/quick-actions/sync", { target: "all" });
      const json = await res.json();
      toast({ title: "Sync completed", description: `Duration: ${json?.data?.durationMs ?? 0} ms` });
    } catch (err: any) {
      toast({ title: "Sync failed", description: err?.message ?? "Error", variant: "destructive" });
    } finally {
      setSyncLoading(false);
    }
  };

  const updateGmStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("POST", `/api/hod/verification/gms/${id}/status`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hod-verification-gms"] });
      toast({ title: "Updated", description: "GM entry updated successfully." });
      setGmDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error?.message ?? "Error", variant: "destructive" });
    },
  });

  const handleGmAction = (entry: any) => {
    setSelectedGmEntry(entry);
    // Parse installments - DB may return as JSON string or array
    let parsedInstallments: any[] = [];
    try {
      if (typeof entry.installments === 'string') {
        parsedInstallments = JSON.parse(entry.installments);
      } else if (Array.isArray(entry.installments)) {
        parsedInstallments = entry.installments;
      }
    } catch { parsedInstallments = []; }

    // Default the field to "0" (not blank) so it starts valid instead of
    // showing a "required" error — 0 means "no decision made yet" and, since
    // Approve requires this to exactly match extraDiscount, correctly blocks
    // approval until HOD actually confirms the amount. If a real prior
    // decision was saved (any number, including 0), show that instead.
    const initialHodDiscount = entry.extraDiscountHod !== null
      && entry.extraDiscountHod !== undefined
      && entry.extraDiscountHod !== ""
      ? String(entry.extraDiscountHod)
      : "0";
    const activeInsts = parsedInstallments.length > 0 ? parsedInstallments : [];

    setFormData({
      ...entry,
      extraDiscountHod: initialHodDiscount,
      installments: activeInsts,
    });
    setGmApprovalStatus(entry.status || "Pending");
    setGmComment(entry.hodComment || entry.reason || entry.comment || "");
    setGmSubmitAttempted(false);
    setHodDiscountTouched(false);
    setGmDialogOpen(true);
    // Installments are shown exactly as loaded, untouched by extraDiscountHod
    // in any way — no need to call applyHodDiscountChange here.
  };

  const handleSaveGmStatus = () => {
    if (!selectedGmEntry) return;

    const hodDiscountStr = formData.extraDiscountHod !== undefined && formData.extraDiscountHod !== null
      ? String(formData.extraDiscountHod).trim()
      : "";

    if (hodDiscountStr === "") {
      toast({
        title: "Extra Discount HOD Required",
        description: "Please enter the Extra Discount HOD amount (minimum 0). GM cannot be approved or rejected without this value.",
        variant: "destructive",
      });
      return;
    }

    const hodDiscountNum = Number(hodDiscountStr);
    if (isNaN(hodDiscountNum) || hodDiscountNum < 0) {
      toast({
        title: "Invalid Extra Discount HOD",
        description: "Extra Discount HOD amount cannot be negative. Minimum amount is 0.",
        variant: "destructive",
      });
      return;
    }

    // Approve is gated on an exact match: HOD must confirm the same amount
    // Sales requested, not a different one. This is a pure confirmation
    // check — it never adjusts the installments below either way.
    if (gmApprovalStatus === "Approved") {
      const requestedDiscount = Number(formData.extraDiscount) || 0;
      if (Math.abs(hodDiscountNum - requestedDiscount) > 0.01) {
        toast({
          title: "Extra Discount HOD Must Match",
          description: `Extra Discount HOD (${hodDiscountNum}) must exactly match the requested $ Extra Discount (${requestedDiscount}) to approve.`,
          variant: "destructive",
        });
        return;
      }
    }

    // updates
    const updates = {
      ...formData,
      extraDiscountHod: hodDiscountNum,
      status: gmApprovalStatus !== "Pending" ? gmApprovalStatus : undefined,
    };

    updateGmStatusMutation.mutate({ id: selectedGmEntry.id, data: updates });
  };

  const getTypeBadge = (type: string) => {
    // Keys match the exact `type` strings the /api/hod/approvals union query
    // emits ("GM Entry", "Loan", "Overtime", "Quotation" were previously
    // missing here and fell through to the unstyled default Badge — the
    // same plain-black look the status badges had).
    const colors: Record<string, string> = {
      "GM Entry": "bg-blue-100 text-blue-800 border-blue-200",
      GM: "bg-blue-100 text-blue-800 border-blue-200",
      Refund: "bg-orange-100 text-orange-800 border-orange-200",
      Project: "bg-purple-100 text-purple-800 border-purple-200",
      Invoice: "bg-emerald-100 text-emerald-800 border-emerald-200",
      Leave: "bg-amber-100 text-amber-800 border-amber-200",
      Loan: "bg-indigo-100 text-indigo-800 border-indigo-200",
      Overtime: "bg-cyan-100 text-cyan-800 border-cyan-200",
      Quotation: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
    };
    return <Badge className={colors[type] || "bg-slate-100 text-slate-700 border-slate-200"}>{type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    // Every row returned by /api/hod/approvals is, by construction, still
    // waiting on HOD action — the underlying tables just spell "pending" a
    // few different ways (pending_hod for GM/product-posting, waiting for
    // invoices) instead of the exact string "pending". All of them should
    // read as the same Pending badge rather than falling through to the
    // unstyled default Badge (which rendered the raw enum value in black).
    if (["approved"].includes(normalized)) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
    }
    if (["rejected"].includes(normalized)) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>;
  };

  const approvals = approvalsQuery.data?.data ?? [];
  // approvals is just the current page (capped at `limit`) — the query is
  // already server-filtered to status=Pending, so the real pending count is
  // meta.total, not the length of this one page's rows.
  const pendingCount = approvalsQuery.data?.meta?.total ?? 0;
  const summary = summaryQuery.data?.data;
  const totalPages = useMemo(() => {
    const total = approvalsQuery.data?.meta?.total ?? 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [approvalsQuery.data?.meta?.total, limit]);

  const handleApprove = (id: string) => approveMutation.mutate(id);
  const handleReject = (id: string) => {
    const reason = window.prompt("Enter rejection reason (optional)", "");
    if (reason === null) return;
    rejectMutation.mutate({ id, reason });
  };

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">HOD Dashboard</h1>
            <p className="text-muted-foreground">Overview of department activities and approvals</p>
          </div>

          {/* Top Selling Stats */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Top Selling</h2>
              <select
                className="border rounded px-3 py-1 text-sm"
                value={topSellingPeriod}
                onChange={(e) => setTopSellingPeriod(e.target.value)}
              >
                <option value="LD">LD</option>
                <option value="WC">WC</option>
                <option value="MC">MC</option>
                <option value="QC">QC</option>
                <option value="YC">YC</option>
              </select>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Project */}
              <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Project</p>
                      <p className="text-2xl font-bold">{summary?.totalProjects ?? 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center">
                      <FolderKanban className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Verification */}
              <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Verification</p>
                      <p className="text-2xl font-bold">{pendingCount || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center">
                      <Check className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Pending */}
              <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Data Pending</p>
                      <p className="text-2xl font-bold">{summary?.pendingApprovals ?? 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Free: projects that are neither in-progress nor completed yet
                  (same real, distinct value the Activities panel below computes
                  as activities.free = total - inProgress - completed). Previously
                  this card just re-displayed the Total Project count. */}
              <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Free</p>
                      <p className="text-2xl font-bold">{importantStatsQuery.data?.data?.activities?.free ?? 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-600 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Verification Of Project Section */}
          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div
              className="lg:col-span-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="rounded-xl shadow-md" data-testid="card-verification-table" ref={verificationCardRef}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium mb-4">Verification Of Project</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("waiting")}
                      className={`h-8 text-xs ${verificationTab === "waiting"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      Waiting
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("leave-form")}
                      className={`h-8 text-xs ${verificationTab === "leave-form"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      Leave Form
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("gm-approval")}
                      className={`h-8 text-xs relative ${verificationTab === "gm-approval"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      Gm Approval
                      <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-green-600 rounded-full border border-white">
                        {gmsQuery.data?.data?.length || 0}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("update-request")}
                      className={`h-8 text-xs relative ${verificationTab === "update-request"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      Update Request
                      <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-600 rounded-full border border-white">
                        {updateRequestsQuery.data?.data?.length || 0}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("gm-withdrawal")}
                      className={`h-8 text-xs relative ${verificationTab === "gm-withdrawal"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      GM Withdrawal
                      <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-orange-600 rounded-full border border-white">
                        {withdrawalsQuery.data?.data?.length || 0}
                      </span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setVerificationTab("invoice")}
                      className={`h-8 text-xs relative ${verificationTab === "invoice"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                        }`}
                    >
                      Invoice
                      <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-green-600 rounded-full border border-white">
                        {invoicesCount}
                      </span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {verificationTab === "invoice" ? (
                    // The old ad-hoc rows here bypassed InvoiceWorkflowService's
                    // completeness gate, audit ledger, and dropped rejection
                    // reasons entirely (see hod.repository.ts's raw-SQL
                    // "product_posting_invoices" case). This is the real,
                    // fully-audited approval surface instead.
                    <ProductPostingApprovalsWidget role="HOD" variant="table" />
                  ) : (
                  <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#f8fafc] dark:bg-zinc-900">
                        <TableRow>
                          {verificationTab === "waiting" && (
                            <>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Reference ID</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Submitted By</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                              <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
                            </>
                          )}
                          {verificationTab === "leave-form" && (
                            <>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Employee</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">From Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">To Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Reason</TableHead>
                            </>
                          )}
                          {verificationTab === "gm-approval" && (
                            <>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Drm Id</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Member Id</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Order Id</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Sale Person</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Package</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Order Dollar</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Customer Dollar</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Dollar Rate</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Pkr</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Discount</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Extra Discount</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Total Discount</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Create Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">HOD Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Last Updation Date</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Accountant</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Payment Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Approved By HOD</TableHead>
                              <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
                            </>
                          )}
                          {verificationTab === "update-request" && (
                            <>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Requested By</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Amount</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Package</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Date</TableHead>
                              <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
                            </>
                          )}
                          {verificationTab === "gm-withdrawal" && (
                            <>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Type</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Sale Person</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Amount</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Currency</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Reason</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                              <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Create Date</TableHead>
                              <TableHead className="font-bold text-slate-700 text-right dark:text-zinc-400">Action</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {verificationTab === "waiting" && (
                          <>
                            {approvals.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground">
                                  {approvalsQuery.isLoading ? "Loading..." : "No pending approvals"}
                                </TableCell>
                              </TableRow>
                            )}
                            {approvals.map((item) => (
                              <TableRow key={item.id} data-testid={`row-approval-${item.id}`}>
                                <TableCell>{getTypeBadge(item.type)}</TableCell>
                                <TableCell>
                                  {item.referenceId ? (
                                    <span className="inline-block whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                                      REF-{item.referenceId.slice(0, 8).toUpperCase()}
                                    </span>
                                  ) : "-"}
                                </TableCell>
                                <TableCell>{item.submittedByName ?? "-"}</TableCell>
                                <TableCell>{item.createdAt ? format(new Date(item.createdAt), "dd MMM yyyy") : "-"}</TableCell>
                                <TableCell>{getStatusBadge(item.status)}</TableCell>
                                <TableCell className="text-right">
                                  {/* Every row in this list is, by construction, still
                                      pending — the union query only pulls rows whose
                                      underlying status means "waiting on HOD" (the exact
                                      spelling varies: pending, pending_hod, waiting). A
                                      strict === "pending" check here previously hid the
                                      Approve/Reject buttons for GM/Invoice/Quotation rows
                                      and showed a misleading "Completed" instead. */}
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-3"
                                      onClick={() => handleApprove(item.id)}
                                      data-testid={`button-approve-${item.id}`}
                                      disabled={approveMutation.isPending || rejectMutation.isPending}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-3"
                                      onClick={() => handleReject(item.id)}
                                      data-testid={`button-reject-${item.id}`}
                                      disabled={approveMutation.isPending || rejectMutation.isPending}
                                    >
                                      <X className="h-3 w-3 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </>
                        )}

                        {verificationTab === "leave-form" && (
                          <>
                            {leaveRequestsQuery.isLoading ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                              </TableRow>
                            ) : leaveRequestsQuery.data?.data && leaveRequestsQuery.data.data.length > 0 ? (
                              leaveRequestsQuery.data.data.map((leave: any) => (
                                <TableRow key={leave.id}>
                                  <TableCell>{leave.userName || leave.userEmail || "-"}</TableCell>
                                  <TableCell>
                                    {leave.fromDate ? format(new Date(leave.fromDate), "dd MMM yyyy") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {leave.toDate ? format(new Date(leave.toDate), "dd MMM yyyy") : "-"}
                                  </TableCell>
                                  <TableCell>{leave.type || leave.leaveType || "-"}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={leave.status === "Pending" ? "secondary" : leave.status === "Approved" ? "default" : "destructive"}
                                    >
                                      {leave.status || "Pending"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600 dark:text-zinc-300">
                                    {leave.reason || leave.purpose || leave.description || "-"}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                                  No leave requests
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}

                        {verificationTab === "gm-approval" && (() => {
                          if (gmsQuery.isError) {
                            return (
                              <TableRow>
                                <TableCell colSpan={11} className="text-center py-4 text-red-600">
                                  Error loading data: {gmsQuery.error?.message || "Unknown error"}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          if (gmsQuery.isLoading) {
                            return (
                              <TableRow>
                                <TableCell colSpan={11} className="text-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                              </TableRow>
                            );
                          }

                          const gmData = gmsQuery.data?.data || [];
                          if (gmData.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={20} className="text-center text-muted-foreground py-4">
                                  No GM pool entries found (Count: 0)
                                </TableCell>
                              </TableRow>
                            );
                          }

                          const totalPages = Math.ceil(gmData.length / ITEMS_PER_PAGE);
                          const paginatedGmData = gmData.slice((gmPage - 1) * ITEMS_PER_PAGE, gmPage * ITEMS_PER_PAGE);

                          return (
                            <>
                              {paginatedGmData.map((entry: any, index: number) => {
                                const discount = Number(entry.alibabaDiscount || 0);
                              const extra = Number(entry.extraDiscount || 0);
                              const totalDiscount = discount + extra;
                              const originalAmount = Number(entry.orderDollar || 0);
                              const dPct = originalAmount > 0 ? Math.round((discount / originalAmount) * 100) : 0;
                              const ePct = originalAmount > 0 ? Math.round((extra / originalAmount) * 100) : 0;
                              const tPct = originalAmount > 0 ? Math.round((totalDiscount / originalAmount) * 100) : 0;
                              const paymentStatus = entry.paymentStatus || "Pending";

                              return (
                                <TableRow key={entry.id}>
                                  <TableCell className="font-medium text-blue-600">{entry.drmId || "-"}</TableCell>
                                  <TableCell>{entry.memberId || "-"}</TableCell>
                                  <TableCell>{entry.orderId || "-"}</TableCell>
                                  <TableCell>{entry.company || "-"}</TableCell>
                                  <TableCell>{entry.salePerson || "-"}</TableCell>
                                  <TableCell>{entry.package || "-"}</TableCell>
                                  <TableCell>{entry.type || "-"}</TableCell>
                                  <TableCell>{entry.orderDollar || "-"}</TableCell>
                                  <TableCell>{entry.customerDollar || "-"}</TableCell>
                                  <TableCell>{entry.dollarRate || "-"}</TableCell>
                                  <TableCell>{entry.pkr || "-"}</TableCell>
                                  <TableCell className="text-blue-600 font-medium">
                                    $ {discount} ( {dPct}%)
                                  </TableCell>
                                  <TableCell>$ {extra} ( {ePct}%)</TableCell>
                                  <TableCell>$ {totalDiscount} ( {tPct}%)</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      paymentStatus === "Online" || paymentStatus === "Online Paid" ? "bg-orange-100 text-orange-700 border-orange-200" :
                                        paymentStatus === "Cash" || paymentStatus === "Cash Received" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                                          "bg-gray-100"
                                    }>
                                      {paymentStatus === "Online" ? "Online Paid" :
                                        paymentStatus === "Cash" ? "Cash Received" : paymentStatus}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">{entry.createdAt || entry.created_at ? format(new Date(entry.createdAt || entry.created_at), "dd/MM/yyyy HH:mm:ss a") : "-"}</TableCell>
                                  <TableCell className="whitespace-nowrap">{entry.hodApprovedAt || entry.approvedAt || entry.hod_approved_at || entry.approved_at ? format(new Date(entry.hodApprovedAt || entry.approvedAt || entry.hod_approved_at || entry.approved_at), "dd/MM/yyyy HH:mm:ss a") : "N/A"}</TableCell>
                                  <TableCell className="whitespace-nowrap">{entry.updatedAt || entry.updated_at ? format(new Date(entry.updatedAt || entry.updated_at), "dd/MM/yyyy HH:mm:ss a") : "-"}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <span>{entry.accountantStatus || "Pending"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={
                                      entry.isLoan ? "bg-violet-500 hover:bg-violet-600"
                                        : entry.isPartial ? "bg-orange-500 hover:bg-orange-600"
                                        : "bg-green-500 hover:bg-green-600"
                                    }>
                                      {entry.isLoan ? "Loan GM" : entry.isPartial ? "Partial GM" : "Full GM"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 dark:text-zinc-400">N/A</Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleGmAction(entry)}
                                    >
                                      <ArrowRight className="h-5 w-5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                              })}
                            </>
                          );
                        })()}

                        {verificationTab === "update-request" && (
                          <>
                            {updateRequestsQuery.isLoading ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                              </TableRow>
                            ) : updateRequestsQuery.data?.data && updateRequestsQuery.data.data.length > 0 ? (
                              updateRequestsQuery.data.data.map((entry: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell>{getTypeBadge(entry.type || "GM")}</TableCell>
                                  <TableCell className="font-medium text-blue-600">{entry.companyName || "-"}</TableCell>
                                  <TableCell>{entry.salePerson || entry.requestedBy || "-"}</TableCell>
                                  <TableCell>{entry.orderDollar ? `$${entry.orderDollar}` : entry.amount ? `$${entry.amount}` : "-"}</TableCell>
                                  <TableCell>{entry.package || "-"}</TableCell>
                                  <TableCell>{entry.createdAt ? format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                                        onClick={async () => {
                                          try {
                                            const token = sessionStorage.getItem("token");
                                            const res = await fetch(`/api/hod/verification/update-requests/${entry.id}/approve`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                              credentials: "include",
                                            });
                                            const d = await res.json();
                                            if (!res.ok) throw new Error(d?.message || "Failed to approve");
                                            updateRequestsQuery.refetch();
                                          } catch (e: any) {
                                            toast({ title: "Approve failed", description: e.message || "Error", variant: "destructive" });
                                          }
                                        }}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 text-xs"
                                        onClick={async () => {
                                          try {
                                            const token = sessionStorage.getItem("token");
                                            const res = await fetch(`/api/hod/verification/update-requests/${entry.id}/reject`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                              credentials: "include",
                                            });
                                            const d = await res.json();
                                            if (!res.ok) throw new Error(d?.message || "Failed to reject");
                                            updateRequestsQuery.refetch();
                                          } catch (e: any) {
                                            toast({ title: "Reject failed", description: e.message || "Error", variant: "destructive" });
                                          }
                                        }}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                                  No update requests
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}

                        {verificationTab === "gm-withdrawal" && (
                          <>
                            {withdrawalsQuery.isLoading ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center py-4">
                                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                              </TableRow>
                            ) : withdrawalsQuery.data?.data && withdrawalsQuery.data.data.length > 0 ? (
                              withdrawalsQuery.data.data.map((entry: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell>{getTypeBadge(entry.type)}</TableCell>
                                  <TableCell className="font-medium text-blue-600">{entry.company || "-"}</TableCell>
                                  <TableCell>{entry.salePerson || "-"}</TableCell>
                                  <TableCell>{entry.amount || "0"}</TableCell>
                                  <TableCell>{entry.amount_type || "-"}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={entry.reason || ""}>
                                    {entry.reason || "-"}
                                  </TableCell>
                                  <TableCell>{getStatusBadge(entry.status || "Pending")}</TableCell>
                                  <TableCell>{entry.createdAt ? format(new Date(entry.createdAt), "dd/MM/yyyy HH:mm:ss a") : "-"}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs px-2"
                                        onClick={() => withdrawApproveMutation.mutate(entry.id)}
                                        disabled={withdrawApproveMutation.isPending || withdrawRejectMutation.isPending}
                                      >
                                        <Check className="h-3 w-3 mr-1" /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50 h-7 text-xs px-2"
                                        onClick={() => withdrawRejectMutation.mutate(entry.id)}
                                        disabled={withdrawApproveMutation.isPending || withdrawRejectMutation.isPending}
                                      >
                                        <X className="h-3 w-3 mr-1" /> Reject
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                                  No withdrawal requests
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Pagination for GM Approval */}
                  {verificationTab === "gm-approval" && gmsQuery.data?.data && gmsQuery.data.data.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                      <div>
                        Showing {(gmPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(gmPage * ITEMS_PER_PAGE, gmsQuery.data.data.length)} of {gmsQuery.data.data.length} entries
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGmPage(p => Math.max(1, p - 1))}
                          disabled={gmPage === 1}
                        >
                          Prev
                        </Button>
                        <div className="flex items-center justify-center px-2 text-sm font-medium">
                          Page {gmPage} of {Math.ceil(gmsQuery.data.data.length / ITEMS_PER_PAGE)}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGmPage(p => Math.min(Math.ceil(gmsQuery.data.data.length / ITEMS_PER_PAGE), p + 1))}
                          disabled={gmPage === Math.ceil(gmsQuery.data.data.length / ITEMS_PER_PAGE)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                  {verificationTab === "waiting" && (
                    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                      <div>
                        Page {page} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                  </>
                  )}
                </CardContent>
              </Card>

              {/* Daily Report Section */}
              <Card className="rounded-xl shadow-md mt-6" data-testid="card-daily-report">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daily Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Free</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Run</TableHead>
                          <TableHead>Spent</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyReportQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ) : dailyReportQuery.data?.data && dailyReportQuery.data.data.length > 0 ? (
                          dailyReportQuery.data.data.slice((dailyReportPage - 1) * 10, dailyReportPage * 10).map((report: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{report.name || "-"}</TableCell>
                              <TableCell>{report.company || "-"}</TableCell>
                              <TableCell>{report.project || "-"}</TableCell>
                              <TableCell>{report.free || "0"}</TableCell>
                              <TableCell>{report.task || "0"}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{report.status || "Pending"}</Badge>
                              </TableCell>
                              <TableCell>{report.run || "0"}</TableCell>
                              <TableCell>{report.spent || "0:0:0"}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                              No daily reports available
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {dailyReportQuery.data?.data && dailyReportQuery.data.data.length > 10 && (
                    <div className="flex items-center justify-between pt-4 px-2 text-sm text-slate-500">
                        <p style={{ fontSize: "11px" }} className="text-muted-foreground">
                            Showing {(dailyReportPage - 1) * 10 + 1} to {Math.min(dailyReportPage * 10, dailyReportQuery.data.data.length)} of {dailyReportQuery.data.data.length} entries
                        </p>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setDailyReportPage(p => Math.max(1, p - 1))} 
                                disabled={dailyReportPage === 1}
                            >
                                Prev
                            </Button>
                            <div className="flex items-center px-2 font-medium" style={{ fontSize: "11px" }}>
                                Page {dailyReportPage} of {Math.ceil(dailyReportQuery.data.data.length / 10)}
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setDailyReportPage(p => Math.min(Math.ceil(dailyReportQuery.data.data.length / 10), p + 1))} 
                                disabled={dailyReportPage === Math.ceil(dailyReportQuery.data.data.length / 10)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Project Deadline Section */}
              <Card className="rounded-xl shadow-md mt-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Project Deadline</CardTitle>
                    <Select value={projectDeadlineFilter} onValueChange={setProjectDeadlineFilter}>
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WK">WK</SelectItem>
                        <SelectItem value="MN">MN</SelectItem>
                        <SelectItem value="All">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-zinc-900">
                        <TableRow>
                          <TableHead className="text-xs font-medium">Company</TableHead>
                          <TableHead className="text-xs font-medium">Project</TableHead>
                          <TableHead className="text-xs font-medium">Dep</TableHead>
                          <TableHead className="text-xs font-medium text-right">Deadlines</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projectDeadlinesQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ) : projectDeadlinesQuery.data?.data && projectDeadlinesQuery.data.data.length > 0 ? (
                          projectDeadlinesQuery.data.data.map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="text-sm font-medium text-blue-600">{item.companyName || "-"}</TableCell>
                              <TableCell className="text-sm">{item.project || "-"}</TableCell>
                              <TableCell className="text-sm">{item.dep || "-"}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-zinc-900 dark:text-zinc-400">
                                  {item.deadlines ? format(new Date(item.deadlines), "yyyy-MM-dd") : "-"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                              No project deadlines found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Promotions Section — real CRUD backend (server/promotion-routes.ts,
                  mounted at /api/drm/promotions) that previously had no dashboard
                  surface anywhere. HOD can view and approve/reject promotions. */}
              <Card className="rounded-xl shadow-md mt-6" data-testid="card-promotions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Promotions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-zinc-900">
                        <TableRow>
                          <TableHead className="text-xs font-medium">Title</TableHead>
                          <TableHead className="text-xs font-medium">Package</TableHead>
                          <TableHead className="text-xs font-medium">Discount</TableHead>
                          <TableHead className="text-xs font-medium">Dates</TableHead>
                          <TableHead className="text-xs font-medium">Status</TableHead>
                          <TableHead className="text-xs font-medium text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promotionsQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ) : promotionsQuery.data?.data && promotionsQuery.data.data.length > 0 ? (
                          promotionsQuery.data.data.map((promo: any) => (
                            <TableRow key={promo.id}>
                              <TableCell className="font-medium">{promo.title}</TableCell>
                              <TableCell className="text-sm">{promo.packageName || "-"}</TableCell>
                              <TableCell className="text-sm">{promo.discount || "-"}</TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {promo.startDate ? format(new Date(promo.startDate), "dd MMM yyyy") : "-"}
                                {" "}-{" "}
                                {promo.endDate ? format(new Date(promo.endDate), "dd MMM yyyy") : "-"}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  promo.status === "approved" ? "bg-green-100 text-green-800 border-green-200" :
                                  promo.status === "rejected" ? "bg-red-100 text-red-800 border-red-200" :
                                  "bg-yellow-100 text-yellow-800 border-yellow-200"
                                }>
                                  {promo.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {promo.status === "pending" ? (
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 h-7 text-xs px-2"
                                      onClick={() => promotionApproveMutation.mutate(promo.id)}
                                      disabled={promotionApproveMutation.isPending || promotionRejectMutation.isPending}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-xs px-2"
                                      onClick={() => handleRejectPromotion(promo.id)}
                                      disabled={promotionApproveMutation.isPending || promotionRejectMutation.isPending}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    {promo.approvedByName ? `By ${promo.approvedByName}` : "-"}
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                              No promotions found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-6"
            >
              {/* Today Meeting Section */}
              <Card className="rounded-xl shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Today Meeting</CardTitle>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full bg-green-100 hover:bg-green-200"
                      onClick={() => setIsMeetingDialogOpen(true)}
                    >
                      <span className="text-green-600 text-lg">+</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-zinc-900">
                        <TableRow>
                          <TableHead className="text-xs font-medium">Person</TableHead>
                          <TableHead className="text-xs font-medium">Detail</TableHead>
                          <TableHead className="text-xs font-medium text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todaysMeetingsQuery.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ) : todaysMeetingsQuery.data?.data && todaysMeetingsQuery.data.data.length > 0 ? (
                          todaysMeetingsQuery.data.data.map((m: any) => (
                            <TableRow key={m.id}>
                              <TableCell className="text-sm font-medium">{m.personName || "-"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate" title={m.meetingType || ""}>
                                {m.meetingType || "-"}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {m.scheduledTime || (m.meetingDate ? format(new Date(m.meetingDate), "hh:mm a") : "-")}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-4">
                              No meetings scheduled
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Important Section (Redesigned) */}
              <div className="bg-white rounded border border-gray-100 shadow-sm p-4 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <h2 className="text-[16px] font-bold text-[#495057] mb-4 dark:text-zinc-400">Important</h2>
                {importantStatsQuery.isLoading ? (
                  <div className="text-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {[
                      { label: "Delay Projects", value: importantStatsQuery.data?.data?.delayProjects || 0, nav: "/projects?status=delayed" },
                      { label: "Ab Closing Report", value: ">", nav: "/account/ab-report" },
                      { label: "Upcoming", value: importantStatsQuery.data?.data?.upcoming || 0, nav: "/projects/upcoming" },
                      { label: "In Progress", value: importantStatsQuery.data?.data?.inProgress || 0, nav: "/projects?status=in-progress" },
                      { label: "Completed", value: importantStatsQuery.data?.data?.completed || 0, nav: "/projects?status=completed" },
                      { label: "Pending", value: importantStatsQuery.data?.data?.pending || 0, nav: "/projects?status=pending" },
                      { label: "Qa Verification", value: importantStatsQuery.data?.data?.qaVerification || 0, nav: "/projects?status=qa-verification" },
                      // Real GM-pending-HOD count; jumps to the GM Approval tab
                      // in the card above instead of a dead "#" link, and no
                      // longer has a hardcoded "(1600)" fake suffix appended.
                      { label: "Dep Verification", value: importantStatsQuery.data?.data?.depVerification || 0, nav: "#", action: goToGmApprovalVerification },
                      { label: "Leave Application", value: importantStatsQuery.data?.data?.leaveApplication || 0, nav: "/hr/leave-request" },
                      { label: "Activet Team", value: importantStatsQuery.data?.data?.activeTeam || 0, nav: "/users" },
                      { label: "Loan Application", value: ">", nav: "/hr/loan" },
                      { label: "Late Coming", value: ">", nav: "/drm/late-coming" },
                      { label: "Add Penalty", value: ">", nav: "/drm/add-penalty" },
                      { label: "Commission Verification", value: ">", nav: "/drm/commission-verification" },
                      { label: "Sale & Service Report", value: ">", nav: "/reports" },
                      { label: "Increment", value: ">", nav: "/drm/increment" },
                      { label: "Update Sale And Service Report", value: ">", nav: "/reports" },
                      { label: "Roles Details", value: ">", nav: "/users" },
                      { label: "Annual Leaves Reports", value: ">", nav: "/reports" },
                      { label: "Daily Added GM Report", value: ">", nav: "/reports" },
                      { label: "Follow Up Report", value: ">", nav: "/reports" },
                      { label: "Follow-Up Meeting Report", value: ">", nav: "/reports" }
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if ((item as any).action) {
                            (item as any).action();
                          } else if (item.nav !== "#") {
                            setLocation(item.nav);
                          }
                        }}
                        className="flex items-center justify-between bg-[#f8f9fa] px-3 py-1.5 rounded-sm border border-gray-50 hover:bg-gray-100 transition-colors cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
                      >
                        <span className="text-[13px] text-[#495057] dark:text-zinc-400">{item.label}</span>
                        <span className="text-[13px] font-semibold text-[#495057] italic dark:text-zinc-400">
                          {item.value === ">" ? (
                            <span className="text-[10px] font-normal not-italic opacity-60">▶</span>
                          ) : item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activities Section */}
              <Card className="rounded-xl shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Activities</CardTitle>
                    <Select value={activitiesFilter} onValueChange={setActivitiesFilter}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TD">TD</SelectItem>
                        <SelectItem value="WK">WK</SelectItem>
                        <SelectItem value="MN">MN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activitiesStatsQuery.isLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 dark:text-zinc-400">Total Project</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {activitiesStatsQuery.data?.data?.activities?.totalProjects || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((activitiesStatsQuery.data?.data?.activities?.totalProjects || 0) / 100) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 dark:text-zinc-400">Complete</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {activitiesStatsQuery.data?.data?.activities?.complete || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((activitiesStatsQuery.data?.data?.activities?.complete || 0) / (activitiesStatsQuery.data?.data?.activities?.totalProjects || 1)) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 dark:text-zinc-400">Pending</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {activitiesStatsQuery.data?.data?.activities?.pending || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((activitiesStatsQuery.data?.data?.activities?.pending || 0) / (activitiesStatsQuery.data?.data?.activities?.totalProjects || 1)) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 dark:text-zinc-400">Delay</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {activitiesStatsQuery.data?.data?.activities?.delay || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-500 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((activitiesStatsQuery.data?.data?.activities?.delay || 0) / (activitiesStatsQuery.data?.data?.activities?.totalProjects || 1)) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-700 dark:text-zinc-400">Free</span>
                          <span className="text-sm font-semibold text-blue-600">
                            {activitiesStatsQuery.data?.data?.activities?.free || 0}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-800 h-2 rounded-full"
                            style={{
                              width: `${Math.min(100, ((activitiesStatsQuery.data?.data?.activities?.free || 0) / (activitiesStatsQuery.data?.data?.activities?.totalProjects || 1)) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Optional sections removed until real data sources are available */}
        </div >
      </ScrollArea >

      {/* Modals */}
      < Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen} >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pending Leave Requests</DialogTitle>
            <DialogDescription>Approve or reject pending leaves.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {leavesLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending leaves</p>
            ) : (
              <div className="max-h-80 overflow-auto space-y-2">
                {leaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between border rounded p-3">
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">ID: {l.id}</div>
                      <div>From: {l.from_date} | To: {l.to_date}</div>
                      <div>Reason: {l.reason || "-"}</div>
                      <div>Status: {l.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleRejectLeave(l.id)}>Reject</Button>
                      <Button size="sm" onClick={() => handleApproveLeave(l.id)}>Approve</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Escalation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Project ID" value={escalateForm.projectId} onChange={(e) => setEscalateForm({ ...escalateForm, projectId: e.target.value })} />
            <Select value={escalateForm.priority} onValueChange={(v) => setEscalateForm({ ...escalateForm, priority: v })}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Reason" value={escalateForm.reason} onChange={(e) => setEscalateForm({ ...escalateForm, reason: e.target.value })} />
            <Textarea placeholder="Note (optional)" value={escalateForm.note} onChange={(e) => setEscalateForm({ ...escalateForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>Cancel</Button>
            <Button onClick={submitEscalation}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign GM</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={reassignForm.entityType} onValueChange={(v) => setReassignForm({ ...reassignForm, entityType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Entity ID" value={reassignForm.entityId} onChange={(e) => setReassignForm({ ...reassignForm, entityId: e.target.value })} />
            <Input placeholder="From User ID (optional)" value={reassignForm.fromUserId} onChange={(e) => setReassignForm({ ...reassignForm, fromUserId: e.target.value })} />
            <Input placeholder="To User ID" value={reassignForm.toUserId} onChange={(e) => setReassignForm({ ...reassignForm, toUserId: e.target.value })} />
            <Textarea placeholder="Note (optional)" value={reassignForm.note} onChange={(e) => setReassignForm({ ...reassignForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button onClick={submitReassign}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify Sales Team</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Message" value={notifyForm.message} onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })} />
            <Select value={notifyForm.audience} onValueChange={(v) => setNotifyForm({ ...notifyForm, audience: v })}>
              <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
            {notifyForm.audience === "department" && (
              <Input placeholder="Department" value={notifyForm.department} onChange={(e) => setNotifyForm({ ...notifyForm, department: e.target.value })} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyOpen(false)}>Cancel</Button>
            <Button onClick={submitNotify}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View Reports</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger><SelectValue placeholder="Report type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
                <SelectItem value="projects">Projects</SelectItem>
              </SelectContent>
            </Select>
            <Select value={reportPeriod} onValueChange={setReportPeriod}>
              <SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={submitReports}>Refresh Report</Button>
            {reportResult && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Report Preview</p>
                <pre className="bg-muted/80 border border-border rounded-md p-3 text-xs leading-snug max-h-48 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(reportResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setReportsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meeting Dialog */}
      <Dialog open={isMeetingDialogOpen} onOpenChange={setIsMeetingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* User Dropdown */}
            <div className="space-y-2">
              <label htmlFor="user" className="text-sm font-medium">
                User
              </label>
              <Select value={meetingUser} onValueChange={setMeetingUser}>
                <SelectTrigger id="user">
                  <SelectValue placeholder={usersListQuery.isLoading ? "Loading users..." : "Choose ..."} />
                </SelectTrigger>
                <SelectContent>
                  {(usersListQuery.data?.users ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detail Textarea */}
            <div className="space-y-2">
              <label htmlFor="detail" className="text-sm font-medium">
                Detail
              </label>
              <Textarea
                id="detail"
                value={meetingDetail}
                onChange={(e) => setMeetingDetail(e.target.value)}
                placeholder="Enter meeting details..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMeetingDialogOpen(false);
                setMeetingUser("");
                setMeetingDetail("");
              }}
            >
              Close
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSaveMeeting}
              disabled={createMeetingMutation.isPending}
            >
              {createMeetingMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={gmDialogOpen} onOpenChange={setGmDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>HOD Approval Details</DialogTitle>
          </DialogHeader>

          {selectedGmEntry && (
            <div className="space-y-4 py-4">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Company ID</label>
                  <Input value={formData.drmId || ""} readOnly className={`bg-muted ${gmFieldErrors.drmId ? "border-red-500" : ""}`} />
                  {gmFieldErrors.drmId && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Company Name</label>
                  <Input value={formData.company || ""} readOnly className={`bg-muted ${gmFieldErrors.company ? "border-red-500" : ""}`} />
                  {gmFieldErrors.company && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Member ID</label>
                  <Input value={formData.memberId || ""} readOnly className={`bg-muted ${gmFieldErrors.memberId ? "border-red-500" : ""}`} />
                  {gmFieldErrors.memberId && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Order ID</label>
                  <Input
                    value={formData.orderId || ""}
                    onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                    className={gmFieldErrors.orderId ? "border-red-500" : ""}
                  />
                  {gmFieldErrors.orderId && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Package</label>
                  <Input value={formData.package || ""} readOnly className={`bg-muted ${gmFieldErrors.package ? "border-red-500" : ""}`} />
                  {gmFieldErrors.package && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Package Price</label>
                  <Input value={formData.orderDollar || ""} readOnly className={`bg-muted ${gmFieldErrors.orderDollar ? "border-red-500" : ""}`} />
                  {gmFieldErrors.orderDollar && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select
                    value={formData.type || ""}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className={`bg-white dark:bg-zinc-900 ${gmFieldErrors.type ? "border-red-500" : ""}`}>
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                      <SelectItem value="Ec">Ec</SelectItem>
                      <SelectItem value="Rc-Up">Rc-Up</SelectItem>
                      <SelectItem value="Kwa">Kwa</SelectItem>
                    </SelectContent>
                  </Select>
                  {gmFieldErrors.type && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Customer PKR</label>
                  <Input value={formData.pkr || ""} readOnly className={`bg-muted ${gmFieldErrors.pkr ? "border-red-500" : ""}`} />
                  {gmFieldErrors.pkr && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Order Dollar</label>
                  <Input
                    value={(Number(formData.orderDollar) || 0) - (Number(formData.alibabaDiscount) || 0)}
                    readOnly
                    className={`bg-muted ${gmFieldErrors.orderDollar ? "border-red-500" : ""}`}
                  />
                  {gmFieldErrors.orderDollar && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Dollar Rate $</label>
                  <Input
                    value={formData.dollarRate || ""}
                    onChange={(e) => updateGmForm("dollarRate", e.target.value)}
                    className={gmFieldErrors.dollarRate ? "border-red-500" : ""}
                  />
                  {gmFieldErrors.dollarRate && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Alibaba Discount</label>
                  <Input
                    value={formData.alibabaDiscount || ""}
                    onChange={(e) => updateGmForm("alibabaDiscount", e.target.value)}
                    className={gmFieldErrors.alibabaDiscount ? "border-red-500" : ""}
                  />
                  {gmFieldErrors.alibabaDiscount && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">$ Extra Discount</label>
                  <Input
                    value={formData.extraDiscount || ""}
                    onChange={(e) => updateGmForm("extraDiscount", e.target.value)}
                    disabled={hodDiscountTouched}
                    className={gmFieldErrors.extraDiscount ? "border-red-500" : ""}
                  />
                  {gmFieldErrors.extraDiscount && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
              </div>

              {/* Row 5 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Extra Pkr Discount</label>
                  <Input
                    value={formData.extraDiscountPkr || ""}
                    onChange={(e) => updateGmForm("extraDiscountPkr", e.target.value)}
                    className={gmFieldErrors.extraDiscountPkr ? "border-red-500" : ""}
                  />
                  {gmFieldErrors.extraDiscountPkr && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Request Status</label>
                  <Select
                    value={gmApprovalStatus}
                    onValueChange={setGmApprovalStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block text-red-500 font-semibold">
                    Extra Discount Hod <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={formData.extraDiscountHod !== undefined && formData.extraDiscountHod !== null ? formData.extraDiscountHod : ""}
                    onChange={(e) => {
                      setHodDiscountTouched(true);
                      applyHodDiscountChange(e.target.value);
                    }}
                    placeholder="Enter HOD discount (min 0)"
                    className={`border-red-300 focus:border-red-500 ${formData.extraDiscountHod === "" || hodDiscountMismatch ? "border-red-500 bg-red-50/20" : ""}`}
                  />
                  {gmFieldErrors.extraDiscountHod && <p className="text-xs text-red-500 mt-1">Please fill this</p>}
                  {hodDiscountMismatch && (
                    <p className="text-xs text-red-500 mt-1">
                      Must exactly match $ Extra Discount ({formData.extraDiscount}) to approve
                    </p>
                  )}
                </div>
              </div>

              {/* Row 6 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Account Type</label>
                  <Select defaultValue="New">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comment — required when rejecting */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Comment {gmApprovalStatus === "Rejected" && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  value={gmComment}
                  onChange={(e) => setGmComment(e.target.value)}
                  placeholder={gmApprovalStatus === "Rejected" ? "Reason for rejection (required)" : "Optional comment..."}
                  rows={2}
                />
              </div>

              {/* Installments Section — only meaningful for Partial/Loan GMs; a Full
                  GM still carries a single internal installment row (its Extra
                  Discount tracking), which must not be shown here as if it were
                  a real partial-payment schedule. */}
              {(formData.isPartial || formData.isLoan) && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-zinc-400">Partial Payment Installment</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const current = formData.installments || [];
                      setFormData({
                        ...formData,
                        installments: [...current, { dollar: "", pkr: "", chequeNo: "", payDate: "" }]
                      });
                    }}
                  >
                    + Add Installment
                  </Button>
                </div>

                <div className="space-y-3">
                  {(formData.installments || []).map((inst: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 items-end border p-2 rounded bg-gray-50 relative group dark:bg-zinc-900">
                      <div>
                        <label className="text-xs font-medium block mb-1">Installment Dollar</label>
                        <Input
                          className="h-8 text-sm"
                          value={inst.dollar}
                          onChange={(e) => {
                            const newInst = [...(formData.installments || [])];
                            newInst[idx].dollar = e.target.value;
                            setFormData({ ...formData, installments: newInst });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Installment Pkr</label>
                        <Input
                          className="h-8 text-sm"
                          value={inst.pkr}
                          onChange={(e) => {
                            const newInst = [...(formData.installments || [])];
                            newInst[idx].pkr = e.target.value;
                            setFormData({ ...formData, installments: newInst });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Cheque No</label>
                        <Input
                          className="h-8 text-sm"
                          value={inst.chequeNo}
                          onChange={(e) => {
                            const newInst = [...(formData.installments || [])];
                            newInst[idx].chequeNo = e.target.value;
                            setFormData({ ...formData, installments: newInst });
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Pay Date</label>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={inst.payDate}
                          onChange={(e) => {
                            const newInst = [...(formData.installments || [])];
                            newInst[idx].payDate = e.target.value;
                            setFormData({ ...formData, installments: newInst });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          const newInst = [...(formData.installments || [])];
                          newInst.splice(idx, 1);
                          setFormData({ ...formData, installments: newInst });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(!formData.installments || formData.installments.length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No installments added.</p>
                  )}
                </div>
              </div>
              )}

            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!gmComment || !gmComment.trim() || approveMutation.isPending || rejectMutation.isPending}
              className={gmApprovalStatus === "Rejected" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              onClick={() => {
                if (!selectedGmEntry) return;

                if (!gmApprovalStatus || gmApprovalStatus === "Select Status" || gmApprovalStatus === "Pending") {
                  toast({
                    title: "Validation Error",
                    description: "All fields are required to fill then approved.",
                    variant: "destructive",
                  });
                  return;
                }

                if (gmApprovalStatus === "Approved") {
                  setGmSubmitAttempted(true);
                  const errors = computeGmFieldErrors(formData);
                  const missing = GM_APPROVAL_REQUIRED_FIELDS.filter((f) => errors[f.key]).map((f) => f.label);

                  if (missing.length > 0) {
                    toast({
                      title: "Validation Error",
                      description: `All fields are required to fill then approved. Missing: ${missing.join(", ")}`,
                      variant: "destructive",
                    });
                    return;
                  }

                  // Extra Discount Hod is a pure confirmation field: it must exactly
                  // match the requested "$ Extra Discount" before HOD can approve —
                  // re-checked here since this is the button that actually submits
                  // (handleSaveGmStatus's copy of this check is not wired to it).
                  const hodDiscountNum = Number(formData.extraDiscountHod);
                  const requestedDiscount = Number(formData.extraDiscount) || 0;
                  if (isNaN(hodDiscountNum) || hodDiscountNum < 0) {
                    toast({
                      title: "Invalid Extra Discount HOD",
                      description: "Extra Discount HOD amount cannot be negative. Minimum amount is 0.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (Math.abs(hodDiscountNum - requestedDiscount) > 0.01) {
                    toast({
                      title: "Extra Discount HOD Must Match",
                      description: `Extra Discount HOD (${hodDiscountNum}) must exactly match the requested $ Extra Discount (${requestedDiscount}) to approve.`,
                      variant: "destructive",
                    });
                    return;
                  }
                }

                if (gmApprovalStatus === "Rejected") {
                  const reasonText = gmComment.trim();
                  if (!reasonText) {
                    toast({
                      title: "Validation Error",
                      description: "Please enter a comment/reason when rejecting a GM entry.",
                      variant: "destructive",
                    });
                    return;
                  }
                }

                const isUpdateRequest = selectedGmEntry.type === 'Temp GM' || selectedGmEntry.type === 'Refund GM';

                // For regular GM entries, use new multi-stage approval workflow
                // For Temp/Refund GM, use old update-requests endpoint
                const url = isUpdateRequest
                  ? `/api/hod/verification/update-requests/${selectedGmEntry.id}/action`
                  : gmApprovalStatus === "Approved"
                    ? `/api/gm-pool/${selectedGmEntry.id}/hod-approve`
                    : `/api/gm-pool/${selectedGmEntry.id}/hod-reject`;

                const payload = isUpdateRequest ? {
                  status: gmApprovalStatus,
                  type: selectedGmEntry.type,
                  data: { ...formData, reason: gmComment, comment: gmComment }
                } : gmApprovalStatus === "Approved" ? {
                  comment: gmComment,
                  extraDiscountHod: Number(formData.extraDiscountHod) || 0,
                } : {
                  comment: gmComment
                };

                // We need to use a custom mutation or just fetch directly here since the existing mutation is rigid
                apiRequest("POST", url, payload)
                  .then(async (res) => {
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}));
                      throw new Error(extractApiError(body, res.status));
                    }
                    const successMessage = isUpdateRequest
                      ? "Updated successfully"
                      : gmApprovalStatus === "Approved"
                        ? "Approved! Entry sent to Account Manager and Sales Manager for review."
                        : "Rejected successfully";

                    toast({ title: "Success", description: successMessage });
                    setGmDialogOpen(false);
                    // Invalidate queries
                    queryClient.invalidateQueries({ queryKey: ["hod-verification-updates"] });
                    queryClient.invalidateQueries({ queryKey: ["hod-verification-gms"] });
                  })
                  .catch((err) => {
                    toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
                  });
              }}
            >
              {gmApprovalStatus === "Rejected" ? "Reject" : "Approve & Save"}
            </Button>
          </DialogFooter>
        </DialogContent >
      </Dialog>
      
      {/* Invoice Preview Modal */}
      <Dialog open={showInvoicePreview} onOpenChange={setShowInvoicePreview}>
        <DialogContent className="max-w-[750px] p-0 border-none bg-transparent shadow-none max-h-[95vh] overflow-y-auto thin-scrollbar">
          {selectedInvoiceView && (
            <InvoiceReceipt 
              invoiceData={selectedInvoiceView} 
              onClose={() => setShowInvoicePreview(false)} 
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Approved Data Action Modal */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="max-w-[600px] p-0 border-none rounded-xl bg-white shadow-2xl overflow-hidden dark:bg-zinc-900">
          <DialogHeader className="p-6 border-b flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl font-bold text-gray-800 dark:text-zinc-100">Approved Data</DialogTitle>
              <span className="text-sm font-medium text-emerald-500 mt-1">
                {format(new Date(), "dd-MM-yyyy hh:mm a")}
              </span>
            </div>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-zinc-300">Company</label>
                <Input 
                  value={selectedActionItem?.companyName || ""} 
                  readOnly 
                  className="bg-gray-100 border-gray-200 text-gray-700 font-medium h-11 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600 dark:text-zinc-300">Status</label>
                <Select 
                  value={actionFormData.status} 
                  onValueChange={(v) => setActionFormData({...actionFormData, status: v})}
                >
                  <SelectTrigger className="h-11 border-gray-200 dark:border-zinc-800">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-zinc-400">
                      Tasker
                    </div>
                    <SelectItem value="Approved" className="py-2.5 cursor-pointer">Approved</SelectItem>
                    <SelectItem value="Cancel" className="py-2.5 cursor-pointer bg-emerald-600 text-white data-[highlighted]:bg-emerald-700 data-[highlighted]:text-white">
                      Cancel
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 dark:text-zinc-300">Detail</label>
              <Textarea 
                placeholder="Add detail" 
                className="min-h-[120px] border-gray-200 resize-none dark:border-zinc-800"
                value={actionFormData.detail}
                onChange={(e) => setActionFormData({...actionFormData, detail: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 flex items-center gap-3">
            <Button 
              variant="secondary" 
              onClick={() => setIsActionModalOpen(false)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-8 h-11 font-semibold rounded-lg dark:text-zinc-100 dark:bg-zinc-900"
            >
              Close
            </Button>
            <Button 
              onClick={submitAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8 h-11 font-semibold rounded-lg"
            >
              {approveMutation.isPending || rejectMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
