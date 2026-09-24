import { useState, useMemo } from "react";
import { Eye, Loader2, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskStatusHistoryRecord {
    id: string;
    taskId: string;
    fromStatus: string | null;
    toStatus: string | null;
    changedAt: string | null;
    notes: string | null;
    company?: string | null;
    timeSpentMinutes?: number;
    sentToQaAt?: string | null;
    task?: { id: string; title: string | null } | null;
    user?: { id: string; name: string | null } | null;
}

function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface PendingReviewTask {
    id: string;
    title: string;
    description: string | null;
    projectId: string;
    assigneeId: string | null;
    assigneeName: string | null;
    project: string | null;
    company: string | null;
    departmentType: string | null;
    submittedAt: string | null;
    submissionNotes: string | null;
}

interface SubmittedFileEntry {
    id: string;
    fileUrl: string | null;
    fileName: string | null;
    description: string | null;
    createdAt: string;
    uploadedByName: string | null;
}

const TASK_HISTORY_KEY = "/api/pms/task-history";
const PENDING_REVIEW_KEY = "/api/pms/tasks/pending-review";

function extractSubmittedLinks(notes: string | null): string[] {
    if (!notes) return [];
    try {
        const parsed = JSON.parse(notes);
        if (Array.isArray(parsed?.links)) {
            return parsed.links.filter((l: any) => typeof l === "string" && l.trim());
        }
    } catch {
        // Not JSON — no links to show.
    }
    return [];
}

export default function PmsTaskHistory() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const {
        data: historyRecords = [],
        isLoading,
        isError,
        error,
    } = useQuery<TaskStatusHistoryRecord[]>({
        queryKey: [TASK_HISTORY_KEY],
        queryFn: () => apiRequestJson<TaskStatusHistoryRecord[]>("GET", TASK_HISTORY_KEY),
    });

    // Server-gated (GET /api/pms/tasks/pending-review returns [] for any
    // non-managerial role) — the client-side isManager check below only
    // decides whether to render the section at all, it isn't the real gate.
    const { data: pendingReview = [], isLoading: isPendingReviewLoading } = useQuery<PendingReviewTask[]>({
        queryKey: [PENDING_REVIEW_KEY],
        queryFn: () => apiRequestJson<PendingReviewTask[]>("GET", PENDING_REVIEW_KEY),
    });

    const { data: userData } = useQuery({ queryKey: ["/api/auth/me"] });
    const userRoleName = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
    const currentRole = ((userData as any)?.role || userRoleName).toLowerCase();
    const isManager = currentRole.includes("manager") || currentRole.includes("admin") || currentRole.includes("hod");

    const invalidateReview = () => {
        queryClient.invalidateQueries({ queryKey: [PENDING_REVIEW_KEY] });
        queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
    };

    const approveMutation = useMutation({
        mutationFn: async (taskId: string) =>
            apiRequestJson("PATCH", `/api/pms/task/${taskId}/status`, { status: "Completed" }),
        onSuccess: () => {
            invalidateReview();
            toast({ title: "Approved", description: "The task is complete — send it to QA from Completed Projects below." });
        },
        onError: (err: any) => {
            toast({ title: "Could not approve task", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const sendToQaMutation = useMutation({
        mutationFn: async (taskId: string) => apiRequestJson("POST", `/api/pms/tasks/${taskId}/send-to-qa`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
            toast({ title: "Sent to QA" });
        },
        onError: (err: any) => {
            toast({ title: "Could not send to QA", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectingTask, setRejectingTask] = useState<PendingReviewTask | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!rejectingTask) return;
            return apiRequestJson("PATCH", `/api/pms/task/${rejectingTask.id}/status`, { status: "Blocked", reason: rejectReason.trim() });
        },
        onSuccess: () => {
            invalidateReview();
            setRejectDialogOpen(false);
            setRejectingTask(null);
            setRejectReason("");
            toast({ title: "Rejected", description: "Sent back to the executive for rework." });
        },
        onError: (err: any) => {
            toast({ title: "Could not reject task", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [viewingTask, setViewingTask] = useState<PendingReviewTask | null>(null);
    const { data: viewingFilesRes, isLoading: isViewingFilesLoading, isError: isViewingFilesError, error: viewingFilesError } = useQuery<{ success: boolean; data: SubmittedFileEntry[] }>({
        queryKey: [`/api/tasks/${viewingTask?.id}/files`],
        enabled: !!viewingTask,
        queryFn: () => apiRequestJson("GET", `/api/tasks/${viewingTask!.id}/files`),
        retry: 1,
    });
    const viewingFiles = viewingFilesRes?.data || [];

    const history = useMemo(() => {
        return (historyRecords || []).map((record, idx) => {
            const userName = record.user?.name || "Unknown";

            // `notes` is sometimes a plain remark, sometimes a JSON blob like
            // {"links": [...]} written by the submission/complete-task flows.
            // Pull the links out of it for the "Submitted Project Links" modal
            // instead of always showing an empty list.
            let parsedLinks: string[] = [];
            let detailText = record.notes || "";
            let isQaReturn = false;
            let qaCommentText = "N/A";
            
            if (record.notes) {
                try {
                    const parsed = JSON.parse(record.notes);
                    if (parsed.qaReturn) {
                        isQaReturn = true;
                        qaCommentText = parsed.reason || "";
                        detailText = parsed.reason ? `QA Return: ${parsed.reason}` : "QA Returned Project";
                    } else if (Array.isArray(parsed?.links)) {
                        parsedLinks = parsed.links.filter((l: any) => typeof l === "string" && l.trim());
                        detailText = parsedLinks.length > 0 ? `${parsedLinks.length} link(s) submitted` : "";
                    }
                } catch {
                    // Not JSON — keep the raw notes text as-is.
                }
            }

            return {
                no: idx + 1,
                taskId: record.task?.id || record.taskId,
                name: userName,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`,
                company: record.company || "—",
                qa: qaCommentText,
                isQaReturn,
                vm: "",
                project: record.task?.title || "—",
                taskDesc: record.fromStatus
                    ? `${record.fromStatus} → ${record.toStatus ?? ""}`
                    : record.toStatus ?? "",
                detail: detailText,
                free: "",
                taskTime: "",
                status: record.toStatus || "",
                run: "",
                spent: formatDuration(record.timeSpentMinutes || 0),
                changedAt: record.changedAt ? new Date(record.changedAt).toLocaleString() : "",
                links: parsedLinks,
                sentToQaAt: record.sentToQaAt || null,
            };
        });
    }, [historyRecords]);

    const filteredHistory = useMemo(() => {
        let current = history;
        if (statusFilter === "changing") {
            current = current.filter(row => row.isQaReturn);
        }
        if (!searchQuery.trim()) return current;
        const lowerSearch = searchQuery.toLowerCase();
        return current.filter((row) =>
            String(row.no || "").toLowerCase().includes(lowerSearch) ||
            String(row.name || "").toLowerCase().includes(lowerSearch) ||
            String(row.company || "").toLowerCase().includes(lowerSearch) ||
            String(row.qa || "").toLowerCase().includes(lowerSearch) ||
            String(row.vm || "").toLowerCase().includes(lowerSearch) ||
            String(row.project || "").toLowerCase().includes(lowerSearch) ||
            String(row.taskDesc || "").toLowerCase().includes(lowerSearch) ||
            String(row.detail || "").toLowerCase().includes(lowerSearch) ||
            String(row.status || "").toLowerCase().includes(lowerSearch)
        );
    }, [searchQuery, history, statusFilter]);

    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

    const handleSort = (key: string) => {
        setSortConfig((prev) => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
            }
            return { key, direction: "asc" };
        });
    };

    const sortedHistory = useMemo(() => {
        if (!sortConfig) return filteredHistory;
        const { key, direction } = sortConfig;
        const sorted = [...filteredHistory].sort((a: any, b: any) => {
            const av = a[key];
            const bv = b[key];
            if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
            if (bv == null || bv === "") return -1;
            if (typeof av === "number" && typeof bv === "number") return av - bv;
            return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
        });
        return direction === "asc" ? sorted : sorted.reverse();
    }, [filteredHistory, sortConfig]);

    const SortIcon = ({ column }: { column: string }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
        return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
    };

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] uppercase tracking-wide mb-6 dark:text-zinc-400">
                COMPLETE PROJECT
            </h1>

            {/* Pending My Review — tasks an executive has submitted (READY_FOR_QA),
                waiting on this manager to Approve (-> Completed, handed to QA) or
                Reject (-> Blocked, back to the executive for rework). Only rendered
                for managerial roles; the backend independently gates the data too
                (GET /api/pms/tasks/pending-review returns [] for anyone else). */}
            {isManager && (
                <Card className="border-t-4 border-t-[#008d4c] shadow-sm mb-6">
                    <CardHeader className="pb-2 flex flex-row items-center gap-2">
                        <ClipboardCheck className="w-4 h-4 text-[#008d4c]" />
                        <CardTitle className="text-[15px] font-bold text-[#495057] dark:text-zinc-400">Pending My Review</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isPendingReviewLoading ? (
                            <div className="p-6 text-center text-[13px] text-gray-400 flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                            </div>
                        ) : pendingReview.length === 0 ? (
                            <div className="p-6 text-center text-[13px] text-gray-400">
                                Nothing waiting on your review right now.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {pendingReview.map((task) => {
                                    const links = extractSubmittedLinks(task.submissionNotes);
                                    return (
                                        <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-bold text-[#343a40] dark:text-zinc-100">{task.title}</p>
                                                <p className="text-[12px] text-[#6c757d] mt-0.5">
                                                    {task.project || "—"} <span className="opacity-60">·</span> {task.company || "—"}
                                                    <span className="opacity-60"> · submitted by </span>
                                                    <span className="font-semibold">{task.assigneeName || "Unknown"}</span>
                                                    {task.submittedAt && (
                                                        <span className="opacity-60"> on {new Date(task.submittedAt).toLocaleString()}</span>
                                                    )}
                                                </p>
                                                {links.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        {links.map((link, i) => (
                                                            <a
                                                                key={i}
                                                                href={link.startsWith("http") ? link : `https://${link}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 underline truncate max-w-[220px]"
                                                            >
                                                                {link}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8"
                                                    onClick={() => setViewingTask(task)}
                                                >
                                                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-[#008d4c] hover:bg-[#00733e] text-white h-8"
                                                    disabled={approveMutation.isPending}
                                                    onClick={() => approveMutation.mutate(task.id)}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approved
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="border-rose-200 text-rose-600 hover:bg-rose-50 h-8"
                                                    disabled={rejectMutation.isPending}
                                                    onClick={() => {
                                                        setRejectingTask(task);
                                                        setRejectReason("");
                                                        setRejectDialogOpen(true);
                                                    }}
                                                >
                                                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 dark:border-zinc-800">
                    <h3 className="text-[15px] font-bold text-[#495057] dark:text-zinc-400">Completed Projects</h3>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 w-[120px] text-[13px] bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="changing">Changing</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="relative">
                            <Input 
                                placeholder="Search.." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 text-[13px] pl-3 pr-10 w-[200px] border-gray-200 focus-visible:ring-emerald-500 dark:border-zinc-800"
                            />
                        </div>

                        <Select defaultValue="50">
                            <SelectTrigger className="h-9 w-[80px] text-[13px] bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="50" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap min-w-[1200px]">
                        <thead>
                            <tr className="border-b border-gray-100 text-[#6c757d] dark:border-zinc-800">
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider w-[60px]">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 accent-[#2bc18c] dark:border-zinc-800" />
                                        <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("no")}>
                                            <span>NO.</span>
                                            <SortIcon column="no" />
                                        </button>
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("name")}>
                                        Name <SortIcon column="name" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("company")}>
                                        Company <SortIcon column="company" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("qa")}>
                                        QA Comment <SortIcon column="qa" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("vm")}>
                                        VM Comment <SortIcon column="vm" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider">
                                    <button className="flex items-center gap-1 hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("project")}>
                                        Project <SortIcon column="project" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                                    <button className="flex items-center gap-1 mx-auto hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("free")}>
                                        Free <SortIcon column="free" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                                    <button className="flex items-center gap-1 mx-auto hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("taskTime")}>
                                        Task <SortIcon column="taskTime" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                                    <button className="flex items-center gap-1 mx-auto hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("status")}>
                                        Status <SortIcon column="status" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                                    <button className="flex items-center gap-1 mx-auto hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("run")}>
                                        Run <SortIcon column="run" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                                    <button className="flex items-center gap-1 mx-auto hover:text-[#2bc18c] transition-colors" onClick={() => handleSort("spent")}>
                                        Spent <SortIcon column="spent" />
                                    </button>
                                </th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">QA</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading task history...
                                        </span>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-10 text-center text-[13px] text-red-500">
                                        Failed to load task history{error instanceof Error ? `: ${error.message}` : ""}.
                                    </td>
                                </tr>
                            ) : sortedHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
                                        No task history found.
                                    </td>
                                </tr>
                            ) : sortedHistory.map((row, index) => (
                                <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 text-[13px] text-[#495057] dark:text-zinc-400">
                                            <input type="checkbox" className="rounded border-gray-300 w-3.5 h-3.5 accent-[#2bc18c] dark:border-zinc-800" />
                                            <span>{row.no}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <img src={row.avatar} alt="avatar" className="w-[30px] h-[30px] rounded-full object-cover shadow-sm bg-gray-100 dark:bg-zinc-900" />
                                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">{row.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[12.5px] font-medium text-[#495057] uppercase tracking-wide dark:text-zinc-400">{row.company}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[13px] text-[#6c757d]">{row.qa}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[13px] text-[#6c757d]">{row.vm}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col py-1">
                                            <span className="text-[14px] font-bold text-[#343a40] leading-tight dark:text-zinc-100">{row.project}</span>
                                            <span className="text-[11.5px] font-semibold text-[#6c757d] mt-1"><span className="opacity-80">Task:</span> {row.taskDesc}</span>
                                            <span className="text-[11.5px] font-semibold text-[#878a99]"><span className="opacity-80">Detail:</span> {row.detail}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">{row.free}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">{row.taskTime}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex bg-[#2bc18c] text-white text-[10.5px] px-2.5 py-1 rounded-[4px] font-bold shadow-sm leading-none">
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex bg-[#e9ebf7] text-[#495057] text-[10.5px] px-2.5 py-1 rounded-[4px] font-bold shadow-sm leading-none dark:text-zinc-400 dark:bg-zinc-900">
                                            {row.run}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[12.5px] font-medium text-[#495057] tracking-wide dark:text-zinc-400">{row.spent}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center min-w-[200px]">
                                        {row.isQaReturn ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7 px-3 text-[11px] border border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100"
                                                    disabled={rejectMutation.isPending}
                                                    onClick={() => {
                                                        apiRequestJson("PATCH", `/api/pms/task/${row.taskId}/status`, { status: "InProgress", reason: "Sent back by Manager" })
                                                            .then(() => {
                                                                queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
                                                                toast({ title: "Reassigned to Executive" });
                                                            })
                                                            .catch((err) => toast({ title: "Error", description: err.message, variant: "destructive" }));
                                                    }}
                                                >
                                                    Assign to Exec
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="h-7 px-3 text-[11px] bg-[#2bc18c] hover:bg-[#25a87a] text-white"
                                                    disabled={sendToQaMutation.isPending}
                                                    onClick={() => sendToQaMutation.mutate(row.taskId)}
                                                >
                                                    Send to QA
                                                </Button>
                                            </div>
                                        ) : row.status !== 'Completed' ? null : row.sentToQaAt ? (
                                            <span
                                                className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600"
                                                title={`Sent to QA on ${new Date(row.sentToQaAt).toLocaleString()}`}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                className="h-7 px-3 text-[11px] bg-[#2bc18c] hover:bg-[#25a87a] text-white"
                                                disabled={sendToQaMutation.isPending}
                                                onClick={() => sendToQaMutation.mutate(row.taskId)}
                                            >
                                                Send to QA
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Reject reason — required before a Pending My Review task can be
                sent back (Blocked) to its executive for rework. */}
            <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectingTask(null); } }}>
                <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[17px] font-bold text-[#495057] dark:text-zinc-400">Reject Task</DialogTitle>
                        <DialogDescription className="text-sm text-[#6c757d]">
                            {rejectingTask?.title} will go back to <span className="font-semibold">{rejectingTask?.assigneeName || "the executive"}</span> for rework.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Reason</label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explain what needs to change..."
                            className="min-h-[100px]"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => { setRejectDialogOpen(false); setRejectingTask(null); }}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                            disabled={rejectMutation.isPending || !rejectReason.trim()}
                            onClick={() => rejectMutation.mutate()}
                        >
                            {rejectMutation.isPending ? "Rejecting..." : "Reject & Send Back"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View submission — what the executive actually did, so the
                manager can check the work before Approve/Reject instead of
                deciding blind. Same files/description data the executive's
                own "Files" modal on Task System writes to. */}
            <Dialog open={!!viewingTask} onOpenChange={(open) => { if (!open) setViewingTask(null); }}>
                <DialogContent className="max-w-lg bg-white dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[17px] font-bold text-[#495057] dark:text-zinc-400">{viewingTask?.title}</DialogTitle>
                        <DialogDescription className="text-sm text-[#6c757d]">
                            Submitted by <span className="font-semibold">{viewingTask?.assigneeName || "Unknown"}</span>
                            {viewingTask?.submittedAt && ` on ${new Date(viewingTask.submittedAt).toLocaleString()}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto">
                        <div>
                            <h4 className="text-[13px] font-bold text-[#495057] dark:text-zinc-400 mb-1.5">Submitted Links</h4>
                            {(() => {
                                const links = extractSubmittedLinks(viewingTask?.submissionNotes ?? null);
                                return links.length === 0 ? (
                                    <p className="text-[13px] text-gray-400">No links submitted.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {links.map((link, i) => (
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
                                );
                            })()}
                        </div>

                        {isViewingFilesError ? (
                            <p className="text-[13px] text-rose-500">
                                Couldn't load files/description{viewingFilesError instanceof Error ? `: ${viewingFilesError.message}` : "."}
                            </p>
                        ) : (
                            <>
                                <div>
                                    <h4 className="text-[13px] font-bold text-[#495057] dark:text-zinc-400 mb-1.5">Uploaded Files</h4>
                                    {isViewingFilesLoading ? (
                                        <p className="text-[13px] text-gray-400">Loading...</p>
                                    ) : viewingFiles.filter((f) => f.fileUrl).length === 0 ? (
                                        <p className="text-[13px] text-gray-400">No files uploaded.</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {viewingFiles.filter((f) => f.fileUrl).map((f) => (
                                                <a key={f.id} href={f.fileUrl!} target="_blank" rel="noopener noreferrer" className="block text-[13px] text-emerald-600 hover:underline">
                                                    {f.fileName || "File"}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h4 className="text-[13px] font-bold text-[#495057] dark:text-zinc-400 mb-1.5">Description</h4>
                                    {isViewingFilesLoading ? (
                                        <p className="text-[13px] text-gray-400">Loading...</p>
                                    ) : viewingFiles.filter((f) => f.description).length === 0 ? (
                                        <p className="text-[13px] text-gray-400">No description submitted.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {viewingFiles.filter((f) => f.description).map((f) => (
                                                <p key={f.id} className="text-[13px] text-gray-600 dark:text-zinc-400">{f.description}</p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center justify-end pt-2">
                        <Button variant="secondary" onClick={() => setViewingTask(null)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
