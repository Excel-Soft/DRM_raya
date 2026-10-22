import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";
import { BarChart3 } from "lucide-react";

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
        <Card className="rounded-2xl shadow-sm border border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold text-foreground tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <BarChart3 className="h-4 w-4" />
                    </span>
                    Chart Data
                </CardTitle>
                <div className="w-[180px]">
                    <Select value={category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="h-8 rounded-lg text-xs">
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
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Show</span>
                        <Select value={entries} onValueChange={handleEntriesChange}>
                            <SelectTrigger className="w-[65px] h-8 rounded-lg text-xs">
                                <SelectValue placeholder="10" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10" className="text-xs">10</SelectItem>
                                <SelectItem value="25" className="text-xs">25</SelectItem>
                                <SelectItem value="50" className="text-xs">50</SelectItem>
                                <SelectItem value="100" className="text-xs">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground font-medium">entries</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Search:</span>
                        <Input
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="h-8 w-[180px] rounded-lg text-sm"
                        />
                    </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/50">
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">ID</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Company</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Account</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Email</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Phone</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Grade</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wide text-muted-foreground h-10 py-2">Create</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-muted/40">
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.id}</TableCell>
                                        <TableCell className="py-2 text-sm text-foreground">{row.company}</TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.account}</TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.email}</TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.phone}</TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.grade}</TableCell>
                                        <TableCell className="py-2 text-sm text-muted-foreground">{row.create}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="text-[13px] text-muted-foreground">
                        Showing {startIdx} to {endIdx} of {total} entries
                    </div>
                    <div className="flex items-center">
                        <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 text-xs px-3 rounded-l-lg rounded-r-none border-r-0">Previous</Button>
                        <Button variant="outline" disabled={page >= totalPages || totalPages === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-8 text-xs px-3 rounded-r-lg rounded-l-none">Next</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
