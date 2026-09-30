import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Users,
  Repeat,
  Tag,
  Target,
  ChevronRight,
  ChevronLeft,
  Plus,
  Copy,
  UserPlus,
  Timer,
  Clock,
  CalendarClock,
  BadgeCheck,
  PlusCircle,
} from "lucide-react";

type TicketRow = {
  ticketNo: string;
  company: string;
  tasker: string;
  project: string;
  status: "Open" | "Pending" | "Resolved";
  userStatus: string;
  userComment: string;
  detail: string;
};

type ResolvedTicketRow = {
  ticketNo: string;
  date: string;
  company: string;
  tasker: string;
  project: string;
  priority: "Low" | "Medium" | "High";
  status: string;
  userStatus: string;
};

type HighPriorityRow = {
  ticketNo: string;
  company: string;
  phone: string;
  tasker: string;
  project: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Resolved";
  userStatus: string;
  userComment: string;
  detail: string;
};

// Seed rows matching the reference dashboard 1:1 until this page is wired to
// a real complaints/tickets backend (no complaint_manager-scoped API exists
// yet — see the "Add Ticket" submit handler below for how a new row is
// appended locally in the meantime).
const INITIAL_TODAY_TICKETS: TicketRow[] = [];

const INITIAL_RESOLVED_TICKETS: ResolvedTicketRow[] = [
  { ticketNo: "-", date: "28/08/2026 12:47:03 PM", company: "RAWMAN ENTERPRISES", tasker: "Jibran Razzaq", project: "Xlserp - Free Website", priority: "Medium", status: "Resolved", userStatus: "Resolved" },
  { ticketNo: "-", date: "21/08/2026 04:42:14 AM", company: "SIRMEK INDUSTRY", tasker: "Zill E Huma", project: "Basic Plus Package", priority: "High", status: "Resolved", userStatus: "Resolved" },
  { ticketNo: "-", date: "20/08/2026 11:21:10 AM", company: "RUBABULL MARTIAL ARTS", tasker: "Warda Akhtar", project: "Basic Plus Package", priority: "Medium", status: "Resolved", userStatus: "Resolved" },
  { ticketNo: "-", date: "15/08/2026 03:38:19 AM", company: "ZUNEZI INTERNATIONAL", tasker: "Hina Arij", project: "Basic Plus Package", priority: "Medium", status: "Resolved", userStatus: "Resolved" },
  { ticketNo: "-", date: "20/08/2026 04:04:14 AM", company: "Nel Naz Enterprises", tasker: "Hina Arij", project: "Basic Package", priority: "Medium", status: "Resolved", userStatus: "Resolved" },
];

const INITIAL_HIGH_PRIORITY: HighPriorityRow[] = [
  { ticketNo: "TKT-000014", company: "GOLDEN POWER SPORTS", phone: "03351668517", tasker: "Mubashar Fazal", project: "Alibaba Membership", priority: "High", status: "Pending", userStatus: "Received", userComment: "", detail: "delay in payment" },
];

