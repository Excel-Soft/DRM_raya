import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, AlertCircle, Upload } from "lucide-react";
import {
    INVOICE_TYPE_VALUES,
    INVOICE_TYPE_TO_PRODUCT_NAME,
    type InvoiceType,
} from "@shared/gm-sales-constants";

/** Roles permitted to create a manual invoice from this widget. Mirrors the
 *  backend `requireManualInvoiceCreator` policy. Service Executive is gated by
 *  config on the server and is not a surface for this (sales) widget. */
const MANUAL_INVOICE_ROLES = ["admin", "sales_executive", "sales_manager"];

function normalizeRole(raw: string | null | undefined): string {
    return (raw || "").toLowerCase().trim().replace(/\s+/g, "_");
}

/** Read the viewer's roles from sessionStorage (set by App after /api/auth/me). */
function canCreateManualInvoice(): boolean {
    const active = normalizeRole(sessionStorage.getItem("userRole"));
    let all: string[] = [];
    try {
        all = (JSON.parse(sessionStorage.getItem("userRoles") || "[]") as string[]).map(normalizeRole);
    } catch {
        all = [];
    }
    const roles = new Set<string>([active, ...all].filter(Boolean));
    return MANUAL_INVOICE_ROLES.some((r) => roles.has(r));
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
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [isFree, setIsFree] = useState(false);
    const [invoiceType, setInvoiceType] = useState<InvoiceType | "">("");
    const [companyName, setCompanyName] = useState("");
    const [customerId, setCustomerId] = useState("");
    const canCreate = canCreateManualInvoice();
    const [docUploadOpen, setDocUploadOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState("");
    const [docUrl, setDocUrl] = useState("");

    const { data: invoicesData } = useQuery({
        queryKey: ["/api/account/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/account/invoices");
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

    const createInvoiceMutation = useMutation({
        mutationFn: async (data: { amount: string, invoiceType: InvoiceType, companyName: string, customerId: string, paymentMethod?: string }) => {
            const res = await apiRequest("POST", "/api/account/invoices", data);
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/account/invoices"] });
            setIsOpen(false);
            setAmount("");
            setIsFree(false);
            setInvoiceType("");
            setCompanyName("");
            setCustomerId("");
            toast({ title: "Invoice created", description: "Submitted for HOD approval." });
        },
        onError: (err) => {
            toast({ title: "Could not create invoice", description: readApiError(err), variant: "destructive" });
        }
    });

    const resubmitMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/account/invoices/${id}/resubmit`, {});
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/account/invoices"] });
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
        <Card className="col-span-1 border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Product Posting Invoices
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Create invoices and track project documents
                    </CardDescription>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    {canCreate && (
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-8 gap-1">
                                <Plus className="h-3.5 w-3.5" />
                                New Invoice
                            </Button>
                        </DialogTrigger>
                    )}
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Product Posting Invoice</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="customer">Customer</Label>
                                <Select value={customerId} onValueChange={setCustomerId}>
                                    <SelectTrigger id="customer">
                                        <SelectValue placeholder="Select a customer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.companyName || c.name || c.contactName || `Customer ${String(c.id).substring(0, 6)}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoiceType">Invoice Type</Label>
                                <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)}>
                                    <SelectTrigger id="invoiceType">
                                        <SelectValue placeholder="Select an invoice type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INVOICE_TYPE_VALUES.map((t) => (
                                            <SelectItem key={t} value={t}>
                                                {INVOICE_TYPE_TO_PRODUCT_NAME[t]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input
                                    id="companyName"
                                    placeholder="e.g. Acme Corp"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount ($)</Label>
                                <Input
                                    id="amount"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    placeholder="e.g. 500"
                                    value={isFree ? "0" : amount}
                                    disabled={isFree}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        id="isFree"
                                        checked={isFree}
                                        onChange={(e) => setIsFree(e.target.checked)}
                                    />
                                    <Label htmlFor="isFree" className="cursor-pointer font-normal text-sm">
                                        Mark as Free ($0)
                                    </Label>
                                </div>
                            </div>
                            <Button
                                onClick={() => {
                                    if (!invoiceType) return;
                                    createInvoiceMutation.mutate({
                                        amount: isFree ? "0" : amount,
                                        invoiceType: invoiceType,
                                        companyName: companyName,
                                        customerId: customerId,
                                        paymentMethod: isFree ? "free" : undefined,
                                    });
                                }}
                                disabled={createInvoiceMutation.isPending || !customerId || (!isFree && !amount) || !invoiceType}
                            >
                                {createInvoiceMutation.isPending ? "Creating..." : "Submit Invoice"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                    {invoices.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No invoices created yet.
                        </div>
                    ) : (
                        invoices.map((inv: Invoice) => (
                            <div key={inv.id} className="flex flex-col p-3 border-b hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-semibold">{(inv as any).invoiceNumber || (inv as any).invoice_number || inv.projectName || (inv.id ? `INV-${inv.id.substring(0, 6).toUpperCase()}` : "Invoice")}</span>
                                    <Badge variant={
                                        inv.status === "APPROVED" ? "default" :
                                            inv.status === "REJECTED" ? "destructive" : "secondary"
                                    }>
                                        {inv.status.replace("_", " ")}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <span className="font-medium text-slate-600 dark:text-zinc-300">{inv.companyName || "No Company"}</span>
                                    <span>Amount: ${inv.amount}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(inv.createdAt).toLocaleDateString()}
                                </div>
                                {inv.status === "REJECTED" && (
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                        <div className="text-xs text-red-500 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" />
                                            Rejected — check notifications for the reason.
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs shrink-0"
                                            disabled={resubmitMutation.isPending}
                                            onClick={() => resubmitMutation.mutate(inv.id)}
                                        >
                                            {resubmitMutation.isPending ? "Resubmitting..." : "Resubmit to HOD"}
                                        </Button>
                                    </div>
                                )}

                                {/* Simulated Document Upload Trigger for Approved Projects */}
                                {inv.status === "APPROVED" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2 text-xs h-7 w-fit gap-1"
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
                                        Upload Documents
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
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
