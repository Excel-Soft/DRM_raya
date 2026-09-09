import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InvoiceReceipt } from "@/components/invoice/InvoiceReceipt";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ShieldAlert, ShieldCheck, History, Eye } from "lucide-react";
import { INVOICE_TYPE_TO_PRODUCT_NAME, type InvoiceType } from "@shared/gm-sales-constants";

const ITEMS_PER_PAGE = 10;

/** Human label for an invoice's type, preferring the canonical enum mapping and
 *  falling back to the stored service/project name. */
function invoiceTypeLabel(inv: any): string {
    if (inv?.invoiceType && INVOICE_TYPE_TO_PRODUCT_NAME[inv.invoiceType as InvoiceType]) {
        return INVOICE_TYPE_TO_PRODUCT_NAME[inv.invoiceType as InvoiceType];
    }
    return inv?.serviceType || inv?.projectName || "—";
}

/** Mirror of the backend `isMarkedFree` check (invoice-workflow.service.ts). */
function isMarkedFree(inv: any): boolean {
    return typeof inv?.paymentMethod === "string" && inv.paymentMethod.trim().toLowerCase() === "free";
}

/** Mirror of the backend `assertApprovalReadiness` rule so the UI can disable
 *  Approve for invoices the server would reject as INCOMPLETE_INVOICE. */
function incompleteReasons(inv: any): string[] {
    const missing: string[] = [];
    if (!inv?.customerId) missing.push("customer");
    if (!isMarkedFree(inv) && !(Number(inv?.amount) > 0)) missing.push("amount (or mark Free)");
    if (!inv?.invoiceType && !inv?.serviceType && !inv?.projectName) missing.push("type");
    return missing;
}

/** InvoiceReceipt's stripAlibabaSuffix() removes the exact string "Alibaba
 *  Product Posting" (a suffix-cleanup rule for company names like "Acme
 *  (Alibaba Product Posting)"). INVOICE_TYPE_TO_PRODUCT_NAME.PRODUCT_POSTING
 *  is that exact string, so using it directly as the item name wiped the
 *  whole line blank. Match the old preview's item-name convention instead,
 *  which never collided with that string. */
function invoiceReceiptItemName(inv: any): string {
    switch (inv?.invoiceType) {
        case "LISTING_PAGE": return "Listing Page Service";
        case "MINIWEBSITE": return "Alibaba Minisite Service";
        case "PRODUCT_POSTING": return "Product Posting Service";
        default: return invoiceTypeLabel(inv);
    }
}

/** Item-description sub-line: fixed unit-count text per service type. */
function invoiceReceiptItemDetail(inv: any): string {
    switch (inv?.invoiceType) {
        case "LISTING_PAGE": return "1";
        case "MINIWEBSITE": return "1";
        case "PRODUCT_POSTING": return "100";
        default: return `${inv?.companyName || "Client"} Details`;
    }
}

/** Build the shape InvoiceReceipt expects (same fixed WebExcels "from" block and
 *  single-line-item fallback the old hod-dashboard preview used) from a
 *  workflow invoice row. */
function toInvoiceReceiptData(inv: any) {
    const companyName = inv?.companyName || "Client";
    const amount = Number(inv?.amount) || 0;
    return {
        invoiceNumber: inv?.invoiceNumber || inv?.invoice_number || (inv?.id ? String(inv.id).slice(0, 8) : ""),
        date: inv?.createdAt ? new Date(inv.createdAt) : new Date(),
        from: {
            name: "Web Excels",
            whatsapp: "+92-334-8086611",
            phone: "+92-52-4271592",
            email: "Support@Webexcels.com",
            address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan.",
        },
        to: { name: companyName, phone: "-", email: "-", address: "Address:" },
        items: [
            {
                name: invoiceReceiptItemName(inv),
                detail: invoiceReceiptItemDetail(inv),
                price: amount,
                quantity: 1,
                total: amount,
            },
        ],
        subTotalUsd: amount,
        subTotalPkr: amount * 280,
        taxUsd: 0,
        discountPkr: 0,
        totalPkr: amount * 280,
    };
}

/** Pull a clean message out of the `${status}: ${jsonBody}` error apiRequest throws. */
function readApiError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    const idx = raw.indexOf(":");
    const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
    try {
        const parsed = JSON.parse(body);
        return parsed?.error?.message || parsed?.message || body;
    } catch {
        return body || "Something went wrong";
    }
}

