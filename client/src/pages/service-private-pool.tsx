import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { User, Mail, MessageCircle, Eye, Archive, Link as LinkIcon, Edit2, ArrowRight, ArrowLeft, UserPlus, FileText, Cloud, Search, Phone, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function ServicePrivatePool() {
    const [searchCustomer, setSearchCustomer] = useState("");
    const [teamCustomer, setTeamCustomer] = useState("");
    const [modalType, setModalType] = useState<string | null>(null);
    const [serviceFilter, setServiceFilter] = useState<string>("all");
    const [gradeFilter, setGradeFilter] = useState<string>("all");
    const [activeCustomerAction, setActiveCustomerAction] = useState<string | null>(null);
    const [isCreateQuotationOpen, setCreateQuotationOpen] = useState(false);
    const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
    const [isDuplicateModalOpen, setDuplicateModalOpen] = useState(false);

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

    const { data: listData, isFetching: isLoadingList } = useQuery<any>({
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
    });

    const displayData = listData?.items || [];

    if (activeCustomerAction) {
        return <CustomerAttributeView customerId={activeCustomerAction as string} onBack={() => setActiveCustomerAction(null)} />;
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
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Company ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Co Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Acc Holder</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Email</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Contact No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">NTN/CINC</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Account Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingList ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">Loading...</TableCell>
                                </TableRow>
                            ) : displayData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">No customers found.</TableCell>
                                </TableRow>
                            ) : displayData.map((row: any) => (
                                <TableRow key={row.id} className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell className="pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                    <TableCell className="text-[12px] font-semibold text-slate-500 py-3 dark:text-zinc-400">{row.id.substring(0, 8)}</TableCell>
                                    <TableCell className="text-[12px] font-semibold text-slate-600 py-3 dark:text-zinc-300">{row.companyName}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.accountName || <div className="w-24 h-4 bg-slate-100 rounded blur-[2px] dark:bg-zinc-900"></div>}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.email || <div className="w-16 h-4 bg-slate-100 rounded blur-[2px] dark:bg-zinc-900"></div>}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.phone || <div className="w-20 h-5 bg-[#34d399]/30 rounded"></div>}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.ntnCnic || "null"}</TableCell>
                                    <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <div onClick={() => setActiveCustomerAction(row.id)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors tooltip"><User className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setModalType("email")} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Mail className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setModalType("whatsapp")} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><MessageCircle className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => { }} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Phone className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setCreateQuotationOpen(true)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Eye className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setModalType("archive")} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Archive className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => { }} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Database className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setModalType("link")} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><LinkIcon className="w-3.5 h-3.5" /></div>
                                            <div onClick={() => setEditCompanyId(row.id)} className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm"><Edit2 className="w-3.5 h-3.5" /></div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <CreateQuotationModal open={isCreateQuotationOpen} onClose={() => setCreateQuotationOpen(false)} />
            <EditCompanyModal customerId={editCompanyId} onClose={() => setEditCompanyId(null)} />
            <DuplicateCompaniesModal open={isDuplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} />
            {/* Template Modals */}
            <Dialog open={!!modalType} onOpenChange={(open) => !open && setModalType(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white gap-0 border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader className="p-5 border-b border-slate-100 dark:border-zinc-800">
                        <DialogTitle className="text-[20px] font-semibold text-[#475569] tracking-tight dark:text-zinc-400">
                            {modalType === "whatsapp" ? "Whats App Template" : modalType === "email" ? "Email Template" : modalType === "archive" ? "Archive Actions" : "Manage Links"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="p-6">

                        {(modalType === 'archive' || modalType === 'link') ? (
                            <div className="py-16 text-center">
                                <span className="w-16 h-16 rounded-full bg-[#059669]/10 mx-auto flex items-center justify-center mb-4">
                                    {modalType === 'archive' ? <Archive className="w-8 h-8 text-[#059669] dark:text-zinc-400" /> : <LinkIcon className="w-8 h-8 text-[#059669] dark:text-zinc-400" />}
                                </span>
                                <h3 className="text-[18px] font-bold text-slate-700 mb-2 dark:text-zinc-400">Coming Soon</h3>
                                <p className="text-[14px] text-slate-500 dark:text-zinc-400">The dynamic {modalType} dashboard will be placed here.</p>
                            </div>
                        ) : (
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
                                        {modalType === "whatsapp" && (
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="font-medium text-slate-500 py-6 dark:text-zinc-400">04</TableCell>
                                                <TableCell className="font-medium text-slate-500 py-6 dark:text-zinc-400">Ramzan Offer</TableCell>
                                                <TableCell className="text-slate-500 font-medium py-6 dark:text-zinc-400">Ramzan offer 50% off</TableCell>
                                                <TableCell className="text-right pr-6 py-6">
                                                    <button className="bg-[#059669] hover:bg-emerald-700 transition-colors text-white px-6 py-2 rounded text-[14px] font-bold">use</button>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        {modalType === "email" && (
                                            <TableRow className="border-b-0 hover:bg-slate-50/50">
                                                <TableCell className="font-medium text-slate-500 py-6 align-top dark:text-zinc-400">01</TableCell>
                                                <TableCell className="font-medium text-slate-500 py-6 align-top dark:text-zinc-400">Email</TableCell>
                                                <TableCell className="text-slate-500 font-medium py-6 align-top leading-relaxed dark:text-zinc-400">
                                                    Dear [Name], I hope this email finds you well.<br />
                                                    I am writing to extend an invitation<br />
                                                    to participate in a bet that I have proposed.
                                                </TableCell>
                                                <TableCell className="text-right pr-6 py-6 align-top">
                                                    <button className="bg-[#059669] hover:bg-emerald-700 transition-colors text-white px-5 py-2 rounded text-[14px] font-bold">Active</button>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FollowupListView({
    activeTracingTab,
    setActiveTracingTab,
    setActiveCustomerAction
}: {
    activeTracingTab: string;
    setActiveTracingTab: (val: string | null) => void;
    setActiveCustomerAction: (val: string | number | null) => void;
}) {
    const [cols, setCols] = useState({
        id: { label: "#", visible: true },
        company: { label: "Company", visible: true },
        serviceType: { label: "Service Type", visible: true },
        purpose: { label: "Purpose", visible: true },
        method: { label: "Method", visible: true },
        grade: { label: "Grade", visible: true },
        comment: { label: "Comment", visible: true },
        nextDate: { label: "Next Date", visible: true },
        note: { label: "Note", visible: true },
        addedBy: { label: "Added By", visible: true },
        date: { label: "Date", visible: true },
        action: { label: "Update Follow Up", visible: true },
    });

    const mockData = activeTracingTab === "ALIBABA MEMBERSHIP" ? [
        { id: 1, company: "Al khar store", serviceType: "GGS Digital", purpose: "New Sell", method: "Email", grade: "B+", comment: "Introduction Message", nextDate: "01-01-2026", note: "aaa", addedBy: "M. Shahbaz", date: "31-12-2025" },
        { id: 2, company: "Al khar store", serviceType: "GGS Digital", purpose: "New Sell", method: "Mobile", grade: "B+", comment: "Promotion Discussion", nextDate: "31-12-2025", note: "he is ready to buy", addedBy: "M. Shahbaz", date: "31-12-2025" }
    ] : [];

    const handleCopy = () => {
        if (mockData.length === 0) {
            alert("No data available to copy.");
            return;
        }
        const headers = Object.values(cols).filter(c => c.visible && c.label !== "Update Follow Up").map(c => c.label).join('\t');
        const text = headers + '\n' + mockData.map(d => Object.values(d).join('\t')).join('\n');
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard");
    };

    const handleExcel = () => {
        if (mockData.length === 0) {
            alert("No data available to export to Excel.");
            return;
        }
        const headers = Object.values(cols).filter(c => c.visible && c.label !== "Update Follow Up").map(c => c.label).join(',');
        const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + mockData.map(e => Object.values(e).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "followup_data.csv");
        document.body.appendChild(link);
        link.click();
    };

    const handlePDF = () => {
        window.print();
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            <button onClick={() => setActiveTracingTab(null)} className="flex items-center gap-2 mb-4 text-[#475569] font-bold text-[14px] uppercase tracking-tight hover:text-[#059669] transition-colors dark:text-zinc-400">
                <ArrowRight className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                {activeTracingTab} FOLLOWUP LIST
            </button>

            {/* Top Tabs */}
            <div className="flex w-full mb-6 rounded overflow-hidden shadow-sm">
                <div onClick={() => setActiveTracingTab("ALIBABA MEMBERSHIP")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "ALIBABA MEMBERSHIP" ? "bg-[#059669]" : "bg-[#34d399]"}`}>Alibaba Membership (1)</div>
                <div onClick={() => setActiveTracingTab("ALIBABA SERVICES")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "ALIBABA SERVICES" ? "bg-[#059669]" : "bg-[#f43f5e]"}`}>Alibaba Services (0)</div>
                <div onClick={() => setActiveTracingTab("DESIGN DEVELOPMENT")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors ${activeTracingTab === "DESIGN DEVELOPMENT" ? "bg-[#2563eb]" : "bg-[#60a5fa]"}`}>Design Development (0)</div>
                <div onClick={() => setActiveTracingTab("DOMAIN HOSTING")} className={`flex-1 py-3 text-center text-white text-[13px] font-bold cursor-pointer transition-colors bg-[#334155]`}>Domain Hosting (0)</div>
            </div>

            {/* Summaries (Only for Alibaba Membership 1 mockup) */}
            {activeTracingTab === "ALIBABA MEMBERSHIP" && (
                <>
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Service Type Summary</h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-[#059669] text-white text-[12px] font-medium rounded">All</span>
                            <span className="px-3 py-1 bg-white border border-[#059669] text-[#059669] text-[12px] font-medium rounded dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">GGS Digital (1)</span>
                        </div>
                    </div>
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-slate-600 mb-3 dark:text-zinc-300">Grade Summary</h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-[#1e293b] text-white text-[12px] font-medium rounded">All</span>
                            <span className="px-3 py-1 bg-white border border-slate-300 text-slate-600 text-[12px] font-medium rounded dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">B+ (1)</span>
                        </div>
                    </div>
                </>
            )}

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
                        <Input className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#d1fae5]/50">
                            <TableRow className="border-b border-slate-200 hover:bg-[#d1fae5]/50 dark:border-zinc-800">
                                {cols.id.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">#</TableHead>}
                                {cols.company.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Company</TableHead>}
                                {cols.serviceType.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Service Type</TableHead>}
                                {cols.purpose.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Purpose</TableHead>}
                                {cols.method.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Method</TableHead>}
                                {cols.grade.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Grade</TableHead>}
                                {cols.comment.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Comment</TableHead>}
                                {cols.nextDate.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Next Date</TableHead>}
                                {cols.note.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Note</TableHead>}
                                {cols.addedBy.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Added By</TableHead>}
                                {cols.date.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Date</TableHead>}
                                {cols.action.visible && <TableHead className="text-[12px] font-bold text-[#059669] py-4 whitespace-nowrap dark:text-zinc-400">Update Follow Up</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeTracingTab === "ALIBABA MEMBERSHIP" ? (
                                <>
                                    <TableRow className="hover:bg-slate-50/50">
                                        {cols.id.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">1</TableCell>}
                                        {cols.company.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Al khar store</TableCell>}
                                        {cols.serviceType.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">GGS Digital</TableCell>}
                                        {cols.purpose.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">New Sell</TableCell>}
                                        {cols.method.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Email</TableCell>}
                                        {cols.grade.visible && <TableCell className="py-4"><span className="bg-[#64748b] text-white px-2 py-0.5 rounded text-[11px] font-bold">B+</span></TableCell>}
                                        {cols.comment.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Introduction Message</TableCell>}
                                        {cols.nextDate.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">01-01-2026</TableCell>}
                                        {cols.note.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">aaa</TableCell>}
                                        {cols.addedBy.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">M. Shahbaz</TableCell>}
                                        {cols.date.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">31-12-2025</TableCell>}
                                        {cols.action.visible && (
                                            <TableCell className="py-4">
                                                <div onClick={() => { setActiveCustomerAction(1); setActiveTracingTab(null); }} className="w-6 h-6 rounded-full bg-[#059669] hover:bg-[#047857] transition-colors flex items-center justify-center text-white cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                    <TableRow className="hover:bg-slate-50/50 border-b-0">
                                        {cols.id.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">2</TableCell>}
                                        {cols.company.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Al khar store</TableCell>}
                                        {cols.serviceType.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">GGS Digital</TableCell>}
                                        {cols.purpose.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">New Sell</TableCell>}
                                        {cols.method.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Mobile</TableCell>}
                                        {cols.grade.visible && <TableCell className="py-4"><span className="bg-[#64748b] text-white px-2 py-0.5 rounded text-[11px] font-bold">B+</span></TableCell>}
                                        {cols.comment.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">Promotion Discussion</TableCell>}
                                        {cols.nextDate.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">31-12-2025</TableCell>}
                                        {cols.note.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">he is ready to buy</TableCell>}
                                        {cols.addedBy.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">M. Shahbaz</TableCell>}
                                        {cols.date.visible && <TableCell className="text-[12px] font-medium text-slate-500 py-4 dark:text-zinc-400">31-12-2025</TableCell>}
                                        {cols.action.visible && (
                                            <TableCell className="py-4">
                                                <div onClick={() => { setActiveCustomerAction(1); setActiveTracingTab(null); }} className="w-6 h-6 rounded-full bg-[#059669] hover:bg-[#047857] transition-colors flex items-center justify-center text-white cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                </>
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={Object.values(cols).filter(c => c.visible).length} className="text-center py-6 text-slate-500 text-[13px] font-medium border-b-0 dark:text-zinc-400">No companies found for this filter selection.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}

function CustomerAttributeView({ customerId, onBack }: { customerId: string; onBack: () => void }) {
    const [activeHistoryTab, setActiveHistoryTab] = useState("Contact History");
    const [isQuotationTemplateModalOpen, setQuotationTemplateModalOpen] = useState(false);
    const [activeCardModal, setActiveCardModal] = useState<string | null>(null);

    const { data: profileData, isLoading } = useQuery<any>({
        queryKey: [`/api/sales/leads/${customerId}/profile`],
        queryFn: async () => {
            const response = await apiRequest("GET", `/api/sales/leads/${customerId}/profile`);
            return response.json();
        },
        enabled: !!customerId,
    });

    const lead = profileData?.lead || {};
    const phones = profileData?.phones || [];
    const mainPhone = phones[0] || "No Phone";
    const grade = lead.grade || "-";
    const contactCount = profileData?.activities?.length || 0;
    const lastContact = profileData?.lastContactAt ? new Date(profileData.lastContactAt).toLocaleString() : "Never";

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen relative dark:bg-zinc-950">
            <QuotationTemplateModal open={isQuotationTemplateModalOpen} onClose={() => setQuotationTemplateModalOpen(false)} />
            <AttributeActionModal type={activeCardModal} onClose={() => setActiveCardModal(null)} />
            <button onClick={onBack} className="flex items-center gap-2 mb-4 text-[#475569] font-bold text-[14px] uppercase tracking-tight hover:text-[#059669] transition-colors dark:text-zinc-400">
                <ArrowLeft className="w-4 h-4 text-[#059669] dark:text-zinc-400" /> BACK TO PRIVATE POOL
            </button>
            <div className="mb-4 text-[#475569] font-bold text-[15px] uppercase tracking-tight dark:text-zinc-400">ATTRIBUTE</div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20 text-slate-500 font-medium">Loading profile...</div>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Column 1: Info */}
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 flex flex-col items-center dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-[#475569] mb-3 text-center w-full dark:text-zinc-400">{lead.companyName || "Unknown Company"}</h3>
                        <div className="bg-[#e2e8f0]/40 text-[#475569] border border-[#cbd5e1]/50 rounded-full w-[36px] h-[36px] flex items-center justify-center text-[12px] font-bold mb-4 dark:text-zinc-400 dark:border-zinc-800">{grade}</div>
                        <p className="text-[13px] font-bold text-[#475569] mb-1 dark:text-zinc-400">{lead.accountName || "Unknown Contact"}</p>
                        <p className="text-[13px] text-slate-400 mb-2">{lead.email || "No Email"}</p>
                        <div className="bg-[#059669] text-white px-5 py-1 rounded-[4px] text-[13px] font-bold mb-6">{mainPhone}</div>

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
                        <span onClick={() => setActiveCardModal('quotation')} className="bg-[#8b5cf6] hover:bg-[#7c3aed] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Quotation</span>
                        <span onClick={() => setActiveCardModal('invoice')} className="bg-[#6366f1] hover:bg-[#4f46e5] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Invoice</span>
                        <span onClick={() => setActiveCardModal('gmdoc')} className="bg-[#ef4444] hover:bg-[#dc2626] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm dark:bg-zinc-900 dark:hover:bg-zinc-800">Gm Doc</span>
                        <span onClick={() => setActiveCardModal('gmbv')} className="bg-[#d97706] hover:bg-[#b45309] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm dark:bg-zinc-900">Gm BV submit</span>
                        <span onClick={() => setActiveCardModal('update_expiry')} className="bg-[#3b82f6] hover:bg-[#2563eb] transition-colors text-white px-2 py-[2px] rounded-[3px] text-[12px] font-medium cursor-pointer shadow-sm">Update Expiry</span>
                    </div>
                </div>

                {/* Column 2: Expiry */}
                <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <h3 className="text-[14px] font-bold text-[#475569] mb-8 dark:text-zinc-400">Expiry Date</h3>

                    <div className="relative pl-7 space-y-12 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-0 before:w-px before:border-l-[1.5px] before:border-dashed before:border-slate-200">
                        {/* Domain */}
                        <div className="relative">
                            <div className="absolute -left-[32px] top-0 w-3 h-3 rounded-full border-[2.5px] border-slate-300 bg-white z-10 flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800"><div className="w-1 h-1 bg-slate-300 rounded-full" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <UserPlus className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                <span className="text-[13px] font-bold text-[#475569] dark:text-zinc-400">Domain</span>
                            </div>
                            <div className="flex gap-2 ml-6">
                                <span className="bg-[#1e293b] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium">Date</span>
                                <span className="bg-[#ef4444] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium dark:bg-zinc-900">Day Left</span>
                            </div>
                        </div>

                        {/* Ssl */}
                        <div className="relative">
                            <div className="absolute -left-[32px] top-0 w-3 h-3 rounded-full border-[2.5px] border-slate-300 bg-white z-10 flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800"><div className="w-1 h-1 bg-slate-300 rounded-full" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                <span className="text-[13px] font-bold text-[#475569] dark:text-zinc-400">Ssl</span>
                            </div>
                            <div className="flex gap-2 ml-6">
                                <span className="bg-[#1e293b] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium">Date</span>
                                <span className="bg-[#ef4444] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium dark:bg-zinc-900">Day Left</span>
                            </div>
                        </div>

                        {/* Hosting */}
                        <div className="relative">
                            <div className="absolute -left-[32px] top-0 w-3 h-3 rounded-full border-[2.5px] border-slate-300 bg-white z-10 flex items-center justify-center dark:bg-zinc-900 dark:border-zinc-800"><div className="w-1 h-1 bg-slate-300 rounded-full" /></div>
                            <div className="flex items-center gap-2 mb-2">
                                <Cloud className="w-4 h-4 text-[#059669] dark:text-zinc-400" />
                                <span className="text-[13px] font-bold text-[#475569] dark:text-zinc-400">Hosting</span>
                            </div>
                            <div className="flex gap-2 ml-6">
                                <span className="bg-[#1e293b] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium">Date</span>
                                <span className="bg-[#ef4444] text-white px-2.5 py-[2px] rounded-[3px] text-[11px] font-medium dark:bg-zinc-900">Day Left</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Column 3: Messaging & Duplicate */}
                <div className="flex flex-col gap-6">
                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Whatsapp Message</h3>
                        <div className="mb-4">
                            <label className="block text-[12px] font-medium text-slate-500 mb-1 dark:text-zinc-400">Message:</label>
                            <textarea id="wa-msg" className="w-full text-[13px] text-[#475569] p-3 border border-slate-200 rounded-[5px] min-h-[80px] focus:outline-none focus:border-[#059669] resize-none dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                        <button onClick={() => { const ta = document.getElementById('wa-msg') as HTMLTextAreaElement; if (ta) { alert('WhatsApp message prepared: ' + ta.value); ta.value = ''; } }} className="bg-[#059669] hover:bg-emerald-700 transition-colors text-white px-4 py-[6px] rounded-[4px] text-[13px] font-bold w-fit shadow-sm">Whatsapp</button>
                    </div>

                    <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 flex-1 flex flex-col justify-center relative dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[14px] font-bold text-[#475569] mb-4 dark:text-zinc-400">Duplicate Company Details</h3>
                        <div className="w-full">
                            <button onClick={() => setDuplicateModalOpen(true)} className="bg-[#059669] hover:bg-emerald-700 transition-colors text-white px-4 py-[8px] rounded-[4px] text-[13px] font-bold flex items-center gap-2 w-max shadow-sm">
                                <Search className="w-4 h-4 text-white" />
                                Find Duplicate Companies
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* History Section */}
            <div className="bg-white rounded-[10px] shadow-sm border border-slate-50 p-6 overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <h3 className="text-[15px] font-bold text-[#475569] mb-4 dark:text-zinc-400">History</h3>

                {/* Tabs */}
                <div className="flex border-b-[2px] border-slate-100 w-full overflow-x-auto select-none gap-6 px-1 dark:border-zinc-800">
                    {["Contact History", "Company History", "Quotation History", "Invoice History", "Quotation Templates"].map(tab => (
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
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-32 dark:text-zinc-400">CM</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-48 dark:text-zinc-400">Next CD</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 w-32 dark:text-zinc-400">Next CM</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">31-12-2025 10:23 PM</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">Email</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">01-01-2026 10:22 PM</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400"></TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">aaa</TableCell>
                                </TableRow>
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
                                <TableRow className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Follow Up</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">Follow up with multiple services: Alibaba Membership. Notes: aaa</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">31-12-2025 10:23 PM</TableCell>
                                </TableRow>
                                <TableRow className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Grade Changed</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">Company Grade Change from To B+</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">31-12-2025 10:17 PM</TableCell>
                                </TableRow>
                                <TableRow className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Follow Up</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">Follow up with multiple services: Alibaba Membership. Notes: he is ready to buy</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">31-12-2025 10:17 PM</TableCell>
                                </TableRow>
                                <TableRow className="border-none hover:bg-slate-50/50">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Follow Up</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">Follow the customer by Mobile and user respose ghfjy</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">14-04-2025 06:10 PM</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Quotation History" && (
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] border-none dark:bg-zinc-800">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Date</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Sub Total</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Discount</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Total</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Pay First</TableHead>
                                    <TableHead className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Send By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow className="border-none hover:bg-slate-50/50">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">14-05-2025 03:36 PM</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">200</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">26400</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">106.383</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">100</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                </TableRow>
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
                                <TableRow className="border-none hover:bg-slate-50/50">
                                    <TableCell className="font-bold text-[#475569] text-[12px] py-4 dark:text-zinc-400">Alibaba Product Posting &</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">200</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">26400</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">106.383</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">100</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">M. Shahbaz</TableCell>
                                    <TableCell className="font-medium text-slate-500 text-[12px] py-4 dark:text-zinc-400">14-05-2025 03:36 PM</TableCell>
                                    <TableCell className="font-medium text-[#059669] text-[12px] py-4 dark:text-zinc-400">
                                        <div onClick={() => setQuotationTemplateModalOpen(true)} className="w-5 h-5 rounded-full border border-[#059669] flex items-center justify-center cursor-pointer hover:bg-emerald-50 transition-colors dark:border-zinc-800">
                                            <Eye className="w-3 h-3 text-[#059669] dark:text-zinc-400" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    )}

                    {activeHistoryTab === "Invoice History" && (
                        <div className="py-8 text-center text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                            No invoices recorded.
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


export function AttributeActionModal({ type, onClose }: { type: string | null; onClose: () => void }) {
    if (!type) return null;
    if (type === 'quotation') return <CreateQuotationModal open={true} onClose={onClose} />;

    if (type === 'followup') return <FollowupModal open={true} onClose={onClose} />;
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

export function CreateQuotationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[95vh] p-0 flex flex-col bg-slate-50 overflow-hidden gap-0 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-row items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[18px] font-bold text-slate-800 dark:text-zinc-100">Invoice Quotation <span className="text-[#059669] font-normal text-[15px] ml-2 dark:text-zinc-400">01-04-2026 10:03 PM</span></DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="mx-auto flex flex-col gap-6">

                        {/* Client Details */}
                        <div className="bg-white p-5 rounded-[10px] shadow-sm border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Account Holder</label>
                                    <input type="text" defaultValue="M.Ibrahim" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Company</label>
                                    <input type="text" defaultValue="Al khar store" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Email</label>
                                    <input type="text" defaultValue="null" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Contact</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                            </div>
                        </div>

                        {/* Order Grid */}
                        <div className="bg-white p-5 rounded-[10px] shadow-sm border border-slate-200 overflow-x-auto relative dark:bg-zinc-900 dark:border-zinc-800">
                            <div className="min-w-[1200px]">
                                {/* Headers */}
                                <div className="grid grid-cols-[140px_minmax(180px,1fr)_80px_80px_90px_80px_100px_100px_100px_120px_80px] gap-3 mb-3 bg-slate-50 p-3 rounded-[6px] border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Product <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Detail <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Min Time <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Max Time <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Unit Price <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Quantity <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Total</div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Start Year</div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">End Year <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] dark:text-zinc-300">Domain URL <span className="text-red-500">*</span></div>
                                    <div className="font-bold text-slate-600 text-[12px] text-center dark:text-zinc-300">Action</div>
                                </div>

                                {/* Row */}
                                <div className="grid grid-cols-[140px_minmax(180px,1fr)_80px_80px_90px_80px_100px_100px_100px_120px_80px] gap-3 mb-4 items-start p-1">
                                    <select className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-600 shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select</option>
                                    </select>
                                    <textarea rows={1} className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white resize-none shadow-sm h-[34px] dark:bg-zinc-900 dark:border-zinc-800" />
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-center shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-center shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-right shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-center shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] text-slate-500 focus:outline-none bg-slate-50 text-right shadow-sm cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" readOnly />
                                    <select className="w-full border border-slate-200 rounded-[6px] px-1 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-600 shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select Ye</option>
                                    </select>
                                    <select className="w-full border border-slate-200 rounded-[6px] px-1 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white text-slate-600 shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select Ye</option>
                                    </select>
                                    <input type="text" placeholder="Enter domain" className="w-full border border-slate-200 rounded-[6px] px-2 py-2 text-[12px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all bg-white shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    <button className="bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded-[6px] text-[12px] font-bold shadow-sm transition-colors w-full h-[34px]">Delete</button>
                                </div>

                                <button className="bg-[#059669] hover:bg-[#047857] text-white px-5 py-2 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors mt-2">Add Row</button>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="bg-white p-6 rounded-[10px] shadow-sm border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">

                            {/* Row 1 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Sub Amount <span className="text-red-500">*</span></label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Delivery Time <span className="text-red-500">*</span></label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                        <span className="text-slate-400 font-bold">---</span>
                                        <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">GST % <span className="text-red-500">*</span></label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Payment Term % <span className="text-red-500">*</span></label>
                                    <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all text-slate-600 shadow-sm cursor-pointer dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select</option>
                                    </select>
                                </div>
                            </div>

                            {/* Row 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Total Amount <span className="text-red-500">*</span></label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Amount <span className="text-red-500">*</span></label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-3">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Pkr Discount <span className="text-red-500">*</span></label>
                                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer dark:text-zinc-300"><input type="checkbox" className="accent-[#059669]" /> In Percentage</label>
                                        <label className="flex items-center gap-1 text-[11px] font-medium text-slate-600 cursor-pointer dark:text-zinc-300"><input type="checkbox" className="accent-[#059669]" /> In Amount</label>
                                    </div>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">$Grand Total</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                            </div>

                            {/* Row 3 */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Pkr Total</label>
                                    <input type="text" className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Save <span className="text-red-500">*</span></label>
                                    <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all text-slate-600 shadow-sm cursor-pointer dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5 md:col-span-2">
                                    <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Note</label>
                                    <textarea rows={2} className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm resize-none dark:border-zinc-800" />
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-2.5 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors">Save Change</button>
                                <button className="bg-[#059669] hover:bg-[#047857] text-white px-6 py-2.5 rounded-[6px] text-[13px] font-bold shadow-sm transition-colors">Reset</button>
                            </div>
                        </div>

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


export function FollowupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [loadMore, setLoadMore] = useState(false);
    const [showAdditional, setShowAdditional] = useState(false);

    // Default checked states exactly as image 1 
    const [selectedServices, setSelectedServices] = useState<string[]>(['Alibaba Membership']);
    const [selectedSubServices, setSelectedSubServices] = useState<string[]>(['GGS Digital']);

    const toggleService = (val: string) => {
        setSelectedServices(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);
    };
    const toggleSubService = (val: string) => {
        setSelectedSubServices(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);
    };

    const initialSubServices = ["GGS Digital", "Basic Basic Plus", "GGS Pro", "Standard", "Verified Supplier Rc-Up"];
    const extraSubServices = ["KAP", "Kwa Psa", "KWA-KAP", "Cat", "AI", "S-Brand", "China Trip", "RFQs"];
    const subServices = loadMore ? [...initialSubServices, ...extraSubServices] : initialSubServices;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[1600px] w-[98vw] max-h-[96vh] p-0 flex flex-col bg-white overflow-hidden gap-0 border-slate-200 shadow-2xl rounded-xl dark:bg-zinc-900 dark:border-zinc-800">
                <DialogHeader className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm z-10 flex flex-row items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[18px] font-bold text-slate-700 dark:text-zinc-400">Follow The Customer</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="mx-auto flex flex-col gap-6">

                        {/* Selected Store */}
                        <div className="bg-slate-100 border border-slate-200 px-4 py-3 rounded-[6px] text-slate-500 text-[14px] dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                            Al khar store
                        </div>

                        {/* Select Services */}
                        <div className="bg-white border border-slate-100 shadow-sm p-5 rounded-[10px] dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="text-[14px] font-bold text-[#059669] mb-4 dark:text-zinc-400">Select Services:<span className="text-red-500">*</span></h3>
                            <div className="flex flex-wrap items-center gap-6">
                                {['Alibaba Membership', 'Alibaba Services', 'Design Development', 'Domain Hosting'].map(srv => (
                                    <label key={srv} className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${selectedServices.includes(srv) ? 'bg-[#059669] border-[#059669]' : 'border-slate-300 bg-white dark:bg-zinc-900 group-hover:border-[#059669]/50'}`}>
                                            {selectedServices.includes(srv) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <span className="text-[13px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors dark:text-zinc-300">{srv}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Alibaba Membership - Sub Services */}
                        {selectedServices.includes('Alibaba Membership') && (
                            <div className="bg-white border text-[13px] border-slate-100 shadow-sm rounded-[10px] overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                                    <h3 className="text-[14px] font-bold text-[#059669] dark:text-zinc-400">Alibaba Membership - Sub Services</h3>
                                    <button className="text-slate-400 hover:text-slate-600">
                                        <svg xmlns="http://www.w-images.com/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    </button>
                                </div>
                                <div className="p-5 flex flex-col gap-5">
                                    {subServices.map(sub => {
                                        const isChecked = selectedSubServices.includes(sub);
                                        return (
                                            <div key={sub} className="flex flex-col gap-2">
                                                {/* Checkbox line */}
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                        <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${isChecked ? 'bg-[#059669] border-[#059669]' : 'border-slate-300 bg-white dark:bg-zinc-900 group-hover:border-[#059669]/50'}`}>
                                                            {isChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                        <span className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">{sub}</span>
                                                    </label>

                                                    {/* Inline details if checked */}
                                                    {isChecked && (
                                                        <div className="flex flex-1 items-center gap-2 ml-4">
                                                            <select className="flex-1 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#059669] dark:border-zinc-800">
                                                                <option>New Sell</option>
                                                            </select>
                                                            <select className="flex-1 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#059669] dark:border-zinc-800">
                                                                <option>B+</option>
                                                            </select>
                                                            <select className="flex-1 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#059669] dark:border-zinc-800">
                                                                <option></option>
                                                            </select>
                                                            <select className="flex-1 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#059669] dark:border-zinc-800">
                                                                <option>Introduction Me...</option>
                                                            </select>
                                                            <div className="relative flex-1">
                                                                <input type="text" defaultValue="01/01/2026 10:22 PM" className="w-full border border-slate-200 rounded-[6px] px-2 py-1.5 pr-8 focus:outline-none focus:border-[#059669] dark:border-zinc-800" />
                                                                <svg className="w-4 h-4 absolute right-2 top-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                                            </div>
                                                            <input type="text" defaultValue="aaa" className="flex-1 border border-slate-200 rounded-[6px] px-2 py-1.5 focus:outline-none focus:border-[#059669] dark:border-zinc-800" />
                                                            <div className="flex border border-slate-200 rounded-[6px] overflow-hidden flex-1 shrink-0 dark:border-zinc-800">
                                                                <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 text-[12px] font-medium transition-colors border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900">Choose files</button>
                                                                <span className="text-slate-400 px-3 py-1.5 text-[12px] bg-white w-full truncate dark:bg-zinc-900">N.</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Load More Button */}
                                    <div className="flex justify-center mt-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                                        <button onClick={() => setLoadMore(!loadMore)} className="flex items-center gap-1.5 border border-[#059669] text-[#059669] hover:bg-[#059669]/5 font-bold px-4 py-1.5 rounded-[6px] text-[13px] transition-colors dark:border-zinc-800 dark:text-zinc-400">
                                            {loadMore ? <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg> : <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>}
                                            {loadMore ? 'Show Less' : 'Load More'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Additional Details Toggle */}
                        <div className="w-full">
                            <button onClick={() => setShowAdditional(!showAdditional)} className={`w-full flex justify-center items-center gap-1.5 border px-4 py-2.5 rounded-[6px] text-[13px] font-bold transition-colors ${showAdditional ? 'border-red-400 text-red-500 hover:bg-red-50' : 'border-[#059669] text-[#059669] hover:bg-[#059669]/5'}`}>
                                {showAdditional ? <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg> : <svg xmlns="http://www.w-images.com/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>}
                                {showAdditional ? 'Hide Additional Details' : 'Show Additional Details'}
                            </button>
                        </div>

                        {/* Additional Details Form */}
                        {showAdditional && (
                            <div className="bg-white p-5 rounded-[10px] shadow-sm border border-slate-200 mt-[-12px] dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex flex-col gap-1.5 w-full md:w-1/2">
                                    <label className="text-[13px] font-bold text-[#059669] dark:text-zinc-400">Reservation:<span className="text-red-500">*</span></label>
                                    <select className="w-full border border-slate-200 rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:text-zinc-300 dark:border-zinc-800">
                                        <option>Select Reservation</option>
                                        <option>Mobile</option>
                                        <option>WhatsApp</option>
                                        <option>WH-Call</option>
                                        <option>In-meeting</option>
                                        <option>Out-meeting</option>
                                        <option>E-mail</option>
                                        <option>On-Site Appointment</option>
                                        <option>Vm Appointment</option>
                                        <option>Fax</option>
                                        <option>No Need</option>
                                        <option>Seminar</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div className="mt-1">
                            <button className="w-full bg-[#059669] hover:bg-[#047857] text-white py-3 rounded-[6px] text-[14px] font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99]">Submit</button>
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
        };
        mutation.mutate(payload);
    };

    const tagsList = [
        "Expansion bolts", "Expansion anchors", "Drop in anchor & cut anchor",
        "Curtain walling Contract manufacturing", "Continuity systems", "Channel",
        "Cast in channels", "Build forming parts", "Brickwork ties", "Brickwork supports",
        "Brickwork restraints", "Binu mathew", "Anker Anchoring systems Anchoring", "Sockets",
        "Fixing", "Fasteners", "Channels", "Angles", "Anchors", "Nails", "Bolts",
        "Manufacturer", "Ties", "Chains", "Building"
    ];

    if (!customerId) return null;

    const lead = profileData?.lead || {};

    return (
        <Dialog open={!!customerId} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[1100px] w-[95vw] h-[90vh] bg-[#f8fafc] border-slate-200 p-0 flex flex-col overflow-hidden shadow-2xl rounded-[12px] dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex-1 overflow-y-auto w-full">
                    <form onSubmit={handleSubmit} className="w-full flex flex-col lg:flex-row p-6 md:p-8 gap-8">

                        {/* Left Side: Form */}
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
                                        <input type="text" name="companyName" defaultValue={lead.companyName || ""} className="w-full border border-slate-200 bg-slate-50/50 rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Country /Region <span className="text-red-500">*</span></label>
                                        <select className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option>Choose...</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Company type</label>
                                        <select className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option>Finances & Insurance</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">City <span className="text-red-500">*</span></label>
                                        <select className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option>Abu Dhabi</option>
                                        </select>
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Title</label>
                                        <select className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] text-slate-600 focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm cursor-pointer dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                            <option>Choose...</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Person Full Name</label>
                                        <input type="text" name="accountName" defaultValue={lead.accountName || ""} className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[12px] font-semibold text-slate-600 dark:text-zinc-300">Personal Mobile No</label>
                                        <input type="text" defaultValue="" className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 text-[13px] focus:outline-none focus:border-[#059669] focus:ring-1 focus:ring-[#059669]/20 transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
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

                        {/* Right Side: Tags */}
                        <div className="w-[300px] flex-shrink-0 flex flex-col pt-[4px] h-[550px]">
                            <label className="text-[13px] font-bold text-slate-700 mb-2 font-sans pl-1 dark:text-zinc-400">Tags</label>
                            <input type="text" className="w-full border border-slate-200 bg-white rounded-[6px] px-3 py-2 mb-2 text-[13px] focus:outline-none focus:border-[#059669] transition-all shadow-sm dark:bg-zinc-900 dark:border-zinc-800" />
                            <div className="flex-1 bg-white border border-slate-200 rounded-[6px] shadow-sm flex flex-col overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    <div className="flex flex-col gap-2.5">
                                        {tagsList.map((tag) => (
                                            <label key={tag} className="flex items-start gap-2.5 cursor-pointer group">
                                                <input type="checkbox" className="mt-0.5 w-[14px] h-[14px] rounded-[3px] border-slate-300 text-[#059669] focus:ring-[#059669] accent-[#059669] dark:border-zinc-800 dark:text-zinc-400" />
                                                <span className="text-[13px] text-slate-600 leading-[1.2] group-hover:text-[#059669] transition-colors dark:text-zinc-300">{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
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
