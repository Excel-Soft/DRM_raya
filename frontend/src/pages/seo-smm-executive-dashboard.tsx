import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ChevronRight, ClipboardList, Clock, Activity, CheckCircle2, ExternalLink,
    Play, CheckSquare, Timer, Calendar, UserCheck, ListTodo, FileText, SendHorizonal,
} from "lucide-react";

// This dashboard reuses the same generic "employee productivity" endpoints
// that dd-executive-dashboard.tsx / software-executive-dashboard.tsx already
// consume — role-gating in dd-executive-routes.ts falls back to a plain
// assigned_to_user_id = userId scope for any role it doesn't special-case
// (the same way software_executive already piggybacks on these endpoints),
// so seo_smm_executive works against them with zero backend changes.
const ACTIVITY_METHOD_LABELS: Array<{ key: string; label: string }> = [
    { key: "mobile", label: "Mobile" },
    { key: "whatsapp", label: "Whatsapp" },
    { key: "onsite", label: "On-Site Visit" },
    { key: "email", label: "E-mail" },
    { key: "seminar", label: "Seminar" },
    { key: "appointment", label: "Appointment" },
    { key: "meeting", label: "Meeting" },
];

interface Promotion {
    id: string;
    bannerUrl: string | null;
    title?: string | null;
}

