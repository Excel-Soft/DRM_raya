import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightCircle, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PoolEntry = {
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
    startedAt: string | null;
    updatedAt: string | null;
};

type UserOption = { id: string; name?: string | null; full_name?: string | null };

const PAGE_SIZE = 25;

function formatDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

function userLabel(u: UserOption): string {
    return u.name || u.full_name || u.id;
}

function ManagePoolDialog({
    isOpen,
    onClose,
    entry,
}: {
    isOpen: boolean;
    onClose: () => void;
    entry: PoolEntry | null;
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

export default function ServicePublicPool() {
    const [selectedEntry, setSelectedEntry] = useState<PoolEntry | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery<{ items: PoolEntry[]; total: number }>({
        queryKey: ["/api/sales/service-pool/list", page, search],
        queryFn: () => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(PAGE_SIZE));
            if (search) params.set("search", search);
            return apiRequestJson<{ items: PoolEntry[]; total: number }>(
                "GET",
                `/api/sales/service-pool/list?${params.toString()}`,
            );
        },
    });

    const rows = data?.items ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const applySearch = () => {
        setSearch(searchInput.trim());
        setPage(1);
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight mb-4 dark:text-zinc-400">PUBLIC POOL</h2>

            <div className="bg-white rounded-[4px] shadow-sm border border-slate-50 h-10 mb-6 dark:bg-zinc-900 dark:border-zinc-800"></div>

            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">TRACING</h2>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") applySearch(); }}
                        onBlur={applySearch}
                        placeholder="Search company, account, ID..."
                        className="pl-9 h-9 text-[13px] border-slate-200 dark:border-zinc-800"
                    />
                </div>
            </div>

            <div className="bg-white shadow-sm border border-slate-100 rounded-[4px] p-2 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="overflow-x-auto rounded border border-slate-50 dark:border-zinc-800">
                    <Table className="w-full min-w-[1200px]">
                        <TableHeader>
                            <TableRow className="bg-[#f1f5f9] border-none hover:bg-[#f1f5f9] dark:bg-zinc-800 dark:hover:bg-zinc-800">
                                <TableHead className="w-10 pl-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Company ID</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Company Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Sale Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Acc Holder</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Contact No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Service Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">TA Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Status</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Account Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell colSpan={11} className="text-center py-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</span>
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow className="border-b-0 hover:bg-slate-50/50">
                                    <TableCell colSpan={11} className="text-center py-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">No data available in table</TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                        <TableCell className="pl-4 py-4"><input type="checkbox" className="rounded border-slate-300 dark:border-zinc-800" /></TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 uppercase dark:text-zinc-300">{row.drmId || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.companyName || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 capitalize dark:text-zinc-300">{row.salesPersonName || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.accountHolder || "—"}</TableCell>
                                        <TableCell className="py-4">
                                            {row.contactNo ? (
                                                <span className="bg-[#d1fae5] text-[#059669] text-[12px] font-bold px-2 py-0.5 rounded-[4px] dark:bg-zinc-900 dark:text-zinc-400">{row.contactNo}</span>
                                            ) : (
                                                <span className="text-[12px] font-medium text-slate-600 dark:text-zinc-300">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.servicePersonName || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.taPersonName || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 capitalize dark:text-zinc-300">{row.status || "—"}</TableCell>
                                        <TableCell className="text-[12px] font-medium text-slate-600 py-4 dark:text-zinc-300">{formatDate(row.startedAt)}</TableCell>
                                        <TableCell className="py-4">
                                            <div
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

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3">
                    <span className="text-[13px] text-slate-500 dark:text-zinc-400">
                        {total === 0 ? "Showing 0 entries" : `Page ${page} of ${totalPages} (${total} total)`}
                    </span>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[12px] px-3"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[12px] px-3"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>

            <ManagePoolDialog
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                entry={selectedEntry}
            />
        </div>
    );
}
