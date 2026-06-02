import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Play, ArrowUpCircle, Clock, ExternalLink, PlayCircle, Eye, Plus, CheckCircle2, Briefcase, Download, FileText, TimerReset } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface ProjectStatus {
    id: string;
    company: string;
    assign: string;
    project: string;
    status: string;
    amount: string;
    invoiceStatus: string;
    date: string;
    totalTasks?: number;
    totalTime?: string;
}

const MOCK_FALLBACK_TASKS = [
    {
        id: "task-mock-1",
        title: "Keyword Research & Analysis",
        description: "Comprehensive keyword research for Alibaba minisite ranking.",
        status: "InProgress",
        createdAt: new Date().toISOString(),
        timerStartedAt: new Date(Date.now() - 3600000).toISOString(),
        notes: JSON.stringify({ duration: "120", links: "http://example.com" })
    },
    {
        id: "task-mock-2",
        title: "Product Listing Setup",
        description: "Setup 50 new products with attributes and optimized descriptions.",
        status: "ToDo",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        timerStartedAt: null,
        notes: JSON.stringify({ duration: "240", links: "" })
    },
    {
        id: "task-mock-3",
        title: "Competitor Market Analysis",
        description: "Analyze top 5 competitors on Alibaba for pricing variations.",
        status: "Completed",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        timerStartedAt: null,
        notes: JSON.stringify({ duration: "60", links: "http://alibabacompetitor.com" })
    }
];

