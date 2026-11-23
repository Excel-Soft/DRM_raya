import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface OverallProjectRow {
    id: string;
    projectNo: string;
    company: string;
    person: string;
    project: string;
    activityStatus: string;
    workflowStage?: string;
    docUpload: string;
    depApproved: string;
    isActive?: boolean;
}

export default function PmsOverallProjects() {
    const { data: projects = [], isLoading, error } = useQuery<OverallProjectRow[]>({
        queryKey: ["/api/pms/overall-projects"],
        queryFn: async () => {
            const res = await fetch("/api/pms/overall-projects", { credentials: "include" });
            if (res.status === 403) {
                throw new Error("You do not have permission to view overall projects");
            }
            if (!res.ok) throw new Error("Failed to fetch overall projects");
            return res.json();
        },
        retry: false,
    });

    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const lowerSearch = searchQuery.toLowerCase();
        return projects.filter((row) =>
            String(row.projectNo || "").toLowerCase().includes(lowerSearch) ||
            (row.company || "").toLowerCase().includes(lowerSearch) ||
            (row.person || "").toLowerCase().includes(lowerSearch) ||
            (row.project || "").toLowerCase().includes(lowerSearch) ||
            (row.activityStatus || "").toLowerCase().includes(lowerSearch) ||
            (row.docUpload || "").toLowerCase().includes(lowerSearch) ||
            (row.depApproved || "").toLowerCase().includes(lowerSearch)
        );
    }, [searchQuery, projects]);

    const totalFiltered = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const pageEnd = Math.min(safePage * pageSize, totalFiltered);
    const paginatedData = filteredData.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (error) {
            toast({
                title: "Overall Projects",
                description: error instanceof Error ? error.message : "Failed to load",
                variant: "destructive",
            });
        }
    }, [error, toast]);

    const handleExport = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (filteredData.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["No#", "Company", "Person", "Project", "Status", "Doc Upload", "Dep Approved"];
        const rows = filteredData.map((row) => [
            String(row.projectNo || ""),
            row.company,
            row.person,
            row.project,
            row.activityStatus,
            row.docUpload,
            row.depApproved,
        ]);

        if (formatType === "copy") {
            const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
            navigator.clipboard.writeText(text);
            toast({ title: "Data copied to clipboard" });
        } else if (formatType === "csv" || formatType === "excel") {
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const mime = formatType === "csv" ? "text/csv" : "application/vnd.ms-excel";
            const ext = formatType === "csv" ? "csv" : "xls";
            const blob = new Blob([csv], { type: mime });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `overall-projects.${ext}`;
            link.click();
            toast({ title: `${formatType.toUpperCase()} file downloaded` });
        } else if (formatType === "pdf") {
            window.print();
        }
    };

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <div className="mb-6 flex space-x-1 uppercase text-[15px] font-bold tracking-wide text-[#00a65a] items-center dark:text-zinc-400">
                <ArrowRight className="w-4 h-4 mr-1 text-[#00a65a] dark:text-zinc-400" />
                LIST OF PROJECT ACTIVITY
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm p-4 text-[13px] text-[#495057] font-medium mb-6 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                View Detail — read-only overview for your department (active work on top, closed below).
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden p-5 dark:bg-zinc-900 dark:border-zinc-800 flex flex-col min-h-0">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex bg-[#6c757d] rounded-[3px] overflow-hidden shadow-sm h-8">
                            <button
                                type="button"
                                onClick={() => handleExport("copy")}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                            >
                                Copy
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExport("excel")}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                            >
                                Excel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExport("pdf")}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] transition-colors"
                            >
                                PDF
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">Show</span>
                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                <SelectTrigger className="h-8 w-[70px] text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">entries</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                        <Input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-[220px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                        />
                    </div>
                </div>

                <div className="w-full overflow-x-auto flex-1 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1100px]">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#f4f4f4] text-[#333] border-b border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">No#</th>
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">Company</th>
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">Person</th>
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">Project</th>
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">Status</th>
                                <th className="px-3 py-3 text-[13px] font-bold border-r border-gray-200 dark:border-zinc-800">Doc Upload</th>
                                <th className="px-3 py-3 text-[13px] font-bold">Dep Approved</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[#495057] dark:text-zinc-400">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        Loading projects...
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row) => (
                                    <tr
                                        key={row.id}
                                        className={`hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 ${
                                            row.isActive ? "" : "opacity-80"
                                        }`}
                                    >
                                        <td className="px-3 py-3 text-[13px] border-r border-gray-100 font-bold text-emerald-600 dark:border-zinc-800">
                                            {row.projectNo}
                                        </td>
                                        <td className="px-3 py-3 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.company}</td>
                                        <td className="px-3 py-3 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.person}</td>
                                        <td className="px-3 py-3 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.project}</td>
                                        <td className="px-3 py-3 border-r border-gray-100 dark:border-zinc-800">
                                            {row.activityStatus === "Start Work" ? (
                                                <span className="inline-flex bg-emerald-600 text-white text-[11px] px-3 py-1 rounded font-bold shadow-sm">
                                                    Start Work
                                                </span>
                                            ) : (
                                                <span className="inline-flex bg-slate-400 text-white text-[11px] px-3 py-1 rounded font-bold">
                                                    Closed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 text-[12px] border-r border-gray-100 whitespace-nowrap dark:border-zinc-800">
                                            {row.docUpload}
                                        </td>
                                        <td className="px-3 py-3 text-[12px] whitespace-nowrap">{row.depApproved}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 mt-2 border-t border-gray-100 text-[12px] text-[#495057] dark:border-zinc-800 dark:text-zinc-400">
                    <div>
                        Showing {pageStart} to {pageEnd} of {totalFiltered} entries
                        {searchQuery ? ` (filtered from ${projects.length})` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                        <span>
                            Page {safePage} of {totalPages}
                        </span>
                        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800">
                            <button
                                type="button"
                                disabled={safePage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 border-r border-gray-200 dark:border-zinc-800 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-900"
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                disabled={safePage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-900"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}