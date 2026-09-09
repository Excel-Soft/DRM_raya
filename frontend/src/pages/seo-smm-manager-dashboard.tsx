import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ChevronRight,
    CheckCircle2,
    TrendingUp,
    ShieldCheck,
    MoreHorizontal,
    Calendar,
    List,
    Clock,
    ArrowRight,
    FileText,
    Users,
    CheckSquare,
    Settings,
    ClipboardList,
    BarChart3,
    Briefcase,
    DollarSign,
    AlertCircle,
    Target,
    Building2,
    ArrowLeftRight,
    ChevronLeft,
    Activity,
    Rocket,
    Globe,
    Zap,
    PieChart,
    Filter,
    Loader2
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────
type Project = {
    id: string;
    name: string;
    description?: string;
    status: "Active" | "OnHold" | "Completed";
    workSpace?: string;
    companyName?: string;
    startDate?: string;
    endDate?: string;
    taskStats: {
        total: number;
        toDo: number;
        inProgress: number;
        blocked: number;
        completed: number;
    };
};

type TabType = "waiting" | "delay" | "approved";

// ── Shared Constants ────────────────────────────────────────────────────────
const QUICK_SHORTS = [
    { label: "Pms Setting", icon: Settings, href: "/drm/pms-setting", color: "blue" },
    { label: "Task Create", icon: CheckSquare, href: "/pms/tasks", color: "indigo" },
    { label: "Running Project", icon: Zap, href: "/pms/running-projects", color: "teal" },
    { label: "Pending Project", icon: Clock, href: "/pms/approvals", color: "amber" },
    { label: "Today Post", icon: FileText, href: "/drm/today-post", color: "purple", highlight: true },
    { label: "All Social Accounts", icon: Globe, href: "/drm/all-social-accounts", color: "sky" },
    { label: "Overall Report", icon: BarChart3, href: "/drm/overall-report", color: "emerald" },
    { label: "Add Penalty", icon: AlertCircle, href: "/drm/add-penalty", color: "rose" },
];

// Normalizes the various API response shapes (raw array vs { data: [...] }) into a plain array.
function normalizeList(raw: any): any[] {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
}

// Formats an ISO timestamp into a short relative "time ago" string for feed items.
function timeAgo(dateString?: string | null): string {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
}

const NOTIFICATION_ICON: Record<string, { icon: typeof Activity; color: string }> = {
    SUCCESS: { icon: CheckCircle2, color: "text-emerald-500" },
    WARNING: { icon: AlertCircle, color: "text-amber-500" },
    ERROR: { icon: AlertCircle, color: "text-rose-500" },
    INFO: { icon: Activity, color: "text-blue-500" },
};

const STATUS_TRACKER_PAGE_SIZE = 10;

