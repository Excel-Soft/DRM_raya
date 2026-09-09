import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LeaveRequest } from "@shared/schema";

export default function ServiceLeaveApplication() {
    const [searchQuery, setSearchQuery] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);

    const { data: leaveRequests, isLoading } = useQuery<LeaveRequest[]>({
        queryKey: ["/api/leave"],
    });

    const safeDate = (value: string | Date | null | undefined) => {
        if (!value) return "—";
        const d = new Date(value);
        return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy");
    };

    const dayCount = (from: string | Date | null | undefined, to: string | Date | null | undefined) => {
        if (!from || !to) return "—";
        const f = new Date(from);
        const t = new Date(to);
        if (isNaN(f.getTime()) || isNaN(t.getTime())) return "—";
        const diff = Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return diff > 0 ? String(diff) : "—";
    };

    const filtered = (leaveRequests || []).filter((leave) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = ((leave as any).userName || "Employee").toLowerCase();
        return (
            name.includes(q) ||
            (leave.purpose || "").toLowerCase().includes(q) ||
            (leave.leaveType || "").toLowerCase().includes(q) ||
            (leave.status || "").toLowerCase().includes(q)
        );
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const rows = filtered.slice(startIndex, startIndex + pageSize);

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">PENDING LEAVE</h2>
                <span className="text-[17px] font-bold text-slate-300">/</span>
                <h2 className="text-[17px] font-bold text-[#059669] uppercase tracking-tight dark:text-zinc-400">FORMS</h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Top Controls: Show entries and Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                        <span>Show</span>
                        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                            <SelectTrigger className="w-[70px] h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                        <span>Search:</span>
                        <Input
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Purpose</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Type</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Alternative</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Detail</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Monthly Leaves</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Monthly Half Leaves</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Day</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Time</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Start</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">End</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                    <TableCell colSpan={14} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                        {isLoading ? "Loading..." : "No data available in table"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((leave, idx) => (
                                    <TableRow key={leave.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{startIndex + idx + 1}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-3 dark:text-zinc-300">{(leave as any).userName || "Employee"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.purpose || "—"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.leaveType || "—"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.alternative || "—"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.description || "—"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">—</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">—</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{dayCount(leave.fromDate, leave.toDate)}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.time || "—"}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{safeDate(leave.fromDate)}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{safeDate(leave.toDate)}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{safeDate(leave.createdAt)}</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{leave.status || "—"}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-[13px] text-slate-500 gap-4 dark:text-zinc-400">
                    <div>
                        Showing {total === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + pageSize, total)} of {total} entries
                    </div>
                    <div className="flex">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l text-slate-400 bg-white hover:bg-slate-50 font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded-r text-slate-400 bg-white hover:bg-slate-50 font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                        >
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
