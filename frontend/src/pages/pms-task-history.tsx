import { useState, useMemo } from "react";
import { Eye, Link2, Loader2, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { normalizeTaskLinkKey } from "@/lib/task-link-utils";
import { departmentTypeInQaPipeline, departmentTypeMatchesFamily } from "@/lib/project-department-variants";
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
    qaReviewedAt?: string | null;
    currentStatus?: string | null;
    qaComment?: string | null;
    vmComment?: string | null;
    needsChanging?: boolean;
    departmentType?: string | null;
    linkApprovedQty?: number;
    linkTotalQty?: number;
    linkPendingQty?: number;
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
    /** Old-DRM task the executive ended but the manager hasn't approved (approve it in the old DRM). */
    legacyReadOnly?: boolean;
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

interface TaskHistoryPage {
    items: TaskStatusHistoryRecord[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

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

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/gi;

function extractUrlsFromText(text: string | null | undefined): string[] {
    if (!text || text === "N/A") return [];
    const hits = text.match(URL_IN_TEXT_RE) || [];
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^https?:\/\//i.test(l));
    const merged = [...hits, ...lines].map((u) => u.replace(/[.,;)]+$/, "").trim());
    return Array.from(new Set(merged.filter(Boolean)));
}

function commentPreviewWithoutUrls(text: string | null | undefined): string {
    if (!text || text === "N/A") return "";
    let t = text;
    for (const u of extractUrlsFromText(text)) {
        t = t.replace(u, " ");
    }
    return t.replace(/\s+/g, " ").trim();
}

function normalizeHref(url: string): string {
    const t = url.trim();
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function uniqueSubmittedLinkUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of urls) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const key = normalizeTaskLinkKey(trimmed);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}

function linkSubmissionsFromFiles(files: SubmittedFileEntry[]): string[] {
    return uniqueSubmittedLinkUrls(
        files.filter((f) => !f.fileUrl && f.description?.trim()).map((f) => f.description!.trim()),
    );
}

type LinksModalState = {
    title: string;
    taskId?: string;
    staticUrls?: string[];
} | null;

function CommentCell({
    label,
    fullText,
    onOpenLinks,
}: {
    label: string;
    fullText: string;
    onOpenLinks: (title: string, urls: string[], taskId?: string) => void;
}) {
    if (!fullText || fullText === "N/A") {
        return <span className="text-[11px] text-gray-400">N/A</span>;
    }
    const urls = extractUrlsFromText(fullText);
    const preview = commentPreviewWithoutUrls(fullText);
    const shortPreview = preview.length > 72 ? `${preview.slice(0, 72)}…` : preview;

    if (urls.length > 0) {
        return (
            <div className="flex flex-col gap-1 max-w-[130px]">
                {shortPreview ? (
                    <span className="text-[10px] text-[#6c757d] line-clamp-2 leading-snug" title={preview}>
                        {shortPreview}
                    </span>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 w-fit border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={() => onOpenLinks(`${label} (${urls.length})`, urls)}
                >
                    <Link2 className="w-3 h-3" />
                    Links ({urls.length})
                </Button>
            </div>
        );
    }

    const plain = shortPreview || fullText;
    const display = plain.length > 120 ? `${plain.slice(0, 120)}…` : plain;
    return (
        <span className="text-[11px] text-[#6c757d] line-clamp-3 max-w-[130px] break-words" title={fullText}>
            {display}
        </span>
    );
}

export default function PmsTaskHistory() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [historyPageSize, setHistoryPageSize] = useState(50);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const {
        data: historyPages,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        isError,
        error,
    } = useInfiniteQuery({
        queryKey: [TASK_HISTORY_KEY, historyPageSize, statusFilter],
        queryFn: async ({ pageParam }) => {
            const filterQs = statusFilter === "changing" ? "&filter=changing" : "";
            const res = await apiRequestJson<TaskHistoryPage | TaskStatusHistoryRecord[]>(
                "GET",
                `${TASK_HISTORY_KEY}?page=${pageParam}&pageSize=${historyPageSize}${filterQs}`,
            );
            if (Array.isArray(res)) {
                return {
                    items: res,
                    total: res.length,
                    page: 1,
                    pageSize: historyPageSize,
                    hasMore: false,
                };
            }
            return res;
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    });

    const historyRecords = useMemo(
        () => historyPages?.pages.flatMap((p) => p.items) ?? [],
        [historyPages],
    );
    const historyTotal = historyPages?.pages[0]?.total ?? historyRecords.length;

    // Server-gated (GET /api/pms/tasks/pending-review returns [] for any
    // non-managerial role) — the client-side isManager check below only
    // decides whether to render the section at all, it isn't the real gate.
    const PENDING_PAGE_SIZE = 20;
    const [pendingPage, setPendingPage] = useState(1);
    const { data: pendingReview = [], isLoading: isPendingReviewLoading } = useQuery<PendingReviewTask[]>({
        queryKey: [PENDING_REVIEW_KEY],
        queryFn: () => apiRequestJson<PendingReviewTask[]>("GET", PENDING_REVIEW_KEY),
    });

    const { data: userData } = useQuery({ queryKey: ["/api/auth/me"] });
    const userRoleName = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
    const currentRole = ((userData as any)?.role || userRoleName).toLowerCase();
    // QA / Verification are "manager" roles but they must not see the
    // department manager's READY_FOR_QA "Pending My Review" queue — that
    // only opens after Manager approve + Send to QA / Send to Verification.
    const isQaOrVerificationRole =
        currentRole === "qa_manager" ||
        currentRole.startsWith("qa_") ||
        currentRole.includes("verification");
    const isManager =
        (currentRole.includes("manager") || currentRole.includes("admin") || currentRole.includes("hod")) &&
        !isQaOrVerificationRole;

    const invalidateReview = () => {
        queryClient.invalidateQueries({ queryKey: [PENDING_REVIEW_KEY] });
        queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
    };

    // Old-DRM task: move it into the new flow first (a real task, READY_FOR_QA), then approve /
    // reject it like any task — Send to QA, QA, VM and close then work as usual.
    const resolveReviewTaskId = async (taskId: string): Promise<string> => {
        if (!taskId.startsWith("legacy-assign-")) return taskId;
        const r = await apiRequestJson<{ taskId: string }>("POST", `/api/pms/legacy-tasks/${taskId}/open`, {});
        return r.taskId;
    };

    const approveMutation = useMutation({
        mutationFn: async (taskId: string) =>
            apiRequestJson("PATCH", `/api/pms/task/${await resolveReviewTaskId(taskId)}/status`, { status: "Completed" }),
        onSuccess: () => {
            invalidateReview();
            toast({ title: "Approved", description: "The task is complete — finish it from Completed Projects below." });
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

    // QA Manager's own hand-off for a Product Posting task they've approved
    // here — the downstream step from QA is Verification, not "send it to
    // QA" (that doesn't make sense when the viewer IS QA).
    const sendToVerificationMutation = useMutation({
        mutationFn: async (taskId: string) => apiRequestJson("POST", `/api/pms/tasks/${taskId}/send-to-verification`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
            toast({ title: "Sent to Verification" });
        },
        onError: (err: any) => {
            toast({ title: "Could not send to Verification", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    // Every non-Product-Posting department has no QA/Verification pipeline
    // at all — this is their equivalent of "Send to QA": the manager's
    // deliberate final hand-off that graduates the task to Complete and
    // Closed Project.
    const closeTaskMutation = useMutation({
        mutationFn: async (taskId: string) => apiRequestJson("POST", `/api/pms/tasks/${taskId}/close`, {}),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
            toast({ title: "Task Closed", description: "Moved to Complete and Closed Project." });
        },
        onError: (err: any) => {
            toast({ title: "Could not close task", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const assignToExecMutation = useMutation({
        mutationFn: async (taskId: string) =>
            apiRequestJson("PATCH", `/api/pms/task/${taskId}/status`, { status: "ToDo", reason: "Sent back by Manager" }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
            toast({ title: "Reassigned to Executive" });
        },
        onError: (err: any) => {
            toast({ title: "Could not reassign task", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectingTask, setRejectingTask] = useState<PendingReviewTask | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!rejectingTask) return;
            return apiRequestJson("PATCH", `/api/pms/task/${await resolveReviewTaskId(rejectingTask.id)}/status`, { status: "Blocked", reason: rejectReason.trim() });
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

    const [viewingTask, setViewingTask] = useState<PendingReviewTask | null>(null);
    const [linksModal, setLinksModal] = useState<LinksModalState>(null);

    const openLinksModal = (title: string, urls: string[], taskId?: string) => {
        setLinksModal({ title, staticUrls: urls, taskId });
    };

    const { data: linksModalFilesRes, isLoading: isLinksModalLoading } = useQuery<{
        success: boolean;
        data: SubmittedFileEntry[];
    }>({
        queryKey: [`/api/tasks/${linksModal?.taskId}/files`, "links-modal"],
        enabled: !!linksModal?.taskId,
        queryFn: () => apiRequestJson("GET", `/api/tasks/${linksModal!.taskId}/files`),
    });

    const linksModalUrls = useMemo(() => {
        if (!linksModal) return [];
        const fromApi = (linksModalFilesRes?.data || [])
            .map((f) => (f.description || f.fileUrl || "").trim())
            .filter(Boolean);
        const merged = [...(linksModal.staticUrls || []), ...fromApi];
        return Array.from(new Set(merged));
    }, [linksModal, linksModalFilesRes]);
    const { data: viewingFilesRes, isLoading: isViewingFilesLoading, isError: isViewingFilesError, error: viewingFilesError } = useQuery<{ success: boolean; data: SubmittedFileEntry[] }>({
        queryKey: [`/api/tasks/${viewingTask?.id}/files`],
        enabled: !!viewingTask,
        queryFn: () => apiRequestJson("GET", viewingTask!.legacyReadOnly
            ? `/api/pms/legacy-tasks/${viewingTask!.id}/files`
            : `/api/tasks/${viewingTask!.id}/files`),
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

            if (record.notes) {
                try {
                    const parsed = JSON.parse(record.notes);
                    if (parsed.qaReturn) {
                        detailText = parsed.reason ? `QA Return: ${parsed.reason}` : "QA Returned Project";
                    } else if (parsed.verificationReturn) {
                        detailText = parsed.reason ? `Verification Return: ${parsed.reason}` : "Verification Returned Project";
                    } else if (typeof parsed.reason === "string" && parsed.reason) {
                        detailText = `Rejected: ${parsed.reason}`;
                    } else if (Array.isArray(parsed?.links)) {
                        parsedLinks = parsed.links.filter((l: any) => typeof l === "string" && l.trim());
                        detailText = parsedLinks.length > 0 ? `${parsedLinks.length} link(s) submitted` : "";
                    }
                } catch {
                    // Not JSON — keep the raw notes text as-is.
                }
            }

            // QA's comment on the most recent time they returned this task —
            // this stays visible even after the executive fixes it and
            // resubmits, since it's the reason context a manager still wants
            // before deciding to send it back to QA again.
            const qaCommentRaw = record.qaComment || "";
            const vmCommentRaw = record.vmComment || "";
            const qaCommentText = qaCommentRaw.trim() ? qaCommentRaw : "N/A";
            const vmCommentText = vmCommentRaw.trim() ? vmCommentRaw : "N/A";

            // The backend already collapses this feed to one row per task
            // (its latest transition) and only includes tasks currently at
            // rest in Completed or Blocked — so `currentStatus` here IS this
            // row's status; no separate "is this stale" check needed.
            const isQaReturn = record.currentStatus === "Blocked";
            const qaNote = qaCommentRaw.trim();
            const vmNote = vmCommentRaw.trim();
            const isChanging =
                record.needsChanging === true ||
                isQaReturn ||
                Boolean(qaNote && qaNote !== "N/A") ||
                Boolean(vmNote && vmNote !== "N/A") ||
                (record.notes
                    ? (() => {
                          try {
                              const p = JSON.parse(record.notes);
                              return Boolean(p.qaReturn || p.verificationReturn);
                          } catch {
                              return false;
                          }
                      })()
                    : false);

            const legacyTaskId = record.task?.id || record.taskId;
            const isLegacyReadOnly =
                String(legacyTaskId || "").startsWith("legacy-assign-") ||
                (record as { legacyReadOnly?: boolean }).legacyReadOnly === true;

            return {
                no: idx + 1,
                taskId: legacyTaskId,
                isLegacyReadOnly,
                name: userName,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}`,
                company: record.company || "—",
                qa: qaCommentText,
                vm: vmCommentText,
                qaUrls: extractUrlsFromText(qaCommentRaw),
                vmUrls: extractUrlsFromText(vmCommentRaw),
                isQaReturn,
                isChanging,
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
                changedAtRaw: record.changedAt,
                changedAt: record.changedAt ? new Date(record.changedAt).toLocaleString() : "",
                taskLinksCount: Number(record.linkTotalQty) || 0,
                links: parsedLinks,
                sentToQaAt: record.sentToQaAt || null,
                qaReviewedAt: record.qaReviewedAt || null,
                currentStatus: record.currentStatus || null,
                departmentType: record.departmentType || null,
                linkApprovedQty: Number(record.linkApprovedQty) || 0,
                linkTotalQty: Number(record.linkTotalQty) || 0,
                linkPendingQty: Number(record.linkPendingQty) || 0,
            };
        });
    }, [historyRecords]);

    const filteredHistory = useMemo(() => {
        let current = history;
        if (statusFilter === "changing") {
            current = current.filter((row) => row.isChanging);
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

            {/* Pending My Review — department managers only (not QA / VM).
                Sequence: Executive submit → Manager approve → Manager Send to QA
                → QA → VM. Backend returns [] for QA/Verification roles too. */}
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
                            <>
                            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {pendingReview
                                    .slice((Math.min(pendingPage, Math.max(1, Math.ceil(pendingReview.length / PENDING_PAGE_SIZE))) - 1) * PENDING_PAGE_SIZE,
                                           Math.min(pendingPage, Math.max(1, Math.ceil(pendingReview.length / PENDING_PAGE_SIZE))) * PENDING_PAGE_SIZE)
                                    .map((task) => {
                                    const links = extractSubmittedLinks(task.submissionNotes);
                                    return (
                                        <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-bold text-[#343a40] dark:text-zinc-100">
                                                    {task.title}
                                                    {task.legacyReadOnly && (
                                                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">Old DRM</span>
                                                    )}
                                                </p>
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
                            {pendingReview.length > PENDING_PAGE_SIZE && (() => {
                                const pages = Math.ceil(pendingReview.length / PENDING_PAGE_SIZE);
                                const cur = Math.min(pendingPage, pages);
                                return (
                                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-2 text-[12px] text-[#6c757d] dark:border-zinc-800">
                                        <span>
                                            Showing {(cur - 1) * PENDING_PAGE_SIZE + 1}–{Math.min(cur * PENDING_PAGE_SIZE, pendingReview.length)} of {pendingReview.length.toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" className="h-7" disabled={cur <= 1} onClick={() => setPendingPage(cur - 1)}>Previous</Button>
                                            <span>Page {cur} of {pages}</span>
                                            <Button size="sm" variant="outline" className="h-7" disabled={cur >= pages} onClick={() => setPendingPage(cur + 1)}>Next</Button>
                                        </div>
                                    </div>
                                );
                            })()}
                            </>
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

                        <Select
                            value={String(historyPageSize)}
                            onValueChange={(v) => setHistoryPageSize(Number(v))}
                        >
                            <SelectTrigger className="h-9 w-[80px] text-[13px] bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="50" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="25">25</SelectItem>
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
                                    <td className="px-4 py-3 align-top">
                                        <CommentCell label="QA Comment" fullText={row.qa} onOpenLinks={openLinksModal} />
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <CommentCell label="VM Comment" fullText={row.vm} onOpenLinks={openLinksModal} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-start gap-2 py-1">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-bold text-[#343a40] leading-tight dark:text-zinc-100">{row.project}</span>
                                                <span className="text-[11.5px] font-semibold text-[#6c757d] mt-1"><span className="opacity-80">Task:</span> {row.taskDesc}</span>
                                                {row.detail ? (
                                                    <span className="text-[11.5px] font-semibold text-[#878a99] line-clamp-2 max-w-[220px]">
                                                        <span className="opacity-80">Detail:</span> {row.detail.length > 80 ? `${row.detail.slice(0, 80)}…` : row.detail}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="flex flex-col gap-1 flex-shrink-0">
                                            {row.taskLinksCount > 0 ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 px-2 text-[10px] gap-1 border-emerald-200 text-emerald-700"
                                                    onClick={() => openLinksModal(`Task links (${row.taskLinksCount})`, [], String(row.taskId))}
                                                >
                                                    <Link2 className="w-3 h-3" />
                                                    Links ({row.taskLinksCount})
                                                </Button>
                                            ) : null}
                                            {/* The executive's submitted links/files were only viewable
                                                while a task sat in "Pending My Review" — once approved
                                                and moved down here, the manager (and QA, which reuses
                                                this same table for its own Completed Projects) had no
                                                way to see what was actually submitted. Reuses the exact
                                                same viewingTask modal + GET /api/tasks/:id/files data
                                                the Pending My Review "View" button already uses. */}
                                            <button
                                                title="View submitted links/files"
                                                onClick={() => setViewingTask({
                                                    id: row.taskId,
                                                    title: row.project,
                                                    description: null,
                                                    projectId: "",
                                                    assigneeId: null,
                                                    assigneeName: row.name,
                                                    project: row.project,
                                                    company: row.company,
                                                    departmentType: row.departmentType ?? null,
                                                    submittedAt: row.changedAtRaw || row.changedAt || null,
                                                    submissionNotes: null,
                                                })}
                                                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                            </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">{row.free}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">{row.taskTime}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`inline-flex text-white text-[10.5px] px-2.5 py-1 rounded-[4px] font-bold shadow-sm leading-none ${
                                                row.isChanging
                                                    ? "bg-amber-500"
                                                    : row.status === "Blocked"
                                                      ? "bg-rose-500"
                                                      : "bg-[#2bc18c]"
                                            }`}
                                        >
                                            {row.isChanging && row.status !== "Blocked" ? "Changing" : row.status}
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
                                        {row.isLegacyReadOnly ? (
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400" title="Legacy migrated task — view only">
                                                Legacy
                                            </span>
                                        ) : row.isQaReturn ? (
                                            <Button
                                                size="sm"
                                                className="h-7 px-3 text-[11px] border border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100"
                                                disabled={assignToExecMutation.isPending}
                                                onClick={() => assignToExecMutation.mutate(row.taskId)}
                                            >
                                                Assign to Exec
                                            </Button>
                                        ) : row.status !== 'Completed' ? null : !departmentTypeInQaPipeline(row.departmentType) ? (
                                            // IT / Software / Service (e.g. LEGACY-13) — no QA pipeline;
                                            // D&D / SEO / P&P use Send to QA below (LEGACY-8/9/10 included).
                                            <Button
                                                size="sm"
                                                className="h-7 px-3 text-[11px] bg-[#2bc18c] hover:bg-[#25a87a] text-white"
                                                disabled={closeTaskMutation.isPending}
                                                onClick={() => closeTaskMutation.mutate(row.taskId)}
                                            >
                                                Closed Task
                                            </Button>
                                        ) : currentRole === 'qa_manager' ? (
                                            // QA Manager viewing their own Product Posting queue —
                                            // the next step from here is Verification, not "send to
                                            // QA" (the viewer already IS QA).
                                            row.qaReviewedAt ? (
                                                <span
                                                    className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600"
                                                    title={`Sent to Verification on ${new Date(row.qaReviewedAt).toLocaleString()}`}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                                </span>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="h-7 px-3 text-[11px] bg-[#2bc18c] hover:bg-[#25a87a] text-white"
                                                    disabled={sendToVerificationMutation.isPending}
                                                    onClick={() => sendToVerificationMutation.mutate(row.taskId)}
                                                >
                                                    Send to Verification
                                                </Button>
                                            )
                                        ) : row.sentToQaAt ? (
                                            <span
                                                className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-600"
                                                title={`Sent to QA on ${new Date(row.sentToQaAt).toLocaleString()}`}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                            </span>
                                        ) : (() => {
                                            // Product Posting: whole-task Send to QA stays locked
                                            // until every submitted link is QA-approved.
                                            const isProductPosting = departmentTypeMatchesFamily(
                                                row.departmentType,
                                                "product_posting",
                                            );
                                            const linkTotal = Number(row.linkTotalQty) || 0;
                                            const linkApproved = Number(row.linkApprovedQty) || 0;
                                            const linkPending = Number(row.linkPendingQty) || Math.max(0, linkTotal - linkApproved);
                                            const linksReady = !isProductPosting || (linkTotal > 0 && linkPending === 0);
                                            return (
                                                <div className="inline-flex flex-col items-center gap-1">
                                                    {isProductPosting && (
                                                        <span className="text-[11px] font-bold tabular-nums" title="QA-approved links / total links">
                                                            <span className="text-emerald-600">{linkApproved}</span>
                                                            <span className="text-gray-400 mx-0.5">/</span>
                                                            <span className="text-red-600">{linkTotal}</span>
                                                        </span>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        className={`h-7 px-3 text-[11px] text-white ${
                                                            linksReady
                                                                ? "bg-[#2bc18c] hover:bg-[#25a87a]"
                                                                : "bg-[#2bc18c]/50 hover:bg-[#2bc18c]/50 cursor-not-allowed"
                                                        }`}
                                                        disabled={sendToQaMutation.isPending}
                                                        onClick={() => {
                                                            if (!linksReady) {
                                                                toast({
                                                                    title: "Links pending QA approval",
                                                                    description:
                                                                        linkTotal === 0
                                                                            ? "No links submitted yet. All Product Posting links must be QA-approved before Send to QA."
                                                                            : `${linkPending} of ${linkTotal} link(s) still pending QA approval. Approve all links first.`,
                                                                    variant: "destructive",
                                                                });
                                                                return;
                                                            }
                                                            sendToQaMutation.mutate(row.taskId);
                                                        }}
                                                    >
                                                        Send to QA
                                                    </Button>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-100 text-[12px] text-[#495057] dark:border-zinc-800 dark:text-zinc-400">
                    <div>
                        Loaded {historyRecords.length} of {historyTotal} entries
                        {searchQuery ? ` (search filters loaded rows only)` : ""}
                    </div>
                    {hasNextPage ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-[12px]"
                            disabled={isFetchingNextPage}
                            onClick={() => fetchNextPage()}
                        >
                            {isFetchingNextPage ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Loading…
                                </>
                            ) : (
                                `Load more (${historyPageSize})`
                            )}
                        </Button>
                    ) : (
                        <span className="text-emerald-600 font-semibold">All loaded</span>
                    )}
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
                            {viewingTask?.submittedAt &&
                            !Number.isNaN(new Date(viewingTask.submittedAt).getTime())
                                ? ` on ${new Date(viewingTask.submittedAt).toLocaleString()}`
                                : ""}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2 max-h-[60vh] overflow-y-auto">
                        <div>
                            <h4 className="text-[13px] font-bold text-[#495057] dark:text-zinc-400 mb-1.5">Submitted Links</h4>
                            {(() => {
                                const fromFiles = linkSubmissionsFromFiles(viewingFiles);
                                const fromNotes = uniqueSubmittedLinkUrls([
                                    ...extractSubmittedLinks(viewingTask?.submissionNotes ?? null),
                                    ...extractUrlsFromText(viewingTask?.submissionNotes),
                                ]);
                                const fileKeys = new Set(fromFiles.map((u) => normalizeTaskLinkKey(u)));
                                const extraFromNotes = fromNotes.filter(
                                    (u) => !fileKeys.has(normalizeTaskLinkKey(u)),
                                );
                                const links = [...fromFiles, ...extraFromNotes];
                                if (isViewingFilesLoading && links.length === 0) {
                                    return <p className="text-[13px] text-gray-400">Loading links…</p>;
                                }
                                return links.length === 0 ? (
                                    <p className="text-[13px] text-gray-400">No links submitted.</p>
                                ) : (
                                    <ol className="space-y-2 list-decimal list-inside text-[13px]">
                                        {links.map((link, i) => (
                                            <li key={i} className="break-all">
                                                <a
                                                    href={normalizeHref(link)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-indigo-500 hover:text-indigo-700 underline"
                                                >
                                                    {link}
                                                </a>
                                            </li>
                                        ))}
                                    </ol>
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
                                    ) : (() => {
                                        const noteText = commentPreviewWithoutUrls(viewingTask?.submissionNotes);
                                        const fileNotes = viewingFiles
                                            .filter((f) => f.description?.trim())
                                            .filter((f) => f.fileUrl || !/^https?:\/\//i.test(f.description || ""))
                                            .map((f) => f.description!.trim());
                                        const hasContent = noteText || fileNotes.length > 0;
                                        if (!hasContent) {
                                            return <p className="text-[13px] text-gray-400">No description submitted.</p>;
                                        }
                                        return (
                                            <div className="space-y-2">
                                                {noteText ? (
                                                    <p className="text-[13px] text-gray-600 dark:text-zinc-400 whitespace-pre-wrap">
                                                        {noteText}
                                                    </p>
                                                ) : null}
                                                {fileNotes.map((text, i) => (
                                                    <p key={i} className="text-[13px] text-gray-600 dark:text-zinc-400 whitespace-pre-wrap">
                                                        {text}
                                                    </p>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex items-center justify-end pt-2">
                        <Button variant="secondary" onClick={() => setViewingTask(null)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!linksModal} onOpenChange={(open) => { if (!open) setLinksModal(null); }}>
                <DialogContent className="max-w-lg bg-white dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-bold text-[#495057] dark:text-zinc-400">
                            {linksModal?.title || "Links"}
                        </DialogTitle>
                        <DialogDescription className="text-[12px] text-[#6c757d]">
                            {linksModalUrls.length} link(s) — open in new tab
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] overflow-y-auto py-2">
                        {isLinksModalLoading && linksModalUrls.length === 0 ? (
                            <p className="text-[13px] text-gray-400 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading from webxl_task_links…
                            </p>
                        ) : linksModalUrls.length === 0 ? (
                            <p className="text-[13px] text-gray-400">No links found.</p>
                        ) : (
                            <ol className="space-y-2 list-decimal list-inside text-[13px]">
                                {linksModalUrls.map((link, i) => (
                                    <li key={i} className="break-all pr-2">
                                        <a
                                            href={normalizeHref(link)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-600 hover:text-indigo-800 underline"
                                        >
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button variant="secondary" onClick={() => setLinksModal(null)}>Close</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
