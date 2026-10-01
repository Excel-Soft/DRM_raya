import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/breadcrumb";
import { ComplaintBoxWidget } from "@/components/complaint-box-widget";
import { PromotionBannerWidget } from "@/components/promotion-banner-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import {
  Users,
  Repeat,
  Tag,
  Target,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  Copy,
  UserPlus,
  Timer,
  Clock,
  CalendarClock,
  BadgeCheck,
  PlusCircle,
  Loader2,
} from "lucide-react";

// Backed by the real /api/support/tickets endpoint (support_tickets table) —
// the only real ticket/complaint system that exists in this app so far. See
// backend/src/server/routes/support-routes.ts + repositories/tickets.repository.ts.
type Ticket = {
  id: string;
  subject: string;
  status: "Open" | "InProgress" | "Resolved" | "Failed" | "Closed";
  priority: "Low" | "Medium" | "High";
  channel: string;
  createdAt: string;
  customer?: { companyName?: string; phone?: string } | null;
  assignedTo?: { name?: string } | null;
};

type CustomerSearchResult = {
  id: string;
  companyName: string;
  accountName?: string;
  drmId?: string;
  ownerRole?: string | null;
};

// Real staff picker for supportTickets.assignedToUserId (GET /api/users —
// same endpoint the admin user-list page uses, supports ?search= across
// name/email/role/department).
type AssigneeResult = {
  id: string;
  fullName: string;
  role: string;
};

