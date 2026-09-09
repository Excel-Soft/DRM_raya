import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "wouter";
import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  DollarSign,
  UserPlus,
  RefreshCw,
  Clock,
  Briefcase,
  Zap,
  ShieldCheck,
  Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TodayAppointment } from "@/components/today-appointment";

type KpiKey = "totalRevenue" | "new" | "renew" | "expire" | "vm" | "kwa" | "psa" | "sponsorBrand";

type KpiEntry = {
  count: number;
  amount: number;
};

type DashboardSummary = {
  success: boolean;
  data: Record<KpiKey, KpiEntry>;
};

type ActivitiesResponse = {
  success: boolean;
  data: {
    period: string;
    from: string;
    to: string;
    rows: Array<{
      userId: string;
      name: string;
      methods: Record<
        | "mobile"
        | "whatsapp"
        | "onsite"
        | "email"
        | "seminar"
        | "webinar"
        | "appointment"
        | "meeting"
        | "aMinus"
        | "bPlus",
        { done: number; target: number }
      >;
      totals: { activities: number; timeMinutes: number };
    }>;
  };
};

type QueuePerformanceResponse = {
  success: boolean;
  data: {
    items: Array<{
      index: number;
      userId: string;
      person: string;
      target: number;
      achieve: number;
      remain: number;
      aMinus: number;
      prediction: number;
      gm: number;
      bv: number;
    }>;
  };
};

type FollowUpsResponse = {
  success: boolean;
  data: {
    items: Array<{
      id: string;
      drmId?: string;
      customerId: string;
      company: string;
      grade: string;
      poolType: string;
      status: string;
      notes: string;
      dueAt: string | null;
      dateTime?: string | null;
      createdAt: string;
      salesPerson?: string | null;
      serviceType?: string | null;
      subserviceName?: string | null;
      purpose?: string | null;
      method?: string | null;
    }>;
  };
};

type TeamWorkResponse = {
  success: boolean;
  data: {
    items: Array<{
      userId: string;
      name: string;
      leads: number;
      follow: number;
      notFollow: number;
      aMinusCustomer: number;
      bPlusCustomer: number;
      bCustomer: number;
      bMinusCustomer: number;
      callConnected: number;
      notResponse: number;
      appointment: number;
      meeting: number;
    }>;
  };
};

type MeetingsResponse = {
  success: boolean;
  data: { items: Array<{ id: string; userName: string; startsAt: string; endsAt: string; totalMinutes: number | null }> };
};

type TrendResponse = {
  success: boolean;
  data: { labels: string[]; counts: number[]; revenue: number[] };
};

const kpiConfig: Array<{ key: KpiKey; label: string; icon: any; color: string; iconBg: string }> = [
  { key: "totalRevenue", label: "Total Revenue", icon: DollarSign, color: "text-emerald-600", iconBg: "bg-emerald-500" },
  { key: "new", label: "New Leads", icon: UserPlus, color: "text-blue-600", iconBg: "bg-blue-500" },
  { key: "renew", label: "Renewals", icon: RefreshCw, color: "text-indigo-600", iconBg: "bg-indigo-500" },
  { key: "expire", label: "Expiring", icon: Clock, color: "text-amber-600", iconBg: "bg-amber-500" },
  { key: "vm", label: "VM Orders", icon: Briefcase, color: "text-rose-600", iconBg: "bg-rose-500" },
  { key: "kwa", label: "KWA", icon: Zap, color: "text-purple-600", iconBg: "bg-purple-500" },
  { key: "psa", label: "PSA", icon: ShieldCheck, color: "text-cyan-600", iconBg: "bg-cyan-500" },
  { key: "sponsorBrand", label: "Sponsor", icon: Award, color: "text-pink-600", iconBg: "bg-pink-500" },
];

const activityColumns = [
  { key: "mobile", label: "Mob(50)" },
  { key: "whatsapp", label: "WA(20)" },
  { key: "onsite", label: "Site(1)" },
  { key: "email", label: "Mail(50)" },
  { key: "seminar", label: "Sem(1)" },
  { key: "webinar", label: "Web(1)" },
  { key: "appointment", label: "Apt(3)" },
  { key: "meeting", label: "Met(2)" },
  { key: "aMinus", label: "A-(6)" },
  { key: "bPlus", label: "B+(13)" },
];

