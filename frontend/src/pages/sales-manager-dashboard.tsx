import { useMemo, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { GmApprovalCard } from "@/components/gm-approval-card";
import { PipelineSummary } from "@/components/pipeline-summary";
import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
    Users,
    ArrowRightLeft,
    Tag,
    Target,
    ChevronRight,
    MessageSquare,
    Mail,
    Presentation,
    Video,
    Phone,
    CalendarCheck,
    Star,
    Activity,
    DollarSign,
    UserPlus,
    RefreshCw,
    Clock,
    Briefcase,
    Zap,
    ShieldCheck,
    Award
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

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
            services?: { name: string; code: string }[];
            details?: { purpose: string; method: string }[];
        }>;
        total?: number;
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
    data: { items: Array<{ id: string; userId: string; userName: string; startsAt: string; endsAt: string; totalMinutes: number | null }> };
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
    { key: "mobile", label: "Mobile (50)" },
    { key: "whatsapp", label: "Whatsapp (20)" },
    { key: "whCall", label: "WH-Call (5)" },
    { key: "inMeeting", label: "In-meeting (2)" },
    { key: "onsite", label: "Out-meeting (1)" },
    { key: "email", label: "E-mail (50)" },
    { key: "appointment", label: "Appointment (5)" },
    { key: "seminar", label: "Seminar (1)" },
    { key: "webinar", label: "OL-Meeting (10)" },
    { key: "aMinus", label: "A- (6)" },
    { key: "bPlus", label: "B+ (13)" },
];

const activityExtraColumns = [
    { key: "ttTime", label: "TT-Time" },
    { key: "dTime", label: "D-Time" },
    { key: "spendTime", label: "Spend Time" },
    { key: "freeTime", label: "Free Time" },
    { key: "mComment", label: "M-Comment" },
    { key: "deptComment", label: "Dept-Comment" },
    { key: "hodComment", label: "HOD-Comment" },
    { key: "meeting", label: "Meeting" },
];

const quickEntries = [
    { label: "Duplication Check", to: "/sales/duplicate-checker" },
    { label: "Private Pool", to: "/sales/lead-pools?pool=Private" },
    { label: "Services Pool", to: "/sales/lead-pools?pool=Service" },
    { label: "Performance", to: "/sales/targets" },
    { label: "Leave Application", to: "/hr/leave-request" },
    { label: "Loan Application", to: "/hr/loan" },
    { label: "BV Checking", to: "/sales/lead-pools?pool=GMBV" },
    { label: "Over Time", to: "/hr/overtime" },
    { label: "Attendance", to: "/hr/attendance" },
    { label: "Grade List", to: "/sales/lead-pools?grade=all" },
    { label: "Commission Verification", to: "/account/gm-entries" },
    { label: "Appointment Request", to: "/sales/appointments" },
];

const denseHeader = "flex flex-row items-center justify-between gap-3 p-4 sm:px-6 sm:py-5 border-b border-slate-50";
const denseHeaderPlain = "p-4 sm:px-6 sm:py-5 border-b border-slate-50";
const denseContent = "p-4 sm:p-6 pt-6";
const denseTableContent = "overflow-x-auto px-1 sm:px-2 pb-4 pt-0";

function formatCurrency(amount?: number) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0 }).format(amount ?? 0);
}