export default function PmsStatus() {
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isProjectOverviewOpen, setIsProjectOverviewOpen] = useState(false);
    const [isEndTaskModalOpen, setIsEndTaskModalOpen] = useState(false);
    const [finishingTaskId, setFinishingTaskId] = useState<string | null>(null);
    const [endTaskForm, setEndTaskForm] = useState({
        links: [""],
        isShowcase: false,
        type: "",
        detail: ""
    });
    const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
    const [overtimeTaskId, setOvertimeTaskId] = useState<string | null>(null);
    const [overtimeForm, setOvertimeForm] = useState({ minutes: "60", reason: "" });

    const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});
    const queryClient = useQueryClient();

    const { data: projects = [], isLoading } = useQuery<ProjectStatus[]>({
        queryKey: ["/api/pms/department-status"],
    });

    const { data: projectTasks = [], isLoading: isLoadingTasks } = useQuery<any[]>({
        queryKey: ["project-tasks-direct", selectedProjectId],
        enabled: !!selectedProjectId && isDetailsModalOpen,
        queryFn: async () => {
            const res = await fetch(`/api/pms/project-tasks/${selectedProjectId}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch tasks");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    });

    // Mutations for timer
    const startTimerMutation = useMutation({
        mutationFn: async (taskId: string) => {
            if (taskId.startsWith("task-mock")) {
                // Simulate backend behavior for mock tasks
                return new Promise(resolve => setTimeout(() => resolve({ success: true }), 300));
            }
            const res = await fetch(`/api/tasks/${taskId}/timers/start`, { method: "POST" });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Failed to start timer");
            }
            return res.json();
        },
        onSuccess: (_data, taskId) => {
            if (taskId.startsWith("task-mock")) {
                const updatedTasks = projectTasks.map((t: any) => 
                    t.id === taskId ? { ...t, timerStartedAt: new Date().toISOString(), status: "InProgress" } : t
                );
                queryClient.setQueryData(["/api/pms/tasks", { projectId: selectedProjectId }], updatedTasks);
            } else {
                queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks", { projectId: selectedProjectId }] });
            }
            toast({ title: "Timer started" });
        },
        onError: (err: any) => toast({ title: "Timer Error", description: err.message, variant: "destructive" })
    });

    const stopTimerMutation = useMutation({
        mutationFn: async (taskId: string) => {
            if (taskId.startsWith("task-mock")) {
                return new Promise(resolve => setTimeout(() => resolve({ success: true }), 300));
            }
            const res = await fetch(`/api/tasks/${taskId}/timers/stop`, { method: "POST" });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Failed to stop timer");
            }
            return res.json();
        },
        onSuccess: (_data, taskId) => {
            if (taskId.startsWith("task-mock")) {
                const currentTasks = projectTasks.length > 0 ? projectTasks : MOCK_FALLBACK_TASKS;
                const updatedTasks = currentTasks.map((t: any) => 
                    t.id === taskId ? { ...t, timerStartedAt: null } : t
                );
                queryClient.setQueryData(["/api/pms/tasks", { projectId: selectedProjectId }], updatedTasks);
            } else {
                queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks", { projectId: selectedProjectId }] });
            }
            toast({ title: "Timer stopped" });
        },
        onError: (err: any) => toast({ title: "Timer Error", description: err.message, variant: "destructive" })
    });

    const completeTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            if (taskId.startsWith("task-mock")) {
                return new Promise(resolve => setTimeout(() => resolve({ success: true }), 500));
            }
            
            const validLinks = endTaskForm.links.filter((l: string) => l.trim() !== "");
            const res = await fetch(`/api/tasks/${taskId}/complete`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    linksPosted: validLinks.length, 
                    outputNotes: JSON.stringify({ links: validLinks }) 
                })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Failed to complete task");
            }
            return res.json();
        },
        onSuccess: (_data, taskId) => {
            const currentTasks = projectTasks.length > 0 ? projectTasks : MOCK_FALLBACK_TASKS;
            const updatedTasks = currentTasks.map((t: any) => 
                t.id === taskId ? { ...t, status: "Completed", timerStartedAt: null } : t
            );

            if (taskId.startsWith("task-mock")) {
                queryClient.setQueryData(["/api/pms/tasks", { projectId: selectedProjectId }], updatedTasks);
            } else {
                queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks", { projectId: selectedProjectId }] });
            }

            // Automatically transfer to D&D Manager queue (Monthly Complete Project) if all tasks finished!
            if (updatedTasks.every((t: any) => t.status === "Completed" || t.status === "Done")) {
                try {
                    const saved = JSON.parse(localStorage.getItem('dd-projects') || '[]');
                    const projectName = selectedProjectInfo?.project || "Project";
                    if (!saved.some((p: any) => p.name === projectName)) {
                        saved.unshift({
                            id: selectedProjectInfo?.id ? selectedProjectInfo.id.slice(0, 4) : Math.floor(1000 + Math.random() * 9000).toString(),
                            name: projectName,
                            company: selectedProjectInfo?.company || "Company",
                            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                            status: "Pending",
                            taskTime: "4:0",
                            spentTime: "0:0:0",
                            links: endTaskForm.links.filter((l: string) => l.trim() !== "")
                        });
                        localStorage.setItem('dd-projects', JSON.stringify(saved));
                        setTimeout(() => {
                            setIsDetailsModalOpen(false);
                        }, 500);
                    }
                } catch (e) {}
            }
            
            toast({ title: "Task completed successfully" });
        },
        onError: (err: any) => toast({ title: "Completion Error", description: err.message, variant: "destructive" })
    });

    const displayTasks = projectTasks;

    const requestOvertimeMutation = useMutation({
        mutationFn: async (data: { taskId: string, requestedMinutes: number, reason: string }) => {
            const res = await fetch(`/api/product-posting/tasks/${data.taskId}/request-overtime`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestedMinutes: data.requestedMinutes, reason: data.reason })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || "Failed to request overtime");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Overtime requested successfully" });
            setIsOvertimeModalOpen(false);
            setOvertimeForm({ minutes: "60", reason: "" });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/tasks", { projectId: selectedProjectId }] });
        },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });

    // Timer ticking effect
    useEffect(() => {
        const interval = setInterval(() => {
            const newElapsed: Record<string, number> = {};
            displayTasks.forEach((task: any) => {
                if (task.timerStartedAt) {
                    const start = new Date(task.timerStartedAt instanceof Date ? task.timerStartedAt : String(task.timerStartedAt)).getTime();
                    if (!isNaN(start)) {
                        newElapsed[task.id] = Math.floor((Date.now() - start) / 1000);
                    }
                }
            });
            setElapsedTimes(newElapsed);
        }, 1000);
        return () => clearInterval(interval);
    }, [displayTasks]);

    const formatElapsed = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m}:${s}`;
    };

    const selectedProjectInfo = projects.find(p => p.id === selectedProjectId);

    // End task validation logic
    let endTaskExpectedLinks = 0;
    const taskToFinish = displayTasks.find((t: any) => t.id === finishingTaskId);
    if (taskToFinish?.notes) {
        try {
            const metadata = JSON.parse(taskToFinish.notes);
            if (metadata.links) {
                const parsedLinks = Number(metadata.links);
                if (!isNaN(parsedLinks)) {
                    endTaskExpectedLinks = parsedLinks;
                } else {
                    endTaskExpectedLinks = metadata.links.split(',').filter((l: string) => l.trim()).length;
                }
            }
        } catch(e) {}
    }

    const providedLinksCount = endTaskForm.links.map(l => l.trim()).filter(l => l).length;
    const hasValidLinksCount = endTaskExpectedLinks === 0 || providedLinksCount === endTaskExpectedLinks;

    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    const hasInvalidUrls = endTaskForm.links.some(link => link.trim() && !urlRegex.test(link.trim()));

    const isEndTaskSaveDisabled = completeTaskMutation.isPending || !hasValidLinksCount || hasInvalidUrls;

    const { data: userData } = useQuery({
        queryKey: ["/api/auth/me"],
    });

    const userRoleName = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
    const role = ((userData as any)?.role || userRoleName).toLowerCase();
    
    let departmentTitle = "RUNNING PROJECT";
    if (role.includes("software_executive")) {
        departmentTitle = "RUNNING PROJECT";
    } else if (role.includes("software_manager")) {
        departmentTitle = "RUNNING PROJECT";
    }

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans flex flex-col dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 flex-shrink-0 dark:text-zinc-400">
                {departmentTitle}
            </h1>

            {/* Filter Section */}
            <div className="bg-white rounded border border-gray-100 p-6 shadow-sm flex-shrink-0 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Department</label>
                        <Select>
                            <SelectTrigger className="h-10 text-[13px] text-gray-500 dark:text-zinc-400">
                                <SelectValue placeholder="Choose ..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="seo">SEO/SMM</SelectItem>
                                <SelectItem value="dev">Development</SelectItem>
                                <SelectItem value="design">Design</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Select City</label>
                        <Select>
                            <SelectTrigger className="h-10 text-[13px] text-gray-500 dark:text-zinc-400">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="isb">Islamabad</SelectItem>
                                <SelectItem value="lhr">Lahore</SelectItem>
                                <SelectItem value="khi">Karachi</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Select Status</label>
                        <Select>
                            <SelectTrigger className="h-10 text-[13px] text-gray-500 dark:text-zinc-400">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="renewal">Renewal</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Start Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                                onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                            />
                            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">End Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                                onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                            />
                            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
                <div>
                    <Button className="h-10 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide">
                        View
                    </Button>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white rounded border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-400 dark:border-zinc-800">
                    List
                </div>
                <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                    <Table className="w-full border-collapse">
                        <TableHeader>
                            <TableRow className="bg-[#daf1e2] hover:bg-[#daf1e2] border-0 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 first:rounded-l w-[60px] dark:text-zinc-100">No#</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Company</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Person</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Project</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Status</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Doc Upload</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Dep Approved</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center last:rounded-r dark:text-zinc-100">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-gray-500 dark:text-zinc-400">
                                        Loading project status...
                                    </TableCell>
                                </TableRow>
                            ) : projects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-gray-500 dark:text-zinc-400">
                                        No projects found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                projects.map((row, idx) => (
                                    <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 text-[13px] dark:border-zinc-800">
                                        <TableCell className="px-4 py-4 font-bold text-gray-500 dark:text-zinc-400">{idx + 1}</TableCell>
                                        <TableCell className="px-4 py-4 font-bold text-[#495057] text-center dark:text-zinc-400">{row.company}</TableCell>
                                        <TableCell className="px-4 py-4 font-bold text-emerald-600 text-center">{row.assign || "Not Assigned"}</TableCell>
                                        <TableCell className="px-4 py-4 font-bold text-gray-600 text-center dark:text-zinc-300">{row.project}</TableCell>
                                        <TableCell className="px-4 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tight ${
                                                row.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 
                                                row.status === 'Active' ? 'bg-blue-100 text-blue-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {row.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-center">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tight bg-slate-100 text-slate-600 dark:text-zinc-300 dark:bg-zinc-900">
                                                {row.status === 'Documents Pending' ? 'Pending' : 'Yes'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-center">
                                            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-tight bg-emerald-100 text-emerald-700">
                                                Yes
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-center">
                                            <Button 
                                                variant="ghost" 
                                                className="h-8 w-8 p-0 hover:bg-slate-100 rounded-full dark:hover:bg-zinc-800"
                                                onClick={() => {
                                                    setSelectedProjectId(row.id);
                                                    setIsDetailsModalOpen(true);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 text-emerald-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Project Details Modal */}
            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="max-w-[95vw] w-[1200px] bg-[#f8f9fc] p-0 border-none overflow-hidden rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="p-6 bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                        <h2 className="text-[18px] font-bold text-[#495057] uppercase tracking-wider flex items-center gap-3 dark:text-zinc-400">
                            PROJECT DETAILS VERIFY & START WORKING
                        </h2>
                    </div>
                    
                    <div className="p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-[15px] font-bold text-[#495057] dark:text-zinc-400">Assign Projects</h3>
                        </div>

                        <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-[#e9ebf7] hover:bg-[#e9ebf7] border-0 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Task No</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Task</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Time</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Working Links</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Assign Time</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Details</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center dark:text-zinc-100">Status</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-4 text-center last:rounded-r dark:text-zinc-100">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingTasks ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-20 text-gray-400 font-medium">Fetching project tasks...</TableCell>
                                        </TableRow>
                                    ) : displayTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                                                        <span className="text-amber-400 text-2xl">⚠</span>
                                                    </div>
                                                    <p className="text-[14px] font-bold text-gray-500">No Tasks Assigned</p>
                                                    <p className="text-[12px] text-gray-400">Is project mein koi task assign nahi hai. PMS module se tasks assign karein.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : displayTasks.map((task: any, idx: number) => {
                                            let durationText = "8:0";
                                            let linksCount = 0;
                                            try {
                                                if (task.notes) {
                                                    const metadata = JSON.parse(task.notes);
                                                    if (metadata.duration) {
                                                        const mins = parseInt(metadata.duration);
                                                        durationText = `${Math.floor(mins / 60)}:${mins % 60}`;
                                                    }
                                                    if (metadata.links) {
                                                        const parsedLinks = Number(metadata.links);
                                                        if (!isNaN(parsedLinks)) {
                                                            linksCount = parsedLinks;
                                                        } else {
                                                            linksCount = metadata.links.split(',').filter((l: string) => l.trim()).length;
                                                        }
                                                    }
                                                }
                                            } catch (e) {}
                                            // Check description for "Links: N" pattern (e.g. "done Links: 7")
                                            if (linksCount === 0 && task.description) {
                                                const descMatch = String(task.description).match(/links[\s:]+(\d+)/i);
                                                if (descMatch) linksCount = parseInt(descMatch[1]);
                                            }

                                            return (
                                                <TableRow key={task.id} className="hover:bg-gray-50/50 transition-colors border-0 border-b border-gray-50/50 text-[13px] dark:border-zinc-800">
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className="font-bold text-gray-500 dark:text-zinc-400">{task.id ? String(task.id).slice(0, 5) : (idx + 1)}</span>
                                                            <a href="#" className="text-[11px] font-bold text-rose-400 hover:text-rose-500 flex items-center gap-1">
                                                                Open URL
                                                            </a>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-gray-700 dark:text-zinc-300 uppercase text-[12px]">{task.title || task.name || "Task"}</span>
                                                            <div className="text-[11px] font-medium text-slate-400 flex flex-col">
                                                                <span>Type: <span className="text-slate-500 uppercase dark:text-zinc-400">{selectedProjectInfo?.project || task.project?.name || "—"}</span></span>
                                                                <span className="flex items-center gap-1">Detail: <span className="text-slate-500 tracking-tight normal-case line-clamp-1 max-w-[200px] inline-block dark:text-zinc-400">{task.description || "—"}</span></span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold text-[11px] dark:text-zinc-400 dark:bg-zinc-900">{durationText}</span>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        {(() => {
                                                            // Try to get actual clickable links
                                                            let actualLinks: string[] = [];
                                                            try {
                                                                // Check task.notes for manager-assigned links
                                                                if (task.notes) {
                                                                    const parsed = JSON.parse(task.notes);
                                                                    if (parsed.links) {
                                                                        let candidates: string[] = [];
                                                                        if (Array.isArray(parsed.links)) {
                                                                            candidates = parsed.links.map((l: string) => String(l).trim()).filter(Boolean);
                                                                        } else if (typeof parsed.links === 'string' && parsed.links.trim()) {
                                                                            candidates = parsed.links.split(',').map((l: string) => l.trim()).filter(Boolean);
                                                                        }
                                                                        // Only treat as actual URLs if they look like URLs (not pure numbers)
                                                                        actualLinks = candidates.filter((l: string) =>
                                                                            isNaN(Number(l)) && (l.includes('.') || l.includes('http'))
                                                                        );
                                                                    }
                                                                }
                                                            } catch (e) {}

                                                            if (actualLinks.length > 0) {
                                                                return (
                                                                    <div className="flex flex-col gap-1 items-center">
                                                                        {actualLinks.map((link, i) => (
                                                                            <a
                                                                                key={i}
                                                                                href={link.startsWith('http') ? link : `https://${link}`}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 underline max-w-[140px] truncate block"
                                                                                title={link}
                                                                            >
                                                                                {link.replace(/^https?:\/\//, '').slice(0, 22)}...
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            // Fallback: show count badge
                                                            return (
                                                                <div className="w-6 h-6 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                                                                    <span className="text-[11px] font-bold text-indigo-400">{linksCount}</span>
                                                                </div>
                                                            );
                                                        })()}
 
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center text-gray-500 font-bold text-[12px] dark:text-zinc-400">
                                                        {new Date(task.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <button 
                                                            onClick={() => setIsProjectOverviewOpen(true)}
                                                            className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-emerald-100 mx-auto"
                                                        >
                                                            <ArrowUpCircle className="h-5 w-5 text-white" />
                                                        </button>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <span className="bg-amber-50 text-amber-500 px-3 py-1 rounded-md font-bold text-[11px] border border-amber-100 italic">
                                                            {task.status || 'Pending'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <div className="flex items-center justify-center gap-2 relative">
                                                            <div className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap ${task.timerStartedAt ? 'bg-emerald-400 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600'} text-[10px] px-2 py-0.5 rounded-full font-black border border-emerald-200/50 shadow-sm transition-colors`}>
                                                                {task.timerStartedAt ? formatElapsed(elapsedTimes[task.id] || 0) : '0:0:0'}
                                                            </div>
                                                            <button 
                                                                className={`w-10 h-10 ${task.timerStartedAt ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'} rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg`}
                                                                onClick={() => {
                                                                    if (task.timerStartedAt) stopTimerMutation.mutate(task.id);
                                                                    else startTimerMutation.mutate(task.id);
                                                                }}
                                                                disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
                                                            >
                                                                {task.timerStartedAt ? (
                                                                    <div className="w-3 h-3 bg-white rounded-sm shadow-inner dark:bg-zinc-900" />
                                                                ) : (
                                                                    <PlayCircle className="h-6 w-6 text-white fill-white/10" />
                                                                )}
                                                            </button>

                                                            {/* Done/Plus Button - only visible when timer has been run once (status is InProgress) and is currently stopped */}
                                                            {!task.timerStartedAt && task.status === 'InProgress' && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setFinishingTaskId(task.id);
                                                                        setIsEndTaskModalOpen(true);
                                                                    }}
                                                                    disabled={completeTaskMutation.isPending}
                                                                    className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-emerald-100"
                                                                >
                                                                    <Plus className="h-6 w-6 text-white stroke-[3]" />
                                                                </button>
                                                            )}
                                                            
                                                            {/* Overtime Button */}
                                                            {task.status !== 'Completed' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setOvertimeTaskId(task.id);
                                                                        setIsOvertimeModalOpen(true);
                                                                    }}
                                                                    className="w-10 h-10 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-amber-100"
                                                                    title="Request Overtime"
                                                                >
                                                                    <TimerReset className="h-5 w-5 text-white" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    }
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
                    
            {/* End Task Modal (Moved to sibling to prevent focus infinite loop) */}
            <Dialog open={isEndTaskModalOpen} onOpenChange={setIsEndTaskModalOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden font-sans">
                    <div className="p-4 border-b bg-white dark:bg-zinc-900">
                        <h2 className="text-[18px] font-bold text-gray-700 dark:text-zinc-400">End Task</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setEndTaskForm(prev => ({ ...prev, links: [...prev.links, ""] }))}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 py-2 rounded text-[13px] font-bold"
                            >
                                Add Link
                            </button>
                            <button 
                                onClick={() => setEndTaskForm(prev => ({ ...prev, links: prev.links.slice(0, -1) }))}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 py-2 rounded text-[13px] font-bold"
                            >
                                Remove Link
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Links:</label>
                                <div className="space-y-2">
                                    {endTaskForm.links.map((link, idx) => (
                                        <Input 
                                            key={idx}
                                            value={link}
                                            onChange={(e) => {
                                                const newLinks = [...endTaskForm.links];
                                                newLinks[idx] = e.target.value;
                                                setEndTaskForm(prev => ({ ...prev, links: newLinks }));
                                            }}
                                            className="h-10 text-[13px] border-gray-200 dark:border-zinc-800"
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input 
                                    type="checkbox" 
                                    id="showcase"
                                    checked={endTaskForm.isShowcase}
                                    onChange={(e) => setEndTaskForm(prev => ({ ...prev, isShowcase: e.target.checked }))}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-800"
                                />
                                <label htmlFor="showcase" className="text-[13px] font-medium text-gray-600 dark:text-zinc-300">
                                    Select if product is showcase
                                </label>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Type:</label>
                                <Select value={endTaskForm.type} onValueChange={(v) => setEndTaskForm(prev => ({ ...prev, type: v }))}>
                                    <SelectTrigger className="h-10 text-[13px] border-gray-200 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Website">Website</SelectItem>
                                        <SelectItem value="SEO">SEO</SelectItem>
                                        <SelectItem value="Social Media">Social Media</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Detail:</label>
                                <textarea 
                                    value={endTaskForm.detail}
                                    onChange={(e) => setEndTaskForm(prev => ({ ...prev, detail: e.target.value }))}
                                    className="w-full border border-gray-200 rounded min-h-[100px] p-3 text-[13px] outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t bg-slate-50 flex items-center justify-between gap-3 dark:bg-zinc-900">
                        <div className="text-[12px] font-medium text-rose-500">
                            {!hasValidLinksCount && endTaskExpectedLinks > 0 && (
                                <span>* You must provide exactly {endTaskExpectedLinks} link(s).</span>
                            )}
                            {hasValidLinksCount && hasInvalidUrls && (
                                <span>* One or more provided links are invalid URLs.</span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsEndTaskModalOpen(false)}
                                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[14px] font-bold transition-colors dark:bg-zinc-900 dark:text-zinc-400"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => {
                                    if (finishingTaskId && !isEndTaskSaveDisabled) {
                                        if (window.confirm("Are you sure you want to end this task?")) {
                                            completeTaskMutation.mutate(finishingTaskId);
                                            setIsEndTaskModalOpen(false);
                                        }
                                    }
                                }}
                                disabled={isEndTaskSaveDisabled}
                                className={`px-6 py-2 rounded text-[14px] font-bold transition-colors ${
                                    isEndTaskSaveDisabled 
                                        ? "bg-gray-300 text-gray-500 dark:text-slate-400 cursor-not-allowed" 
                                        : "bg-[#00a65a] hover:bg-[#008d4c] text-white shadow-md shadow-emerald-100"
                                }`}
                            >
                                {completeTaskMutation.isPending ? "Saving..." : "Save"}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Overtime Modal */}
            <Dialog open={isOvertimeModalOpen} onOpenChange={setIsOvertimeModalOpen}>
                <DialogContent className="max-w-md p-0 overflow-hidden font-sans">
                    <div className="p-4 border-b bg-white dark:bg-zinc-900">
                        <h2 className="text-[18px] font-bold text-gray-700 dark:text-zinc-400">Request Overtime</h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Additional Minutes:</label>
                                <Input 
                                    type="number"
                                    value={overtimeForm.minutes}
                                    onChange={(e) => setOvertimeForm(prev => ({ ...prev, minutes: e.target.value }))}
                                    className="h-10 text-[13px] border-gray-200 dark:border-zinc-800"
                                    min="1"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Reason for Overtime:</label>
                                <textarea 
                                    value={overtimeForm.reason}
                                    onChange={(e) => setOvertimeForm(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full border border-gray-200 rounded min-h-[100px] p-3 text-[13px] outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800"
                                    placeholder="Please explain why more time is needed..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 dark:bg-zinc-900">
                        <button 
                            onClick={() => setIsOvertimeModalOpen(false)}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[14px] font-bold transition-colors dark:bg-zinc-900 dark:text-zinc-400"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => {
                                if (overtimeTaskId) requestOvertimeMutation.mutate({ 
                                    taskId: overtimeTaskId, 
                                    requestedMinutes: parseInt(overtimeForm.minutes) || 0,
                                    reason: overtimeForm.reason
                                });
                            }}
                            disabled={requestOvertimeMutation.isPending || !overtimeForm.reason.trim()}
                            className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-[14px] font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
                        >
                            {requestOvertimeMutation.isPending ? "Submitting..." : "Submit Request"}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Project Overview Modal */}
            <Dialog open={isProjectOverviewOpen} onOpenChange={setIsProjectOverviewOpen}>
                <DialogContent className="max-w-[95vw] w-[950px] bg-white p-0 border-none overflow-hidden rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between dark:border-zinc-800">
                        <h2 className="text-[14px] font-bold text-gray-500 uppercase tracking-wider dark:text-zinc-400">
                            PROJECTS OVERVIEW
                        </h2>
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10 bg-white dark:bg-zinc-900">
                        <div className="lg:col-span-2 space-y-8">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className="w-[60px] h-[60px] bg-[#4285F4] rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
                                        <Briefcase className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-[20px] font-bold text-gray-900 dark:text-zinc-100">
                                            {selectedProjectInfo?.company} {selectedProjectInfo?.assign ? `Ã¢â‚¬Â¢ ${selectedProjectInfo.assign}` : ''}
                                        </h3>
                                        <p className="text-[13px] font-medium text-gray-400 mt-1">N/A</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <CalendarIcon className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Upload Date</p>
                                        <p className="text-[13px] font-medium text-gray-600 mt-0.5 dark:text-zinc-300">{selectedProjectInfo?.date || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                    <h4 className="text-[18px] font-bold text-gray-800 dark:text-zinc-100">Project Details :</h4>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Product_detail_add</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            {selectedProjectInfo?.id ? selectedProjectInfo.id.slice(0, 5) : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Company</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            {selectedProjectInfo?.company || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Package</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            {selectedProjectInfo?.project || 'Basic'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Web_url</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            http://localhost:5000/pms/approvals
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Phone</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            031245698574
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Mobile</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            031245698574
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Address</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            145
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[180px_auto] text-[14px]">
                                        <div className="text-gray-500 font-medium dark:text-zinc-400">Categories</div>
                                        <div className="text-gray-900 font-bold flex items-center gap-4 dark:text-zinc-100">
                                            <span className="text-gray-300 mx-2">&gt;</span>
                                            minisite
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <label className="block text-[14px] font-bold text-gray-700 mb-2 dark:text-zinc-400">Rejection Reason (if rejecting)</label>
                                <textarea 
                                    className="w-full border-2 border-slate-700 rounded-lg min-h-[100px] p-4 text-[13px] text-gray-600 outline-none resize-none shadow-sm dark:text-zinc-300 dark:border-zinc-800"
                                    placeholder="Enter reason for rejection..."
                                />
                            </div>
                        </div>

                        <div className="bg-[#f8f9fc] rounded-2xl p-6 border border-gray-100 flex flex-col h-max dark:border-zinc-800 dark:bg-zinc-900">
                            <h4 className="text-[14px] font-extrabold text-gray-800 mb-6 tracking-wide dark:text-zinc-100">ATTACHED FILES</h4>
                            
                            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between mb-6 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors dark:bg-zinc-900">
                                        <FileText className="w-6 h-6 text-gray-500 group-hover:text-emerald-500 dark:text-zinc-400" />
                                    </div>
                                    <div>
                                        <h5 className="text-[14px] font-bold text-gray-900 mb-0.5 dark:text-zinc-100">Requirements.docx</h5>
                                        <p className="text-[12px] font-medium text-slate-400">Project Documentation</p>
                                    </div>
                                </div>
                                <button className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-colors dark:hover:bg-zinc-800">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>

                            <button className="w-full py-4 rounded-xl border-2 border-dashed border-gray-200 text-[13px] font-medium text-gray-400 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all dark:border-zinc-800">
                                Click to view all attachments
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}