const quickEntries = [
  { label: "Duplication Check", to: "/sales/duplicate-checker" },
  { label: "Services Pool", to: "/sales/lead-pools?pool=Service" },
  { label: "Leave Application", to: "/hr/leave-request" },
  { label: "BV Checking", to: "/sales/lead-pools?pool=GMBV" },
  { label: "Commission Verification", to: "/account/gm-entries" },
  { label: "Private Pool", to: "/sales/lead-pools?pool=Private" },
  { label: "Performance", to: "/sales/targets" },
  { label: "Loan Application", to: "/hr/loan" },
  { label: "Over Time", to: "/hr/overtime" },
  { label: "Grade List", to: "/sales/lead-pools?grade=all" },
  { label: "Appointment Request", to: "/sales/appointments" },
  { label: "D&D Manager", to: "/dashboard/dd-manager" },
];

const denseHeader = "flex flex-row items-center justify-between gap-3 p-4 sm:p-5";
const denseHeaderPlain = "p-4 sm:p-5";
const denseContent = "p-4 sm:p-5 pt-0";
const denseTableContent = "overflow-x-auto px-3 pb-4 pt-0 sm:px-4 sm:pb-5";

function formatCurrency(amount?: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0 }).format(amount ?? 0);
}

function formatCountAmount(entry?: KpiEntry) {
  if (!entry) return "0 (0)$";
  return `${entry.count ?? 0} (${formatCurrency(entry.amount)}$)`;
}

function percent(done: number, target: number) {
  if (!target) return "0%";
  return `${Math.round((done / target) * 100)}%`;
}

