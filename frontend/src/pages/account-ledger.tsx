import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Plus,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar,
    Search,
    ChevronLeft,
    User,
    Eye,
    Download,
    Filter,
    BookOpen,
    Trash2
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

interface LedgerEntry {
    id: string;
    entryType: "Credit" | "Debit";
    amount: string;
    currency: string;
    description: string;
    category: string;
    referenceId: string | null;
    referenceType: string | null;
    balanceAfter: string | null;
    entryDate: string;
    createdAt: string;
}

interface LedgerResponse {
    data: LedgerEntry[];
    total: number;
    page: number;
    pageSize: number;
    summary: {
        totalGM: number;
        totalRefund: number;
        totalInvoice: number;
        totalDonation: number;
        outstandingDues: number;
    };
}

const formSchema = z.object({
    entryType: z.enum(["Credit", "Debit"]),
    amount: z.string().min(1, "Amount is required"),
    currency: z.string().default("USD"),
    description: z.string().min(1, "Description is required"),
    category: z.string().min(1, "Category is required"),
    entryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const categories = [
    "Revenue",
    "Expense",
    "Invoice Payment",
    "GM Payment",
    "Donation",
    "Refund",
    "Salary",
    "Utilities",
    "Rent",
    "Marketing",
    "Other",
];

export default function AccountLedger() {
    const { toast } = useToast();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [companyFilter, setCompanyFilter] = useState("");
    const [contactFilter, setContactFilter] = useState("");
    const [ntnFilter, setNtnFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 15;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            entryType: "Credit",
            amount: "",
            currency: "USD",
            description: "",
            category: "",
            entryDate: new Date().toISOString().split('T')[0],
        },
    });

    const { data: ledgerData, isLoading } = useQuery<LedgerResponse>({
        queryKey: ["/api/reports/ledger", companyFilter, contactFilter, ntnFilter, dateFrom, currentPage],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", currentPage.toString());
            params.set("pageSize", pageSize.toString());
            if (companyFilter) params.set("company", companyFilter);
            if (contactFilter) params.set("contact", contactFilter);
            if (ntnFilter) params.set("ntn", ntnFilter);
            if (dateFrom) params.set("from", dateFrom);
            
            const res = await apiRequest("GET", `/api/reports/ledger?${params.toString()}`);
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: FormValues) =>
            apiRequest("POST", "/api/account/ledger", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/reports/ledger"] });
            setDialogOpen(false);
            form.reset();
            toast({ title: "Success", description: "Ledger entry created successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create ledger entry", variant: "destructive" });
        },
    });

    const entries = ledgerData?.data || [];
    const summary = ledgerData?.summary || { totalGM: 0, totalRefund: 0, totalInvoice: 0, totalDonation: 0, outstandingDues: 0 };

    const formatCurrency = (amount: string | number, currency = "PKR") => {
        const num = typeof amount === "string" ? parseFloat(amount) : amount;
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
        }).format(num);
    };

    const handleExport = (type: string) => {
        toast({
            title: `Exporting ${type.toUpperCase()}`,
            description: "Preparing your file for download...",
        });
        
        if (type === 'csv') {
            const params = new URLSearchParams();
            if (companyFilter) params.set("company", companyFilter);
            if (dateFrom) params.set("from", dateFrom);
            window.open(`/api/reports/ledger/export-csv?${params.toString()}`, "_blank");
        }
    };

    const onSubmit = (data: FormValues) => {
        createMutation.mutate(data);
    };

    return (
        <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-zinc-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:from-zinc-950 dark:via-zinc-950 dark:to-emerald-950/10 min-h-screen font-sans">
            <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
                
                {/* Header / Breadcrumbs */}
                <div className="mb-6 flex justify-between items-center px-1">
                    <div className="flex items-center gap-1.5 text-[14px] font-bold tracking-tight">
                        <span className="text-slate-400 uppercase">COMPANY</span>
                        <span className="text-slate-300 px-0.5">/</span>
                        <span className="text-slate-400 uppercase">FINANCIAL TRACKING</span>
                        <span className="text-slate-300 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">LEDGER</span>
                    </div>
                    <Button
                        onClick={() => setDialogOpen(true)}
                        className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md border-none px-6 h-9 transition-all duration-300 hover:scale-105 active:scale-95 text-[12px] font-bold uppercase tracking-wider"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Entry
                    </Button>
                </div>

                {/* Summary Section */}
                <div className="grid gap-6 md:grid-cols-4 mb-8">
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 relative overflow-hidden group dark:bg-zinc-900">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <TrendingUp className="w-24 h-24 text-emerald-600" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Invoices</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight dark:text-zinc-100">
                            {formatCurrency(summary.totalInvoice)}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">Verified</span>
                        </div>
                    </div>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 relative overflow-hidden group dark:bg-zinc-900">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <TrendingUp className="w-24 h-24 text-blue-600" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Received</p>
                        <p className="text-2xl font-black text-blue-600 tracking-tight">
                            {formatCurrency(summary.totalGM)}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">Bank Clearance</span>
                        </div>
                    </div>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 relative overflow-hidden group dark:bg-zinc-900">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <TrendingDown className="w-24 h-24 text-rose-500" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Refunds/Adjustments</p>
                        <p className="text-2xl font-black text-rose-500 tracking-tight">
                            {formatCurrency(summary.totalRefund)}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded uppercase">Adjusted</span>
                        </div>
                    </div>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 relative overflow-hidden group bg-gradient-to-br from-white to-emerald-50/30 dark:bg-zinc-900">
                        <div className="absolute -right-4 -bottom-4 opacity-10">
                            <DollarSign className="w-24 h-24 text-emerald-600" />
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Outstanding Balance</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight dark:text-zinc-100">
                            {formatCurrency(summary.outstandingDues)}
                        </p>
                        <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded uppercase">Pending</span>
                        </div>
                    </div>
                </div>

                {/* Filters Section */}
                <div className="space-y-6">
                    <h2 className="text-[#475569] font-bold text-[16px] px-2 uppercase tracking-wide dark:text-zinc-400">Filters</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 dark:bg-zinc-900">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 ml-1 dark:text-zinc-400">Company Name</label>
                                <Input 
                                    className="h-10 border-slate-200 text-[13px] bg-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium dark:bg-zinc-900 dark:border-zinc-800" 
                                    placeholder="Enter company name"
                                    value={companyFilter}
                                    onChange={(e) => setCompanyFilter(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 ml-1 dark:text-zinc-400">Contact No#</label>
                                <Input 
                                    className="h-10 border-slate-200 text-[13px] bg-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium dark:bg-zinc-900 dark:border-zinc-800" 
                                    placeholder="Enter contact no"
                                    value={contactFilter}
                                    onChange={(e) => setContactFilter(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 ml-1 dark:text-zinc-400">NTN/CINC #</label>
                                <Input 
                                    className="h-10 border-slate-200 text-[13px] bg-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium dark:bg-zinc-900 dark:border-zinc-800" 
                                    placeholder="Enter NTN/CINC"
                                    value={ntnFilter}
                                    onChange={(e) => setNtnFilter(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 ml-1 dark:text-zinc-400">Select Date</label>
                                <Input 
                                    type="date"
                                    className="h-10 border-slate-200 text-[13px] bg-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium dark:bg-zinc-900 dark:border-zinc-800" 
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-[#475569] font-bold text-[16px] px-2 mt-8 mb-[-12px] uppercase tracking-wide dark:text-zinc-400">Invoices List</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 mt-4 dark:bg-zinc-900">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div className="flex bg-[#64748b] rounded overflow-hidden shadow-sm">
                                <button onClick={() => handleExport('copy')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition">Copy</button>
                                <button onClick={() => handleExport('excel')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Excel</button>
                                <button onClick={() => handleExport('csv')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">CSV</button>
                                <button onClick={() => handleExport('pdf')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">PDF</button>
                                <button onClick={() => handleExport('print')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Print</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-bold uppercase tracking-tight dark:text-zinc-400">Search:</span>
                                <div className="relative">
                                    <Input 
                                        className="h-9 w-64 border-slate-200 pl-8 text-[13px] rounded-lg dark:border-zinc-800" 
                                        placeholder="Search across columns..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded-xl relative dark:border-zinc-800">
                            {isLoading && (
                                <div className="absolute inset-0 bg-white backdrop-blur-sm z-10 flex items-center justify-center dark:bg-zinc-900">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                                </div>
                            )}
                            <Table>
                                <TableHeader className="bg-[#f8fafc] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 pl-6 uppercase tracking-wider dark:text-zinc-400">No</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider dark:text-zinc-400">Co Name</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-right dark:text-zinc-400">Sub Total</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-right dark:text-zinc-400">Discount</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-right dark:text-zinc-400">Grand Total</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-right dark:text-zinc-400">Pay</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-right dark:text-zinc-400">Due</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 uppercase tracking-wider text-center dark:text-zinc-400">Date</TableHead>
                                        <TableHead className="text-[11px] font-black text-slate-500 py-4 text-center pr-6 uppercase tracking-wider dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {entries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-10 text-slate-400 font-medium">
                                                No invoice records found matching your criteria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        entries.map((entry, i) => {
                                            const subTotal = parseFloat(entry.amount);
                                            const discount = 0;
                                            const grandTotal = subTotal - discount;
                                            const pay = entry.entryType === "Credit" ? grandTotal : 0;
                                            const due = entry.entryType === "Debit" ? grandTotal : 0;
                                            
                                            const coName = entry.description.split(':').pop()?.trim() || entry.description;

                                            return (
                                                <TableRow key={entry.id} className="hover:bg-slate-50/50 border-slate-100 transition-colors dark:border-zinc-800">
                                                    <TableCell className="text-[13px] font-bold text-slate-400 py-4 pl-6">{(currentPage - 1) * pageSize + i + 1}</TableCell>
                                                    <TableCell className="text-[13px] font-black text-slate-700 py-4 whitespace-nowrap dark:text-zinc-400">
                                                        {coName}
                                                    </TableCell>
                                                    <TableCell className="text-[13px] font-bold text-slate-600 py-4 text-right dark:text-zinc-300">
                                                        {subTotal.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-[13px] font-bold text-rose-400 py-4 text-right">
                                                        {discount > 0 ? `-${discount.toLocaleString()}` : "0.00"}
                                                    </TableCell>
                                                    <TableCell className="text-[13px] font-black text-slate-800 py-4 text-right dark:text-zinc-100">
                                                        {grandTotal.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-[13px] font-black text-emerald-600 py-4 text-right">
                                                        {pay > 0 ? pay.toLocaleString() : "0.00"}
                                                    </TableCell>
                                                    <TableCell className="text-[13px] font-black text-rose-600 py-4 text-right">
                                                        {due > 0 ? due.toLocaleString() : "0.00"}
                                                    </TableCell>
                                                    <TableCell className="py-4 text-center">
                                                        <span className="text-[12px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded dark:text-zinc-400 dark:bg-zinc-900">
                                                            {format(new Date(entry.entryDate), "dd-MM-yyyy")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-4 pr-6">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                title="View Details"
                                                                className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors shadow-emerald-100"
                                                            >
                                                                <User className="h-3.5 w-3.5 text-white" />
                                                            </button>
                                                            <button 
                                                                title="Invoice Receipt"
                                                                className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors shadow-emerald-100"
                                                            >
                                                                <Eye className="h-3.5 w-3.5 text-white" />
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        
                        {/* Pagination */}
                        <div className="flex items-center justify-between mt-6 px-2">
                            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                                PAGE {currentPage} OF {Math.ceil((ledgerData?.total || 0) / pageSize) || 1}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[11px] font-bold uppercase tracking-wider border-slate-200 dark:border-zinc-800"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 text-[11px] font-bold uppercase tracking-wider border-slate-200 dark:border-zinc-800"
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    disabled={entries.length < pageSize}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Entry Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[500px] border-none shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="bg-[#f8fafc] p-6 border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                            <DialogTitle className="text-xl font-black text-[#1e293b] flex items-center gap-2 dark:text-zinc-100">
                                <Plus className="h-5 w-5 text-[#10b981] dark:text-zinc-100" />
                                ADD NEW <span className="text-[#10b981] dark:text-zinc-100">TRANSACTION</span>
                            </DialogTitle>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">RECORD FINANCIAL ENTRY TO LEDGER</p>
                        </DialogHeader>
                        <div className="p-6">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="entryType"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Type</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 border-slate-200 dark:border-zinc-800">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Credit" className="font-bold text-[#10b981] dark:text-zinc-100">Credit (Income)</SelectItem>
                                                            <SelectItem value="Debit" className="font-bold text-red-500">Debit (Expense)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="category"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Category</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 border-slate-200 dark:border-zinc-800">
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {categories.map((cat) => (
                                                                <SelectItem key={cat} value={cat} className="text-xs font-medium">{cat}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="amount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Amount</FormLabel>
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
                                            name="currency"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Currency</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-11 border-slate-200 font-bold dark:border-zinc-800">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="USD">USD ($)</SelectItem>
                                                            <SelectItem value="PKR">PKR (Rs)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className="text-[10px]" />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Description</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="What is this transaction for?..." {...field} className="min-h-[80px] border-slate-200 resize-none italic text-sm dark:border-zinc-800" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="entryDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold text-slate-500 uppercase tracking-widest dark:text-zinc-400">Transaction Date (Optional)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input type="date" {...field} className="h-11 border-slate-200 pl-9 font-medium dark:border-zinc-800" />
                                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />

                                    <DialogFooter className="pt-4 gap-2">
                                        <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="h-11 px-6 font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-zinc-800">
                                            Discard
                                        </Button>
                                        <Button type="submit" disabled={createMutation.isPending} className="h-11 px-8 bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-green-100 font-bold">
                                            {createMutation.isPending ? "Processing..." : "Confirm Transaction"}
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