export default function SeoSmmManagerDashboard() {
    const [activeTab, setActiveTab] = useState<TabType>("waiting");
    const [statusTrackerPage, setStatusTrackerPage] = useState(1);
    const [activityPeriod, setActivityPeriod] = useState("TD");
    const [dailyReportPeriod, setDailyReportPeriod] = useState<string>("today");
    const [moveTaskModalOpen, setMoveTaskModalOpen] = useState(false);
    const [dailyReportMoveModalOpen, setDailyReportMoveModalOpen] = useState(false);
    const [selectedVerificationProject, setSelectedVerificationProject] = useState<any>(null);
    const [verificationModalOpen, setVerificationModalOpen] = useState(false);

    // ── Queries ──────────────────────────────────────────────────────────────
    const { data: projects = [] } = useQuery<Project[]>({
        queryKey: ["/api/pms/projects?withStats=true"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/projects?withStats=true");
            return res.json();
        }
    });

    const { data: hodImportantStats } = useQuery({
        queryKey: ["/api/hod/dashboard/important-stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/dashboard/important-stats");
            return res.json();
        }
    });

    // Live Feed — reuses the same notifications mechanism the rest of the app already
    // relies on for real activity events (approvals, verifications, task actions, etc.)
    const { data: notificationsRes, isLoading: notificationsLoading } = useQuery({
        queryKey: ["/api/notifications"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/notifications");
            return res.json();
        }
    });

    // Daily Report — reuses the same real endpoint already powering the HOD & Product
    // Posting dashboards' Daily Report panels.
    const { data: dailyReportRes, isLoading: dailyReportLoading } = useQuery({
        queryKey: ["/api/hod/daily-report", dailyReportPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/daily-report?period=${dailyReportPeriod}`);
            return res.json();
        }
    });

    // Activities — reuses the same real endpoint already powering the Product Posting
    // dashboard's Activities panel, scoped to this manager's department via the backend.
    const { data: activitiesRes, isLoading: activitiesLoading } = useQuery({
        queryKey: ["/api/dashboard/activities", activityPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/dashboard/activities?period=${activityPeriod}`);
            return res.json();
        }
    });

    // ── Derived Data ─────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const h = hodImportantStats?.data || {};
        const inProgress = Number(h.inProgress || 0);
        const completed = Number(h.completed || 0);
        const delayed = Number(h.delayProjects || 0);
        // "Social Media Posts" has no backing table/endpoint anywhere in the codebase
        // (Today Post / All Social Accounts pages are themselves static mocks with no
        // API). Total managed projects is the closest real, already-fetched figure.
        const totalManaged = normalizeList(projects).length;
        return [
            { label: "Ongoing Tasks", value: inProgress.toString(), icon: Zap, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Total Managed Projects", value: totalManaged.toString(), icon: Globe, color: "text-purple-500", bg: "bg-purple-50" },
            { label: "Campaigns Finished", value: completed.toString(), icon: Rocket, color: "text-emerald-500", bg: "bg-emerald-50" },
            { label: "Critical Delays", value: delayed.toString(), icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-50" },
        ];
    }, [hodImportantStats, projects]);

    const liveFeed = useMemo(() => {
        const list = normalizeList(notificationsRes?.data ?? notificationsRes);
        return list.slice(0, 6).map((n: any) => {
            const meta = NOTIFICATION_ICON[String(n.type || "INFO").toUpperCase()] || NOTIFICATION_ICON.INFO;
            return {
                id: n.id,
                action: n.message || "Activity recorded",
                time: timeAgo(n.createdAt),
                icon: meta.icon,
                color: meta.color,
            };
        });
    }, [notificationsRes]);

    const dailyReportRows = useMemo(() => {
        if (!dailyReportRes?.success || !Array.isArray(dailyReportRes.data)) return [];
        return dailyReportRes.data.map((row: any) => ({
            id: row.id,
            name: row.name || "Unassigned",
            company: row.company || "N/A",
            project: row.project || "N/A",
            task: row.task || "—",
            status: row.status || "Pending",
            spent: row.spent || "0 mins",
        }));
    }, [dailyReportRes]);

    const activityRows = useMemo(() => {
        if (!activitiesRes?.success || !activitiesRes.data?.rows) return [];
        return activitiesRes.data.rows.flatMap((user: any) =>
            Object.entries(user.methods || {})
                .filter(([, val]: any) => (val?.done ?? 0) > 0)
                .map(([method, val]: any) => {
                    const percent = val.target > 0 ? Math.round((val.done / val.target) * 100) : 0;
                    return {
                        name: user.name,
                        method: method.charAt(0).toUpperCase() + method.slice(1),
                        done: val.done,
                        target: val.target,
                        percent,
                        time: user.totals?.timeMinutes ?? 0,
                    };
                })
        );
    }, [activitiesRes]);

    // Real task-status breakdown aggregated from each project's own taskStats
    // (already fetched above) — replaces a previous hardcoded 72% / SEO 45% /
    // SMM 35% / Content 20% mock that had no backing data source at all.
    const workDistribution = useMemo(() => {
        const safeProjects = normalizeList(projects);
        const totals = safeProjects.reduce((acc, p: any) => {
            const ts = p.taskStats || {};
            acc.total += Number(ts.total || 0);
            acc.toDo += Number(ts.toDo || 0);
            acc.inProgress += Number(ts.inProgress || 0);
            acc.blocked += Number(ts.blocked || 0);
            acc.completed += Number(ts.completed || 0);
            return acc;
        }, { total: 0, toDo: 0, inProgress: 0, blocked: 0, completed: 0 });
        const pct = (n: number) => (totals.total > 0 ? Math.round((n / totals.total) * 100) : 0);
        return {
            total: totals.total,
            completedPercent: pct(totals.completed),
            segments: [
                { label: "To Do", value: pct(totals.toDo), color: "bg-slate-400" },
                { label: "In Progress", value: pct(totals.inProgress), color: "bg-indigo-600" },
                { label: "Blocked", value: pct(totals.blocked), color: "bg-rose-500" },
                { label: "Completed", value: pct(totals.completed), color: "bg-emerald-600" },
            ],
        };
    }, [projects]);

    const dynamicTableData = useMemo(() => {
        const safeProjects = Array.isArray(projects) ? projects : (projects as any)?.data || [];
        
        const waiting = safeProjects.filter((p: any) => p.status === "Active").map((p: any, i: number) => ({
            no: `${i + 1}`,
            id: p.id.slice(0, 5),
            company: p.companyName || p.workSpace || "N/A",
            project: p.name,
            status: "In Progress",
            time: p.startDate ? new Date(p.startDate).toLocaleDateString() : "N/A",
        }));

        const delay = safeProjects.filter((p: any) => p.status === "OnHold").map((p: any, i: number) => ({
            no: `${i + 1}`,
            company: p.companyName || p.workSpace || "N/A",
            project: p.name,
            dep: "SEO/SMM",
            deadlines: p.endDate ? new Date(p.endDate).toLocaleDateString() : "Expired",
        }));

        const approved = safeProjects.filter((p: any) => p.status === "Completed").map((p: any, i: number) => ({
            no: `${i + 1}`,
            company: p.companyName || p.workSpace || "N/A",
            project: p.name,
            status: "Approved",
            time: p.endDate ? new Date(p.endDate).toLocaleDateString() : "N/A",
        }));

        return { waiting, delay, approved };
    }, [projects]);

    const currentTableRows = dynamicTableData[activeTab];
    const statusTrackerTotalPages = Math.max(1, Math.ceil(currentTableRows.length / STATUS_TRACKER_PAGE_SIZE));
    const currentStatusTrackerPage = Math.min(statusTrackerPage, statusTrackerTotalPages);
    const pagedTableRows = currentTableRows.slice(
        (currentStatusTrackerPage - 1) * STATUS_TRACKER_PAGE_SIZE,
        currentStatusTrackerPage * STATUS_TRACKER_PAGE_SIZE,
    );

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setStatusTrackerPage(1);
    };

    return (
        <div className="flex-1 bg-[#f0f2f5] min-h-screen overflow-y-auto dark:bg-zinc-950">
            {/* ── Header ── */}
            <div className="bg-white border-b sticky top-0 z-40 px-6 py-4 dark:bg-zinc-900">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-[1600px] mx-auto">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
                                SEO/SMM Command Center
                            </h1>
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100 transition-colors uppercase text-[10px] font-bold px-2 py-0">Manager</Badge>
                        </div>
                        <p className="text-sm text-slate-500 font-medium mt-0.5 dark:text-zinc-400">Strategy & Performance Overview</p>
                    </div>
                    <Breadcrumb
                        items={[
                            { label: "DASHBOARD" },
                            { label: "MANAGER" },
                            { label: "SEO/SMM" }
                        ]}
                    />
                </div>
            </div>

            <div className="p-6 space-y-8 max-w-[1600px] mx-auto pb-20">
                {/* ── Stats Row ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, i) => (
                        <Card key={i} className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 rounded-2xl overflow-hidden group">
                            <CardContent className="p-6 relative">
                                <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-5 group-hover:scale-110 transition-transform duration-500", stat.bg)}></div>
                                <div className="flex items-start justify-between">
                                    <div className={cn("p-3 rounded-xl", stat.bg)}>
                                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full text-emerald-600 bg-emerald-50 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Live
                                    </span>
                                </div>
                                <div className="mt-4">
                                    <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">{stat.label}</p>
                                    <h3 className="text-3xl font-black text-slate-900 mt-1 dark:text-zinc-100">{stat.value}</h3>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* ── Main Panel (Left) ── */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Status Tracker */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b bg-slate-50/50 dark:bg-zinc-900">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">Department Status Tracker</CardTitle>
                                </div>
                                <div className="flex items-center gap-1 p-1 bg-white border rounded-xl shadow-sm dark:bg-zinc-900">
                                    {(["waiting", "delay", "approved"] as TabType[]).map((tab) => (
                                        <Button
                                            key={tab}
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "capitalize h-8 px-4 font-bold text-[11px] tracking-wide rounded-lg transition-all",
                                                activeTab === tab 
                                                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                            )}
                                            onClick={() => handleTabChange(tab)}
                                        >
                                            {tab === 'waiting' ? 'Pending' : tab === 'delay' ? 'Delayed' : 'Approved'}
                                        </Button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b">
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Company</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Project Strategy</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentTableRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <Filter className="w-12 h-12 mb-4 text-slate-300" />
                                                            <p className="font-bold text-slate-500 italic dark:text-zinc-400">No matching records found</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                pagedTableRows.map((row: any, idx: number) => (
                                                    <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs border border-white group-hover:border-indigo-100 transition-colors dark:text-zinc-400 dark:bg-zinc-900">
                                                                    #{row.no}
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-800 leading-none dark:text-zinc-100">{row.company}</p>
                                                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-medium">
                                                                        <Calendar className="w-3 h-3" /> {row.time}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5 text-center">
                                                            <span className="text-xs font-bold text-slate-600 bg-white border px-3 py-1 rounded-full shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
                                                                {row.project}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <Badge className={cn(
                                                                "rounded-md shadow-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5",
                                                                row.status === "Approved" || row.status === "Completed"
                                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                                    : "bg-amber-50 text-amber-600 border-amber-100"
                                                            )}>
                                                                {row.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-5 text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 rounded-lg hover:bg-indigo-600 hover:text-white border-slate-200 transition-all dark:border-zinc-800"
                                                            >
                                                                <ArrowRight className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t bg-slate-50/50 dark:bg-zinc-900">
                                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                                        {currentTableRows.length === 0
                                            ? "Showing 0 entries"
                                            : `Page ${currentStatusTrackerPage} of ${statusTrackerTotalPages} (${currentTableRows.length} total)`}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs px-3"
                                            disabled={currentStatusTrackerPage <= 1}
                                            onClick={() => setStatusTrackerPage((p) => Math.max(1, p - 1))}
                                        >
                                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs px-3"
                                            disabled={currentStatusTrackerPage >= statusTrackerTotalPages}
                                            onClick={() => setStatusTrackerPage((p) => Math.min(statusTrackerTotalPages, p + 1))}
                                        >
                                            Next <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary Visualization */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl bg-white overflow-hidden dark:bg-zinc-900">
                                <CardHeader className="p-6 pb-0">
                                    <CardTitle className="text-sm font-bold text-slate-600 flex items-center gap-2 dark:text-zinc-300">
                                        <PieChart className="w-4 h-4 text-indigo-500" />
                                        Work Distribution
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {workDistribution.total === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-6 opacity-40 text-center">
                                            <PieChart className="w-10 h-10 mb-3 text-slate-300" />
                                            <p className="font-bold text-slate-500 italic text-sm dark:text-zinc-400">No tasks logged against your projects yet</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-8">
                                            <div className="relative w-32 h-32 flex items-center justify-center">
                                                 <svg className="w-full h-full transform -rotate-90">
                                                    <circle cx="64" cy="64" r="54" className="stroke-slate-100 fill-none" strokeWidth="12" />
                                                    <circle
                                                        cx="64" cy="64" r="54"
                                                        className="stroke-emerald-600 fill-none"
                                                        strokeWidth="12"
                                                        strokeDasharray={2 * Math.PI * 54}
                                                        strokeDashoffset={2 * Math.PI * 54 * (1 - workDistribution.completedPercent / 100)}
                                                    />
                                                 </svg>
                                                 <div className="absolute inset-0 flex flex-col items-center justify-center mt-1">
                                                    <span className="text-2xl font-black text-slate-800 leading-none dark:text-zinc-100">{workDistribution.completedPercent}%</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Completed</span>
                                                 </div>
                                            </div>
                                            <div className="space-y-3 flex-1">
                                                {workDistribution.segments.map((item, i) => (
                                                    <div key={i} className="space-y-1">
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight dark:text-zinc-400">
                                                            <span>{item.label}</span>
                                                            <span>{item.value}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                                            <div className={cn("h-full rounded-full transition-all duration-1000", item.color)} style={{ width: `${item.value}%` }}></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl bg-gradient-to-br from-indigo-700 to-purple-800 text-white overflow-hidden relative">
                                <CardContent className="p-6 flex flex-col items-center justify-center min-h-[160px] text-center">
                                    <div className="p-3 bg-white rounded-2xl mb-4 backdrop-blur-md dark:bg-zinc-900">
                                        <Rocket className="w-8 h-8 text-white animate-pulse" />
                                    </div>
                                    <h3 className="text-xl font-black mb-1">Scale Your Reach</h3>
                                    <p className="text-indigo-100 text-xs px-6 font-medium leading-relaxed">Boost your department's analytics directly from the command center.</p>
                                    <Button className="mt-6 bg-white text-indigo-700 hover:bg-slate-100 font-black text-xs px-8 h-10 rounded-xl shadow-lg border-none dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                        View Data Insights
                                    </Button>
                                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl dark:bg-zinc-900"></div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Daily Report */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b bg-slate-50/50 dark:bg-zinc-900">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-100">
                                        <ClipboardList className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">Daily Report</CardTitle>
                                </div>
                                <Select value={dailyReportPeriod} onValueChange={setDailyReportPeriod}>
                                    <SelectTrigger className="w-36 h-9 text-xs font-bold border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="yesterday">Yesterday</SelectItem>
                                        <SelectItem value="weekly">This Week</SelectItem>
                                        <SelectItem value="monthly">This Month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b">
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Member</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Task</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Time Spent</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {dailyReportLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-16 text-center">
                                                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-400" />
                                                    </td>
                                                </tr>
                                            ) : dailyReportRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-16 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <ClipboardList className="w-10 h-10 mb-3 text-slate-300" />
                                                            <p className="font-bold text-slate-500 italic dark:text-zinc-400">No activity recorded for this period</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                dailyReportRows.slice(0, 8).map((row: any, idx: number) => (
                                                    <tr key={row.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="text-sm font-bold text-slate-800 dark:text-zinc-100">{row.name}</p>
                                                            <p className="text-[11px] text-slate-400 font-medium">{row.company}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-zinc-300">{row.project}</td>
                                                        <td className="px-6 py-4 text-xs text-slate-500 dark:text-zinc-400">{row.task}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <Badge className={cn(
                                                                "rounded-md shadow-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5",
                                                                row.status.toLowerCase().includes("complet") || row.status.toLowerCase().includes("approv")
                                                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                                    : "bg-amber-50 text-amber-600 border-amber-100"
                                                            )}>
                                                                {row.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-600 dark:text-zinc-300">{row.spent}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Activities */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
                            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b bg-slate-50/50 dark:bg-zinc-900">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100">
                                        <BarChart3 className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">Team Activities</CardTitle>
                                </div>
                                <Select value={activityPeriod} onValueChange={setActivityPeriod}>
                                    <SelectTrigger className="w-32 h-9 text-xs font-bold border-slate-200 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TD">Today</SelectItem>
                                        <SelectItem value="WC">This Week</SelectItem>
                                        <SelectItem value="MC">This Month</SelectItem>
                                    </SelectContent>
                                </Select>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b">
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Member</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Time Logged</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {activitiesLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-16 text-center">
                                                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-400" />
                                                    </td>
                                                </tr>
                                            ) : activityRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-16 text-center">
                                                        <div className="flex flex-col items-center justify-center opacity-40">
                                                            <BarChart3 className="w-10 h-10 mb-3 text-slate-300" />
                                                            <p className="font-bold text-slate-500 italic dark:text-zinc-400">No activity recorded for this period</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                activityRows.map((row: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-zinc-100">{row.name}</td>
                                                        <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-zinc-300">{row.method}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, row.percent)}%` }}></div>
                                                                </div>
                                                                <span className="text-[11px] font-bold text-slate-500">{row.done}/{row.target}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-600 dark:text-zinc-300">{row.time} mins</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Sidebar (Right) ── */}
                    <div className="lg:col-span-4 space-y-8">
                        {/* Quick Shortcuts */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl bg-white dark:bg-zinc-900">
                            <CardHeader className="p-6 pb-2">
                                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2 dark:text-zinc-100">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    Department Shortcuts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="grid grid-cols-2 gap-3">
                                    {QUICK_SHORTS.map((item, i) => (
                                        <Link key={i} href={item.href}>
                                            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50/80 border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-md transition-all group cursor-pointer text-center aspect-square dark:hover:bg-zinc-800">
                                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-inner group-hover:scale-110 transition-transform bg-white dark:bg-zinc-900 border border-slate-100 dark:border-slate-700")}>
                                                    <item.icon className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <span className="text-[10px] font-black text-slate-600 leading-tight uppercase tracking-tight dark:text-zinc-300">{item.label}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activity Mini-Feed */}
                        <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl bg-white overflow-hidden dark:bg-zinc-900">
                            <CardHeader className="p-6 pb-2 border-b">
                                <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2 dark:text-zinc-100">
                                    <History className="w-4 h-4 text-emerald-500" />
                                    Live Feed
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {notificationsLoading ? (
                                    <div className="p-8 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                                    </div>
                                ) : liveFeed.length === 0 ? (
                                    <div className="p-8 flex flex-col items-center justify-center opacity-40 text-center">
                                        <History className="w-8 h-8 mb-2 text-slate-300" />
                                        <p className="text-xs font-bold text-slate-500 italic dark:text-zinc-400">No recent activity</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {liveFeed.map((feed) => (
                                            <div key={feed.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 dark:bg-zinc-900">
                                                    <feed.icon className={cn("w-4 h-4", feed.color)} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] text-slate-700 font-semibold leading-snug dark:text-zinc-300 line-clamp-2">{feed.action}</p>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-bold shrink-0">{feed.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="p-3 bg-slate-50 text-center dark:bg-zinc-900">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                                        {normalizeList(notificationsRes?.data ?? notificationsRes).length} total notifications
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

const History = ({ className }: { className?: string }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 1 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
    </svg>
);
