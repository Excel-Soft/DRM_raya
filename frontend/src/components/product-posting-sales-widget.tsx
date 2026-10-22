import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateManualInvoiceDialog } from "@/components/create-manual-invoice-dialog";

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

interface Invoice {
    id: string;
    projectName?: string;
    status: string;
    companyName?: string;
    amount: number;
    createdAt: string;
}

export function ProductPostingSalesWidget() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [docUploadOpen, setDocUploadOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [docUrl, setDocUrl] = useState("");

    const { data: invoicesData } = useQuery({
        queryKey: ["/api/product-posting"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/product-posting");
            return res.json();
        }
    });

    const { data: customersData } = useQuery({
        queryKey: ["/api/sales/customers", "invoice-widget"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/customers?pageSize=5000");
            return res.json();
        }
    });
    const customers = (customersData as any)?.data || [];
    const customerById = new Map<string, any>(customers.map((c: any) => [c.id, c]));

    const resubmitMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/product-posting/${id}/resubmit`, {});
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/product-posting"] });
            toast({ title: "Resubmitted", description: "Sent back to HOD for approval." });
        },
        onError: (err) => {
            toast({ title: "Could not resubmit", description: readApiError(err), variant: "destructive" });
        }
    });

    const { data: projectsData } = useQuery({
        queryKey: ["/api/pms/projects?withStats=false"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/projects?withStats=false");
            return res.json();
        }
    });

    const uploadDocMutation = useMutation({
        mutationFn: async ({ projectId, url }: { projectId: string; url: string }) => {
            const res = await apiRequest("POST", `/api/projects/${projectId}/documents`, { documentUrl: url });
            return res.json();
        },
        onSuccess: () => {
            setDocUploadOpen(false);
            setDocUrl("");
            toast({ title: "Document uploaded", description: "Submitted for review." });
        },
        onError: (err) => {
            toast({ title: "Upload failed", description: readApiError(err), variant: "destructive" });
        }
    });

    const invoices = invoicesData?.data || [];
    const projects = Array.isArray(projectsData) ? projectsData : (projectsData as any)?.data || [];

    const getProjectIdForInvoice = (invoiceId: string) => {
        const project = projects.find((p: any) => p.invoiceId === invoiceId);
        return project?.id;
    };

    return (
        <Card className="col-span-1 rounded-2xl border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        Product Posting Invoices
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Create invoices and track project documents
                    </CardDescription>
                </div>
                <CreateManualInvoiceDialog
                    trigger={
                        <Button size="sm" className="h-8 gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="h-3.5 w-3.5" />
                            New Invoice
                        </Button>
                    }
                />
            </CardHeader>
            <CardContent className="p-0">
                {invoices.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 p-10 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-sm text-muted-foreground">No invoices created yet.</p>
                    </div>
                ) : (
                    <div className="max-h-[320px] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-2.5">#</th>
                                    <th className="px-4 py-2.5">Company</th>
                                    <th className="px-4 py-2.5">Account</th>
                                    <th className="px-4 py-2.5">Date</th>
                                    <th className="px-4 py-2.5">Amount</th>
                                    <th className="px-4 py-2.5">Status</th>
                                    <th className="px-4 py-2.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {invoices.map((inv: Invoice) => {
                                    const statusStyles =
                                        inv.status === "APPROVED"
                                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                            : inv.status === "REJECTED"
                                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                                                : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";
                                    const customer = (inv as any).customerId ? customerById.get((inv as any).customerId) : undefined;
                                    const accountLabel = customer
                                        ? `${customer.accountName || customer.contactName || "-"}${customer.drmId ? ` (${customer.drmId})` : ""}`
                                        : "-";
                                    return (
                                        <tr key={inv.id} className="hover:bg-muted/40 transition-colors">
                                            <td className="px-4 py-2.5 font-semibold text-foreground whitespace-nowrap">
                                                {(inv as any).invoiceNumber || (inv as any).invoice_number || (inv.id ? `INV-${inv.id.substring(0, 6).toUpperCase()}` : "Invoice")}
                                            </td>
                                            <td className="px-4 py-2.5 text-foreground truncate max-w-[120px]">{inv.companyName || "No Company"}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[140px]">{accountLabel}</td>
                                            <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString()}</td>
                                            <td className="px-4 py-2.5 font-semibold text-foreground tabular-nums whitespace-nowrap">${inv.amount}</td>
                                            <td className="px-4 py-2.5">
                                                <Badge className={cn("rounded-full border-0 text-[10px] font-semibold whitespace-nowrap", statusStyles)}>
                                                    {inv.status.replace("_", " ")}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {inv.status === "REJECTED" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 rounded-lg text-xs"
                                                        disabled={resubmitMutation.isPending}
                                                        onClick={() => resubmitMutation.mutate(inv.id)}
                                                        title="Rejected — check notifications for the reason"
                                                    >
                                                        {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit"}
                                                    </Button>
                                                ) : inv.status === "APPROVED" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 rounded-lg text-xs gap-1"
                                                        onClick={() => {
                                                            const projId = getProjectIdForInvoice(inv.id);
                                                            if (!projId) {
                                                                toast({ title: "Project not ready yet", description: "Please wait for project creation to complete." });
                                                                return;
                                                            }
                                                            setSelectedProjectId(projId);
                                                            setDocUploadOpen(true);
                                                        }}
                                                    >
                                                        <Upload className="h-3 w-3" />
                                                        Upload
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            {/* Document Upload Dialog */}
            <Dialog open={docUploadOpen} onOpenChange={setDocUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Requirements Document</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Project: {selectedProjectId}</Label>
                            <Input
                                placeholder="Google Drive / Dropbox Link..."
                                value={docUrl}
                                onChange={(e) => setDocUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Paste a link to the requirement scope, images, or assets.
                            </p>
                        </div>
                        <Button
                            onClick={() => uploadDocMutation.mutate({ projectId: selectedProjectId, url: docUrl })}
                            disabled={uploadDocMutation.isPending || !docUrl}
                        >
                            {uploadDocMutation.isPending ? "Uploading..." : "Submit for Verification"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
