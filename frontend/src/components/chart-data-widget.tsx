import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";

interface ChartDataRow {
  id: string;
  company: string;
  account: string;
  email: string;
  phone: string;
  grade: string;
  create: string;
}

export function ChartDataWidget({ period }: { period?: string }) {
    const [entries, setEntries] = useState("10");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("ld");

    const [page, setPage] = useState(1);

    const { data: chartData, isLoading } = useQuery<{ success: boolean; data: ChartDataRow[]; total: number }>({
        queryKey: ["/api/dashboard/chart-data", category, entries, search, page, period],
        queryFn: async () => {
            const params = new URLSearchParams({
                stage: category,
                limit: entries,
                page: page.toString()
            });
            if (search) params.append("search", search);
            if (period) params.append("period", period);
            
            const res = await fetch(`/api/dashboard/chart-data?${params.toString()}`, { headers: getAuthHeader(), credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch chart data");
            return res.json();
        }
    });

    const rows = chartData?.data || [];
    const total = chartData?.total || 0;
    const limit = parseInt(entries, 10);
    const startIdx = total > 0 ? (page - 1) * limit + 1 : 0;
    const endIdx = Math.min(page * limit, total);
    const totalPages = Math.ceil(total / limit);

    // Reset page to 1 when filters change
    const handleCategoryChange = (val: string) => { setCategory(val); setPage(1); };
    const handleEntriesChange = (val: string) => { setEntries(val); setPage(1); };
    const handleSearchChange = (val: string) => { setSearch(val); setPage(1); };

    return (
        <Card className="shadow-sm border border-slate-100 rounded-md dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Chart Data</CardTitle>
                <div className="w-[180px]">
                    <Select value={category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="h-8 text-xs border-slate-200 text-slate-600 focus:ring-0 dark:text-zinc-300 dark:border-zinc-800">
                            <SelectValue placeholder="LD (Lead)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            <SelectItem value="ld" className="text-xs">LD (Lead)</SelectItem>
                            <SelectItem value="qf" className="text-xs">QF (Qualify)</SelectItem>
                            <SelectItem value="ay" className="text-xs">AY (Analysis)</SelectItem>
                            <SelectItem value="in" className="text-xs">IN (Invoice)</SelectItem>
                            <SelectItem value="pm" className="text-xs">PM (Payment)</SelectItem>
                            <SelectItem value="gm" className="text-xs">GM (Gold Member)</SelectItem>
                            <SelectItem value="bv" className="text-xs">BV (Bussines Verification)</SelectItem>
                            <SelectItem value="nc" className="text-xs">NC (New Customer)</SelectItem>
                            <SelectItem value="rc" className="text-xs">RC (Renewal Customer)</SelectItem>
                            <SelectItem value="ec" className="text-xs">EC (Expire Customer)</SelectItem>
                            <SelectItem value="fw" className="text-xs">FW (Follow)</SelectItem>
                            <SelectItem value="nf" className="text-xs">NF (Not Follow)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium dark:text-zinc-400">Show</span>
                        <Select value={entries} onValueChange={handleEntriesChange}>
                            <SelectTrigger className="w-[65px] h-8 text-xs border-slate-200 dark:border-zinc-800">
                                <SelectValue placeholder="10" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10" className="text-xs">10</SelectItem>
                                <SelectItem value="25" className="text-xs">25</SelectItem>
                                <SelectItem value="50" className="text-xs">50</SelectItem>
                                <SelectItem value="100" className="text-xs">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-slate-500 font-medium dark:text-zinc-400">entries</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium dark:text-zinc-400">Search:</span>
                        <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="h-8 w-[180px] border-slate-200 text-sm focus-visible:ring-0 dark:border-zinc-800"
                        />
                    </div>
                </div>

                <div className="border border-slate-100 rounded overflow-hidden dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">ID</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Company</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Account</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Email</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Phone</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Grade</TableHead>
                                <TableHead className="font-bold text-slate-700 h-10 py-2 dark:text-zinc-400">Create</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6 dark:text-zinc-400">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="text-center text-sm text-slate-500 py-6 dark:text-zinc-400">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800">
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.id}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.company}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.account}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.email}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.phone}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.grade}</TableCell>
                                        <TableCell className="py-2 text-sm text-slate-600 dark:text-zinc-300">{row.create}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="text-[13px] text-slate-500 dark:text-zinc-400">
                        Showing {startIdx} to {endIdx} of {total} entries
                    </div>
                    <div className="flex items-center">
                        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 text-xs px-3 rounded-r-none border-r-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800">Previous</Button>
                        <Button variant="outline" disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-8 text-xs px-3 rounded-l-none text-slate-600 hover:text-slate-700 hover:bg-slate-50 dark:text-zinc-300 dark:border-zinc-800 dark:hover:bg-zinc-800">Next</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
