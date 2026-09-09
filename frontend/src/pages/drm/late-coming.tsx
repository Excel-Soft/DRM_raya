import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ApiUser {
    id: string;
    fullName: string | null;
    email: string | null;
    department: string | null;
}
interface UsersResult {
    users: ApiUser[];
}

interface LateRow {
    id: string;
    userId: string;
    name: string | null;
    department: string | null;
    date: string | null;
    source: "attendance" | "manual";
    lateMinutes: number | null;
    purpose: string | null;
    details: string | null;
}
interface ListResult {
    data: LateRow[];
    total: number;
    page: number;
    pageSize: number;
}

function fmtDateTime(v: string | null): string {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

const EMPTY_FORM = {
    userId: "",
    purpose: "",
    lateMinutes: "",
    details: "",
};
type FormState = typeof EMPTY_FORM;

export default function LateComingPage() {
    const { toast } = useToast();
    const [isAddMode, setIsAddMode] = useState(false);
    const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [userFilter, setUserFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");

    const usersQuery = useQuery<UsersResult>({
        queryKey: ["/api/users"],
        queryFn: () => apiRequestJson<UsersResult>("GET", "/api/users"),
    });
    const users = usersQuery.data?.users ?? [];
    const departments = useMemo(() => {
        const set = new Set<string>();
        for (const u of users) if (u.department) set.add(u.department);
        return Array.from(set).sort();
    }, [users]);

    const listKey = ["/api/drm/late-coming", page, pageSize, search, dateFrom, dateTo, userFilter, departmentFilter] as const;
    const listQuery = useQuery<ListResult>({
        queryKey: listKey,
        queryFn: () => {
            const p = new URLSearchParams();
            p.set("page", String(page));
            p.set("pageSize", String(pageSize));
            if (search.trim()) p.set("search", search.trim());
            if (dateFrom) p.set("dateFrom", dateFrom);
            if (dateTo) p.set("dateTo", dateTo);
            if (userFilter !== "all") p.set("userId", userFilter);
            if (departmentFilter !== "all") p.set("department", departmentFilter);
            return apiRequestJson<ListResult>("GET", `/api/drm/late-coming?${p.toString()}`);
        },
    });

    const rows = listQuery.data?.data ?? [];
    const total = listQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const startEntry = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const endEntry = Math.min(page * pageSize, total);

    const createMutation = useMutation({
        mutationFn: (payload: FormState) =>
            apiRequestJson("POST", "/api/drm/late-coming", {
                userId: payload.userId,
                lateMinutes: Number(payload.lateMinutes),
                purpose: payload.purpose.trim() || null,
                details: payload.details.trim() || null,
            }),
        onSuccess: () => {
            toast({ title: "Late entry added" });
            setForm({ ...EMPTY_FORM });
            setIsAddMode(false);
            queryClient.invalidateQueries({ queryKey: ["/api/drm/late-coming"] });
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message ?? "Failed to add entry", variant: "destructive" }),
    });

    function submitForm() {
        if (!form.userId) return toast({ title: "Person is required", variant: "destructive" });
        if (form.lateMinutes === "" || isNaN(Number(form.lateMinutes)) || Number(form.lateMinutes) < 0)
            return toast({ title: "Time in minutes must be 0 or greater", variant: "destructive" });
        createMutation.mutate(form);
    }

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <h1 className="text-[16px] font-bold tracking-wide uppercase mb-6 flex items-center">
                <span className="text-[#495057] dark:text-zinc-400">LATE COMING</span>
                <span className="mx-1 text-[#495057] dark:text-zinc-400">/</span>
                <span
                    className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
                    onClick={() => setIsAddMode(!isAddMode)}
                >
                    ADD LATE MINUT
                </span>
            </h1>

            {/* Conditionally Rendered Add Form */}
            {isAddMode && (
                <Card className="border border-gray-100 shadow-sm rounded-md bg-white mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <CardContent className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Person</Label>
                                <Select value={form.userId} onValueChange={(v) => setForm((f) => ({ ...f, userId: v }))}>
                                    <SelectTrigger className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.fullName || u.email || "Unnamed"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Purpose</Label>
                                <Input
                                    placeholder="purpose"
                                    value={form.purpose}
                                    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                />
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Time In Mint</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    placeholder="time in mint"
                                    value={form.lateMinutes}
                                    onChange={(e) => setForm((f) => ({ ...f, lateMinutes: e.target.value }))}
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                />
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Detail</Label>
                                <Input
                                    placeholder="add detail"
                                    value={form.details}
                                    onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div>
                            <Button
                                onClick={submitForm}
                                disabled={createMutation.isPending}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-[13px] font-medium shadow-none"
                            >
                                {createMutation.isPending ? "Submitting..." : "Submit"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Data Table */}
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-5">
                    {/* Filters */}
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">From</span>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                                className="h-8 w-[150px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">To</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                                className="h-8 w-[150px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">Person</span>
                            <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1); }}>
                                <SelectTrigger className="h-8 w-[170px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue placeholder="All persons" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All persons</SelectItem>
                                    {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.fullName || u.email || "Unnamed"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-[#495057] dark:text-zinc-400">Department</span>
                            <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                                <SelectTrigger className="h-8 w-[170px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue placeholder="All departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All departments</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table Controls */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Show</span>
                            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                                <SelectTrigger className="h-8 w-[70px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">entries</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                            <Input
                                type="search"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full border border-gray-200 overflow-hidden mb-4 dark:border-zinc-800">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-[#f2f2f2] border-b border-gray-200 dark:bg-zinc-800 dark:border-zinc-800">
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white w-[50px] dark:text-zinc-400">#</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Name</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Purpose</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Time</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Detail</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Create</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] dark:text-zinc-400">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {listQuery.isLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {listQuery.isError && !listQuery.isLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-4 text-[13px] text-red-600">
                                            Failed to load late coming report.
                                        </td>
                                    </tr>
                                )}
                                {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                                            No data available in table
                                        </td>
                                    </tr>
                                )}
                                {!listQuery.isLoading && !listQuery.isError && rows.map((row, idx) => (
                                    <tr key={row.id} className="border-b border-gray-100 dark:border-zinc-800">
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{startEntry + idx}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.name ?? "—"}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.purpose ?? "—"}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.lateMinutes === null ? "—" : row.lateMinutes}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.details ?? "—"}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{fmtDateTime(row.date)}</td>
                                        <td className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400 capitalize">{row.source}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Controls */}
                    <div className="flex justify-between items-center text-[13px] text-[#495057] dark:text-zinc-400">
                        <div>Showing {startEntry} to {endEntry} of {total} entries</div>
                        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 bg-[#f9f9f9] text-[#495057] border-r border-gray-200 disabled:text-[#b0b0b0] disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:disabled:text-zinc-600"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 bg-white text-[#495057] disabled:text-[#b0b0b0] disabled:cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-300 dark:disabled:text-zinc-600"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
