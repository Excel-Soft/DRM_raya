import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ChevronLeft, ChevronRight, ArrowRightCircle } from "lucide-react";
import { getAuthHeader, apiRequestJson } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type ServicePoolSummary = {
    allInService: number;
    dropoutIn1Year: number;
    dropoutMoreThan1Year: number;
    currentQ: number;
    duplicateData: number;
};

type ServicePoolEntry = {
    id: string;
    drmId: string | null;
    companyName: string;
    salesPersonName: string | null;
    servicePersonName: string | null;
    taPersonName: string | null;
    accountHolder: string | null;
    contactNo: string | null;
    status: string;
    dropoutCategory: string | null;
    startedAt: string;
    updatedAt: string;
};

type UserOption = { id: string; name?: string | null; full_name?: string | null };

function userLabel(u: UserOption): string {
    return u.name || u.full_name || u.id;
}

// Assign / Transfer / Message-Draft used to live on the "Public Pool" page,
// but that page now shows real unclaimed drm.customers rows (Sales parity,
// with a Pick/claim action) — this service_pool_entries-specific management
// dialog belongs here instead, where the entries it operates on actually are.
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
    const [transferTo, setTransferTo] = useState("");
    const [channel, setChannel] = useState("whatsapp");
    const [message, setMessage] = useState("");

    const { data: users } = useQuery<UserOption[]>({
        queryKey: ["/api/users", { assigned: true }],
        queryFn: () => apiRequestJson<UserOption[]>("GET", "/api/users?assigned=true"),
        enabled: isOpen,
    });

    const userOptions = Array.isArray(users) ? users : [];

    const invalidateList = () =>
        queryClient.invalidateQueries({ queryKey: ["/api/sales/service-pool/list"] });

    const assignMutation = useMutation({
        mutationFn: () =>
            apiRequestJson("PATCH", `/api/sales/service-pool/${entry!.id}/assign`, {
                servicePersonId: assignTo,
            }),
        onSuccess: () => {
            toast({ title: "Assigned", description: "Service person assigned to this entry." });
            setAssignTo("");
            invalidateList();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Assign failed", description: err?.message || "Could not assign.", variant: "destructive" });
        },
    });

    const transferMutation = useMutation({
        mutationFn: () =>
            apiRequestJson("PATCH", `/api/sales/service-pool/${entry!.id}/transfer`, {
                servicePersonId: transferTo,
            }),
        onSuccess: () => {
            toast({ title: "Transferred", description: "Entry transferred to the selected service person." });
            setTransferTo("");
            invalidateList();
            onClose();
        },
        onError: (err: any) => {
            toast({ title: "Transfer failed", description: err?.message || "Could not transfer.", variant: "destructive" });
        },
    });

    const draftMutation = useMutation({
        mutationFn: () =>
            apiRequestJson("POST", `/api/sales/service-pool/${entry!.id}/message-draft`, {
                channel,
                message: message.trim(),
            }),
        onSuccess: () => {
            toast({ title: "Draft saved", description: "Message draft recorded (not sent externally)." });
            setMessage("");
        },
        onError: (err: any) => {
            toast({ title: "Draft failed", description: err?.message || "Could not save draft.", variant: "destructive" });
        },
    });

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-lg p-6 bg-white gap-6 dark:bg-zinc-900">
                <DialogHeader>
                    <DialogTitle className="text-[16px] font-bold text-[#475569] uppercase border-b pb-4 dark:text-zinc-400">
                        Manage Pool Entry
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="text-[13px] text-slate-600 dark:text-zinc-300">
                        <span className="font-bold">{entry?.companyName || "—"}</span>
                        <span className="text-slate-400 dark:text-zinc-500"> · {entry?.drmId || "—"}</span>
                    </div>

                    {/* Assign */}
                    <div className="space-y-2">
                        <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Assign Service Person</label>
                        <div className="flex gap-2">
                            <Select value={assignTo} onValueChange={setAssignTo}>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose person..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {userOptions.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>{userLabel(u)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                className="bg-[#059669] hover:bg-emerald-700 text-white h-9 px-4 text-[13px] shrink-0"
                                disabled={!assignTo || assignMutation.isPending}
                                onClick={() => assignMutation.mutate()}
                            >
                                {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                            </Button>
                        </div>
                    </div>

                    {/* Transfer */}
                    <div className="space-y-2">
                        <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Transfer To</label>
                        <div className="flex gap-2">
                            <Select value={transferTo} onValueChange={setTransferTo}>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose person..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {userOptions.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>{userLabel(u)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                className="bg-[#059669] hover:bg-emerald-700 text-white h-9 px-4 text-[13px] shrink-0"
                                disabled={!transferTo || transferMutation.isPending}
                                onClick={() => transferMutation.mutate()}
                            >
                                {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer"}
                            </Button>
                        </div>
                    </div>

                    {/* Message Draft */}
                    <div className="space-y-2">
                        <label className="text-[12px] font-bold text-slate-700 dark:text-zinc-400">Message Draft</label>
                        <Select value={channel} onValueChange={setChannel}>
                            <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                        </Select>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Compose a follow-up message draft..."
                            className="border-slate-200 text-[13px] min-h-[80px] dark:border-zinc-800"
                        />
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                            Drafts are saved internally only — no external message is sent.
                        </p>
                        <Button
                            className="bg-[#059669] hover:bg-emerald-700 text-white h-9 px-4 text-[13px]"
                            disabled={!message.trim() || draftMutation.isPending}
                            onClick={() => draftMutation.mutate()}
                        >
                            {draftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Draft"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ServicePool() {
    const [selectedEntry, setSelectedEntry] = useState<ServicePoolEntry | null>(null);
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("allInService");
    const pageSize = 10;

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
        { key: "dropoutIn1Year", label: "Dropout In 1-Year", count: summary?.dropoutIn1Year || 0, color: "bg-red-500" },
        { key: "dropoutMoreThan1Year", label: "Dropout More Than 1-Year", count: summary?.dropoutMoreThan1Year || 0, color: "bg-orange-500" },
        { key: "currentQ", label: "Current Q", count: summary?.currentQ || 0, color: "bg-blue-500" },
        { key: "allInService", label: "All In Service", count: summary?.allInService || 0, color: "bg-emerald-500" },
        { key: "duplicateData", label: "Service Pool Duplicate Data", count: summary?.duplicateData || 0, color: "bg-purple-500" },
    ];

    const totalPages = Math.ceil((listData?.total || 0) / pageSize);

    return (
        <div className="flex-1 overflow-auto p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Service Pool Management</h1>
                <p className="text-muted-foreground">Monitor and track customer service delivery status</p>
            </div>

            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => {
                                    setActiveFilter(f.key);
                                    setPage(1);
                                }}
                                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeFilter === f.key
                                    ? "ring-2 ring-primary ring-offset-2 scale-105"
                                    : "opacity-80 hover:opacity-100"
                                    } ${f.color} text-white`}
                            >
                                <span className="font-semibold text-sm">{f.label}</span>
                                <Badge variant="secondary" className="bg-white text-white border-none dark:bg-zinc-900">
                                    {f.count}
                                </Badge>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle>Customer List</CardTitle>
                    </div>
                    <div className="relative w-64 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search company, ID..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead className="min-w-[200px]">Company</TableHead>
                                    <TableHead>Sale Person</TableHead>
                                    <TableHead>Service Person</TableHead>
                                    <TableHead>TA Person</TableHead>
                                    <TableHead>Acc Holder</TableHead>
                                    <TableHead>Contact No</TableHead>
                                    <TableHead>Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingList ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading results...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (listData?.items ?? []).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No records found in this pool.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    listData?.items.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="font-mono text-xs">{row.drmId || "-"}</TableCell>
                                            <TableCell className="font-medium">{row.companyName}</TableCell>
                                            <TableCell>{row.salesPersonName || "-"}</TableCell>
                                            <TableCell>{row.servicePersonName || "-"}</TableCell>
                                            <TableCell>{row.taPersonName || "-"}</TableCell>
                                            <TableCell>{row.accountHolder || "-"}</TableCell>
                                            <TableCell>{row.contactNo || "-"}</TableCell>
                                            <TableCell>
                                                <div
                                                    title="Manage"
                                                    className="w-6 h-6 rounded-full bg-[#059669] flex items-center justify-center text-white cursor-pointer hover:bg-emerald-700 shadow-sm transition-colors"
                                                    onClick={() => setSelectedEntry(row)}
                                                >
                                                    <ArrowRightCircle className="w-3.5 h-3.5" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages || 1} ({listData?.total || 0} total)
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <ManagePoolDialog
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                entry={selectedEntry}
            />
        </div>
    );
}
