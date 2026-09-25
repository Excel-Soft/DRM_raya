import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";

interface ClosedProjectRow {
    taskId: string;
    title: string | null;
    status: string | null;
    qaReviewedAt: string | null;
    qaLevel: string | null;
    qaRemarks: string | null;
    verificationReviewedAt: string | null;
    verificationLevel: string | null;
    verificationRemarks: string | null;
    companyName: string | null;
    projectName: string | null;
    executive: { id: string; name: string | null } | null;
    timeSpentMinutes: number;
}

function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return "0m";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDateTime(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function PmsCompleteClosedProjects() {
    const [searchQuery, setSearchQuery] = useState("");

    const { data, isLoading, isError, error } = useQuery<ClosedProjectRow[]>({
        queryKey: ["/api/pms/complete-closed-projects"],
        queryFn: () => apiRequestJson<ClosedProjectRow[]>("GET", "/api/pms/complete-closed-projects"),
    });

    const rows = data || [];

    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return rows;
        const q = searchQuery.toLowerCase();
        return rows.filter((row) =>
            (row.companyName || "").toLowerCase().includes(q) ||
            (row.projectName || "").toLowerCase().includes(q) ||
            (row.title || "").toLowerCase().includes(q) ||
            (row.executive?.name || "").toLowerCase().includes(q)
        );
    }, [searchQuery, rows]);

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <div className="mb-6 flex items-center gap-2 uppercase text-[15px] font-bold tracking-wide text-[#00a65a] dark:text-zinc-400">
                <CheckCircle2 className="w-4 h-4" />
                Complete and Closed Project
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm p-4 text-[13px] text-[#495057] font-medium mb-6 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                Projects whose task has finished the whole review pipeline — approved by the manager, reviewed by QA, and reviewed by Verification. These no longer show on Task Complete since there's nothing left to action.
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden p-5 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    <span className="text-[13px] font-bold text-[#495057] dark:text-zinc-300">{filteredRows.length} closed project{filteredRows.length === 1 ? "" : "s"}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search company, project, executive..."
                                className="h-8 w-[240px] pl-8 bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                            />
                        </div>
                    </div>
                </div>

                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead>
                            <tr className="bg-[#d1e7dd] text-[#0a3622] border-b border-[#badbcc] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Company</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Project / Task</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Executive</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">QA</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Verification</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Time Spent</th>
                                <th className="px-4 py-3 text-[13px] font-bold">Closed On</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[#495057] dark:text-zinc-400">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Loading closed projects…
                                        </span>
                                    </td>
                                </tr>
                            ) : isError ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-red-600 dark:text-red-400">
                                        {error instanceof Error ? error.message : "Failed to load closed projects."}
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No closed projects yet.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.taskId} className="hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 font-bold dark:border-zinc-800">{row.companyName || "—"}</td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-700 dark:text-zinc-300">{row.projectName || "—"}</span>
                                                <span className="text-[11px] text-gray-400">{row.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.executive?.name || "—"}</td>
                                        <td className="px-4 py-4 text-[12px] border-r border-gray-100 dark:border-zinc-800">
                                            <div className="flex flex-col gap-0.5">
                                                {row.qaLevel && (
                                                    <span className="inline-flex w-fit bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded-full font-bold dark:bg-zinc-900">{row.qaLevel}</span>
                                                )}
                                                <span className="text-gray-400">{formatDateTime(row.qaReviewedAt)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-[12px] border-r border-gray-100 dark:border-zinc-800">
                                            <div className="flex flex-col gap-0.5">
                                                {row.verificationLevel && (
                                                    <span className="inline-flex w-fit bg-sky-50 text-sky-700 text-[11px] px-2 py-0.5 rounded-full font-bold dark:bg-zinc-900">{row.verificationLevel}</span>
                                                )}
                                                <span className="text-gray-400">{formatDateTime(row.verificationReviewedAt)}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">{formatDuration(row.timeSpentMinutes)}</td>
                                        <td className="px-4 py-4">
                                            <span className="inline-flex bg-[#ebfbf1] text-[#0a3622] text-[11px] px-3 py-1 rounded-full font-bold shadow-sm dark:bg-zinc-900 dark:text-zinc-300">
                                                Closed
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
