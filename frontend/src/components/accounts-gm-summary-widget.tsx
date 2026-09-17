import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Wallet,
    Layers,
    HandCoins,
    AlertTriangle,
    Clock,
    Eye,
    Receipt,
    ChevronLeft,
    ChevronRight,
    PlusCircle,
} from "lucide-react";
import { GmDetailInvoicesModal } from "@/components/gm-detail-invoices-modal";

/**
 * Accounts dashboard GM type + invoice view (Patch 5 Stage 7, Parts C/D).
 * Consumes GET /api/accounts/dashboard/gm-summary for Full/Partial/Loan totals,
 * partial received/pending, loan due-soon/overdue and a recent-GM table enriched
 * with linked invoice statuses + payment confirmation. Clicking a row opens the
 * GM detail dialog backed by GET /api/sale/commission-verification/:id/invoices.
 */

interface GmSummaryTotals {
    totalGmCount: number;
    fullGmCount: number;
    partialGmCount: number;
    loanGmCount: number;
    totalGmAmount: string;
    fullGmAmount: string;
    partialGmTotalAmount: string;
    partialGmReceivedAmount: string;
    partialGmPendingAmount: string;
    loanGmAmount: string;
    loanDueSoonCount: number;
    loanOverdueCount: number;
}

interface RecentGm {
    id: string;
    gmType: "FULL" | "PARTIAL" | "LOAN";
    companyName: string;
    salesPersonName: string | null;
    packageType: string;
    status: string;
    approvalStatus?: string | null;
    hodStatus?: string | null;
    isHodApproved?: boolean;
    createdAt: string | null;
    amountUsd: string;
    customerDollar: string | null;
    partialReceivedAmount: string | null;
    partialPendingAmount: string | null;
    loan: {
        loanAmountUsd: string | null;
        agreedReturnDate: string | null;
        returnStatus: string | null;
        adminApprovalStatus: string | null;
        overdue: boolean;
    } | null;
    invoiceStatuses: string[];
    invoiceCount: number;
    approvedInvoiceCount: number;
    rejectedInvoiceCount: number;
    pendingHodInvoiceCount: number;
    pendingAccountInvoiceCount: number;
    cancelledInvoiceCount: number;
    paymentConfirmationStatus: string;
}

interface GmSummaryResponse {
    totals: GmSummaryTotals;
    byStatus: { status: string; count: number; amount: string }[];
    recentGms: RecentGm[];
    dueSoonDays: number;
}

const PAGE_SIZE = 10;

const EMPTY_FILTERS = {
    gmType: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    customer: "",
    invoiceStatus: "",
    loanStatus: "",
};

// Show every GM status by default (including ones still pending HOD/Account
// approval) — Accounts needs visibility into the pipeline, not just completed
// entries; the "Create Project" action already stays hidden until approved.
const DEFAULT_FILTERS = { ...EMPTY_FILTERS };

