import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, DollarSign, Calendar, Eye, Download } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Invoice {
    id: string;
    invoiceNumber: string;
    subtotal: string;
    tax: string;
    total: string;
    customerName: string;
    createdByUserId: string;
    createdAt: string;
}

interface Payment {
    id: string;
    amount: string;
    currency: string;
    entryDate: string;
    referenceId: string;
    category: string;
}

interface HistoryResponse {
    success: boolean;
    data: {
        invoices: Invoice[];
        receipts: Payment[];
    };
}

const formSchema = z.object({
    invoiceId: z.string().min(1, "Invoice is required"),
    amount: z.string().min(1, "Amount is required"),
    paymentMethod: z.string().default("BankTransfer"),
    notes: z.string().optional(),
    entryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AccountHistory() {
    const { companyId } = useParams<{ companyId: string }>();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoiceId: "",
            amount: "",
            paymentMethod: "BankTransfer",
            notes: "",
            entryDate: new Date().toISOString().split('T')[0],
        },
    });

    const { data: historyData, isLoading } = useQuery<HistoryResponse>({
        queryKey: ["/api/account/history", companyId],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/account/history/${encodeURIComponent(companyId || '')}`);
            return res.json();
        },
        enabled: !!companyId
    });

    const createPaymentMutation = useMutation({
        mutationFn: (data: FormValues) =>
            apiRequest("POST", "/api/account/payment", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/account/history"] });
            setDialogOpen(false);
            form.reset();
            toast({ title: "Success", description: "Payment recorded successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
        },
    });

    const onSubmit = (data: FormValues) => {
        createPaymentMutation.mutate(data);
    };

    const formatCurrency = (amount: string | number, currency = "USD") => {
        const num = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
        }).format(num);
    };

    const invoices = historyData?.data?.invoices || [];
    const receipts = historyData?.data?.receipts || [];

    // Calculate totals
    const totalInvoicesAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
    const totalPaidAmount = receipts.reduce((sum, rec) => sum + parseFloat(rec.amount), 0);
    const outstandingDue = totalInvoicesAmount - totalPaidAmount;

    return (
        <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/10 min-h-screen font-sans">
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
                <div className="mb-6 flex justify-between items-center px-1">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => setLocation("/account/ledger")} className="h-9 w-9 rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-zinc-800">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1.5 text-[14px] font-bold tracking-tight">
                            <span className="text-slate-400 uppercase">COMPANY</span>
                            <span className="text-slate-300 px-0.5">/</span>
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">{companyId}</span>
                        </div>
                    </div>
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md border-none px-6 h-9 transition-all duration-300 hover:scale-105 active:scale-95 text-[12px] font-bold uppercase tracking-wider"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Make Payment
                    </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Invoiced</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight dark:text-zinc-100">{formatCurrency(totalInvoicesAmount)}</p>
                    </div>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Paid</p>
                        <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(totalPaidAmount)}</p>
                    </div>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Outstanding Due</p>
                        <p className="text-2xl font-black text-rose-500 tracking-tight">{formatCurrency(outstandingDue)}</p>
                    </div>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="mb-6 bg-slate-100/50 p-1 rounded-xl h-auto flex flex-wrap gap-2 dark:bg-zinc-800">
                            <TabsTrigger value="all" className="rounded-lg px-6 py-2.5 text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-zinc-700">All</TabsTrigger>
                            <TabsTrigger value="invoices" className="rounded-lg px-6 py-2.5 text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-zinc-700">Invoice List</TabsTrigger>
                            <TabsTrigger value="receipts" className="rounded-lg px-6 py-2.5 text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-zinc-700">Receipt List</TabsTrigger>
                            <TabsTrigger value="summary" className="rounded-lg px-6 py-2.5 text-[13px] font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all dark:data-[state=active]:bg-zinc-700">Account Summary</TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="mt-0">
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2 dark:text-zinc-300">
                                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                        Invoices
                                    </h3>
                                    <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-zinc-800">
                                        <Table>
                                            <TableHeader className="bg-emerald-50/50 dark:bg-zinc-800/50">
                                                <TableRow className="hover:bg-transparent border-none">
                                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-6 uppercase tracking-wider dark:text-zinc-400">Invoice #</TableHead>
                                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Total</TableHead>
                                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                                                    <TableHead className="text-[11px] font-black text-slate-500 py-3 text-right pr-6 uppercase tracking-wider dark:text-zinc-400">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {invoices.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-400">No invoices found</TableCell></TableRow>
                                                ) : invoices.map(inv => (
                                                    <TableRow key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                                        <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-6 dark:text-zinc-300">{inv.invoiceNumber}</TableCell>
                                                        <TableCell className="text-[13px] font-bold text-slate-700 py-3 dark:text-zinc-300">{formatCurrency(inv.total)}</TableCell>
                                                        <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{format(new Date(inv.createdAt), 'dd-MM-yyyy')}</TableCell>
                                                        <TableCell className="py-3 pr-6 text-right">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"><Eye className="h-4 w-4" /></Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="invoices" className="mt-0">
                            {/* Detailed invoice view similar to above */}
                            <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-emerald-50/50 dark:bg-zinc-800/50">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-6 uppercase tracking-wider dark:text-zinc-400">Invoice #</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Sub Total</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Tax</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Grand Total</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-400">No invoices found</TableCell></TableRow>
                                        ) : invoices.map(inv => (
                                            <TableRow key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-6 dark:text-zinc-300">{inv.invoiceNumber}</TableCell>
                                                <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{formatCurrency(inv.subtotal)}</TableCell>
                                                <TableCell className="text-[13px] text-slate-600 py-3 dark:text-zinc-400">{formatCurrency(inv.tax)}</TableCell>
                                                <TableCell className="text-[13px] font-bold text-slate-800 py-3 dark:text-zinc-100">{formatCurrency(inv.total)}</TableCell>
                                                <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{format(new Date(inv.createdAt), 'dd-MM-yyyy')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="receipts" className="mt-0">
                            {/* Detailed receipts view */}
                            <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-rose-50/50 dark:bg-rose-900/10">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-6 uppercase tracking-wider dark:text-zinc-400">Ref ID</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Amount</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {receipts.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="text-center py-6 text-slate-400">No receipts found</TableCell></TableRow>
                                        ) : receipts.map(rec => (
                                            <TableRow key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-6 dark:text-zinc-300">{rec.id.slice(0, 8)}</TableCell>
                                                <TableCell className="text-[13px] font-bold text-emerald-600 py-3">{formatCurrency(rec.amount)}</TableCell>
                                                <TableCell className="text-[13px] text-slate-500 py-3 dark:text-zinc-400">{format(new Date(rec.entryDate), 'dd-MM-yyyy')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                        
                        <TabsContent value="summary" className="mt-0">
                            {/* Summary View mapping invoices + receipts */}
                            <div className="overflow-x-auto border border-slate-100 rounded-xl dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-amber-50/50 dark:bg-amber-900/10">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 pl-6 uppercase tracking-wider dark:text-zinc-400">Invoice #</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Grand Total</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Paid</TableHead>
                                            <TableHead className="text-[11px] font-black text-slate-500 py-3 uppercase tracking-wider dark:text-zinc-400">Due</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoices.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-400">No summary found</TableCell></TableRow>
                                        ) : invoices.map(inv => {
                                            const paidForInv = receipts.filter(r => r.referenceId === inv.id).reduce((sum, r) => sum + parseFloat(r.amount), 0);
                                            const due = parseFloat(inv.total) - paidForInv;
                                            return (
                                                <TableRow key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 border-slate-100 transition-colors dark:border-zinc-800">
                                                    <TableCell className="text-[13px] font-bold text-slate-700 py-3 pl-6 dark:text-zinc-300">{inv.invoiceNumber}</TableCell>
                                                    <TableCell className="text-[13px] font-bold text-slate-800 py-3 dark:text-zinc-100">{formatCurrency(inv.total)}</TableCell>
                                                    <TableCell className="text-[13px] text-emerald-600 font-medium py-3">{formatCurrency(paidForInv)}</TableCell>
                                                    <TableCell className="text-[13px] text-rose-500 font-bold py-3">{formatCurrency(due)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Make Payment Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[400px] border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="bg-[#f8fafc] p-6 border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                            <DialogTitle className="text-xl font-black text-[#1e293b] flex items-center gap-2 dark:text-zinc-100">
                                <DollarSign className="h-5 w-5 text-[#10b981] dark:text-zinc-100" />
                                MAKE <span className="text-[#10b981] dark:text-zinc-100">PAYMENT</span>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="invoiceId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Invoice</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-11 border-slate-200 dark:border-zinc-800">
                                                            <SelectValue placeholder="Select invoice" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {invoices.map((inv) => (
                                                            <SelectItem key={inv.id} value={inv.id} className="text-xs font-medium">{inv.invoiceNumber} - {formatCurrency(inv.total)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="amount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Amount to Pay</FormLabel>
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
                                        control={form.control}
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
                                                        <SelectItem value="BankTransfer" className="text-xs">Bank Transfer</SelectItem>
                                                        <SelectItem value="Cash" className="text-xs">Cash</SelectItem>
                                                        <SelectItem value="Cheque" className="text-xs">Cheque</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Notes (Optional)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Payment details..." {...field} className="min-h-[60px] border-slate-200 resize-none text-sm dark:border-zinc-800" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <DialogFooter className="pt-2 gap-2">
                                        <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="h-10 text-xs font-bold text-slate-400">Cancel</Button>
                                        <Button type="submit" disabled={createPaymentMutation.isPending} className="h-10 px-6 text-xs bg-[#10b981] hover:bg-[#059669] text-white shadow-lg font-bold">
                                            {createPaymentMutation.isPending ? "Processing..." : "Confirm"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </ScrollArea>
    );
}
