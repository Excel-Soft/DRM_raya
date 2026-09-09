import { useState } from "react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { User, Mail, MessageCircle, Eye, Edit2, FileText, Phone, Clock, Printer, UserPlus, Loader2 } from "lucide-react";
import { useServiceExecutiveCreateGates } from "@/hooks/use-ui-workflow-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FollowupModal, EditCompanyModal, CustomerAttributeView } from "@/pages/service-private-pool";

export default function ServicePublicPool() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();
    const { canCreateManualInvoice } = useServiceExecutiveCreateGates();
    const [searchCustomer, setSearchCustomer] = useState("");
    const [serviceFilter, setServiceFilter] = useState<string>("all");
    const [gradeFilter, setGradeFilter] = useState<string>("all");
    const [activeCustomerAction, setActiveCustomerAction] = useState<string | null>(null);
    const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
    const [quickFollowupCustomer, setQuickFollowupCustomer] = useState<{ id: string; companyName: string } | null>(null);
    const [claimCustomer, setClaimCustomer] = useState<{ id: string; companyName: string } | null>(null);

    const logCustomerAction = async (customerId: string, action: string, meta?: Record<string, any>) => {
        try {
            await apiRequest("POST", `/api/sales/leads/${customerId}/actions`, { action, meta });
        } catch (err) {
            console.warn("Failed to log action", err);
        }
    };

    const { data: tracingSummary } = useQuery<Record<string, number>>({
        queryKey: ["/api/sales/tracing/summary", "Public", "all", serviceFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ pool: "public" });
            if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
            const response = await apiRequest("GET", `/api/sales/tracing/summary?${params.toString()}`);
            return response.json();
        },
    });

    const tracingTabs = [
        { label: `Alibaba Membership ${tracingSummary?.["Alibaba_Membership"] ?? 0}`, value: "Alibaba.com", color: "bg-[#34d399]" },
        { label: `Alibaba Services ${tracingSummary?.["Alibaba_Services"] ?? 0}`, value: "VAS (Value Added Services)", color: "bg-[#f43f5e]" },
        { label: `Design Development ${tracingSummary?.["Design_Development"] ?? 0}`, value: "Website Development", color: "bg-[#3b82f6]" },
        { label: `Domain Hosting ${tracingSummary?.["Domain_Hosting"] ?? 0}`, value: "Domain Hosting", color: "bg-[#334155]" },
    ];

    const grades = [
        { label: `A+ ${tracingSummary?.["A+"] ?? 0}`, value: "A+", color: "bg-[#059669]" },
        { label: `A- ${tracingSummary?.["A-"] ?? 0}`, value: "A-", color: "bg-[#f43f5e]" },
        { label: `B+ ${tracingSummary?.["B+"] ?? 0}`, value: "B+", color: "bg-[#34d399]" },
        { label: `B- ${tracingSummary?.["B-"] ?? 0}`, value: "B-", color: "bg-[#60a5fa]" },
        { label: `B ${tracingSummary?.["B"] ?? 0}`, value: "B", color: "bg-[#fbbf24]" },
        { label: `C+ ${tracingSummary?.["C+"] ?? 0}`, value: "C+", color: "bg-[#94a3b8]" },
        { label: `C ${tracingSummary?.["C"] ?? 0}`, value: "C", color: "bg-[#334155]" },
        { label: `D ${tracingSummary?.["D"] ?? 0}`, value: "D", color: "bg-[#059669]" },
    ];

    const { data: listData, isLoading: isLoadingList } = useQuery<any>({
        queryKey: ["/api/sales/lead-pools/list", "Public", 1, 50, gradeFilter, serviceFilter, searchCustomer],
        queryFn: async () => {
            const params = new URLSearchParams({
                pool: "public",
                page: "1",
                pageSize: "50",
            });
            if (searchCustomer) params.append("search", searchCustomer);
            if (gradeFilter !== "all") params.append("grade", gradeFilter);
            if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
            const response = await apiRequest("GET", `/api/sales/lead-pools/list?${params.toString()}`);
            return response.json();
        },
    });

    const displayData = listData?.items || [];

    const claimMutation = useMutation({
        mutationFn: async (customerId: string) => {
            const response = await apiRequest("POST", "/api/pools/claim", { customerId });
            return response.json();
        },
        onSuccess: () => {
            toast({ title: "Customer Picked", description: "The customer has been moved to your Private Pool." });
            setClaimCustomer(null);
            queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/list"], exact: false });
            queryClient.invalidateQueries({ queryKey: ["/api/sales/tracing/summary"], exact: false });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to pick customer.", variant: "destructive" });
        },
    });

    if (activeCustomerAction) {
        return (
            <CustomerAttributeView
                customerId={activeCustomerAction as string}
                onBack={() => setActiveCustomerAction(null)}
                backLabel="BACK TO PUBLIC POOL"
            />
        );
    }

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* CUSTOMER LIST TITLE */}
            <div className="mb-4">
                <h2 className="text-[15px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">PUBLIC POOL</h2>
            </div>

            {/* Search Area */}
            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div>
                    <label className="block text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Search Customer</label>
                    <Input
                        value={searchCustomer}
                        onChange={(e) => setSearchCustomer(e.target.value)}
                        placeholder="Enter company name/mobile/email"
                        className="text-[13px] h-9 border-slate-200 dark:border-zinc-800"
                    />
                </div>
            </div>

            {/* TRACING TITLE */}
            <div className="mb-4">
                <h2 className="text-[15px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">TRACING</h2>
            </div>

            {/* Tracing Area */}
            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                {/* Tracing Tabs */}
                <div className="flex w-full rounded overflow-hidden mb-4">
                    {tracingTabs.map((tab, idx) => {
                        const isActive = serviceFilter === tab.value;
                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (isActive) setServiceFilter("all");
                                    else setServiceFilter(tab.value);
                                }}
                                className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-opacity hover:opacity-90 ${isActive ? "bg-[#059669]" : tab.color}`}
                            >
                                {tab.label}
                            </div>
                        );
                    })}
                </div>

                {/* Grades */}
                <div className="flex w-full mb-6 relative">
                    {grades.map((grade, idx) => {
                        const isActive = gradeFilter === grade.value;
                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    if (isActive) setGradeFilter("all");
                                    else setGradeFilter(grade.value);
                                }}
                                className={`flex-1 py-2 text-center text-white text-[13px] font-bold cursor-pointer relative transition-opacity hover:opacity-90 ${isActive ? "bg-emerald-700 shadow-inner" : grade.color}`}
                            >
                                {grade.label}
                            </div>
                        );
                    })}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-none hover:bg-transparent">
                                <TableHead className="w-10 pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">DRM ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Co Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Sale Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Acc Holder</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Email</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Contact No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">NTN</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">CNIC</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Account Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingList ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">Loading...</TableCell>
                                </TableRow>
                            ) : displayData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">No customers found.</TableCell>
                                </TableRow>
                            ) : displayData.map((row: any) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => setQuickFollowupCustomer({ id: row.id, companyName: row.companyName })}
                                    className="border-b-0 hover:bg-slate-50/50 cursor-pointer dark:hover:bg-zinc-800/50"
                                >
                                    <TableCell onClick={(e) => e.stopPropagation()} className="pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                    <TableCell className="text-[12px] font-semibold text-emerald-600 py-3 dark:text-emerald-400">{row.drmId || row.id.substring(0, 8)}</TableCell>
                                    <TableCell className="text-[12px] font-semibold text-slate-600 py-3 dark:text-zinc-300">{row.companyName}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.salesPersonName || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.accountName || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.email || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.phone || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.ntn || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.cnic || "—"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()} className="py-3">
                                        <div className="flex items-center gap-1.5 flex-nowrap py-0.5">
                                            <div title="User Profile" onClick={() => setActiveCustomerAction(row.id)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shrink-0"><User className="w-3.5 h-3.5" /></div>
                                            <div title="View" onClick={() => setActiveCustomerAction(row.id)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"><Eye className="w-3.5 h-3.5" /></div>
                                            <div title="Follow up" onClick={() => setQuickFollowupCustomer({ id: row.id, companyName: row.companyName })} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"><Clock className="w-3.5 h-3.5" /></div>
                                            <div
                                                title="Email"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!row.email) {
                                                        toast({ title: "No email available", variant: "destructive" });
                                                        return;
                                                    }
                                                    await logCustomerAction(row.id, "email", { email: row.email });
                                                    window.location.href = `mailto:${row.email}`;
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><Mail className="w-3.5 h-3.5" /></div>
                                            <div
                                                title="WhatsApp"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const phone = (row.phone || "").replace(/\D+/g, "");
                                                    if (!phone) {
                                                        toast({ title: "No phone available", variant: "destructive" });
                                                        return;
                                                    }
                                                    await logCustomerAction(row.id, "whatsapp", { phone });
                                                    window.open(`https://wa.me/${phone}`, "_blank");
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><MessageCircle className="w-3.5 h-3.5" /></div>
                                            <div
                                                title="Call"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!row.phone) {
                                                        toast({ title: "No phone available", variant: "destructive" });
                                                        return;
                                                    }
                                                    await logCustomerAction(row.id, "call", { phone: row.phone });
                                                    window.location.href = `tel:${row.phone}`;
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><Phone className="w-3.5 h-3.5" /></div>
                                            <button
                                                title={canCreateManualInvoice ? "Create Invoice" : "Access Denied"}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!canCreateManualInvoice) {
                                                        toast({ title: "Access Denied", description: "You are not authorized to create invoices.", variant: "destructive" });
                                                        return;
                                                    }
                                                    setLocation(`/sales/create-invoice/${row.id}`);
                                                }}
                                                className={`h-6 px-2 rounded-[4px] text-white text-[10px] font-bold uppercase transition-colors flex items-center gap-1 shrink-0 ${canCreateManualInvoice ? "bg-[#059669] hover:bg-emerald-700 cursor-pointer" : "bg-slate-400 opacity-60 cursor-not-allowed"}`}
                                            ><FileText className="w-3 h-3" />Invoice</button>
                                            <div title="Edit" onClick={() => setEditCompanyId(row.id)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"><Edit2 className="w-3.5 h-3.5" /></div>
                                            <div
                                                title="Print"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await logCustomerAction(row.id, "print", { companyName: row.companyName });
                                                    window.print();
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><Printer className="w-3.5 h-3.5" /></div>
                                            <div
                                                title="Pick"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setClaimCustomer({ id: row.id, companyName: row.companyName });
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><UserPlus className="w-3.5 h-3.5" /></div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditCompanyModal customerId={editCompanyId} onClose={() => setEditCompanyId(null)} />
            <FollowupModal
                open={!!quickFollowupCustomer}
                onClose={() => setQuickFollowupCustomer(null)}
                customerId={quickFollowupCustomer?.id}
                companyName={quickFollowupCustomer?.companyName}
            />

            <Dialog open={!!claimCustomer} onOpenChange={(open) => !open && setClaimCustomer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pick Customer</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to pick "{claimCustomer?.companyName}"? This will move the customer to your Private Pool.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClaimCustomer(null)}>Cancel</Button>
                        <Button onClick={() => claimCustomer && claimMutation.mutate(claimCustomer.id)} disabled={claimMutation.isPending}>
                            {claimMutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Picking...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Pick Customer
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
