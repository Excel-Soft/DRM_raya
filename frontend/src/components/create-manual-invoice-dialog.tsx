import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

/** Shared "create a product posting invoice" flow — used by both the
 *  Product Posting Invoices card and the dashboard Quick Actions tile so
 *  there's exactly one place owning the create-invoice mutation. */
export function CreateManualInvoiceDialog({ trigger }: { trigger: ReactNode }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [isFree, setIsFree] = useState(false);
    const [invoiceType, setInvoiceType] = useState<InvoiceType | "">("");
    const [companyName, setCompanyName] = useState("");
    const [customerId, setCustomerId] = useState("");
    const canCreate = canCreateManualInvoice();

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
            const res = await apiRequest("POST", "/api/product-posting", data);
            await throwIfResNotOk(res);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/product-posting"] });
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

    if (!canCreate) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
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
    );
}