function money(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    if (Number.isNaN(n)) return "$0";
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function gmTypeBadge(type: string) {
    const map: Record<string, string> = {
        FULL: "bg-emerald-100 text-emerald-700 border-emerald-200",
        PARTIAL: "bg-amber-100 text-amber-700 border-amber-200",
        LOAN: "bg-violet-100 text-violet-700 border-violet-200",
    };
    return map[type] || "bg-slate-100 text-slate-700 border-slate-200";
}

function paymentBadge(status: string) {
    const map: Record<string, string> = {
        PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
        APPROVED: "bg-blue-100 text-blue-700 border-blue-200",
        PENDING: "bg-amber-100 text-amber-700 border-amber-200",
        OTHER: "bg-slate-100 text-slate-700 border-slate-200",
        NONE: "bg-slate-100 text-slate-500 border-slate-200",
    };
    return map[status] || "bg-slate-100 text-slate-600 border-slate-200";
}

const SummaryStat = ({
    title,
    value,
    sub,
    icon: Icon,
    color,
    onClick,
    active,
}: {
    title: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    icon: any;
    color: string;
    onClick?: () => void;
    active?: boolean;
}) => (
    <div
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
        className={`rounded-xl border bg-white p-4 dark:bg-zinc-900 ${onClick ? "cursor-pointer transition-colors hover:border-slate-300 dark:hover:border-zinc-700" : ""} ${active ? "border-emerald-400 ring-1 ring-emerald-400 dark:border-emerald-600" : ""}`}
    >
        <div className="flex items-center justify-between pb-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <div className={`p-1.5 rounded-full ${color} bg-opacity-10`}>
                <Icon className={`h-3.5 w-3.5 ${color.replace("bg-", "text-")}`} />
            </div>
        </div>
        <div className="text-xl font-bold text-slate-900 dark:text-zinc-100">{value}</div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
);

export function AccountsGmSummaryWidget({ onCreateProject }: { onCreateProject?: (gm: any) => void }) {
    const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
    const [appliedFilters, setAppliedFilters] = useState({ ...DEFAULT_FILTERS });
    const [detailGmId, setDetailGmId] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const buildQs = (f: typeof EMPTY_FILTERS) => {
        const params = new URLSearchParams();
        if (f.gmType) params.set("gmType", f.gmType);
        if (f.status) params.set("status", f.status);
        if (f.dateFrom) params.set("dateFrom", new Date(f.dateFrom).toISOString());
        if (f.dateTo) params.set("dateTo", new Date(f.dateTo).toISOString());
        if (f.customer) params.set("customer", f.customer);
        if (f.invoiceStatus) params.set("invoiceStatus", f.invoiceStatus);
        if (f.loanStatus) params.set("loanStatus", f.loanStatus);
        params.set("recentLimit", "100");
        const qs = params.toString();
        return qs ? `?${qs}` : "";
    };

    const summaryQuery = useQuery<GmSummaryResponse>({
        queryKey: ["accounts-gm-summary", appliedFilters],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/accounts/dashboard/gm-summary${buildQs(appliedFilters)}`);
            if (!res.ok) throw new Error("Failed to load GM summary");
            const body = await res.json();
            return body.data as GmSummaryResponse;
        },
    });

    const totals = summaryQuery.data?.totals;
    const recentGms = (summaryQuery.data?.recentGms ?? []).filter((gm) => {
        const status = (gm.status || "").toLowerCase();
        const hodStatus = (gm.hodStatus || "").toLowerCase();
        const approvalStatus = (gm.approvalStatus || "").toLowerCase();
        return (
            !status.includes("reject") &&
            !hodStatus.includes("reject") &&
            !approvalStatus.includes("reject")
        );
    });
    const byStatus = summaryQuery.data?.byStatus ?? [];
    const dueSoonDays = summaryQuery.data?.dueSoonDays ?? 7;

    const applyFilters = () => {
        setAppliedFilters({ ...filters });
        setPage(1);
    };

    // Clicking a "Full GMs"/"Partial GMs"/"Loan GMs" stat card is a shortcut for
    // picking that value in the GM Type dropdown above and hitting Apply —
    // clicking the same one again clears back to showing every type.
    const toggleGmTypeFilter = (type: "FULL" | "PARTIAL" | "LOAN") => {
        const next = filters.gmType === type ? "" : type;
        setFilters((p) => ({ ...p, gmType: next, loanStatus: "" }));
        setAppliedFilters((p) => ({ ...p, gmType: next, loanStatus: "" }));
        setPage(1);
    };
    // "Loan Overdue" / "Loan Due ≤Nd" narrow the list further, independent of
    // the GM Type dropdown (the backend's loanStatus filter already implies
    // is_loan=true, so no need to also force gmType=LOAN here).
    const toggleLoanStatusFilter = (status: "OVERDUE" | "DUE_SOON") => {
        const next = filters.loanStatus === status ? "" : status;
        setFilters((p) => ({ ...p, loanStatus: next }));
        setAppliedFilters((p) => ({ ...p, loanStatus: next }));
        setPage(1);
    };
    // "Total GMs" clears just the type/loan-status narrowing (back to "every
    // type"), leaving any date range/customer/status/invoice-status search
    // the user already typed untouched — unlike the full Clear button below.
    const clearTypeNarrowing = () => {
        setFilters((p) => ({ ...p, gmType: "", loanStatus: "" }));
        setAppliedFilters((p) => ({ ...p, gmType: "", loanStatus: "" }));
        setPage(1);
    };
    const clearFilters = () => {
        setFilters({ ...EMPTY_FILTERS });
        setAppliedFilters({ ...EMPTY_FILTERS });
        setPage(1);
    };

    const totalPages = Math.max(1, Math.ceil(recentGms.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pagedGms = recentGms.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const selectVal = (v: string) => v || "all";
    const fromSelect = (v: string) => (v === "all" ? "" : v);

    return (
        <Card className="border-none shadow-md bg-white dark:bg-zinc-900" data-testid="card-accounts-gm-summary">
            <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b">
                <div>
                    <CardTitle className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                        GM &amp; Invoice Overview
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Full / Partial / Loan breakdown with linked invoice approvals
                    </p>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">GM Type</Label>
                        <Select value={selectVal(filters.gmType)} onValueChange={(v) => setFilters((p) => ({ ...p, gmType: fromSelect(v) }))}>
                            <SelectTrigger data-testid="filter-gm-type"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="FULL">Full</SelectItem>
                                <SelectItem value="PARTIAL">Partial</SelectItem>
                                <SelectItem value="LOAN">Loan</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={selectVal(filters.status)} onValueChange={(v) => setFilters((p) => ({ ...p, status: fromSelect(v) }))}>
                            <SelectTrigger data-testid="filter-gm-status"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Rejected">Rejected</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Invoice Status</Label>
                        <Select value={selectVal(filters.invoiceStatus)} onValueChange={(v) => setFilters((p) => ({ ...p, invoiceStatus: fromSelect(v) }))}>
                            <SelectTrigger data-testid="filter-invoice-status"><SelectValue placeholder="All" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="PENDING_HOD">Pending HOD</SelectItem>
                                <SelectItem value="PENDING_ACCOUNT">Pending Account</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Customer</Label>
                        <Input
                            data-testid="filter-customer"
                            placeholder="Company name"
                            value={filters.customer}
                            onChange={(e) => setFilters((p) => ({ ...p, customer: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input type="date" data-testid="filter-date-from" value={filters.dateFrom} onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input type="date" data-testid="filter-date-to" value={filters.dateTo} onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={applyFilters} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-apply-filters">Apply</Button>
                        <Button variant="outline" onClick={clearFilters} data-testid="button-clear-filters">Clear</Button>
                    </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <SummaryStat
                        title="Full GMs"
                        value={totals?.fullGmCount ?? 0}
                        sub={money(totals?.fullGmAmount)}
                        icon={Wallet}
                        color="bg-emerald-500"
                        onClick={() => toggleGmTypeFilter("FULL")}
                        active={filters.gmType === "FULL"}
                    />
                    <SummaryStat
                        title="Partial GMs"
                        value={totals?.partialGmCount ?? 0}
                        sub={`Rec ${money(totals?.partialGmReceivedAmount)} · Due ${money(totals?.partialGmPendingAmount)}`}
                        icon={Layers}
                        color="bg-amber-500"
                        onClick={() => toggleGmTypeFilter("PARTIAL")}
                        active={filters.gmType === "PARTIAL"}
                    />
                    <SummaryStat
                        title="Loan GMs"
                        value={totals?.loanGmCount ?? 0}
                        sub={money(totals?.loanGmAmount)}
                        icon={HandCoins}
                        color="bg-violet-500"
                        onClick={() => toggleGmTypeFilter("LOAN")}
                        active={filters.gmType === "LOAN"}
                    />
                    <SummaryStat
                        title="Loan Overdue"
                        value={totals?.loanOverdueCount ?? 0}
                        sub="past return date"
                        icon={AlertTriangle}
                        color="bg-rose-500"
                        onClick={() => toggleLoanStatusFilter("OVERDUE")}
                        active={filters.loanStatus === "OVERDUE"}
                    />
                    <SummaryStat
                        title={`Loan Due ≤${dueSoonDays}d`}
                        value={totals?.loanDueSoonCount ?? 0}
                        sub="returning soon"
                        icon={Clock}
                        color="bg-orange-500"
                        onClick={() => toggleLoanStatusFilter("DUE_SOON")}
                        active={filters.loanStatus === "DUE_SOON"}
                    />
                    <SummaryStat
                        title="Total GMs"
                        value={totals?.totalGmCount ?? 0}
                        sub={money(totals?.totalGmAmount)}
                        icon={Receipt}
                        color="bg-blue-500"
                        onClick={clearTypeNarrowing}
                        active={!filters.gmType && !filters.loanStatus}
                    />
                </div>

                {/* By status chips */}
                {byStatus.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {byStatus.map((s) => (
                            <Badge key={s.status} variant="outline" className="text-xs font-medium" data-testid={`chip-status-${s.status}`}>
                                {s.status}: {s.count} ({money(s.amount)})
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Recent GMs table */}
                <div className="rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-100/50">
                            <TableRow>
                                <TableHead className="font-bold">Company</TableHead>
                                <TableHead className="font-bold">Type</TableHead>
                                <TableHead className="font-bold">Sales</TableHead>
                                <TableHead className="font-bold text-right">Amount</TableHead>
                                <TableHead className="font-bold">HOD Status</TableHead>
                                <TableHead className="font-bold text-center">Invoices</TableHead>
                                <TableHead className="font-bold text-center">GM Pay Status</TableHead>
                                <TableHead className="font-bold text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {summaryQuery.isLoading && (
                                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                            )}
                            {!summaryQuery.isLoading && recentGms.length === 0 && (
                                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No GM entries match the filters.</TableCell></TableRow>
                            )}
                            {pagedGms.map((gm) => (
                                <TableRow key={gm.id} data-testid={`row-gm-${gm.id}`}>
                                    <TableCell>
                                        <div className="font-medium">{gm.companyName || "—"}</div>
                                        <div className="text-[11px] text-muted-foreground">{gm.packageType}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[10px] ${gmTypeBadge(gm.gmType)}`}>{gm.gmType}</Badge>
                                        {gm.loan?.overdue && <Badge variant="outline" className="ml-1 text-[10px] bg-rose-100 text-rose-700 border-rose-200">OVERDUE</Badge>}
                                    </TableCell>
                                    <TableCell className="text-sm">{gm.salesPersonName || "—"}</TableCell>
                                    <TableCell className="text-right text-sm">
                                        {money(gm.amountUsd)}
                                        {gm.gmType === "PARTIAL" && gm.partialPendingAmount != null && (
                                            <div className="text-[11px] text-amber-600">Due {money(gm.partialPendingAmount)}</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {(() => {
                                            const hs = (gm.hodStatus || gm.approvalStatus || "Pending").toString();
                                            const isApproved = hs.toLowerCase() === "approved";
                                            const isRejected = hs.toLowerCase().includes("reject");
                                            const colorClass = isApproved
                                                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                : isRejected
                                                    ? "bg-rose-100 text-rose-700 border-rose-300"
                                                    : "bg-amber-50 text-amber-700 border-amber-300";
                                            return <Badge variant="outline" className={`text-[10px] ${colorClass}`}>{isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}</Badge>;
                                        })()}
                                    </TableCell>
                                    <TableCell className="text-center text-sm">
                                        {gm.invoiceCount > 0 ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[11px] text-muted-foreground">{gm.invoiceCount} total</span>
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {gm.approvedInvoiceCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                                            {gm.approvedInvoiceCount} Approved
                                                        </Badge>
                                                    )}
                                                    {gm.rejectedInvoiceCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-200">
                                                            {gm.rejectedInvoiceCount} Rejected
                                                        </Badge>
                                                    )}
                                                    {gm.pendingAccountInvoiceCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] bg-sky-100 text-sky-700 border-sky-200">
                                                            {gm.pendingAccountInvoiceCount} Pending Account
                                                        </Badge>
                                                    )}
                                                    {gm.pendingHodInvoiceCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                                            {gm.pendingHodInvoiceCount} Pending HOD
                                                        </Badge>
                                                    )}
                                                    {gm.cancelledInvoiceCount > 0 && (
                                                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                                                            {gm.cancelledInvoiceCount} Cancelled
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`text-[10px] ${paymentBadge(gm.paymentConfirmationStatus)}`}>{gm.paymentConfirmationStatus}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                         {(() => {
                                             const isApproved =
                                                 gm.isHodApproved === true ||
                                                 (gm.approvalStatus && gm.approvalStatus !== "pending_hod" && gm.approvalStatus !== "pending" && !gm.approvalStatus.toLowerCase().includes("rejected")) ||
                                                 (gm.hodStatus && gm.hodStatus.toLowerCase() === "approved") ||
                                                 (gm.status && gm.status.toLowerCase() === "approved");

                                             return (
                                                 <div className="flex items-center justify-center gap-2">
                                                     <Button size="sm" variant="ghost" onClick={() => setDetailGmId(gm.id)} data-testid={`button-view-gm-${gm.id}`}>
                                                         <Eye className="h-4 w-4 text-emerald-500 hover:text-emerald-600" />
                                                     </Button>
                                                     {onCreateProject && isApproved && (
                                                         <Button size="sm" variant="ghost" onClick={() => onCreateProject(gm)} title="Create Project">
                                                             <PlusCircle className="h-4 w-4 text-rose-500 hover:text-rose-600" />
                                                         </Button>
                                                     )}
                                                 </div>
                                             );
                                         })()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                        Page {currentPage} of {totalPages} · {recentGms.length} entries
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            data-testid="button-gm-summary-prev-page"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            data-testid="button-gm-summary-next-page"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </CardContent>

            <GmDetailInvoicesModal gmId={detailGmId} onClose={() => setDetailGmId(null)} />
        </Card>
    );
}
