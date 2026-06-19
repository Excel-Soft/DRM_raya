import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ShieldAlert, History } from "lucide-react";
import { INVOICE_TYPE_TO_PRODUCT_NAME, type InvoiceType } from "@shared/gm-sales-constants";

/** Human label for an invoice's type, preferring the canonical enum mapping and
 *  falling back to the stored service/project name. */
function invoiceTypeLabel(inv: any): string {
    if (inv?.invoiceType && INVOICE_TYPE_TO_PRODUCT_NAME[inv.invoiceType as InvoiceType]) {
        return INVOICE_TYPE_TO_PRODUCT_NAME[inv.invoiceType as InvoiceType];
    }
    return inv?.serviceType || inv?.projectName || "—";
}

/** Mirror of the backend `assertApprovalReadiness` rule so the UI can disable
 *  Approve for invoices the server would reject as INCOMPLETE_INVOICE. */
function incompleteReasons(inv: any): string[] {
    const missing: string[] = [];
    if (!inv?.customerId) missing.push("customer");
    if (!(Number(inv?.amount) > 0)) missing.push("amount");
    if (!inv?.invoiceType && !inv?.serviceType && !inv?.projectName) missing.push("type");
    return missing;
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

export function ProductPostingApprovalsWidget({ role }: { role: "HOD" | "Account Manager" }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [historyId, setHistoryId] = useState<string | null>(null);

    const { data: invoicesData, isLoading } = useQuery({
        queryKey: ["/api/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/invoices");
            return res.json();
        }
    });

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
                                    <span className="text-sm font-semibold">INV-{inv.id.substring(0, 6)}</span>
                                    <span className="text-sm text-emerald-600 font-bold">
                                        {inv.currency || "USD"} {inv.amount}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mb-2">
                                    <span>Type: <span className="text-foreground">{invoiceTypeLabel(inv)}</span></span>
                                    {inv.companyName && <span>Company: <span className="text-foreground">{inv.companyName}</span></span>}
                                    {inv.autoGenerated && <span className="text-amber-600">Auto-generated</span>}
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
                                            <span className="text-sm font-semibold">INV-{inv.id.substring(0, 6)}</span>
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
                        <DialogTitle>Invoice History {historyId ? `(INV-${historyId.substring(0, 6)})` : ""}</DialogTitle>
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
