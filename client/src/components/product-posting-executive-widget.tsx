import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
    Users, RefreshCw, Tag, CheckCircle2, ChevronRight,
    Clock, FileText, Play, List, Calendar, Briefcase, Activity, Settings, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// ── helpers ────────────────────────────────────────────────────────────────────
function StatCard({ label, icon: Icon, value }: { label: string; icon: any; value: number }) {
    return (
        <div className="flex-1 p-3 bg-white rounded-lg border flex items-center justify-between gap-3 min-w-0 dark:bg-zinc-900">
            <div>
                <p className="text-[11px] text-gray-500 font-medium mb-1 dark:text-zinc-400">{label}</p>
                <p className="text-[22px] font-bold text-gray-800 dark:text-zinc-100">{value}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#00a65a] flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
    );
}

function SideLink({ label, href }: { label: string; href: string }) {
    const [, setLocation] = useLocation();
    return (
        <button
            onClick={() => setLocation(href)}
            className="flex items-center justify-between w-full px-3 py-2 text-[12px] font-medium text-gray-700 bg-gray-50 rounded border hover:bg-white hover:shadow-sm transition-all group dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
            <span>{label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#00a65a] group-hover:translate-x-0.5 transition-transform dark:text-zinc-400" />
        </button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ProductPostingExecutiveWidget() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [assignedTab, setAssignedTab] = useState<"today" | "waiting">("today");
    const [activityPeriod, setActivityPeriod] = useState("TD");
    const [dailyReportPeriod, setDailyReportPeriod] = useState("daily");
    const [topSellingPeriod, setTopSellingPeriod] = useState("LD");
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [overtimeDialogOpen, setOvertimeDialogOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [linkUrl, setLinkUrl] = useState("");
    const [linkLabel, setLinkLabel] = useState("");
    const [overtimeMinutes, setOvertimeMinutes] = useState("30");
    const [overtimeReason, setOvertimeReason] = useState("");
    const [dailyReportPage, setDailyReportPage] = useState(1);
    const [outputNotes, setOutputNotes] = useState("");
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"submit" | "task" | null>(null);
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [moveTaskModalOpen, setMoveTaskModalOpen] = useState(false);
    const [confirmSaveModalOpen, setConfirmSaveModalOpen] = useState(false);
    const [taskDetails, setTaskDetails] = useState({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });

    // ── Queries ────────────────────────────────────────────────────────────────
    const { data: myTasksData } = useQuery({
        queryKey: ["/api/tasks/my-executions"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/tasks/my-executions");
            return res.json();
        }
    });

    const { data: activitiesData } = useQuery({
        queryKey: ["/api/dashboard/activities", activityPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/dashboard/activities?period=${activityPeriod}`);
            return res.json();
        }
    });

    const { data: pmsStats } = useQuery({
        queryKey: ["/api/pms/stats", topSellingPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/pms/stats?period=${topSellingPeriod}`);
            return res.json();
        }
    });

    const { data: hodDailyReport } = useQuery({
        queryKey: ["/api/hod/daily-report", dailyReportPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/daily-report?period=${dailyReportPeriod}`);
            return res.json();
        }
    });

    const [monthlyProjectPeriod, setMonthlyProjectPeriod] = useState("WK");

    const { data: monthlyReportData } = useQuery({
        queryKey: ["/api/hod/daily-report", "monthly-completed", monthlyProjectPeriod],
        queryFn: async () => {
            const periodParam = monthlyProjectPeriod === "WK" ? "weekly" : "monthly";
            const res = await apiRequest("GET", `/api/hod/daily-report?period=${periodParam}`);
            return res.json();
        }
    });

    const { data: usersData, error: usersError, isLoading: isLoadingUsers } = useQuery({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            if (!res.ok) throw new Error(`Failed to fetch users: ${await res.text()}`);
            return res.json();
        },
        retry: 2
    });

    const tasks = myTasksData?.data || [];
    

    const refreshExecutions = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-executions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/product-posting/manager/queue"] });
    };

    const startTimerMutation = useMutation({
        mutationFn: async (taskId: string) => apiRequest("POST", `/api/tasks/${taskId}/timers/start`, {}),
        onSuccess: refreshExecutions,
    });

    const stopTimerMutation = useMutation({
        mutationFn: async (taskId: string) => apiRequest("POST", `/api/tasks/${taskId}/timers/stop`, {}),
        onSuccess: refreshExecutions,
    });

    const addLinkMutation = useMutation({
        mutationFn: async ({ taskId, url, label }: { taskId: string; url: string; label: string }) =>
            apiRequest("POST", `/api/product-posting/tasks/${taskId}/evidence-links`, { url, label }),
        onSuccess: () => {
            refreshExecutions();
            // setLinkDialogOpen(false); // Keep open to add multiple links
            setLinkUrl("");
            setLinkLabel("");
            alert("Link saved successfully!");
        },
    });

    const overtimeMutation = useMutation({
        mutationFn: async ({ taskId, requestedMinutes, reason }: { taskId: string; requestedMinutes: number; reason: string }) =>
            apiRequest("POST", `/api/product-posting/tasks/${taskId}/request-overtime`, { requestedMinutes, reason }),
        onSuccess: () => {
            refreshExecutions();
            setOvertimeDialogOpen(false);
            setOvertimeMinutes("30");
            setOvertimeReason("");
        },
    });

    const submitMutation = useMutation({
        mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) =>
            apiRequest("POST", `/api/product-posting/tasks/${taskId}/submit-to-manager`, { outputNotes: notes }),
        onSuccess: () => {
            refreshExecutions();
            setOutputNotes("");
        },
    });

    const createTaskMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", `/api/product-posting/projects/${data.projectId}/assign-task`, data);
        },
        onSuccess: () => {
            refreshExecutions();
            setMoveTaskModalOpen(false);
            setTaskDetails({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });
            toast({
                title: "Task Assigned",
                description: "The task has been successfully assigned.",
                variant: "default",
            });
        }
    });

    const todayTasks = tasks.filter((t: any) => {
        if (!t.createdAt) return false;
        const taskDate = new Date(t.createdAt).toDateString();
        return taskDate === new Date().toDateString();
    });

    const waitingTasks = tasks.filter((t: any) => {
        if (!t.createdAt) return true;
        const taskDate = new Date(t.createdAt).toDateString();
        return taskDate !== new Date().toDateString();
    });
    const assignedRows = assignedTab === "today" ? todayTasks : waitingTasks;

    const totalTask = pmsStats?.tasks?.total || 0;
    const pendingTask = pmsStats?.tasks?.toDo || 0;
    const runningTask = pmsStats?.tasks?.inProgress || 0;
    const completeTask = pmsStats?.tasks?.completed || 0;

    const dailyRows = hodDailyReport?.data || [];

    const activitiesRows = [
        {
            method: "Copy Product",
            target: activitiesData?.data?.rows?.[0]?.methods?.copy?.target || 90,
            done: activitiesData?.data?.rows?.[0]?.methods?.copy?.done || 0,
            time: activitiesData?.data?.rows?.[0]?.totals?.timeMinutes || 0,
        },
        {
            method: "New Product",
            target: activitiesData?.data?.rows?.[0]?.methods?.new?.target || 10,
            done: activitiesData?.data?.rows?.[0]?.methods?.new?.done || 0,
            time: 0,
        },
    ];

    const totalTimeMinutes = activitiesData?.data?.rows?.[0]?.totals?.timeMinutes || 0;
    const workingHours = 8;
    const workingMinutes = workingHours * 60;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4 min-w-0">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-4">

                {/* Top Selling */}
                <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Top Selling</h2>
                        <Select value={topSellingPeriod} onValueChange={setTopSellingPeriod}>
                            <SelectTrigger className="w-20 h-7 text-[12px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LD">LD</SelectItem>
                                <SelectItem value="TD">TD</SelectItem>
                                <SelectItem value="WC">WC</SelectItem>
                                <SelectItem value="MC">MC</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <StatCard label="Total Task" icon={Users} value={totalTask} />
                        <StatCard label="Pending" icon={RefreshCw} value={pendingTask} />
                        <StatCard label="Running" icon={Tag} value={runningTask} />
                        <StatCard label="Complete" icon={CheckCircle2} value={completeTask} />
                    </div>
                </div>

                {/* Assigned Project */}
                <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                        <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Assigned Project</h2>
                        <div className="flex rounded overflow-hidden border">
                            <button
                                onClick={() => setAssignedTab("today")}
                                className={`px-5 py-1.5 text-[12px] font-semibold transition-colors ${assignedTab === "today" ? "bg-[#00a65a] text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => setAssignedTab("waiting")}
                                className={`px-5 py-1.5 text-[12px] font-semibold transition-colors border-l ${assignedTab === "waiting" ? "bg-[#00a65a] text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-zinc-800"}`}
                            >
                                Waiting
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                            <thead>
                                <tr className="bg-gray-50 border-b dark:bg-zinc-900">
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">No#</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Project</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Status</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Time</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                            No assigned projects found.
                                        </td>
                                    </tr>
                                ) : (
                                    assignedRows.map((task: any, i: number) => (
                                        <tr key={task.id} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{i + 1}</td>
                                            <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-zinc-400">{task.companyName || task.workSpace || "N/A"}</td>
                                            <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{task.title || task.name || "—"}</td>
                                            <td className="px-4 py-2.5">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {task.phaseLabel || task.status || "Active"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                                                {task.timerStartedAt
                                                    ? <span className="text-amber-600 font-semibold animate-pulse">Running</span>
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full hover:bg-emerald-50 p-0 transition-all active:scale-90"
                                                        onClick={() => setLocation("/pms/status")}
                                                    >
                                                        <Eye className="w-4 h-4 text-[#00a65a] dark:text-zinc-400" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full hover:bg-emerald-50 p-0 transition-all active:scale-90"
                                                        onClick={() => {
                                                            setSelectedTask(task);
                                                            setActionDialogOpen(true);
                                                        }}
                                                    >
                                                        <Settings className="w-4 h-4 text-[#00a65a] dark:text-zinc-400" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Daily Report */}
                <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b">
                        <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Daily Report</h2>
                        <Select value={dailyReportPeriod} onValueChange={setDailyReportPeriod}>
                            <SelectTrigger className="w-36 h-7 text-[12px] rounded-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily Report</SelectItem>
                                <SelectItem value="yesterday">Yesterday Report</SelectItem>
                                <SelectItem value="weekly">Weekly Report</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                            <thead>
                                <tr className="bg-gray-50 border-b dark:bg-zinc-900">
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Name</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Project</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Free</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Task</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Status</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Run</th>
                                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600 dark:text-zinc-300">Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                            No report data available.
                                        </td>
                                    </tr>
                                ) : (
                                    dailyRows.slice((dailyReportPage - 1) * 10, dailyReportPage * 10).map((row: any, idx: number) => (
                                        <tr key={idx} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-4 py-2.5 font-medium text-gray-700 dark:text-zinc-400">{row.name || "—"}</td>
                                            <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{row.company || "—"}</td>
                                            <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">{row.project || "—"}</td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{row.free ?? 0}</td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{row.tasks ?? 0}</td>
                                            <td className="px-4 py-2.5">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                                    {row.status || "—"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{row.run ?? 0}</td>
                                            <td className="px-4 py-2.5 text-gray-500 dark:text-zinc-400">{row.spent ?? 0} mins</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    {dailyRows.length > 10 && (
                        <div className="flex items-center justify-between p-4 border-t text-[12px] text-gray-500">
                            <div>
                                Showing {(dailyReportPage - 1) * 10 + 1} to {Math.min(dailyReportPage * 10, dailyRows.length)} of {dailyRows.length} entries
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setDailyReportPage(p => Math.max(1, p - 1))} 
                                    disabled={dailyReportPage === 1}
                                    className="h-7 text-[11px]"
                                >
                                    Prev
                                </Button>
                                <div className="flex items-center px-2 font-medium">
                                    Page {dailyReportPage} of {Math.ceil(dailyRows.length / 10)}
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setDailyReportPage(p => Math.min(Math.ceil(dailyRows.length / 10), p + 1))} 
                                    disabled={dailyReportPage === Math.ceil(dailyRows.length / 10)}
                                    className="h-7 text-[11px]"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-4">

                {/* Promotion Banners */}
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-zinc-900">
                    <div className="px-4 py-3 border-b">
                        <h2 className="text-[13px] font-bold text-gray-800 dark:text-zinc-100">Promotion Banners</h2>
                    </div>
                    <div className="relative h-36 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center overflow-hidden">
                        <img
                            src="https://img.freepik.com/free-photo/business-concept-with-graphic-holography_23-2149160929.jpg"
                            alt="Promotion"
                            className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-black/20" />
                    </div>
                </div>

                {/* Activities */}
                <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <h2 className="text-[13px] font-bold text-gray-800 dark:text-zinc-100">Activities</h2>
                        <Select value={activityPeriod} onValueChange={setActivityPeriod}>
                            <SelectTrigger className="w-16 h-7 text-[12px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TD">TD</SelectItem>
                                <SelectItem value="WC">WC</SelectItem>
                                <SelectItem value="MC">MC</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="px-4 pb-3">
                        <table className="w-full text-[12px] mt-2">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-2 text-left font-semibold text-gray-600 dark:text-zinc-300">Method</th>
                                    <th className="pb-2 text-left font-semibold text-gray-600 dark:text-zinc-300">Target</th>
                                    <th className="pb-2 text-left font-semibold text-gray-600 dark:text-zinc-300">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activitiesRows.map((row, idx) => {
                                    const pct = row.target > 0 ? Math.round((row.done / row.target) * 100) : 0;
                                    return (
                                        <tr key={idx} className="border-b last:border-0">
                                            <td className="py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00a65a] dark:text-zinc-400" />
                                                    <span className="font-medium text-gray-700 dark:text-zinc-400">{row.method}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 text-gray-600 dark:text-zinc-300">
                                                {row.target} ({row.done}) {pct}%
                                            </td>
                                            <td className="py-2.5 text-gray-600 dark:text-zinc-300">{row.time}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div className="mt-2 pt-2 border-t text-[11px] text-gray-500 dark:text-zinc-400">
                            Talk Time () &nbsp; W-H {workingHours}({workingMinutes} M) &nbsp; Spent({totalTimeMinutes} M)
                        </div>
                    </div>
                </div>

                {/* Projects Overview */}
                <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                    <div className="px-4 py-3 border-b">
                        <h2 className="text-[13px] font-bold text-gray-800 dark:text-zinc-100">Projects Overview</h2>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                        <SideLink label="Running Project" href="/pms/running-projects" />
                        <SideLink label="Pending Project" href="/pms/approvals" />
                        <SideLink label="Project Task" href="/pms/tasks" />
                        <SideLink label="Over Time" href="/hr/overtime" />
                        <SideLink label="Leave Application" href="/hr/leave-request" />
                        <SideLink label="Attendance" href="/hr/attendance" />
                        <SideLink label="Posting Data" href="/posting-data/view-products" />
                    </div>
                </div>

                {/* Important */}
                <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                    <h2 className="text-[15px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important</h2>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                            <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Notice</span>
                            <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">0</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                            <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Portfolio</span>
                            <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">51(10200)</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                            <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Add Portfolio</span>
                            <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">99</span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                            <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Login Time</span>
                            <span className="text-[#00a65a] font-bold text-[13px] dark:text-zinc-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <button
                            onClick={() => setLocation("/pms/tasks")}
                            className="flex justify-between items-center w-full py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity group dark:border-zinc-800"
                        >
                            <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">To Do List</span>
                            <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Monthly Complete Project (Full Width at Bottom) */}
            <div className="lg:col-span-2 mt-4">
                <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                        <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Monthly Complete Project</h2>
                        <Select value={monthlyProjectPeriod} onValueChange={setMonthlyProjectPeriod}>
                            <SelectTrigger className="w-16 h-7 text-[12px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="WK" style={{ fontSize: "12px" }}>WK</SelectItem>
                                <SelectItem value="MONTH" style={{ fontSize: "12px" }}>Month</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="overflow-x-auto p-4 pt-0">
                        <table className="w-full text-[12px] border-collapse">
                            <thead>
                                <tr className="border-b">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Name</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Company</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Project</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Free</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Task</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Status</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Run</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-600 border-x first:border-l-0 last:border-r-0 dark:text-zinc-300">Spent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!monthlyReportData?.data || monthlyReportData.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                                            No monthly records found.
                                        </td>
                                    </tr>
                                ) : (
                                    monthlyReportData.data.map((row: any, idx: number) => (
                                        <tr key={idx} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 font-medium text-gray-700 dark:text-zinc-400">{row.name || "—"}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-600 dark:text-zinc-300">{row.company || "—"}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-600 dark:text-zinc-300">{row.project || "—"}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-500 dark:text-zinc-400">{row.free ?? 0}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-500 dark:text-zinc-400">{row.tasks ?? 0}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${row.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                                    {row.status || "—"}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-500 dark:text-zinc-400">{row.run ?? 0}</td>
                                            <td className="px-3 py-2 border-x first:border-l-0 last:border-r-0 text-gray-500 dark:text-zinc-400">{row.spent ?? 0} mins</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Add Output Link</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                        <Input placeholder="Label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
                        <Button
                            className="bg-[#00a65a] hover:bg-[#00a65a]/90 w-full font-bold h-10"
                            disabled={!selectedTask?.taskId || !linkUrl || addLinkMutation.isPending}
                            onClick={() => addLinkMutation.mutate({ taskId: selectedTask.taskId, url: linkUrl, label: linkLabel })}
                        >
                            {addLinkMutation.isPending ? "Saving..." : "Save Link"}
                        </Button>

                        {selectedTask?.evidenceLinks?.length > 0 && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                                <h4 className="text-[12px] font-bold text-gray-500 uppercase dark:text-zinc-400">Saved Links</h4>
                                <div className="max-h-[150px] overflow-y-auto space-y-1 pr-1">
                                    {selectedTask.evidenceLinks.map((link: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-[11px] dark:bg-zinc-900">
                                            <span className="font-semibold text-gray-700 truncate max-w-[100px] dark:text-zinc-400">{link.label || "Link"}</span>
                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate ml-2 flex-1">
                                                {link.url}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={overtimeDialogOpen} onOpenChange={setOvertimeDialogOpen}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Request Overtime</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input type="number" min="1" value={overtimeMinutes} onChange={(e) => setOvertimeMinutes(e.target.value)} />
                        <Textarea placeholder="Reason for overtime" value={overtimeReason} onChange={(e) => setOvertimeReason(e.target.value)} />
                        <Button
                            className="bg-[#00a65a] hover:bg-[#00a65a]/90"
                            disabled={!selectedTask?.taskId || !overtimeReason || overtimeMutation.isPending}
                            onClick={() => overtimeMutation.mutate({ taskId: selectedTask.taskId, requestedMinutes: Number(overtimeMinutes) || 0, reason: overtimeReason })}
                        >
                            Request Overtime
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MASTER ACTION DIALOG for Executive */}
            <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
                <DialogContent className="max-w-[500px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/30">
                        <DialogTitle className="text-[16px] font-bold text-gray-700 flex items-center gap-2 dark:text-zinc-400">
                            <Settings className="w-4 h-4" /> PROJECT ACTIONS
                        </DialogTitle>
                    </div>
                    
                    <div className="p-6 space-y-6">
                        {/* Status & Control */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <h4 className="text-[13px] font-bold text-gray-800 dark:text-zinc-100">{selectedTask?.companyName || "N/A"}</h4>
                                <p className="text-[11px] text-gray-500 dark:text-zinc-400">{selectedTask?.title || "N/A"}</p>
                            </div>
                            <Button
                                className={cn(
                                    "font-bold h-9 px-6 rounded-lg shadow-sm transition-all active:scale-95",
                                    selectedTask?.timerStatus === "RUNNING" 
                                        ? "bg-rose-500 hover:bg-rose-600 text-white" 
                                        : "bg-[#00a65a] hover:bg-[#00a65a]/90 text-white"
                                )}
                                onClick={() => {
                                    if (selectedTask?.timerStatus === "RUNNING") stopTimerMutation.mutate(selectedTask.taskId);
                                    else startTimerMutation.mutate(selectedTask.taskId);
                                }}
                            >
                                {selectedTask?.timerStatus === "RUNNING" ? "Stop Timer" : "Start Timer"}
                            </Button>
                        </div>

                        {/* Quick Tabs Style Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button 
                                variant="outline" 
                                className="h-12 flex items-center gap-3 border-gray-200 hover:border-[#00a65a]/30 hover:bg-[#00a65a]/5 text-gray-700 font-bold text-[13px] dark:border-zinc-800 dark:text-zinc-400"
                                onClick={() => setLinkDialogOpen(true)}
                            >
                                <Tag className="w-4 h-4 text-[#00a65a] dark:text-zinc-400" /> Add Link
                            </Button>
                            <Button 
                                variant="outline" 
                                className="h-12 flex items-center gap-3 border-gray-200 hover:border-rose-200 hover:bg-rose-50 text-gray-700 font-bold text-[13px] dark:border-zinc-800 dark:text-zinc-400"
                                onClick={() => setOvertimeDialogOpen(true)}
                            >
                                <Clock className="w-4 h-4 text-rose-500" /> Overtime
                            </Button>
                        </div>

                        {/* Submit Section */}
                        <div className="pt-4 border-t space-y-4">
                            <h4 className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Submit Work to Manager</h4>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">Main image uploaded?</label>
                                        <Select 
                                            defaultValue="Yes"
                                            onValueChange={(v) => setOutputNotes(prev => `[Image: ${v}] ${prev}`)}
                                        >
                                            <SelectTrigger className="h-9 border-gray-200 text-[12px] dark:border-zinc-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Yes">Yes</SelectItem>
                                                <SelectItem value="No">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">Work Status</label>
                                        <div className="bg-amber-50 text-amber-700 h-9 px-3 rounded-lg flex items-center justify-center text-[11px] font-bold border border-amber-100">
                                            Ready to Review
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400">Additional Remarks</label>
                                    <Textarea 
                                        className="w-full border-gray-200 rounded-lg text-[12px] min-h-[80px] focus:ring-[#00a65a]/10 dark:border-zinc-800" 
                                        placeholder="Type notes here..." 
                                        value={outputNotes} 
                                        onChange={(e) => setOutputNotes(e.target.value)} 
                                    />
                                </div>
                                <Button
                                    className="bg-[#00a65a] hover:bg-[#00a65a]/90 w-full font-black h-11 rounded-xl shadow-lg shadow-emerald-50 active:scale-95 transition-all text-white"
                                    disabled={!selectedTask?.taskId || submitMutation.isPending}
                                    onClick={() => {
                                        setConfirmAction("submit");
                                        setConfirmDialogOpen(true);
                                        setActionDialogOpen(false);
                                    }}
                                >
                                    Submit Work
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={moveTaskModalOpen} onOpenChange={setMoveTaskModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/30">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-[20px] font-bold text-gray-700 dark:text-zinc-400">Create New Task</DialogTitle>
                            <span className="text-[14px] font-bold text-emerald-500">{new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        </div>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Company</label>
                                <Input
                                    readOnly
                                    value={selectedTask?.companyName || selectedTask?.workSpace || ""}
                                    className="bg-slate-50 border-gray-200 text-gray-600 h-10 text-[13px] pointer-events-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Project</label>
                                <Input
                                    readOnly
                                    value={selectedTask?.title || selectedTask?.name || ""}
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
                                            .filter((u: any) => {
                                                const uRole = (u.role || "").toLowerCase();
                                                const rs = (u.roles || []).map((r: any) => String(r).toLowerCase());
                                                
                                                return uRole === "posting_executive" || 
                                                       uRole === "product_posting_executive" ||
                                                       rs.includes("posting_executive") || 
                                                       rs.includes("product_posting_executive");
                                            })
                                            .map((user: any) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.fullName || user.username}
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
                                        const defaultTimes: Record<string, string> = {
                                            "ONLINE STORE": "120",
                                            "BASIC WEBSITE": "60",
                                            "LOGO DESIGN": "45",
                                            "PROFESSIONAL WEBSITE": "180",
                                            "ENTERPRISE WEBSITE": "300"
                                        };
                                        setTaskDetails(prev => ({ 
                                            ...prev, 
                                            title: v,
                                            duration: defaultTimes[v] || prev.duration 
                                        }));
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
                                onClick={() => setMoveTaskModalOpen(false)}
                            >
                                Close
                            </Button>
                            <Button
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-8 rounded-lg shadow-lg active:scale-95 text-[14px]"
                                onClick={() => {
                                    if (!taskDetails.assigneeId || !taskDetails.title) {
                                        alert("Please select a person and a task type.");
                                        return;
                                    }
                                    setConfirmAction("task");
                                    setConfirmDialogOpen(true);
                                    setMoveTaskModalOpen(false);
                                }}
                                disabled={createTaskMutation.isPending}
                            >
                                {createTaskMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent className="max-w-[400px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="p-8 text-center space-y-6">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                            <CheckCircle2 className="w-10 h-10 text-[#00a65a] dark:text-zinc-400" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-[20px] font-bold text-gray-800 dark:text-zinc-100">Are you sure?</h3>
                            <p className="text-[14px] text-gray-500 font-medium dark:text-zinc-400">
                                Do you want to submit this work to the manager? This action will mark your task as complete and move it to the daily report.
                            </p>
                        </div>

                        <div className="flex items-center justify-center gap-4 pt-2">
                            <Button 
                                variant="ghost"
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold h-11 px-8 rounded-xl text-[14px] flex-1 dark:bg-zinc-900 dark:text-zinc-400"
                                onClick={() => {
                                    setConfirmDialogOpen(false);
                                    setConfirmAction(null);
                                }}
                            >
                                No
                            </Button>
                            <Button 
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-emerald-100 flex-1 text-[14px]"
                                onClick={() => {
                                    if (confirmAction === "submit") {
                                        submitMutation.mutate({ 
                                            taskId: selectedTask.taskId, 
                                            notes: outputNotes 
                                        });
                                    } else if (confirmAction === "task") {
                                        createTaskMutation.mutate({
                                            projectId: selectedTask?.projectId || selectedTask?.id,
                                            title: taskDetails.title,
                                            description: taskDetails.detail,
                                            assignedToUserId: taskDetails.assigneeId,
                                            dueDate: taskDetails.dueDate ? new Date(taskDetails.dueDate).toISOString() : new Date().toISOString(),
                                            duration: taskDetails.duration,
                                            links: taskDetails.links,
                                            priority: "Medium",
                                            category: "Work"
                                        });
                                    }
                                    setConfirmDialogOpen(false);
                                    setConfirmAction(null);
                                }}
                                disabled={submitMutation.isPending || createTaskMutation.isPending}
                            >
                                {submitMutation.isPending || createTaskMutation.isPending ? "Saving..." : "Yes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