function formatRoleLabel(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ticketNo(t: Ticket) {
  return `TKT-${t.id.slice(0, 8).toUpperCase()}`;
}

function formatTicketDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString([], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const PRIORITY_OPTIONS = ["Low", "Medium", "High"];
const STATUS_OPTIONS = ["Open", "InProgress", "Resolved", "Failed", "Closed"];

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card className="dashboard-card group hover:scale-[1.02] transition-all duration-300">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">{label}</p>
          <p className="text-[20px] font-bold text-slate-800 tabular-nums dark:text-zinc-100">{value}</p>
        </div>
        <div className="p-2.5 rounded-full bg-emerald-500 text-white shadow-sm group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/50 hover:border-border transition-all text-left w-full"
    >
      <span className="text-xs font-bold text-foreground">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

// Matches the SearchableSelect combobox pattern already used in
// notice-board.tsx — click to expand, dedicated search box inside the panel,
// hover-highlighted options, click-outside to close.
function SearchCombobox<T>({
  placeholder,
  selectedLabel,
  searchValue,
  onSearchChange,
  isLoading,
  options,
  getOptionKey,
  renderOption,
  onSelect,
  emptyText,
}: {
  placeholder: string;
  selectedLabel: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  options: T[];
  getOptionKey: (option: T) => string;
  renderOption: (option: T) => React.ReactNode;
  onSelect: (option: T) => void;
  emptyText: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={ref}>
      <div
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-[13px]"
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-md border border-border px-2 py-1.5 text-[12px] outline-none focus:border-emerald-500 bg-transparent"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">Loading...</div>
            ) : options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-muted-foreground">{emptyText}</div>
            ) : (
              options.map((option) => (
                <div
                  key={getOptionKey(option)}
                  onClick={() => { onSelect(option); setIsOpen(false); }}
                  className="cursor-pointer px-3 py-2 text-[12px] text-foreground transition-colors hover:bg-emerald-600 hover:text-white"
                >
                  {renderOption(option)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplaintManagerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [period, setPeriod] = useState("LD");
  const [ticketTab, setTicketTab] = useState<"today" | "pending" | "resolved">("today");
  const [ticketsSearch, setTicketsSearch] = useState("");
  const [ticketsPageSize, setTicketsPageSize] = useState(10);
  const [ticketsPage, setTicketsPage] = useState(1);

  const [resolvedFocus, setResolvedFocus] = useState(false);
  const [resolvedPage, setResolvedPage] = useState(1);
  const RESOLVED_PAGE_SIZE = 5;

  const [companySearch, setCompanySearch] = useState("");
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [debouncedAssigneeSearch, setDebouncedAssigneeSearch] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<AssigneeResult | null>(null);

  const [addTicketForm, setAddTicketForm] = useState({ service: "", department: "", priority: "", detail: "" });

  const [statusDialogTicket, setStatusDialogTicket] = useState<Ticket | null>(null);
  const [statusForm, setStatusForm] = useState({ status: "", comment: "" });

  const [reassignSearch, setReassignSearch] = useState("");
  const [debouncedReassignSearch, setDebouncedReassignSearch] = useState("");
  const [selectedReassignee, setSelectedReassignee] = useState<AssigneeResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompanySearch(companySearch.trim()), 300);
    return () => clearTimeout(t);
  }, [companySearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedReassignSearch(reassignSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [reassignSearch]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedAssigneeSearch(assigneeSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [assigneeSearch]);

  const ticketsQuery = useQuery<Ticket[]>({ queryKey: ["/api/support/tickets"] });
  const tickets = ticketsQuery.data || [];

  // Same shared endpoint hod-dashboard/product-posting-dashboard/etc. use for
  // their "Important" widget (see backend hod-routes.ts — it's department-
  // scoped, not HOD-only, despite the route prefix).
  const importantStatsQuery = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/hod/dashboard/important-stats"],
  });
  const noticesQuery = useQuery<Array<{ status: string }>>({ queryKey: ["/api/notice-board"] });
  const eventsQuery = useQuery<{ data: any[]; total: number }>({ queryKey: ["/api/events"] });

  const customerSearchQuery = useQuery<CustomerSearchResult[]>({
    queryKey: ["/api/customers/search", debouncedCompanySearch],
    // Empty q returns the most recent companies unfiltered (backend applies no
    // WHERE clause when q is blank) — lets the dropdown list all companies by
    // default instead of staying empty until the user types something.
    // Response shape is `{ customers: [...] }`, not a bare array.
    queryFn: async () => {
      const res = await apiRequestJson<{ customers: CustomerSearchResult[] }>(
        "GET",
        `/api/customers/search?q=${encodeURIComponent(debouncedCompanySearch)}&limit=100`
      );
      return res.customers;
    },
  });

  const assigneeSearchQuery = useQuery<AssigneeResult[]>({
    queryKey: ["/api/users", "assignee-search", debouncedAssigneeSearch],
    queryFn: async () => {
      const res = await apiRequestJson<{ users: Array<{ id: string; fullName: string; role: string }> }>(
        "GET",
        `/api/users?search=${encodeURIComponent(debouncedAssigneeSearch)}`
      );
      return res.users.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));
    },
  });

  const reassignSearchQuery = useQuery<AssigneeResult[]>({
    queryKey: ["/api/users", "reassign-search", debouncedReassignSearch],
    queryFn: async () => {
      const res = await apiRequestJson<{ users: Array<{ id: string; fullName: string; role: string }> }>(
        "GET",
        `/api/users?search=${encodeURIComponent(debouncedReassignSearch)}`
      );
      return res.users.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role }));
    },
  });

  const servicesQuery = useQuery<{ success: boolean; data: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/drm/services"],
  });
  const SERVICE_OPTIONS = (servicesQuery.data?.data ?? []).map((s) => s.name);

  const departmentsQuery = useQuery<{ success: boolean; data: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/drm/departments"],
  });
  const DEPARTMENT_OPTIONS = (departmentsQuery.data?.data ?? []).map((d) => d.name);

  const todayList = useMemo(() => tickets.filter((t) => isToday(t.createdAt)), [tickets]);
  const pendingList = useMemo(() => tickets.filter((t) => t.status === "Open" || t.status === "InProgress"), [tickets]);
  const resolvedList = useMemo(() => tickets.filter((t) => t.status === "Resolved"), [tickets]);
  const highPriorityList = useMemo(() => tickets.filter((t) => t.priority === "High"), [tickets]);

  const visibleTicketRows = useMemo(() => {
    const byTab = ticketTab === "pending" ? pendingList : ticketTab === "resolved" ? resolvedList : todayList;
    const query = ticketsSearch.trim().toLowerCase();
    if (!query) return byTab;
    return byTab.filter((t) =>
      [ticketNo(t), t.customer?.companyName || "", t.assignedTo?.name || "", t.subject, t.status]
        .some((field) => field.toLowerCase().includes(query))
    );
  }, [ticketTab, todayList, pendingList, resolvedList, ticketsSearch]);

  const TICKETS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

  const ticketsTotalPages = Math.max(1, Math.ceil(visibleTicketRows.length / ticketsPageSize));

  const pagedTicketRows = useMemo(() => {
    const start = (ticketsPage - 1) * ticketsPageSize;
    return visibleTicketRows.slice(start, start + ticketsPageSize);
  }, [visibleTicketRows, ticketsPage, ticketsPageSize]);

  const pagedResolved = useMemo(() => {
    const rows = resolvedFocus ? resolvedList.slice(0, 1) : resolvedList;
    const start = (resolvedPage - 1) * RESOLVED_PAGE_SIZE;
    return rows.slice(start, start + RESOLVED_PAGE_SIZE);
  }, [resolvedList, resolvedFocus, resolvedPage]);

  const resolvedTotalPages = Math.max(1, Math.ceil((resolvedFocus ? 1 : resolvedList.length) / RESOLVED_PAGE_SIZE));

  const stats = {
    totalTickets: tickets.length,
    pending: pendingList.length,
    resolved: resolvedList.length,
    highPriority: highPriorityList.length,
  };

  const importantStats = {
    delayProjects: importantStatsQuery.data?.data?.delayProjects ?? 0,
    notices: (noticesQuery.data || []).filter((n) => n.status === "Active").length,
    complaints: tickets.length,
    events: eventsQuery.data?.total ?? 0,
  };

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!addTicketForm.detail.trim()) {
        throw new Error("Detail is required");
      }
      // supportTickets has no dedicated service/department columns, so fold
      // the real Service/Department selections into the subject as a visible
      // prefix instead of silently dropping them.
      const subjectParts = [addTicketForm.service, addTicketForm.department].filter(Boolean);
      subjectParts.push(addTicketForm.detail.trim());
      return apiRequestJson("POST", "/api/support/tickets", {
        customerId: selectedCustomer?.id,
        assignedToUserId: selectedAssignee?.id,
        subject: subjectParts.join(" · "),
        priority: addTicketForm.priority || "Medium",
        channel: "web",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Ticket added", description: selectedCustomer?.companyName || "No company linked" });
      setAddTicketForm({ service: "", department: "", priority: "", detail: "" });
      setSelectedCustomer(null);
      setCompanySearch("");
      setSelectedAssignee(null);
      setAssigneeSearch("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add ticket", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const handleAddTicket = () => createTicketMutation.mutate();

  const openProjectStatus = (ticket: Ticket) => {
    setStatusDialogTicket(ticket);
    setStatusForm({ status: ticket.status, comment: "" });
    setSelectedReassignee(null);
    setReassignSearch("");
  };

  // Shows prior comments on the ticket thread — including rejection reasons
  // from whoever it was assigned to (see ticket-assignment-popup.tsx).
  const ticketMessagesQuery = useQuery<Array<{ id: string; senderName?: string | null; message: string; createdAt: string }>>({
    queryKey: ["/api/support/tickets", statusDialogTicket?.id, "messages"],
    queryFn: () => apiRequestJson("GET", `/api/support/tickets/${statusDialogTicket?.id}/messages`),
    enabled: !!statusDialogTicket,
  });

  const saveProjectStatusMutation = useMutation({
    mutationFn: async () => {
      if (!statusDialogTicket) throw new Error("No ticket selected");
      if (!statusForm.status) throw new Error("Status is required");
      await apiRequestJson("POST", `/api/support/tickets/${statusDialogTicket.id}/status`, { status: statusForm.status });
      if (statusForm.comment.trim()) {
        await apiRequestJson("POST", "/api/support/messages", {
          ticketId: statusDialogTicket.id,
          message: statusForm.comment.trim(),
        });
      }
      if (selectedReassignee) {
        // Reassigning resets assignmentStatus to "pending" server-side, so the
        // new assignee gets the sticky accept/reject popup again — this is how
        // a rejected ticket gets handed to someone else (or back to the same
        // person) after the complaint manager reviews the rejection reason.
        await apiRequestJson("POST", `/api/support/tickets/${statusDialogTicket.id}/assign`, {
          userId: selectedReassignee.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({
        title: "Project status updated",
        description: selectedReassignee
          ? `${statusDialogTicket?.customer?.companyName || "Ticket"} — ${statusForm.status}, reassigned to ${selectedReassignee.fullName}`
          : `${statusDialogTicket?.customer?.companyName || "Ticket"} — ${statusForm.status}`,
      });
      setStatusDialogTicket(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const handleSaveProjectStatus = () => saveProjectStatusMutation.mutate();

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="wide-page p-4 sm:p-6 space-y-6">
        <Breadcrumb items={[{ label: "DASHBOARD" }, { label: "COMPLAINT DEPARTMENT" }, { label: "COMPLAINT MANAGER" }]} />

        <div className="grid grid-cols-12 gap-6">
          {/* Main column */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Top Selling */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between bg-muted/5">
                <CardTitle className="text-[14px] font-bold uppercase tracking-wide">Top Selling</CardTitle>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-8 w-[90px] rounded-lg text-[12px] font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LD">LD</SelectItem>
                    <SelectItem value="WC">WC</SelectItem>
                    <SelectItem value="MN">MN</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Tickets" value={ticketsQuery.isLoading ? "-" : stats.totalTickets} />
                  <StatCard icon={Repeat} label="Pending" value={ticketsQuery.isLoading ? "-" : stats.pending} />
                  <StatCard icon={Tag} label="Resolved" value={ticketsQuery.isLoading ? "-" : stats.resolved} />
                  <StatCard icon={Target} label="High Priority" value={ticketsQuery.isLoading ? "-" : stats.highPriority} />
                </div>
              </CardContent>
            </Card>

            {/* Tickets List */}
            <Card id="tickets-list-card" className="dashboard-card overflow-hidden scroll-mt-4">
              <CardHeader className="py-4 px-6 border-b bg-muted/5">
                <CardTitle className="text-[14px] font-bold uppercase tracking-wide mb-3">Tickets List</CardTitle>
                <div className="flex justify-center gap-2">
                  {(["today", "pending", "resolved"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setTicketTab(tab); setTicketsPage(1); }}
                      className={cn(
                        "px-6 py-2 rounded-lg text-[12px] font-bold transition-all capitalize",
                        ticketTab === tab
                          ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-muted-foreground">
                    <span>Show</span>
                    <Select
                      value={String(ticketsPageSize)}
                      onValueChange={(v) => { setTicketsPageSize(Number(v)); setTicketsPage(1); }}
                    >
                      <SelectTrigger className="h-8 w-[72px] rounded-lg text-[12px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKETS_PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-muted-foreground">Search:</span>
                    <Input
                      value={ticketsSearch}
                      onChange={(e) => { setTicketsSearch(e.target.value); setTicketsPage(1); }}
                      className="h-8 w-[200px] text-[12px]"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-bold uppercase pl-6">No#</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Ticket No</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Create Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Tasker</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Project</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ticketsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-16 text-muted-foreground text-[12px]">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : pagedTicketRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                            No tickets in this queue
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedTicketRows.map((t, i) => (
                          <TableRow key={t.id}>
                            <TableCell className="pl-6">{(ticketsPage - 1) * ticketsPageSize + i + 1}</TableCell>
                            <TableCell>{ticketNo(t)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{formatTicketDate(t.createdAt)}</TableCell>
                            <TableCell className="font-bold">{t.customer?.companyName || "-"}</TableCell>
                            <TableCell>{t.assignedTo?.name || "Unassigned"}</TableCell>
                            <TableCell>{t.subject}</TableCell>
                            <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                            <TableCell className="pr-6">
                              <button
                                onClick={() => openProjectStatus(t)}
                                className="h-8 w-8 rounded-md bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors"
                              >
                                <ChevronRight className="h-4 w-4 text-white" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border/50">
                  <p className="text-[12px] text-muted-foreground">
                    {visibleTicketRows.length === 0
                      ? "Showing 0 entries"
                      : `Showing ${(ticketsPage - 1) * ticketsPageSize + 1} to ${Math.min(ticketsPage * ticketsPageSize, visibleTicketRows.length)} of ${visibleTicketRows.length} entries`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px] font-bold"
                      disabled={ticketsPage <= 1}
                      onClick={() => setTicketsPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: ticketsTotalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setTicketsPage(p)}
                        className={cn(
                          "h-8 w-8 rounded-md text-[12px] font-bold transition-colors",
                          p === ticketsPage ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[12px] font-bold"
                      disabled={ticketsPage >= ticketsTotalPages}
                      onClick={() => setTicketsPage((p) => Math.min(ticketsTotalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resolved Tickets */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b bg-muted/5 flex flex-row items-center justify-between">
                <CardTitle className="text-[14px] font-bold uppercase tracking-wide">Resolved Tickets</CardTitle>
                <Button
                  size="sm"
                  onClick={() => { setResolvedFocus((v) => !v); setResolvedPage(1); }}
                  className={cn(
                    "h-8 px-4 text-[12px] font-bold",
                    resolvedFocus ? "bg-slate-700 hover:bg-slate-800" : "bg-slate-500 hover:bg-slate-600"
                  )}
                >
                  Focus
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-bold uppercase pl-6">No#</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Ticket No</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Tasker</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Project</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Priority</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedResolved.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                            No resolved tickets
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedResolved.map((r, i) => (
                          <TableRow key={r.id}>
                            <TableCell className="pl-6">{(resolvedPage - 1) * RESOLVED_PAGE_SIZE + i + 1}</TableCell>
                            <TableCell>{ticketNo(r)}</TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{formatTicketDate(r.createdAt)}</TableCell>
                            <TableCell className="font-bold">{r.customer?.companyName || "-"}</TableCell>
                            <TableCell>{r.assignedTo?.name || "Unassigned"}</TableCell>
                            <TableCell>{r.subject}</TableCell>
                            <TableCell>
                              <Badge className={cn(
                                "border-none",
                                r.priority === "High" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                              )}>
                                {r.priority}
                              </Badge>
                            </TableCell>
                            <TableCell><Badge className="bg-emerald-50 text-emerald-600 border-none">{r.status}</Badge></TableCell>
                            <TableCell className="pr-6">
                              <Button size="sm" variant="ghost" onClick={() => openProjectStatus(r)}>View</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-center gap-2 py-4 border-t border-border/50">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={resolvedPage <= 1} onClick={() => setResolvedPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: resolvedTotalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setResolvedPage(p)}
                      className={cn(
                        "h-8 w-8 rounded-full text-[12px] font-bold transition-colors",
                        p === resolvedPage ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={resolvedPage >= resolvedTotalPages} onClick={() => setResolvedPage((p) => Math.min(resolvedTotalPages, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Promotion Banner */}
            <PromotionBannerWidget />

            {/* Projects Overview */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b">
                <CardTitle className="text-[14px] font-bold">Projects Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <OverviewItem icon={Copy} label="Duplication" onClick={() => setLocation("/sales/duplicate-checker")} />
                  <OverviewItem icon={UserPlus} label="Add Customer" onClick={() => setLocation("/sales/add-customer")} />
                  <OverviewItem icon={Timer} label="Temporary" onClick={() => setLocation("/customer/temporary-contact")} />
                  <OverviewItem icon={Clock} label="Over Time" onClick={() => setLocation("/hr/overtime")} />
                  <OverviewItem icon={CalendarClock} label="Leave Application" onClick={() => setLocation("/hr/leave-request")} />
                  <OverviewItem icon={BadgeCheck} label="Attendance" onClick={() => setLocation("/hr/attendance")} />
                </div>
              </CardContent>
            </Card>

            {/* Add Ticket */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-[14px] font-bold">Add Ticket</CardTitle>
                <PlusCircle className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <SearchCombobox
                  placeholder="Search Company Through Id/Name"
                  selectedLabel={selectedCustomer ? `${selectedCustomer.companyName} — ${selectedCustomer.ownerRole ? formatRoleLabel(selectedCustomer.ownerRole) : "Unassigned"}` : null}
                  searchValue={companySearch}
                  onSearchChange={(v) => { setCompanySearch(v); setSelectedCustomer(null); }}
                  isLoading={customerSearchQuery.isLoading}
                  options={customerSearchQuery.data ?? []}
                  getOptionKey={(c) => c.id}
                  renderOption={(c) => (
                    <div className="flex items-center justify-between gap-2">
                      <span>{c.companyName}</span>
                      <span className="text-[11px] opacity-70 whitespace-nowrap">
                        {c.ownerRole ? formatRoleLabel(c.ownerRole) : "Unassigned"}
                      </span>
                    </div>
                  )}
                  onSelect={(c) => { setSelectedCustomer(c); setCompanySearch(""); }}
                  emptyText="No companies found"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Service</label>
                    <Select value={addTicketForm.service} onValueChange={(v) => setAddTicketForm((f) => ({ ...f, service: v }))}>
                      <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Department</label>
                    <Select value={addTicketForm.department} onValueChange={(v) => setAddTicketForm((f) => ({ ...f, department: v }))}>
                      <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENT_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Person</label>
                    <SearchCombobox
                      placeholder="Choose..."
                      selectedLabel={selectedAssignee ? `${selectedAssignee.fullName} — ${formatRoleLabel(selectedAssignee.role)}` : null}
                      searchValue={assigneeSearch}
                      onSearchChange={(v) => { setAssigneeSearch(v); setSelectedAssignee(null); }}
                      isLoading={assigneeSearchQuery.isLoading}
                      options={assigneeSearchQuery.data ?? []}
                      getOptionKey={(u) => u.id}
                      renderOption={(u) => (
                        <div className="flex items-center justify-between gap-2">
                          <span>{u.fullName}</span>
                          <span className="text-[11px] opacity-70">{formatRoleLabel(u.role)}</span>
                        </div>
                      )}
                      onSelect={(u) => { setSelectedAssignee(u); setAssigneeSearch(""); }}
                      emptyText="No staff found"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Priority</label>
                    <Select value={addTicketForm.priority} onValueChange={(v) => setAddTicketForm((f) => ({ ...f, priority: v }))}>
                      <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase">Detail</label>
                  <textarea
                    value={addTicketForm.detail}
                    onChange={(e) => setAddTicketForm((f) => ({ ...f, detail: e.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-border bg-transparent p-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button onClick={handleAddTicket} disabled={createTicketMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                  {createTicketMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1.5" />
                  )}
                  Add
                </Button>
              </CardContent>
            </Card>

            {/* Important */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-3 px-5 border-b bg-muted/5">
                <CardTitle className="text-[14px] font-bold">Important</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLocation("/pms/status")}
                    className="flex justify-between items-center py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-[12px] text-muted-foreground font-medium">Delay Projects</span>
                    <span className="text-[12px] font-bold flex items-center gap-1">
                      {importantStatsQuery.isLoading ? "-" : importantStats.delayProjects}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </button>
                  <button
                    onClick={() => setLocation("/notice-board")}
                    className="flex justify-between items-center py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-[12px] text-muted-foreground font-medium">Notice</span>
                    <span className="text-[12px] font-bold flex items-center gap-1">
                      {noticesQuery.isLoading ? "-" : importantStats.notices}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </button>
                  <button
                    onClick={() => document.getElementById("tickets-list-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="flex justify-between items-center py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-[12px] text-muted-foreground font-medium">Complaints</span>
                    <span className="text-[12px] font-bold italic flex items-center gap-1">
                      {ticketsQuery.isLoading ? "-" : importantStats.complaints}
                      <ChevronRight className="h-3 w-3 text-muted-foreground not-italic" />
                    </span>
                  </button>
                  <button
                    onClick={() => setLocation("/reports/event")}
                    className="flex justify-between items-center py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-[12px] text-muted-foreground font-medium">Event</span>
                    <span className="text-[12px] font-bold italic flex items-center gap-1">
                      {eventsQuery.isLoading ? "-" : importantStats.events}
                      <ChevronRight className="h-3 w-3 text-muted-foreground not-italic" />
                    </span>
                  </button>
                </div>
                <div className="flex justify-between items-center py-1.5 mt-1 border-t border-border/50 pt-2">
                  <span className="text-[12px] text-muted-foreground font-medium">Login Time</span>
                  <span className="text-[12px] font-bold italic">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <ComplaintBoxWidget />
          </div>
        </div>

        {/* High Priority Complaints (full width) */}
        <Card className="dashboard-card overflow-hidden">
          <CardHeader className="py-4 px-6 border-b bg-muted/5">
            <CardTitle className="text-[14px] font-bold uppercase tracking-wide">High Priority Complaints</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] font-bold uppercase pl-6">No#</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Ticket No</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Phone</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Tasker</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Project</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Priority</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highPriorityList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                        No high priority complaints
                      </TableCell>
                    </TableRow>
                  ) : (
                    highPriorityList.map((h, i) => (
                      <TableRow key={h.id}>
                        <TableCell className="pl-6">{i + 1}</TableCell>
                        <TableCell className="font-bold whitespace-nowrap">{ticketNo(h)}</TableCell>
                        <TableCell className="font-bold">{h.customer?.companyName || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{h.customer?.phone || "-"}</TableCell>
                        <TableCell>{h.assignedTo?.name || "Unassigned"}</TableCell>
                        <TableCell>{h.subject}</TableCell>
                        <TableCell><Badge className="bg-rose-50 text-rose-600 border-none">{h.priority}</Badge></TableCell>
                        <TableCell><Badge className="bg-rose-50 text-rose-600 border-none">{h.status}</Badge></TableCell>
                        <TableCell className="pr-6">
                          <Button size="sm" variant="ghost" onClick={() => openProjectStatus(h)}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!statusDialogTicket} onOpenChange={(open) => !open && setStatusDialogTicket(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Project Status</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Company</label>
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-[13px]">
                  {statusDialogTicket?.customer?.companyName || "-"}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Project</label>
                <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-[13px]">
                  {statusDialogTicket?.subject}
                </div>
              </div>
            </div>
            {(ticketMessagesQuery.data?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Comments</label>
                <div className="max-h-32 overflow-y-auto space-y-2 rounded-md border border-border bg-muted/20 p-2">
                  {[...ticketMessagesQuery.data!].reverse().map((m) => (
                    <div key={m.id} className="text-[12px]">
                      <span className={cn(
                        "font-bold text-[10px] mr-1.5",
                        m.message.startsWith("[Rejected assignment]") ? "text-rose-600" : "text-muted-foreground"
                      )}>
                        {m.senderName || "Staff"}:
                      </span>
                      <span>{m.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">
                Assign To {!selectedReassignee && statusDialogTicket?.assignedTo?.name && `(currently ${statusDialogTicket.assignedTo.name})`}
              </label>
              <SearchCombobox
                placeholder={statusDialogTicket?.assignedTo?.name ? `Reassign from ${statusDialogTicket.assignedTo.name}...` : "Unassigned — search to assign..."}
                selectedLabel={selectedReassignee ? `${selectedReassignee.fullName} — ${formatRoleLabel(selectedReassignee.role)}` : null}
                searchValue={reassignSearch}
                onSearchChange={(v) => { setReassignSearch(v); setSelectedReassignee(null); }}
                isLoading={reassignSearchQuery.isLoading}
                options={reassignSearchQuery.data ?? []}
                getOptionKey={(u) => u.id}
                renderOption={(u) => (
                  <div className="flex items-center justify-between gap-2">
                    <span>{u.fullName}</span>
                    <span className="text-[11px] opacity-70">{formatRoleLabel(u.role)}</span>
                  </div>
                )}
                onSelect={(u) => { setSelectedReassignee(u); setReassignSearch(""); }}
                emptyText="No staff found"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Status</label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Comment</label>
              <textarea
                value={statusForm.comment}
                onChange={(e) => setStatusForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Add your comment here..."
                rows={4}
                className="w-full rounded-md border border-border bg-transparent p-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setStatusDialogTicket(null)}>Close</Button>
              <Button onClick={handleSaveProjectStatus} disabled={saveProjectStatusMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saveProjectStatusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
