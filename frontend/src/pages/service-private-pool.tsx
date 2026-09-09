import { useState } from "react";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { User, Mail, MessageCircle, Eye, Edit2, ArrowRight, ArrowLeft, FileText, Search, Phone, Clock, Printer, Archive } from "lucide-react";
import { useServiceExecutiveCreateGates } from "@/hooks/use-ui-workflow-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";
import { FollowCustomerServicesPanel, SubserviceDetail, FollowupServiceOption } from "@/components/FollowCustomerServicesPanel";

const normalizeCode = (value: string) => value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

export default function ServicePrivatePool() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const { canCreateManualInvoice } = useServiceExecutiveCreateGates();
    const [searchCustomer, setSearchCustomer] = useState("");
    const [teamCustomer, setTeamCustomer] = useState("");
    const [modalType, setModalType] = useState<string | null>(null);
    const [serviceFilter, setServiceFilter] = useState<string>("all");
    const [gradeFilter, setGradeFilter] = useState<string>("all");
    const [activeCustomerAction, setActiveCustomerAction] = useState<string | null>(null);
    const [activeTracingTab, setActiveTracingTab] = useState<string | null>(null);
    const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
    const [isDuplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [quickFollowupCustomer, setQuickFollowupCustomer] = useState<{ id: string; companyName: string } | null>(null);

    const logCustomerAction = async (customerId: string, action: string, meta?: Record<string, any>) => {
        try {
            await apiRequest("POST", `/api/sales/leads/${customerId}/actions`, { action, meta });
        } catch (err) {
            console.warn("Failed to log action", err);
        }
    };

    const topTabs = [
        { label: "Yet to Contact", color: "bg-[#059669]" },
        { label: "Contact", color: "bg-[#f43f5e]" },
        { label: "Invoice Send", color: "bg-[#34d399]" },
        { label: "WhatsApp (TEMP)", color: "bg-[#3b82f6]" },
        { label: "Email (TEMP)", color: "bg-[#fbbf24]" },
        { label: "SMS (TEMP)", color: "bg-[#64748b]" },
        { label: "Instagram (TEMP)", color: "bg-[#059669]" },
    ];

    const { data: tracingSummary } = useQuery<Record<string, number>>({
        queryKey: ["/api/sales/tracing/summary", "Private", "all", serviceFilter],
        queryFn: async () => {
            const params = new URLSearchParams({ pool: "private" });
            if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
            const response = await apiRequest("GET", `/api/sales/tracing/summary?${params.toString()}`);
            return response.json();
        },
    });

    const tracingTabs = [
        { label: `Alibaba Membership ${tracingSummary?.["Alibaba_Membership"] ?? 0}`, value: "Alibaba.com", followupTab: "ALIBABA MEMBERSHIP", color: "bg-[#34d399]" },
        { label: `Alibaba Services ${tracingSummary?.["Alibaba_Services"] ?? 0}`, value: "VAS (Value Added Services)", followupTab: "ALIBABA SERVICES", color: "bg-[#f43f5e]" },
        { label: `Design Development ${tracingSummary?.["Design_Development"] ?? 0}`, value: "Website Development", followupTab: "DESIGN DEVELOPMENT", color: "bg-[#3b82f6]" },
        { label: `Domain Hosting ${tracingSummary?.["Domain_Hosting"] ?? 0}`, value: "Domain Hosting", followupTab: "DOMAIN HOSTING", color: "bg-[#334155]" },
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
        queryKey: ["/api/sales/lead-pools/list", "Private", 1, 50, gradeFilter, serviceFilter, searchCustomer, null],
        queryFn: async () => {
            const params = new URLSearchParams({
                pool: "private",
                page: "1",
                pageSize: "50",
            });
            if (searchCustomer) params.append("search", searchCustomer);
            if (gradeFilter !== "all") params.append("grade", gradeFilter);
            if (serviceFilter !== "all") params.append("serviceFilter", serviceFilter);
            const response = await apiRequest("GET", `/api/sales/lead-pools/list?${params.toString()}`);
            return response.json();
        },
        // The global default polls every 30s (refetchInterval) with staleTime 0 —
        // using isFetching here made the whole table flash back to a bare
        // "Loading..." row on every single background refetch. isLoading only
        // fires on the very first load (no cached data yet), so background
        // refreshes now update the rows silently instead of flickering.
    });

    const displayData = listData?.items || [];

    if (activeCustomerAction) {
        return <CustomerAttributeView customerId={activeCustomerAction as string} onBack={() => setActiveCustomerAction(null)} />;
    }

    if (activeTracingTab) {
        return <FollowupListView activeTracingTab={activeTracingTab} setActiveTracingTab={setActiveTracingTab} />;
    }



    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Top Tabs */}
            <div className="flex w-full mb-6">
                {topTabs.map((tab, idx) => (
                    <div
                        key={idx}
                        onClick={() => {
                            if (tab.label === "WhatsApp (TEMP)") setModalType("whatsapp");
                            if (tab.label === "Email (TEMP)") setModalType("email");
                        }}
                        className={`flex-1 py-2.5 text-center text-white text-[13px] font-medium cursor-pointer transition-opacity hover:opacity-90 ${tab.color} ${idx === 0 ? "rounded-l-[4px]" : ""} ${idx === topTabs.length - 1 ? "rounded-r-[4px]" : ""}`}
                    >
                        {tab.label}
                    </div>
                ))}
            </div>

            {/* CUSTOMER LIST TITLE */}
            <div className="mb-4">
                <h2 className="text-[15px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">CUSTOMER LIST</h2>
            </div>

            {/* Search Area */}
            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Search Customer</label>
                        <Input
                            value={searchCustomer}
                            onChange={(e) => setSearchCustomer(e.target.value)}
                            placeholder="Enter company name/mobile/email"
                            className="text-[13px] h-9 border-slate-200 dark:border-zinc-800"
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Team Customer</label>
                        <Input
                            value={teamCustomer}
                            onChange={(e) => setTeamCustomer(e.target.value)}
                            placeholder="Enter company name/mobile/email"
                            className="text-[13px] h-9 border-slate-200 dark:border-zinc-800"
                        />
                    </div>
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
                                onClick={() => setActiveTracingTab(tab.followupTab)}
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
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.accountName || <div className="w-24 h-4 bg-slate-100 rounded blur-[2px] dark:bg-zinc-900"></div>}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.email || <div className="w-16 h-4 bg-slate-100 rounded blur-[2px] dark:bg-zinc-900"></div>}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.phone || <div className="w-20 h-5 bg-[#34d399]/30 rounded"></div>}</TableCell>
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
                                                onClick={async () => {
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
                                                onClick={async () => {
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
                                                onClick={async () => {
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
                                                onClick={() => {
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
                                                onClick={async () => {
                                                    await logCustomerAction(row.id, "print", { companyName: row.companyName });
                                                    window.print();
                                                }}
                                                className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
                                            ><Printer className="w-3.5 h-3.5" /></div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <EditCompanyModal customerId={editCompanyId} onClose={() => setEditCompanyId(null)} />
            <DuplicateCompaniesModal open={isDuplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} />
            <FollowupModal
                open={!!quickFollowupCustomer}
                onClose={() => setQuickFollowupCustomer(null)}
                customerId={quickFollowupCustomer?.id}
                companyName={quickFollowupCustomer?.companyName}
            />
            {/* Template Modals */}
            <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white gap-0 border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader className="p-5 border-b border-slate-100 dark:border-zinc-800">
                        <DialogTitle className="text-[20px] font-semibold text-[#475569] tracking-tight dark:text-zinc-400">
                            {modalType === "whatsapp" ? "Whats App Template" : "Email Template"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6">
                            <div className="border border-slate-100 rounded dark:border-zinc-800">

                                <Table>
                                    <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                                        <TableRow className="border-none hover:bg-transparent">
                                            <TableHead className="font-bold text-[#475569] py-4 w-20 dark:text-zinc-400">ID</TableHead>
                                            <TableHead className="font-bold text-[#475569] py-4 w-48 dark:text-zinc-400">Title</TableHead>
                                            <TableHead className="font-bold text-[#475569] py-4 dark:text-zinc-400">Message</TableHead>
                                            <TableHead className="font-bold text-[#475569] py-4 text-right pr-6 w-32 dark:text-zinc-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No templates available.</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FollowupListView({
    activeTracingTab,
    setActiveTracingTab,
}: {
    activeTracingTab: string;
    setActiveTracingTab: (val: string | null) => void;
}) {
    const { toast } = useToast();
    const [activeSubtype, setActiveSubtype] = useState<string>("All");
    const [activeGrade, setActiveGrade] = useState<string>("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [cols, setCols] = useState({
        id: { label: "#", visible: true },
        company: { label: "Company", visible: true },
        service: { label: "Main Service", visible: true },
        subtype: { label: "Sub Type", visible: true },
        grade: { label: "Grade", visible: true },
        purpose: { label: "Purpose", visible: true },
        method: { label: "Method", visible: true },
        comment: { label: "Comment", visible: true },
        person: { label: "Sale Person", visible: true },
        note: { label: "Followup Note", visible: true },
        nextDate: { label: "Next Date", visible: true },
        createdDate: { label: "Created Date", visible: true },
    });

    const { data: followupsRes } = useQuery({ queryKey: ["/api/dashboard/followups?pageSize=50&pool=private"] });
    const followupsData = (followupsRes as any)?.data?.items || [];

    const getCount = (serviceName: string) =>
        followupsData.filter((r: any) => (r.serviceType || "").toLowerCase() === serviceName.toLowerCase()).length;

    const byService = followupsData.filter((r: any) => (r.serviceType || "").toLowerCase() === activeTracingTab.toLowerCase());

    const uniqueSubtypes = Array.from(new Set(
        byService
            .filter((r: any) => activeGrade === "All" || (r.grade || "A").toLowerCase() === activeGrade.toLowerCase())
            .map((r: any) => r.subserviceName || r.serviceType || "General")
    )).filter(Boolean) as string[];

    const uniqueGrades = Array.from(new Set(
        byService
            .filter((r: any) => activeSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeSubtype.toLowerCase())
            .map((r: any) => r.grade || "A")
    )).filter(Boolean) as string[];

    const getSubtypeCount = (subtype: string) => {
        if (subtype === "All") return byService.filter((r: any) => activeGrade === "All" || (r.grade || "A").toLowerCase() === activeGrade.toLowerCase()).length;
        return byService.filter((r: any) => {
            const matchSub = (r.subserviceName || r.serviceType || "General").toLowerCase() === subtype.toLowerCase();
            const matchGrade = activeGrade === "All" || (r.grade || "A").toLowerCase() === activeGrade.toLowerCase();
            return matchSub && matchGrade;
        }).length;
    };

    const getGradeCount = (grade: string) => {
        if (grade === "All") return byService.filter((r: any) => activeSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeSubtype.toLowerCase()).length;
        return byService.filter((r: any) => {
            const matchGrade = (r.grade || "A").toLowerCase() === grade.toLowerCase();
            const matchSub = activeSubtype === "All" || (r.subserviceName || r.serviceType || "General").toLowerCase() === activeSubtype.toLowerCase();
            return matchGrade && matchSub;
        }).length;
    };

    const displayData = byService
        .filter((r: any) => {
            if (activeSubtype !== "All" && (r.subserviceName || r.serviceType || "General").toLowerCase() !== activeSubtype.toLowerCase()) return false;
            if (activeGrade !== "All" && (r.grade || "A").toLowerCase() !== activeGrade.toLowerCase()) return false;
            return true;
        })
        .map((row: any, index: number) => ({
            id: index + 1,
            company: row.company || "Unknown",
            service: row.serviceType || activeTracingTab,
            subtype: row.subserviceName || row.serviceType || "General",
            grade: row.grade || "A",
            purpose: row.purpose || "-",
            method: row.method || "-",
            comment: row.notes || "-",
            person: row.salesPerson || "-",
            note: row.followupNote || "-",
            nextDate: row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "-",
            createdDate: row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-",
        }))
        .filter((row: any) => {
            if (!searchTerm.trim()) return true;
            const needle = searchTerm.trim().toLowerCase();
            return Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(needle));
        });

    const totalPages = Math.max(1, Math.ceil(displayData.length / pageSize));
    const pageData = displayData.slice((page - 1) * pageSize, page * pageSize);

    const handleTabClick = (tab: string) => {
        setActiveTracingTab(tab);
        setActiveSubtype("All");
        setActiveGrade("All");
        setSearchTerm("");
        setPage(1);
    };

    // Export columns derive from the visible columns; rows come from the real,
    // currently-filtered row set (displayData), not a mock array.
    const exportColumns = () =>
        Object.entries(cols)
            .filter(([, c]) => c.visible)
            .map(([key, c]) => ({ key, header: c.label }));

    const handleCopy = () => {
        if (!displayData.length) {
            toast({ title: "No data available to copy.", variant: "destructive" });
            return;
        }
        const columns = exportColumns();
        const headers = columns.map(c => c.header).join('\t');
        const text = headers + '\n' + displayData.map((d: any) => columns.map(c => d[c.key] ?? "").join('\t')).join('\n');
        navigator.clipboard.writeText(text);
        toast({ title: "Copied to clipboard" });
    };

    const handleExcel = () => {
        if (!displayData.length) {
            toast({ title: "No data available to export.", variant: "destructive" });
            return;
        }
        exportToCSV(displayData, exportColumns(), "private-pool-followups");
    };

    const handlePDF = () => {
        if (!displayData.length) {
            toast({ title: "No data available to export.", variant: "destructive" });
            return;
        }
        exportToPDF(displayData, exportColumns(), "private-pool-followups");
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            <button onClick={() => setActiveTracingTab(null)} className="flex items-center gap-2 mb-4 text-[#475569] font-bold text-[14px] uppercase tracking-tight hover:text-[#059669] transition-colors dark:text-zinc-400">
                <ArrowLeft className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                {activeTracingTab} FOLLOWUP LIST
            </button>

            {/* Top Tabs */}
            <div className="flex w-full mb-6 rounded overflow-hidden shadow-sm">
                <div onClick={() => handleTabClick("ALIBABA MEMBERSHIP")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "ALIBABA MEMBERSHIP" ? "bg-[#059669]" : "bg-[#34d399]"}`}>Alibaba Membership ({getCount("ALIBABA MEMBERSHIP")})</div>
                <div onClick={() => handleTabClick("ALIBABA SERVICES")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "ALIBABA SERVICES" ? "bg-[#059669]" : "bg-[#f43f5e]"}`}>Alibaba Services ({getCount("ALIBABA SERVICES")})</div>
                <div onClick={() => handleTabClick("DESIGN DEVELOPMENT")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "DESIGN DEVELOPMENT" ? "bg-[#2563eb]" : "bg-[#60a5fa]"}`}>Design Development ({getCount("DESIGN DEVELOPMENT")})</div>
                <div onClick={() => handleTabClick("DOMAIN HOSTING")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "DOMAIN HOSTING" ? "bg-[#059669]" : "bg-[#334155]"}`}>Domain Hosting ({getCount("DOMAIN HOSTING")})</div>
            </div>

            {/* Summaries */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {uniqueSubtypes.length > 0 && (
                    <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Service Type Summary</h3>
                        <div className="flex flex-wrap gap-2">
                            {["All", ...uniqueSubtypes].map((sub) => {
                                const count = getSubtypeCount(sub);
                                if (count === 0 && sub !== "All") return null;
                                const isActive = activeSubtype === sub;
                                return (
                                    <span
                                        key={sub}
                                        onClick={() => setActiveSubtype(sub)}
                                        className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#059669] text-white" : "bg-white border border-[#059669] text-[#059669] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"}`}
                                    >
                                        {sub} ({count})
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
                {uniqueGrades.length > 0 && (
                    <div className="flex-1 bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Grade Summary</h3>
                        <div className="flex flex-wrap gap-2">
                            {["All", ...uniqueGrades].map((grade) => {
                                const count = getGradeCount(grade);
                                if (count === 0 && grade !== "All") return null;
                                const isActive = activeGrade === grade;
                                return (
                                    <span
                                        key={grade}
                                        onClick={() => setActiveGrade(grade)}
                                        className={`px-3 py-1 text-[12px] font-medium rounded cursor-pointer transition-colors ${isActive ? "bg-[#1e293b] text-white" : "bg-white border border-slate-300 text-slate-600 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"}`}
                                    >
                                        {grade} ({count})
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="text-[14px] font-bold text-slate-600 mb-4 dark:text-zinc-300">View Detail</h3>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex bg-[#64748b] text-white rounded text-[13px] font-medium shadow-sm flex-wrap">
                        <button onClick={handleCopy} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors rounded-l dark:border-zinc-800">Copy</button>
                        <button onClick={handleExcel} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors dark:border-zinc-800">Excel</button>
                        <button onClick={handlePDF} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors dark:border-zinc-800">PDF</button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="px-4 py-2 hover:bg-[#475569] transition-colors rounded-r text-left outline-none">Column visibility</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                                {Object.entries(cols).map(([key, col]) => (
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        checked={col.visible}
                                        onCheckedChange={(checked) => {
                                            setCols(prev => ({
                                                ...prev,
                                                [key]: { ...prev[key as keyof typeof prev], visible: checked }
                                            }));
                                        }}
                                    >
                                        {col.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                        <label>Search:</label>
                        <Input
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#d1fae5]/50">
                            <TableRow className="border-b border-slate-200 hover:bg-[#d1fae5]/50 dark:border-zinc-800">
                                {cols.id.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">#</TableHead>}
                                {cols.company.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Company</TableHead>}
                                {cols.service.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Main Service</TableHead>}
                                {cols.subtype.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Sub Type</TableHead>}
                                {cols.grade.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Grade</TableHead>}
                                {cols.purpose.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Purpose</TableHead>}
                                {cols.method.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Method</TableHead>}
                                {cols.comment.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Comment</TableHead>}
                                {cols.person.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Sale Person</TableHead>}
                                {cols.note.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Followup Note</TableHead>}
                                {cols.nextDate.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Next Date</TableHead>}
                                {cols.createdDate.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Created Date</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pageData.length > 0 ? (
                                pageData.map((row: any) => (
                                    <TableRow key={row.id} className="border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        {cols.id.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.id}</TableCell>}
                                        {cols.company.visible && <TableCell className="text-[13px] font-bold text-slate-700 dark:text-zinc-300">{row.company}</TableCell>}
                                        {cols.service.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.service}</TableCell>}
                                        {cols.subtype.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.subtype}</TableCell>}
                                        {cols.grade.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.grade}</TableCell>}
                                        {cols.purpose.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.purpose}</TableCell>}
                                        {cols.method.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.method}</TableCell>}
                                        {cols.comment.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.comment}</TableCell>}
                                        {cols.person.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.person}</TableCell>}
                                        {cols.note.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.note}</TableCell>}
                                        {cols.nextDate.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.nextDate}</TableCell>}
                                        {cols.createdDate.visible && <TableCell className="text-[13px] text-slate-600 dark:text-zinc-300">{row.createdDate}</TableCell>}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={Object.values(cols).filter(c => c.visible).length} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">No companies found for this filter selection.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex justify-between items-center text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                    <div>
                        Showing {displayData.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, displayData.length)} of {displayData.length} entries
                    </div>
                    <div className="flex gap-1 items-center">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-[4px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-[12px] font-medium"
                        >
                            Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .reduce((acc: (number | string)[], p, idx, arr) => {
                                if (idx > 0 && (arr[idx - 1] as number) < p - 1) acc.push('...');
                                acc.push(p);
                                return acc;
                            }, [])
                            .map((p, idx) =>
                                p === '...' ? (
                                    <span key={`dots-${idx}`} className="px-2 text-slate-400">...</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`w-8 h-8 rounded-[4px] border text-[12px] font-medium transition-colors ${page === p ? 'bg-[#059669] text-white border-[#059669]' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 rounded-[4px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors text-[12px] font-medium"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CustomerAttributeView({ customerId, onBack, backLabel = "BACK TO PRIVATE POOL" }: { customerId: string; onBack: () => void; backLabel?: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();
    const [activeHistoryTab, setActiveHistoryTab] = useState("Contact History");
    const [isQuotationTemplateModalOpen, setQuotationTemplateModalOpen] = useState(false);
    const [activeCardModal, setActiveCardModal] = useState<string | null>(null);
    const [isRatingModalOpen, setRatingModalOpen] = useState(false);
    const [ratingValue, setRatingValue] = useState("5");
    const [ratingNote, setRatingNote] = useState("");
    const [isSampleModalOpen, setSampleModalOpen] = useState(false);
    const [sampleProduct, setSampleProduct] = useState("");
    const [sampleNote, setSampleNote] = useState("");

    const ratingMutation = useMutation({
        mutationFn: async () => apiRequest("POST", "/api/service/feedback", {
            customerId,
            rating: Number(ratingValue),
            note: ratingNote || undefined,
        }),
        onSuccess: () => {
            toast({ title: "Rating recorded" });
            setRatingModalOpen(false);
            setRatingNote("");
            queryClient.invalidateQueries({ queryKey: ["/api/service/manager/team-work-performance"] });
        },
        onError: () => toast({ title: "Failed to record rating", variant: "destructive" }),
    });

    const sampleMutation = useMutation({
        mutationFn: async () => apiRequest("POST", "/api/service/sample-requests", {
            customerId,
            productName: sampleProduct || undefined,
            note: sampleNote || undefined,
        }),
        onSuccess: () => {
            toast({ title: "Sample request logged" });
            setSampleModalOpen(false);
            setSampleProduct("");
            setSampleNote("");
            queryClient.invalidateQueries({ queryKey: ["/api/service/manager/team-work-performance"] });
        },
        onError: () => toast({ title: "Failed to log sample request", variant: "destructive" }),
    });

    const { data: profileData, isLoading } = useQuery<any>({
        queryKey: [`/api/sales/leads/${customerId}/profile`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/leads/${customerId}/profile`);
            return response.json();
        },
        enabled: !!customerId,
    });

    const { data: invoiceHistory = [], isLoading: isInvoiceLoading } = useQuery<any[]>({
        queryKey: [`/api/sales/customers/${customerId}/invoices`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/customers/${customerId}/invoices`);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!customerId && activeHistoryTab === "Invoice History",
    });

    // Same real endpoints the Sales Executive's own Attribute view already
    // uses (lead-pools.tsx) — this view previously left these three tabs as
    // static "No X recorded" placeholders despite the data existing.
    const { data: contactHistory = [], isLoading: isContactLoading } = useQuery<any[]>({
        queryKey: [`/api/sales/customers/${customerId}/followups`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/customers/${customerId}/followups`);
            const data = await response.json();
            const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            return rows;
        },
        enabled: !!customerId && activeHistoryTab === "Contact History",
    });

    const { data: quotationHistory = [], isLoading: isQuotationLoading } = useQuery<any[]>({
        queryKey: [`/api/quotations?leadId=${customerId}`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/quotations?leadId=${customerId}`);
            const data = await response.json().catch(() => ({}));
            return Array.isArray(data?.data) ? data.data : data?.data?.items ?? [];
        },
        enabled: !!customerId && activeHistoryTab === "Quotation History",
    });

    const { data: gmHistory = [], isLoading: isGmLoading } = useQuery<any[]>({
        queryKey: [`/api/sales/customers/${customerId}/gm-entries`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/customers/${customerId}/gm-entries`);
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !!customerId && activeHistoryTab === "GM History",
    });

    const lead = profileData?.lead || {};
    const phones = profileData?.phones || [];
    const grade = lead.grade || "-";
    const contactCount = profileData?.activities?.length || 0;
    const lastContact = profileData?.lastContactAt ? new Date(profileData.lastContactAt).toLocaleString() : "Never";

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen relative dark:bg-zinc-950">
            <QuotationTemplateModal open={isQuotationTemplateModalOpen} onClose={() => setQuotationTemplateModalOpen(false)} />
            <AttributeActionModal type={activeCardModal} onClose={() => setActiveCardModal(null)} customerId={customerId} companyName={lead.companyName} />
            <button onClick={onBack} className="flex items-center gap-2 mb-4 text-[#475569] font-bold text-[14px] uppercase tracking-tight hover:text-[#059669] transition-colors dark:text-zinc-400">
                <ArrowLeft className="w-4 h-4 text-[#059669] dark:text-zinc-400" /> {backLabel}
            </button>
            <div className="mb-4 text-[#475569] font-bold text-[15px] uppercase tracking-tight dark:text-zinc-400">ATTRIBUTE</div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20 text-slate-500 font-medium">Loading profile...</div>
            ) : (
                <>
                <div className="grid grid-cols-1 gap-6 mb-6">
                    {/* Column 1: Info */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 flex flex-col items-center dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-[#475569] mb-3 text-center w-full dark:text-zinc-400">{lead.companyName || "Unknown Company"}</h3>
                        <div className="bg-[#e2e8f0]/40 text-[#475569] border border-[#cbd5e1]/50 rounded-full w-[36px] h-[36px] flex items-center justify-center text-[12px] font-bold mb-4 dark:text-zinc-400 dark:border-zinc-800">{grade}</div>
                        <p className="text-[13px] font-bold text-[#475569] mb-1 dark:text-zinc-400">{lead.accountName || "Unknown Contact"}</p>
                        <p className="text-[13px] text-slate-400 mb-2">{lead.email || "No Email"}</p>
                        <div className="flex justify-center gap-3 mb-6">
                            {phones.length > 0 ? (
                                phones.map((p: { label: string; value: string }, idx: number) => (
                                    <div key={idx} className="flex flex-col items-center gap-1">
                                        <span className="bg-[#059669] text-white px-5 py-1 rounded-[4px] text-[13px] font-bold">{p.value}</span>
                                        <span className="text-[10px] text-slate-400">{p.label}</span>
                                    </div>
                                ))
                            ) : (
                                <span className="bg-[#059669] text-white px-5 py-1 rounded-[4px] text-[13px] font-bold">No Phone</span>
                            )}
                        </div>

                        <div className="flex w-full justify-evenly items-start mb-6 px-4">
                            <div className="flex flex-col items-center">
                                <span className="text-[12px] text-slate-500 font-medium mb-1 dark:text-zinc-400">Grade:</span>
                                <div className="bg-[#fef3c7] text-[#d97706] rounded-full w-[36px] h-[36px] flex items-center justify-center text-[12px] font-bold shadow-sm dark:bg-zinc-900">{grade}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[12px] text-slate-500 font-medium mb-1 dark:text-zinc-400">Contact:</span>
                                <div className="bg-[#fee2e2] text-[#ef4444] rounded-full w-[36px] h-[36px] flex items-center justify-center text-[13px] font-bold shadow-sm dark:bg-zinc-900">{contactCount}</div>
                            </div>
                        </div>

                        <div className="w-full flex flex-col items-center mb-6">
                            <span className="text-[12px] text-slate-500 font-medium mb-1 dark:text-zinc-400">Last Contact:</span>
                            <div className="bg-[#1e293b] text-white px-4 py-1.5 rounded-[4px] text-[12px] font-medium w-full max-w-[200px] text-center">{lastContact}</div>
                        </div>

                    <div className="flex flex-wrap justify-center gap-[4px] w-full px-2">
                        <span onClick={() => setActiveCardModal('followup')} className="bg-[#059669] hover:bg-[#047857] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Followup</span>
                        <span onClick={() => setLocation(`/sales/quotation?leadId=${customerId}`)} className="bg-[#8b5cf6] hover:bg-[#7c3aed] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Quotation</span>
                        <span onClick={() => setActiveCardModal('invoice')} className="bg-[#6366f1] hover:bg-[#4f46e5] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Invoice</span>
                        <span onClick={() => setActiveCardModal('gmdoc')} className="bg-[#ef4444] hover:bg-[#dc2626] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm dark:bg-zinc-900 dark:hover:bg-zinc-800">Gm Doc</span>
                        <span onClick={() => setActiveCardModal('gmbv')} className="bg-[#d97706] hover:bg-[#b45309] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm dark:bg-zinc-900">Gm BV submit</span>
                        <span onClick={() => setActiveCardModal('update_expiry')} className="bg-[#3b82f6] hover:bg-[#2563eb] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Update Expiry</span>
                        <span onClick={() => setRatingModalOpen(true)} className="bg-[#f59e0b] hover:bg-[#d97706] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Rate Customer</span>
                        <span onClick={() => setSampleModalOpen(true)} className="bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Log Sample</span>
                    </div>
                </div>

                <Dialog open={isRatingModalOpen} onOpenChange={(v) => !v && setRatingModalOpen(false)}>
                    <DialogContent className="max-w-[380px] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogHeader className="border-b border-slate-100 pb-3 dark:border-zinc-800">
                            <DialogTitle className="text-[16px] font-bold text-slate-800 dark:text-zinc-100">Rate Customer Satisfaction</DialogTitle>
                        </DialogHeader>
                        <div className="pt-2 pb-2 flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Rating (1-5)</label>
                                <select value={ratingValue} onChange={(e) => setRatingValue(e.target.value)} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2.5 text-[13px] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                    {[5, 4, 3, 2, 1].map((n) => (<option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Note (optional)</label>
                                <textarea rows={3} value={ratingNote} onChange={(e) => setRatingNote(e.target.value)} className="w-full border border-slate-300 bg-white rounded-[6px] px-3 py-2.5 text-[13px] text-slate-700 resize-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                            <button onClick={() => setRatingModalOpen(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-bold dark:bg-zinc-900 dark:text-zinc-400">Cancel</button>
                            <button onClick={() => ratingMutation.mutate()} disabled={ratingMutation.isPending} className="px-6 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-[6px] text-[13px] font-bold disabled:opacity-60">{ratingMutation.isPending ? "Saving…" : "Submit"}</button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isSampleModalOpen} onOpenChange={(v) => !v && setSampleModalOpen(false)}>
                    <DialogContent className="max-w-[380px] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogHeader className="border-b border-slate-100 pb-3 dark:border-zinc-800">
                            <DialogTitle className="text-[16px] font-bold text-slate-800 dark:text-zinc-100">Log Sample Request</DialogTitle>
                        </DialogHeader>
                        <div className="pt-2 pb-2 flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Product</label>
                                <input type="text" value={sampleProduct} onChange={(e) => setSampleProduct(e.target.value)} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2.5 text-[13px] dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Note (optional)</label>
                                <textarea rows={3} value={sampleNote} onChange={(e) => setSampleNote(e.target.value)} className="w-full border border-slate-300 bg-white rounded-[6px] px-3 py-2.5 text-[13px] text-slate-700 resize-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                            <button onClick={() => setSampleModalOpen(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-bold dark:bg-zinc-900 dark:text-zinc-400">Cancel</button>
                            <button onClick={() => sampleMutation.mutate()} disabled={sampleMutation.isPending} className="px-6 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-[6px] text-[13px] font-bold disabled:opacity-60">{sampleMutation.isPending ? "Saving…" : "Submit"}</button>
                        </div>
                    </DialogContent>
                </Dialog>

            </div>

            {/* History Section */}
            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">History</h3>

                {/* Tabs */}
                <div className="flex border-b-[2px] border-slate-100 w-full overflow-x-auto select-none gap-6 px-1 dark:border-zinc-800">
                    {["Contact History", "Company History", "Quotation History", "Invoice History", "GM History", "Quotation Templates"].map(tab => (
                        <div
                            key={tab}
                            onClick={() => setActiveHistoryTab(tab)}
                            className={`pb-3 text-[13px] font-bold cursor-pointer whitespace-nowrap transition-colors -mb-[2px] ${activeHistoryTab === tab ? "text-[#475569] border-b-[2px] border-[#475569]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:border-b-[2px] border-transparent"}`}
                        >
                            {tab}
                        </div>
                    ))}
                </div>

                <div className="overflow-x-auto mt-4">
                    {activeHistoryTab === "Contact History" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-48 dark:text-zinc-400">Date</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Note</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-32 dark:text-zinc-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isContactLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">Loading contact history...</TableCell>
                                    </TableRow>
                                ) : contactHistory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No contact history recorded.</TableCell>
                                    </TableRow>
                                ) : (
                                    contactHistory.map((item: any) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</TableCell>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{item.notes || item.method || "-"}</TableCell>
                                            <TableCell className="py-3">
                                                <button
                                                    onClick={() => setActiveCardModal('followup')}
                                                    className="px-3 py-1 border border-slate-300 rounded-[6px] text-[12px] font-bold text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                                >
                                                    Edit
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Company History" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-48 dark:text-zinc-400">Title</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Detail</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-32 dark:text-zinc-400">Actin By</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-48 dark:text-zinc-400">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No company history recorded.</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Quotation History" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Date</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Grand Total</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isQuotationLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">Loading quotations...</TableCell>
                                    </TableRow>
                                ) : quotationHistory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No quotations recorded.</TableCell>
                                    </TableRow>
                                ) : (
                                    quotationHistory.map((q: any) => (
                                        <TableRow key={q.id}>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{q.createdAt ? new Date(q.createdAt).toLocaleString() : "-"}</TableCell>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{q.grandTotal ?? q.totalAmount ?? "-"}</TableCell>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{q.saveStatus ?? "Saved"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "GM History" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Date</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Order ID</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Package</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isGmLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">Loading GM history...</TableCell>
                                    </TableRow>
                                ) : gmHistory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No GM history found.</TableCell>
                                    </TableRow>
                                ) : (
                                    gmHistory.map((gm: any) => (
                                        <TableRow key={gm.id}>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{gm.createdAt ? new Date(gm.createdAt).toLocaleString() : "-"}</TableCell>
                                            <TableCell className="font-mono text-[12px] py-3 text-slate-600 dark:text-zinc-300">{gm.orderId || "-"}</TableCell>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{gm.package || "-"}</TableCell>
                                            <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{gm.status || "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Quotation Templates" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Title</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Sub Total</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Discount</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Total</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Pay First</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Make By</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Date</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-[13px] font-medium text-slate-500 border-b-0 dark:text-zinc-400">No quotation templates available.</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Invoice History" && (
                        <div className="overflow-x-auto">
                            {isInvoiceLoading ? (
                                <div className="py-8 text-center text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                                    Loading invoice history...
                                </div>
                            ) : invoiceHistory.length === 0 ? (
                                <div className="py-8 text-center text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                                    No invoices recorded.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Invoice ID</TableHead>
                                            <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Type</TableHead>
                                            <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Amount</TableHead>
                                            <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {invoiceHistory.map((inv: any) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">
                                                    {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : "-"}
                                                </TableCell>
                                                <TableCell className="font-mono text-[12px] py-3 text-slate-600 dark:text-zinc-300">{inv.id.substring(0, 8)}</TableCell>
                                                <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{inv.invoiceType || inv.projectName || "-"}</TableCell>
                                                <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{inv.amount ? `$${inv.amount}` : "0"}</TableCell>
                                                <TableCell className="text-[12px] py-3 text-slate-600 dark:text-zinc-300">{inv.status}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    )}
                </div>
            </div>
            </>
            )}
        </div>
    );
}

function QuotationTemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col bg-slate-50 overflow-hidden gap-0 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-row items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[18px] font-bold text-slate-800 dark:text-zinc-100">Quotation Template Detail</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-6xl mx-auto flex flex-col gap-6">

                        {/* Client Details Card */}
                        <div className="bg-white p-5 md:p-6 rounded-[10px] shadow-sm border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="text-[14px] font-bold text-slate-700 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2 dark:border-zinc-800 dark:text-zinc-400">
                                <User className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                Client Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Quotation Date</label>
                                    <input type="text" defaultValue="04-01-26" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Company Name</label>
                                    <input type="text" defaultValue="Al khar store" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Contact</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Account Holder</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Email</label>
                                    <input type="text" defaultValue="null" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                            </div>
                        </div>

                        {/* Order Grid Card */}
                        <div className="flex flex-col lg:flex-row gap-6">

                            <div className="flex-1 w-full bg-white p-5 md:p-6 rounded-[10px] shadow-sm border border-slate-200 relative overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-slate-700 flex items-center gap-2 dark:text-zinc-400">
                                        <Archive className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                        Products & Services
                                    </h3>
                                    <button className="bg-[#059669] text-white px-3.5 py-1.5 rounded-[6px] text-[12px] font-semibold hover:bg-[#047857] transition-colors flex items-center gap-1.5 shadow-sm">
                                        <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add Row
                                    </button>
                                </div>

                                <div className="w-full overflow-x-auto">
                                    <div className="min-w-[750px] pb-4">
                                        {/* Headers */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-3 bg-slate-50 p-3 rounded-[6px] border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight dark:text-zinc-300">Product</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight dark:text-zinc-300">Detail</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right dark:text-zinc-300">Unit Price</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right dark:text-zinc-300">Quantity</div>
                                            <div className="font-bold text-slate-600 text-[12px] uppercase tracking-tight text-right dark:text-zinc-300">Total</div>
                                        </div>

                                        {/* Row 1 */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-4 items-start p-1">
                                            <div>
                                                <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-700 shadow-sm cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                                    <option>Alibaba Product Posting</option>
                                                </select>
                                            </div>
                                            <div>
                                                <textarea defaultValue="product posting 200 per month" rows={2} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white resize-none text-slate-700 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="200" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right text-slate-700 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="1" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right text-slate-700 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                            </div>
                                            <div>
                                                <input type="text" defaultValue="200.00" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] bg-slate-50 text-slate-500 focus:outline-none font-bold text-right cursor-not-allowed shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" readOnly />
                                            </div>
                                        </div>

                                        {/* Row 2 */}
                                        <div className="grid grid-cols-[200px_minmax(220px,1fr)_100px_100px_120px] gap-4 mb-4 items-start p-1 relative">
                                            <div>
                                                <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-400 shadow-sm cursor-pointer dark:bg-zinc-900 dark:border-zinc-800">
                                                    <option>~~SELECT~~</option>
                                                </select>
                                            </div>
                                            <div>
                                                <textarea rows={2} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white resize-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                            </div>
                                            <div>
                                                <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                            </div>
                                            <div>
                                                <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                            </div>
                                            <div>
                                                <input type="text" placeholder="0.00" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] bg-slate-50 text-slate-400 focus:outline-none font-bold text-right cursor-not-allowed shadow-sm dark:bg-zinc-900 dark:border-zinc-800" readOnly />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Footers embedded under products */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 pt-6 border-t border-slate-100 dark:border-zinc-800">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Note</label>
                                        <textarea rows={4} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-slate-50 hover:bg-white resize-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800" placeholder="Add additional terms, history, or notes here..."></textarea>
                                    </div>
                                    <div className="flex flex-col gap-1.5 md:pl-4">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Delivery Time</label>
                                        <div className="relative w-full md:w-48">
                                            <input type="text" defaultValue="15" className="w-full border border-slate-200 rounded-[6px] pl-3 pr-10 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm font-medium dark:bg-zinc-900 dark:border-zinc-800" />
                                            <span className="absolute right-3 top-2.5 text-[11px] font-bold text-slate-400">DAYS</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Totals Sidebar */}
                            <div className="w-full lg:w-[320px] shrink-0 bg-white shadow-sm rounded-[10px] border border-slate-200 p-6 flex flex-col gap-4 h-fit dark:bg-zinc-900 dark:border-zinc-800">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-1 border-b border-slate-100 pb-3 flex items-center gap-2 dark:border-zinc-800 dark:text-zinc-400">
                                    <FileText className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                    Order Summary
                                </h3>

                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Sub Amount</span>
                                    <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">200.00</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">GST 18%</span>
                                    <input type="text" defaultValue="0" className="w-20 border border-slate-200 rounded-[6px] px-2 py-1.5 text-[13px] font-medium text-right focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-slate-50 hover:bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800" />
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1 dark:border-zinc-800">
                                    <span className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Total Amount</span>
                                    <span className="text-[14px] font-bold text-slate-800 dark:text-zinc-100">200.00</span>
                                </div>

                                <div className="mt-3 flex flex-col gap-3 bg-emerald-50/50 p-4 rounded-[8px] border border-emerald-100/60">
                                    <span className="text-[11px] font-bold text-[#059669] uppercase tracking-wider dark:text-zinc-400">Discount Module</span>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-1.5 text-[12px] text-slate-700 font-semibold cursor-pointer dark:text-zinc-400">
                                            <input type="radio" name="discount_type" className="accent-[#059669] w-3.5 h-3.5" /> % Percentage
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[12px] text-slate-700 font-semibold cursor-pointer dark:text-zinc-400">
                                            <input type="radio" name="discount_type" defaultChecked className="accent-[#059669] w-3.5 h-3.5" /> Fixed
                                        </label>
                                    </div>
                                    <div className="flex mt-1">
                                        <input type="text" defaultValue="26400" className="w-full border border-emerald-200 rounded-[6px] px-3 py-2 text-[14px] font-bold text-right text-emerald-900 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900" />
                                    </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-100 pt-5 mt-2 dark:border-zinc-800">
                                    <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Grand Total</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 mb-0.5">USD</span>
                                        <span className="text-[20px] font-black text-[#059669] leading-none dark:text-zinc-400">106.38</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-5 dark:border-zinc-800">
                                    <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">PKR Total</span>
                                    <span className="text-[14px] font-bold text-slate-400">Rs 17,021.28</span>
                                </div>

                                {/* Extra settings */}
                                <div className="flex items-center justify-between mt-1 gap-2">
                                    <span className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">-</span>
                                    <input type="text" defaultValue="18" className="w-16 border border-slate-200 rounded-[6px] px-2 py-1.5 text-[12px] font-medium text-right focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                </div>
                                <div className="flex items-center justify-between mt-2 gap-2">
                                    <span className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Payment Term %</span>
                                    <select className="flex-1 max-w-[120px] border border-slate-200 rounded-[6px] px-2 py-1.5 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-600 shadow-sm font-medium cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <option>~~SELECT~~</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 gap-2 dark:border-zinc-800">
                                    <span className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Amount Sent</span>
                                    <span className="text-[14px] font-bold text-slate-400">0.00</span>
                                </div>

                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-100 gap-2 dark:border-zinc-800">
                                    <span className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">Save Quotation</span>
                                    <select className="w-24 border border-slate-200 rounded-[6px] px-2 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-[#059669] font-bold shadow-sm cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                        <option>No</option>
                                        <option>Yes</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2 mt-4 pt-1">
                                    <button className="w-full bg-[#059669] hover:bg-[#047857] text-white px-4 py-3 rounded-[6px] text-[13px] font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]">Save Changes</button>
                                    <button onClick={onClose} className="w-full bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-[6px] text-[13px] font-bold hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">Discard Changes</button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


export function AttributeActionModal({ type, onClose, customerId, companyName }: { type: string | null; onClose: () => void; customerId?: string; companyName?: string }) {
    if (!type) return null;

    if (type === 'followup') return <FollowupModal open={true} onClose={onClose} customerId={customerId} companyName={companyName} />;
    if (type === 'invoice') {
        return (
            <Dialog open={true} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-[390px] w-[95vw] bg-white border-slate-200 p-8 shadow-xl rounded-[12px] !gap-0 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="flex gap-4 items-start font-sans">
                        <div className="shrink-0 flex items-center justify-center w-11 h-11 rounded-full border-[3.5px] border-[#dea94c] mt-1 mr-1 dark:border-zinc-800">
                            <span className="text-[#dea94c] font-black text-[22px] shrink-0 font-serif transform -translate-y-[1px]">!</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-[20px] font-bold text-[#555] dark:text-zinc-100">Access Denied</h2>
                            <p className="text-[17px] leading-[1.4] text-[#555] opacity-90 break-words tracking-tight dark:text-zinc-100">
                                You are not allowed to create an invoice through this role. Kindly contact the Accounts Department for further assistence.
                            </p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }


    if (type === 'gmbv') {
        return (
            <Dialog open={true} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-[400px] w-[95vw] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader className="border-b border-slate-100 pb-3 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-bold text-[#334155] dark:text-zinc-100">User GM BV Submit Date</DialogTitle>
                    </DialogHeader>
                    <div className="pt-2 pb-2 flex flex-col gap-4 font-sans px-1">
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Packge</label>
                            <input type="text" className="w-full border border-slate-200 bg-[#f1f5f9] rounded-[6px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-800 dark:border-zinc-800" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Status</label>
                            <input type="text" className="w-full border border-slate-200 bg-[#f1f5f9] rounded-[6px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-800 dark:border-zinc-800" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">User GM BV Submit Date</label>
                            <input type="date" className="w-full border border-slate-300 bg-white rounded-[6px] px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100 px-1 dark:border-zinc-800">
                        <button onClick={onClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors dark:bg-zinc-900 dark:text-zinc-400">Cancel</button>
                        <button onClick={onClose} className="px-6 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-[6px] text-[13px] font-bold shadow-sm transition-colors">Submit</button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }


    if (type === 'gmdoc') {
        return (
            <Dialog open={true} onOpenChange={(val) => !val && onClose()}>
                <DialogContent className="max-w-[440px] w-[95vw] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader className="border-b border-slate-100 pb-3 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-bold text-[#334155] dark:text-zinc-100">GM Doc</DialogTitle>
                    </DialogHeader>
                    <div className="pt-2 pb-2 flex flex-col gap-4 font-sans px-1 h-auto max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Packge</label>
                            <input type="text" className="w-full border border-slate-200 bg-[#f1f5f9] rounded-[6px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-800 dark:border-zinc-800" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Status</label>
                            <input type="text" className="w-full border border-slate-200 bg-[#f1f5f9] rounded-[6px] px-3 py-2.5 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-800 dark:border-zinc-800" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">GM Date</label>
                            <input type="date" className="w-full border border-slate-300 bg-white rounded-[6px] px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Note</label>
                            <textarea rows={3} className="w-full border border-slate-300 bg-white rounded-[6px] px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm resize-none dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"></textarea>
                        </div>
                        <div className="flex flex-col gap-3 mt-1">
                            <label className="text-[13px] font-semibold text-[#4b5563] dark:text-zinc-400">Please check the Relevant Doc which is submitted in GM BV</label>
                            <div className="flex flex-col gap-2.5 pl-1">
                                {['NTN', 'Latest 181 Form', 'ID card', 'Bank Statement', 'Phone bill', 'Deed (If company have partner)'].map(doc => (
                                    <label key={doc} className="flex items-center gap-2.5 cursor-pointer group">
                                        <input type="checkbox" className="w-4 h-4 rounded-[4px] border-slate-300 text-[#059669] focus:ring-[#059669] accent-[#059669] cursor-pointer dark:border-zinc-800 dark:text-zinc-400" />
                                        <span className="text-[13px] text-[#4b5563] font-medium dark:text-zinc-400">{doc}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100 px-1 dark:border-zinc-800">
                        <button onClick={onClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors dark:bg-zinc-900 dark:text-zinc-400">Cancel</button>
                        <button onClick={onClose} className="px-6 py-2 bg-[#059669] hover:bg-[#047857] text-white rounded-[6px] text-[13px] font-bold shadow-sm transition-colors">Submit</button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const titles: Record<string, string> = {
        followup: 'Add Followup',
        gmdoc: 'Upload GM Doc',
        gmbv: 'Submit GM BV',
        update_expiry: 'Update Expiry Dates'
    };

    return (
        <Dialog open={!!type} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-md w-[95vw] bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="border-b border-slate-100 pb-4 dark:border-zinc-800">
                    <DialogTitle className="text-[16px] font-bold text-slate-800 dark:text-zinc-100">{titles[type] || 'Action'}</DialogTitle>
                </DialogHeader>
                <div className="pt-2 pb-2">
                    <div className="text-[13px] text-slate-500 mb-6 bg-slate-50 border border-slate-100 p-4 rounded-[6px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                        The dynamic form for <b>{titles[type]}</b> will be injected here per your detailed specifications.
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                        <button onClick={onClose} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors dark:bg-zinc-900 dark:text-zinc-400">Cancel Operations</button>
                        <button onClick={onClose} className="px-4 py-2.5 bg-[#059669] hover:bg-[#047857] text-white rounded-[6px] text-[13px] font-bold shadow-sm transition-colors block">Configure Details</button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


const RESERVATION_OPTIONS = [
    { value: "MOBILE", label: "Mobile" },
    { value: "W_CALL", label: "W-Call" },
    { value: "ON_SITE_APPOINTMENT", label: "On-Site Appointment" },
    { value: "E_MAIL", label: "E-mail" },
    { value: "VM_APPOINTMENT", label: "Vm Appointment" },
    { value: "FAX", label: "Fax" },
    { value: "NO_NEED", label: "No Need" },
];

export function FollowupModal({ open, onClose, customerId, companyName }: { open: boolean; onClose: () => void; customerId?: string; companyName?: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: servicesRes } = useQuery<{ success: boolean; items: FollowupServiceOption[] }>({
        queryKey: ["/api/sales/services"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/services");
            return res.json();
        },
        enabled: open,
    });
    const followupServices = servicesRes?.items || [];

    const [selectedServiceCodes, setSelectedServiceCodes] = useState<Set<string>>(new Set());
    const [selectedSubservices, setSelectedSubservices] = useState<Record<string, Set<string>>>({});
    const [subserviceDetails, setSubserviceDetails] = useState<Record<string, SubserviceDetail>>({});
    const [reservationType, setReservationType] = useState("");
    const [note, setNote] = useState("");
    const [nextDate, setNextDate] = useState("");

    const resetForm = () => {
        setSelectedServiceCodes(new Set());
        setSelectedSubservices({});
        setSubserviceDetails({});
        setReservationType("");
        setNote("");
        setNextDate("");
    };

    const handleToggleService = (serviceId: string, checked: boolean) => {
        const svc = followupServices.find((s) => s.id === serviceId);
        const serviceCode = svc ? normalizeCode(svc.code) : null;
        if (!serviceCode) return;
        setSelectedServiceCodes((prev) => {
            const next = new Set(prev);
            if (checked) next.add(serviceCode);
            else next.delete(serviceCode);
            return next;
        });
        if (!checked) {
            setSelectedSubservices((prev) => {
                const next = { ...prev };
                delete next[serviceCode];
                return next;
            });
            setSubserviceDetails((prev) => {
                const next = { ...prev };
                (svc?.subServices || []).forEach((sub) => { delete next[sub.id]; });
                return next;
            });
        }
    };

    const handleToggleSubservice = (serviceId: string, subserviceId: string, checked: boolean) => {
        const svc = followupServices.find((s) => s.id === serviceId);
        const serviceCode = svc ? normalizeCode(svc.code) : null;
        if (!serviceCode) return;
        if (checked) {
            setSelectedServiceCodes((prev) => {
                const next = new Set(prev);
                next.add(serviceCode);
                return next;
            });
        }
        setSelectedSubservices((prev) => {
            const next = { ...prev };
            const current = new Set(next[serviceCode] ?? []);
            if (checked) current.add(subserviceId);
            else current.delete(subserviceId);
            if (current.size > 0) next[serviceCode] = current;
            else delete next[serviceCode];
            return next;
        });
        if (!checked) {
            setSubserviceDetails((prev) => {
                const next = { ...prev };
                delete next[subserviceId];
                return next;
            });
        }
    };

    const handleUpdateDetail = (subId: string, patch: Partial<SubserviceDetail>) => {
        setSubserviceDetails((prev) => ({ ...prev, [subId]: { ...(prev[subId] || {}), ...patch } }));
    };

    const followupMutation = useMutation({
        mutationFn: () => {
            const subIdToMeta = new Map<string, { serviceId: string; subCode: string; serviceCode: string }>();
            followupServices.forEach((svc) => {
                const svcCode = normalizeCode(svc.code);
                svc.subServices?.forEach((sub) => {
                    subIdToMeta.set(sub.id, { serviceId: svc.id, subCode: normalizeCode(sub.code), serviceCode: svcCode });
                });
            });

            const subServicesPayload: Record<string, string[]> = {};
            Object.entries(selectedSubservices).forEach(([serviceCode, set]) => {
                if (!selectedServiceCodes.has(serviceCode)) return;
                const codes = Array.from(set)
                    .map((subId) => subIdToMeta.get(subId))
                    .filter((meta): meta is { serviceId: string; subCode: string; serviceCode: string } => Boolean(meta))
                    .map((meta) => meta.subCode);
                if (codes.length) subServicesPayload[serviceCode] = Array.from(new Set(codes));
            });

            const detailPayloads: any[] = [];
            Object.entries(selectedSubservices).forEach(([serviceCode, set]) => {
                if (!selectedServiceCodes.has(serviceCode)) return;
                set.forEach((subId) => {
                    const meta = subIdToMeta.get(subId);
                    if (!meta) return;
                    const detail = subserviceDetails[subId] || {};
                    const purpose = detail.purpose ?? "";
                    const grade = detail.grade ?? "";
                    const method = detail.method ?? "";
                    const comment = detail.comment ?? "";
                    const noteValue = detail.note ?? comment ?? "Note";
                    if ([purpose, grade, method, comment, noteValue].every((v) => !v)) return;
                    detailPayloads.push({
                        serviceCode: meta.serviceCode,
                        subServiceCode: meta.subCode,
                        serviceId: meta.serviceId,
                        subServiceId: subId,
                        purpose,
                        grade,
                        method,
                        comment,
                        note: noteValue,
                        dateTime: detail.date ? new Date(detail.date).toISOString() : "",
                        talkTimeMinutes: method ? detail.talkTimeMinutes ?? null : null,
                        attachments: detail.attachments ?? [],
                    });
                });
            });

            return apiRequest("POST", "/api/sales/followups", {
                customerId,
                services: Array.from(selectedServiceCodes),
                subServices: subServicesPayload,
                subServiceDetails: detailPayloads,
                reservationType: reservationType || undefined,
                note: note || undefined,
                nextDate: nextDate || undefined,
            });
        },
        onSuccess: async () => {
            toast({ title: "Follow-up logged" });
            if (customerId) {
                await queryClient.invalidateQueries({ queryKey: [`/api/sales/customers/${customerId}/followups`] });
            }
            resetForm();
            onClose();
        },
        onError: async (err: any) => {
            const message = typeof err?.message === "string" ? err.message : "Failed to log follow-up";
            toast({ title: "Failed to log follow-up", description: message, variant: "destructive" });
        },
    });

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[1200px] w-[98vw] max-h-[92vh] p-0 flex flex-col bg-white overflow-hidden gap-0 border-slate-200 shadow-2xl rounded-xl dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[18px] font-bold text-slate-700 dark:text-zinc-400">Follow The Customer</DialogTitle>
                    {companyName && <p className="text-[13px] text-slate-400">{companyName}</p>}
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="mx-auto flex flex-col gap-6">

                        <FollowCustomerServicesPanel
                            services={followupServices}
                            selectedServiceCodes={selectedServiceCodes}
                            selectedSubservices={selectedSubservices}
                            subserviceDetails={subserviceDetails}
                            onToggleService={handleToggleService}
                            onToggleSubservice={handleToggleSubservice}
                            onUpdateDetail={handleUpdateDetail}
                        />

                        {/* Reservation / Method */}
                        <div className="bg-white p-5 rounded-[10px] shadow-sm border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="flex flex-col gap-1.5 w-full md:w-1/2">
                                <label className="text-[13px] font-bold text-[#059669] dark:text-zinc-400">Reservation:</label>
                                <select
                                    value={reservationType}
                                    onChange={(e) => setReservationType(e.target.value)}
                                    className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:text-zinc-300 dark:border-zinc-800"
                                >
                                    <option value="">Select Reservation</option>
                                    {RESERVATION_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Next Date & Note */}
                        <div className="bg-white p-5 rounded-[10px] shadow-sm border border-slate-200 flex flex-col gap-4 dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-[#059669] dark:text-zinc-400">Next Date:</label>
                                <input
                                    type="datetime-local"
                                    value={nextDate}
                                    onChange={(e) => setNextDate(e.target.value)}
                                    className="w-full md:w-1/2 border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-[#059669] dark:text-zinc-400">Note:</label>
                                <textarea
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-600 resize-y focus:outline-none focus:border-[#059669] dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="mt-1">
                            <button
                                onClick={() => followupMutation.mutate()}
                                disabled={!customerId || selectedServiceCodes.size === 0 || followupMutation.isPending}
                                className="w-full bg-[#059669] hover:bg-[#047857] text-white py-3 rounded-[6px] text-[14px] font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-60"
                            >
                                {followupMutation.isPending ? "Submitting..." : "Submit"}
                            </button>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}



export function EditCompanyModal({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: profileData, isLoading } = useQuery<any>({
        queryKey: [`/api/sales/leads/${customerId}/profile`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/leads/${customerId}/profile`);
            return response.json();
        },
        enabled: !!customerId,
    });

    const mutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("PATCH", `/api/sales/leads/${customerId}`, payload);
            if (!res.ok) throw new Error("Failed to update company");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sales/lead-pools/list"] });
            queryClient.invalidateQueries({ queryKey: [`/api/sales/leads/${customerId}/profile`] });
            toast({ title: "Company updated successfully" });
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Failed to update", description: err.message, variant: "destructive" });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const payload = {
            companyName: formData.get("companyName"),
            accountName: formData.get("accountName"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            mobile: formData.get("mobile"),
            website: formData.get("website"),
            address: formData.get("address"),
            comment: formData.get("comment"),
            country: formData.get("country"),
            city: formData.get("city"),
            title: formData.get("title"),
            companyType: formData.get("companyType"),
        };
        mutation.mutate(payload);
    };

    if (!customerId) return null;

    const lead = profileData?.lead || {};

    return (
        <Dialog open={!!customerId} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[750px] w-[95vw] h-[90vh] bg-[#f8fafc] border-slate-200 p-0 flex flex-col overflow-hidden shadow-2xl rounded-[12px] dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex-1 overflow-y-auto w-full">
                    <form onSubmit={handleSubmit} className="w-full flex flex-col p-6 md:p-8 gap-8">

                        <div className="flex-1 flex flex-col bg-white p-6 rounded-[10px] shadow-sm border border-slate-200 h-fit dark:bg-zinc-900 dark:border-zinc-800">
                            <h2 className="text-[16px] font-bold text-slate-700 mb-6 font-sans dark:text-zinc-400">Edit Company Detail</h2>

                            {isLoading ? (
                                <div className="py-20 text-center text-slate-500 font-medium">Loading details...</div>
                            ) : (
                                <>
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Company name <span className="text-red-500">*</span></label>
                                        <input type="text" name="companyName" defaultValue={lead.companyName || ""} className="w-full border border-slate-200 bg-slate-50/50 dark:bg-zinc-900 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Country /Region <span className="text-red-500">*</span></label>
                                        <select name="country" defaultValue={lead.country || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option value="">Choose...</option>
                                            <option value="Pakistan">Pakistan</option>
                                            <option value="USA">USA</option>
                                            <option value="UAE">UAE</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Company type</label>
                                        <input type="text" name="companyType" defaultValue={lead.companyType || ""} placeholder="e.g. Finances & Insurance" className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                </div>

                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">City <span className="text-red-500">*</span></label>
                                        <input type="text" name="city" defaultValue={lead.city || ""} placeholder="e.g. Abu Dhabi" className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Landline No <span className="text-slate-400 font-normal ml-0.5">(+971-X-XXXXXXX)</span></label>
                                        <input type="text" name="phone" defaultValue={lead.phone || ""} placeholder="Enter phone number" className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Mobile No <span className="text-slate-400 font-normal ml-0.5">(+971-XX-1234567)</span></label>
                                        <input type="text" name="mobile" defaultValue={(lead as any).mobile || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                </div>

                                <h3 className="text-[15px] font-bold text-slate-700 mb-4 font-sans pb-1 dark:text-zinc-400">Primary Detail</h3>

                                {/* Row 3 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Title</label>
                                        <select name="title" defaultValue={lead.title || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option value="">Choose...</option>
                                            <option value="Mr.">Mr.</option>
                                            <option value="Mrs.">Mrs.</option>
                                            <option value="Ms.">Ms.</option>
                                            <option value="Dr.">Dr.</option>
                                            <option value="M/S">M/S</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Person Full Name</label>
                                        <input type="text" name="accountName" defaultValue={lead.accountName || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                </div>

                                {/* Row 4 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Website</label>
                                        <input type="text" name="website" defaultValue={lead.website || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Email <span className="text-red-500">*</span></label>
                                        <input type="text" name="email" defaultValue={lead.email || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Address</label>
                                        <input type="text" name="address" defaultValue={lead.address || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                </div>

                                {/* Row 5 */}
                                <div className="flex flex-col gap-1.5 mb-6">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Your Comment</label>
                                    <textarea name="comment" rows={2} defaultValue={lead.comment || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm resize-none dark:bg-zinc-900 dark:border-zinc-800"></textarea>
                                </div>

                                {/* Submit */}
                                <div>
                                    <button type="submit" disabled={mutation.isPending} className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-2.5 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors disabled:opacity-50">
                                        {mutation.isPending ? "Saving..." : "Submit form"}
                                    </button>
                                </div>
                                </>
                            )}
                        </div>

                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}


// Force HMR Trigger

export function DuplicateCompaniesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[500px] w-[95vw] bg-white border-slate-200 shadow-2xl rounded-[12px] p-0 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="p-5 border-b border-slate-100 bg-[#f8fafc] dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[17px] font-bold text-slate-700 dark:text-zinc-400">Duplicate Check</DialogTitle>
                </DialogHeader>
                <div className="p-8 text-center flex flex-col items-center justify-center min-h-[220px]">
                    <div className="w-14 h-14 bg-[#059669]/10 rounded-full flex items-center justify-center mb-5 shadow-sm">
                        <Search className="w-6 h-6 text-[#059669] dark:text-zinc-400" />
                    </div>
                    <h3 className="text-[16px] font-bold text-slate-800 mb-2 dark:text-zinc-100">No Duplicates Detected</h3>
                    <p className="text-[13px] text-slate-500 max-w-[340px] leading-relaxed dark:text-zinc-400">Our system has scanned the active companies index and confirmed this profile is unique. No conflicts require resolution.</p>
                    <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-bold rounded shadow-sm transition-colors dark:bg-zinc-900 dark:text-zinc-400">Close</button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