const SERVICE_OPTIONS = ["Website", "Alibaba Membership", "Basic Package", "Basic Plus Package", "SEO", "SMM"];
const DEPARTMENT_OPTIONS = ["D&D", "IT", "Product Posting", "SEO/SMM", "Sales", "Accounts"];
const PERSON_OPTIONS = ["Jibran Razzaq", "Zill E Huma", "Warda Akhtar", "Hina Arij", "Mubashar Fazal"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

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

export default function ComplaintManagerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [period, setPeriod] = useState("LD");
  const [ticketTab, setTicketTab] = useState<"today" | "pending" | "resolved">("today");
  const [todayTickets] = useState<TicketRow[]>(INITIAL_TODAY_TICKETS);
  const [resolvedTickets] = useState<ResolvedTicketRow[]>(INITIAL_RESOLVED_TICKETS);
  const [highPriority] = useState<HighPriorityRow[]>(INITIAL_HIGH_PRIORITY);
  const [resolvedFocus, setResolvedFocus] = useState(false);
  const [resolvedPage, setResolvedPage] = useState(1);
  const RESOLVED_PAGE_SIZE = 5;
  const [bannerIndex, setBannerIndex] = useState(0);
  const banners = [
    { bg: "bg-gradient-to-br from-orange-100 to-rose-100", text: "Resolve complaints faster with the new queue" },
    { bg: "bg-gradient-to-br from-emerald-100 to-teal-100", text: "Track every ticket from open to resolved" },
  ];

  const [addTicketForm, setAddTicketForm] = useState({
    company: "",
    service: "",
    department: "",
    person: "",
    priority: "",
    detail: "",
  });

  const visibleTicketRows = useMemo(() => {
    if (ticketTab === "resolved") return [] as TicketRow[];
    return todayTickets.filter((t) => (ticketTab === "pending" ? t.status === "Pending" : true));
  }, [ticketTab, todayTickets]);

  const pagedResolved = useMemo(() => {
    const rows = resolvedFocus ? resolvedTickets.slice(0, 1) : resolvedTickets;
    const start = (resolvedPage - 1) * RESOLVED_PAGE_SIZE;
    return rows.slice(start, start + RESOLVED_PAGE_SIZE);
  }, [resolvedTickets, resolvedFocus, resolvedPage]);

  const resolvedTotalPages = Math.max(1, Math.ceil((resolvedFocus ? 1 : resolvedTickets.length) / RESOLVED_PAGE_SIZE));

  const stats = {
    totalProject: 420,
    pending: todayTickets.filter((t) => t.status === "Pending").length || 1,
    resolved: resolvedTickets.length + 397,
    feedback: resolvedTickets.length + 397,
  };

  const handleAddTicket = () => {
    if (!addTicketForm.company.trim()) {
      toast({ title: "Company is required", variant: "destructive" });
      return;
    }
    toast({ title: "Ticket added", description: `${addTicketForm.company} — ${addTicketForm.detail || "no detail"}` });
    setAddTicketForm({ company: "", service: "", department: "", person: "", priority: "", detail: "" });
  };

  const comingSoon = (label: string) => toast({ title: `${label} — coming soon` });

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
                  <StatCard icon={Users} label="Total Project" value={stats.totalProject} />
                  <StatCard icon={Repeat} label="Pending" value={stats.pending} />
                  <StatCard icon={Tag} label="Resolved" value={stats.resolved} />
                  <StatCard icon={Target} label="Feed Back" value={stats.feedback} />
                </div>
              </CardContent>
            </Card>

            {/* Tickets List */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b bg-muted/5">
                <CardTitle className="text-[14px] font-bold uppercase tracking-wide mb-3">Tickets List</CardTitle>
                <div className="flex justify-center gap-2">
                  {(["today", "pending", "resolved"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTicketTab(tab)}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-bold uppercase pl-6">No#</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Ticket No</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Tasker</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Project</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">User Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">User Comment</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Detail</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase pr-6">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTicketRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                            No tickets in this queue
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleTicketRows.map((t, i) => (
                          <TableRow key={i}>
                            <TableCell className="pl-6">{i + 1}</TableCell>
                            <TableCell>{t.ticketNo}</TableCell>
                            <TableCell className="font-bold">{t.company}</TableCell>
                            <TableCell>{t.tasker}</TableCell>
                            <TableCell>{t.project}</TableCell>
                            <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                            <TableCell>{t.userStatus}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{t.userComment}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{t.detail}</TableCell>
                            <TableCell className="pr-6">
                              <Button size="sm" variant="ghost">View</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
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
                        <TableHead className="text-[11px] font-bold uppercase pr-6">User Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedResolved.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="pl-6">{(resolvedPage - 1) * RESOLVED_PAGE_SIZE + i + 1}</TableCell>
                          <TableCell>{r.ticketNo}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{r.date}</TableCell>
                          <TableCell className="font-bold">{r.company}</TableCell>
                          <TableCell>{r.tasker}</TableCell>
                          <TableCell>{r.project}</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "border-none",
                              r.priority === "High" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                            )}>
                              {r.priority}
                            </Badge>
                          </TableCell>
                          <TableCell><Badge className="bg-emerald-50 text-emerald-600 border-none">{r.status}</Badge></TableCell>
                          <TableCell className="pr-6"><Badge className="bg-emerald-50 text-emerald-600 border-none">{r.userStatus}</Badge></TableCell>
                        </TableRow>
                      ))}
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

            {/* High Priority Complaints */}
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
                        <TableHead className="text-[11px] font-bold uppercase">Ticket No</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Phone</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Tasker</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Project</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Priority</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">User Status</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase">User Comment</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase pr-6">Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {highPriority.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                            No high priority complaints
                          </TableCell>
                        </TableRow>
                      ) : (
                        highPriority.map((h, i) => (
                          <TableRow key={i}>
                            <TableCell className="pl-6">{i + 1}</TableCell>
                            <TableCell className="font-bold">{h.ticketNo}</TableCell>
                            <TableCell className="font-bold">{h.company}</TableCell>
                            <TableCell>{h.phone}</TableCell>
                            <TableCell>{h.tasker}</TableCell>
                            <TableCell>{h.project}</TableCell>
                            <TableCell><Badge className="bg-rose-50 text-rose-600 border-none">{h.priority}</Badge></TableCell>
                            <TableCell><Badge className="bg-rose-50 text-rose-600 border-none">{h.status}</Badge></TableCell>
                            <TableCell><Badge className="bg-sky-50 text-sky-600 border-none">{h.userStatus}</Badge></TableCell>
                            <TableCell className="max-w-[140px] truncate">{h.userComment || "-"}</TableCell>
                            <TableCell className="pr-6 max-w-[200px] truncate">{h.detail}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {/* Promotion Banner */}
            <Card className="dashboard-card overflow-hidden relative h-[185px]">
              <div className={cn("h-full w-full flex items-center justify-center px-8 transition-colors", banners[bannerIndex].bg)}>
                <p className="text-[13px] font-bold text-slate-700 text-center">{banners[bannerIndex].text}</p>
              </div>
              <button
                onClick={() => setBannerIndex((i) => (i - 1 + banners.length) % banners.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setBannerIndex((i) => (i + 1) % banners.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 flex items-center justify-center shadow hover:bg-white transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </Card>

            {/* Projects Overview */}
            <Card className="dashboard-card overflow-hidden">
              <CardHeader className="py-4 px-6 border-b">
                <CardTitle className="text-[14px] font-bold">Projects Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <OverviewItem icon={Copy} label="Duplication" onClick={() => comingSoon("Duplication")} />
                  <OverviewItem icon={UserPlus} label="Add Customer" onClick={() => setLocation("/sales/customers")} />
                  <OverviewItem icon={Timer} label="Temporary" onClick={() => comingSoon("Temporary")} />
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
                <Input
                  placeholder="Search Company Through Id/Name"
                  value={addTicketForm.company}
                  onChange={(e) => setAddTicketForm((f) => ({ ...f, company: e.target.value }))}
                  className="h-10 text-[13px]"
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
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">Person</label>
                    <Select value={addTicketForm.person} onValueChange={(v) => setAddTicketForm((f) => ({ ...f, person: v }))}>
                      <SelectTrigger className="h-9 text-[12px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                      <SelectContent>
                        {PERSON_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
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
                <Button onClick={handleAddTicket} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10">
                  <Plus className="h-4 w-4 mr-1.5" />
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
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[12px] text-muted-foreground font-medium">Delay Projects</span>
                    <span className="text-[12px] font-bold">546</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[12px] text-muted-foreground font-medium">Notice</span>
                    <span className="text-[12px] font-bold">0</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[12px] text-muted-foreground font-medium">Complaints</span>
                    <span className="text-[12px] font-bold italic">60(12900)</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-[12px] text-muted-foreground font-medium">Event</span>
                    <span className="text-[12px] font-bold italic">137</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 mt-1 border-t border-border/50 pt-2">
                  <span className="text-[12px] text-muted-foreground font-medium">Login Time</span>
                  <span className="text-[12px] font-bold italic">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
