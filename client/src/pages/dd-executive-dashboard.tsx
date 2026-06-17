import { useState, useMemo } from "react";
import { isSupportModuleEnabled } from "@/lib/feature-flags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    Repeat,
    Tag,
    Target,
    ChevronRight,
    CheckCircle2,
    LayoutDashboard,
    Search,
    SendHorizonal,
    TrendingUp,
    TrendingDown,
    Wallet,
    CheckCircle,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    User,
    Building2,
    Briefcase,
    Activity,
    Minus,
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    ChevronsLeft,
    ChevronsRight,
    List,
    Settings,
    Play,
    ListTodo,
    PieChart as PieChartIcon,
    CheckSquare,
    Layers,
    UserRound,
    ClipboardList,
    FileText,
    BarChart2,
    CircleDollarSign,
    AlertCircle,
    FileBarChart2,
    ChevronDown,
    PlusCircle,
    PlayCircle,
    ShieldCheck,
    CalendarX,
    FolderCheck,
    Timer,
    Calendar,
    UserCheck,
    Loader2,
    Lock,
    GraduationCap,
    ExternalLink
} from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CheckCircle2 as CheckCircleIcon } from "lucide-react";

const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
};

export default function DDExecutiveDashboard() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const storedName = sessionStorage.getItem("userName") || "User";
    const storedEmail = sessionStorage.getItem("userEmail") || "user@example.com";
    const [activeTab, setActiveTab] = useState("today");
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [confirmSaveModalOpen, setConfirmSaveModalOpen] = useState(false);

    const [topSellingFilter, setTopSellingFilter] = useState("TD");
    const [dailyReportFilter, setDailyReportFilter] = useState("daily");
    const [monthlyCompleteFilter, setMonthlyCompleteFilter] = useState("MO");
    const [confirmAction, setConfirmAction] = useState<"task" | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [taskDetails, setTaskDetails] = useState({
        assigneeId: "",
        title: "",
        duration: "0",
        links: "",
        dueDate: "",
        detail: ""
    });

    // Fetch summary stats
    const { data: summaryStats } = useQuery({ queryKey: ["/api/dd-executive/summary", topSellingFilter], queryFn: async () => { const res = await fetch(`/api/dd-executive/summary?period=${topSellingFilter}`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); } });
    const { data: dbTaskListData } = useQuery({ queryKey: [`/api/dd-executive/tasks/${activeTab}`] });
    const { data: dailyReportData } = useQuery({ queryKey: ["/api/dd-executive/daily-report", dailyReportFilter], queryFn: async () => { const res = await fetch(`/api/dd-executive/daily-report?period=${dailyReportFilter}`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); } });
    const { data: monthlyCompleteData } = useQuery({ queryKey: ["/api/dd-executive/monthly-complete", monthlyCompleteFilter], queryFn: async () => { const res = await fetch(`/api/dd-executive/monthly-complete?period=${monthlyCompleteFilter}`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); } });

    // Stage 3: removed the localStorage 'software_tasks' merge. That key's only
    // writer (the team-workspace screen) was migrated to the backend, leaving this
    // an orphaned read. The executive task list is now sourced purely from
    // /api/dd-executive/tasks/:tab.
    const taskListData = useMemo(() => {
        return Array.isArray(dbTaskListData) ? dbTaskListData : [];
    }, [dbTaskListData]);

    const { data: usersData, error: usersError, isLoading: isLoadingUsers } = useQuery({ 
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            if (!res.ok) throw new Error(`Failed to fetch users: ${await res.text()}`);
            return res.json();
        },
        retry: 2
    });

    const createTaskMutation = useMutation({
        mutationFn: async (newTask: typeof taskDetails) => {
            const res = await fetch("/api/pms/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: selectedTask?.projectId,
                    title: newTask.title,
                    description: newTask.detail,
                    assignedToUserId: newTask.assigneeId,
                    dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : new Date().toISOString(),
                    priority: "Medium",
                    category: "Work",
                    status: "ToDo",
                    notes: JSON.stringify({
                        duration: newTask.duration,
                        links: newTask.links
                    })
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.details || "Failed to create task");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/dd-executive/tasks/${activeTab}`] });
            queryClient.invalidateQueries({ queryKey: ["/api/dd-executive/summary"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dd-executive/daily-report"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/department-status"] });
            toast({ title: "Task created successfully" });
            setIsCreateTaskModalOpen(false);
            setConfirmSaveModalOpen(false);
            setShowConfirm(false);
            setTaskDetails({
                assigneeId: "",
                title: "",
                duration: "0",
                links: "",
                dueDate: "",
                detail: ""
            });
        },
        onError: (error: any) => {
            toast({ 
                title: "Error", 
                description: error.message || "Failed to create task", 
                variant: "destructive" 
            });
        }
    });

    const stats = [
        { label: "Total Task", value: (summaryStats as any)?.totalTasks || 0, subValue: "0%", trend: "+0.0%", icon: ClipboardList },
        { label: "Pending", value: (summaryStats as any)?.pendingTasks || 0, subValue: "0", trend: "+0.0%", icon: Clock },
        { label: "Running", value: (summaryStats as any)?.runningTasks || 0, subValue: "0%", trend: "+0.0%", icon: Activity },
        { label: "Complete", value: (summaryStats as any)?.completeTasks || 0, subValue: "0", trend: "+0.0%", icon: CheckCircle2 },
    ];

    return (
        <div className="p-4 bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 min-h-screen font-sans selection:bg-emerald-100">
            {/* Breadcrumb Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                    <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase font-bold">D&D DEPARTMENT</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="text-slate-500 uppercase font-bold dark:text-zinc-400">D&D EXECUTIVE</span>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm mb-6 dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Top Selling</h2>
                    <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                        <SelectTrigger className="w-20 h-8 text-[12px] border-slate-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="TD">TD</SelectItem>
                            <SelectItem value="WK">WK</SelectItem>
                            <SelectItem value="MH">MH</SelectItem>
                            <SelectItem value="QU">QU</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {/* Top Row: Stats + Banner */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between h-[120px] dark:border-zinc-800">
                                <div className="flex justify-between items-start w-full">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 tracking-wider">{stat.label}</p>
                                        <p className="text-[28px] font-bold text-slate-800 leading-tight mt-1 dark:text-zinc-100">{stat.value}</p>
                                    </div>
                                    <div className="flex items-center gap-1 text-emerald-500 font-bold text-[13px]">
                                        <TrendingUp className="h-4 w-4" />
                                        <span>{stat.trend}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-auto">
                                    <stat.icon className={cn("h-4 w-4", stat.label === "Pending" ? "text-orange-400" : "text-slate-300")} />
                                    <span className={cn("text-[13px] font-semibold", stat.label === "Pending" ? "text-orange-400" : "text-slate-400")}>
                                        {stat.subValue} {stat.label === "Pending" ? "+0%" : stat.label === "Running" ? "0%" : ""}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="xl:col-span-4 h-[120px]">
                        <div className="relative w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-emerald-900 shadow-lg group">
                            {/* Background Overlay Decor */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-600 rounded-full blur-3xl -ml-16 -mb-16"></div>
                            </div>
                            
                            <div className="relative h-full flex flex-col justify-center px-8 z-10">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1 rounded bg-[#ffb700] text-slate-900 dark:bg-zinc-900 dark:text-zinc-100">
                                        <Target className="h-3 w-3 fill-current" />
                                    </div>
                                    <span className="text-[12px] font-black text-[#ffb700] uppercase tracking-widest">PREMIUM PARTNER</span>
                                </div>
                                <h3 className="text-[19px] font-black text-white leading-tight uppercase tracking-tight">
                                    WebExcels Elite Solutions
                                </h3>
                            </div>

                            {/* Chart/Graph placeholder in background */}
                            <div className="absolute right-0 bottom-0 opacity-30 transform translate-x-4 translate-y-4">
                                <BarChart2 className="h-24 w-24 text-emerald-400" />
                            </div>
                        </div>
                    </div>
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
                                            activeTab === 'today' ? "bg-[#059669] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                        )}
                                        onClick={() => setActiveTab('today')}
                                    >
                                        Today
                                    </button>
                                    <button
                                        className={cn(
                                            "px-10 py-2 rounded-md text-[13px] font-bold transition-all",
                                            activeTab === 'waiting' ? "bg-[#059669] text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                        )}
                                        onClick={() => setActiveTab('waiting')}
                                    >
                                        Waiting
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-400 italic">
                                    Space
                                </div>
                            </div>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 pl-6 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Project</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Task</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Status</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center dark:text-zinc-400">Action</TableHead>
                                        <TableHead className="text-xs font-bold text-slate-500 uppercase py-4 text-center pr-6 dark:text-zinc-400">Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(taskListData as any[])?.length > 0 ? (
                                        (taskListData as any[]).map((task) => (
                                            <TableRow key={task.id} className="hover:bg-slate-50 border-slate-50 group dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-4 pl-6 text-sm font-bold text-slate-700 dark:text-zinc-400">{task.company}</TableCell>
                                                <TableCell className="py-4 text-sm font-bold text-slate-500 dark:text-zinc-400">{task.project}</TableCell>
                                                <TableCell className="py-4 text-sm font-black text-slate-700 dark:text-zinc-400">{task.task}</TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase",
                                                        task.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                                        task.status === 'InProgress' ? "bg-blue-50 text-blue-600 border border-blue-100" :
                                                        "bg-amber-50 text-amber-600 border border-amber-100"
                                                    )}>
                                                        {task.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            title="View in PMS Project Status"
                                                            onClick={() => {
                                                                const pid = task.projectId || task.id;
                                                                const url = pid ? `/pms/status?projectId=${pid}` : '/pms/status';
                                                                window.location.href = url;
                                                            }}
                                                            className="opacity-40 group-hover:opacity-100 transition-opacity hover:text-indigo-600"
                                                        >
                                                            <ExternalLink className="h-4 w-4 text-indigo-400" />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-4 pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-2 text-emerald-600 font-bold">
                                                        <span className="text-sm">{task.time}</span>
                                                    </div>
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
                            <div className="flex items-center gap-2">
                                <CheckBoxIcon className="h-4.5 w-4.5 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500" />
                                <CardTitle className="text-[15px] font-bold text-slate-800 tracking-tight dark:text-zinc-100">Daily Report</CardTitle>
                            </div>
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
                        <CardContent className="p-4 px-6 space-y-4">
                            {/* Profile and Quick Stats Section */}
                            <div className="flex flex-col xl:flex-row items-center gap-4 xl:gap-8 border border-slate-100 rounded-2xl p-4 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex items-center gap-4 flex-1 w-full xl:w-auto">
                                    <div className="h-12 w-12 rounded-full bg-[#fcd34d] flex items-center justify-center text-white text-[16px] font-black uppercase shadow-sm dark:bg-zinc-900">
                                        {storedName.charAt(0)}
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[15px] font-black text-slate-800 dark:text-zinc-100">{storedName}</p>
                                        <p className="text-[12px] font-bold text-slate-400">Login Time: {(summaryStats as any)?.important?.loginTime || "--:--"}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
                                    <ReportStatCard label="Total Projects" value={(summaryStats as any)?.runningProjects?.toString() || "0"} color="bg-[#10b981]" />
                                    <ReportStatCard label="Total Tasks" value={(summaryStats as any)?.totalTasks?.toString() || "0"} color="bg-[#10b981]" icon={CheckCircle2} />
                                    <ReportStatCard label="Total Free" value="2" color="bg-[#10b981]" icon={Activity} />
                                </div>
                            </div>

                            {/* Divider Bar */}
                            <div className="h-1.5 w-full bg-[#10b981] rounded-full" />

                            {/* Summary Indicators */}
                            <div className="flex items-center gap-8 px-1">
                                <div className="flex items-center gap-2.5 text-[13px] font-bold text-slate-600 dark:text-zinc-300">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Total Spent: <span className="text-slate-400 font-bold ml-1">7 entries</span></span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[13px] font-bold text-slate-600 dark:text-zinc-300">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Total Free: <span className="text-slate-400 font-bold ml-1">2 tasks</span></span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
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
                                                <ReportTableRow 
                                                    key={idx}
                                                    name={row.name}
                                                    company={row.company} 
                                                    project={row.project}
                                                    status={row.status} 
                                                    spent={row.spent} 
                                                    dotColor="bg-yellow-400" 
                                                />
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
                                <TableHeader className="bg-slate-50/50">
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
                                            <ReportTableRow 
                                                key={idx}
                                                name={row.name}
                                                company={row.company} 
                                                project={row.project}
                                                status={row.status} 
                                                spent={row.spent} 
                                                dotColor="bg-emerald-400" 
                                            />
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
                            <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                                <SelectTrigger className="w-16 h-8 text-[12px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                    <SelectItem value="MH">MH</SelectItem>
                                    <SelectItem value="QU">QU</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="pt-6 px-6 pb-6 h-[250px]">
                            <div className="grid grid-cols-2 h-full items-center">
                                {/* Donut Chart */}
                                <div className="h-full relative flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie
                                                data={[
                                                    { name: "Complete", value: (summaryStats as any)?.completeTasks || 1 },
                                                    { name: "Pending", value: (summaryStats as any)?.pendingTasks || 0 },
                                                    { name: "Running", value: (summaryStats as any)?.runningTasks || 0 },
                                                    { name: "Free", value: 0 },
                                                ]}
                                                innerRadius={50}
                                                outerRadius={75}
                                                paddingAngle={0}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                <Cell fill="#15803d" />
                                                <Cell fill="#d97706" />
                                                <Cell fill="#86efac" />
                                                <Cell fill="#334155" />
                                            </Pie>
                                        </RePieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                                        <span className="text-[28px] font-bold text-slate-800 dark:text-zinc-100">
                                            {(summaryStats as any)?.totalTasks || 22}
                                        </span>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="space-y-3.5 pl-6">
                                    <ActivityLegendItem label="Total Task" value={(summaryStats as any)?.totalTasks || 22} color="bg-[#15803d]" />
                                    <ActivityLegendItem label="Complete" value={(summaryStats as any)?.completeTasks || 0} color="bg-[#d97706]" />
                                    <ActivityLegendItem label="Pending" value={(summaryStats as any)?.pendingTasks || 0} color="bg-[#86efac]" />
                                    <ActivityLegendItem label="Running" value={(summaryStats as any)?.runningTasks || 0} color="bg-[#334155]" />
                                </div>
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
                                    colorClass="text-emerald-600" 
                                    bgClass="bg-emerald-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/pms/running-projects")}
                                />
                                <OverviewItem 
                                    label="Pending Project" 
                                    value={(summaryStats as any)?.pendingTasks || 0}
                                    icon={Clock} 
                                    colorClass="text-amber-600" 
                                    bgClass="bg-amber-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/pms/approvals")}
                                />
                                <OverviewItem 
                                    label="Project Task" 
                                    value={(summaryStats as any)?.totalTasks || 0}
                                    icon={CheckSquare} 
                                    colorClass="text-blue-600" 
                                    bgClass="bg-blue-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/pms/tasks")}
                                />
                                <OverviewItem 
                                    label="Over Time" 
                                    value={(summaryStats as any)?.overTimeTasks || 0}
                                    icon={Timer} 
                                    colorClass="text-rose-600" 
                                    bgClass="bg-rose-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/hr/overtime")}
                                />
                                <OverviewItem 
                                    label="Leave Application" 
                                    value={(summaryStats as any)?.pendingLeaves || 0}
                                    icon={Calendar} 
                                    colorClass="text-indigo-600" 
                                    bgClass="bg-indigo-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/hr/leave-request")}
                                />
                                <OverviewItem 
                                    label="Attendance" 
                                    value={(summaryStats as any)?.attendanceStatus || "Not Marked"}
                                    icon={UserCheck} 
                                    colorClass="text-teal-600" 
                                    bgClass="bg-teal-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/hr/attendance")}
                                />
                                <OverviewItem 
                                    label="Customer" 
                                    value="View"
                                    icon={Users} 
                                    colorClass="text-blue-600" 
                                    bgClass="bg-blue-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/sales/customers")}
                                />
                                <OverviewItem 
                                    label="Lead" 
                                    value="View"
                                    icon={Layers} 
                                    colorClass="text-emerald-600" 
                                    bgClass="bg-emerald-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/sales/lead-pools")}
                                />
                                <OverviewItem 
                                    label="Training" 
                                    value="Open"
                                    icon={GraduationCap} 
                                    colorClass="text-amber-600" 
                                    bgClass="bg-amber-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/training")}
                                />
                                <OverviewItem 
                                    label="Project Report" 
                                    value="View"
                                    icon={FileText} 
                                    colorClass="text-slate-600 dark:text-slate-300" 
                                    bgClass="bg-slate-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/reports")}
                                />
                                <OverviewItem 
                                    label="Pms Setting" 
                                    value="Open"
                                    icon={Settings} 
                                    colorClass="text-indigo-600" 
                                    bgClass="bg-indigo-50/60" 
                                    iconColorClass="bg-white dark:bg-zinc-900/90"
                                    onClick={() => setLocation("/drm/pms-setting")}
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
                            {isSupportModuleEnabled() && (
                            <ImportantRow label="Notice" value={(summaryStats as any)?.important?.notice?.toString() || "0"} onClick={() => setLocation("/support/tickets")} />
                            )}
                            <ImportantRow label="Portfolio" value={(summaryStats as any)?.important?.portfolio || "0(0)"} isSubValue onClick={() => setLocation("/sales/customers")} />
                            <ImportantRow label="Add Portfolio" value={(summaryStats as any)?.important?.addPortfolio?.toString() || "0"} onClick={() => setLocation("/sales/add-customer")} />
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

            <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                <DialogContent className="max-w-2xl bg-white shadow-2xl border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-zinc-100">
                            <ClipboardList className="h-5 w-5 text-emerald-500" />
                            {selectedTask?.task}
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                            Task details and requirements
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-4 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Company</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-400">{selectedTask?.company}</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Project</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-400">{selectedTask?.project}</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Due Date</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-400">{selectedTask?.dueDate}</span>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Status</span>
                                <span className="text-sm font-bold text-amber-600">{selectedTask?.status}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2 px-1">Description / Requirement</span>
                            <div className="p-3 bg-white rounded-lg border border-slate-100 min-h-[100px] dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto dark:text-zinc-400">
                                    {selectedTask?.description || "No specific instructions provided."}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateTaskModalOpen} onOpenChange={setIsCreateTaskModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/30">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-[20px] font-bold text-gray-700 dark:text-zinc-400">Create New Task</DialogTitle>
                            <span className="text-[14px] font-bold text-emerald-500">{new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                    </div>
                    <div className="p-8 space-y-6">
                        {!showConfirm ? (
                            <>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Company</label>
                                        <Input
                                            readOnly
                                            value={selectedTask?.company || ""}
                                            className="bg-slate-50 border-gray-200 text-gray-600 h-10 text-[13px] pointer-events-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Project</label>
                                        <Input
                                            readOnly
                                            value={selectedTask?.project || ""}
                                            className="bg-slate-50 border-gray-200 text-gray-600 h-10 text-[13px] pointer-events-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Person</label>
                                        <Select 
                                            value={taskDetails.assigneeId} 
                                            onValueChange={(v) => setTaskDetails(prev => ({ ...prev, assigneeId: v }))}
                                        >
                                            <SelectTrigger className="h-10 border-gray-200 text-[13px] text-gray-700 dark:border-zinc-800 dark:text-zinc-400">
                                                <SelectValue placeholder="Choose Person..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {isLoadingUsers ? (
                                                    <div className="p-2 text-center text-gray-400 text-[12px]">Loading users...</div>
                                                ) : usersError ? (
                                                    <div className="p-2 text-center text-rose-500 text-[12px]">Error: {(usersError as any).message}</div>
                                                ) : usersData?.users ? (
                                                    usersData.users
                                                    .map((user: any) => (
                                                        <SelectItem key={user.id} value={user.id}>
                                                            {user.fullName || user.name || user.username || "Unknown"} ({user.email})
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-center text-gray-400 text-[12px]">No data</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Task</label>
                                        <Select 
                                            value={taskDetails.title} 
                                            onValueChange={(v) => {
                                                let duration = "0";
                                                if (v === "ONLINE STORE") duration = "480"; // 8 hours
                                                else if (v === "BASIC WEBSITE") duration = "360"; // 6 hours
                                                else if (v === "LOGO DESIGN") duration = "300"; // 5 hours
                                                else if (v === "PROFESSIONAL WEBSITE") duration = "600"; // 10 hours
                                                else if (v === "ENTERPRISE WEBSITE") duration = "480"; // 8 hours
                                                else if (v === "Kickoff meeting") duration = "240"; // 4 hours
                                                
                                                setTaskDetails(prev => ({ ...prev, title: v, duration }));
                                            }}
                                        >
                                            <SelectTrigger className="h-10 border-gray-200 text-[13px] text-gray-700 dark:border-zinc-800 dark:text-zinc-400">
                                                <SelectValue placeholder="Choose..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ONLINE STORE">ONLINE STORE</SelectItem>
                                                <SelectItem value="BASIC WEBSITE">BASIC WEBSITE</SelectItem>
                                                <SelectItem value="LOGO DESIGN">LOGO DESIGN</SelectItem>
                                                <SelectItem value="PROFESSIONAL WEBSITE">PROFESSIONAL WEBSITE</SelectItem>
                                                <SelectItem value="ENTERPRISE WEBSITE">ENTERPRISE WEBSITE</SelectItem>
                                                <SelectItem value="Kickoff meeting">Kickoff meeting</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Task Time (m)</label>
                                        <Input
                                            type="number"
                                            value={taskDetails.duration}
                                            onChange={(e) => setTaskDetails(prev => ({ ...prev, duration: e.target.value }))}
                                            className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Links</label>
                                        <Input
                                            placeholder="Working Links"
                                            value={taskDetails.links}
                                            onChange={(e) => setTaskDetails(prev => ({ ...prev, links: e.target.value }))}
                                            className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Next Day</label>
                                        <Input
                                            type="datetime-local"
                                            onClick={(e) => (e.target as any).showPicker?.()}
                                            onFocus={(e) => (e.target as any).showPicker?.()}
                                            value={taskDetails.dueDate}
                                            onChange={(e) => setTaskDetails(prev => ({ ...prev, dueDate: e.target.value }))}
                                            className="border-gray-200 h-10 text-[13px] cursor-pointer dark:border-zinc-800"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Detail</label>
                                    <textarea
                                        className="w-full border border-gray-200 rounded-md p-3 text-[13px] min-h-[100px] outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800"
                                        placeholder="Add detail"
                                        value={taskDetails.detail}
                                        onChange={(e) => setTaskDetails(prev => ({ ...prev, detail: e.target.value }))}
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-50 dark:border-zinc-800">
                                    <Button
                                        variant="ghost"
                                        className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-900 font-bold h-11 px-8 rounded-lg text-[14px] dark:bg-zinc-900 dark:text-zinc-100"
                                        onClick={() => setIsCreateTaskModalOpen(false)}
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-8 rounded-lg shadow-lg active:scale-95 text-[14px]"
                                        onClick={() => {
                                            if (!taskDetails.assigneeId || !taskDetails.title) {
                                                toast({ title: "Required", description: "Please select a person and a task type.", variant: "destructive" });
                                                return;
                                            }
                                            setShowConfirm(true);
                                        }}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="py-6 text-center space-y-6">
                                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                                    <AlertCircle className="w-10 h-10 text-[#00a65a] dark:text-zinc-400" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-[20px] font-bold text-gray-800 dark:text-zinc-100">Are you sure?</h3>
                                    <p className="text-[14px] text-gray-500 font-medium dark:text-zinc-400">
                                        Do you want to save and assign this task to the selected executive?
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-4 pt-4">
                                    <Button 
                                        variant="ghost"
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold h-11 px-10 rounded-xl text-[14px] dark:bg-zinc-900 dark:text-zinc-400"
                                        onClick={() => setShowConfirm(false)}
                                    >
                                        No
                                    </Button>
                                    <Button 
                                        className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-10 rounded-xl shadow-lg shadow-emerald-100 text-[14px]"
                                        onClick={() => createTaskMutation.mutate(taskDetails)}
                                        disabled={createTaskMutation.isPending}
                                    >
                                        {createTaskMutation.isPending ? "Saving..." : "Yes, Confirm"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CategoryHeader({ label }: { label: string }) {
    return (
        <div className="border-b border-slate-100 pb-1.5 mb-2 mt-4 first:mt-0 dark:border-zinc-800">
            <span className="text-[15px] font-bold text-slate-500 dark:text-zinc-400">{label}</span>
        </div>
    );
}

function OverviewLink({ label, icon: Icon, isHighlighted }: { label: string, icon: any, isHighlighted?: boolean }) {
    return (
        <div className={cn(
            "flex items-center justify-between p-2 px-3 rounded-lg cursor-pointer transition-all group",
            isHighlighted ? "bg-emerald-50 shadow-sm" : "hover:bg-slate-50 dark:bg-zinc-900"
        )}>
            <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4 transform group-hover:scale-110 transition-transform", isHighlighted ? "text-emerald-600" : "text-slate-400")} />
                <span className={cn("text-[14px] font-extrabold", isHighlighted ? "bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500" : "text-slate-600 dark:text-slate-300")}>{label}</span>
            </div>
            <ChevronRightIcon className={cn("h-3.5 w-3.5", isHighlighted ? "text-emerald-500" : "text-slate-300")} />
        </div>
    );
}

function OverviewItem({ label, value, icon: Icon, colorClass, bgClass, iconColorClass, onClick }: { label: string, value: any, icon: any, colorClass: string, bgClass: string, iconColorClass: string, onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "flex flex-col gap-2 p-3.5 rounded-2xl border transition-all duration-300 group cursor-pointer hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)] active:scale-[0.98]",
            bgClass,
            "border-white/40 backdrop-blur-sm"
        )}>
            <div className="flex items-center justify-between w-full">
                <span className={cn("text-[11px] font-black tracking-widest transition-colors leading-tight uppercase opacity-60", colorClass)}>
                    {label}
                </span>
            </div>
            <span className="text-lg font-black tracking-tight text-slate-800 dark:text-zinc-100">
                {value}
            </span>
        </div>
    );
}

function ImportantRow({ label, value, isSubValue, isTime, onClick }: { label: string, value: string, isSubValue?: boolean, isTime?: boolean, onClick?: () => void }) {
    return (
        <div 
            onClick={onClick}
            className="flex items-center justify-between p-3.5 py-4 bg-slate-50/80 hover:bg-white border border-transparent hover:border-slate-100 shadow-sm transition-all duration-300 rounded-2xl cursor-pointer group dark:hover:bg-zinc-800"
        >
            <span className="text-sm font-bold text-slate-500 tracking-tight group-hover:text-slate-800 transition-colors uppercase dark:text-zinc-400">{label}</span>
            <div className={cn(
                "px-3 py-1 rounded-full text-xs font-black shadow-sm transition-all group-hover:px-4",
                isSubValue ? "bg-emerald-50 text-emerald-600" : 
                isTime ? "bg-slate-100 text-slate-800 dark:text-slate-200" : 
                "bg-rose-50 text-rose-500"
            )}>
                {value}
            </div>
        </div>
    );
}

function ActivityLegendItem({ label, value, color }: { label: string, value: any, color: string }) {
    return (
        <div className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-1.5 px-2 rounded-lg transition-colors dark:hover:bg-zinc-800">
            <div className="flex items-center gap-2.5">
                <div className={cn("h-2 w-2 rounded-full", color)}></div>
                <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">{label}</span>
            </div>
            <span className="text-[15px] font-bold text-slate-800 dark:text-zinc-100">{value}</span>
        </div>
    );
}

function ReportStatCard({ label, value, color, icon: Icon }: { label: string, value: string, color: string, icon?: any }) {
    return (
        <div className={cn("px-4 py-3 rounded-xl min-w-[140px] flex items-start justify-between relative overflow-hidden", color)}>
            <div className="relative z-10">
                <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-0.5">{label}</p>
                <p className="text-[22px] font-black text-white leading-tight">{value}</p>
            </div>
            {Icon && <Icon className="h-4 w-4 text-white/40 mt-0.5" />}
        </div>
    );
}

function ReportTableRow({ name, company, project, status, spent, dotColor }: { name: string, company: string, project?: string, status: string, spent: string, dotColor: string }) {
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
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">0</TableCell>
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">-</TableCell>
            <TableCell className="py-3 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#fef9c3] text-[#a16207] border border-[#fef08a] dark:border-zinc-800 dark:bg-zinc-900">
                    {status}
                </span>
            </TableCell>
            <TableCell className="py-3 text-[13px] font-bold text-slate-400 text-center">-</TableCell>
            <TableCell className="py-3 pr-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <span className="text-[13px] font-black text-[#10b981] dark:text-zinc-100">{spent}</span>
                    <SendHorizonal className="h-3 w-3 text-[#10b981] opacity-0 group-hover:opacity-100 transition-opacity dark:text-zinc-100" />
                </div>
            </TableCell>
        </TableRow>
    );
}

const CheckBoxIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <path d="M9 11l3 3L22 4" />
    </svg>
);




