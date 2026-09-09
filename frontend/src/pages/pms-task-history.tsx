import { useState, useMemo } from "react";
import { Eye, Plug, Link as LinkIcon, ExternalLink, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function isValidHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

interface TaskStatusHistoryRecord {
    id: string;
    taskId: string;
    fromStatus: string | null;
    toStatus: string | null;
    changedAt: string | null;
    notes: string | null;
    company?: string | null;
    task?: { id: string; title: string | null } | null;
    user?: { id: string; name: string | null } | null;
}

const TASK_HISTORY_KEY = "/api/pms/task-history";

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

    const [linksModalOpen, setLinksModalOpen] = useState(false);
    const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
    const [selectedProjectName, setSelectedProjectName] = useState("");

    // Action Modal State
    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [selectedActionRow, setSelectedActionRow] = useState<any>(null);
    const [actionStatus, setActionStatus] = useState<string>("");
    const [actionStage, setActionStage] = useState<string>("");
    const [actionLinks, setActionLinks] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");

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
                    if (Array.isArray(parsed?.links)) {
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
                qa: "N/A",
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
                spent: record.changedAt ? new Date(record.changedAt).toLocaleString() : "",
                links: parsedLinks,
            };
        });
    }, [historyRecords]);

    const filteredHistory = useMemo(() => {
        if (!searchQuery.trim()) return history;
        const lowerSearch = searchQuery.toLowerCase();
        return history.filter((row) =>
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
    }, [searchQuery, history]);

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

    const managerReviewMutation = useMutation({
        mutationFn: async () => {
            const links = actionLinks.split("\n").map((l) => l.trim()).filter(Boolean);
            return apiRequestJson("POST", `/api/tasks/${selectedActionRow?.taskId}/manager-review`, {
                status: actionStatus,
                stage: actionStage,
                links,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [TASK_HISTORY_KEY] });
            setActionModalOpen(false);
            toast({
                title: actionStatus === "complete" ? "Task sent to QA" : "Progress saved",
                description: selectedActionRow?.project
                    ? `Changes for "${selectedActionRow.project}" were saved.`
                    : "Your changes were saved.",
            });
        },
        onError: (err: any) => {
            toast({
                title: "Could not save task",
                description: err?.message || "Please try again.",
                variant: "destructive",
            });
        },
    });

    const handleSaveTask = () => {
        if (!selectedActionRow?.taskId) {
            toast({ title: "Missing task reference", description: "Can't save — this row has no linked task.", variant: "destructive" });
            return;
        }
        if (!actionStatus) {
            toast({ title: "Choose a status", description: "Select Complete or Changing before saving.", variant: "destructive" });
            return;
        }
        const enteredLines = actionLinks.split("\n").map((l) => l.trim()).filter(Boolean);
        const invalidLines = enteredLines.filter((l) => !isValidHttpUrl(l));
        if (invalidLines.length > 0) {
            toast({
                title: "Invalid link",
                description: `"${invalidLines[0]}" is not a valid link. Links must start with http:// or https://.`,
                variant: "destructive",
            });
            return;
        }
        setConfirmOpen(true);
    };

    const handleConfirmSave = () => {
        setConfirmOpen(false);
        managerReviewMutation.mutate();
    };

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] uppercase tracking-wide mb-6 dark:text-zinc-400">
                MONTHLY COMPLETE PROJECT
            </h1>

            <div className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 dark:border-zinc-800">
                    <h3 className="text-[15px] font-bold text-[#495057] dark:text-zinc-400">Completed Projects</h3>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Select defaultValue="all">
                            <SelectTrigger className="h-9 w-[120px] text-[13px] bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
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
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Link</th>
                                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading task history...
                                        </span>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-10 text-center text-[13px] text-red-500">
                                        Failed to load task history{error instanceof Error ? `: ${error.message}` : ""}.
                                    </td>
                                </tr>
                            ) : sortedHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="px-4 py-10 text-center text-[13px] text-gray-400 dark:text-zinc-500">
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
                                    <td className="px-4 py-3 text-center">
                                        <button 
                                            className="text-[#2bc18c] hover:bg-[#2bc18c]/10 p-1.5 rounded-full transition-colors inline-block dark:text-zinc-100"
                                            onClick={() => {
                                                setSelectedLinks(row.links || []);
                                                setSelectedProjectName(row.project);
                                                setLinksModalOpen(true);
                                            }}
                                            title="View Links"
                                        >
                                            <Eye className={`w-[18px] h-[18px] ${(row.links && row.links.length > 0) ? "" : "opacity-40"}`} strokeWidth={2} />
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button 
                                            className="text-[#2bc18c] hover:bg-[#2bc18c]/10 p-1.5 rounded-full transition-colors inline-block dark:text-zinc-100"
                                            onClick={() => {
                                                setSelectedActionRow(row);
                                                setActionStatus("complete");
                                                setActionStage("");
                                                setActionLinks((row.links || []).join("\n"));
                                                setActionModalOpen(true);
                                            }}
                                            title="Complete Task"
                                        >
                                            <Plug className="w-[18px] h-[18px]" strokeWidth={2} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Links Viewer Modal */}
            <Dialog open={linksModalOpen} onOpenChange={setLinksModalOpen}>
                <DialogContent className="max-w-md bg-white p-0 overflow-hidden border-0 shadow-lg font-sans dark:bg-zinc-900">
                    <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gray-50/50 dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-lg font-bold text-[#343a40] flex items-center gap-2 dark:text-zinc-100">
                            <LinkIcon className="text-emerald-500 w-5 h-5" />
                            Submitted Project Links
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#6c757d]">
                            Viewing workflow output links mapped to <span className="font-semibold text-emerald-600">{selectedProjectName}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 pt-4 max-h-[60vh] overflow-y-auto">
                        {selectedLinks.length > 0 ? (
                            <div className="space-y-3">
                                {selectedLinks.map((link, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-emerald-100 dark:hover:border-emerald-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/30 transition-colors group">
                                        <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <a 
                                                href={link.startsWith('http') ? link : `https://${link}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-blue-600 hover:text-blue-800 break-words line-clamp-2"
                                            >
                                                {link}
                                            </a>
                                        </div>
                                        <a 
                                            href={link.startsWith('http') ? link : `https://${link}`} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="shrink-0 text-gray-400 hover:text-emerald-500 transition-colors"
                                            title="Open link in new tab"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                <LinkIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">No links were attached to this project.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Complete Task Action Modal */}
            <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
                <DialogContent className="max-w-xl bg-white p-0 border-0 shadow-xl font-sans rounded-none dark:bg-zinc-900">
                    <DialogHeader className="px-6 py-4 border-b border-gray-100 flex flex-row items-center justify-between dark:border-zinc-800">
                        <DialogTitle className="text-[19px] font-bold text-[#495057] dark:text-zinc-400">
                            Complete Task
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-5 shadow-[inset_0px_10px_15px_-10px_rgba(0,0,0,0.03)] bg-gradient-to-b from-[#f8f9fc]/50 to-white">
                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Company</label>
                            <Input 
                                disabled 
                                value={selectedActionRow?.company || ""} 
                                className="bg-[#f3f4f8] border-gray-200 text-[#495057] h-10 w-full dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Status</label>
                            <Select value={actionStatus} onValueChange={setActionStatus}>
                                <SelectTrigger className="w-full text-[14px] text-gray-500 h-10 border-gray-200 focus:ring-1 focus:ring-emerald-500/50 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="complete">Complete</SelectItem>
                                    <SelectItem value="changing">Changing</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Stage</label>
                            <Select value={actionStage} onValueChange={setActionStage}>
                                <SelectTrigger className="w-full text-[14px] text-gray-500 h-10 border-gray-200 focus:ring-1 focus:ring-emerald-500/50 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="design">Design</SelectItem>
                                    <SelectItem value="development">Development</SelectItem>
                                    <SelectItem value="data-feeding">Data Feeding</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Final Links</label>
                            <textarea
                                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-[#495057] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 min-h-[140px] resize-y dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                placeholder="One link per line..."
                                value={actionLinks}
                                onChange={(e) => setActionLinks(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-4 px-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/10 dark:border-zinc-800">
                        <Button 
                            variant="secondary" 
                            className="bg-[#f0f2f5] hover:bg-[#e4e6eb] text-[#343a40] text-[14px] font-medium px-6 shadow-none dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100"
                            onClick={() => setActionModalOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-[#0f9d58] hover:bg-[#0b8043] text-white text-[14px] font-medium px-6 shadow-sm"
                            onClick={handleSaveTask}
                            disabled={managerReviewMutation.isPending}
                        >
                            {managerReviewMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Submit Confirmation */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Submit this task?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to submit this task? This action will record your changes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSave}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
