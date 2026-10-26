"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/legacy/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/legacy/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/legacy/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { Card, CardContent } from "@/components/ui/legacy/card";
import { PartialReceiptsDialog } from "@/modules/account/components/gm/PartialReceiptsDialog";
import { LoanTermsDialog } from "@/modules/account/components/gm/LoanTermsDialog";
import { GmDetailInvoicesModal } from "@/modules/account/components/gm-detail-invoices-modal";
import { AccountApprovalModal } from "@/modules/account/components/account-approval-modal";
import {
  Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  Search, Monitor, UserCog, X, Users, CheckCircle, XCircle, Wallet, Landmark
} from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { cn } from "@/lib/utils";
import {
  AccountShell,
  AccountFiltersCard,
  AccountFilterGroup,
  AccountFilterChip,
  AccountListToolbar,
  DrmSection,
  accountTableWrapClass,
  accountTableClass,
  accountTableHeadRowClass,
  accountTableHeadCellClass,
  accountTableBodyRowClass,
} from "@/modules/account/account-ui";
import { Badge } from "@/components/ui/badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { apiRequest, queryClient, mutationRequest } from "@/lib/query/query-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface GmEntry {
  id: string;
  gmType: string;
  drmId: string;
  memberId: string | null;
  orderId: string | null;
  companyName: string;
  salesPersonName: string | null;
  addedByName: string | null;
  packageType: string;
  entryType: string;
  amountUsd: string;
  customerDollar: string | null;
  dollarRate: string | null;
  amountPkr: string | null;
  status: string;          // effectiveStatus from backend
  approvalStatus: string | null;
  accountManagerStatus: string | null;
  hodStatus: string | null;
  alibabaStatus: string | null;
  packagePrice: string | null;
  discount: string | null;
  abDiscount: string | null;
  extraDiscount: string | null;
  extraDiscountDollar: string | null;
  extraDiscountPkr: string | null;
  totalDiscount: string | null;
  paymentProofUrl: string | null;
  payDate: string | null;
  isLoan: boolean;
  isPartialPayment: boolean;
  fullyPaid?: boolean;
  installmentsTotal?: number;
  installmentsCollected?: number;
  notes: string | null;
  createdAt: string;
}

interface GmStats {
  totalCount: number;
  totalAmountUsd: string;
  pendingCount: number;
  loanCount: number;
  partialPaymentCount: number;
}

interface User {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  role?: string;
}

