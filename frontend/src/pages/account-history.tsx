import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, DollarSign, Eye, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface Invoice {
    id: string;
    invoiceNumber: string;
    subtotal: string;
    tax: string;
    total: string;
    status: string;
    currency: string;
    dollarRate: string;
    items: string;
    customerName: string;
    createdByUserId: string;
    createdByName?: string;
    createdAt: string;
}

interface Payment {
    id: string;
    amount: string;
    currency: string;
    entryDate: string;
    referenceId: string;
    category: string;
    remarks: string | null;
    description?: string | null;
    receiptImage?: string | null;
}

interface HistoryResponse {
    success: boolean;
    data: {
        invoices: Invoice[];
        receipts: Payment[];
        customer: { phone: string | null; ntn: string | null } | null;
    };
}

const paymentFormSchema = z.object({
    amount: z.string().min(1, "Amount is required"),
    paymentMethod: z.string().default("Cash"),
    detail: z.string().optional(),
    entryDate: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const getInvoiceTitle = (inv: Invoice): string => {
    if (!inv.items) return "-";
    try {
        const parsed = typeof inv.items === "string" ? JSON.parse(inv.items) : inv.items;
        const first = Array.isArray(parsed) ? parsed[0] : null;
        return first?.name || first?.title || first?.productName || "-";
    } catch {
        return "-";
    }
};

// ledger_entries.entry_date is stored as a DATE column in the live database
// even though the Drizzle schema (and this API's response) models it as a
// timestamp, so it round-trips as an invalid value for every real (non-
// synthetic) receipt. date-fns' format() throws on an Invalid Date, which
// would otherwise crash this page outright the first time a real payment
// (not the legacy synthetic-receipt fallback) is opened.
const formatSafeDate = (value: string | Date | null | undefined, pattern: string): string => {
    if (!value) return "-";
    const d = new Date(value);
    return isNaN(d.getTime()) ? "-" : format(d, pattern);
};

// Every amount column shows the stored figure plus its PKR equivalent
// (using the invoice's own dollarRate) so Account doesn't have to convert
// USD invoices by hand to see what they're worth in PKR.
const AmountCell = ({ amount, inv, zeroDisplay = "0" }: { amount: number; inv: Invoice; zeroDisplay?: string }) => {
    if (amount <= 0) return <>{zeroDisplay}</>;
    const rate = Number(inv.dollarRate) || 280;
    return (
        <>
            <div>{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            {inv.currency !== "PKR" && (
                <div className="text-[10px] text-slate-400 font-normal mt-0.5">Rs {Math.round(amount * rate).toLocaleString()}</div>
            )}
        </>
    );
};

export default function AccountHistory() {
    const { companyId } = useParams<{ companyId: string }>();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [receiptsModalOpen, setReceiptsModalOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [viewReceiptOpen, setViewReceiptOpen] = useState(false);
    const [viewReceipt, setViewReceipt] = useState<Payment | null>(null);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);

    const openReceiptView = (rec: Payment) => {
        setViewReceipt(rec);
        setViewReceiptOpen(true);
    };

    const paymentForm = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentFormSchema),
        defaultValues: {
            amount: "",
            paymentMethod: "Cash",
            detail: "",
            entryDate: new Date().toISOString().split('T')[0],
        },
    });
    const watchedPaymentAmount = paymentForm.watch("amount");

    const { data: historyData, isLoading } = useQuery<HistoryResponse>({
        queryKey: ["/api/account/history", companyId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/account/history/${encodeURIComponent(companyId || '')}`);
            return res.json();
        },
        enabled: !!companyId
    });

    const makePaymentMutation = useMutation({
        mutationFn: async (data: PaymentFormValues) => {
            let receiptImage: string | undefined;
            if (receiptFile) {
                const fd = new FormData();
                fd.append("file", receiptFile);
                const uploadRes = await apiRequest("POST", "/api/account/dollar-system/martini-status/upload-image", fd);
                if (!uploadRes.ok) throw new Error("Receipt upload failed");
                const uploadData = await uploadRes.json();
                receiptImage = uploadData.url;
            }
            const res = await apiRequest("POST", "/api/account/payment", {
                invoiceId: selectedInvoice?.id,
                amount: data.amount,
                paymentMethod: data.paymentMethod,
                notes: data.detail,
                entryDate: data.entryDate,
                receiptImage,
            });
            if (!res.ok) throw new Error("Failed to record payment");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/account/history", companyId] });
            queryClient.invalidateQueries({ queryKey: ["/api/reports/ledger"] });
            setPaymentModalOpen(false);
            paymentForm.reset();
            setReceiptFile(null);
            toast({ title: "Success", description: "Payment recorded successfully" });
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err?.message || "Failed to record payment", variant: "destructive" });
        },
    });

    const onSubmitPayment = (data: PaymentFormValues) => {
        makePaymentMutation.mutate(data);
    };

    const openPaymentModal = (inv: Invoice) => {
        setSelectedInvoice(inv);
        paymentForm.reset({ amount: "", paymentMethod: "Cash", detail: "", entryDate: new Date().toISOString().split('T')[0] });
        setReceiptFile(null);
        setPaymentModalOpen(true);
    };

    const openReceiptsModal = (inv: Invoice) => {
        setSelectedInvoice(inv);
        setReceiptsModalOpen(true);
    };

    const invoices = historyData?.data?.invoices || [];
    const receipts = historyData?.data?.receipts || [];

    // Real receipts (plus the backend's synthetic stand-in for legacy
    // invoices marked Paid before any ledger entry existed, see
    // company-ledger-routes.ts) are the only source of truth for `pay` now —
    // status==='Paid' no longer implies "fully paid" on its own, since
    // approval can record a partial amount.
    const computeInvoiceFinancials = (inv: Invoice) => {
        const subTotal = Number(inv.subtotal || 0);
        const grandTotal = Number(inv.total || 0);
        const discount = subTotal - grandTotal > 0 ? subTotal - grandTotal : 0;
        const rate = Number(inv.dollarRate) || 280;
        // A receipt's currency can differ from its invoice's (approval always
        // records PKR regardless of invoice currency) — convert here, at read
        // time in full float precision, instead of ever rounding to 2dp
        // before this point, which is what turned a round 30,000 PKR payment
        // into 29,999 once it round-tripped through a 2-decimal USD column.
        const pay = receipts.filter((r) => r.referenceId === inv.id).reduce((sum, r) => {
            const amt = Number(r.amount || 0);
            if (!r.currency || r.currency === inv.currency) return sum + amt;
            if (inv.currency === "USD" && r.currency === "PKR") return sum + amt / rate;
            if (inv.currency === "PKR" && r.currency === "USD") return sum + amt * rate;
            return sum + amt;
        }, 0);
        const due = grandTotal - pay;
        return { subTotal, discount, grandTotal, pay, due };
    };

    const totalUsd = invoices.filter((i) => i.currency === "USD").reduce((s, i) => s + computeInvoiceFinancials(i).subTotal, 0);
    const totalPkr = invoices.filter((i) => i.currency !== "USD").reduce((s, i) => s + computeInvoiceFinancials(i).subTotal, 0);
    const totalDiscount = invoices.reduce((s, i) => s + computeInvoiceFinancials(i).discount, 0);
    const totalGrandTotal = invoices.reduce((s, i) => s + computeInvoiceFinancials(i).grandTotal, 0);
    const totalPay = invoices.reduce((s, i) => s + computeInvoiceFinancials(i).pay, 0);

    const invoiceReceipts = selectedInvoice ? receipts.filter((r) => r.referenceId === selectedInvoice.id) : [];

    const SectionHeading = ({ children }: { children: React.ReactNode }) => (
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-700 dark:text-zinc-200">
            <ArrowRight className="h-4 w-4 text-slate-400" />
            {children}
        </div>
    );

    const InvoiceListTable = () => (
        <div className="space-y-3">
            <SectionHeading>Invoice List</SectionHeading>
            <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-zinc-800">
                <Table>
                    <TableHeader className="bg-emerald-50/60 dark:bg-zinc-800/60">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-4 uppercase tracking-wider dark:text-zinc-400">No</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Title</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Company</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Sub Total</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Discount</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Grand Total</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Pay</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Due</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-center dark:text-zinc-400">Date</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 text-center pr-4 uppercase tracking-wider dark:text-zinc-400">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 ? (
                            <TableRow><TableCell colSpan={10} className="text-center py-10 text-slate-400 font-medium">No invoice records found for this company.</TableCell></TableRow>
                        ) : (
                            invoices.map((inv) => {
                                const { subTotal, discount, grandTotal, pay, due } = computeInvoiceFinancials(inv);
                                return (
                                    <TableRow key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-bold text-slate-600 py-3 pl-4">{inv.invoiceNumber}</TableCell>
                                        <TableCell className="text-[13px] py-3">
                                            <div className="font-bold text-slate-700 dark:text-zinc-300">{getInvoiceTitle(inv)}</div>
                                            <div className="text-[11px] text-slate-400">{inv.createdByName || "-"}</div>
                                        </TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-3 dark:text-zinc-400">{inv.customerName}</TableCell>
                                        <TableCell className="text-[13px] font-bold text-slate-600 py-3 text-right dark:text-zinc-300"><AmountCell amount={subTotal} inv={inv} /></TableCell>
                                        <TableCell className="text-[13px] font-bold text-rose-400 py-3 text-right"><AmountCell amount={discount} inv={inv} /></TableCell>
                                        <TableCell className="text-[13px] font-black text-slate-800 py-3 text-right dark:text-zinc-100"><AmountCell amount={grandTotal} inv={inv} /></TableCell>
                                        <TableCell className="text-[13px] font-black text-emerald-600 py-3 text-right"><AmountCell amount={pay} inv={inv} zeroDisplay="" /></TableCell>
                                        <TableCell className="text-[13px] font-black text-rose-600 py-3 text-right"><AmountCell amount={due} inv={inv} /></TableCell>
                                        <TableCell className="py-3 text-center text-[12px] text-slate-500 dark:text-zinc-400">{format(new Date(inv.createdAt), "dd-MM-yyyy")}</TableCell>
                                        <TableCell className="py-3 pr-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {due > 0 && (
                                                    <button title="Payment" onClick={() => openPaymentModal(inv)} className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors shadow-emerald-100">
                                                        <Wallet className="h-3.5 w-3.5 text-white" />
                                                    </button>
                                                )}
                                                <button title="View" onClick={() => openReceiptsModal(inv)} className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors shadow-emerald-100">
                                                    <Eye className="h-3.5 w-3.5 text-white" />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                    {invoices.length > 0 && (
                        <TableBody>
                            <TableRow className="bg-slate-50 dark:bg-zinc-900 border-none hover:bg-slate-50 dark:hover:bg-zinc-900">
                                <TableCell colSpan={3} className="text-[13px] font-bold text-slate-600 py-3 pl-4 dark:text-zinc-300">
                                    <div className="flex items-center gap-2">
                                        Total
                                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">${totalUsd.toLocaleString()}</span>
                                        <span className="text-[11px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded dark:bg-zinc-700">RS-{totalPkr.toLocaleString()}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-[13px] font-bold text-rose-400 py-3 text-right">{totalDiscount.toLocaleString()}</TableCell>
                                <TableCell className="text-[13px] font-black text-slate-800 py-3 text-right dark:text-zinc-100">{totalGrandTotal.toLocaleString()}</TableCell>
                                <TableCell className="text-[13px] font-black text-emerald-600 py-3 text-right">{totalPay.toLocaleString()}</TableCell>
                                <TableCell colSpan={3}></TableCell>
                            </TableRow>
                        </TableBody>
                    )}
                </Table>
            </div>
        </div>
    );

    const OriginalInvoiceListCombined = () => (
        <div className="space-y-3">
            <SectionHeading>Original Invoice List</SectionHeading>
            <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-zinc-800">
                <Table>
                    <TableHeader className="bg-rose-50 dark:bg-rose-900/10">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-4 uppercase tracking-wider dark:text-zinc-400">Title</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Invoice ID</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Rec Id</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Amount</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Method</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                            <TableHead className="text-[11px] font-black text-slate-500 py-3 text-center pr-4 uppercase tracking-wider dark:text-zinc-400">View</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {receipts.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-400">No receipts found for this company.</TableCell></TableRow>
                        ) : (
                            receipts.map((rec) => {
                                const inv = invoices.find((i) => i.id === rec.referenceId);
                                return (
                                    <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-4 dark:text-zinc-300">{inv ? getInvoiceTitle(inv) : "-"}</TableCell>
                                        <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{inv?.invoiceNumber || "-"}</TableCell>
                                        <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{rec.id.slice(0, 8)}</TableCell>
                                        <TableCell className="text-[13px] font-bold text-emerald-600 py-3">{Number(rec.amount).toLocaleString()} {rec.currency}</TableCell>
                                        <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{rec.remarks || "-"}</TableCell>
                                        <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{formatSafeDate(rec.entryDate, "dd/MM/yyyy hh:mm a")}</TableCell>
                                        <TableCell className="py-3 text-center pr-4">
                                            <button title="View" onClick={() => openReceiptView(rec)} className="inline-flex">
                                                <Eye className="h-4 w-4 text-rose-500" />
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );

    const PerInvoiceBlock = ({ inv }: { inv: Invoice }) => {
        const { subTotal, discount, grandTotal, pay, due } = computeInvoiceFinancials(inv);
        const invReceipts = receipts.filter((r) => r.referenceId === inv.id);
        const title = getInvoiceTitle(inv);
        return (
            <div className="space-y-3">
                <SectionHeading>Original Invoice List</SectionHeading>
                <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-amber-50 dark:bg-amber-900/10">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-4 uppercase tracking-wider dark:text-zinc-400">Title</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Invoice #</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Sub Total</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Discount</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Grand Total</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Paid</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Due</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Create By</TableHead>
                                <TableHead className="text-[11px] font-black text-slate-500 py-3 text-center pr-4 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 dark:border-zinc-800">
                                <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-4 dark:text-zinc-300">{title}</TableCell>
                                <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{inv.invoiceNumber}</TableCell>
                                <TableCell className="text-[13px] font-bold text-slate-600 py-3 text-right dark:text-zinc-300"><AmountCell amount={subTotal} inv={inv} /></TableCell>
                                <TableCell className="text-[13px] font-bold text-rose-400 py-3 text-right"><AmountCell amount={discount} inv={inv} /></TableCell>
                                <TableCell className="text-[13px] font-black text-slate-800 py-3 text-right dark:text-zinc-100"><AmountCell amount={grandTotal} inv={inv} /></TableCell>
                                <TableCell className="text-[13px] font-black text-emerald-600 py-3 text-right"><AmountCell amount={pay} inv={inv} zeroDisplay="" /></TableCell>
                                <TableCell className="text-[13px] font-black text-rose-600 py-3 text-right"><AmountCell amount={due} inv={inv} /></TableCell>
                                <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{inv.createdByName || "-"}</TableCell>
                                <TableCell className="text-[12px] text-slate-500 py-3 text-center pr-4 dark:text-zinc-400">{format(new Date(inv.createdAt), "dd-MM-yyyy hh:mm a")}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {invReceipts.length > 0 && (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg dark:border-zinc-800">
                        <Table>
                            <TableHeader className="bg-amber-50/70 dark:bg-amber-900/5">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-4 uppercase tracking-wider dark:text-zinc-400">Title</TableHead>
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Receipt #</TableHead>
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Paid</TableHead>
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider text-right dark:text-zinc-400">Due</TableHead>
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Method</TableHead>
                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 pr-4 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invReceipts.map((rec) => (
                                    <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-4 dark:text-zinc-300">{title}</TableCell>
                                        <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{rec.id.slice(0, 8)}</TableCell>
                                        <TableCell className="text-[13px] font-bold text-emerald-600 py-3 text-right"><AmountCell amount={Number(rec.amount)} inv={inv} /></TableCell>
                                        <TableCell className="text-[13px] font-bold text-rose-600 py-3 text-right"><AmountCell amount={due} inv={inv} /></TableCell>
                                        <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{rec.remarks || "-"}</TableCell>
                                        <TableCell className="text-[12px] text-slate-500 py-3 pr-4 dark:text-zinc-400">{formatSafeDate(rec.entryDate, "dd-MM-yyyy hh:mm a")}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        );
    };

    const tabTriggerClass = "rounded-none border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 pb-3 px-1 font-semibold text-slate-500 dark:text-zinc-400";

    return (
        <ScrollArea className="flex-1 bg-white dark:bg-zinc-950 min-h-screen font-sans">
            <div className="max-w-[1700px] mx-auto">
                <div className="flex items-center gap-3 px-6 py-4 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800">
                    <Button variant="outline" size="icon" onClick={() => setLocation("/account/ledger")} className="h-8 w-8 rounded-full shadow-sm">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h4 className="text-lg font-bold text-slate-700 uppercase tracking-wide dark:text-zinc-200">Account History</h4>
                </div>

                <div className="p-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-base font-bold text-slate-700 mb-4 dark:text-zinc-200">Time History Details</h3>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                            </div>
                        ) : (
                            <Tabs defaultValue="all" className="w-full">
                                <TabsList className="w-full justify-start gap-8 bg-transparent border-b border-slate-200 rounded-none h-auto p-0 mb-6 dark:border-zinc-800">
                                    <TabsTrigger value="all" className={tabTriggerClass}>All</TabsTrigger>
                                    <TabsTrigger value="invoices" className={tabTriggerClass}>Invoice List</TabsTrigger>
                                    <TabsTrigger value="receipts" className={tabTriggerClass}>Receipt List</TabsTrigger>
                                    <TabsTrigger value="summary" className={tabTriggerClass}>Account Summary</TabsTrigger>
                                </TabsList>

                                <TabsContent value="all" className="mt-0 space-y-10">
                                    <InvoiceListTable />
                                    <OriginalInvoiceListCombined />
                                    {invoices.map((inv) => <PerInvoiceBlock key={inv.id} inv={inv} />)}
                                </TabsContent>

                                <TabsContent value="invoices" className="mt-0">
                                    <InvoiceListTable />
                                </TabsContent>

                                <TabsContent value="receipts" className="mt-0">
                                    <OriginalInvoiceListCombined />
                                </TabsContent>

                                <TabsContent value="summary" className="mt-0 space-y-10">
                                    {invoices.map((inv) => <PerInvoiceBlock key={inv.id} inv={inv} />)}
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                </div>

                {/* Make Payment Dialog */}
                <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
                    <DialogContent className="sm:max-w-[450px] max-h-[90vh] flex flex-col border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="bg-[#f8fafc] p-6 border-b border-gray-100 shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <DialogTitle className="text-xl font-black text-[#1e293b] flex items-center gap-2 dark:text-zinc-100">
                                <Wallet className="h-5 w-5 text-[#10b981] dark:text-zinc-100" />
                                MAKE <span className="text-[#10b981] dark:text-zinc-100">PAYMENT</span>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6 overflow-y-auto flex-1 min-h-0">
                            <Form {...paymentForm}>
                                <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Company Name</Label>
                                            <Input value={companyId || ""} disabled className="h-11 border-slate-200 font-bold dark:border-zinc-800" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Invoice #</Label>
                                            <Input value={selectedInvoice?.invoiceNumber || ""} disabled className="h-11 border-slate-200 font-bold dark:border-zinc-800" />
                                        </div>
                                    </div>

                                    {(() => {
                                        const selectedFinancials = selectedInvoice ? computeInvoiceFinancials(selectedInvoice) : null;
                                        const rate = selectedInvoice ? (Number(selectedInvoice.dollarRate) || 280) : 280;
                                        const enteredAmount = Number(watchedPaymentAmount) || 0;
                                        const remainingDue = selectedFinancials ? Math.max(0, selectedFinancials.due - enteredAmount) : 0;
                                        const duePkr = selectedInvoice && selectedInvoice.currency !== "PKR"
                                            ? Math.round(remainingDue * rate)
                                            : null;
                                        return (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">
                                                    Due{enteredAmount > 0 ? " (After This Payment)" : ""}
                                                </Label>
                                                <Input
                                                    value={remainingDue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                    disabled
                                                    className="h-11 border-slate-200 font-bold text-rose-600 dark:border-zinc-800"
                                                />
                                                {duePkr !== null && (
                                                    <p className="text-[11px] text-slate-400 font-medium pl-1">≈ Rs {duePkr.toLocaleString()}</p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <FormField
                                        control={paymentForm.control}
                                        name="entryDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" {...field} className="h-11 border-slate-200 font-medium dark:border-zinc-800" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={paymentForm.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Enter Amount</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="h-11 border-slate-200 pl-8 font-bold dark:border-zinc-800" />
                                                        <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={paymentForm.control}
                                        name="paymentMethod"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Payment Method</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 border-slate-200 dark:border-zinc-800">
                                                            <SelectValue placeholder="Select method" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="Cash" className="text-xs">Cash</SelectItem>
                                                        <SelectItem value="BankTransfer" className="text-xs">Bank Transfer</SelectItem>
                                                        <SelectItem value="Cheque" className="text-xs">Cheque</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={paymentForm.control}
                                        name="detail"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Detail</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Payment details..." {...field} className="min-h-[60px] border-slate-200 resize-none text-sm dark:border-zinc-800" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Screenshot (Optional)</Label>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                            className="border-slate-200 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold dark:border-zinc-800"
                                        />
                                        {receiptFile && <p className="text-[11px] text-slate-400">{receiptFile.name}</p>}
                                    </div>

                                    <DialogFooter className="pt-2 gap-2">
                                        <Button type="button" variant="ghost" onClick={() => setPaymentModalOpen(false)} className="h-10 text-xs font-bold text-slate-400">Close</Button>
                                        <Button type="submit" disabled={makePaymentMutation.isPending} className="h-10 px-6 text-xs bg-[#10b981] hover:bg-[#059669] text-white shadow-lg font-bold">
                                            {makePaymentMutation.isPending ? "Saving..." : "Save"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Receipts List Dialog */}
                <Dialog open={receiptsModalOpen} onOpenChange={setReceiptsModalOpen}>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="bg-[#f8fafc] p-6 border-b border-gray-100 shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <DialogTitle className="text-xl font-black text-[#1e293b] flex items-center gap-2 dark:text-zinc-100">
                                <Eye className="h-5 w-5 text-[#10b981] dark:text-zinc-100" />
                                PAYMENT <span className="text-[#10b981] dark:text-zinc-100">LIST</span>
                                {selectedInvoice?.invoiceNumber && <span className="text-xs font-medium text-slate-400 normal-case ml-1">— {selectedInvoice.invoiceNumber}</span>}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6 overflow-y-auto flex-1 min-h-0">
                            <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-rose-50/50 dark:bg-rose-900/10">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-6 uppercase tracking-wider dark:text-zinc-400">Invoice ID</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Rec Id</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Amount</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Method</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 text-center pr-6 uppercase tracking-wider dark:text-zinc-400">View</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoiceReceipts.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-6 text-slate-400">No receipts found</TableCell></TableRow>
                                        ) : (
                                            invoiceReceipts.map((rec) => (
                                                <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                                    <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-6 dark:text-zinc-300">{selectedInvoice?.invoiceNumber || "-"}</TableCell>
                                                    <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{rec.id.slice(0, 8)}</TableCell>
                                                    <TableCell className="text-[13px] font-bold text-emerald-600 py-3">{Number(rec.amount).toLocaleString()} {rec.currency}</TableCell>
                                                    <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{rec.remarks || "-"}</TableCell>
                                                    <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{formatSafeDate(rec.entryDate, 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                                                    <TableCell className="py-3 text-center pr-6">
                                                        <button title="View" onClick={() => openReceiptView(rec)} className="inline-flex">
                                                            <Eye className="h-4 w-4 text-rose-500" />
                                                        </button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        <DialogFooter className="px-6 pb-6">
                            <Button type="button" variant="ghost" onClick={() => setReceiptsModalOpen(false)} className="h-10 text-xs font-bold text-slate-400">Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Receipt Detail (View) Dialog */}
                <Dialog open={viewReceiptOpen} onOpenChange={setViewReceiptOpen}>
                    <DialogContent className="sm:max-w-[450px] border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="bg-[#f8fafc] p-6 border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                            <DialogTitle className="text-xl font-black text-[#1e293b] flex items-center gap-2 dark:text-zinc-100">
                                <Eye className="h-5 w-5 text-[#10b981] dark:text-zinc-100" />
                                RECEIPT <span className="text-[#10b981] dark:text-zinc-100">DETAIL</span>
                            </DialogTitle>
                        </DialogHeader>
                        {viewReceipt && (
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Rec Id</Label>
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{viewReceipt.id.slice(0, 20)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Amount</Label>
                                        <p className="text-sm font-bold text-emerald-600">{Number(viewReceipt.amount).toLocaleString()} {viewReceipt.currency}</p>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Method</Label>
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{viewReceipt.remarks || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Date</Label>
                                        <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">{formatSafeDate(viewReceipt.entryDate, "dd/MM/yyyy hh:mm a")}</p>
                                    </div>
                                </div>
                                {viewReceipt.description && (
                                    <div>
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Detail</Label>
                                        <p className="text-sm text-slate-600 dark:text-zinc-400">{viewReceipt.description}</p>
                                    </div>
                                )}
                                {viewReceipt.receiptImage ? (
                                    <a href={viewReceipt.receiptImage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-xs font-bold uppercase hover:bg-emerald-700">
                                        <Eye className="h-3.5 w-3.5" /> Open Receipt File
                                    </a>
                                ) : (
                                    <p className="text-xs text-slate-400">No receipt file was attached for this payment.</p>
                                )}
                            </div>
                        )}
                        <DialogFooter className="px-6 pb-6">
                            <Button type="button" variant="ghost" onClick={() => setViewReceiptOpen(false)} className="h-10 text-xs font-bold text-slate-400">Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </ScrollArea>
    );
}
