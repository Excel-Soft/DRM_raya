import { useState } from "react";
import { isSupportModuleEnabled } from "@/lib/feature-flags";
import { useUiWorkflowConfig } from "@/hooks/use-ui-workflow-config";
import { getVerificationLifecycleLabels } from "@shared/verification-lifecycle";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
    Users, RefreshCw, Tag, Target, ChevronRight,
    Search as SearchIcon, CheckCircle2, LayoutDashboard, Database,
    UserPlus, Clock, Calendar, MessageSquare, AlertTriangle, X,
    FileText, Download, Briefcase, Link as LinkIcon
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { WorkflowTimeline } from "@/components/workflow-timeline";

// ── helpers ────────────────────────────────────────────────────────────────────
function StatCard({ label, icon: Icon, value, colorClass = "bg-[#00a65a]" }: { label: string; icon: any; value: string | number; colorClass?: string }) {
    return (
        <div className="flex-1 p-4 bg-white rounded-lg border flex items-center justify-between gap-3 min-w-[200px] shadow-sm dark:bg-zinc-900">
            <div>
                <p className="text-[13px] text-gray-500 font-medium mb-1 dark:text-zinc-400">{label}</p>
                <p className="text-[24px] font-bold text-gray-800 dark:text-zinc-100">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center shrink-0`}>
                <Icon className="h-6 w-6 text-white" />
            </div>
        </div>
    );
}

function SideLink({ label, href }: { label: string; href: string }) {
    const [, setLocation] = useLocation();
    return (
        <button
            onClick={() => setLocation(href)}
            className="flex items-center justify-between w-full px-3 py-2.5 text-[12px] font-medium text-gray-700 bg-gray-50 rounded border hover:bg-white hover:shadow-sm transition-all group dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
            <span>{label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-transform" />
        </button>
    );
}

const isTodayProject = (row: any) => {
    // 1. Check raw date if available
    const rawDate = row.raw?.qaReviewedAt || row.raw?.executiveSubmittedAt || row.raw?.updatedAt || row.raw?.createdAt;
    if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            const today = new Date();
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
        }
    }
    
    // 2. Check time string
    if (typeof row.time === "string") {
        const t = row.time.trim();
        if (t === "N/A") return false;
        
        // Check local yyyy-mm-dd
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const localTodayStr = `${yyyy}-${mm}-${dd}`;
        
        if (t === localTodayStr) {
            return true;
        }
        
        // If it contains a dash (and didn't match localTodayStr), it's a different date
        if (t.includes("-")) {
            return false;
        }
        
        // If it contains a month abbreviation, it's a past date
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (months.some(m => t.toLowerCase().includes(m.toLowerCase()))) {
            return false;
        }
        
        // If it contains a colon (time format like 10:57 AM), it represents today's time
        if (t.includes(":")) {
            return true;
        }
    }
    
    return false;
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function VerificationManagerWidget() {
    const [, setLocation] = useLocation();
    const { config: uiWorkflowConfig } = useUiWorkflowConfig();
    const lifecycleLabels = getVerificationLifecycleLabels(uiWorkflowConfig.verificationManagerRequiredAfterQa);
    const [projectTab, setProjectTab] = useState<"today" | "pending">("today");
    const [sellingPeriod, setSellingPeriod] = useState("LD");
    const [entriesCount, setEntriesCount] = useState("10");
    const [searchQuery, setSearchQuery] = useState("");
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [detailProject, setDetailProject] = useState<any>(null);
    const [isLinksDialogOpen, setIsLinksDialogOpen] = useState(false);
    const [linksProject, setLinksProject] = useState<any>(null);
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [statusValue, setStatusValue] = useState("");
    const [levelValue, setLevelValue] = useState("");
    const [remarksValue, setRemarksValue] = useState("");
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isLevelOpen, setIsLevelOpen] = useState(false);

    const openStatusDialog = (project: any) => {
        setSelectedProject(project);
        setIsStatusDialogOpen(true);
        setStatusValue("");
        setLevelValue("");
        setRemarksValue("");
    };

    const openDetailDialog = (project: any) => {
        setDetailProject(project);
        setIsDetailDialogOpen(true);
    };

    const openLinksDialog = (project: any) => {
        setLinksProject(project);
        setIsLinksDialogOpen(true);
    };

    // Stage 3: removed the localStorage 'mock_verification_queue' poller. The
    // verification queue is sourced exclusively from the backend
    // (/api/product-posting/verification/queue), which the QA review transition
    // populates server-side.

    // Queries (Reusing existing endpoints where possible for dynamic feel)
    const { data: pmsStats } = useQuery({
        queryKey: ["/api/pms/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/stats");
            return res.json();
        }
    });

    const { data: pendingApprovals } = useQuery({
        queryKey: ["/api/product-posting/verification/queue"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/product-posting/verification/queue");
            return res.json();
        }
    });

    const verificationMutation = useMutation({
        mutationFn: async ({ taskId, action, remarks }: { taskId: string; action: "complete" | "return"; remarks?: string }) =>
            apiRequest("POST", `/api/product-posting/tasks/${taskId}/verification-review`, { action, remarks }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/product-posting/verification/queue"] });
            setIsStatusDialogOpen(false);
            setStatusValue("");
            setLevelValue("");
        }
    });

    const verificationRows = pendingApprovals?.data || [];
    const projectListData = verificationRows.map((p: any, idx: number) => ({
        no: idx + 1,
        company: p.companyName || "N/A",
        tasker: p.assignee?.name || "Posting Executive",
        project: p.name || p.title,
        status: p.phaseLabel || p.status,
        statusTag: p.returnCount ? `rework ${p.returnCount}` : lifecycleLabels.postQaTag,
        time: p.qaReviewedAt ? new Date(p.qaReviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
        id: p.taskId,
        raw: p,
    }));

    const changingProjectsData = verificationRows.filter((p: any) => p.returnCount > 0).map((p: any, idx: number) => ({
        no: idx + 1,
        company: p.companyName || "N/A",
        tasker: p.assignee?.name || "Posting Executive",
        project: p.name || p.title,
        status: p.phaseLabel || p.status,
        time: p.updatedAt ? new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
        id: p.taskId,
        raw: p,
    }));

    const filteredChangingProjects = changingProjectsData
        .filter((p: any) =>
            p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tasker.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, parseInt(entriesCount));

    // Stage 3: removed hardcoded defaultPendingCompanies and mock queue; the list
    // shows only real backend verification-queue rows.
    const allProjectsMapped = projectListData.map((row: any) => ({
        ...row,
        time: row.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    const todayProjects = allProjectsMapped
        .filter(isTodayProject)
        .map((row: any, idx: number) => ({ ...row, no: idx + 1 }));

    const pendingProjects = allProjectsMapped
        .filter((row: any) => !isTodayProject(row))
        .map((row: any, idx: number) => ({ ...row, no: idx + 1 }));

    const projectsToDisplay = projectTab === "today" ? todayProjects : pendingProjects;

    return (
        <div className="space-y-4 min-w-0">
            {/* Top Layout: Left 2fr, Right 1fr */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">

                {/* Left Column */}
                <div className="space-y-4">
                    {/* Top Selling */}
                    <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[15px] font-bold text-gray-800 dark:text-zinc-100">Top Selling</h2>
                            <Select value={sellingPeriod} onValueChange={setSellingPeriod}>
                                <SelectTrigger className="w-16 h-7 text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LD">LD</SelectItem>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-4 flex-wrap">
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setProjectTab("today")}>
                                <StatCard label="Total Project" icon={Users} value={pmsStats?.projects?.total ?? 0} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setProjectTab("pending")}>
                                <StatCard label="Pending Verification" icon={RefreshCw} value={verificationRows.length || "0"} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLocation("/pms/status")}>
                                <StatCard label="Complete" icon={Tag} value={pmsStats?.projects?.completedProjects ?? 0} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLocation("/pms/status")}>
                                <StatCard label="Changing" icon={Target} value={changingProjectsData.length} />
                            </div>
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-zinc-900">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="flex items-center gap-2">
                                <h2 className="text-[15px] font-bold text-gray-800 dark:text-zinc-100">Project List</h2>
                                <LayoutDashboard className="h-4 w-4 text-[#00a65a] dark:text-zinc-400" />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg dark:bg-zinc-900">
                                <button
                                    onClick={() => setProjectTab("today")}
                                    className={`px-6 py-1.5 text-[12px] font-bold rounded-md transition-all ${projectTab === "today" ? "bg-[#00a65a] text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 font-medium"}`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setProjectTab("pending")}
                                    className={`px-6 py-1.5 text-[12px] font-bold rounded-md transition-all ${projectTab === "pending" ? "bg-[#00a65a] text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 font-medium"}`}
                                >
                                    Pending
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {projectTab === "today" ? (
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b dark:bg-zinc-900">
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">No#</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Company</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Tasker</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Project</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Status</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Detail</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Link</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-zinc-300">Time</th>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-600 text-center dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projectsToDisplay.map((row: any) => (
                                            <tr key={row.no} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                                <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-zinc-100">{row.company}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.tasker}</td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.project}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${row.status === "Complete" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                                            {row.status}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${row.statusTag === "after changing" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                                                            {row.statusTag}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Database className="h-4 w-4 text-[#00a65a] cursor-pointer dark:text-zinc-400" onClick={() => openDetailDialog(row)} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Tag className="h-4 w-4 text-[#00a65a] -rotate-45 cursor-pointer dark:text-zinc-400" onClick={() => openLinksDialog(row)} />
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 font-medium dark:text-zinc-400">{row.time}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => openStatusDialog(row)}
                                                        className="text-[#00a65a] hover:bg-emerald-50 p-1 rounded-full transition-colors dark:text-zinc-400"
                                                    >
                                                        <ChevronRight className="h-5 w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-[13px]">
                                    <thead>
                                        <tr className="bg-[#f0f2f5] border-b dark:bg-zinc-900">
                                            <th className="px-5 py-3 text-left font-bold text-gray-600 w-[80px] dark:text-zinc-300">No#</th>
                                            <th className="px-4 py-3 text-left font-bold text-gray-600 dark:text-zinc-300">Detail</th>
                                            <th className="px-6 py-3 text-center font-bold text-gray-600 dark:text-zinc-300">Status/Time</th>
                                            <th className="px-6 py-3 text-center font-bold text-gray-600 w-[120px] dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projectsToDisplay.map((row: any) => (
                                            <tr key={row.no} className="border-b hover:bg-gray-50 transition-colors bg-white dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                                <td className="px-5 py-4 text-gray-500 font-medium dark:text-zinc-400">
                                                    <div className="flex items-center gap-3">
                                                        <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 cursor-pointer dark:border-zinc-800" />
                                                        {row.no}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col text-[14px] leading-relaxed">
                                                        <div><span className="font-bold text-gray-800 dark:text-zinc-100">Company:</span> <span className="text-gray-600 dark:text-zinc-300">{row.company}</span></div>
                                                        <div><span className="font-bold text-gray-800 dark:text-zinc-100">Tasker:</span> <span className="text-gray-600 dark:text-zinc-300">{row.tasker}</span></div>
                                                        <div><span className="font-bold text-gray-800 dark:text-zinc-100">Project:</span> <span className="text-gray-600 dark:text-zinc-300">{row.project}</span></div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5 text-[14px] font-medium text-gray-600 dark:text-zinc-300">
                                                        <span className="px-3 py-0.5 rounded-full text-[13px] font-semibold bg-[#e8eaec] text-gray-500 border border-transparent dark:text-zinc-400 dark:bg-zinc-900">
                                                            {row.status}
                                                        </span>
                                                        <span className="text-gray-400">/</span>
                                                        <span>{row.time}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <Database className="h-5 w-5 text-[#00a65a] cursor-pointer dark:text-zinc-400" onClick={() => openDetailDialog(row)} />
                                                        <LinkIcon className="h-5 w-5 text-[#00a65a] cursor-pointer dark:text-zinc-400" onClick={() => openLinksDialog(row)} />
                                                        <button
                                                            onClick={() => openStatusDialog(row)}
                                                            className="text-[#00a65a] hover:bg-emerald-50 rounded-full transition-colors flex items-center justify-center -mr-1 dark:text-zinc-400"
                                                        >
                                                            <ChevronRight className="h-6 w-6 font-bold" strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Promotion Banners */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-zinc-900">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Promotion Banners</h2>
                        </div>
                        <div className="h-[140px] bg-gray-100 flex items-center justify-center relative group dark:bg-zinc-900">
                            <img
                                src="https://img.freepik.com/free-photo/group-businesswomen-working-office_23-2148908920.jpg"
                                alt="Promotion"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
                        </div>
                    </div>

                    {/* Projects Overview */}
                    <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Projects Overview</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-2">
                            <SideLink label="Check Duplication" href="/sales/duplicate-checker" />
                            <SideLink label="Add Customer" href="/sales/add-customer" />
                            <SideLink label="Temporary" href="/customer/temporary-contact" />
                            <SideLink label="Over Time" href="/hr/overtime" />
                            <SideLink label="Leave Application" href="/hr/leave-request" />
                            <SideLink label="Attendance" href="/hr/attendance" />
                            <SideLink label="Project List" href="/pms/tasks" />
                            <SideLink label="Delay Project Old" href="/drm/delay-project" />
                            <SideLink label="Verification" href="/verification/customers" />
                        </div>
                    </div>

                    {/* Important */}
                    <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                        <h2 className="text-[15px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important</h2>
                        <div className="space-y-2">
                            <button onClick={() => setLocation("/drm/delay-projects-new")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Delay Projects</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">416</span>
                            </button>
                            <button onClick={() => setLocation("/drm/online-form")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Notice</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">0</span>
                            </button>
                            {isSupportModuleEnabled() && (
                            <button onClick={() => setLocation("/support/complaints")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Complaints</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">51(10200)</span>
                            </button>
                            )}
                            <button onClick={() => setLocation("/training")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Event</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">99</span>
                            </button>
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Login Time</span>
                                <span className="text-[#00a65a] font-bold text-[13px] dark:text-zinc-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom: Changing Projects */}
            <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between px-4 py-4 border-b">
                    <h2 className="text-[16px] font-bold text-gray-800 dark:text-zinc-100">Changing Projects</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-zinc-300">
                            <span>Show</span>
                            <Select value={entriesCount} onValueChange={setEntriesCount}>
                                <SelectTrigger className="w-16 h-8 text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                            <span>entries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-600 dark:text-zinc-300">Search:</span>
                            <div className="relative">
                                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search company, project..."
                                    className="h-8 w-48 pl-8 pr-3 text-[12px] border rounded-md focus:outline-none focus:ring-1 focus:ring-[#00a65a]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="bg-gray-50 border-b dark:bg-zinc-900">
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x first:border-l-0 dark:text-zinc-300">No#</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Company</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Tasker</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Project</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Status</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Detail</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Time</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x last:border-r-0 text-center dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredChangingProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                            No matching records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredChangingProjects.map((row: any) => (
                                        <tr key={row.no} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800 uppercase dark:text-zinc-100">{row.company}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.tasker}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.project}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900">
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Database className="h-4 w-4 text-[#00a65a] cursor-pointer dark:text-zinc-400" onClick={() => openDetailDialog(row)} />
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-medium dark:text-zinc-400">{row.time}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => openStatusDialog(row)}
                                                    className="text-[#00a65a] hover:bg-emerald-50 p-1 rounded-full transition-colors dark:text-zinc-400"
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Project Status Dialog */}
                <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                    <DialogContent className="max-w-[550px] p-0 overflow-hidden border-none shadow-lg">
                        <DialogHeader className="bg-white px-6 py-4 flex flex-row items-center justify-between border-b dark:bg-zinc-900">
                            <DialogTitle className="text-[18px] font-bold text-gray-700 dark:text-zinc-400">Project Status</DialogTitle>
                        </DialogHeader>

                        <div className="p-6 bg-white space-y-5 dark:bg-zinc-900">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">Company</Label>
                                    <Input
                                        readOnly
                                        value={selectedProject?.company || ""}
                                        className="bg-gray-50/50 border-gray-200 text-gray-700 h-10 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">Project</Label>
                                    <Input
                                        readOnly
                                        value={selectedProject?.project || ""}
                                        className="bg-gray-50/50 border-gray-200 text-gray-700 h-10 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">Status</Label>
                                    <Popover open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isStatusOpen}
                                                className="w-full justify-between h-10 border-gray-200 text-gray-500 font-normal px-3 bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                            >
                                                {statusValue || "Choose..."}
                                                <ChevronRight className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isStatusOpen ? "rotate-90" : ""}`} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-gray-100 dark:border-zinc-800" align="start">
                                            <Command className="rounded-lg">
                                                <div className="p-2 border-b bg-white dark:bg-zinc-900">
                                                    <CommandInput placeholder="" className="h-9 border border-gray-200 rounded px-2 text-[13px] bg-white outline-none dark:bg-zinc-900 dark:border-zinc-800" />
                                                </div>
                                                <CommandList>
                                                    <div className="px-3 py-2 text-[12px] font-bold text-gray-400">Person</div>
                                                    <CommandItem
                                                        value="Choose..."
                                                        onSelect={() => {
                                                            setStatusValue("Choose...");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className="px-3 py-2 text-[13px] text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                                    >
                                                        Choose...
                                                    </CommandItem>
                                                    <CommandItem
                                                        value="Complete"
                                                        onSelect={() => {
                                                            setStatusValue("Complete");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className={`px-3 py-2 text-[13px] cursor-pointer ${statusValue === "Complete" ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                    >
                                                        Complete
                                                    </CommandItem>
                                                    <CommandItem
                                                        value="Changing"
                                                        onSelect={() => {
                                                            setStatusValue("Changing");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className={`px-3 py-2 text-[13px] cursor-pointer ${statusValue === "Changing" ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                    >
                                                        Changing
                                                    </CommandItem>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">Requirement Standard</Label>
                                    <Popover open={isLevelOpen} onOpenChange={setIsLevelOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isLevelOpen}
                                                className="w-full justify-between h-10 border-gray-200 text-gray-500 font-normal px-3 bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                            >
                                                {levelValue || "Choose..."}
                                                <ChevronRight className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isLevelOpen ? "rotate-90" : ""}`} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-gray-100 dark:border-zinc-800" align="start">
                                            <Command className="rounded-lg">
                                                <div className="p-2 border-b bg-white dark:bg-zinc-900">
                                                    <CommandInput placeholder="" className="h-9 border border-gray-200 rounded px-2 text-[13px] bg-white outline-none dark:bg-zinc-900 dark:border-zinc-800" />
                                                </div>
                                                <CommandList className="max-h-[250px]">
                                                    <div className="px-3 py-2 text-[12px] font-bold text-gray-400">Person</div>
                                                    <CommandItem
                                                        value="Choose..."
                                                        onSelect={() => {
                                                            setLevelValue("Choose...");
                                                            setIsLevelOpen(false);
                                                        }}
                                                        className="px-3 py-2 text-[13px] text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                                    >
                                                        Choose...
                                                    </CommandItem>
                                                    {["Excellent", "Very Good", "Good", "Normal", "Very Poor"].map((lvl) => (
                                                        <CommandItem
                                                            key={lvl}
                                                            value={lvl}
                                                            onSelect={() => {
                                                                setLevelValue(lvl);
                                                                setIsLevelOpen(false);
                                                            }}
                                                            className={`px-3 py-2 text-[13px] cursor-pointer ${levelValue === lvl ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                        >
                                                            {lvl}
                                                        </CommandItem>
                                                    ))}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">Verification Notes</Label>
                                <Textarea
                                    placeholder="Enter Verification Remarks..."
                                    value={remarksValue}
                                    onChange={(e) => setRemarksValue(e.target.value)}
                                    className="min-h-[100px] border-gray-200 focus:ring-[#00a65a] focus:border-[#00a65a] dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t dark:bg-zinc-900">
                            <Button
                                variant="secondary"
                                onClick={() => setIsStatusDialogOpen(false)}
                                className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-700 px-6 font-semibold dark:bg-zinc-900 dark:text-zinc-400"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    // Stage 3: verification review is backend-driven only.
                                    // The verification-review endpoint transitions the phase
                                    // (complete -> VERIFICATION_COMPLETE, return -> QA_REVIEW)
                                    // and notifies downstream roles; no localStorage handoff
                                    // queues are written.
                                    if (selectedProject?.id) {
                                        verificationMutation.mutate({
                                            taskId: selectedProject?.id,
                                            action: statusValue === "Changing" ? "return" : "complete",
                                            remarks: remarksValue,
                                        });
                                    } else {
                                        setIsStatusDialogOpen(false);
                                        setStatusValue("");
                                        setLevelValue("");
                                        setRemarksValue("");
                                    }
                                }}
                                disabled={!selectedProject || !statusValue || statusValue === "Choose..." || verificationMutation.isPending}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-semibold shadow-sm"
                            >
                                {verificationMutation.isPending ? "Saving..." : "Verify & Save"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Projects Overview Dialog */}
                <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                    <DialogContent className="max-w-[1000px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-xl dark:bg-zinc-900">
                        <DialogHeader className="bg-white px-8 py-5 flex flex-row items-center justify-between border-b dark:bg-zinc-900">
                            <DialogTitle className="text-[20px] font-bold text-gray-800 uppercase tracking-wide dark:text-zinc-100">Projects Verification Detail</DialogTitle>
                        </DialogHeader>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-10">
                            {/* Left Side: Summary & Details */}
                            <div className="space-y-8">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                                            <Briefcase className="h-9 w-9 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-[22px] font-bold text-gray-900 uppercase leading-tight dark:text-zinc-100">{detailProject?.company || "SAMPLE COMPANY"}</h3>
                                            <p className="text-[15px] text-gray-500 font-medium dark:text-zinc-400">{detailProject?.tasker || "Sample Tasker"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 pt-1">
                                        <Calendar className="h-5 w-5 text-[#00a65a] dark:text-zinc-400" />
                                        <div className="text-right">
                                            <p className="text-[14px] font-bold text-gray-700 dark:text-zinc-400">Upload Date</p>
                                            <p className="text-[13px] text-gray-500 whitespace-nowrap dark:text-zinc-400">{detailProject?.time ? `26 Jan 2026 ${detailProject.time}` : "26 Jan 2026 05:57 PM"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-5 pt-4">
                                    <h4 className="text-[18px] font-bold text-gray-800 border-b pb-2 dark:text-zinc-100">Project Details :</h4>
                                    <div className="grid gap-3">
                                        <DetailRow label="Product_detail_add" value="9544" />
                                        <DetailRow label="Company" value={detailProject?.company || "Sample Company"} />
                                        <DetailRow label="Package" value="Basic Plus" />
                                        <DetailRow label="Web_url" value="" />
                                        <DetailRow label="Phone" value="03216129190" />
                                        <DetailRow label="Mobile" value="03216129190" />
                                        <DetailRow label="Address" value="" />
                                        <DetailRow label="Referance_web" value="" />
                                        <DetailRow label="Categories" value="" />
                                        <DetailRow label="Detail" value="" />
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Attached Files */}
                            <div className="space-y-6 lg:border-l lg:pl-10">
                                <h4 className="text-[18px] font-bold text-gray-800 flex items-center gap-2 dark:text-zinc-100">
                                    Attached Files
                                </h4>
                                <div className="space-y-4">
                                    <div
                                        onClick={() => {
                                            // Simulate a real file download
                                            const content = "Project Data for " + (detailProject?.company || "Sample Company");
                                            const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                                            const url = URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', 'Data.xlsx');
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            URL.revokeObjectURL(url);
                                        }}
                                        className="flex items-center justify-between p-4 bg-white rounded-lg border shadow-sm group hover:border-[#00a65a] transition-all cursor-pointer dark:bg-zinc-900"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Data.xlsx</p>
                                                <p className="text-[12px] text-gray-500 dark:text-zinc-400">Size : 133 KB</p>
                                            </div>
                                        </div>
                                        <div className="p-2 text-gray-400 group-hover:text-[#00a65a] transition-colors">
                                            <Download className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-8 py-5 flex justify-end gap-3 border-t dark:bg-zinc-900">
                            <Button
                                variant="secondary"
                                onClick={() => setIsDetailDialogOpen(false)}
                                className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-700 px-8 h-12 font-bold transition-all shadow-sm dark:bg-zinc-900 dark:text-zinc-400"
                            >
                                CLOSE
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Links Dialog */}
                <Dialog open={isLinksDialogOpen} onOpenChange={setIsLinksDialogOpen}>
                    <DialogContent className="max-w-[1100px] p-0 overflow-hidden border-none shadow-2xl bg-white rounded-xl dark:bg-zinc-900">
                        <DialogHeader className="bg-white px-8 py-5 flex flex-row items-center justify-between border-b dark:bg-zinc-900">
                            <DialogTitle className="text-[20px] font-bold text-gray-800 dark:text-zinc-100">Links</DialogTitle>
                        </DialogHeader>

                        <div className="p-8 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-3">
                                {(() => {
                                    const evidenceLinks = (() => {
                                        if (linksProject?.raw?.evidenceLinks && linksProject.raw.evidenceLinks.length > 0) {
                                            return linksProject.raw.evidenceLinks.map((link: any) => ({
                                                url: link.url,
                                                label: link.label || null
                                            }));
                                        }
                                        if (linksProject?.links && linksProject.links.length > 0) {
                                            return linksProject.links.map((url: string) => ({
                                                url,
                                                label: null
                                            }));
                                        }
                                        if (linksProject?.qaLinks) {
                                            const urlList = typeof linksProject.qaLinks === 'string'
                                                ? linksProject.qaLinks.split('\n').map((l: string) => l.trim()).filter(Boolean)
                                                : (Array.isArray(linksProject.qaLinks) ? linksProject.qaLinks : []);
                                            if (urlList.length > 0) {
                                                return urlList.map((url: string) => ({
                                                    url,
                                                    label: null
                                                }));
                                            }
                                        }
                                        return null;
                                    })();

                                    if (evidenceLinks && evidenceLinks.length > 0) {
                                        return evidenceLinks.map((link: any, idx: number) => (
                                            <div key={idx} className="flex items-start gap-2 text-[15px] font-medium leading-relaxed">
                                                <span className="text-gray-500 min-w-[25px] dark:text-zinc-400">{idx + 1}.</span>
                                                <div className="flex-1 min-w-0">
                                                    {link.label && (
                                                        <span className="text-gray-400 dark:text-zinc-500 mr-2 font-bold bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[12px] uppercase">
                                                            {link.label}
                                                        </span>
                                                    )}
                                                    <a
                                                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#00a65a] hover:underline break-all dark:text-zinc-400 font-semibold"
                                                    >
                                                        {link.url}
                                                    </a>
                                                </div>
                                            </div>
                                        ));
                                    } else {
                                        return (
                                            <div className="py-6 text-center text-gray-400 dark:text-zinc-500 italic">
                                                No evidence links have been submitted for this task yet.
                                            </div>
                                        );
                                    }
                                })()}
                            </div>

                            {linksProject?.id && (
                                <div className="mt-6">
                                    <WorkflowTimeline taskId={linksProject.id} module="product-posting" />
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 px-8 py-5 flex justify-end border-t dark:bg-zinc-900">
                            <Button
                                variant="secondary"
                                onClick={() => setIsLinksDialogOpen(false)}
                                className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-700 px-8 h-12 font-bold transition-all shadow-sm uppercase dark:bg-zinc-900 dark:text-zinc-400"
                            >
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 text-[14px]">
            <span className="font-bold text-gray-600 min-w-[150px] dark:text-zinc-300">{label}</span>
            <span className="text-gray-400">&gt;</span>
            <span className="text-gray-700 font-medium dark:text-zinc-400">{value}</span>
        </div>
    );
}
