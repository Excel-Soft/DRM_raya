import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Info, Play } from "lucide-react";

interface CompletedProject {
    name: string;
    company: string;
    project: string;
    status: string;
    spent: string;
}

export default function MonthlyCompleteProject() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPeriod, setFilterPeriod] = useState("all");
    const [limit, setLimit] = useState("50");

    // Map the period dropdown to the values the backend understands.
    // Backend supports: TD (today), WK (week), MH (month), QU (quarter).
    // "all" and "qa-changing" have no dedicated backend period → default to month.
    const periodParam =
        filterPeriod === "week" ? "WK" :
        filterPeriod === "month" ? "MH" :
        "MH";

    const { data: projects = [], isLoading } = useQuery<CompletedProject[]>({
        queryKey: ["/api/dd-executive/monthly-complete", periodParam],
        queryFn: async () => {
            const res = await apiRequest(
                "GET",
                `/api/dd-executive/monthly-complete?period=${periodParam}`
            );
            if (!res.ok) throw new Error("Failed to fetch completed projects");
            return res.json();
        }
    });

    const filteredProjects = useMemo(() => {
        let rows = [...projects];

        if (searchTerm) {
            const query = searchTerm.toLowerCase();
            rows = rows.filter(p =>
                (p.company || "").toLowerCase().includes(query) ||
                (p.name || "").toLowerCase().includes(query) ||
                (p.project || "").toLowerCase().includes(query)
            );
        }

        // Apply display limit
        return rows.slice(0, parseInt(limit));
    }, [projects, searchTerm, limit]);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 dark:text-zinc-400">Monthly Complete Project</h1>
            
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardHeader className="py-4 px-6 border-b border-gray-50 flex flex-row items-center justify-between dark:border-zinc-800">
                    <CardTitle className="text-[15px] font-bold text-[#495057] dark:text-zinc-400">Completed Projects</CardTitle>
                    <div className="flex items-center gap-3 space-x-0">
                        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                            <SelectTrigger className="w-[120px] h-9 text-[13px] border-blue-200">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent className="rounded-sm border-gray-200 dark:border-zinc-800">
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="week">Week</SelectItem>
                                <SelectItem value="month">Month</SelectItem>
                                <SelectItem value="qa-changing">QA Changing</SelectItem>
                            </SelectContent>
                        </Select>

                        <Input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-[200px] h-9 text-[13px] border-gray-200 focus-visible:ring-1 focus-visible:ring-gray-300 transition-none dark:border-zinc-800" 
                            placeholder="Search..."
                        />

                        <Select value={limit} onValueChange={setLimit}>
                            <SelectTrigger className="w-[80px] h-9 text-[13px] border-gray-200 dark:border-zinc-800">
                                <SelectValue placeholder="50" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto min-h-[250px]">
                        <table className="w-full text-left border-collapse min-w-[1100px]">
                            <thead>
                                <tr className="bg-[#f8f9fa] text-[#495057] text-[12px] font-bold border-b border-gray-200 uppercase dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <th className="p-3 pl-4 flex items-center gap-2">
                                        <Checkbox className="mr-1 border-gray-300 w-3.5 h-3.5 rounded-sm dark:border-zinc-800" /> NO.
                                    </th>
                                    <th className="p-3">NAME</th>
                                    <th className="p-3">COMPANY</th>
                                    <th className="p-3">QA COMMENT</th>
                                    <th className="p-3">PROJECT</th>
                                    <th className="p-3">FREE</th>
                                    <th className="p-3">TASK</th>
                                    <th className="p-3">STATUS</th>
                                    <th className="p-3">RUN</th>
                                    <th className="p-3">SPENT</th>
                                    <th className="p-3">LINK</th>
                                    <th className="p-3 pr-4 text-center">ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={12} className="py-16 text-center border-b border-gray-300 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                            <div className="flex flex-col items-center justify-center text-[#6c757d]">
                                                <span className="text-[14px]">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={12} className="py-16 text-center border-b border-gray-300 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                            <div className="flex flex-col items-center justify-center text-[#6c757d]">
                                                <Info size={18} className="mb-2 text-[#6c757d]" />
                                                <span className="text-[14px]">No records found</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProjects.map((p, idx) => (
                                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors text-[13px] dark:border-zinc-800">
                                            <td className="p-3 pl-4 flex items-center gap-2 text-gray-500 dark:text-zinc-400">
                                                <Checkbox className="mr-1 border-gray-300 w-3.5 h-3.5 rounded-sm dark:border-zinc-800" /> {(idx + 1).toString().padStart(2, '0')}
                                            </td>
                                            <td className="p-3 font-semibold text-[#495057] dark:text-zinc-400">{p.name || "—"}</td>
                                            <td className="p-3 text-gray-500 dark:text-zinc-400">{p.company || "—"}</td>
                                            <td className="p-3 text-gray-500 dark:text-zinc-400">—</td>
                                            <td className="p-3 font-medium text-[#495057] uppercase dark:text-zinc-400">{p.project || "—"}</td>
                                            <td className="p-3 text-gray-500 dark:text-zinc-400">—</td>
                                            <td className="p-3 text-gray-500 dark:text-zinc-400">—</td>
                                            <td className="p-3">
                                                <span className="bg-gray-100 text-gray-500 text-[11px] px-3 py-1.5 rounded-full font-medium shadow-sm dark:text-zinc-400 dark:bg-zinc-900">
                                                    {p.status || "—"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-500 dark:text-zinc-400">—</td>
                                            <td className="p-3 text-[#00a65a] font-semibold dark:text-zinc-400">{p.spent || "—"}</td>
                                            <td className="p-3 text-gray-400 dark:text-zinc-500">—</td>
                                            <td className="p-3 text-center pr-4">
                                                <button className="text-red-500 hover:text-red-700 transition-colors p-1" aria-label="Action">
                                                    <Play size={16} className="fill-current" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-4 mb-2 text-[12px] text-[#868e96] pl-6 font-medium">
                        {filteredProjects.length === 0 
                            ? "No records to display" 
                            : `Showing 1 to ${filteredProjects.length} of ${filteredProjects.length} entries`}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
