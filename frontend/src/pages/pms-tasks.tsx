import { useState, useEffect, useRef } from "react";
import { useModuleData } from "@/hooks/use-module-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Play, ArrowUpCircle, Clock, PlayCircle, Eye, Plus, Briefcase, Download, FileText, TimerReset, Upload, Paperclip } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson } from "@/lib/queryClient";

// Same "links inside task.notes" parsing already used inline in the Working
// Links table column — pulled out here so the Files modal's "Provided
// Files" panel can show the same data without duplicating the parse logic
// at both call sites from scratch.
function extractProvidedLinks(task: any): string[] {
    try {
        if (task?.notes) {
            const parsed = JSON.parse(task.notes);
            if (parsed.links) {
                let candidates: string[] = [];
                if (Array.isArray(parsed.links)) {
                    candidates = parsed.links.map((l: string) => String(l).trim()).filter(Boolean);
                } else if (typeof parsed.links === "string" && parsed.links.trim()) {
                    candidates = parsed.links.split(",").map((l: string) => l.trim()).filter(Boolean);
                }
                return candidates.filter((l: string) => isNaN(Number(l)) && (l.includes(".") || l.includes("http")));
            }
        }
    } catch (e) { }
    return [];
}

// Task Creation — replaced its old generic drag-and-drop Kanban board with
// the same company/project list + "view" action + timer-driven task modal
// design as Project Status (pms-status.tsx), on the user's explicit request
// to have the two pages match. Reuses the exact same real, working
// endpoints that page already proved out (department-status, project-tasks,
// timers/start|stop, complete, extensions, time-logs, tasks/meta) rather
// than the old board's own /api/pms/tasks/board.
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

