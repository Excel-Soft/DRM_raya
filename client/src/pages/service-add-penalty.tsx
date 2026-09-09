import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApiUser {
    id: string;
    name: string | null;
    fullName: string | null;
    email: string | null;
}
interface UserGroup {
    roleId: string;
    roleLabel: string;
    users: ApiUser[];
}
interface PenaltyRow {
    id: string;
    employeeId: string;
    employeeName: string | null;
    penaltyHead: string;
    amount: string | number;
    penaltyDate: string;
    addedByName: string | null;
}
interface ListResult {
    data: PenaltyRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}
interface MetaResult {
    penaltyHeads: string[];
}

const DEFAULT_HEADS = ["Gm Pending Ac", "Mobile", "Others"];

export default function ServiceAddPenalty() {
    const { toast } = useToast();
    const [showForm, setShowForm] = useState(false);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState("");

    const [employeeId, setEmployeeId] = useState("");
    const [penaltyHead, setPenaltyHead] = useState("");
    const [amount, setAmount] = useState("");

    const metaQuery = useQuery<MetaResult>({
        queryKey: ["/api/penalties/meta"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/penalties/meta");
            if (!res.ok) throw new Error("Failed to load meta");
            return res.json();
        },
    });
    const heads = metaQuery.data?.penaltyHeads?.length ? metaQuery.data.penaltyHeads : DEFAULT_HEADS;

    const usersQuery = useQuery<{ groups: UserGroup[] }>({
        queryKey: ["/api/penalties/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/penalties/users");
            if (!res.ok) throw new Error("Failed to load users");
            return res.json();
        },
    });
    const allUsers = useMemo(
        () => (usersQuery.data?.groups ?? []).flatMap((g) => g.users),
        [usersQuery.data],
    );

    const listQuery = useQuery<ListResult>({
        queryKey: ["/api/penalties", page, limit, search],
        queryFn: async () => {
            const p = new URLSearchParams();
            p.set("page", String(page));
            p.set("limit", String(limit));
            if (search.trim()) p.set("search", search.trim());
            const res = await apiRequest("GET", `/api/penalties?${p.toString()}`);
            if (!res.ok) throw new Error("Failed to load penalties");
            return res.json();
        },
    });

    const rows = listQuery.data?.data ?? [];
    const pagination = listQuery.data?.pagination;
    const total = pagination?.total ?? 0;
    const totalPages = pagination?.totalPages ?? 1;
    const startIndex = (page - 1) * limit;

    const saveMutation = useMutation({
        mutationFn: async () => {
            const body = {
                employeeId,
                penaltyHead,
                reason: penaltyHead,
                amount: Number(amount),
                penaltyDate: new Date().toISOString().slice(0, 10),
            };
            const res = await apiRequest("POST", "/api/penalties", body);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "Failed to add penalty");
            return json;
        },
        onSuccess: () => {
            toast({ title: "Penalty added" });
            setEmployeeId("");
            setPenaltyHead("");
            setAmount("");
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const handleSubmit = () => {
        if (!employeeId) {
            toast({ title: "Person is required", variant: "destructive" });
            return;
        }
        if (!penaltyHead) {
            toast({ title: "Head is required", variant: "destructive" });
            return;
        }
        if (!amount || isNaN(Number(amount)) || Number(amount) < 0) {
            toast({ title: "Valid amount is required", variant: "destructive" });
            return;
        }
        saveMutation.mutate();
    };

    const safeDate = (v: string | null | undefined) => {
        if (!v) return "—";
        const d = new Date(v);
        return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">PENALTY</h2>
                <span className="text-[17px] font-bold text-slate-300">/</span>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="text-[17px] font-bold text-[#059669] uppercase tracking-tight hover:opacity-80 transition-opacity dark:text-zinc-400"
                >
                    ADD PENALTY
                </button>
            </div>

            {/* Add Penalty Form */}
            {showForm && (
                <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="flex flex-col md:flex-row items-end gap-6">
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Person</label>
                            <Select value={employeeId} onValueChange={setEmployeeId}>
                                <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allUsers.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.fullName || u.name || u.email || u.id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Head</label>
                            <Select value={penaltyHead} onValueChange={setPenaltyHead}>
                                <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {heads.map((h) => (
                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Amount</label>
                            <Input
                                type="number"
                                placeholder="00:00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full h-10 text-[13px] border-slate-200 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                        <div>
                            <Button
                                onClick={handleSubmit}
                                disabled={saveMutation.isPending}
                                className="bg-[#059669] hover:bg-[#047857] text-white font-medium h-10 px-8 rounded text-[13px]"
                            >
                                Submit
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Top Controls: Show entries and Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                        <span>Show</span>
                        <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
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

                    <div className="flex flex-col items-end gap-1 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                        <label>Search:</label>
                        <Input
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">No</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Penalty Head</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Amount</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Date</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Add By</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap w-[10%] dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                    <TableCell colSpan={7} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                        {listQuery.isLoading ? "Loading..." : "No data available in table"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={row.id} className="hover:bg-transparent border-b border-slate-100 text-[13px] font-medium text-[#475569] h-12 dark:text-zinc-400 dark:border-zinc-800">
                                        <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{startIndex + idx + 1}</TableCell>
                                        <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.employeeName || "—"}</TableCell>
                                        <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.penaltyHead || "—"}</TableCell>
                                        <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.amount ?? "—"}</TableCell>
                                        <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{safeDate(row.penaltyDate)}</TableCell>
                                        <TableCell className="py-2 border-r border-slate-100 text-[#64748b] dark:border-zinc-800">{row.addedByName || ""}</TableCell>
                                        <TableCell className="py-2"></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                    <div>
                        Showing {total === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + limit, total)} of {total} entries
                    </div>

                    <div className="flex rounded mt-4 sm:mt-0 shadow-sm">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l text-[#94a3b8] bg-white hover:bg-slate-50 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                        >
                            Previous
                        </button>
                        <button className="px-3.5 py-1.5 border-y border-[#059669] text-white bg-[#059669] font-medium relative -ml-[1px] dark:border-zinc-800">
                            {page}
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 border border-slate-200 border-l-0 rounded-r text-[#94a3b8] bg-white hover:bg-slate-50 font-medium transition-colors relative -ml-[1px] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                        >
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