export default function SeoSmmExecutiveDashboard() {
    const [, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState("today");
    const [topSellingFilter, setTopSellingFilter] = useState("LD");
    const [activitiesFilter, setActivitiesFilter] = useState("TD");
    const [dailyReportFilter, setDailyReportFilter] = useState("daily");
    const [monthlyCompleteFilter, setMonthlyCompleteFilter] = useState("WK");
    const [bannerIndex, setBannerIndex] = useState(0);

    const { data: summaryStats } = useQuery({
        queryKey: ["/api/dd-executive/summary", topSellingFilter],
        queryFn: async () => apiRequestJson("GET", `/api/dd-executive/summary?period=${topSellingFilter}`),
    });
    const { data: activityPlanData } = useQuery({
        queryKey: ["/api/dashboard/activities", activitiesFilter],
        queryFn: async () => apiRequestJson("GET", `/api/dashboard/activities?period=${activitiesFilter}`),
    });
    const myActivityRow = (activityPlanData as any)?.data?.rows?.[0] ?? null;

    const { data: dbTaskListData } = useQuery({ queryKey: [`/api/dd-executive/tasks/${activeTab}`] });
    const taskListData = Array.isArray(dbTaskListData) ? dbTaskListData : [];

    const { data: dailyReportData } = useQuery({
        queryKey: ["/api/dd-executive/daily-report", dailyReportFilter],
        queryFn: async () => apiRequestJson("GET", `/api/dd-executive/daily-report?period=${dailyReportFilter}`),
    });
    const { data: monthlyCompleteData } = useQuery({
        queryKey: ["/api/dd-executive/monthly-complete", monthlyCompleteFilter],
        queryFn: async () => apiRequestJson("GET", `/api/dd-executive/monthly-complete?period=${monthlyCompleteFilter}`),
    });

    const { data: promotionsRes } = useQuery<{ data: Promotion[] }>({
        queryKey: ["/api/drm/promotions", "banner"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/promotions?scope=banner");
            if (!res.ok) return { data: [] };
            return res.json();
        },
    });
    const promotions: Promotion[] = promotionsRes?.data ?? [];
    const activeBanner = promotions[bannerIndex % Math.max(promotions.length, 1)];

    // Real portfolio-design catalogue (the same data /portfolio-view lists) —
    // the "Portfolio"/"Add Portfolio" Important tiles now link there instead
    // of the customer-pool pages, so their counts come from here too rather
    // than the unrelated customer-count value dd-executive's summary returns.
    const { data: portfolioList } = useQuery<any[]>({
        queryKey: ["/api/portfolio"],
        queryFn: async () => apiRequestJson("GET", "/api/portfolio"),
    });
    const portfolios = Array.isArray(portfolioList) ? portfolioList : [];
    const portfolioAddedToday = portfolios.filter((p) => {
        const created = p?.createdAt ? new Date(p.createdAt) : null;
        if (!created || Number.isNaN(created.getTime())) return false;
        const now = new Date();
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created.getDate() === now.getDate();
    }).length;

    const stats = [
        { label: "Total Task", value: (summaryStats as any)?.totalTasks || 0, icon: ClipboardList },
        { label: "Pending", value: (summaryStats as any)?.pendingTasks || 0, icon: Clock },
        { label: "Running", value: (summaryStats as any)?.runningTasks || 0, icon: Activity },
        { label: "Complete", value: (summaryStats as any)?.completeTasks || 0, icon: CheckCircle2 },
    ];

    return (
        <div className="p-4 bg-slate-50/50 dark:bg-zinc-950 min-h-screen font-sans">
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                    <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase font-bold">SEO/SMM DEPARTMENT</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="text-slate-500 uppercase font-bold dark:text-zinc-400">SEO/SMM EXECUTIVE</span>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-6">
                {/* Top Selling (8 cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm dark:bg-zinc-900">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Top Selling</h2>
                            <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                                <SelectTrigger className="w-20 h-8 text-[12px] border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LD">LD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                    <SelectItem value="MH">MH</SelectItem>
                                    <SelectItem value="QU">QU</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.map((stat, i) => (
                                <div key={i} className="bg-slate-50/50 dark:bg-zinc-900 p-4 rounded-xl border border-slate-100 flex flex-col justify-between h-[120px] dark:border-zinc-800">
                                    <div className="flex justify-between items-start w-full">
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-400 tracking-wider">{stat.label}</p>
                                            <p className="text-[28px] font-bold text-slate-800 leading-tight mt-1 dark:text-zinc-100">{stat.value}</p>
                                        </div>
                                        <stat.icon className={cn("h-5 w-5", stat.label === "Pending" ? "text-orange-400" : "text-slate-300")} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Promotion Banners (4 cols) — real carousel, mirrors it-executive-dashboard.tsx */}
                <div className="col-span-12 lg:col-span-4">
                    <h2 className="text-[16px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Promotion Baners</h2>
                    {activeBanner?.bannerUrl ? (
                        <Card className="overflow-hidden border-none shadow-sm rounded-xl relative h-[120px] group">
                            <img src={activeBanner.bannerUrl} alt="Promotion Banner" className="w-full h-full object-cover" />
                            {promotions.length > 1 && (
                                <div className="absolute inset-0 flex items-center justify-between px-2 bg-gradient-to-t from-black/10 to-transparent">
                                    <button
                                        onClick={() => setBannerIndex((i) => (i - 1 + promotions.length) % promotions.length)}
                                        className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <ChevronRight className="rotate-180 h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setBannerIndex((i) => (i + 1) % promotions.length)}
                                        className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </Card>
                    ) : (
                        <Card className="border-none shadow-sm rounded-xl h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                            No active promotions
                        </Card>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Main Content (8 columns) */}
                <div className="col-span-12 lg:col-span-8 space-y-6">
                    {/* Assigned Project */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 dark:border-zinc-800">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Assigned Project</CardTitle>
                                <div className="flex items-center gap-0 bg-slate-100/50 p-1 rounded-lg">
                                    <button
                                        className={cn(
                                            "px-10 py-2 rounded-md text-[13px] font-bold transition-all",
                                            activeTab === "today" ? "bg-[#059669] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700",
                                        )}
                                        onClick={() => setActiveTab("today")}
                                    >
                                        Today
                                    </button>
                                    <button
                                        className={cn(
                                            "px-10 py-2 rounded-md text-[13px] font-bold transition-all",
                                            activeTab === "waiting" ? "bg-[#059669] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700",
                                        )}
                                        onClick={() => setActiveTab("waiting")}
                                    >
                                        Waiting
                                    </button>
                                </div>
                            </div>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 pl-6 dark:text-zinc-400">No#</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Project</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Status</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Time</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center pr-6 dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {taskListData.length > 0 ? (
                                        taskListData.map((task: any, idx: number) => (
                                            <TableRow key={task.id} className="hover:bg-slate-50 border-slate-50 group dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-4 pl-6 text-sm font-bold text-slate-400">{idx + 1}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-slate-700 dark:text-zinc-400">{task.company}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-slate-500 text-center dark:text-zinc-400">{task.project}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                                                        task.status === "Completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                        task.status === "InProgress" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                                        "bg-amber-50 text-amber-600 border border-amber-100",
                                                    )}>
                                                        {task.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-4 text-center text-sm font-bold text-emerald-600">{task.time}</TableCell>
                                                <TableCell className="py-4 pr-6 text-center">
                                                    <button
                                                        title="View in PMS Project Status"
                                                        onClick={() => {
                                                            const pid = task.projectId || task.id;
                                                            const url = pid ? `/pms/status?projectId=${pid}` : "/pms/status";
                                                            window.location.href = url;
                                                        }}
                                                        className="opacity-40 group-hover:opacity-100 transition-opacity hover:text-indigo-600"
                                                    >
                                                        <ExternalLink className="h-4 w-4 text-indigo-400" />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-20 text-slate-400 font-medium">No tasks found</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                    {/* Daily Report */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-2.5 px-6 border-b border-slate-50 flex flex-row items-center justify-between dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-800 tracking-tight dark:text-zinc-100">Daily Report</CardTitle>
                            <Select value={dailyReportFilter} onValueChange={setDailyReportFilter}>
                                <SelectTrigger className="w-36 h-7 text-[12px] font-extrabold border-slate-200 rounded-full dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="daily">Daily Report</SelectItem>
                                    <SelectItem value="weekly">Weekly Report</SelectItem>
                                    <SelectItem value="monthly">Monthly Report</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-4 px-6">
                            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 pl-4 uppercase dark:text-zinc-400">Name</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Company</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Project</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Free</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Task</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Status</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 uppercase text-center dark:text-zinc-400">Run</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-500 py-3.5 pr-4 uppercase text-right dark:text-zinc-400">Spent</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(dailyReportData as any[])?.length > 0 ? (
                                            (dailyReportData as any[]).map((row, idx) => (
                                                <ReportTableRow key={idx} name={row.name} company={row.company} project={row.project} status={row.status} spent={row.spent} dotColor="bg-yellow-400" />
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-10 text-slate-400">No recent activity</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Monthly Complete Project */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 flex flex-row items-center justify-between dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Monthly Complete Project</CardTitle>
                            <Select value={monthlyCompleteFilter} onValueChange={setMonthlyCompleteFilter}>
                                <SelectTrigger className="w-16 h-8 text-[12px] font-bold border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                    <SelectItem value="MO">MO</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 pl-6 uppercase dark:text-zinc-400">Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Project</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Free</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Task</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Status</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 uppercase dark:text-zinc-400">Run</TableHead>
                                        <TableHead className="text-[12px] font-bold text-slate-500 py-4 pr-6 uppercase dark:text-zinc-400">Spent</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(monthlyCompleteData as any[])?.length > 0 ? (
                                        (monthlyCompleteData as any[]).map((row, idx) => (
                                            <ReportTableRow key={idx} name={row.name} company={row.company} project={row.project} status={row.status} spent={row.spent} dotColor="bg-emerald-400" />
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-20 text-slate-400 font-medium">No completed projects this month</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>

                {/* Sidebar (4 columns) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Activities */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 flex flex-row items-center justify-between dark:border-zinc-800">
                            <CardTitle className="text-[16px] font-bold text-slate-700 tracking-tight dark:text-zinc-400">Activities</CardTitle>
                            <Select value={activitiesFilter} onValueChange={setActivitiesFilter}>
                                <SelectTrigger className="w-16 h-8 text-[12px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-4 px-5 pb-5">
                            <div className="grid grid-cols-3 gap-2 pb-2 text-[11px] font-bold text-slate-500 dark:text-zinc-500">
                                <div>Method</div>
                                <div className="text-center">Target</div>
                                <div className="text-center">Time</div>
                            </div>
                            <div className="space-y-1.5">
                                {ACTIVITY_METHOD_LABELS.map(({ key, label }) => {
                                    const m = myActivityRow?.methods?.[key];
                                    return (
                                        <div key={key} className="grid grid-cols-3 gap-2 text-[12px] items-center border-b border-slate-50 pb-1.5 last:border-0 dark:border-zinc-800">
                                            <div className="text-slate-700 dark:text-zinc-400">{label}</div>
                                            <div className="text-center bg-slate-50 rounded px-2 py-1 text-slate-700 dark:bg-zinc-900 dark:text-zinc-400">{m?.target ?? 0} ({m?.done ?? 0})</div>
                                            <div className="text-center text-slate-500 dark:text-zinc-500">—</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="pt-3 text-center text-[12px] text-slate-600 dark:text-zinc-400">
                                Talk Time ({myActivityRow?.totals?.timeMinutes ?? 0} M) · W-H 8 (480 M) · Spent ({myActivityRow?.totals?.timeMinutes ?? 0} M)
                            </div>
                        </CardContent>
                    </Card>

                    {/* Projects Overview */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 dark:border-zinc-800">
                            <CardTitle className="text-[16px] font-bold text-slate-700 tracking-tight dark:text-zinc-400">Projects Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 px-5 pb-6">
                            <div className="grid grid-cols-2 gap-3.5">
                                <OverviewItem
                                    label="Running Project"
                                    value={(summaryStats as any)?.runningProjects || 0}
                                    icon={Play}
                                    colorClass="text-emerald-600 dark:text-emerald-400"
                                    bgClass="bg-emerald-50/60 dark:bg-emerald-950/40"
                                    onClick={() => setLocation("/pms/running-projects")}
                                />
                                <OverviewItem
                                    label="Pending Project"
                                    value={(summaryStats as any)?.pendingTasks || 0}
                                    icon={Clock}
                                    colorClass="text-amber-600 dark:text-amber-400"
                                    bgClass="bg-amber-50/60 dark:bg-amber-950/40"
                                    onClick={() => setLocation("/pms/approvals")}
                                />
                                <OverviewItem
                                    label="Project Task"
                                    value={(summaryStats as any)?.totalTasks || 0}
                                    icon={CheckSquare}
                                    colorClass="text-blue-600 dark:text-blue-400"
                                    bgClass="bg-blue-50/60 dark:bg-blue-950/40"
                                    onClick={() => setLocation("/pms/tasks")}
                                />
                                <OverviewItem
                                    label="Over Time"
                                    value={(summaryStats as any)?.overTimeTasks || 0}
                                    icon={Timer}
                                    colorClass="text-rose-600 dark:text-rose-400"
                                    bgClass="bg-rose-50/60 dark:bg-rose-950/40"
                                    onClick={() => setLocation("/hr/overtime")}
                                />
                                <OverviewItem
                                    label="Leave Application"
                                    value={(summaryStats as any)?.pendingLeaves || 0}
                                    icon={Calendar}
                                    colorClass="text-indigo-600 dark:text-indigo-400"
                                    bgClass="bg-indigo-50/60 dark:bg-indigo-950/40"
                                    onClick={() => setLocation("/hr/leave-request")}
                                />
                                <OverviewItem
                                    label="Attendance"
                                    value={(summaryStats as any)?.attendanceStatus || "Not Marked"}
                                    icon={UserCheck}
                                    colorClass="text-teal-600 dark:text-teal-400"
                                    bgClass="bg-teal-50/60 dark:bg-teal-950/40"
                                    onClick={() => setLocation("/hr/attendance")}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Important */}
                    <Card className="border-none shadow-sm rounded-xl bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 dark:border-zinc-800">
                            <CardTitle className="text-[16px] font-bold text-slate-700 tracking-tight dark:text-zinc-400">Important</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 px-5 space-y-3">
                            {/* Real Notice Board unread count, links to the real notice board
                                (not the unrelated customer-support ticket system this template's
                                "Notice" tile originally pointed to). */}
                            <ImportantRow label="Notice" value={(summaryStats as any)?.important?.notice?.toString() || "0"} onClick={() => setLocation("/notice-board")} />
                            {/* Real portfolio-design catalogue counts (see the /api/portfolio
                                query above) — not the customer-pool counts this template's
                                "Portfolio"/"Add Portfolio" tiles originally showed. */}
                            <ImportantRow label="Portfolio" value={String(portfolios.length)} isSubValue onClick={() => setLocation("/portfolio-view")} />
                            <ImportantRow label="Add Portfolio" value={String(portfolioAddedToday)} onClick={() => setLocation("/portfolio-add")} />
                            <ImportantRow label="Login Time" value={(summaryStats as any)?.important?.loginTime || "--:--"} isTime onClick={() => setLocation("/hr/attendance")} />
                            <div
                                onClick={() => setLocation("/hr/attendance/todo")}
                                className="flex items-center justify-between p-4 py-4.5 bg-slate-900 border border-slate-800 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 rounded-[22px] cursor-pointer group dark:border-zinc-800"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
                                        <ListTodo className="h-4 w-4" />
                                    </div>
                                    <span className="text-[15px] font-black text-white group-hover:translate-x-1 transition-transform">To Do List</span>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-white/40 group-hover:bg-white group-hover:text-white transition-all dark:bg-zinc-900">
                                    <ChevronRight className="h-4 w-4" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function OverviewItem({ label, value, icon: Icon, colorClass, bgClass, onClick }: { label: string; value: any; icon: any; colorClass: string; bgClass: string; onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-300 group cursor-pointer hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] active:scale-[0.98]",
                bgClass,
                "border-white/40 dark:border-zinc-700/50 backdrop-blur-sm",
            )}
        >
            <div className="flex items-center justify-between w-full">
                <span className={cn("text-[11px] font-black tracking-widest transition-colors leading-tight uppercase opacity-60", colorClass)}>
                    {label}
                </span>
                <Icon className={cn("h-4 w-4", colorClass)} />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-800 dark:text-zinc-100">
                {value}
            </span>
        </div>
    );
}

function ImportantRow({ label, value, isSubValue, isTime, onClick }: { label: string; value: string; isSubValue?: boolean; isTime?: boolean; onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            className="flex items-center justify-between p-3.5 py-4 bg-slate-50/80 hover:bg-white border border-transparent hover:border-slate-100 shadow-sm transition-all duration-300 rounded-2xl cursor-pointer group dark:bg-zinc-800/60 dark:hover:bg-zinc-800"
        >
            <span className="text-sm font-bold text-slate-500 tracking-tight group-hover:text-slate-800 transition-colors uppercase dark:text-zinc-400 dark:group-hover:text-zinc-100">{label}</span>
            <div className={cn(
                "px-3 py-1 rounded-full text-xs font-black shadow-sm transition-all group-hover:px-4",
                isSubValue ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400" :
                isTime ? "bg-slate-100 text-slate-800 dark:bg-zinc-900 dark:text-slate-200" :
                "bg-rose-50 text-rose-500 dark:bg-rose-950/50 dark:text-rose-400",
            )}>
                {value}
            </div>
        </div>
    );
}

// "Free"/"Task"/"Run" have no real per-row backing anywhere in the app (the
// dd-executive/software-executive templates this is adapted from hardcode
// literal "0"/"-" text in these same cells) — shown as a plain "—" instead of
// porting those fabricated placeholder values forward.
function ReportTableRow({ name, company, project, status, spent, dotColor }: { name: string; company: string; project?: string; status: string; spent: string; dotColor: string }) {
    return (
        <TableRow className="group hover:bg-slate-50/80 border-slate-50 dark:border-zinc-800">
            <TableCell className="py-3 pl-4">
                <div className="h-7 w-7 rounded-sm bg-[#fcd34d] flex items-center justify-center text-white text-[10px] font-black uppercase shadow-sm dark:bg-zinc-900">
                    {name}
                </div>
            </TableCell>
            <TableCell className="py-3 text-center">
                <div className="flex items-center gap-2 justify-center">
                    <div className={cn("h-2.5 w-2.5 rounded-full", dotColor)}></div>
                    <span className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">{company}</span>
                </div>
            </TableCell>
            <TableCell className="py-3 text-center">
                <div className="flex items-center gap-2 justify-center">
                    <FileText className="h-3.5 w-3.5 text-slate-300" />
                    <span className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">{project || "-"}</span>
                </div>
            </TableCell>
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">—</TableCell>
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">—</TableCell>
            <TableCell className="py-3 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#fef9c3] text-[#a16207] border border-[#fef08a] dark:border-zinc-800 dark:bg-zinc-900">
                    {status}
                </span>
            </TableCell>
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">—</TableCell>
            <TableCell className="py-3 pr-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <span className="text-[13px] font-black text-[#10b981] dark:text-zinc-100">{spent}</span>
                    <SendHorizonal className="h-3 w-3 text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity dark:text-zinc-100" />
                </div>
            </TableCell>
        </TableRow>
    );
}
