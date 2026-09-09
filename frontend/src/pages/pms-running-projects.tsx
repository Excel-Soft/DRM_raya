import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { useQuery } from "@tanstack/react-query";

interface RunningProjectLink {
    url: string;
    label: string | null;
}

interface RunningProject {
    id: string;
    company: string;
    project: string;
    status: string;
    time: string;
    assign: string;
    date: string;
    links: RunningProjectLink[];
}

export default function PmsRunningProjects() {
    const { data: projects = [], isLoading } = useQuery<RunningProject[]>({
        queryKey: ["/api/pms/department-status"],
    });

    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");

    const filteredData = useMemo(() => {
        const source = projects;
        if (!searchQuery.trim()) return source;
        const lowerSearch = searchQuery.toLowerCase();
        return source.filter((row) => 
            (row.company || "").toLowerCase().includes(lowerSearch) ||
            (row.project || "").toLowerCase().includes(lowerSearch) ||
            (row.assign || "").toLowerCase().includes(lowerSearch) ||
            (row.status || "").toLowerCase().includes(lowerSearch) ||
            (row.date || "").toLowerCase().includes(lowerSearch) ||
            (row.time || "").toLowerCase().includes(lowerSearch)
        );
    }, [searchQuery, projects]);


    const handleExport = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (filteredData.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["Company", "Project", "Status", "Time", "Assign", "Assign Date", "Link"];
        const rows = filteredData.map((row) => [
            row.company,
            row.project,
            row.status,
            row.time,
            row.assign,
            row.date,
            (row.links || []).map((l) => l.url).join(", ")
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
            link.download = `running-projects.${ext}`;
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
                RUNNING PROJECTS
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm p-4 text-[13px] text-[#495057] font-medium mb-6 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                View Detail
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden p-5 dark:bg-zinc-900 dark:border-zinc-800">
                {/* Controls: Buttons & Search */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    {/* Action Buttons */}
                    <div className="flex bg-[#6c757d] rounded-[3px] overflow-hidden shadow-sm h-8">
                        <button 
                            onClick={() => handleExport('copy')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            Copy
                        </button>
                        <button 
                            onClick={() => handleExport('excel')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            Excel
                        </button>
                        <button 
                            onClick={() => handleExport('pdf')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            PDF
                        </button>
                        <button 
                            onClick={() => toast({ title: "Column visibility options clicked" })}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] transition-colors"
                        >
                            Column visibility
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                        <Input 
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-[#d1e7dd] text-[#0a3622] border-b border-[#badbcc] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Company</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Project</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Status</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Time</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Assign</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Assign Date</th>
                                <th className="px-4 py-3 text-[13px] font-bold">Link</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[#495057] dark:text-zinc-400">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        Loading running projects...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No data available in table
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 font-medium dark:border-zinc-800">{row.company}</td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.project}</td>
                                        <td className="px-4 py-4 border-r border-gray-100 dark:border-zinc-800">
                                            <span className="inline-flex bg-[#fdf2e8] text-[#eeb375] text-[11px] px-3 py-1 rounded-full font-bold shadow-sm dark:bg-zinc-900">
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.time}</td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">{row.assign}</td>
                                        <td className="px-4 py-4 text-[13px] border-r border-gray-100 whitespace-nowrap dark:border-zinc-800">{row.date}</td>
                                        <td className="px-4 py-4 text-[13px]">
                                            {row.links && row.links.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {row.links.map((l, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={l.url.startsWith("http") ? l.url : `https://${l.url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-emerald-600 hover:underline break-all"
                                                        >
                                                            {l.label || l.url}
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
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

