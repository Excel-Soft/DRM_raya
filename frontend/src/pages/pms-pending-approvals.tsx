import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ArrowRight, Upload, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest, throwIfResNotOk } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PendingProject {
    id: string;
    projectNumber?: string;
    company: string;
    project: string;
    status: string;
    person: string;
    date: string;
    paymentStatus: string;
    amount: number | string;
    verifiedAt: string | null;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
    sentToManager?: boolean;
    hodApprovedAt?: string | null;
    accountsApprovedAt?: string | null;
}

export default function PmsPendingApprovals() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [uploadFormData, setUploadFormData] = useState({
        packageName: "",
        minisiteUrl: "",
        phone: "",
        mobile: "",
        address: "",
        reference: "",
        categories: "",
        detailNotes: "",
        documentUrl: ""
    });

    const { data: projects = [], isLoading } = useQuery<PendingProject[]>({
        queryKey: ["/api/pms/pending-documents"],
    });

    const uploadMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", `/api/projects/${selectedProjectId}/documents`, data);
            await throwIfResNotOk(res); // ← throw if 403/500/etc — triggers onError
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Document and details uploaded successfully", variant: "default" });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/pending-documents"] });
            setIsUploadOpen(false);
            setUploadFormData({
                packageName: "",
                minisiteUrl: "",
                phone: "",
                mobile: "",
                address: "",
                reference: "",
                categories: "",
                detailNotes: "",
                documentUrl: ""
            });
        },
        onError: (error: any) => {
            toast({ title: "Failed to upload document", description: error.message, variant: "destructive" });
        }
    });

    const handleUploadClick = (projectId: string) => {
        setSelectedProjectId(projectId);
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setUploadFormData(prev => ({
                ...prev,
                packageName: "", // Reset or fetch from somewhere
            }));
        }
        setIsUploadOpen(true);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        uploadMutation.mutate({
            ...uploadFormData,
            evidenceUrl: uploadFormData.documentUrl // Use documentUrl as evidenceUrl for now
        });
    };

    const filteredData = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const lowerSearch = searchQuery.toLowerCase();
        return projects.filter((row) => 
            String(row.id || "").toLowerCase().includes(lowerSearch) ||
            String(row.company || "").toLowerCase().includes(lowerSearch) ||
            String(row.project || "").toLowerCase().includes(lowerSearch) ||
            String(row.person || "").toLowerCase().includes(lowerSearch) ||
            String(row.status || "").toLowerCase().includes(lowerSearch) ||
            String(row.date || "").toLowerCase().includes(lowerSearch)
        );
    }, [searchQuery, projects]);

    const handleExport = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (filteredData.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["#P-ID", "Projects", "Status", "Hod", "Account", "Dep", "Date"];
        const rows = filteredData.map((row) => [
            `#${row.projectNumber || "N/A"}`,
            `${row.project} (${row.company})`,
            row.status,
            row.hodApprovedAt ? "Verified" : "Waiting",
            row.accountsApprovedAt ? "Verified" : "Waiting",
            "Product Posting",
            row.date ? format(new Date(row.date), "dd-MM-yyyy") : "N/A"
        ]);

        if (formatType === "copy") {
            const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
            navigator.clipboard.writeText(text);
            toast({ title: "Data copied to clipboard" });
        } else if (formatType === "csv" || formatType === "excel") {
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const mime = formatType === "csv" ? "text/csv" : "application/vnd.ms-excel";
            const ext = formatType === "csv" ? "csv" : "xls";
            const blob = new Blob([csv], { type: mime });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `pending-approvals.${ext}`;
            link.click();
            toast({ title: `${formatType.toUpperCase()} file downloaded` });
        } else if (formatType === "pdf") {
            window.print();
        }
    };

    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
             <div className="mb-6 flex space-x-1 uppercase text-[15px] font-bold tracking-wide text-[#00a65a] items-center dark:text-zinc-400">
                <ArrowRight className="w-4 h-4 mr-1 text-[#00a65a] dark:text-zinc-400" />
                PENDING APPROVALS (DOCUMENTS)
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm p-4 text-[13px] text-[#495057] font-medium mb-6 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                Upload documents for projects awaiting approval.
            </div>

            <div className="bg-white border border-gray-100 rounded shadow-sm overflow-hidden p-5 dark:bg-zinc-900 dark:border-zinc-800">
                {/* Controls: Buttons & Search */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                    {/* Action Buttons */}
                    <div className="flex bg-[#6c757d] rounded-[3px] overflow-hidden shadow-sm h-8">
                        <button 
                            onClick={() => handleExport('copy')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            Copy
                        </button>
                        <button 
                            onClick={() => handleExport('excel')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            Excel
                        </button>
                        <button 
                            onClick={() => handleExport('pdf')}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                        >
                            PDF
                        </button>
                        <button 
                            onClick={() => toast({ title: "Column visibility options clicked" })}
                            className="px-3 text-[13px] text-white hover:bg-[#5a6268] transition-colors"
                        >
                            Column visibility
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                        <Input 
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-[#d1e7dd] text-[#0a3622] border-b border-[#badbcc] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">#P-ID</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Projects</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Status</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Hod</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Account</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Dep</th>
                                <th className="px-4 py-3 text-[13px] font-bold border-r border-[#badbcc] dark:border-zinc-800">Date</th>
                                <th className="px-4 py-3 text-[13px] font-bold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-[#495057] dark:text-zinc-400">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Loading pending projects...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-gray-500 dark:text-zinc-400">
                                        No pending documents to upload.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((row) => {
                                    const rejectedAtTime = row.rejectedAt ? new Date(row.rejectedAt).getTime() : 0;
                                    const verifiedAtTime = row.verifiedAt ? new Date(row.verifiedAt).getTime() : 0;
                                    const isVerifiedNow = verifiedAtTime > rejectedAtTime;
                                    const showRejection = !!row.rejectionReason && !isVerifiedNow;

                                    return (
                                        <tr key={row.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 font-bold text-gray-400 dark:border-zinc-800">
                                                #{row.projectNumber || "N/A"}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                                <div className="font-bold text-[#333] dark:text-zinc-300 mb-1">{row.project}</div>
                                                <div className="text-[12px] text-blue-500 font-medium">{row.company}</div>
                                                {showRejection && (
                                                    <div className="mt-2 text-[11px] bg-red-50 text-red-600 border border-red-100 p-1.5 rounded-sm dark:bg-red-900/20 dark:border-red-900/50">
                                                        <span className="font-bold">Rejected Reason:</span> {row.rejectionReason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                                {row.sentToManager ? (
                                                    <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full font-semibold shadow-sm border bg-blue-50 text-blue-700 border-blue-200">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                        </span>
                                                        Sent to Manager
                                                    </span>
                                                ) : showRejection ? (
                                                    <span className="inline-flex text-[11px] px-3 py-1 rounded-full font-medium shadow-sm border bg-red-100 text-red-700 border-red-200">
                                                        Re-Upload
                                                    </span>
                                                ) : (
                                                    <span className={cn(
                                                        "inline-flex text-[11px] px-3 py-1 rounded-full font-medium shadow-sm border",
                                                        row.status === "Documents Pending" ? "bg-[#fff3cd] text-[#856404] border-[#ffeeba]" : "bg-green-100 text-green-700 border-green-200"
                                                    )}>
                                                        {row.status}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                                {!showRejection && row.hodApprovedAt ? (
                                                    <span className="text-emerald-600 font-bold">Verified</span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px] border border-slate-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                        Waiting
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                                {!showRejection && row.accountsApprovedAt ? (
                                                    <span className="text-emerald-600 font-bold">Verified</span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px] border border-slate-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                        Waiting
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 dark:border-zinc-800">
                                                {showRejection ? (
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px] border border-slate-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                        Waiting
                                                    </span>
                                                ) : isVerifiedNow ? (
                                                    <span className="px-3 py-1 rounded-full bg-sky-100 text-emerald-600 font-medium text-[11px] border border-sky-200">
                                                        Approved
                                                    </span>
                                                ) : (
                                                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 font-medium text-[11px] border border-slate-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                        Waiting
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-[13px] border-r border-gray-100 whitespace-nowrap dark:border-zinc-800">
                                                {row.date ? format(new Date(row.date), "dd-MM-yyyy") : "N/A"}
                                            </td>
                                            <td className="px-4 py-4 text-[13px]">
                                                {row.sentToManager ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-[3px] text-[12px] font-semibold">
                                                            ✓ Documents Sent {row.rejectionReason ? 'Again ' : ''}to Manager
                                                        </span>
                                                        <button
                                                            onClick={() => handleUploadClick(row.id)}
                                                            disabled={uploadMutation.isPending}
                                                            className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 underline transition-colors"
                                                        >
                                                            {row.rejectionReason ? 'Re-send again' : 'Upload again'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleUploadClick(row.id)}
                                                        disabled={uploadMutation.isPending}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00a65a] text-white rounded-[3px] hover:bg-[#008d4c] transition-colors disabled:opacity-50"
                                                    >
                                                        {uploadMutation.isPending && selectedProjectId === row.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Upload className="w-3.5 h-3.5" />
                                                        )}
                                                        Upload Documents
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="max-w-[1000px] p-0 overflow-hidden border-none shadow-2xl rounded-sm">
                    <DialogHeader className="bg-[#f8f9fa] px-6 py-4 border-b border-gray-100 flex flex-row items-center justify-between dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[14px] font-bold text-[#495057] uppercase tracking-wider dark:text-zinc-400">PROJECT DETAIL</DialogTitle>
                    </DialogHeader>
                    
                    <form onSubmit={handleFormSubmit} className="p-8 bg-white space-y-8 dark:bg-zinc-900">
                        {/* Row 1 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">company name</label>
                                <Input
                                    readOnly
                                    value={projects.find(p => p.id === selectedProjectId)?.company || ""}
                                    className="bg-[#e9ecef] border-gray-200 h-10 text-[13px] dark:border-zinc-800 dark:bg-zinc-900"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    {(() => {
                                        const p = projects.find(p => p.id === selectedProjectId);
                                        if (!p) return "";
                                        return p.projectNumber ? `${p.project} (#${p.projectNumber})` : p.project;
                                    })()}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Package</label>
                                <Select 
                                    onValueChange={(v) => setUploadFormData(prev => ({ ...prev, packageName: v }))}
                                    value={uploadFormData.packageName}
                                >
                                    <SelectTrigger className="h-10 text-[13px] border-gray-200 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Basic">Basic</SelectItem>
                                        <SelectItem value="Basic Plus">Basic Plus</SelectItem>
                                        <SelectItem value="Standard">Standard</SelectItem>
                                        <SelectItem value="Premium">Premium</SelectItem>
                                        <SelectItem value="Verified Supplier">Verified Supplier</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Minisite Url</label>
                                <Input 
                                    placeholder="Minisite Url"
                                    value={uploadFormData.minisiteUrl}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, minisiteUrl: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Phone</label>
                                <Input 
                                    placeholder="Phone"
                                    value={uploadFormData.phone}
                                    maxLength={11}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Mobile</label>
                                <Input 
                                    placeholder="Mobile"
                                    value={uploadFormData.mobile}
                                    maxLength={11}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, mobile: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Address</label>
                                <Input 
                                    placeholder="Address"
                                    value={uploadFormData.address}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, address: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* Row 3 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Refrence</label>
                                <Input 
                                    placeholder="Refrence Website"
                                    value={uploadFormData.reference}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, reference: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Categories</label>
                                <Input 
                                    placeholder="Enter Categories Categories"
                                    value={uploadFormData.categories}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, categories: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* Row 4 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Detail</label>
                                <Textarea 
                                    className="border-gray-200 min-h-[100px] text-[13px] resize-none dark:border-zinc-800"
                                    value={uploadFormData.detailNotes}
                                    onChange={(e) => setUploadFormData(prev => ({ ...prev, detailNotes: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">Add Logo/Banner/Certficates</label>
                                <div className="flex">
                                    <div className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm items-center dark:bg-zinc-900 dark:border-zinc-800">
                                        <label className="bg-[#f0f0f0] border border-gray-300 px-3 py-1 cursor-pointer mr-2 text-[12px] text-[#495057] active:bg-gray-200 hover:bg-gray-100 rounded-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                            Choose files
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                onChange={(e) => {
                                                    const fileName = e.target.files?.[0]?.name;
                                                    if(fileName) setUploadFormData(prev => ({ ...prev, documentUrl: fileName }));
                                                }}
                                            />
                                        </label>
                                        <span className="text-[12px] text-gray-400">
                                            {uploadFormData.documentUrl || "No file chosen"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button 
                                type="submit"
                                disabled={uploadMutation.isPending}
                                className="bg-[#008d4c] hover:bg-[#00733e] text-white px-10 py-2 h-auto text-[15px] font-medium rounded-md shadow-sm"
                            >
                                {uploadMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : null}
                                upload
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