export default function PmsTasks() {
    useModuleData("/pms/tasks");

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [filesModalTask, setFilesModalTask] = useState<any>(null);
    const [finishingTaskId, setFinishingTaskId] = useState<string | null>(null);
    const [endTaskConfirmOpen, setEndTaskConfirmOpen] = useState(false);
    const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);
    const [overtimeTaskId, setOvertimeTaskId] = useState<string | null>(null);
    const [overtimeForm, setOvertimeForm] = useState({ minutes: "60", reason: "" });

    const NEW_TASK_INITIAL_STATE = { title: "", description: "", assignedToUserId: "unassigned", priority: "Medium", dueDate: "" };
    const [isAddTaskFormOpen, setIsAddTaskFormOpen] = useState(false);
    const [newTaskForm, setNewTaskForm] = useState(NEW_TASK_INITIAL_STATE);

    const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: projects = [], isLoading, isError, error } = useQuery<ProjectStatus[]>({
        queryKey: ["/api/pms/department-status"],
        queryFn: async () => {
            const res = await fetch("/api/pms/department-status", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch project status");
            return res.json();
        },
    });

    const { data: projectTasks = [], isLoading: isLoadingTasks, isError: isTasksError, error: tasksError } = useQuery<any[]>({
        queryKey: ["project-tasks-direct", selectedProjectId],
        enabled: !!selectedProjectId && isDetailsModalOpen,
        queryFn: async () => {
            const data = await apiRequestJson<any[]>("GET", `/api/pms/project-tasks/${selectedProjectId}`);
            return Array.isArray(data) ? data : [];
        }
    });

    const { data: timeLogs = [], isLoading: isLoadingLogs } = useQuery<any[]>({
        queryKey: ["project-time-logs", selectedProjectId, projectTasks.map((t: any) => t.id).join(",")],
        enabled: !!selectedProjectId && isDetailsModalOpen && projectTasks.length > 0,
        queryFn: async () => {
            const all = await Promise.all(
                projectTasks.map(async (t: any) => {
                    const logs = await apiRequestJson<any[]>("GET", `/api/pms/tasks/${t.id}/time-logs`);
                    return (Array.isArray(logs) ? logs : []).map((l: any) => ({ ...l, taskTitle: t.title || t.name }));
                })
            );
            return all.flat().sort((a: any, b: any) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime());
        }
    });

    const invalidateTaskData = () => {
        queryClient.invalidateQueries({ queryKey: ["project-tasks-direct", selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ["project-time-logs", selectedProjectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/pms/department-status"] });
    };

    const { data: taskMeta } = useQuery<{ users: { id: string; name: string | null }[] }>({
        queryKey: ["/api/pms/tasks/meta"],
        enabled: isDetailsModalOpen,
        queryFn: async () => apiRequestJson("GET", "/api/pms/tasks/meta"),
    });

    const createTaskMutation = useMutation({
        mutationFn: async () => {
            return apiRequestJson("POST", "/api/pms/tasks", {
                projectId: selectedProjectId,
                title: newTaskForm.title.trim(),
                description: newTaskForm.description.trim() || undefined,
                assignedToUserId: newTaskForm.assignedToUserId !== "unassigned" ? newTaskForm.assignedToUserId : undefined,
                priority: newTaskForm.priority,
                dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate).toISOString() : undefined,
            });
        },
        onSuccess: () => {
            invalidateTaskData();
            setNewTaskForm(NEW_TASK_INITIAL_STATE);
            setIsAddTaskFormOpen(false);
            toast({ title: "Task created", description: "The task was added to this project." });
        },
        onError: (error: any) => {
            toast({ title: "Failed to create task", description: error?.message || "Please try again.", variant: "destructive" });
        },
    });

    // Mutations for timer
    const startTimerMutation = useMutation({
        mutationFn: async (taskId: string) => {
            return apiRequestJson("POST", `/api/tasks/${taskId}/timers/start`);
        },
        onSuccess: () => {
            invalidateTaskData();
            toast({ title: "Timer started" });
        },
        onError: (err: any) => toast({ title: "Timer Error", description: err.message, variant: "destructive" })
    });

    const stopTimerMutation = useMutation({
        mutationFn: async (taskId: string) => {
            return apiRequestJson("POST", `/api/tasks/${taskId}/timers/stop`);
        },
        onSuccess: () => {
            invalidateTaskData();
            toast({ title: "Timer stopped" });
        },
        onError: (err: any) => toast({ title: "Timer Error", description: err.message, variant: "destructive" })
    });

    const completeTaskMutation = useMutation({
        mutationFn: async (taskId: string) => {
            return apiRequestJson("POST", `/api/tasks/${taskId}/complete`, {});
        },
        onSuccess: (_data, taskId) => {
            // Submitting moves the task to READY_FOR_QA — awaiting the
            // manager's review in PMS Task History, not finished yet.
            const updatedTasks = projectTasks.map((t: any) =>
                t.id === taskId ? { ...t, status: "READY_FOR_QA", timerStartedAt: null } : t
            );

            invalidateTaskData();

            // When every task is at least submitted, close the details modal.
            if (updatedTasks.every((t: any) => t.status === "READY_FOR_QA" || t.status === "Completed" || t.status === "Done")) {
                setTimeout(() => {
                    setIsDetailsModalOpen(false);
                }, 500);
            }

            toast({ title: "Task submitted for review", description: "Your manager will review it in Task History." });
        },
        onError: (err: any) => toast({ title: "Submission Error", description: err.message, variant: "destructive" })
    });

    const displayTasks = projectTasks;

    const requestOvertimeMutation = useMutation({
        mutationFn: async (data: { taskId: string, requestedMinutes: number, reason: string }) => {
            return apiRequestJson("POST", `/api/tasks/${data.taskId}/extensions`, {
                requestedTimeMinutes: data.requestedMinutes,
                reason: data.reason,
            });
        },
        onSuccess: () => {
            toast({ title: "Overtime requested successfully" });
            setIsOvertimeModalOpen(false);
            setOvertimeForm({ minutes: "60", reason: "" });
            invalidateTaskData();
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

    // Enforce one-active-timer-at-a-time on the client before hitting the backend
    const handleToggleTimer = (task: any) => {
        if (startTimerMutation.isPending || stopTimerMutation.isPending) return;
        if (task.timerStartedAt) {
            stopTimerMutation.mutate(task.id);
            return;
        }
        const activeTask = displayTasks.find((t: any) => t.timerStartedAt && t.id !== task.id);
        if (activeTask) {
            toast({
                title: "A timer is already running",
                description: `Stop the timer on "${activeTask.title || activeTask.name || 'another task'}" before starting a new one.`,
                variant: "destructive",
            });
            return;
        }
        startTimerMutation.mutate(task.id);
    };

    // "Add Task" is a manager/assigner action — an executive only works the
    // tasks already assigned to them, they don't create new ones for
    // themselves or others.
    const { data: userData } = useQuery({ queryKey: ["/api/auth/me"] });
    const userRoleName = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
    const currentRole = ((userData as any)?.role || userRoleName).toLowerCase();
    const isExecutive = currentRole.includes("executive");
    // Product Posting Executive gets a lightweight links-only submission
    // form here instead of the Files modal (dropzone + rich-text detail) —
    // that modal is for IT/SEO-SMM/D&D executives only, per explicit
    // instruction; Product Posting's own flow is link-based.
    const isProductPostingExecutive = currentRole === "product_posting_executive" || currentRole === "posting_executive";

    return (
        <>
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans flex flex-col dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 flex-shrink-0 dark:text-zinc-400">
                TASK SYSTEM
            </h1>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Left: Project List / Sidebar widget */}
                <div className={`flex flex-col bg-white rounded border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 transition-all duration-300 min-h-0 ${selectedProjectId ? 'lg:w-[350px] flex-shrink-0' : 'w-full'}`}>
                    <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-400 dark:border-zinc-800 flex items-center justify-between">
                        <span>Projects</span>
                        {selectedProjectId && (
                             <button onClick={() => { setSelectedProjectId(null); setIsDetailsModalOpen(false); }} className="text-[12px] text-gray-400 hover:text-gray-600 underline">View Full</button>
                        )}
                    </div>
                    <div className="flex-1 p-2 lg:p-4 overflow-auto custom-scrollbar">
                        {!selectedProjectId ? (
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
                                        Loading tasks...
                                    </TableCell>
                                </TableRow>
                            ) : isError ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-rose-500 dark:text-rose-400">
                                        Failed to load projects{error instanceof Error ? `: ${error.message}` : ""}.
                                        <button
                                            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/pms/department-status"] })}
                                            className="ml-2 underline font-bold hover:text-rose-600"
                                        >
                                            Retry
                                        </button>
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
                                    <TableRow key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-50 text-[13px] dark:border-zinc-800">
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
                        ) : (
                            <div className="flex flex-col gap-2">
                                {projects.map((row, idx) => (
                                    <div 
                                        key={row.id} 
                                        onClick={() => { setSelectedProjectId(row.id); setIsDetailsModalOpen(true); }}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedProjectId === row.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-100 hover:border-gray-300 dark:border-zinc-800 dark:hover:border-zinc-700'}`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="font-bold text-[13px] text-[#495057] dark:text-zinc-300 line-clamp-1">{row.company}</div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${row.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Active' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {row.status}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-zinc-500 mb-1 line-clamp-1">{row.project}</div>
                                        <div className="flex justify-between items-center text-[10px] text-gray-400">
                                            <span className="font-medium text-emerald-600">{row.assign || "Not Assigned"}</span>
                                            <span>Docs: Yes</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Project Details Panel (Right Side) */}
                {selectedProjectId && (
                    <div className="flex-1 flex flex-col bg-white rounded border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800 h-[calc(100vh-140px)]">
                        <div className="p-4 bg-[#f8f9fc] border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800 flex justify-between items-center shrink-0">
                            <h2 className="text-[15px] font-bold text-[#495057] uppercase tracking-wider flex items-center gap-3 dark:text-zinc-400">
                                {selectedProjectInfo?.company || "PROJECT"} - TASKS
                            </h2>
                            {!isExecutive && (
                                <button
                                    onClick={() => setIsAddTaskFormOpen((v) => !v)}
                                    className="flex items-center gap-1.5 bg-[#00a65a] hover:bg-[#008d4c] text-white px-3 py-1.5 rounded text-[12px] font-bold"
                                >
                                    <Plus className="h-3 w-3" />
                                    Add Task
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        {!isExecutive && isAddTaskFormOpen && (
                            <div className="mb-6 bg-white rounded border border-gray-100 shadow-sm p-5 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Task Title *</label>
                                        <Input
                                            value={newTaskForm.title}
                                            onChange={(e) => setNewTaskForm((f) => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g., Design homepage banner"
                                            className="h-10 text-[13px] border-gray-200 dark:border-zinc-800"
                                            data-testid="input-new-task-title"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Assign To</label>
                                        <Select value={newTaskForm.assignedToUserId} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, assignedToUserId: v }))}>
                                            <SelectTrigger className="h-10 text-[13px] border-gray-200 dark:border-zinc-800">
                                                <SelectValue placeholder="Unassigned" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                                {(taskMeta?.users || []).map((u) => (
                                                    <SelectItem key={u.id} value={u.id}>{u.name || u.id}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Priority</label>
                                        <Select value={newTaskForm.priority} onValueChange={(v) => setNewTaskForm((f) => ({ ...f, priority: v }))}>
                                            <SelectTrigger className="h-10 text-[13px] border-gray-200 dark:border-zinc-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Low">Low</SelectItem>
                                                <SelectItem value="Medium">Medium</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Due Date</label>
                                        <Input
                                            type="date"
                                            value={newTaskForm.dueDate}
                                            onChange={(e) => setNewTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                                            className="h-10 text-[13px] border-gray-200 dark:border-zinc-800"
                                            data-testid="input-new-task-due-date"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Description</label>
                                    <textarea
                                        value={newTaskForm.description}
                                        onChange={(e) => setNewTaskForm((f) => ({ ...f, description: e.target.value }))}
                                        placeholder="Add any details about this task..."
                                        className="w-full border border-gray-200 rounded min-h-[80px] p-3 text-[13px] outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => { setIsAddTaskFormOpen(false); setNewTaskForm(NEW_TASK_INITIAL_STATE); }}
                                        className="px-4 py-2 rounded text-[13px] font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => createTaskMutation.mutate()}
                                        disabled={!newTaskForm.title.trim() || createTaskMutation.isPending}
                                        className="bg-[#00a65a] hover:bg-[#008d4c] disabled:opacity-50 text-white px-5 py-2 rounded text-[13px] font-bold"
                                        data-testid="button-submit-new-task"
                                    >
                                        {createTaskMutation.isPending ? "Saving..." : "Save Task"}
                                    </button>
                                </div>
                            </div>
                        )}

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
                                    ) : isTasksError ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                                                        <span className="text-rose-400 text-2xl">!</span>
                                                    </div>
                                                    <p className="text-[14px] font-bold text-rose-500">Failed to load tasks</p>
                                                    <p className="text-[12px] text-gray-400">{tasksError instanceof Error ? tasksError.message : "Please try again."}</p>
                                                    <button
                                                        onClick={() => queryClient.invalidateQueries({ queryKey: ["project-tasks-direct", selectedProjectId] })}
                                                        className="mt-1 text-[12px] underline font-bold text-rose-500 hover:text-rose-600"
                                                    >
                                                        Retry
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : displayTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-16">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                                                        <span className="text-amber-400 text-2xl">⚠</span>
                                                    </div>
                                                    <p className="text-[14px] font-bold text-gray-500">No Tasks Assigned</p>
                                                    <p className="text-[12px] text-gray-400">Is project mein koi task assign nahi hai. Add Task se ek task banayein.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : displayTasks.map((task: any, idx: number) => {
                                            let durationText = "0:0";
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
                                            } catch (e) { }
                                            // Check description for "Links: N" pattern (e.g. "done Links: 7")
                                            if (linksCount === 0 && task.description) {
                                                const descMatch = String(task.description).match(/links[\s:]+(\d+)/i);
                                                if (descMatch) linksCount = parseInt(descMatch[1]);
                                            }

                                            return (
                                                <TableRow key={task.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors border-0 border-b border-gray-50/50 text-[13px] dark:border-zinc-800">
                                                    <TableCell className="px-6 py-5 text-center">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className="font-bold text-gray-500 dark:text-zinc-400">#{idx + 1}</span>
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
                                                            } catch (e) { }

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
                                                        {isExecutive ? (
                                                            <button
                                                                onClick={() => setFilesModalTask(task)}
                                                                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-emerald-100 mx-auto"
                                                            >
                                                                <ArrowUpCircle className="h-5 w-5 text-white" />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setFilesModalTask(task)}
                                                                className="w-9 h-9 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-all mx-auto dark:bg-zinc-800"
                                                                title="View Details"
                                                            >
                                                                <Eye className="h-4 w-4 text-gray-500" />
                                                            </button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-6 py-5 text-center">
                                                        {task.status === 'Blocked' ? (
                                                            <span
                                                                className="bg-rose-50 text-rose-600 px-3 py-1 rounded-md font-bold text-[11px] border border-rose-100 cursor-help"
                                                                title={(() => {
                                                                    try {
                                                                        const parsed = task.rejectionNotes ? JSON.parse(task.rejectionNotes) : null;
                                                                        return parsed?.reason ? `Rejected: ${parsed.reason}` : "Rejected by manager";
                                                                    } catch {
                                                                        return task.rejectionNotes || "Rejected by manager";
                                                                    }
                                                                })()}
                                                            >
                                                                Rejected — needs rework
                                                            </span>
                                                        ) : task.status === 'READY_FOR_QA' ? (
                                                            <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md font-bold text-[11px] border border-blue-100 italic">
                                                                Pending Review
                                                            </span>
                                                        ) : (
                                                            <span className="bg-amber-50 text-amber-500 px-3 py-1 rounded-md font-bold text-[11px] border border-amber-100 italic">
                                                                {task.status || 'Pending'}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    {isExecutive && (
                                                        <TableCell className="px-6 py-5 text-center">
                                                            <div className="flex items-center justify-center gap-2 relative">
                                                                {task.status !== 'READY_FOR_QA' && task.status !== 'Completed' && (
                                                                    <>
                                                                        <div className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap ${task.timerStartedAt ? 'bg-emerald-400 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600'} text-[10px] px-2 py-0.5 rounded-full font-black border border-emerald-200/50 shadow-sm transition-colors`}>
                                                                            {task.timerStartedAt ? formatElapsed(elapsedTimes[task.id] || 0) : '0:0:0'}
                                                                        </div>
                                                                        <button
                                                                            className={`w-10 h-10 ${task.timerStartedAt ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'} rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg`}
                                                                            onClick={() => handleToggleTimer(task)}
                                                                            disabled={startTimerMutation.isPending || stopTimerMutation.isPending}
                                                                        >
                                                                            {task.timerStartedAt ? (
                                                                                <div className="w-3 h-3 bg-white rounded-sm shadow-inner dark:bg-zinc-900" />
                                                                            ) : (
                                                                                <PlayCircle className="h-6 w-6 text-white fill-white/10" />
                                                                            )}
                                                                        </button>
                                                                    </>
                                                                )}

                                                                {/* Done/Plus Button - only visible when timer has been run once (status is InProgress) and is currently stopped. Goes straight to the Yes/No submit confirmation — no intermediate form. */}
                                                                {!task.timerStartedAt && task.status === 'InProgress' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setFinishingTaskId(task.id);
                                                                            setEndTaskConfirmOpen(true);
                                                                        }}
                                                                        disabled={completeTaskMutation.isPending}
                                                                        className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-emerald-100"
                                                                    >
                                                                        <Plus className="h-6 w-6 text-white stroke-[3]" />
                                                                    </button>
                                                                )}

                                                                {/* Once submitted, the task is locked — no more buttons here until the manager decides. */}
                                                                {task.status === 'READY_FOR_QA' && (
                                                                    <span
                                                                        className="text-rose-600 font-bold text-[12px]"
                                                                        title="This task has been submitted for review — it cannot be worked on again until your manager reviews it."
                                                                    >
                                                                        Submitted
                                                                    </span>
                                                                )}

                                                                {/* Overtime Button */}
                                                                {task.status !== 'Completed' && task.status !== 'READY_FOR_QA' && (
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
                                                    )}
                                                    {!isExecutive && (
                                                        <TableCell className="px-6 py-5 text-center text-[11px] text-gray-400 font-medium">
                                                            View Only
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })
                                    }
                                </TableBody>
                            </Table>
                        </div>

                        {/* Time Log History */}
                        <div className="mt-6 bg-white rounded border border-gray-100 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="px-6 py-4 border-b border-gray-100 font-bold text-[14px] text-[#495057] dark:text-zinc-400 dark:border-zinc-800 flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Time Log History
                            </div>
                            <div className="max-h-[240px] overflow-auto custom-scrollbar">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-[#e9ebf7] hover:bg-[#e9ebf7] border-0 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                            <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-3 text-center dark:text-zinc-100">Task</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-3 text-center dark:text-zinc-100">User</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-3 text-center dark:text-zinc-100">Time Spent</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#212529] px-6 py-3 text-center dark:text-zinc-100">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoadingLogs ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400 font-medium">Loading time logs...</TableCell></TableRow>
                                        ) : timeLogs.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-gray-400 font-medium">No time logs recorded yet.</TableCell></TableRow>
                                        ) : timeLogs.map((log: any) => (
                                            <TableRow key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors border-b border-gray-50/50 text-[13px] dark:border-zinc-800">
                                                <TableCell className="px-6 py-3 text-center font-bold text-gray-700 dark:text-zinc-300 uppercase text-[12px]">{log.taskTitle || "—"}</TableCell>
                                                <TableCell className="px-6 py-3 text-center text-gray-500 dark:text-zinc-400">{log.user?.name || "—"}</TableCell>
                                                <TableCell className="px-6 py-3 text-center">
                                                    <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-bold text-[11px] dark:text-zinc-400 dark:bg-zinc-900">
                                                        {Math.floor((log.timeSpentMinutes || 0) / 60)}h {(log.timeSpentMinutes || 0) % 60}m
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-6 py-3 text-center text-gray-500 font-medium text-[12px] dark:text-zinc-400">
                                                    {log.logDate ? new Date(log.logDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {/* Submit confirmation — the "+" button opens this directly, no
                intermediate form. Once submitted, the task moves to
                READY_FOR_QA and locks (no timer/Start button) until the
                manager reviews it, so the executive needs to know upfront it
                can't be restarted. */}
            <AlertDialog open={endTaskConfirmOpen} onOpenChange={setEndTaskConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit this task?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Once submitted, this task goes to your manager for review and you won't be able to start it again unless it's rejected back to you.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>No</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (finishingTaskId) {
                                    completeTaskMutation.mutate(finishingTaskId);
                                    setEndTaskConfirmOpen(false);
                                }
                            }}
                        >
                            Yes, Submit
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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

            {/* The "Details" action button opens one of two modals depending on
                role: IT/SEO-SMM/D&D executives get the full Files modal
                (dropzone + rich-text detail); Product Posting Executive gets
                the simpler links-only form their workflow actually needs. */}
            {isProductPostingExecutive ? (
                <AddLinksModal task={filesModalTask} onClose={() => setFilesModalTask(null)} />
            ) : (
                <FilesModal task={filesModalTask} onClose={() => setFilesModalTask(null)} />
            )}
        </div>
        </>
    );
}

interface TaskFileEntry {
    id: string;
    fileUrl: string | null;
    fileName: string | null;
    description: string | null;
    createdAt: string;
    uploadedByName: string | null;
}

function RichTextEditor({ onChange }: { onChange: (html: string) => void }) {
    const editorRef = useRef<HTMLDivElement>(null);

    const handleCommand = (command: string, value: string = "") => {
        editorRef.current?.focus();
        document.execCommand(command, false, value || undefined);
        onChange(editorRef.current?.innerHTML || "");
    };

    return (
        <div className="rounded-[4px] border border-[#cfd7e3] dark:border-zinc-700">
            <div className="flex flex-wrap items-center gap-3 border-b border-[#cfd7e3] dark:border-zinc-700 bg-[#f8f9fa] dark:bg-zinc-800 px-3 py-2 text-[13px] text-[#44556d] dark:text-zinc-300">
                <select onMouseDown={(e) => e.preventDefault()} onChange={(e) => handleCommand('fontName', e.target.value)} className="bg-transparent outline-none cursor-pointer text-[#44556d] dark:text-zinc-300">
                    <option value="Arial">Sans Serif</option>
                    <option value="Times New Roman">Serif</option>
                    <option value="Courier New">Monospace</option>
                </select>
                <select onMouseDown={(e) => e.preventDefault()} onChange={(e) => handleCommand('fontSize', e.target.value)} className="bg-transparent outline-none cursor-pointer text-[#44556d] dark:text-zinc-300">
                    <option value="3">Normal</option>
                    <option value="1">Small</option>
                    <option value="5">Large</option>
                    <option value="7">Huge</option>
                </select>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('bold'); }} className="font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Bold">B</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('italic'); }} className="italic hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Italic">I</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('underline'); }} className="underline hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Underline">U</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('strikeThrough'); }} className="line-through hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Strikethrough">S</button>
                <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('superscript'); }} className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Superscript">X²</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('subscript'); }} className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Subscript">X₂</button>
                <div className="h-4 w-[1px] bg-gray-300 dark:bg-zinc-700"></div>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('insertUnorderedList'); }} className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Bullet List">• List</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleCommand('insertOrderedList'); }} className="hover:bg-gray-200 dark:hover:bg-zinc-700 px-1.5 py-0.5 rounded transition-colors select-none" title="Numbered List">1. List</button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[140px] w-full resize-y p-4 text-[14px] outline-none focus:ring-0 overflow-auto bg-white dark:bg-zinc-900"
                style={{ cursor: "text" }}
                data-placeholder="Type description here..."
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
            ></div>
        </div>
    );
}

// Product Posting Executive's "Details" form — deliberately not the Files
// modal below: their submissions are working links (posted listing URLs),
// not evidence files/a rich-text note. Submits through the same generic
// /api/tasks/:id/files endpoint (description-only, no file), which already
// works for any task regardless of department/workflow.
function AddLinksModal({ task, onClose }: { task: any; onClose: () => void }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [links, setLinks] = useState<string[]>([""]);
    const taskId = task?.id;

    const { data: uploadedRes } = useQuery<{ success: boolean; data: TaskFileEntry[] }>({
        queryKey: [`/api/tasks/${taskId}/files`],
        enabled: !!taskId,
        queryFn: () => apiRequestJson("GET", `/api/tasks/${taskId}/files`),
    });
    const submittedLinks = (uploadedRes?.data || []).filter((f) => !f.fileUrl && f.description);

    const submitMutation = useMutation({
        mutationFn: async () => {
            const validLinks = links.map((l) => l.trim()).filter(Boolean);
            for (const link of validLinks) {
                const form = new FormData();
                form.append("description", link);
                await apiRequestJson("POST", `/api/tasks/${taskId}/files`, form);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/files`] });
            setLinks([""]);
            toast({ title: "Sent", description: "Your links were submitted." });
        },
        onError: (err: any) => {
            toast({ title: err?.message || "Failed to send links", variant: "destructive" });
        },
    });

    if (!task) return null;
    const providedLinks = extractProvidedLinks(task);
    const hasValidLink = links.some((l) => l.trim());

    return (
        <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-[95vw] w-[700px] max-h-[90vh] bg-white p-0 flex flex-col border-none overflow-hidden rounded-xl shadow-2xl dark:bg-zinc-900">
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                    <h2 className="text-[20px] font-bold text-gray-700 dark:text-zinc-300">Links</h2>
                </div>

                <div className="p-8 space-y-6 bg-white overflow-y-auto dark:bg-zinc-900">
                    <div>
                        <h3 className="text-[13px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Provided Links</h3>
                        {providedLinks.length === 0 ? (
                            <p className="text-[13px] text-gray-400">No links provided by the manager.</p>
                        ) : (
                            <div className="space-y-1">
                                {providedLinks.map((link, i) => (
                                    <a
                                        key={i}
                                        href={link.startsWith("http") ? link : `https://${link}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-[13px] text-indigo-500 hover:text-indigo-700 underline truncate"
                                    >
                                        {link}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-[13px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Submitted Links</h3>
                        {submittedLinks.length === 0 ? (
                            <p className="text-[13px] text-gray-400">No links submitted yet.</p>
                        ) : (
                            <div className="space-y-1">
                                {submittedLinks.map((f) => (
                                    <a
                                        key={f.id}
                                        href={(f.description || "").startsWith("http") ? f.description! : `https://${f.description}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-[13px] text-emerald-600 hover:text-emerald-800 underline truncate"
                                    >
                                        {f.description}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Add Link(s)</label>
                        <div className="space-y-2">
                            {links.map((link, idx) => (
                                <Input
                                    key={idx}
                                    value={link}
                                    placeholder="https://..."
                                    onChange={(e) => {
                                        const next = [...links];
                                        next[idx] = e.target.value;
                                        setLinks(next);
                                    }}
                                    className="h-10 text-[13px] border-gray-200 dark:border-zinc-800"
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setLinks((prev) => [...prev, ""])}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 py-2 rounded text-[13px] font-bold"
                            >
                                Add Link
                            </button>
                            {links.length > 1 && (
                                <button
                                    onClick={() => setLinks((prev) => prev.slice(0, -1))}
                                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-[13px] font-bold dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                    Remove Link
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 dark:bg-zinc-900 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[14px] font-bold transition-colors dark:bg-zinc-900 dark:text-zinc-400"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending || !hasValidLink}
                        className="px-6 py-2 bg-[#008d4c] hover:bg-[#00733e] text-white rounded text-[14px] font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
                    >
                        {submitMutation.isPending ? "Sending..." : "Send Links"}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FilesModal({ task, onClose }: { task: any; onClose: () => void }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [description, setDescription] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const taskId = task?.id;

    const { data: uploadedRes } = useQuery<{ success: boolean; data: TaskFileEntry[] }>({
        queryKey: [`/api/tasks/${taskId}/files`],
        enabled: !!taskId,
        queryFn: () => apiRequestJson("GET", `/api/tasks/${taskId}/files`),
    });
    const uploadedFiles = uploadedRes?.data || [];

    const submitMutation = useMutation({
        mutationFn: async () => {
            const form = new FormData();
            pendingFiles.forEach((f) => form.append("files", f));
            const plainText = description.replace(/<[^>]*>/g, "").trim();
            if (plainText) form.append("description", plainText);
            return apiRequestJson("POST", `/api/tasks/${taskId}/files`, form);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/files`] });
            setPendingFiles([]);
            setDescription("");
            toast({ title: "Sent", description: "Your files/detail were submitted." });
        },
        onError: (err: any) => {
            toast({ title: err?.message || "Failed to send files", variant: "destructive" });
        },
    });

    if (!task) return null;
    const providedLinks = extractProvidedLinks(task);
    // Once submitted for review (or fully done), the task is locked — same
    // rule as the "+" submit button elsewhere: no more work until the
    // manager reviews it.
    const isLocked = task.status === 'READY_FOR_QA' || task.status === 'Completed';

    return (
        <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-[95vw] w-[1100px] max-h-[90vh] bg-white p-0 flex flex-col border-none overflow-hidden rounded-xl shadow-2xl dark:bg-zinc-900">
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
                    <h2 className="text-[20px] font-bold text-gray-700 dark:text-zinc-300">Files</h2>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-10 bg-white overflow-y-auto dark:bg-zinc-900">
                    {/* Left: upload */}
                    <div className="space-y-4">
                        {isLocked && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-[13px] font-semibold rounded-md px-4 py-3">
                                This task has been submitted for review — files can no longer be sent until your manager reviews it.
                            </div>
                        )}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => { if (!isLocked) fileInputRef.current?.click(); }}
                            onDragOver={(e) => { if (!isLocked) e.preventDefault(); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (isLocked) return;
                                const files = Array.from(e.dataTransfer.files || []);
                                if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                            }}
                            className={`border border-gray-300 dark:border-zinc-700 rounded-md h-[220px] flex flex-col items-center justify-center gap-3 transition-colors ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-emerald-400"}`}
                        >
                            <Upload className="w-8 h-8 text-slate-400" />
                            <p className="text-[14px] font-semibold text-gray-600 dark:text-zinc-300">
                                {pendingFiles.length > 0 ? `${pendingFiles.length} file(s) selected` : "Drop files here or click to upload."}
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                disabled={isLocked}
                                className="hidden"
                                onChange={(e) => setPendingFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                            />
                        </div>
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                            disabled={submitMutation.isPending || isLocked}
                            onClick={() => submitMutation.mutate()}
                        >
                            Send Files
                        </Button>

                        <label className="block text-[14px] font-bold text-gray-700 dark:text-zinc-300 pt-2">Detail</label>
                        <RichTextEditor onChange={setDescription} />
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                            disabled={submitMutation.isPending || isLocked}
                            onClick={() => submitMutation.mutate()}
                        >
                            {submitMutation.isPending ? "Sending..." : "Send Files"}
                        </Button>
                    </div>

                    {/* Right: what's already there */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-[14px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Uploaded Files</h4>
                            <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 space-y-2">
                                {uploadedFiles.filter((f) => f.fileUrl).length === 0 ? (
                                    <p className="text-[13px] text-gray-400">No files uploaded yet.</p>
                                ) : uploadedFiles.filter((f) => f.fileUrl).map((f) => (
                                    <a key={f.id} href={f.fileUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-emerald-600 hover:underline">
                                        <Paperclip className="w-3.5 h-3.5" /> {f.fileName || "File"}
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[14px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Uploaded Discription</h4>
                            <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 space-y-2">
                                {uploadedFiles.filter((f) => f.description).length === 0 ? (
                                    <p className="text-[13px] text-gray-400">No description submitted yet.</p>
                                ) : uploadedFiles.filter((f) => f.description).map((f) => (
                                    <p key={f.id} className="text-[13px] text-gray-600 dark:text-zinc-400">{f.description}</p>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[14px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Provided Files</h4>
                            <div className="border-t border-gray-100 dark:border-zinc-800 pt-2 space-y-2">
                                {providedLinks.length === 0 ? (
                                    <p className="text-[13px] text-gray-400">No files provided by the manager.</p>
                                ) : providedLinks.map((link, i) => (
                                    <a key={i} href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[13px] text-indigo-500 hover:underline truncate">
                                        <Paperclip className="w-3.5 h-3.5 shrink-0" /> {link}
                                    </a>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[14px] font-bold text-gray-700 dark:text-zinc-300 mb-2">Provided Discription</h4>
                            <p className="text-[13px] text-gray-600 dark:text-zinc-400 border-t border-gray-100 dark:border-zinc-800 pt-2">
                                {task.description || "No description provided."}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 dark:bg-zinc-900 flex items-center justify-end gap-3 flex-shrink-0">
                    <Button variant="outline" className="h-10 px-6" onClick={onClose}>Close</Button>
                    <Button
                        className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        disabled={submitMutation.isPending || isLocked}
                        onClick={() => submitMutation.mutate()}
                    >
                        {submitMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
