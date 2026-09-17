import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Eye, ChevronLeft, ChevronRight, UserPlus, Send, RefreshCw } from "lucide-react";
import { getAuthHeader, apiRequestJson } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ServiceAppointmentModal } from "@/components/service-appointment-modal";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ServicePoolSummary = {
    allInService: number;
    dropoutIn1Year: number;
    dropoutMoreThan1Year: number;
    currentQ: number;
    duplicateData: number;
};

type ServicePoolEntry = {
    id: string;
    customerId: string;
    drmId: string | null;
    companyName: string;
    serviceCode: string | null;
    subserviceCode: string | null;
    salesPersonName: string | null;
    servicePersonName: string | null;
    servicePersonId: string | null;
    taPersonName: string | null;
    accountHolder: string | null;
    contactNo: string | null;
    bvDate: string | null;
    status: string;
    dropoutCategory: string | null;
    startedAt: string;
    updatedAt: string;
};

type UserOption = { id: string; name?: string | null; full_name?: string | null };

function userLabel(u: any): string {
    return u.fullName || u.name || u.full_name || u.email || u.id;
}

function ManagePoolDialog({
    isOpen,
    onClose,
    entry,
}: {
    isOpen: boolean;
    onClose: () => void;
    entry: ServicePoolEntry | null;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [assignTo, setAssignTo] = useState("");

    // Reset selection when modal opens with a new entry
    useEffect(() => {
        if (isOpen && entry) {
            setAssignTo(entry.servicePersonId || "");
        }
    }, [isOpen, entry]);

    const { data: usersResponse } = useQuery<{ users: UserOption[] }>({
        queryKey: ["/api/users", { role: "all" }],
        queryFn: () => apiRequestJson<{ users: UserOption[] }>("GET", "/api/users?role=all"),
        enabled: isOpen,
    });

    const userOptions = (Array.isArray(usersResponse?.users) ? usersResponse.users : []).filter(u => {
        const anyU = u as any;
        return anyU.role === "service_executive" || (Array.isArray(anyU.roles) && anyU.roles.includes("service_executive"));
    });

    const invalidateList = () =>
        queryClient.invalidateQueries({ queryKey: ["/api/sales/service-pool/list"] });

    const assignMutation = useMutation({
        mutationFn: () =>
            apiRequestJson("PATCH", `/api/sales/service-pool/${entry!.id}/assign`, {
                servicePersonId: assignTo,
            }),
        onSuccess: () => {
            toast({ title: "Saved", description: "Customer assigned successfully." });
            setAssignTo("");
            invalidateList();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Assign failed", description: err?.message || "Could not assign.", variant: "destructive" });
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-[450px] p-0 bg-white dark:bg-zinc-900 rounded-md shadow-xl border-none">
                <DialogHeader className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                    <DialogTitle className="text-base font-semibold text-slate-700 dark:text-zinc-200">
                        Assign Customer
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-600 dark:text-zinc-400">Company</label>
                        <Input
                            readOnly
                            value={entry?.companyName || ""}
                            className="w-full text-sm border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 cursor-not-allowed focus-visible:ring-0"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-600 dark:text-zinc-400">User</label>
                        <Select value={assignTo} onValueChange={setAssignTo}>
                            <SelectTrigger className="w-full text-sm border-slate-300 dark:border-zinc-700">
                                <SelectValue placeholder="Choose .." />
                            </SelectTrigger>
                            <SelectContent>
                                {userOptions.map((u) => (
                                    <SelectItem key={u.id} value={u.id}>{userLabel(u)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2 bg-slate-50 dark:bg-zinc-900/50 rounded-b-md">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="text-sm h-9 px-4 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                        Close
                    </Button>
                    <Button
                        className="text-sm h-9 px-4 bg-[#10b981] hover:bg-[#059669] text-white font-medium"
                        disabled={!assignTo || assignMutation.isPending}
                        onClick={() => assignMutation.mutate()}
                    >
                        {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ServicePool() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [selectedEntry, setSelectedEntry] = useState<ServicePoolEntry | null>(null);
    const [followupEntry, setFollowupEntry] = useState<ServicePoolEntry | null>(null);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("allInService");
    const pageSize = 10;

    const roleStr = sessionStorage.getItem("activeRoleId") || sessionStorage.getItem("userRole") || "";
    const normalizedRole = roleStr.toLowerCase().replace(/\s+/g, "_");
    const canAssign = normalizedRole.includes("manager") || normalizedRole.includes("admin") || normalizedRole === "super_hod" || normalizedRole === "hod";

    const { data: summary } = useQuery<ServicePoolSummary>({
        queryKey: ["/api/sales/service-pool/summary"],
        queryFn: async () => {
            const res = await fetch("/api/sales/service-pool/summary", {
                headers: getAuthHeader(),
            });
            return res.json();
        },
    });

    const { data: listData, isLoading: isLoadingList } = useQuery<{ items: ServicePoolEntry[]; total: number }>({
        queryKey: ["/api/sales/service-pool/list", page, searchTerm, activeFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(pageSize));
            if (searchTerm) params.set("search", searchTerm);

            if (activeFilter === "allInService") {
                params.set("status", "active");
            } else if (activeFilter === "dropoutIn1Year") {
                params.set("dropoutCategory", "dropout_in_1_year");
            } else if (activeFilter === "dropoutMoreThan1Year") {
                params.set("dropoutCategory", "dropout_more_than_1_year");
            } else if (activeFilter === "duplicateData") {
                params.set("duplicates", "true");
            } else if (activeFilter === "currentQ") {
                params.set("currentQ", "true");
            }

            const res = await fetch(`/api/sales/service-pool/list?${params.toString()}`, {
                headers: getAuthHeader(),
            });
            return res.json();
        },
    });

    const filters = [
        { key: "dropoutIn1Year", label: "Dropout In 1-Year", count: summary?.dropoutIn1Year || 0, color: "bg-[#e2e8f0] text-slate-700", badgeColor: "bg-[#ef4444]" },
        { key: "dropoutMoreThan1Year", label: "Dropout More Than 1-Year", count: summary?.dropoutMoreThan1Year || 0, color: "bg-[#e2e8f0] text-slate-700", badgeColor: "bg-[#f87171]" },
        { key: "currentQ", label: "Current Q", count: summary?.currentQ || 0, color: "bg-[#e2e8f0] text-slate-700", badgeColor: "bg-[#ef4444]" },
        { key: "allInService", label: "All In Service", count: summary?.allInService || 0, color: "bg-[#e2e8f0] text-slate-700", badgeColor: "bg-[#ef4444]" },
        { key: "duplicateData", label: "Service Pool Duplicate Data", count: summary?.duplicateData || 0, color: "bg-[#e2e8f0] text-slate-700", badgeColor: "bg-[#ef4444]" },
    ];

    const totalPages = Math.ceil((listData?.total || 0) / pageSize);

    // Export functionality
    const getAllDataForExport = async () => {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("pageSize", "10000"); // fetch all for export
        if (searchTerm) params.set("search", searchTerm);

        if (activeFilter === "allInService") {
            params.set("status", "active");
        } else if (activeFilter === "dropoutIn1Year") {
            params.set("dropoutCategory", "dropout_in_1_year");
        } else if (activeFilter === "dropoutMoreThan1Year") {
            params.set("dropoutCategory", "dropout_more_than_1_year");
        } else if (activeFilter === "duplicateData") {
            params.set("duplicates", "true");
        } else if (activeFilter === "currentQ") {
            params.set("currentQ", "true");
        }

        const res = await fetch(`/api/sales/service-pool/list?${params.toString()}`, {
            headers: getAuthHeader(),
        });
        const data = await res.json();
        return data.items as ServicePoolEntry[];
    };

    const handleCopy = async () => {
        try {
            const data = await getAllDataForExport();
            if (!data || data.length === 0) return;
            const text = data.map((d, i) => `${i + 1}\t${d.drmId || "-"}\t${d.companyName}\t${d.salesPersonName || "-"}\t${d.servicePersonName || "-"}\t${d.taPersonName || "-"}\t${d.accountHolder || "-"}\t${d.contactNo || "-"}`).join("\n");
            const header = "#\tDRM ID\tCompany\tSale Person\tService Person\tTA Person\tAcc Holder\tContact No\n";
            await navigator.clipboard.writeText(header + text);
            toast({ title: "Copied to clipboard" });
        } catch (e) {
            toast({ title: "Failed to copy", variant: "destructive" });
        }
    };

    const handleExcel = async () => {
        try {
            const data = await getAllDataForExport();
            if (!data || data.length === 0) return;
            const wsData = data.map((d, i) => ({
                "#": i + 1,
                "DRM ID": d.drmId || "-",
                "Company": d.companyName,
                "Sale Person": d.salesPersonName || "-",
                "Service Person": d.servicePersonName || "-",
                "TA Person": d.taPersonName || "-",
                "Acc Holder": d.accountHolder || "-",
                "Contact No": d.contactNo || "-",
            }));
            const ws = XLSX.utils.json_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ServicePool");
            XLSX.writeFile(wb, "ServicePool.xlsx");
        } catch (e) {
            toast({ title: "Failed to export Excel", variant: "destructive" });
        }
    };

    const handleCSV = async () => {
        try {
            const data = await getAllDataForExport();
            if (!data || data.length === 0) return;
            const wsData = data.map((d, i) => ({
                "#": i + 1,
                "DRM ID": d.drmId || "-",
                "Company": d.companyName,
                "Sale Person": d.salesPersonName || "-",
                "Service Person": d.servicePersonName || "-",
                "TA Person": d.taPersonName || "-",
                "Acc Holder": d.accountHolder || "-",
                "Contact No": d.contactNo || "-",
            }));
            const ws = XLSX.utils.json_to_sheet(wsData);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "ServicePool.csv";
            link.click();
        } catch (e) {
            toast({ title: "Failed to export CSV", variant: "destructive" });
        }
    };

    const handlePDF = async () => {
        try {
            const data = await getAllDataForExport();
            if (!data || data.length === 0) return;
            const doc = new jsPDF("landscape");
            const tableData = data.map((d, i) => [
                i + 1,
                d.drmId || "-",
                d.companyName,
                d.salesPersonName || "-",
                d.servicePersonName || "-",
                d.taPersonName || "-",
                d.accountHolder || "-",
                d.contactNo || "-",
            ]);
            autoTable(doc, {
                head: [["#", "DRM ID", "Company", "Sale Person", "Service Person", "TA Person", "Acc Holder", "Contact No"]],
                body: tableData,
            });
            doc.save("ServicePool.pdf");
        } catch (e) {
            toast({ title: "Failed to export PDF", variant: "destructive" });
        }
    };

    return (
        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200">
            {/* Header Section */}
            <div className="bg-white dark:bg-zinc-900 shadow-sm border border-slate-200 dark:border-zinc-800 rounded-sm p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <h1 className="text-[16px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">CUSTOMER LIST</h1>
                    <Badge className="bg-[#e0f2fe] text-[#0369a1] hover:bg-[#e0f2fe] border-none shadow-none text-xs rounded-sm px-2 py-0.5">
                        {listData?.total || 0}
                    </Badge>
                </div>
                
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Search Customer</label>
                    <Input
                        placeholder="Enter company name/mobile/email"
                        className="w-full text-sm border-slate-300 dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-emerald-500 rounded-sm h-10"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Tracing & Table Section */}
            <div className="bg-white dark:bg-zinc-900 shadow-sm border border-slate-200 dark:border-zinc-800 rounded-sm p-4">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4 mb-4">
                    <h2 className="text-[15px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">TRACING</h2>
                    
                    <div className="flex flex-wrap gap-2">
                        {filters.map((f) => {
                            const isActive = activeFilter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => {
                                        setActiveFilter(f.key);
                                        setPage(1);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                        isActive 
                                            ? "border-slate-400 dark:border-slate-500 bg-slate-200 dark:bg-zinc-800" 
                                            : "border-transparent bg-[#f1f5f9] dark:bg-zinc-800/50 hover:bg-slate-200 dark:hover:bg-zinc-800"
                                    } text-slate-700 dark:text-slate-300`}
                                >
                                    <span>{f.label}</span>
                                    <Badge className={`${f.badgeColor} text-white hover:${f.badgeColor} border-none shadow-none text-[10px] rounded-full px-1.5 py-0 min-w-[20px] flex items-center justify-center`}>
                                        {f.count}
                                    </Badge>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <div className="flex bg-[#64748b] dark:bg-zinc-800 rounded-sm overflow-hidden">
                        <button onClick={handleCopy} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">Copy</button>
                        <button onClick={handleExcel} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">Excel</button>
                        <button onClick={handleCSV} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors border-r border-slate-400/30">CSV</button>
                        <button onClick={handlePDF} className="px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 transition-colors">PDF</button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Search:</span>
                        <Input
                            className="w-[200px] h-8 text-sm border-slate-300 dark:border-zinc-700 rounded-sm focus-visible:ring-1 focus-visible:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table className="w-full text-sm">
                        <TableHeader>
                            <TableRow className="bg-[#f8fafc] dark:bg-zinc-800/80 hover:bg-[#f8fafc] dark:hover:bg-zinc-800/80 border-y border-slate-200 dark:border-zinc-700">
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">#</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">DRM ID</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2 min-w-[200px]">Company</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">Service</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">Sale Person</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">Service Person</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">TA Person</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">Acc Holder</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">Contact No</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2">BV-Date</TableHead>
                                <TableHead className="font-bold text-slate-700 dark:text-zinc-300 h-10 py-2 text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoadingList ? (
                                Array.from({ length: 5 }).map((_, rowIndex) => (
                                    <TableRow key={rowIndex}>
                                        {Array.from({ length: 11 }).map((_, colIndex) => (
                                            <TableCell key={colIndex} className="py-2.5">
                                                <Skeleton className="h-4 w-full" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (listData?.items ?? []).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="h-32 text-center text-slate-500">
                                        No records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                listData?.items.map((row, index) => (
                                    <TableRow key={row.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800">
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">
                                            {(page - 1) * pageSize + index + 1}
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                            <button
                                                type="button"
                                                title="Follow The Customer"
                                                className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                                                onClick={() => setFollowupEntry(row)}
                                            >
                                                {row.drmId || "-"}
                                            </button>
                                        </TableCell>
                                        <TableCell className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">{row.companyName}</TableCell>
                                        <TableCell className="py-2.5">
                                            {row.serviceCode ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        {row.serviceCode.replace(/_/g, " ")}
                                                    </span>
                                                    {row.subserviceCode && (
                                                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                                                            {row.subserviceCode.replace(/_/g, " ")}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">{row.salesPersonName || "-"}</TableCell>
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">{row.servicePersonName || "-"}</TableCell>
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">{row.taPersonName || "-"}</TableCell>
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">{row.accountHolder || "-"}</TableCell>
                                        <TableCell className="py-2.5 text-slate-600 dark:text-zinc-400">{row.contactNo || "-"}</TableCell>
                                        <TableCell className="py-2.5">
                                            {row.bvDate ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                    Complete
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300">
                                                    Pending
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2.5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    title="View Attribute"
                                                    className="w-7 h-7 rounded-full bg-[#10b981] hover:bg-[#059669] flex items-center justify-center text-white transition-colors"
                                                    onClick={() => setLocation(`/customers/attribute/${row.customerId}`)}
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {canAssign && (
                                                    <button
                                                        title="Manage"
                                                        className="w-7 h-7 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] flex items-center justify-center text-white transition-colors"
                                                        onClick={() => setSelectedEntry(row)}
                                                    >
                                                        <UserPlus className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-zinc-800">
                    <div className="text-sm text-slate-600 dark:text-zinc-400">
                        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, listData?.total || 0)} of {listData?.total || 0} entries
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </Button>
                        <div className="flex items-center justify-center h-8 px-3 text-xs font-medium text-white bg-[#0ea5e9] rounded-sm">
                            {page}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || totalPages === 0}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            <ManagePoolDialog
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                entry={selectedEntry}
            />

            <ServiceAppointmentModal
                open={!!followupEntry}
                onClose={() => setFollowupEntry(null)}
                initialCustomerId={followupEntry?.customerId}
                initialCustomerName={followupEntry?.companyName}
            />
        </div>
    );
}