function formatCountAmount(entry?: KpiEntry) {
    if (!entry) return "0 (0)$";
    return `${entry.count ?? 0}(${formatCurrency(entry.amount)})$`;
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

export default function SalesManagerDashboard() {
    const [kpiPeriod, setKpiPeriod] = useState<string>("ALL");
    const [activityPeriod, setActivityPeriod] = useState<string>("TD");
    const [activityDateFrom, setActivityDateFrom] = useState<string>("");
    const [activityDateTo, setActivityDateTo] = useState<string>("");
    const [queuePeriod, setQueuePeriod] = useState<string>("MONTH");
    const [queuePage, setQueuePage] = useState<number>(1);
    const [followUpFilter, setFollowUpFilter] = useState<string>("all");
    const [followUpDateFrom, setFollowUpDateFrom] = useState<string>("");
    const [followUpDateTo, setFollowUpDateTo] = useState<string>("");
    const [followUpUser, setFollowUpUser] = useState<string>("All Users");
    const [followUpService, setFollowUpService] = useState<string>("");
    const [followUpPage, setFollowUpPage] = useState<number>(1);
    const [followUpPageSize, setFollowUpPageSize] = useState<number>(20);
    const [selectedUser, setSelectedUser] = useState<string>("All Team");
    const [activityUser, setActivityUser] = useState<string>("All Users");
    const [activeFollowSubtype, setActiveFollowSubtype] = useState<string>("All");
    const [activeFollowGrade, setActiveFollowGrade] = useState<string>("All");
    const [followUpSearch, setFollowUpSearch] = useState<string>("");


    const [meetingCommentModalOpen, setMeetingCommentModalOpen] = useState(false);
    const [currentMeetingUser, setCurrentMeetingUser] = useState<string | null>(null);
    const [viewMeeting, setViewMeeting] = useState<any>(null);
    const [meetingComment, setMeetingComment] = useState("");



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
        data: { items: [], total: 0 },
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
        staleTime: 0,
        refetchOnWindowFocus: true,
        retry: 1,
        refetchOnMount: true as const,
    };

    const { data: summaryRes = emptySummary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
        queryKey: [`/api/dashboard/summary?period=${kpiPeriod}`],
        ...commonQueryOptions,
        placeholderData: emptySummary,
    });

    const { data: activitiesRes = emptyActivities, isLoading: loadingActivities } = useQuery<ActivitiesResponse>({
        queryKey: [`/api/dashboard/activities?period=${activityPeriod}${activityDateFrom ? `&from=${activityDateFrom}` : ""}${activityDateTo ? `&to=${activityDateTo}` : ""}`],
        ...commonQueryOptions,
        placeholderData: emptyActivities,
    });

    const { data: queueRes = emptyQueue, isLoading: loadingQueue } = useQuery<QueuePerformanceResponse>({
        queryKey: [`/api/dashboard/team-queue-performance?period=${queuePeriod}`],
        ...commonQueryOptions,
        staleTime: 0,
        placeholderData: emptyQueue,
    });

    const { data: followUpsRes = emptyFollowUps, isLoading: loadingFollowups } = useQuery<FollowUpsResponse>({
        queryKey: [
            "/api/dashboard/followups",
            { page: followUpPage, pageSize: followUpPageSize, filter: followUpFilter, service: followUpService, user: followUpUser, dateFrom: followUpDateFrom, dateTo: followUpDateTo }
        ],
        queryFn: async () => {
            const searchParams = new URLSearchParams();
            searchParams.append("page", followUpPage.toString());
            searchParams.append("pageSize", followUpPageSize.toString());
            if (followUpFilter && followUpFilter !== "all") searchParams.append("filter", followUpFilter);
            if (followUpService) searchParams.append("service", followUpService);
            if (followUpUser && followUpUser !== "All Users") searchParams.append("user", followUpUser);
            if (followUpDateFrom) searchParams.append("dateFrom", followUpDateFrom);
            if (followUpDateTo) searchParams.append("dateTo", followUpDateTo);
            
            const res = await apiRequest("GET", `/api/dashboard/followups?${searchParams.toString()}`);
            return res.json();
        },
        ...commonQueryOptions,
        staleTime: 0,
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

    const { data: activeMeetingsRes } = useQuery<{ success: boolean, data: Record<string, { startTime: string }> }>({
        queryKey: ["/api/dashboard/team-meetings/active"],
        ...commonQueryOptions,
    });
    const activeMeetings = activeMeetingsRes?.data || {};
    const hasAnyActiveMeeting = Object.keys(activeMeetings).length > 0;

    const meetingsTodaySet = useMemo(() => {
        return new Set((meetingsRes?.data?.items || []).map(item => item.userId));
    }, [meetingsRes]);

    const startMeetingMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await apiRequest("POST", `/api/dashboard/team-meetings/${userId}/start`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/team-meetings/active"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/daily-team-meeting", todayStr] });
        }
    });

    const endMeetingMutation = useMutation({
        mutationFn: async ({ userId, comment }: { userId: string, comment: string }) => {
            const res = await apiRequest("POST", `/api/dashboard/team-meetings/${userId}/end`, { comment });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/team-meetings/active"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/daily-team-meeting", todayStr] });
        }
    });

    const { data: trendRes = emptyTrend } = useQuery<TrendResponse>({
        queryKey: ["/api/dashboard/current-month-trend"],
        ...commonQueryOptions,
        staleTime: 0,
        placeholderData: emptyTrend,
    });

    const { data: assignedUsersRaw } = useQuery<any>({
        queryKey: ["/api/users?assigned=true"],
        ...commonQueryOptions,
    });
    const assignedUsers = Array.isArray(assignedUsersRaw) ? assignedUsersRaw : (assignedUsersRaw?.users || []);

    const summary = summaryRes?.data || emptySummary.data;
    const activityRows: ActivitiesResponse["data"]["rows"] = activitiesRes?.data?.rows ?? [];
    
    const availableActivityUsers = useMemo(() => {
        const assignedNames = assignedUsers.map((u: any) => u.name || u.fullName);
        // Also include names from activities in case they are not in the assigned users list (e.g. self)
        const activityNames = activityRows.map(r => r.name);
        return ["All Users", ...Array.from(new Set([...assignedNames, ...activityNames]))];
    }, [activityRows, assignedUsers]);

    const filteredActivityRows = useMemo(() => {
        const userNamesWithActivities = new Set(activityRows.map(r => r.name?.toLowerCase()));
        const emptyRows = assignedUsers
            .filter((u: any) => {
                const n = (u.name || u.fullName || "").toLowerCase();
                return !userNamesWithActivities.has(n);
            })
            .map((u: any) => ({
                userId: u.id,
                name: u.name || u.fullName,
                methods: {} as any,
                totals: { activities: 0, timeMinutes: 0 }
            }));
            
        const allRows = [...activityRows, ...emptyRows];
        
        // Deduplicate by name to be absolutely sure
        const uniqueRows = Array.from(new Map(allRows.map(r => [r.name?.toLowerCase(), r])).values());
        
        if (activityUser === "All Users") return uniqueRows;
        return uniqueRows.filter((row) => row.name === activityUser);
    }, [activityRows, activityUser, assignedUsers]);

    const queueItems: QueuePerformanceResponse["data"]["items"] = queueRes?.data?.items ?? [];
    const followUpItems: FollowUpsResponse["data"]["items"] = followUpsRes?.data?.items ?? [];

    const serviceCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        followUpItems.forEach((item) => {
            const service = item.serviceType || "Main Service";
            counts[service] = (counts[service] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [followUpItems]);

    const uniqueSubtypes = Array.from(new Set(followUpItems.filter(r => activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase()).map(r => r.subserviceName || r.serviceType || "General"))).filter(Boolean) as string[];
    const uniqueGrades = Array.from(new Set(followUpItems.filter(r => activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase()).map(r => r.grade || "A"))).filter(Boolean) as string[];

    const getSubtypeCount = (subtype: string) => {
        if (subtype === "All") return followUpItems.filter((r) => activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase()).length;
        return followUpItems.filter((r) => {
            const sType = r.subserviceName || r.serviceType || "General";
            const matchSub = sType.toLowerCase() === subtype.toLowerCase();
            const matchGrade = activeFollowGrade === "All" || (r.grade || "A").toLowerCase() === activeFollowGrade.toLowerCase();
            return matchSub && matchGrade;
        }).length;
    };

    const getGradeCount = (grade: string) => {
        if (grade === "All") return followUpItems.filter((r) => activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase()).length;
        return followUpItems.filter((r) => {
            const g = r.grade || "A";
            const matchGrade = g.toLowerCase() === grade.toLowerCase();
            const matchSub = activeFollowSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeFollowSubtype.toLowerCase();
            return matchGrade && matchSub;
        }).length;
    };

    const finalFilteredFollowUps = followUpItems.filter((row) => {
        let match = true;
        if (activeFollowSubtype && activeFollowSubtype !== "All") {
            const sType = row.subserviceName || row.serviceType || "General";
            if (sType.toLowerCase() !== activeFollowSubtype.toLowerCase()) {
                match = false;
            }
        }
        if (activeFollowGrade && activeFollowGrade !== "All") {
            const g = row.grade || "A";
            if (g.toLowerCase() !== activeFollowGrade.toLowerCase()) {
                match = false;
            }
        }
        if (followUpSearch) {
            const query = followUpSearch.toLowerCase();
            const company = (row.company || "").toLowerCase();
            const salesPerson = (row.salesPerson || "").toLowerCase();
            const serviceType = (row.serviceType || "").toLowerCase();
            const notes = (row.notes || "").toLowerCase();
            if (!company.includes(query) && !salesPerson.includes(query) && !serviceType.includes(query) && !notes.includes(query)) {
                match = false;
            }
        }
        return match;
    });

    const [viewFollowup, setViewFollowup] = useState<FollowUpsResponse["data"]["items"][number] | null>(null);
    const teamWorkItems: TeamWorkResponse["data"]["items"] = teamWorkRes?.data?.items ?? [];
    const maxTeamLeads = teamWorkItems.length > 0 ? Math.max(...teamWorkItems.map(item => item.leads), 10) : 10;
    const yAxisStep = Math.ceil(maxTeamLeads / 6);
    const yAxisValues = Array.from({length: 7}, (_, i) => (6 - i) * yAxisStep);

    return (
        <div className="flex-1 overflow-auto dashboard-page">
            <div className="wide-page p-2 sm:p-3 lg:px-4 space-y-3">
                <Breadcrumb items={[{ label: "DASHBOARD" }, { label: "SALES DEPARTMENT" }, { label: "SALES MANAGER" }]} />

                <div className="grid gap-3 lg:grid-cols-[2fr,1fr] min-w-0 dashboard-grid">
                    <div className="space-y-3 min-w-0 dashboard-col">
                        <Card className="dashboard-card shadow-sm border-border bg-card">
                            <CardHeader className={denseHeader}>
                                <div>
                                    <CardTitle className="text-xl sm:text-2xl font-semibold text-foreground">Team Performance</CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Select value={kpiPeriod} onValueChange={setKpiPeriod}>
                                        <SelectTrigger className="w-32 bg-card border-border">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TD">Today</SelectItem>
                                            <SelectItem value="WC">This Week</SelectItem>
                                            <SelectItem value="MONTH">This Month</SelectItem>
                                            <SelectItem value="LM">Last Month</SelectItem>
                                            <SelectItem value="ALL">All Time</SelectItem>
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
                                                className="group relative flex items-center justify-between rounded-2xl bg-card p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-border shadow-sm overflow-hidden"
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

                        <PipelineSummary title="Target" period={kpiPeriod} />

                        <Card className="dashboard-card shadow-sm border-border bg-card">
                            <CardHeader className={cn(denseHeader, "flex-col items-start gap-4")}>
                                <div className="flex items-center justify-between w-full">
                                    <CardTitle className="text-lg font-semibold text-foreground">Activities</CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Select value={activityPeriod} onValueChange={(val) => {
                                            setActivityPeriod(val);
                                            setActivityDateFrom("");
                                            setActivityDateTo("");
                                        }}>
                                            <SelectTrigger className="w-24 border-border h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TD">TD</SelectItem>
                                                <SelectItem value="WC">WC</SelectItem>
                                                <SelectItem value="MONTH">Month</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex items-center h-8 rounded-md border border-border bg-background px-2 py-1 shadow-sm transition-colors overflow-hidden">
                                            <input type="date" value={activityDateFrom || todayStr} onChange={e => setActivityDateFrom(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 text-slate-600 dark:text-zinc-300 text-xs w-[110px]" />
                                        </div>
                                        <div className="flex items-center h-8 rounded-md border border-border bg-background px-2 py-1 shadow-sm transition-colors overflow-hidden">
                                            <input type="date" value={activityDateTo || todayStr} onChange={e => setActivityDateTo(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 text-slate-600 dark:text-zinc-300 text-xs w-[110px]" />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center w-full">
                                    <Select value={activityUser} onValueChange={setActivityUser}>
                                        <SelectTrigger className="w-[150px] border-border h-8 text-xs">
                                            <SelectValue placeholder="Apply Filter: All Users" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableActivityUsers.map((user) => (
                                                <SelectItem key={user} value={user}>{user}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </CardHeader>
                            <CardContent className={denseTableContent}>
                                <div className="rounded-lg border border-border overflow-x-auto">
                                    <table className="w-full min-w-max text-sm">
                                        <thead>
                                            <tr className="bg-emerald-100/50 dark:bg-emerald-900/20 border-b border-border">
                                                <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap text-[11px]">Name</th>
                                                {activityColumns.map((col) => {
                                                    const parts = col.label.split('(');
                                                    return (
                                                        <th key={col.key} className="px-3 py-2 text-center font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap text-[11px]">
                                                            {parts[0].trim()}{parts[1] ? <br/> : ''}{parts[1] ? `(${parts[1]}` : ''}
                                                        </th>
                                                    );
                                                })}
                                                {activityExtraColumns.map((col) => (
                                                    <th key={col.key} className="px-3 py-2 text-center font-bold text-slate-700 dark:text-zinc-300 whitespace-nowrap text-[11px]">
                                                        {col.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {loadingActivities ? (
                                                <tr>
                                                    <td colSpan={activityColumns.length + activityExtraColumns.length + 1} className="px-4 py-8 text-center text-slate-400">
                                                        <div className="inline-flex items-center gap-2">
                                                            <Loader2 className="h-5 w-5 animate-spin" />
                                                            Loading activities...
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredActivityRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={activityColumns.length + activityExtraColumns.length + 1} className="px-4 py-8 text-center text-slate-400">
                                                        No activity data found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                <>
                                                    <tr className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-700">
                                                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap text-[11px]">Total</td>
                                                        {activityColumns.map((col) => {
                                                            const doneTotal = filteredActivityRows.reduce((acc, row) => acc + (row.methods[col.key as keyof typeof row.methods]?.done || 0), 0);
                                                            const targetTotal = filteredActivityRows.reduce((acc, row) => acc + (row.methods[col.key as keyof typeof row.methods]?.target || 0), 0);
                                                            const isGrade = col.key === "aMinus" || col.key === "bPlus";
                                                            let val = "-";
                                                            if (isGrade) val = String(doneTotal);
                                                            else val = `${doneTotal}/${targetTotal}=${percent(doneTotal, targetTotal)}`;
                                                            return (
                                                                <td key={col.key} className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">
                                                                    {val}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">{filteredActivityRows.reduce((acc, row) => acc + row.totals.timeMinutes, 0)} M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-700 dark:text-zinc-200 text-[11px] font-medium">-</td>
                                                    </tr>
                                                    {filteredActivityRows.map((row) => (
                                                    <tr key={row.userId} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800 last:border-0">
                                                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-zinc-400 whitespace-nowrap text-[11px]">{row.name}</td>
                                                        {activityColumns.map((col) => {
                                                            const entry = row.methods[col.key as keyof typeof row.methods];
                                                            const isGrade = col.key === "aMinus" || col.key === "bPlus";
                                                            let val = "-";
                                                            if (entry) {
                                                                if (isGrade) val = String(entry.done);
                                                                else val = `${entry.done}/${entry.target}=${percent(entry.done, entry.target)}`;
                                                            } else {
                                                                val = isGrade ? "0" : `0/${col.label.match(/\((\d+)\)/)?.[1] || "0"}=0%`;
                                                            }
                                                            return (
                                                                <td key={col.key} className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">
                                                                    {val}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">{row.totals.timeMinutes} M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">0 M</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">-</td>
                                                        <td className="px-3 py-2 text-center whitespace-nowrap text-slate-600 dark:text-zinc-300 text-[11px]">
                                                            {activeMeetings[row.userId] ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setCurrentMeetingUser(row.userId);
                                                                        setMeetingComment("");
                                                                        setMeetingCommentModalOpen(true);
                                                                    }}
                                                                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded shadow-sm text-[10px] uppercase font-bold"
                                                                >
                                                                    End
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        startMeetingMutation.mutate(row.userId);
                                                                    }}
                                                                    disabled={startMeetingMutation.isPending || hasAnyActiveMeeting || meetingsTodaySet.has(row.userId)}
                                                                    className={`px-2 py-1 rounded shadow-sm text-[10px] uppercase font-bold text-white ${
                                                                        startMeetingMutation.isPending || hasAnyActiveMeeting || meetingsTodaySet.has(row.userId)
                                                                            ? "bg-gray-400 cursor-not-allowed opacity-50" 
                                                                            : "bg-emerald-600 hover:bg-emerald-700"
                                                                    }`}
                                                                >
                                                                    {meetingsTodaySet.has(row.userId) ? "Done" : "Start"}
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>

                                                ))}
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="dashboard-card shadow-sm border-slate-100 dark:border-zinc-800">
                            <CardHeader className={denseHeader}>
                                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-zinc-400">Team Queue Sale Performance</CardTitle>
                                <div className="flex items-center gap-2">
                                    <Select value={queuePeriod} onValueChange={(val) => { setQueuePeriod(val); setQueuePage(1); }}>
                                        <SelectTrigger className="w-24 border-border">
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
                            <CardContent className={denseTableContent}>
                                <div className="rounded-lg border border-slate-100 overflow-x-auto dark:border-zinc-800">
                                    <table className="w-full text-sm min-w-[800px] lg:min-w-max">
                                        <thead>
                                            <tr className="bg-white border-b border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">#</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Person</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Target</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Achive</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Remain</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">A-</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Prediction</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">GM</th>
                                                <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] text-center">BV</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loadingQueue ? (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading...</td>
                                                </tr>
                                            ) : (
                                                queueItems.slice((queuePage - 1) * 10, queuePage * 10).map((item, idx) => {
                                                    const actualIdx = (queuePage - 1) * 10 + idx;
                                                    return (
                                                        <tr key={actualIdx} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                                            <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{actualIdx + 1}</td>
                                                            <td className="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-400">{item.person}</td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.target}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-slate-700 dark:text-zinc-400">{item.achieve}</span>
                                                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:text-zinc-400 dark:bg-zinc-900">
                                                                        {item.target > 0 ? Math.round((item.achieve / item.target) * 100) : 0}%
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.remain}</td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.aMinus}</td>
                                                            <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{formatCurrency(item.prediction)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-600 rounded uppercase dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">GM List</button>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100/50 text-[10px] font-bold text-slate-600 rounded uppercase dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">BV List</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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



                    </div>

                    <div className="space-y-3 min-w-0 dashboard-col">
                        {/* GM Approvals - View Only for Sales Manager */}
                        <GmApprovalCard role="sales-manager" viewOnly={true} />

                        <Card className="overflow-hidden dashboard-card border-none shadow-sm">
                            <CardContent className="p-0">
                                <div className="relative h-48 bg-white border border-slate-100 rounded-lg overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                    <img src="/webexcels-logo.png" alt="Decoration" className="absolute inset-0 w-full h-full object-cover opacity-20 contrast-125" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/40 to-transparent flex items-end p-4">
                                        <p className="text-white font-bold text-lg drop-shadow-md">Innovative Business Solutions</p>
                                    </div>
                                    <div className="absolute top-1/2 -translate-y-1/2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm cursor-pointer hover:bg-black/40"><ChevronRight className="h-5 w-5 rotate-180" /></div>
                                    <div className="absolute top-1/2 -translate-y-1/2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm cursor-pointer hover:bg-black/40"><ChevronRight className="h-5 w-5" /></div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-100 dark:border-zinc-800">
                            <CardHeader className={denseHeaderPlain}>
                                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-zinc-400">Current Month</CardTitle>
                            </CardHeader>
                            <CardContent className={`${denseContent} overflow-hidden`}>
                                <div className="relative h-64 border-l border-b border-slate-200 flex items-end px-2 pt-4 dark:border-zinc-800">
                                    {/* Mock Chart Grid */}
                                    <div className="absolute left-0 right-0 top-0 bottom-0 grid grid-rows-7 h-full w-full pointer-events-none opacity-20">
                                        {yAxisValues.map(v => (
                                            <div key={v} className="border-t border-slate-400 relative dark:border-zinc-800">
                                                <span className="absolute -left-10 -top-2 text-[10px] text-slate-400 font-bold">{v}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Real data bars */}
                                    <div className="flex-1 flex justify-around items-end h-full z-10 px-4">
                                        {teamWorkItems.length > 0 ? teamWorkItems.map((item, i: number) => {
                                            const h = item.leads || 0;
                                            const maxH = yAxisValues[0] || 10;
                                            return (
                                                <div key={i} className="group relative flex flex-col items-center justify-end h-full">
                                                    <div
                                                        className="w-4 bg-indigo-400 rounded-t group-hover:bg-indigo-500 transition-all"
                                                        style={{ height: `${(h / maxH) * 100}%`, minHeight: '4px' }}
                                                    />
                                                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap rotate-45 origin-left text-[8px] font-bold text-slate-500 uppercase dark:text-zinc-400">{item.name}</div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-xs">No data for current month</div>
                                        )}
                                    </div>
                                    <div className="absolute -left-16 top-1/2 -rotate-90 text-xs font-bold text-slate-400 uppercase tracking-widest">Current Month Team Achievement</div>
                                </div>
                                <div className="h-16" /> {/* Spacing for rotated labels */}
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-100 dark:border-zinc-800">
                            <CardHeader className={denseHeaderPlain}>
                                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-zinc-400">Daily Team Meeting</CardTitle>
                            </CardHeader>
                            <CardContent className={denseContent}>
                                <div className="rounded-lg border border-slate-100 overflow-hidden dark:border-zinc-800">
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase dark:bg-zinc-900 dark:border-zinc-800">
                                                <th className="px-3 py-2 text-left">Person</th>
                                                <th className="px-3 py-2 text-center">Start</th>
                                                <th className="px-3 py-2 text-center">End</th>
                                                <th className="px-3 py-2 text-center">Total</th>
                                                <th className="px-3 py-2 text-right">Detail</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {loadingMeetings ? (
                                                <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>
                                            ) : (meetingsRes?.data?.items || []).length === 0 ? (
                                                <tr><td colSpan={5} className="p-4 text-center text-slate-400">No meetings today</td></tr>
                                            ) : (
                                                (meetingsRes?.data?.items || []).map(m => (
                                                    <tr key={m.id}>
                                                        <td className="px-3 py-2 font-bold text-slate-600 dark:text-zinc-300">{m.userName}</td>
                                                        <td className="px-3 py-2 text-center text-slate-500 dark:text-zinc-400">{m.startsAt ? new Date(m.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                                                        <td className="px-3 py-2 text-center text-slate-500 dark:text-zinc-400">{m.endsAt ? new Date(m.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}</td>
                                                        <td className="px-3 py-2 text-center text-slate-500 font-medium dark:text-zinc-400">{minutesLabel(m.totalMinutes ?? 0)}</td>
                                                        <td className="px-3 py-2 text-right">
                                                            <button onClick={() => setViewMeeting(m)} className="p-1 hover:bg-slate-100 rounded transition-colors dark:hover:bg-zinc-800">
                                                                <ChevronRight className="h-4 w-4 text-slate-400" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-100 dark:border-zinc-800">
                            <CardHeader className={denseHeaderPlain}>
                                <CardTitle className="text-lg font-semibold text-slate-700 dark:text-zinc-400">Quick Enteries</CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-5 pt-0">
                                <div className="grid grid-cols-2 gap-2">
                                    {quickEntries.map((entry, idx) => (
                                        <Link
                                            key={idx}
                                            href={entry.to}
                                            className="flex items-center justify-between rounded-sm bg-white border border-slate-100 px-3 py-2 hover:bg-slate-50 transition-colors group cursor-pointer dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                                        >
                                            <span className="text-[11px] font-bold text-slate-500 uppercase dark:text-zinc-400">{entry.label}</span>
                                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </div>

                <Card className="dashboard-card shadow-sm border-slate-100 mt-3 dark:border-zinc-800">
                    <CardHeader className="p-4 sm:px-6 sm:py-5 border-b border-slate-50 flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
                            <CardTitle className="text-lg font-semibold text-white bg-blue-600 px-2 py-0.5 rounded-[4px]">Follow Up Details</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center h-8 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                    <input type="date" value={followUpDateFrom} onChange={e => setFollowUpDateFrom(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 text-slate-600 dark:text-zinc-300 text-xs w-[110px]" />
                                </div>
                                <div className="flex items-center h-8 rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm transition-colors overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                    <input type="date" value={followUpDateTo} onChange={e => setFollowUpDateTo(e.target.value)} className="bg-transparent border-none outline-none focus:ring-0 text-slate-600 dark:text-zinc-300 text-xs w-[110px]" />
                                </div>
                                <Select value={followUpUser} onValueChange={setFollowUpUser}>
                                    <SelectTrigger className="w-[120px] h-8 text-xs border-slate-200 dark:border-zinc-800">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All Users">All Users</SelectItem>
                                        {assignedUsers.map((u: any) => (
                                            <SelectItem key={u.id} value={u.name || u.fullName}>{u.name || u.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <button className="h-8 px-4 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded shadow-sm transition-colors">
                                    Filter
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 w-full h-10 shadow-sm rounded-md overflow-hidden font-bold text-sm text-white">
                            <button onClick={() => { setFollowUpService("Alibaba Membership"); setActiveFollowSubtype("All"); setActiveFollowGrade("All"); }} className={`flex items-center justify-center transition-opacity hover:opacity-90 ${followUpService === "Alibaba Membership" ? "opacity-100" : "opacity-80"} bg-[#22c55e]`}>
                                Alibaba Membership
                            </button>
                            <button onClick={() => { setFollowUpService("Alibaba Services"); setActiveFollowSubtype("All"); setActiveFollowGrade("All"); }} className={`flex items-center justify-center transition-opacity hover:opacity-90 ${followUpService === "Alibaba Services" ? "opacity-100" : "opacity-80"} bg-[#f87171]`}>
                                Alibaba Services
                            </button>
                            <button onClick={() => { setFollowUpService("Design Development"); setActiveFollowSubtype("All"); setActiveFollowGrade("All"); }} className={`flex items-center justify-center transition-opacity hover:opacity-90 ${followUpService === "Design Development" ? "opacity-100" : "opacity-80"} bg-[#3b82f6]`}>
                                Design Development
                            </button>
                            <button onClick={() => { setFollowUpService("Domain Hosting"); setActiveFollowSubtype("All"); setActiveFollowGrade("All"); }} className={`flex items-center justify-center transition-opacity hover:opacity-90 ${followUpService === "Domain Hosting" ? "opacity-100" : "opacity-80"} bg-[#334155]`}>
                                Domain Hosting
                            </button>
                        </div>
                        
                        {/* Services Graph Removed per user request */}
                        <div className="flex flex-col md:flex-row gap-4 mt-4">
                            {/* Service Type Summary */}
                            {uniqueSubtypes.length > 0 && (
                                <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Service Type Summary</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {["All", ...uniqueSubtypes].map(sub => {
                                            const count = getSubtypeCount(sub);
                                            if (count === 0 && sub !== "All") return null;
                                            const isActive = activeFollowSubtype === sub;
                                            return (
                                                <span 
                                                    key={sub}
                                                    onClick={() => setActiveFollowSubtype(sub)}
                                                    className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#059669] text-white border border-[#059669]" : "bg-white border border-[#059669] text-[#059669] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"}`}
                                                >
                                                    {sub} ({count})
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Grade Summary */}
                            {uniqueGrades.length > 0 && (
                                <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Grade Summary</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {["All", ...uniqueGrades].map(grade => {
                                            const count = getGradeCount(grade);
                                            if (count === 0 && grade !== "All") return null;
                                            const isActive = activeFollowGrade === grade;
                                            return (
                                                <span 
                                                    key={grade}
                                                    onClick={() => setActiveFollowGrade(grade)}
                                                    className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#1e293b] text-white border border-[#1e293b]" : "bg-white border border-slate-300 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"}`}
                                                >
                                                    {grade} ({count})
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between mt-4 gap-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>Show</span>
                                <Select value={followUpPageSize.toString()} onValueChange={(val) => { setFollowUpPageSize(Number(val)); setFollowUpPage(1); }}>
                                    <SelectTrigger className="w-16 h-8 text-xs border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span>entries</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>Search:</span>
                                <Input value={followUpSearch} onChange={(e) => { setFollowUpSearch(e.target.value); setFollowUpPage(1); }} className="w-[200px] h-8 text-xs border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className={denseTableContent}>
                        <div className="rounded border border-slate-100 overflow-hidden dark:border-zinc-800">
                            <div className="max-h-[420px] overflow-y-auto">
                                <table className="w-full text-[11px] min-w-max">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-100 sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800 text-center">
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">#</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Created Date</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Sale Person</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Company</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Main Service</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Sub Type</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Grade</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Purpose</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Method</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Next Date</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Comment</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Followup Note</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">Manager Comment</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100 border-r border-slate-100 dark:border-zinc-800">SM Name</th>
                                            <th className="px-3 py-4 font-bold text-slate-800 dark:text-zinc-100">SM Comment</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loadingFollowups ? (
                                            <tr><td colSpan={15} className="px-4 py-8 text-center text-slate-400">Loading follow ups...</td></tr>
                                        ) : finalFilteredFollowUps.length === 0 ? (
                                            <tr><td colSpan={15} className="px-4 py-12 text-center text-slate-400 font-medium text-[12px]">No data available in table</td></tr>
                                        ) : (
                                            finalFilteredFollowUps.map((item, idx) => (
                                                <tr key={item.id} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 text-center">
                                                    <td className="px-3 py-3 text-slate-500 dark:text-zinc-400 border-r border-slate-100 dark:border-zinc-800">{(followUpPage - 1) * followUpPageSize + idx + 1}</td>
                                                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{new Date(item.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-3 py-3 text-slate-600 font-medium dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.salesPerson ?? "-"}</td>
                                                    <td className="px-3 py-3 font-semibold text-slate-700 dark:text-zinc-400 border-r border-slate-100 dark:border-zinc-800">{item.company ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.serviceType ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.subserviceName || item.serviceType || "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.grade ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.purpose ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.method ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.dateTime || item.dueAt ? new Date(item.dateTime || item.dueAt || "").toLocaleDateString() : "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 max-w-[150px] truncate dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">{item.notes ?? "-"}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">-</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">-</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300 border-r border-slate-100 dark:border-zinc-800">-</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-zinc-300">-</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                            <div>
                                Showing {(followUpPage - 1) * followUpPageSize + (followUpItems.length > 0 ? 1 : 0)} to {(followUpPage - 1) * followUpPageSize + followUpItems.length} of {followUpsRes?.data?.total || 0} entries
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFollowUpPage(p => Math.max(1, p - 1))}
                                    disabled={followUpPage === 1}
                                    className="px-4 py-1.5 border border-slate-200 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:hover:bg-zinc-800"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setFollowUpPage(p => p + 1)}
                                    disabled={(followUpPage * followUpPageSize) >= (followUpsRes?.data?.total || 0)}
                                    className="px-6 py-1.5 border border-slate-200 rounded-md text-[13px] font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-800 dark:hover:bg-zinc-800"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="dashboard-card shadow-sm border-slate-100 mt-3 dark:border-zinc-800">
                    <CardHeader className={denseHeaderPlain}>
                        <CardTitle className="text-lg font-semibold text-slate-700 dark:text-zinc-400">Team Work Performance</CardTitle>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex border border-slate-200 rounded-md overflow-hidden bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                <input type="text" placeholder="Start Date" className="px-3 py-1 text-xs outline-none border-r border-slate-200 w-32 dark:border-zinc-800" />
                                <input type="text" placeholder="End Date" className="px-3 py-1 text-xs outline-none w-32" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className={denseTableContent}>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {["All Team", ...teamWorkItems.map(it => it.name.toUpperCase())].map((name) => (
                                <button
                                    key={name}
                                    onClick={() => setSelectedUser(name)}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm",
                                        selectedUser === name
                                            ? "bg-black/80 text-white shadow-slate-100"
                                            : "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:bg-zinc-900"
                                    )}
                                >
                                    {name.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        <div className="rounded-lg border border-slate-100 overflow-hidden dark:border-zinc-800">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Name</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Leads</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Follow</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Not Follow</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">A- Customer</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">B+ Customer</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">B Csutomer</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">B- Csutomer</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Call Connected</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Not Response</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Appointment</th>
                                        <th className="px-4 py-3 text-left font-bold text-slate-800 dark:text-zinc-100">Meeting</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loadingTeamWork ? (
                                        <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                                    ) : (
                                        teamWorkItems
                                            .filter(it => selectedUser === "All Team" || it.name.toUpperCase() === selectedUser)
                                            .map((item) => (
                                                <tr key={item.userId} className="hover:bg-white transition-colors dark:hover:bg-zinc-800">
                                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-zinc-400">{item.name}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.leads}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.follow}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.notFollow}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.aMinusCustomer}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.bPlusCustomer}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.bCustomer}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.bMinusCustomer}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.callConnected}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.notResponse}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.appointment}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{item.meeting}</td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

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

            <Dialog open={!!viewMeeting} onOpenChange={(open) => !open && setViewMeeting(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Meeting Details</DialogTitle>
                    </DialogHeader>
                    {viewMeeting && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-muted-foreground">Person</p>
                                    <p className="font-medium text-slate-700 dark:text-zinc-300">{viewMeeting.userName || "-"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Duration</p>
                                    <p className="font-medium text-slate-700 dark:text-zinc-300">{minutesLabel(viewMeeting.totalMinutes ?? 0)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Start</p>
                                    <p className="font-medium text-slate-700 dark:text-zinc-300">{viewMeeting.startsAt ? new Date(viewMeeting.startsAt).toLocaleString() : "-"}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">End</p>
                                    <p className="font-medium text-slate-700 dark:text-zinc-300">{viewMeeting.endsAt ? new Date(viewMeeting.endsAt).toLocaleString() : "-"}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Notes / Comments</p>
                                <p className="font-medium whitespace-pre-wrap text-slate-700 dark:text-zinc-300">{viewMeeting.notes || "-"}</p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={meetingCommentModalOpen} onOpenChange={setMeetingCommentModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complete Meeting</DialogTitle>
                        <DialogDescription>Please provide a comment for the completed meeting.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Comment</label>
                            <Input
                                value={meetingComment}
                                onChange={(e) => setMeetingComment(e.target.value)}
                                placeholder="Meeting outcomes, notes..."
                                className="w-full"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setMeetingCommentModalOpen(false)}
                            className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (currentMeetingUser) {
                                    endMeetingMutation.mutate({ userId: currentMeetingUser, comment: meetingComment });
                                }
                                setMeetingCommentModalOpen(false);
                            }}
                            disabled={endMeetingMutation.isPending}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                            Complete Meeting
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