export function ProductPostingApprovalsWidget({
    role,
    variant = "feed",
}: {
    role: "HOD" | "Account Manager";
    /** "feed" (default) is the card/scroll-feed layout. "table" renders the same
     *  data/actions/gates below as the previous paginated table design. */
    variant?: "feed" | "table";
}) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [historyId, setHistoryId] = useState<string | null>(null);
    const [invoicePage, setInvoicePage] = useState(1);
    const [previewId, setPreviewId] = useState<string | null>(null);
    const [actionModalId, setActionModalId] = useState<string | null>(null);
    const [actionForm, setActionForm] = useState({ amount: "", method: "", status: "approved" });

    const { data: invoicesData, isLoading } = useQuery({
        queryKey: ["/api/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/invoices");
            return res.json();
        }
    });

    // Table variant only: submitter names for the "Person" column (display-only,
    // does not affect approve/reject/free logic below).
    const { data: usersData } = useQuery({
        queryKey: ["/api/users"],
        enabled: variant === "table",
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return res.json();
        }
    });
    const salesExecNameById: Record<string, string> = {};
    for (const u of (usersData?.users || [])) {
        if (u?.id) salesExecNameById[u.id] = u.fullName || u.username || "-";
    }

    const { data: historyData, isLoading: historyLoading } = useQuery({
        queryKey: ["/api/invoices", historyId, "history"],
        enabled: !!historyId,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/invoices/${historyId}/history`);
            return res.json();
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, action, reason }: { id: string, action: "APPROVE" | "REJECT", reason?: string }) => {
            const stage = role === "HOD" ? "hod" : "account";
            const verb = action === "APPROVE" ? "approve" : "reject";
            const res = await apiRequest("POST", `/api/invoices/${id}/${stage}-${verb}`, action === "REJECT" ? { reason } : {});
            await throwIfResNotOk(res);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            setRejectId(null);
            setRejectReason("");
            setActionModalId((cur) => (cur === variables.id ? null : cur));
            toast({
                title: variables.action === "APPROVE" ? "Invoice approved" : "Invoice rejected",
                description: variables.action === "APPROVE"
                    ? "Moved to the next stage of the workflow."
                    : "The sales executive has been notified.",
            });
        },
        onError: (err) => {
            toast({ title: "Action failed", description: readApiError(err), variant: "destructive" });
        }
    });

    // Mark a $0 invoice Free so it can clear the amount check at this stage
    // (mirrors the Account Manager's existing "Free" payment-method option).
    const markFreeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/invoices/${id}`, { paymentMethod: "free" });
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            toast({ title: "Marked as Free" });
        },
        onError: (err) => {
            toast({ title: "Could not mark Free", description: readApiError(err), variant: "destructive" });
        }
    });

    // Table variant's action modal (Amount/Method/Receipt Number, matching the
    // Account Manager's "Create Project" modal) writes these details onto the
    // invoice before approving, reusing the same PATCH /api/invoices/:id the
    // rest of this widget already uses for Mark Free.
    const patchInvoiceMutation = useMutation({
        mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
            const res = await apiRequest("PATCH", `/api/invoices/${id}`, body);
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        },
        onError: (err) => {
            toast({ title: "Could not save invoice details", description: readApiError(err), variant: "destructive" });
        }
    });

    // Patch 5 Stage 5 (Part C): explicit, idempotent invoice -> project generation
    // for the Account Manager. The endpoint is safe to call repeatedly (create-or-
    // link), so the worst case of a double click is a "already generated" toast.
    const [generated, setGenerated] = useState<Record<string, { status: string | null; held: boolean }>>({});
    const generateMutation = useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const res = await apiRequest("POST", `/api/invoices/${id}/generate-project`, {});
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body?.error?.message || body?.error || "Could not generate project");
            }
            return body;
        },
        onSuccess: (body, variables) => {
            const result = body?.data || {};
            setGenerated((m) => ({ ...m, [variables.id]: { status: result.status ?? null, held: !!result.held } }));
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            const already = !!result.linked && !result.created;
            toast({
                title: already ? "Project already generated" : "Project generated",
                description: result.held
                    ? "Project created on hold — waiting for Listing Page QA approval."
                    : `Project ready${result.status ? ` (status: ${result.status})` : ""}.`,
            });
        },
        onError: (err) => {
            toast({
                title: "Generation failed",
                description: err instanceof Error ? err.message : "Could not generate project",
                variant: "destructive",
            });
        },
    });

    const invoices = invoicesData?.data || [];

    // Filter invoices based on which role is viewing the queue
    const targetStatus = role === "HOD" ? "PENDING_HOD" : "PENDING_ACCOUNT";
    const pendingInvoices = invoices.filter((inv: any) => inv.status === targetStatus);
    // Patch 5 Stage 5 (Part C): approved invoices the Account Manager can turn into projects.
    const approvedInvoices = role === "Account Manager"
        ? invoices.filter((inv: any) => inv.status === "APPROVED")
        : [];

    if (isLoading) return <div>Loading approvals...</div>;

    if (variant === "table") {
        const invoiceTotalPages = Math.max(1, Math.ceil(pendingInvoices.length / ITEMS_PER_PAGE));
        const page = Math.min(invoicePage, invoiceTotalPages);
        const pagedInvoices = pendingInvoices.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
        const previewInv = pendingInvoices.find((i: any) => i.id === previewId) || null;
        const actionInv = pendingInvoices.find((i: any) => i.id === actionModalId) || null;

        return (
            <Card className="border shadow-sm">
                <CardHeader className="pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        {role} Invoice Approvals
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Review and approve pending product posting invoices.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-[#f8fafc] dark:bg-zinc-900">
                                <TableRow>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">No</TableHead>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Company</TableHead>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Person</TableHead>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Detail</TableHead>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Invoice</TableHead>
                                    <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Status</TableHead>
                                    <TableHead className="font-bold text-slate-700 text-right pr-4 dark:text-zinc-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pagedInvoices.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                                            No pending invoices at this stage.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {pagedInvoices.map((inv: any, idx: number) => (
                                    <TableRow key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800">
                                        <TableCell className="font-bold text-gray-700 dark:text-zinc-400">
                                            {(page - 1) * ITEMS_PER_PAGE + idx + 1}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <span className="font-bold text-gray-800 tracking-tight dark:text-zinc-100">
                                                {inv.companyName || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-gray-600 dark:text-zinc-300">
                                            {salesExecNameById[inv.salesExecId] || "-"}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500 max-w-[240px] dark:text-zinc-400">
                                            {invoiceTypeLabel(inv)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full h-9 w-9"
                                                onClick={() => setPreviewId(inv.id)}
                                                title="View invoice"
                                            >
                                                <Eye className="h-5 w-5" />
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-gray-200/50 text-gray-500 font-normal px-4 py-1.5 rounded-full border-0 shadow-none hover:bg-gray-200/70 dark:text-zinc-400">
                                                Waiting
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end pr-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full h-9 w-9"
                                                    onClick={() => {
                                                        setActionModalId(inv.id);
                                                        setActionForm({
                                                            amount: Number(inv.amount) > 0 ? String(inv.amount) : "",
                                                            method: isMarkedFree(inv) ? "free" : "",
                                                            status: "approved",
                                                        });
                                                    }}
                                                    title="Approve"
                                                >
                                                    <ShieldCheck className="h-6 w-6" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
                        <div>
                            Showing {pendingInvoices.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, pendingInvoices.length)} of {pendingInvoices.length} entries
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInvoicePage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                Prev
                            </Button>
                            <div className="flex items-center justify-center px-2 text-sm font-medium">
                                Page {page} of {invoiceTotalPages}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInvoicePage(p => Math.min(invoiceTotalPages, p + 1))}
                                disabled={page === invoiceTotalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>

                {/* Invoice preview dialog (Eye button) — the same InvoiceReceipt template
                    the old hod-dashboard preview used, fed from the current workflow data. */}
                <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
                    <DialogContent className="max-w-[750px] p-0 border-none bg-transparent shadow-none max-h-[95vh] overflow-y-auto thin-scrollbar">
                        {previewInv && (
                            <InvoiceReceipt
                                invoiceData={toInvoiceReceiptData(previewInv)}
                                onClose={() => setPreviewId(null)}
                            />
                        )}
                    </DialogContent>
                </Dialog>

                {/* Action modal (ShieldCheck button) — matches the Account Manager's
                    "Create Project" modal layout (Name/Due/Amount/Method/Receipt Number)
                    per the actual original design. Save writes Amount/Method/Receipt onto
                    the invoice (PATCH) then approves — same audited hod-approve/account-
                    approve + completeness gate as before, just presented in this shape. */}
                <Dialog
                    open={!!actionModalId}
                    onOpenChange={(open) => {
                        if (!open) {
                            setActionModalId(null);
                            setActionForm({ amount: "", method: "", status: "approved" });
                            setRejectId(null);
                            setRejectReason("");
                        }
                    }}
                >
                    <DialogContent className="max-w-[550px] p-0 gap-0 rounded-xl overflow-hidden">
                        <DialogHeader className="p-6 pb-4 border-b flex flex-row items-center justify-between space-y-0">
                            <DialogTitle className="text-2xl font-semibold text-slate-800 flex items-center gap-2 dark:text-zinc-100">
                                Create Project — <span className="text-emerald-400 font-medium text-lg">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
                            </DialogTitle>
                            {actionInv && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground shrink-0" onClick={() => setHistoryId(actionInv.id)}>
                                    <History className="h-3 w-3 mr-1" /> History
                                </Button>
                            )}
                        </DialogHeader>

                        {actionInv && (rejectId === actionInv.id ? (
                            <>
                                <div className="p-6 space-y-2">
                                    <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Reason for rejection</label>
                                    <Textarea
                                        placeholder="Reason for rejection..."
                                        className="min-h-[120px] resize-none"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                    />
                                </div>
                                <DialogFooter className="p-6 pt-4 border-t gap-2">
                                    <Button variant="outline" onClick={() => setRejectId(null)} className="px-6">Cancel</Button>
                                    <Button
                                        variant="destructive"
                                        onClick={() => approveMutation.mutate({ id: actionInv.id, action: "REJECT", reason: rejectReason })}
                                        disabled={approveMutation.isPending || !rejectReason.trim()}
                                        className="px-6"
                                    >
                                        {approveMutation.isPending ? "Rejecting..." : "Confirm Reject"}
                                    </Button>
                                </DialogFooter>
                            </>
                        ) : (() => {
                            const previewInvForGate = {
                                ...actionInv,
                                amount: actionForm.method === "free" ? actionInv.amount : (actionForm.amount || actionInv.amount),
                                paymentMethod: actionForm.method === "free" ? "free" : actionInv.paymentMethod,
                            };
                            const gateReasons = incompleteReasons(previewInvForGate);
                            return (
                                <>
                                    <div className="p-6 space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Name</label>
                                                <Input
                                                    value={actionInv.companyName || ""}
                                                    readOnly
                                                    className="bg-slate-100 border-slate-200 h-11 cursor-not-allowed focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Due</label>
                                                <Input
                                                    value="0"
                                                    readOnly
                                                    className="bg-slate-100 border-slate-200 h-11 cursor-not-allowed focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Amount</label>
                                                <Input
                                                    value={actionForm.amount}
                                                    onChange={(e) => setActionForm((prev) => ({ ...prev, amount: e.target.value }))}
                                                    className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                                                    disabled={actionForm.method === "free"}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Method</label>
                                                <Select
                                                    value={actionForm.method}
                                                    onValueChange={(v) => setActionForm((prev) => ({ ...prev, method: v }))}
                                                >
                                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                                                        <SelectValue placeholder="Choose ..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">Cash</SelectItem>
                                                        <SelectItem value="bank-transfar">Bank Transfar</SelectItem>
                                                        <SelectItem value="free">Free</SelectItem>
                                                        <SelectItem value="delay">Delay</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Status</label>
                                                <Select
                                                    value={actionForm.status}
                                                    onValueChange={(v) => setActionForm((prev) => ({ ...prev, status: v }))}
                                                >
                                                    <SelectTrigger className="bg-slate-50 border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                                                        <SelectValue placeholder="Select status ..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="approved">
                                                            <span className="flex items-center gap-2 text-emerald-600 font-semibold">✅ Approved</span>
                                                        </SelectItem>
                                                        <SelectItem value="rejected">
                                                            <span className="flex items-center gap-2 text-rose-600 font-semibold">❌ Rejected</span>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Invoice</label>
                                                <Badge className="bg-rose-100 text-rose-500 rounded px-1.5 py-0 text-[10px] font-bold border-none">1</Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-md bg-white min-h-[48px] dark:bg-zinc-900 dark:border-zinc-800">
                                                <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 text-sm text-blue-700 font-medium">
                                                    {invoiceTypeLabel(actionInv)}
                                                </span>
                                            </div>
                                        </div>

                                        {actionForm.status !== "rejected" && gateReasons.length > 0 && (
                                            <div className="text-[12px] text-amber-600">
                                                Cannot approve — missing: {gateReasons.join(", ")}.
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter className="p-6 pt-4 border-t gap-2">
                                        <Button variant="outline" onClick={() => setActionModalId(null)} className="px-6">Close</Button>
                                        <Button
                                            className={`text-white px-6 ${
                                                actionForm.status === "rejected"
                                                    ? "bg-rose-600 hover:bg-rose-700"
                                                    : "bg-emerald-600 hover:bg-emerald-700"
                                            }`}
                                            disabled={
                                                actionForm.status === "rejected"
                                                    ? approveMutation.isPending
                                                    : (patchInvoiceMutation.isPending || approveMutation.isPending || gateReasons.length > 0)
                                            }
                                            onClick={async () => {
                                                if (actionForm.status === "rejected") {
                                                    setRejectId(actionInv.id);
                                                    return;
                                                }
                                                const body: Record<string, unknown> = {};
                                                if (actionForm.method === "free") {
                                                    body.paymentMethod = "free";
                                                } else if (actionForm.method) {
                                                    body.paymentMethod = actionForm.method;
                                                }
                                                const amt = Number(actionForm.amount);
                                                if (actionForm.method !== "free" && amt > 0) body.amount = amt;

                                                if (Object.keys(body).length > 0) {
                                                    try {
                                                        await patchInvoiceMutation.mutateAsync({ id: actionInv.id, body });
                                                    } catch {
                                                        return;
                                                    }
                                                }
                                                approveMutation.mutate({ id: actionInv.id, action: "APPROVE" });
                                            }}
                                        >
                                            {patchInvoiceMutation.isPending || approveMutation.isPending
                                                ? (actionForm.status === "rejected" ? "Rejecting..." : "Approving...")
                                                : (actionForm.status === "rejected" ? "Reject" : "Approved")}
                                        </Button>
                                    </DialogFooter>
                                </>
                            );
                        })())}
                    </DialogContent>
                </Dialog>

                {/* Audit history dialog (shared markup with the feed variant) */}
                <Dialog open={!!historyId} onOpenChange={(open) => !open && setHistoryId(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Invoice History {historyId ? `(${historyId.substring(0, 8).toUpperCase()})` : ""}</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[400px] overflow-auto text-sm">
                            {historyLoading ? (
                                <div className="text-muted-foreground py-4 text-center">Loading history...</div>
                            ) : (historyData?.data?.length ? (
                                <ol className="space-y-3">
                                    {historyData.data.map((entry: any) => (
                                        <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
                                            <div className="font-medium">{entry.action.replace(/_/g, " ")}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {entry.previousStatus ? `${entry.previousStatus} → ` : ""}{entry.nextStatus || ""}
                                            </div>
                                            {entry.reason && <div className="text-xs text-red-500 mt-0.5">Reason: {entry.reason}</div>}
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="text-muted-foreground py-4 text-center">No history yet.</div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 border shadow-sm">
            <CardHeader className="pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    {role} Invoice Approvals
                </CardTitle>
                <CardDescription className="text-xs">
                    Review and approve pending product posting invoices.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                    {pendingInvoices.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No pending invoices at this stage.
                        </div>
                    ) : (
                        pendingInvoices.map((inv: any) => (
                            <div key={inv.id} className="flex flex-col p-4 border-b hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-semibold">{inv.invoiceNumber || inv.invoice_number || inv.projectName || (inv.id ? `INV-${inv.id.substring(0, 6).toUpperCase()}` : "Invoice")}</span>
                                    <span className="text-sm text-emerald-600 font-bold">
                                        {inv.currency || "USD"} {inv.amount}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mb-2">
                                    <span>Type: <span className="text-foreground">{invoiceTypeLabel(inv)}</span></span>
                                    {inv.companyName && <span>Company: <span className="text-foreground">{inv.companyName}</span></span>}
                                </div>
                                {incompleteReasons(inv).length > 0 && (
                                    <div className="text-[11px] text-amber-600 mb-2">
                                        Cannot approve — missing: {incompleteReasons(inv).join(", ")}.
                                    </div>
                                )}

                                {rejectId === inv.id ? (
                                    <div className="flex flex-col gap-2 mt-2">
                                        <Input
                                            size={1}
                                            className="h-8 text-xs"
                                            placeholder="Reason for rejection..."
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRejectId(null)}>Cancel</Button>
                                            <Button variant="destructive" size="sm" className="h-7 text-xs"
                                                onClick={() => approveMutation.mutate({ id: inv.id, action: "REJECT", reason: rejectReason })}
                                                disabled={approveMutation.isPending || !rejectReason.trim()}
                                            >Confirm Reject</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 justify-end mt-2">
                                        <Button
                                            variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                                            onClick={() => setHistoryId(inv.id)}
                                        >
                                            <History className="h-3 w-3 mr-1" /> History
                                        </Button>
                                        {Number(inv.amount) === 0 && !isMarkedFree(inv) && (
                                            <Button
                                                variant="outline" size="sm" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                                                onClick={() => markFreeMutation.mutate(inv.id)}
                                                disabled={markFreeMutation.isPending}
                                            >
                                                Mark Free
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => setRejectId(inv.id)}
                                            disabled={approveMutation.isPending}
                                        >
                                            <X className="h-3 w-3 mr-1" /> Reject
                                        </Button>
                                        <Button
                                            variant="default" size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => approveMutation.mutate({ id: inv.id, action: "APPROVE" })}
                                            disabled={approveMutation.isPending || incompleteReasons(inv).length > 0}
                                        >
                                            <Check className="h-3 w-3 mr-1" /> Approve
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Patch 5 Stage 5 (Part C): approved invoices ready for project
                    generation. Account Manager only; idempotent action. */}
                {role === "Account Manager" && approvedInvoices.length > 0 && (
                    <div className="border-t">
                        <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-slate-50 dark:bg-zinc-900">
                            Approved — project generation
                        </div>
                        <div className="max-h-[300px] overflow-auto">
                            {approvedInvoices.map((inv: any) => {
                                const gen = generated[inv.id];
                                return (
                                    <div key={inv.id} className="flex items-center justify-between p-4 border-b hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{inv.invoiceNumber || inv.invoice_number || inv.projectName || (inv.id ? `INV-${inv.id.substring(0, 6).toUpperCase()}` : "Invoice")}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {invoiceTypeLabel(inv)}{inv.companyName ? ` · ${inv.companyName}` : ""}
                                            </span>
                                            {gen && (
                                                <span className={`text-[11px] mt-0.5 ${gen.held ? "text-amber-600" : "text-emerald-600"}`}>
                                                    {gen.held
                                                        ? "On hold — waiting for Listing Page QA approval"
                                                        : `Project ready${gen.status ? ` · ${gen.status}` : ""}`}
                                                </span>
                                            )}
                                        </div>
                                        <Button
                                            variant="outline" size="sm" className="h-7 text-xs"
                                            onClick={() => generateMutation.mutate({ id: inv.id })}
                                            disabled={generateMutation.isPending || !!gen}
                                        >
                                            {gen ? "Project ready" : "Generate Project"}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Audit history dialog */}
            <Dialog open={!!historyId} onOpenChange={(open) => !open && setHistoryId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Invoice History {historyId ? `(${historyId.substring(0, 8).toUpperCase()})` : ""}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-auto text-sm">
                        {historyLoading ? (
                            <div className="text-muted-foreground py-4 text-center">Loading history...</div>
                        ) : (historyData?.data?.length ? (
                            <ol className="space-y-3">
                                {historyData.data.map((entry: any) => (
                                    <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
                                        <div className="font-medium">{entry.action.replace(/_/g, " ")}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {entry.previousStatus ? `${entry.previousStatus} → ` : ""}{entry.nextStatus || ""}
                                        </div>
                                        {entry.reason && <div className="text-xs text-red-500 mt-0.5">Reason: {entry.reason}</div>}
                                        <div className="text-[10px] text-muted-foreground mt-0.5">
                                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <div className="text-muted-foreground py-4 text-center">No history yet.</div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