const formSchema = z.object({
  gmType: z.enum(["GM", "TempGM", "RefundGM"]),
  drmId: z.string().min(1, "DRM ID is required"),
  memberId: z.string().optional(),
  orderId: z.string().optional(),
  companyName: z.string().min(1, "Company name is required"),
  salesPersonName: z.string().optional(),
  addedByName: z.string().optional(),
  packageType: z.string().min(1, "Package is required"),
  entryType: z.string().min(1, "Type is required"),
  underWorks: z.string().optional(),
  amountUsd: z.string().min(1, "USD amount is required"),
  customerDollar: z.string().optional(),
  dollarRate: z.string().optional(),
  amountPkr: z.string().optional(),
  isLoan: z.boolean().default(false),
  isPartialPayment: z.boolean().default(false),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const packageTypes = ["Basic", "Basic Plus", "Kwa", "Kwa-Pro", "GG6 Pro", "Verified Supplier", "Gold Supplier", "Premium", "Standard", "Enterprise"];
const entryTypes = ["New", "Rc", "Rc-Up", "Renewal", "Upgrade", "Downgrade"];

function entryTypeBadgeVariant(type: string): "brand" | "success" | "warning" | "neutral" {
  if (type === "New" || type === "Upgrade") return "brand";
  if (type === "Renewal" || type === "Rc-Up") return "success";
  if (type === "Rc") return "warning";
  return "neutral";
}

export function AccountGmEntriesPage() {
  const { toast } = useToast();

  // ── top tab: Home | Loan | Partial Payment
  type TopTab = "home" | "loan" | "partial";
  const [topTab, setTopTab] = useState<TopTab>("home");

  // ── status filter — match effective statuses from backend
  type StatusFilter = "Approved" | "HOD Rejected" | "Account Rejected";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Approved");

  // ── Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailGmId, setDetailGmId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GmEntry | null>(null);

  // ── Patch 5 Stage 3 — partial receipt / loan terms dialogs
  const [partialDialogOpen, setPartialDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [approveModalEntry, setApproveModalEntry] = useState<GmEntry | null>(null);

  const closeApproveModal = () => {
    setApproveModalEntry(null);
  };
  const [stage3Entry, setStage3Entry] = useState<GmEntry | null>(null);

  // ── Team Members
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamManager, setTeamManager] = useState<User | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gmType: "GM", drmId: "", memberId: "", orderId: "",
      companyName: "", salesPersonName: "", addedByName: "",
      packageType: "", entryType: "", underWorks: "",
      amountUsd: "", customerDollar: "", dollarRate: "", amountPkr: "",
      isLoan: false, isPartialPayment: false, notes: "",
    },
  });

  const companyNameInput = form.watch("companyName");
  const memberIdInput = form.watch("memberId");
  const orderIdInput = form.watch("orderId");

  const { data: acctGmDupCheck } = useQuery<{ memberIdExists?: boolean; orderIdExists?: boolean; companyExists?: boolean }>({
    queryKey: ["acct-check-gm-duplicate", companyNameInput, memberIdInput, orderIdInput],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyNameInput?.trim()) params.set("companyName", companyNameInput.trim());
      if (memberIdInput?.trim()) params.set("memberId", memberIdInput.trim());
      if (orderIdInput?.trim()) params.set("orderId", orderIdInput.trim());
      const res = await fetch(`/api/gm-pool/check-duplicate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || ""}` },
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: (!!companyNameInput && companyNameInput.trim().length >= 2) ||
             (!!memberIdInput && memberIdInput.trim().length >= 2) ||
             (!!orderIdInput && orderIdInput.trim().length >= 2),
    staleTime: 3000,
  });

  const { data: acctDupCheck } = useQuery<{ duplicates?: any[] }>({
    queryKey: ["acct-check-duplicate", companyNameInput],
    queryFn: async () => {
      if (!companyNameInput || companyNameInput.trim().length < 2) return { duplicates: [] };
      const res = await fetch(`/api/check-duplicate?company=${encodeURIComponent(companyNameInput.trim())}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token") || ""}` },
        credentials: "include",
      });
      if (!res.ok) return { duplicates: [] };
      return res.json();
    },
    enabled: !!companyNameInput && companyNameInput.trim().length >= 2,
    staleTime: 5000,
  });

  const isAcctCompanyDuplicate = useMemo(() => {
    if (acctGmDupCheck?.companyExists) return true;
    if (!companyNameInput || companyNameInput.trim().length < 2) return false;
    if (!acctDupCheck?.duplicates?.length) return false;
    const target = companyNameInput.trim().toLowerCase();
    return acctDupCheck.duplicates.some((d: any) =>
      (d.companyName && d.companyName.trim().toLowerCase() === target) ||
      (d.drmId && d.drmId.trim().toLowerCase() === target)
    );
  }, [companyNameInput, acctGmDupCheck, acctDupCheck]);

  const isAcctMemberIdDuplicate = useMemo(() => {
    if (!memberIdInput || memberIdInput.trim().length < 2) return false;
    return !!acctGmDupCheck?.memberIdExists;
  }, [memberIdInput, acctGmDupCheck?.memberIdExists]);

  const isAcctOrderIdDuplicate = useMemo(() => {
    if (!orderIdInput || orderIdInput.trim().length < 2) return false;
    return !!acctGmDupCheck?.orderIdExists;
  }, [orderIdInput, acctGmDupCheck?.orderIdExists]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: rawData, isLoading } = useQuery<{ data: any[] }>({ queryKey: ["/api/gm-pool"] });
  const { data: allUsers } = useQuery<{ users: User[] }>({ queryKey: ["/api/users"] });

  const { data: teamMembersData, refetch: refetchTeam } = useQuery({
    queryKey: ["/api/users", teamManager?.id, "team-members"],
    queryFn: async () => {
      if (!teamManager?.id) return { members: [] };
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/users/${teamManager.id}/team-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!teamManager?.id,
  });

  const teamMembers: any[] = teamMembersData?.members || [];

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => mutationRequest("POST", "/api/gm-pool/gm", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
      setDialogOpen(false); form.reset();
      toast({ title: "Success", description: "GM Entry created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to create GM entry", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/gm-pool/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
      toast({ title: "Deleted", description: "GM Entry has been deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiRequest("PATCH", `/api/gm-pool/${selectedEntry?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
      setEditDialogOpen(false);
      toast({ title: "Updated", description: "GM Entry updated successfully" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update GM entry", variant: "destructive" }),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/users/${teamManager?.id}/team-members`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { refetchTeam(); toast({ title: "Member added" }); },
    onError: () => toast({ title: "Error", description: "Failed to add member", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`/api/users/${teamManager?.id}/team-members/${memberId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { refetchTeam(); toast({ title: "Member removed" }); },
    onError: () => toast({ title: "Error", description: "Failed to remove member", variant: "destructive" }),
  });

  // ── Filter logic ──────────────────────────────────────────────────────────
  const allEntries: GmEntry[] = (rawData?.data || []).map((e: any) => ({
    ...e,
    companyName: e.company || e.companyName,
    packageType: e.package || e.packageType,
    entryType: e.type || e.entryType,
    amountUsd: e.orderDollar || e.amountUsd,
    amountPkr: e.pkr || e.amountPkr,
    accountManagerStatus: e.accountManagerStatus,
    hodStatus: e.hodStatus,
    alibabaStatus: e.alibabaStatus || e.alibaba_status,
    packagePrice: e.packagePrice || e.package_price,
    discount: e.discount,
    abDiscount: e.abDiscount || e.alibaba_discount_usd,
    extraDiscount: e.extraDiscount || e.extra_discount_usd || e.extraDiscountDollar,
    extraDiscountDollar: e.extraDiscountDollar || e.extra_discount_hod,
    extraDiscountPkr: e.extraPkrDiscount || e.extraDiscountPkr || e.extra_discount_pkr,
    totalDiscount: e.totalDiscount || (Number(e.abDiscount || e.alibaba_discount_usd || 0) + Number(e.extraDiscount || e.extra_discount_usd || e.extraDiscountDollar || 0)).toString(),
    paymentProofUrl: e.paymentProofUrl || e.payment_proof_url,
    payDate: e.paymentDate || e.payDate || e.pay_date,
    createdAt: e.createdAt || e.created_at,
  }));

  const isVisibleStatus = (e: GmEntry) => {
    const isApproved = e.status === "Approved" || e.accountManagerStatus === "approved" || (e.approvalStatus === "pending_managers" && e.accountManagerStatus === "pending");
    const isHodRejected = e.hodStatus === "rejected";
    const isAcctRejected = e.accountManagerStatus === "rejected";
    return isApproved || isHodRejected || isAcctRejected;
  };

  const homeCount = allEntries.filter(e => !e.isLoan && !e.isPartialPayment && isVisibleStatus(e)).length;
  const loanCount = allEntries.filter(e => e.isLoan && isVisibleStatus(e)).length;
  const partialCount = allEntries.filter(e => e.isPartialPayment && isVisibleStatus(e)).length;

  const baseEntries = useMemo(() => {
    const f = allEntries.filter(isVisibleStatus);
    if (topTab === "loan") return f.filter(e => e.isLoan);
    if (topTab === "partial") return f.filter(e => e.isPartialPayment);
    return f.filter(e => !e.isLoan && !e.isPartialPayment);
  }, [allEntries, topTab]);

  const approvedCount = baseEntries.filter(e => e.status === "Approved" || e.accountManagerStatus === "approved" || (e.approvalStatus === "pending_managers" && e.accountManagerStatus === "pending")).length;
  const hodRejectedCount = baseEntries.filter(e => e.hodStatus === "rejected").length;
  const acctRejectedCount = baseEntries.filter(e => e.accountManagerStatus === "rejected").length;

  const filteredEntries = useMemo(() => {
    let f = [...baseEntries];

    // (Top tab filtering is already handled by baseEntries)

    // status filter
    if (statusFilter === "Approved") {
      f = f.filter(e => e.status === "Approved" || e.accountManagerStatus === "approved" || (e.approvalStatus === "pending_managers" && e.accountManagerStatus === "pending"));
    } else if (statusFilter === "HOD Rejected") {
      f = f.filter(e => e.hodStatus === "rejected");
    } else if (statusFilter === "Account Rejected") {
      f = f.filter(e => e.accountManagerStatus === "rejected");
    }

    // search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(e =>
        e.drmId.toLowerCase().includes(q) ||
        e.companyName.toLowerCase().includes(q) ||
        e.memberId?.toLowerCase().includes(q) ||
        e.orderId?.toLowerCase().includes(q) ||
        e.salesPersonName?.toLowerCase().includes(q)
      );
    }
    return f;
  }, [allEntries, topTab, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);
  const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openTeamDialog = (user: User) => { setTeamManager(user); setMemberSearch(""); setTeamDialogOpen(true); };

  const availableUsers = (allUsers?.users || [])
    .filter(u => u.id !== teamManager?.id && !teamMembers.find(m => m.id === u.id))
    .filter(u => {
      if (!memberSearch) return true;
      const s = memberSearch.toLowerCase();
      return (u.fullName || u.name || "").toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    });

  const handleViewEntry = (entry: GmEntry) => { setDetailGmId(entry.id); };
  const handleEditEntry = (entry: GmEntry) => {
    setSelectedEntry(entry);
    form.reset({
      gmType: entry.gmType as any, drmId: entry.drmId,
      memberId: entry.memberId || "", orderId: entry.orderId || "",
      companyName: entry.companyName, salesPersonName: entry.salesPersonName || "",
      addedByName: entry.addedByName || "", packageType: entry.packageType,
      entryType: entry.entryType, amountUsd: entry.amountUsd,
      customerDollar: entry.customerDollar || "", dollarRate: entry.dollarRate || "",
      amountPkr: entry.amountPkr || "", isLoan: entry.isLoan,
      isPartialPayment: entry.isPartialPayment, notes: entry.notes || "",
    });
    setEditDialogOpen(true);
  };

  const fmtUsd = (v: string | null) => v ? `$ ${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-";
  const fmtPkr = (v: string | null) => v ? Math.round(parseFloat(v)).toLocaleString() : "-";
  // Raw workflow status columns (account/HOD/Alibaba) sometimes hold backend
  // enum values like "NOT_STARTED" instead of a human label — normalize any
  // of those to a friendly Title Case instead of showing the raw value.
  const fmtStatusLabel = (raw: string | null | undefined) => {
    if (!raw) return "—";
    if (raw === "NOT_STARTED") return "Pending";
    return raw.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AccountShell
      title="Create GM"
      description="Manage full, loan, and partial GM entries with approval workflow."
      className="flex flex-col"
    >
      <AccountFiltersCard>
        <AccountFilterGroup label="GM type">
          {([
            { key: "home", label: "Full GM", count: homeCount },
            { key: "loan", label: "Loan GM", count: loanCount },
            { key: "partial", label: "Partial GM", count: partialCount },
          ] as const).map((tab) => (
            <AccountFilterChip
              key={tab.key}
              active={topTab === tab.key}
              label={tab.label}
              count={tab.count}
              tone="brand"
              onClick={() => {
                setTopTab(tab.key as TopTab);
                setCurrentPage(1);
              }}
            />
          ))}
        </AccountFilterGroup>
        <AccountFilterGroup label="Workflow status">
          <AccountFilterChip
            active={statusFilter === "Approved"}
            label="Approved"
            count={approvedCount}
            tone="brand"
            onClick={() => {
              setStatusFilter("Approved");
              setCurrentPage(1);
            }}
          />
          <AccountFilterChip
            active={statusFilter === "HOD Rejected"}
            label="HOD rejected"
            count={hodRejectedCount}
            tone="danger"
            onClick={() => {
              setStatusFilter("HOD Rejected");
              setCurrentPage(1);
            }}
          />
          <AccountFilterChip
            active={statusFilter === "Account Rejected"}
            label="Account rejected"
            count={acctRejectedCount}
            tone="warn"
            onClick={() => {
              setStatusFilter("Account Rejected");
              setCurrentPage(1);
            }}
          />
        </AccountFilterGroup>
      </AccountFiltersCard>

      <DrmSection
        title="GM entries"
        description={`${filteredEntries.length} record(s) — ${topTab === "home" ? "full" : topTab} payment · ${statusFilter}`}
        className="!overflow-hidden"
      >
        <AccountListToolbar
          pageSize={pageSize}
          pageSizeOptions={[10, 30, 50, 100]}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setCurrentPage(1);
          }}
          search={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="DRM ID, company, sales person…"
        />

        <div className={accountTableWrapClass}>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-600" />
          </div>
        ) : (
          <table className={cn(accountTableClass, "min-w-[1200px]")}>
            <thead>
              <tr className={accountTableHeadRowClass}>
                {["No", "DRM ID", "Member id", "Order id", "Company", "Sale Person", "Added by", "Package", "Type", "Dollar", "Order Dollar", "Customer Dollar", "Dollar Rate", "PKR", "Screenshot", "Discount", "Extra $ discount", "Extra PKR Discount", "Total Discount", "Status", "Create date", "Account status", "HOD status", "Alibaba Status", "Pay Date", "Action"].map(h => (
                  <th key={h} className={accountTableHeadCellClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={26} className="px-3 py-12 text-center text-sm text-zinc-500">
                    No entries found for this filter.
                  </td>
                </tr>
              ) : paginatedEntries.map((entry, i) => (
                <tr key={entry.id} className={accountTableBodyRowClass}>
                  <td className="px-3 py-2 font-medium">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                      {entry.drmId}
                      {entry.isLoan && <span className="bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">L</span>}
                      {entry.isPartialPayment && <span className="bg-purple-400 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm">P</span>}
                      {entry.isPartialPayment && !!entry.installmentsTotal && (
                        <span
                          title="Installments collected / scheduled"
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded shadow-sm font-semibold",
                            entry.fullyPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                          )}
                        >
                          {entry.installmentsCollected || 0}/{entry.installmentsTotal}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[11px] max-w-[100px] truncate text-slate-500" title={entry.memberId || ""}>{entry.memberId || "—"}</td>
                  <td className="px-3 py-2 text-[11px] max-w-[130px] truncate text-slate-500" title={entry.orderId || ""}>{entry.orderId || "—"}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate font-semibold text-slate-800 dark:text-slate-200" title={entry.companyName}>{entry.companyName}</td>
                  <td className="px-3 py-2 truncate max-w-[120px]" title={entry.salesPersonName || ""}>
                    {entry.salesPersonName || "—"}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[120px]" title={entry.addedByName || ""}>{entry.addedByName || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-600">{entry.packageType || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={entryTypeBadgeVariant(entry.entryType || "")}>
                      {entry.entryType || "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-slate-600">{fmtUsd(entry.packagePrice || entry.amountUsd)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-semibold text-slate-800">{fmtUsd(entry.amountUsd)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-slate-600">{fmtUsd(entry.customerDollar)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-500">{entry.dollarRate || "—"}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{fmtPkr(entry.amountPkr)}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.paymentProofUrl ? (
                      <button
                        onClick={() => window.open(entry.paymentProofUrl || "", "_blank")}
                        className="rounded-full bg-emerald-50 p-1.5 text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-900"
                        title="View Screenshot"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">{fmtUsd(entry.abDiscount) || entry.discount || "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">{fmtUsd(entry.extraDiscount) || "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">{fmtPkr(entry.extraDiscountPkr) || "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-slate-700">{fmtUsd(entry.totalDiscount) || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(() => {
                      const s = entry.status;
                      const isAcctRejected = s === "Account Rejected" || s === "Rejected";
                      const label = isAcctRejected ? "Account Rejected" : (s || "—");
                      const cls =
                        s === "Approved" ? "bg-emerald-500 text-white" :
                          s === "HOD Approved" ? "bg-indigo-500 text-white" :
                            s === "Pending" ? "bg-amber-500 text-white" :
                              s === "HOD Rejected" ? "bg-rose-500 text-white" :
                                isAcctRejected ? "bg-orange-500 text-white" :
                                  s === "Withdrawn" ? "bg-slate-500 text-white" :
                                    "bg-slate-400 text-white";
                      return <span className={`text-[10px] font-bold px-2 py-1 rounded-full shadow-sm ${cls}`}>{label}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 capitalize">
                    {fmtStatusLabel(entry.accountManagerStatus)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 capitalize">
                    {fmtStatusLabel(entry.hodStatus)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 capitalize">
                    {fmtStatusLabel(entry.alibabaStatus)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {entry.payDate ? new Date(entry.payDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {/* ── Approve / Reject (only for HOD Approved entries) ──
                          A Partial GM can't be approved until its installment
                          collection (gm_partial_receipts) is fully cleared. */}
                      {(entry.approvalStatus === "pending_managers" && entry.accountManagerStatus === "pending") && (
                        (entry.isPartialPayment || entry.isLoan) && !entry.fullyPaid ? (
                          <span
                            title={entry.isLoan ? "This Loan GM's installments aren't fully collected yet" : "This Partial GM's installments aren't fully collected yet"}
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </span>
                        ) : (
                          <button
                            onClick={() => setApproveModalEntry(entry)}
                            title="Account Approve"
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-colors shadow-sm"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )
                      )}
                      {/* ── Patch 5 Stage 3: payment receipts / loan terms ──
                          A Loan GM now uses this same installment/receipts
                          ledger as Partial GM (in addition to its own Loan
                          Terms admin-approval dialog below) — its "Approve"
                          button above is held the same way, on `fullyPaid`.
                          A Full GM has no installments to track, so it gets
                          neither button. */}
                      {(entry.isPartialPayment || entry.isLoan) && (
                        <button
                          onClick={() => { setStage3Entry(entry); setPartialDialogOpen(true); }}
                          className="text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 p-1.5 rounded-md transition-colors"
                          title={entry.isLoan ? "Loan installment receipts" : "Partial payment receipts"}
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                      )}
                      {entry.isLoan && (
                        <button
                          onClick={() => { setStage3Entry(entry); setLoanDialogOpen(true); }}
                          className="text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 p-1.5 rounded-md transition-colors"
                          title="Loan terms & admin approval"
                        >
                          <Landmark className="h-4 w-4" />
                        </button>
                      )}
                      {/* ── Normal actions ── */}
                      <button onClick={() => handleViewEntry(entry)} className="rounded-md bg-zinc-100 p-1.5 text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      {(() => {
                        const isFullyApproved = entry.hodStatus?.toLowerCase() === "approved" && entry.accountManagerStatus?.toLowerCase() === "approved";
                        const isApprovedTab = statusFilter === "Approved";
                        const disableDelete = isApprovedTab || isFullyApproved || deleteMutation.isPending;
                        const disableEdit = isFullyApproved;

                        return (
                          <>
                            <button
                              onClick={() => !disableEdit && handleEditEntry(entry)}
                              disabled={disableEdit}
                              className={`p-1.5 rounded-md transition-colors ${disableEdit ? "text-slate-400 bg-slate-100 cursor-not-allowed" : "text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100"}`}
                              title={disableEdit ? "Cannot edit fully approved entry" : "Edit"}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => !disableDelete && deleteMutation.mutate(entry.id)}
                              disabled={disableDelete}
                              className={`p-1.5 rounded-md transition-colors ${disableDelete ? "text-slate-400 bg-slate-100 cursor-not-allowed" : "text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100"}`}
                              title={disableDelete ? (isApprovedTab ? "Delete disabled in Approved tab" : "Cannot delete fully approved entry") : "Delete"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>

        <div className="px-4 pb-4">
          <PaginationBar
            page={currentPage}
            pageSize={pageSize}
            total={filteredEntries.length}
            onPageChange={setCurrentPage}
          />
        </div>
      </DrmSection>

      {/* ════════════ Add GM Entry Dialog ════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add GM Entry</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => {
              if (isAcctCompanyDuplicate || isAcctMemberIdDuplicate || isAcctOrderIdDuplicate) {
                const msg = isAcctMemberIdDuplicate ? "Member ID already exists." : isAcctOrderIdDuplicate ? "Order ID already exists." : "Company already exists.";
                toast({ title: "Validation Error", description: msg, variant: "destructive" });
                return;
              }
              createMutation.mutate(d);
            })} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="gmType" render={({ field }) => (
                  <FormItem><FormLabel>GM Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="GM">GM</SelectItem>
                        <SelectItem value="TempGM">Temp GM</SelectItem>
                        <SelectItem value="RefundGM">Refund GM</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="drmId" render={({ field }) => (
                  <FormItem><FormLabel>DRM ID *</FormLabel><FormControl><Input placeholder="DRM ID" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="memberId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Member ID</FormLabel>
                    <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                    {isAcctMemberIdDuplicate ? <p className="text-xs text-destructive font-semibold mt-1">Member ID already exists.</p> : null}
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="orderId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order ID</FormLabel>
                    <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                    {isAcctOrderIdDuplicate ? <p className="text-xs text-destructive font-semibold mt-1">Order ID already exists.</p> : null}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl><Input placeholder="Company" {...field} /></FormControl>
                    {isAcctCompanyDuplicate ? <p className="text-xs text-destructive font-semibold mt-1">Company already exists.</p> : null}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="packageType" render={({ field }) => (
                  <FormItem><FormLabel>Package *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{packageTypes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="entryType" render={({ field }) => (
                  <FormItem><FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{entryTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salesPersonName" render={({ field }) => (
                  <FormItem><FormLabel>Sale Person</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="addedByName" render={({ field }) => (
                  <FormItem><FormLabel>Added By</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="amountUsd" render={({ field }) => (
                  <FormItem><FormLabel>Dollar (USD) *</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="customerDollar" render={({ field }) => (
                  <FormItem><FormLabel>Customer Dollar</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dollarRate" render={({ field }) => (
                  <FormItem><FormLabel>Dollar Rate</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="amountPkr" render={({ field }) => (
                  <FormItem><FormLabel>PKR</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex items-center gap-6">
                <FormField control={form.control} name="isLoan" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Mark as Loan</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isPartialPayment" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal cursor-pointer">Partial Payment</FormLabel>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl>
                  <Textarea placeholder="Notes..." className="min-h-[80px]" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Saving..." : "Add Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ════════════ View Dialog ════════════ */}
      <GmDetailInvoicesModal gmId={detailGmId} onClose={() => setDetailGmId(null)} />

      {/* ════════════ Edit Dialog ════════════ */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit GM Entry</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="drmId" render={({ field }) => (
                  <FormItem><FormLabel>DRM ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="salesPersonName" render={({ field }) => (
                  <FormItem><FormLabel>Sale Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="amountUsd" render={({ field }) => (
                  <FormItem><FormLabel>USD</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="customerDollar" render={({ field }) => (
                  <FormItem><FormLabel>Customer $</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dollarRate" render={({ field }) => (
                  <FormItem><FormLabel>$ Rate</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="amountPkr" render={({ field }) => (
                  <FormItem><FormLabel>PKR</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="flex items-center gap-6">
                <FormField control={form.control} name="isLoan" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Loan</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="isPartialPayment" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="font-normal">Partial Payment</FormLabel>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl>
                  <Textarea className="min-h-[80px]" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Update Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ════════════ Team Members Dialog ════════════ */}
      <Dialog open={teamDialogOpen} onOpenChange={open => { setTeamDialogOpen(open); if (!open) setTeamManager(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-blue-500" /> Team Members
            </DialogTitle>
            {teamManager && (
              <p className="text-sm text-muted-foreground">
                Managing team for:{" "}
                <span className="font-semibold text-foreground">
                  {teamManager.fullName || teamManager.name || teamManager.email}
                </span>
                {teamManager.role && <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">{teamManager.role}</span>}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
            {/* Current Team */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Current Team</span>
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">{teamMembers.length}</span>
              </div>
              {teamMembers.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 text-center">No team members yet. Add members below.</div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-muted/40 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          {(member.fullName || member.name || member.email || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{member.fullName || member.name || member.email}</p>
                          <p className="text-xs text-muted-foreground">{member.email} · {member.role || "—"}</p>
                        </div>
                      </div>
                      <button onClick={() => removeMemberMutation.mutate(member.id)} disabled={removeMemberMutation.isPending}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Member */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Add Member</span>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {memberSearch ? "No users match your search" : "All users are already in the team"}
                  </p>
                ) : availableUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                        {(user.fullName || user.name || user.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{user.fullName || user.name || user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.email} · {user.role || "—"}</p>
                      </div>
                    </div>
                    <button onClick={() => addMemberMutation.mutate(user.id)} disabled={addMemberMutation.isPending}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 rounded px-2 py-1 hover:bg-blue-50 transition-colors">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setTeamDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Patch 5 Stage 3: partial receipts / loan terms dialogs ── */}
      <PartialReceiptsDialog
        gmId={stage3Entry?.id ?? null}
        companyName={stage3Entry?.companyName}
        isPartialPayment={stage3Entry?.isPartialPayment ?? false}
        open={partialDialogOpen}
        onOpenChange={setPartialDialogOpen}
      />
      <LoanTermsDialog
        gmId={stage3Entry?.id ?? null}
        companyName={stage3Entry?.companyName}
        salesPersonName={stage3Entry?.salesPersonName}
        drmId={stage3Entry?.drmId}
        open={loanDialogOpen}
        onOpenChange={setLoanDialogOpen}
      />

      {/* ── Accountant Approve Modal (shared with the Account Manager dashboard's "+" action) ── */}
      <AccountApprovalModal
        open={!!approveModalEntry}
        onOpenChange={(open) => !open && closeApproveModal()}
        gmEntry={
          approveModalEntry
            ? {
                ...approveModalEntry,
                amountUsd: String(
                  Math.max(
                    0,
                    Number(approveModalEntry.amountUsd || 0) - Number((approveModalEntry as any).abDiscount || 0)
                  )
                ),
              }
            : null
        }
      />
    </AccountShell>
  );
}
