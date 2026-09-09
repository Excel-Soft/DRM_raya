import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const TABLE_COLUMNS = [
    { id: "no", label: "No#" },
    { id: "date", label: "Date" },
    { id: "person", label: "Person" },
    { id: "status", label: "Status" },
    { id: "commissionType", label: "Commission Type" },
    { id: "amount", label: "Amount" },
    { id: "percent", label: "%" },
    { id: "commission", label: "Commission" },
    { id: "reward", label: "Reward" },
    { id: "teamReward", label: "Team Reward" },
    { id: "pay", label: "Pay" },
    { id: "total", label: "Total" },
    { id: "action", label: "Action" },
];

const PAGE_SIZE = 25;

interface CommissionRow {
    id: string;
    userId: string | null;
    name: string | null;
    department: string | null;
    period: string | null;
    packageName: string | null;
    amount: string | number | null;
    commissionPct: string | number | null;
    commission: string | number | null;
    reward: string | number | null;
    teamReward: string | number | null;
    pay: string | number | null;
    status: string;
    reason: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    createdBy: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}
interface ListResult {
    data: CommissionRow[];
    total: number;
    page: number;
    pageSize: number;
}

function toNum(v: string | number | null | undefined): number {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}
function fmtMoney(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    return isNaN(n) ? String(v) : n.toLocaleString();
}
function fmtPct(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    return isNaN(n) ? String(v) : String(n);
}
function fmtDate(v: string | null | undefined): string {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function rowTotal(r: CommissionRow): number {
    return toNum(r.commission) + toNum(r.reward) + toNum(r.teamReward) + toNum(r.pay);
}

export default function CommissionVerificationPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<"approved" | "not-approved">("approved");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
        Object.fromEntries(TABLE_COLUMNS.map(c => [c.id, true]))
    );
    const [rejectRow, setRejectRow] = useState<CommissionRow | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const statusParam = activeTab === "approved" ? "approved" : "not approved";

    const listKey = ["/api/drm/commission-verifications", statusParam, search, page] as const;
    const listQuery = useQuery<ListResult>({
        queryKey: listKey,
        queryFn: async () => {
            const p = new URLSearchParams();
            p.set("page", String(page));
            p.set("pageSize", String(PAGE_SIZE));
            p.set("status", statusParam);
            if (search.trim()) p.set("search", search.trim());
            return apiRequestJson<ListResult>("GET", `/api/drm/commission-verifications?${p.toString()}`);
        },
    });

    const rows = listQuery.data?.data ?? [];
    const total = listQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function invalidate() {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/commission-verifications"] });
    }

    const approveMutation = useMutation({
        mutationFn: async (id: string) =>
            apiRequestJson("PATCH", `/api/drm/commission-verifications/${id}/approve`),
        onSuccess: () => {
            toast({ title: "Commission approved" });
            invalidate();
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
            apiRequestJson("PATCH", `/api/drm/commission-verifications/${id}/reject`, { reason }),
        onSuccess: () => {
            toast({ title: "Commission rejected" });
            setRejectRow(null);
            setRejectReason("");
            invalidate();
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    function submitReject() {
        if (!rejectRow) return;
        if (!rejectReason.trim()) {
            toast({ title: "Reason is required", variant: "destructive" });
            return;
        }
        rejectMutation.mutate({ id: rejectRow.id, reason: rejectReason.trim() });
    }

    const toggleColumn = (id: string, checked: boolean) => {
        setVisibleColumns(prev => ({ ...prev, [id]: checked }));
    };

    const activeCols = TABLE_COLUMNS.filter(c => visibleColumns[c.id]);

    const totals = useMemo(() => {
        return rows.reduce(
            (acc, r) => {
                acc.amount += toNum(r.amount);
                acc.commission += toNum(r.commission);
                acc.reward += toNum(r.reward);
                acc.teamReward += toNum(r.teamReward);
                acc.pay += toNum(r.pay);
                acc.total += rowTotal(r);
                return acc;
            },
            { amount: 0, commission: 0, reward: 0, teamReward: 0, pay: 0, total: 0 },
        );
    }, [rows]);

    function cellText(col: { id: string; label: string }, row: CommissionRow, idx: number): string {
        switch (col.id) {
            case "no": return String((page - 1) * PAGE_SIZE + idx + 1);
            case "date": return fmtDate(row.createdAt);
            case "person": return row.name ?? "—";
            case "status": return row.status;
            case "commissionType": return row.packageName ?? "—";
            case "amount": return fmtMoney(row.amount);
            case "percent": return fmtPct(row.commissionPct);
            case "commission": return fmtMoney(row.commission);
            case "reward": return fmtMoney(row.reward);
            case "teamReward": return fmtMoney(row.teamReward);
            case "pay": return fmtMoney(row.pay);
            case "total": return fmtMoney(rowTotal(row));
            default: return "";
        }
    }

    const handleCopy = () => {
        const cols = activeCols.filter(c => c.id !== "action");
        const headerText = cols.map(c => c.label).join("\t");
        const bodyText = rows.length === 0
            ? "No data available in table"
            : rows.map((r, i) => cols.map(c => cellText(c, r, i)).join("\t")).join("\n");
        const text = headerText + "\n" + bodyText;
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Table data copied to clipboard!" });
        });
    };

    const handleExcel = () => {
        const cols = activeCols.filter(c => c.id !== "action");
        const headerCsv = cols.map(c => `"${c.label}"`).join(",");
        const bodyCsv = rows.length === 0
            ? cols.map((_, i) => (i === 0 ? '"No data available in table"' : '""')).join(",")
            : rows.map((r, i) => cols.map(c => `"${cellText(c, r, i).replace(/"/g, '""')}"`).join(",")).join("\n");

        const totalRowArray = cols.map((c, i) => {
            if (i === 0) return '"Total"';
            switch (c.id) {
                case "amount": return `"${totals.amount.toLocaleString()}"`;
                case "commission": return `"${totals.commission.toLocaleString()}"`;
                case "reward": return `"${totals.reward.toLocaleString()}"`;
                case "teamReward": return `"${totals.teamReward.toLocaleString()}"`;
                case "pay": return `"${totals.pay.toLocaleString()}"`;
                case "total": return `"${totals.total.toLocaleString()}"`;
                default: return '""';
            }
        });
        const totalCsv = totalRowArray.join(",");

        const csvContent = [headerCsv, bodyCsv, totalCsv].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'commission_verification.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handlePdf = () => {
        window.print();
    };

    function setTab(tab: "approved" | "not-approved") {
        setActiveTab(tab);
        setPage(1);
    }

    const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const showingTo = Math.min(page * PAGE_SIZE, total);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] print:bg-white print:p-0 dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-6 print:hidden dark:text-zinc-400">
                Commission Verification
            </h1>

            <Card className="border border-gray-100 shadow-sm rounded-md bg-white print:shadow-none print:border-none dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-6 print:p-0">
                    {/* Top Tabs */}
                    <div className="grid grid-cols-2 gap-0 mb-8 border border-gray-200 rounded-sm overflow-hidden print:hidden dark:border-zinc-800">
                        <div
                            className={cn(
                                "py-3 text-center cursor-pointer text-[14px] font-semibold transition-colors bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800",
                                activeTab === "approved" && "bg-[#00a65a] text-white hover:bg-[#00a65a]"
                            )}
                            onClick={() => setTab("approved")}
                        >
                            Commission Approved
                        </div>
                        <div
                            className={cn(
                                "py-3 text-center cursor-pointer text-[14px] font-semibold transition-colors bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800",
                                activeTab === "not-approved" && "bg-[#00a65a] text-white hover:bg-[#00a65a]"
                            )}
                            onClick={() => setTab("not-approved")}
                        >
                            Commission Not Approved
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 print:hidden">
                        <div className="flex bg-[#6c757d] rounded-md overflow-hidden text-white shadow-sm font-medium">
                            <button onClick={handleCopy} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">Copy</button>
                            <button onClick={handleExcel} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">Excel</button>
                            <button onClick={handlePdf} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">PDF</button>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors outline-none cursor-pointer">
                                        Column visibility
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    {TABLE_COLUMNS.map(col => (
                                        <DropdownMenuCheckboxItem
                                            key={col.id}
                                            checked={visibleColumns[col.id]}
                                            onCheckedChange={(checked) => toggleColumn(col.id, checked)}
                                        >
                                            {col.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                            <Input
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="w-[200px] h-8 text-[13px]"
                            />
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-[#f8f9fa] border-y border-gray-200 text-[#495057] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    {TABLE_COLUMNS.map(col => {
                                        if (!visibleColumns[col.id]) return null;
                                        return (
                                            <th key={col.id} className="px-3 py-3 text-[12px] font-bold">
                                                {col.label}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {listQuery.isLoading && (
                                    <tr className="border-b border-gray-100 dark:border-zinc-800">
                                        <td colSpan={activeCols.length} className="px-3 py-4 text-[13px] pl-4 text-[#495057] dark:text-zinc-400">
                                            Loading…
                                        </td>
                                    </tr>
                                )}
                                {listQuery.isError && (
                                    <tr className="border-b border-gray-100 dark:border-zinc-800">
                                        <td colSpan={activeCols.length} className="px-3 py-4 text-[13px] pl-4 text-red-600">
                                            Failed to load commission verifications.
                                        </td>
                                    </tr>
                                )}
                                {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
                                    <tr className="border-b border-gray-100 dark:border-zinc-800">
                                        <td colSpan={activeCols.length} className="px-3 py-4 text-[13px] pl-4 text-[#495057] dark:text-zinc-400">
                                            No data available in table
                                        </td>
                                    </tr>
                                )}
                                {!listQuery.isLoading && !listQuery.isError && rows.map((row, idx) => {
                                    const isPending = row.status === "pending";
                                    return (
                                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            {activeCols.map(col => {
                                                if (col.id === "action") {
                                                    return (
                                                        <td key={col.id} className="px-3 py-3 text-[13px]">
                                                            <div className="flex flex-wrap gap-2">
                                                                {isPending ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => approveMutation.mutate(row.id)}
                                                                            disabled={approveMutation.isPending}
                                                                            className="text-[12px] text-green-700 hover:underline disabled:opacity-50"
                                                                        >Approve</button>
                                                                        <button
                                                                            onClick={() => { setRejectRow(row); setRejectReason(""); }}
                                                                            className="text-[12px] text-red-600 hover:underline"
                                                                        >Reject</button>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[12px] text-[#adb5bd]">—</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                }
                                                return (
                                                    <td key={col.id} className="px-3 py-3 text-[13px] text-[#495057] dark:text-zinc-400">
                                                        {cellText(col, row, idx)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                                {/* Total Row */}
                                {rows.length > 0 && (
                                    <tr className="border-b border-gray-100 font-bold bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                        {activeCols.map((col, idx) => {
                                            if (idx === 0) {
                                                return (
                                                    <td key={col.id} className="px-3 py-3 text-[13px] pl-4 text-[#212529] dark:text-zinc-100">
                                                        Total
                                                    </td>
                                                );
                                            }
                                            let val = "";
                                            switch (col.id) {
                                                case "amount": val = totals.amount.toLocaleString(); break;
                                                case "commission": val = totals.commission.toLocaleString(); break;
                                                case "reward": val = totals.reward.toLocaleString(); break;
                                                case "teamReward": val = totals.teamReward.toLocaleString(); break;
                                                case "pay": val = totals.pay.toLocaleString(); break;
                                                case "total": val = totals.total.toLocaleString(); break;
                                                default: val = "";
                                            }
                                            return (
                                                <td key={col.id} className="px-3 py-3 text-[13px] text-[#212529] dark:text-zinc-100">
                                                    {val}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <div className="text-[13px] text-[#495057] dark:text-zinc-400">
                            Showing {showingFrom} to {showingTo} of {total} entries
                        </div>
                        <div className="flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <button
                                className="px-3 py-1.5 text-[13px] text-[#6c757d] hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                                disabled={page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >Previous</button>
                            <span className="px-3 py-1.5 text-[13px] text-[#495057] border-l border-gray-200 dark:border-zinc-800 dark:text-zinc-400">
                                {page} / {totalPages}
                            </span>
                            <button
                                className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 disabled:opacity-50 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >Next</button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Reject dialog */}
            <Dialog open={!!rejectRow} onOpenChange={(o) => { if (!o) { setRejectRow(null); setRejectReason(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Commission</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label className="text-[13px]">Reason *</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectRow(null); setRejectReason(""); }}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={submitReject}
                            disabled={rejectMutation.isPending}
                        >
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