function toDateLabel(value: string) {
  const d = new Date(value);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function minutesLabel(m: number) {
  if (!m) return "0m";
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export default function Dashboard() {
  const [kpiPeriod, setKpiPeriod] = useState<string>("MONTH");
  const [activityPeriod, setActivityPeriod] = useState<string>("WC");
  const [queuePeriod, setQueuePeriod] = useState<string>("MONTH");
  const [queuePage, setQueuePage] = useState<number>(1);
  const [followUpFilter, setFollowUpFilter] = useState<string>("all");

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const emptySummary: DashboardSummary = {
    success: true,
    data: Object.fromEntries(kpiConfig.map((k) => [k.key, { count: 0, amount: 0 }])) as Record<KpiKey, KpiEntry>,
  };

  const emptyActivities: ActivitiesResponse = {
    success: true,
    data: { period: "", from: "", to: "", rows: [] },
  };

  const emptyQueue: QueuePerformanceResponse = {
    success: true,
    data: { items: [] },
  };

  const emptyFollowUps: FollowUpsResponse = {
    success: true,
    data: { items: [] },
  };

  const emptyTeamWork: TeamWorkResponse = {
    success: true,
    data: { items: [] },
  };

  const emptyMeetings: MeetingsResponse = {
    success: true,
    data: { items: [] },
  };

  const emptyTrend: TrendResponse = {
    success: true,
    data: { labels: [], counts: [], revenue: [] },
  };

  const commonQueryOptions = {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    refetchOnMount: false as const,
  };

  const { data: summaryRes = emptySummary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
    queryKey: [`/api/dashboard/summary?period=${kpiPeriod}`],
    ...commonQueryOptions,
    placeholderData: emptySummary,
  });

  const { data: activitiesRes = emptyActivities, isLoading: loadingActivities } = useQuery<ActivitiesResponse>({
    queryKey: [`/api/dashboard/activities?period=${activityPeriod}`],
    ...commonQueryOptions,
    placeholderData: emptyActivities,
  });

  const { data: queueRes = emptyQueue, isLoading: loadingQueue } = useQuery<QueuePerformanceResponse>({
    queryKey: [`/api/dashboard/team-queue-performance?period=${queuePeriod}`],
    ...commonQueryOptions,
    placeholderData: emptyQueue,
  });

  const { data: followUpsRes = emptyFollowUps, isLoading: loadingFollowups } = useQuery<FollowUpsResponse>({
    queryKey: [
      `/api/dashboard/followups?page=1&pageSize=50${followUpFilter && followUpFilter !== "all" ? `&filter=${encodeURIComponent(followUpFilter)}` : ""}`,
    ],
    ...commonQueryOptions,
    placeholderData: emptyFollowUps,
  });

  const { data: teamWorkRes = emptyTeamWork, isLoading: loadingTeamWork } = useQuery<TeamWorkResponse>({
    queryKey: ["/api/dashboard/team-work-performance"],
    ...commonQueryOptions,
    placeholderData: emptyTeamWork,
  });

  const { data: meetingsRes = emptyMeetings, isLoading: loadingMeetings } = useQuery<MeetingsResponse>({
    queryKey: [`/api/dashboard/daily-team-meeting?date=${todayStr}`],
    ...commonQueryOptions,
    placeholderData: emptyMeetings,
  });

  const { data: trendRes = emptyTrend } = useQuery<TrendResponse>({
    queryKey: ["/api/dashboard/current-month-trend"],
    ...commonQueryOptions,
    placeholderData: emptyTrend,
  });

  const summary = summaryRes.data;
  const activityRows: ActivitiesResponse["data"]["rows"] = activitiesRes.data.rows ?? [];
  const queueItems: QueuePerformanceResponse["data"]["items"] = queueRes.data.items ?? [];
  const followUpItems: FollowUpsResponse["data"]["items"] = followUpsRes.data.items ?? [];
  const [viewFollowup, setViewFollowup] = useState<FollowUpsResponse["data"]["items"][number] | null>(null);
  const teamWorkItems: TeamWorkResponse["data"]["items"] = teamWorkRes.data.items ?? [];
  const trendLabels = trendRes.data.labels ?? [];
  const trendCounts = trendRes.data.counts ?? [];

  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    followUpItems.forEach((item) => {
      const service = item.serviceType || "Main Service";
      counts[service] = (counts[service] || 0) + 1;
    });
    return counts;
  }, [followUpItems]);

  return (
    <div className="flex-1 overflow-auto dashboard-page">
      <div className="wide-page p-4 sm:p-6 space-y-6">
        <Breadcrumb items={[{ label: "DASHBOARD" }, { label: "HOME" }]} />

        <div className="grid gap-3 lg:grid-cols-[2fr,1fr] min-w-0 dashboard-grid">
          <div className="space-y-3 min-w-0 dashboard-col">
            <Card className="dashboard-card">
              <CardHeader className={denseHeader}>
                <div>
                  <CardTitle className="uppercase text-xl sm:text-2xl">Team Performance</CardTitle>
                  <p className="text-sm text-muted-foreground">Counts and amounts for the selected period</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Period</span>
                  <Select value={kpiPeriod} onValueChange={setKpiPeriod}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WC">WC</SelectItem>
                      <SelectItem value="TD">TD</SelectItem>
                      <SelectItem value="MONTH">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className={`${denseContent} min-w-0`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {kpiConfig.map((item) => {
                    const entry = summary?.[item.key];
                    return (
                      <div
                        key={item.key}
                        className="group relative flex items-center justify-between rounded-2xl bg-card p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 shadow-sm border border-border overflow-hidden"
                      >
                        {/* Background Accent Gradient */}
                        <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-500 bg-gradient-to-br", item.iconBg)} />

                        <div className="relative space-y-2">
                          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">{item.label}</div>
                          {loadingSummary ? (
                            <div className="flex items-center gap-2 py-1">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-2xl font-black text-foreground tracking-tight leading-none uppercase">
                                {entry?.count ?? 0}
                              </div>
                              <div className={cn("text-xs font-bold tracking-wide flex items-center gap-1", item.color)}>
                                <span className="opacity-60">$</span>
                                {formatCurrency(entry?.amount)}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
                          item.iconBg
                        )}>
                          <item.icon className="h-7 w-7 transition-all duration-500 group-hover:scale-110" strokeWidth={2.5} />

                          {/* Decorative Ring */}
                          <div className="absolute inset-0 rounded-2xl border-2 border-white/20 scale-90 group-hover:scale-100 transition-transform duration-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader className={denseHeader}>
                <CardTitle>Activities</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">TD / WC / Month</span>
                  <Select value={activityPeriod} onValueChange={setActivityPeriod}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TD">TD</SelectItem>
                      <SelectItem value="WC">WC</SelectItem>
                      <SelectItem value="MONTH">Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="px-1 pb-3 pt-0 sm:px-2 sm:pb-4 overflow-hidden">
                <table className="w-full table-fixed text-[11px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-1 py-1 text-left font-semibold w-[13%] truncate">Name</th>
                      {activityColumns.map((col) => (
                        <th key={col.key} className="px-0.5 py-1 text-center font-semibold whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-0.5 py-1 text-center font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingActivities ? (
                      <tr>
                        <td colSpan={activityColumns.length + 2} className="px-1 py-3 text-center text-muted-foreground text-xs">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading...
                          </div>
                        </td>
                      </tr>
                    ) : activityRows.length === 0 ? (
                      <tr>
                        <td colSpan={activityColumns.length + 2} className="px-1 py-3 text-center text-muted-foreground text-xs">
                          No activity data for this period.
                        </td>
                      </tr>
                    ) : (
                      activityRows.map((row: ActivitiesResponse["data"]["rows"][number]) => (
                        <tr key={row.userId} className="last:border-0">
                          <td className="px-1 py-1 font-medium truncate">{row.name}</td>
                          {activityColumns.map((col) => {
                            const entry = row.methods[col.key as keyof typeof row.methods];
                            const val = entry ? `${entry.done}/${entry.target}` : "-";
                            return (
                              <td key={col.key} className="px-0.5 py-1 text-center whitespace-nowrap">
                                {val}
                              </td>
                            );
                          })}
                          <td className="px-0.5 py-1 text-center whitespace-nowrap">{minutesLabel(row.totals.timeMinutes)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader className={denseHeader}>
                <CardTitle>Team Queue Sale Performance</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={queuePeriod} onValueChange={(val) => { setQueuePeriod(val); setQueuePage(1); }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTH">Month</SelectItem>
                      <SelectItem value="WC">WC</SelectItem>
                      <SelectItem value="TD">TD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className={denseTableContent}>
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Person</th>
                      <th className="px-3 py-2 text-left font-semibold">Target</th>
                      <th className="px-3 py-2 text-left font-semibold">Achieve</th>
                      <th className="px-3 py-2 text-left font-semibold">Remain</th>
                      <th className="px-3 py-2 text-left font-semibold">A-</th>
                      <th className="px-3 py-2 text-left font-semibold">Prediction</th>
                      <th className="px-3 py-2 text-left font-semibold">GM</th>
                      <th className="px-3 py-2 text-left font-semibold">BV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingQueue ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading team queue...
                          </div>
                        </td>
                      </tr>
                    ) : queueItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-muted-foreground">
                          No queue data found.
                        </td>
                      </tr>
                    ) : (
                      queueItems.slice((queuePage - 1) * 10, queuePage * 10).map((item) => (
                        <tr key={item.index} className="last:border-0">
                          <td className="px-3 py-2">{item.index}</td>
                          <td className="px-3 py-2 font-medium">{item.person}</td>
                          <td className="px-3 py-2">{item.target}</td>
                          <td className="px-3 py-2">{item.achieve}</td>
                          <td className="px-3 py-2">{item.remain}</td>
                          <td className="px-3 py-2">{item.aMinus}</td>
                          <td className="px-3 py-2">{formatCurrency(item.prediction)}</td>
                          <td className="px-3 py-2">{item.gm}</td>
                          <td className="px-3 py-2">{item.bv}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {queueItems.length > 10 && (
                  <div className="flex items-center justify-end mt-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                        disabled={queuePage === 1}
                        className="px-4 py-1.5 border border-slate-200 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:hover:bg-zinc-800"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setQueuePage(p => p + 1)}
                        disabled={queuePage * 10 >= queueItems.length}
                        className="px-6 py-1.5 border border-slate-200 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:hover:bg-zinc-800"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="dashboard-card">
              <CardHeader className={denseHeader}>
                <CardTitle>Follow Up Details</CardTitle>
                <div className="w-52">
                  <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Please Select Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Open">Open</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="px-1 pb-3 pt-0 sm:px-2 sm:pb-4 overflow-hidden">
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full table-fixed text-[11px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-0.5 py-1 text-left font-semibold w-[3%]">#</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[8%]">DRM ID</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[10%]">Company</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[7%]">Person</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[10%]">
                          <div className="flex items-center gap-1">
                            Service
                            <Popover>
                              <PopoverTrigger asChild>
                                <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200 px-1 py-0 h-4 text-[9px]">
                                  {followUpItems.filter(i => i.serviceType).length}
                                </Badge>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <div className="p-3 bg-slate-50 font-semibold text-xs text-slate-700 dark:bg-zinc-900 dark:text-zinc-400">
                                  Service Type Breakdown
                                </div>
                                <div className="p-2 max-h-[300px] overflow-y-auto space-y-1">
                                  {Object.entries(serviceCounts)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([service, count]) => (
                                      <div key={service} className="flex items-center justify-between text-xs p-1.5 hover:bg-slate-50 rounded dark:hover:bg-zinc-800">
                                        <span className="font-medium text-slate-700 truncate pr-3 dark:text-zinc-400">{service}</span>
                                        <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded dark:bg-zinc-900 dark:text-zinc-100">{count}</span>
                                      </div>
                                    ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[5%]">Grade</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[9%]">Purpose</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[7%]">Method</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[5%]">Pool</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[6%]">Status</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[10%]">Next Date</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[10%]">Notes</th>
                        <th className="px-0.5 py-1 text-left font-semibold w-[10%]">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingFollowups ? (
                        <tr>
                          <td colSpan={13} className="px-1 py-4 text-center text-muted-foreground text-xs">
                            <div className="inline-flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Loading follow ups...
                            </div>
                          </td>
                        </tr>
                      ) : followUpItems.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-1 py-6 text-center text-muted-foreground text-xs">
                            Please Select Filter to see the data
                          </td>
                        </tr>
                      ) : (
                        followUpItems.map((item: FollowUpsResponse["data"]["items"][number], idx: number) => (
                          <tr key={item.id} className="last:border-0">
                            <td className="px-0.5 py-1">{idx + 1}</td>
                            <td className="px-0.5 py-1 truncate">{item.drmId ?? "-"}</td>
                            <td className="px-0.5 py-1 font-medium truncate">{item.company ?? "-"}</td>
                            <td className="px-0.5 py-1 truncate">{item.salesPerson ?? "-"}</td>
                            <td className="px-0.5 py-1">
                              {item.serviceType ? (
                                <div className="flex items-center gap-0.5 flex-wrap">
                                  <span className="text-orange-600 font-medium truncate">{item.serviceType}</span>
                                  <span
                                    className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-orange-100 text-orange-700 text-[8px] font-bold border border-orange-200"
                                    title={`${serviceCounts[item.serviceType] ?? 1} follow-up${(serviceCounts[item.serviceType] ?? 1) > 1 ? "s" : ""}`}
                                  >
                                    {serviceCounts[item.serviceType] ?? 1}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-0.5 py-1">{item.grade ?? "-"}</td>
                            <td className="px-0.5 py-1 truncate">{item.purpose ?? "-"}</td>
                            <td className="px-0.5 py-1 truncate">{item.method ?? "-"}</td>
                            <td className="px-0.5 py-1 truncate">{item.poolType ?? "-"}</td>
                            <td className="px-0.5 py-1">
                              <Badge
                                variant="secondary"
                                className="cursor-pointer text-[9px] px-1 py-0 h-4"
                                onClick={() => setViewFollowup(item)}
                              >
                                {item.status ?? "-"}
                              </Badge>
                            </td>
                            <td className="px-0.5 py-1 truncate">
                              {(() => {
                                const ts = item.dateTime || item.dueAt;
                                return ts ? new Date(ts).toLocaleDateString() : "-";
                              })()}
                            </td>
                            <td className="px-0.5 py-1 truncate">{item.notes ?? "-"}</td>
                            <td className="px-0.5 py-1 truncate">
                              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="space-y-3 min-w-0 dashboard-col">
            <Card className="overflow-hidden dashboard-card">
              <CardHeader className={denseHeaderPlain}>
                <CardTitle>Highlights</CardTitle>
              </CardHeader>
              <CardContent className={denseContent}>
                <div className="rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white p-3 sm:p-4">
                  <p className="text-base sm:text-lg font-semibold">Stay on top of your team</p>
                  <p className="text-sm text-emerald-50 mt-1">
                    Review KPIs, meetings, and quick entries in one place.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={denseHeaderPlain}>
                <CardTitle>Current Month</CardTitle>
              </CardHeader>
              <CardContent className={`${denseContent} overflow-hidden`}>
                {trendLabels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data yet for this month.</p>
                ) : (
                  <div className="flex items-end gap-2 h-36 sm:h-44 overflow-x-auto pb-1">
                    {trendLabels.map((label, idx) => {
                      const value = trendCounts[idx] ?? 0;
                      const height = value === 0 ? 4 : Math.min(100, value * 8);
                      return (
                        <div key={label} className="flex flex-col items-center gap-1 min-w-[36px]">
                          <div
                            className="w-8 rounded-t-md bg-emerald-500"
                            style={{ height: `${height}px` }}
                            title={`${value} leads`}
                          />
                          <span className="text-xs text-muted-foreground">{toDateLabel(label)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={denseHeaderPlain}>
                <CardTitle>Daily Team Meeting</CardTitle>
              </CardHeader>
              <CardContent className={`${denseContent} space-y-3`}>
                {loadingMeetings ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading meetings...
                  </div>
                ) : (meetingsRes?.data.items ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No meetings scheduled for today.</p>
                ) : (
                  <div className="space-y-2">
                    {(meetingsRes?.data.items ?? []).map((m) => (
                      <div key={m.id} className="rounded-md p-3 shadow-sm bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{m.userName}</div>
                          <Badge variant="secondary">{minutesLabel(m.totalMinutes ?? 0)}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.startsAt ? new Date(m.startsAt).toLocaleTimeString() : "-"} -{" "}
                          {m.endsAt ? new Date(m.endsAt).toLocaleTimeString() : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className={denseHeaderPlain}>
                <CardTitle>Quick Entries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                {quickEntries.map((entry) => (
                  <Link
                    key={entry.label}
                    href={entry.to}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted transition shadow-sm"
                  >
                    <span>{entry.label}</span>
                    <span className="text-muted-foreground text-xs">Open</span>
                  </Link>
                ))}
              </CardContent>
            </Card>

            <TodayAppointment />
          </div>

          <Card className="dashboard-card lg:col-span-full">
            <CardHeader className={denseHeaderPlain}>
              <CardTitle>Team Work Performance</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4 pt-0 sm:px-3 sm:pb-5">
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-1.5 py-1.5 text-left font-semibold w-[14%]">Name</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Leads</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Follow</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold whitespace-nowrap">Not Follow</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">A-</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">B+</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">B</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">B-</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold whitespace-nowrap">Call Conn.</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold whitespace-nowrap">No Resp.</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Appt.</th>
                    <th className="px-1.5 py-1.5 text-center font-semibold">Meeting</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTeamWork ? (
                    <tr>
                      <td colSpan={12} className="px-1.5 py-4 text-center text-muted-foreground">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading performance...
                        </div>
                      </td>
                    </tr>
                  ) : teamWorkItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-1.5 py-4 text-center text-muted-foreground">
                        No performance data found.
                      </td>
                    </tr>
                  ) : (
                    teamWorkItems.map((item: TeamWorkResponse["data"]["items"][number]) => (
                      <tr key={item.userId} className="border-b last:border-0">
                        <td className="px-1.5 py-1.5 font-medium truncate">{item.name}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.leads}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.follow}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.notFollow}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.aMinusCustomer}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.bPlusCustomer}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.bCustomer}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.bMinusCustomer}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.callConnected}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.notResponse}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.appointment}</td>
                        <td className="px-1.5 py-1.5 text-center">{item.meeting}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div >

      <Dialog open={!!viewFollowup} onOpenChange={(open) => !open && setViewFollowup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow-up Details</DialogTitle>
            <DialogDescription>Customer and follow-up info</DialogDescription>
          </DialogHeader>
          {viewFollowup && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground">Company</p>
                  <p className="font-medium">{viewFollowup.company || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grade</p>
                  <p className="font-medium">{viewFollowup.grade || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pool</p>
                  <p className="font-medium">{viewFollowup.poolType || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium">{viewFollowup.status || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Next Date</p>
                  <p className="font-medium">
                    {viewFollowup.dueAt
                      ? new Date(viewFollowup.dueAt).toLocaleString()
                      : viewFollowup.dateTime
                        ? new Date(viewFollowup.dateTime).toLocaleString()
                        : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {viewFollowup.createdAt ? new Date(viewFollowup.createdAt).toLocaleString() : "-"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Comments/Note</p>
                <p className="font-medium whitespace-pre-wrap">{viewFollowup.notes || "-"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
}
