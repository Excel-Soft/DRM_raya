import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Eye, Pencil, Trash2, ChevronLeft, ChevronRight,
  Search, Monitor, UserCog, X, Users, CheckCircle, XCircle
} from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, mutationRequest } from "@/lib/queryClient";
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
  isLoan: boolean;
  isPartialPayment: boolean;
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

// ─── type badge colors ─────────────────────────────────────────────────────
const typeBg: Record<string, string> = {
  New: "bg-green-500 text-white",
  Rc: "bg-blue-500 text-white",
  "Rc-Up": "bg-indigo-500 text-white",
  Renewal: "bg-purple-500 text-white",
  Upgrade: "bg-orange-500 text-white",
  Downgrade: "bg-gray-500 text-white",
};

export default function AccountGmEntries() {
  const { toast } = useToast();

  // ── top tab: Home | Loan | Partial Payment
  type TopTab = "home" | "loan" | "partial";
  const [topTab, setTopTab] = useState<TopTab>("home");

  // ── status filter — match effective statuses from backend
  type StatusFilter = "all" | "Pending" | "HOD Approved" | "Approved" | "HOD Rejected" | "Account Rejected" | "Withdrawn";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // ── Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GmEntry | null>(null);

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

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<GmStats>({ queryKey: ["/api/account/gm-entries/stats"] });
  const { data: entries, isLoading } = useQuery<GmEntry[]>({ queryKey: ["/api/account/gm-entries"] });
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
    mutationFn: async (data: FormValues) => mutationRequest("POST", "/api/account/gm-entries", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries/stats"] });
      setDialogOpen(false); form.reset();
      toast({ title: "Success", description: "GM Entry created successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to create GM entry", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/account/gm-entries/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries/stats"] });
      toast({ title: "Deleted", description: "GM Entry has been deleted" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) =>
      apiRequest("PATCH", `/api/account/gm-entries/${selectedEntry?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
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

  // ── Approve / Reject mutations (Account Manager action on HOD-approved entries) ──
  const approveMutation = useMutation({
    mutationFn: async (id: string) => mutationRequest("PATCH", `/api/account/gm-entries/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries/stats"] });
      toast({ title: "✅ Approved", description: "GM Entry approved successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to approve entry", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/account/gm-entries/${id}/reject`, { reason: "Rejected by Account Manager" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries/stats"] });
      toast({ title: "❌ Rejected", description: "GM Entry rejected", variant: "destructive" });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject entry", variant: "destructive" }),
  });


  // ── Filter logic ──────────────────────────────────────────────────────────
  const allEntries: GmEntry[] = entries || [];

  const homeCount = allEntries.filter(e => !e.isLoan && !e.isPartialPayment).length;
  const loanCount = allEntries.filter(e => e.isLoan).length;
  const partialCount = allEntries.filter(e => e.isPartialPayment).length;

  const approvedCount = allEntries.filter(e => e.status === "Approved").length;
  const hodApprovedCount = allEntries.filter(e => e.status === "HOD Approved").length;
  const pendingCount = allEntries.filter(e => e.status === "Pending").length;
  const hodRejectedCount = allEntries.filter(e => e.status === "HOD Rejected").length;
  // Account Rejected = entries where account manager rejected (status='Rejected' or 'Account Rejected')
  const acctRejectedCount = allEntries.filter(e => e.status === "Account Rejected" || e.status === "Rejected").length;
  // Withdrawn = only entries that were explicitly withdrawn (not rejected by account manager)
  const withdrawnCount = allEntries.filter(e => e.status === "Withdrawn").length;

  const filteredEntries = useMemo(() => {
    let f = [...allEntries];

    // top tab filter
    if (topTab === "loan") f = f.filter(e => e.isLoan);
    if (topTab === "partial") f = f.filter(e => e.isPartialPayment);

    // status filter
    if (statusFilter !== "all") {
      if (statusFilter === "Withdrawn") {
        // Withdrawn tab: only explicit withdrawals (not account-rejected)
        f = f.filter(e => e.status === "Withdrawn");
      } else if (statusFilter === "Account Rejected") {
        // Account Rejected tab: both 'Rejected' and 'Account Rejected'
        f = f.filter(e => e.status === "Rejected" || e.status === "Account Rejected");
      } else {
        f = f.filter(e => e.status === statusFilter);
      }
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

  const handleViewEntry = (entry: GmEntry) => { setSelectedEntry(entry); setViewDialogOpen(true); };
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

  // ── Row background (similar to screenshot — blue for all approved)
  const rowBg = (i: number) => i % 2 === 0
    ? "bg-[#cce5ff] hover:bg-[#b3d7ff] dark:bg-zinc-900/40 dark:hover:bg-zinc-800/60"
    : "bg-[#d9eeff] hover:bg-[#c0e0ff] dark:bg-zinc-900/20 dark:hover:bg-zinc-800/40";

  const fmtUsd = (v: string | null) => v ? `$ ${parseFloat(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-";
  const fmtPkr = (v: string | null) => v ? Math.round(parseFloat(v)).toLocaleString() : "-";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* ── Page Title ── */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800 tracking-wide dark:text-zinc-100">
          CREATE GM <span className="text-gray-400 font-light">/ </span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const users = allUsers?.users || [];
              if (users.length > 0) openTeamDialog(users[0]);
            }}
            className="flex items-center gap-1.5 text-sm border border-blue-400 text-blue-600 rounded px-3 py-1 hover:bg-blue-50 transition-colors"
          >
            <Users className="h-4 w-4" />
            Manage Team
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 text-sm bg-green-600 text-white rounded px-3 py-1 hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add GM Entry
          </button>
        </div>
      </div>

      {/* ── Top Tabs: Home | Loan | Partial Payment ── */}
      <div className="flex border-b border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
        {([
          { key: "home", label: "Home", count: homeCount },
          { key: "loan", label: "Loan", count: loanCount },
          { key: "partial", label: "Partial Payment", count: partialCount },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setTopTab(tab.key); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-8 py-2.5 text-sm font-medium border-b-2 transition-colors ${topTab === tab.key
              ? "border-green-600 text-green-700 dark:text-green-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
          >
            {tab.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${topTab === tab.key ? "bg-green-600 text-white" : "bg-blue-500 text-white"
              }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Status Buttons ── */}
      <div className="flex flex-wrap border-b border-gray-200 overflow-x-auto dark:border-zinc-800">
        {([
          { key: "all", label: "All Entries", count: allEntries.length, color: "blue" },
          { key: "HOD Approved", label: "HOD Approved", count: hodApprovedCount, color: "indigo" },
          { key: "Approved", label: "Approved", count: approvedCount, color: "green" },
          { key: "Pending", label: "Pending", count: pendingCount, color: "amber" },
          { key: "HOD Rejected", label: "HOD Rejected", count: hodRejectedCount, color: "red" },
          { key: "Account Rejected", label: "Account Rejected", count: acctRejectedCount, color: "orange" },
          { key: "Withdrawn", label: "Withdrawn", count: withdrawnCount, color: "gray" },
        ] as const).map(tab => {
          const isActive = statusFilter === tab.key;
          const colorMap: Record<string, { active: string; badge: string }> = {
            blue: { active: "bg-blue-600 text-white", badge: isActive ? "bg-white text-blue-700" : "bg-blue-500 text-white" },
            indigo: { active: "bg-indigo-600 text-white", badge: isActive ? "bg-white text-indigo-700" : "bg-indigo-500 text-white" },
            green: { active: "bg-green-600 text-white", badge: isActive ? "bg-white text-green-700" : "bg-green-500 text-white" },
            amber: { active: "bg-amber-500 text-white", badge: isActive ? "bg-white text-amber-700" : "bg-amber-500 text-white" },
            red: { active: "bg-red-600 text-white", badge: isActive ? "bg-white text-red-700" : "bg-red-500 text-white" },
            orange: { active: "bg-orange-600 text-white", badge: isActive ? "bg-white text-orange-700" : "bg-orange-500 text-white" },
            gray: { active: "bg-gray-600 text-white", badge: isActive ? "bg-white text-gray-700" : "bg-gray-500 text-white" },
          };
          const c = colorMap[tab.color];
          return (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key as StatusFilter); setCurrentPage(1); }}
              className={`flex-1 min-w-[120px] py-2 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors border-r border-gray-200 last:border-r-0 ${isActive ? c.active : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50"
                }`}
            >
              {tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${c.badge}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Controls Row: Show / entries + Search ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-300">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
            className="border border-gray-300 rounded px-2 py-0.5 text-sm bg-white focus:outline-none dark:bg-zinc-900 dark:border-zinc-800"
          >
            {[10, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span>entries</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-zinc-300">
          <span>Search:</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded px-2 py-0.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-48 dark:bg-zinc-900 dark:border-zinc-800"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto bg-white dark:bg-zinc-900">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <table className="w-full text-xs min-w-[1200px] border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 dark:bg-zinc-900 dark:text-zinc-400">
                {["No", "Drm Id", "Member Id", "Order Id", "Company", "Sale Person", "Add By", "Package", "Type", "Status", "Dollar", "Customer Dollar", "Dollar Rate", "Pkr", "Screen", ""].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold whitespace-nowrap border border-gray-200 dark:border-zinc-800">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={15} className="text-center py-12 text-gray-400">No entries found</td>
                </tr>
              ) : paginatedEntries.map((entry, i) => (
                <tr key={entry.id} className={`${rowBg(i)} border-b border-blue-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-200`}>
                  <td className="px-2 py-1.5 font-medium border border-blue-200 dark:border-zinc-800">
                    {(currentPage - 1) * pageSize + i + 1}
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {entry.drmId}
                      {entry.isLoan && <span className="bg-amber-400 text-white text-[10px] px-1 rounded">L</span>}
                      {entry.isPartialPayment && <span className="bg-purple-400 text-white text-[10px] px-1 rounded">P</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-[11px] max-w-[100px] truncate" title={entry.memberId || ""}>{entry.memberId || ""}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-[11px] max-w-[130px] truncate" title={entry.orderId || ""}>{entry.orderId || ""}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 max-w-[160px] truncate font-medium" title={entry.companyName}>{entry.companyName}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1">
                      <span>{entry.salesPersonName || "—"}</span>
                      {entry.salesPersonName && (
                        <button
                          onClick={() => {
                            const users = allUsers?.users || [];
                            const found = users.find(u => (u.fullName || u.name || "").toLowerCase() === entry.salesPersonName?.toLowerCase());
                            if (found) openTeamDialog(found);
                            else toast({ title: "User not found", description: `"${entry.salesPersonName}" not in system` });
                          }}
                          title="Manage team"
                          className="text-blue-600 hover:text-blue-800 opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <UserCog className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800">{entry.addedByName || "—"}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 whitespace-nowrap">{entry.packageType}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${typeBg[entry.entryType] || "bg-gray-400 text-white"}`}>
                      {entry.entryType}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 whitespace-nowrap">
                    {(() => {
                      const s = entry.status;
                      // 'Rejected' = account manager rejected — show as Account Rejected
                      const isAcctRejected = s === "Account Rejected" || s === "Rejected";
                      const label = isAcctRejected ? "Account Rejected" : s;
                      const cls =
                        s === "Approved" ? "bg-green-500 text-white" :
                          s === "HOD Approved" ? "bg-indigo-500 text-white" :
                            s === "Pending" ? "bg-amber-500 text-white" :
                              s === "HOD Rejected" ? "bg-red-600 text-white" :
                                isAcctRejected ? "bg-orange-600 text-white" :
                                  s === "Withdrawn" ? "bg-gray-500 text-white" :
                                    "bg-gray-400 text-white";
                      return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{label}</span>;
                    })()}
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-right whitespace-nowrap font-medium">{fmtUsd(entry.amountUsd)}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-right whitespace-nowrap">{fmtUsd(entry.customerDollar)}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-right">{entry.dollarRate || "—"}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-right font-medium">{fmtPkr(entry.amountPkr)}</td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800 text-center">
                    <button
                      onClick={() => toast({ title: "Screen View", description: entry.companyName })}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-2 py-1.5 border border-blue-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1">
                      {/* ── Approve / Reject (only for HOD Approved entries) ── */}
                      {entry.status === "HOD Approved" && (
                        <>
                          <button
                            onClick={() => {
                              if (confirm(`"${entry.companyName}" کو Approve کریں؟`)) {
                                approveMutation.mutate(entry.id);
                              }
                            }}
                            disabled={approveMutation.isPending}
                            title="Approve this entry"
                            className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-300 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${entry.companyName}" کو Reject کریں؟`)) {
                                rejectMutation.mutate(entry.id);
                              }
                            }}
                            disabled={rejectMutation.isPending}
                            title="Reject this entry"
                            className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </button>
                        </>
                      )}
                      {/* ── Normal actions ── */}
                      <button onClick={() => handleViewEntry(entry)} className="text-gray-500 hover:text-blue-600 transition-colors dark:text-zinc-400" title="View">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {entry.status !== "Approved" && (
                        <>
                          <button onClick={() => handleEditEntry(entry)} className="text-gray-500 hover:text-green-600 transition-colors dark:text-zinc-400" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(entry.id)} disabled={deleteMutation.isPending} className="text-gray-500 hover:text-red-600 transition-colors dark:text-zinc-400" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-gray-200 text-xs text-gray-500 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
        <span>
          Showing {paginatedEntries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, filteredEntries.length)} of {filteredEntries.length} entries
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pn = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
            return (
              <button
                key={pn}
                onClick={() => setCurrentPage(pn)}
                className={`w-7 h-7 border rounded text-xs ${currentPage === pn ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}
              >
                {pn}
              </button>
            );
          })}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Next
          </button>
        </div>
      </div>

      {/* ════════════ Add GM Entry Dialog ════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add GM Entry</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
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
                  <FormItem><FormLabel>Member ID</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="orderId" render={({ field }) => (
                  <FormItem><FormLabel>Order ID</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem><FormLabel>Company Name *</FormLabel><FormControl><Input placeholder="Company" {...field} /></FormControl><FormMessage /></FormItem>
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
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>GM Entry Details</DialogTitle></DialogHeader>
          {selectedEntry && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["GM Type", selectedEntry.gmType], ["Status", selectedEntry.status],
                ["DRM ID", selectedEntry.drmId], ["Member ID", selectedEntry.memberId || "—"],
                ["Order ID", selectedEntry.orderId || "—"], ["Company", selectedEntry.companyName],
                ["Sale Person", selectedEntry.salesPersonName || "—"], ["Added By", selectedEntry.addedByName || "—"],
                ["Package", selectedEntry.packageType], ["Type", selectedEntry.entryType],
                ["USD", fmtUsd(selectedEntry.amountUsd)], ["Customer $", fmtUsd(selectedEntry.customerDollar)],
                ["$ Rate", selectedEntry.dollarRate || "—"], ["PKR", fmtPkr(selectedEntry.amountPkr)],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded p-2 dark:bg-zinc-900">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{l}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
              {selectedEntry.notes && (
                <div className="col-span-2 bg-gray-50 rounded p-2 dark:bg-zinc-900">
                  <p className="text-xs text-gray-500 dark:text-zinc-400">Notes</p>
                  <p>{selectedEntry.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
