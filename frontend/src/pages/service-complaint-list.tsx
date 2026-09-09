import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ComplaintRow = {
    id: string;
    serviceCustomerId: string | null;
    customerId: string | null;
    companyName: string | null;
    personName: string | null;
    title: string | null;
    description: string | null;
    priority: string | null;
    status: string;
    assignedTo: string | null;
    assignedToName: string | null;
    remarks: string | null;
    dueDate: string | null;
    assignedAt: string | null;
    resolvedAt: string | null;
    closedAt: string | null;
    createdAt: string | null;
};

type ComplaintListResponse = {
    data: ComplaintRow[];
    total: number;
    page: number;
    pageSize: number;
};

type UserOption = { id: string; name: string };

const PAGE_SIZE = 25;

const STATUS_STYLES: Record<string, string> = {
    open: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    resolved: "bg-[#d1fae5] text-[#059669] dark:bg-emerald-900/40 dark:text-emerald-300",
    closed: "bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_LABELS: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

export default function ServiceComplaintList() {
    const { toast } = useToast();

    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [page, setPage] = useState(1);

    const [columns, setColumns] = useState({
        company: true,
        person: true,
        service: true,
        priority: true,
        status: true,
        detail: true,
        date: true,
    });

    // Create form state
    const [createOpen, setCreateOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newPriority, setNewPriority] = useState("medium");
    const [newDueDate, setNewDueDate] = useState("");

    // Lifecycle dialogs
    const [assignTarget, setAssignTarget] = useState<ComplaintRow | null>(null);
    const [assignTo, setAssignTo] = useState("");
    const [resolveTarget, setResolveTarget] = useState<ComplaintRow | null>(null);
    const [resolveRemarks, setResolveRemarks] = useState("");
    const [closeTarget, setCloseTarget] = useState<ComplaintRow | null>(null);
    const [closeRemarks, setCloseRemarks] = useState("");

    // Debounce search, reset page when filters change
    useEffect(() => {
        const t = setTimeout(() => {
            setSearchTerm(searchInput);
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [statusFilter, priorityFilter]);

    const queryParams = new URLSearchParams();
    queryParams.set("page", String(page));
    queryParams.set("pageSize", String(PAGE_SIZE));
    if (searchTerm.trim()) queryParams.set("search", searchTerm.trim());
    if (statusFilter !== "all") queryParams.set("status", statusFilter);
    if (priorityFilter !== "all") queryParams.set("priority", priorityFilter);
    const queryString = queryParams.toString();

    const { data: response, isLoading } = useQuery<ComplaintListResponse>({
        queryKey: ["/api/service/complaints", queryString],
        queryFn: () => apiRequestJson<ComplaintListResponse>("GET", `/api/service/complaints?${queryString}`),
    });

    const { data: users } = useQuery<UserOption[]>({
        queryKey: ["/api/users", "complaint-assign"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            const data = await res.json();
            return (data.users || []) as UserOption[];
        },
    });

    const rows = response?.data ?? [];
    const total = response?.total ?? 0;
    const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
    const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endEntry = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/service/complaints"] });
    };

    const createMutation = useMutation({
        mutationFn: () =>
            apiRequestJson("POST", "/api/service/complaints", {
                title: newTitle.trim(),
                description: newDescription.trim() || undefined,
                priority: newPriority,
                dueDate: newDueDate || undefined,
            }),
        onSuccess: () => {
            toast({ title: "Complaint created" });
            setCreateOpen(false);
            setNewTitle("");
            setNewDescription("");
            setNewPriority("medium");
            setNewDueDate("");
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to create complaint", description: err?.message, variant: "destructive" });
        },
    });

    const assignMutation = useMutation({
        mutationFn: (vars: { id: string; assignedTo: string }) =>
            apiRequestJson("PATCH", `/api/service/complaints/${vars.id}/assign`, { assignedTo: vars.assignedTo }),
        onSuccess: () => {
            toast({ title: "Complaint assigned" });
            setAssignTarget(null);
            setAssignTo("");
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to assign", description: err?.message, variant: "destructive" });
        },
    });

    const resolveMutation = useMutation({
        mutationFn: (vars: { id: string; remarks: string }) =>
            apiRequestJson("PATCH", `/api/service/complaints/${vars.id}/resolve`, { remarks: vars.remarks }),
        onSuccess: () => {
            toast({ title: "Complaint resolved" });
            setResolveTarget(null);
            setResolveRemarks("");
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to resolve", description: err?.message, variant: "destructive" });
        },
    });

    const closeMutation = useMutation({
        mutationFn: (vars: { id: string; remarks?: string }) =>
            apiRequestJson("PATCH", `/api/service/complaints/${vars.id}/close`, { remarks: vars.remarks }),
        onSuccess: () => {
            toast({ title: "Complaint closed" });
            setCloseTarget(null);
            setCloseRemarks("");
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to close", description: err?.message, variant: "destructive" });
        },
    });

    const reopenMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("PATCH", `/api/service/complaints/${id}/reopen`),
        onSuccess: () => {
            toast({ title: "Complaint reopened" });
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to reopen", description: err?.message, variant: "destructive" });
        },
    });

    const handleCopy = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join("\t");
        const body = rows.map((row, idx) => {
            const rowData: string[] = [(startEntry + idx).toString()];
            if (columns.company) rowData.push(row.companyName ?? "");
            if (columns.person) rowData.push(row.personName ?? "");
            if (columns.service) rowData.push(row.title ?? "");
            if (columns.priority) rowData.push(row.priority ?? "");
            if (columns.status) rowData.push(STATUS_LABELS[row.status] ?? row.status);
            if (columns.detail) rowData.push(row.description ?? "");
            if (columns.date) rowData.push(formatDate(row.createdAt));
            return rowData.join("\t");
        }).join("\n");
        navigator.clipboard.writeText(`${headers}\n${body}`);
        toast({ title: "Table data copied to clipboard!" });
    };

    const handleExcel = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join(",");
        const body = rows.map((row, idx) => {
            const rowData: string[] = [(startEntry + idx).toString()];
            if (columns.company) rowData.push(`"${row.companyName ?? ""}"`);
            if (columns.person) rowData.push(`"${row.personName ?? ""}"`);
            if (columns.service) rowData.push(`"${row.title ?? ""}"`);
            if (columns.priority) rowData.push(`"${row.priority ?? ""}"`);
            if (columns.status) rowData.push(`"${STATUS_LABELS[row.status] ?? row.status}"`);
            if (columns.detail) rowData.push(`"${row.description ?? ""}"`);
            if (columns.date) rowData.push(`"${formatDate(row.createdAt)}"`);
            return rowData.join(",");
        }).join("\n");
        const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "complaint-list.csv";
        a.click();
    };

    const handlePDF = () => {
        window.print();
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen printable-area dark:bg-zinc-950">
            {/* Header Title */}
            <div className="mb-4 flex items-center gap-2 text-[#059669] dark:text-zinc-400">
                <ArrowRight className="w-5 h-5" />
                <h2 className="text-[17px] font-bold uppercase tracking-tight text-[#475569] dark:text-zinc-400">
                    COMPLAINT LIST
                </h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">View Detail</h3>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-[#059669] hover:bg-emerald-700 text-white h-8 px-3 text-[13px] font-medium print:hidden"
                        data-testid="button-new-complaint"
                    >
                        <Plus className="w-4 h-4 mr-1" /> New Complaint
                    </Button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 print:hidden">
                    {/* Top Left Buttons */}
                    <div className="flex bg-[#64748b] rounded-[4px] overflow-hidden">
                        <button onClick={handleCopy} className="px-4 py-2 text-white text-[13px] font-medium hover:bg-[#475569] border-r border-[#475569]/50 transition-colors dark:border-zinc-800">
                            Copy
                        </button>
                        <button onClick={handleExcel} className="px-4 py-2 text-white text-[13px] font-medium hover:bg-[#475569] border-r border-[#475569]/50 transition-colors dark:border-zinc-800">
                            Excel
                        </button>
                        <button onClick={handlePDF} className="px-4 py-2 text-white text-[13px] font-medium hover:bg-[#475569] border-r border-[#475569]/50 transition-colors dark:border-zinc-800">
                            PDF
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="px-4 py-2 text-white text-[13px] font-medium hover:bg-[#475569] transition-colors">
                                    Column visibility
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuCheckboxItem checked={columns.company} onCheckedChange={(v) => setColumns(p => ({ ...p, company: v }))}>Company</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.person} onCheckedChange={(v) => setColumns(p => ({ ...p, person: v }))}>Person</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.service} onCheckedChange={(v) => setColumns(p => ({ ...p, service: v }))}>Service</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.priority} onCheckedChange={(v) => setColumns(p => ({ ...p, priority: v }))}>Priority</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.status} onCheckedChange={(v) => setColumns(p => ({ ...p, status: v }))}>Status</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.detail} onCheckedChange={(v) => setColumns(p => ({ ...p, detail: v }))}>Detail</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.date} onCheckedChange={(v) => setColumns(p => ({ ...p, date: v }))}>Date</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Filters + Search */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 w-36 text-[13px] border-slate-300 rounded-[4px] dark:border-zinc-800" data-testid="select-status-filter">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolved</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-8 w-36 text-[13px] border-slate-300 rounded-[4px] dark:border-zinc-800" data-testid="select-priority-filter">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="text-[13px] text-slate-600 font-medium dark:text-zinc-300">Search:</span>
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="h-8 w-48 text-[13px] border-slate-300 rounded-[4px] dark:border-zinc-800"
                            data-testid="input-search"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border-t border-l border-r border-slate-200 dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#d1fae5] border-b border-slate-200 hover:bg-[#d1fae5] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 w-16 dark:text-zinc-100">#</TableHead>
                                {columns.company && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Company</TableHead>}
                                {columns.person && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Person</TableHead>}
                                {columns.service && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Service</TableHead>}
                                {columns.priority && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Priority</TableHead>}
                                {columns.status && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Status</TableHead>}
                                {columns.detail && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Detail</TableHead>}
                                {columns.date && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Date</TableHead>}
                                <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 print:hidden dark:text-zinc-100">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={row.id} className="border-b border-slate-200 dark:border-zinc-800" data-testid={`row-complaint-${row.id}`}>
                                        <TableCell className="py-2 text-[13px]">{startEntry + idx}</TableCell>
                                        {columns.company && <TableCell className="py-2 text-[13px]">{row.companyName ?? "—"}</TableCell>}
                                        {columns.person && <TableCell className="py-2 text-[13px]">{row.personName ?? "—"}</TableCell>}
                                        {columns.service && <TableCell className="py-2 text-[13px]">{row.title ?? "—"}</TableCell>}
                                        {columns.priority && <TableCell className="py-2 text-[13px] capitalize">{row.priority ?? "—"}</TableCell>}
                                        {columns.status && (
                                            <TableCell className="py-2 text-[13px]">
                                                <span className={`px-2 py-0.5 rounded-[4px] text-[12px] font-bold ${STATUS_STYLES[row.status] ?? "bg-slate-100 text-slate-600"}`}>
                                                    {STATUS_LABELS[row.status] ?? row.status}
                                                </span>
                                            </TableCell>
                                        )}
                                        {columns.detail && <TableCell className="py-2 text-[13px]">{row.description ?? "—"}</TableCell>}
                                        {columns.date && <TableCell className="py-2 text-[13px]">{formatDate(row.createdAt)}</TableCell>}
                                        <TableCell className="py-2 text-[13px] print:hidden">
                                            <div className="flex flex-wrap gap-1">
                                                {row.status !== "closed" && (
                                                    <button
                                                        onClick={() => { setAssignTarget(row); setAssignTo(row.assignedTo ?? ""); }}
                                                        className="px-2 py-1 text-[12px] font-medium rounded-[4px] bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                                                        data-testid={`button-assign-${row.id}`}
                                                    >
                                                        Assign
                                                    </button>
                                                )}
                                                {(row.status === "open" || row.status === "in_progress") && (
                                                    <button
                                                        onClick={() => { setResolveTarget(row); setResolveRemarks(""); }}
                                                        className="px-2 py-1 text-[12px] font-medium rounded-[4px] bg-emerald-50 text-[#059669] hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
                                                        data-testid={`button-resolve-${row.id}`}
                                                    >
                                                        Resolve
                                                    </button>
                                                )}
                                                {row.status !== "closed" && (
                                                    <button
                                                        onClick={() => { setCloseTarget(row); setCloseRemarks(""); }}
                                                        className="px-2 py-1 text-[12px] font-medium rounded-[4px] bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                                                        data-testid={`button-close-${row.id}`}
                                                    >
                                                        Close
                                                    </button>
                                                )}
                                                {(row.status === "resolved" || row.status === "closed") && (
                                                    <button
                                                        onClick={() => reopenMutation.mutate(row.id)}
                                                        disabled={reopenMutation.isPending}
                                                        className="px-2 py-1 text-[12px] font-medium rounded-[4px] bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-300"
                                                        data-testid={`button-reopen-${row.id}`}
                                                    >
                                                        Reopen
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

                {/* Footer Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-4 text-[13px] text-slate-500 print:hidden dark:text-zinc-400">
                    <div data-testid="text-pagination-info">
                        Showing {total === 0 ? "0 to 0 of 0" : `${startEntry} to ${endEntry} of ${total}`} entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className={`px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] bg-white dark:bg-zinc-900 dark:border-zinc-800 ${page <= 1 ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300"}`}
                            data-testid="button-previous"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className={`px-3 py-1.5 border border-slate-200 rounded-r-[4px] bg-white dark:bg-zinc-900 dark:border-zinc-800 ${page >= totalPages ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50 dark:text-zinc-300"}`}
                            data-testid="button-next"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* New Complaint Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-md dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-bold text-[#475569] dark:text-zinc-400">New Complaint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Title *</label>
                            <Input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"
                                data-testid="input-new-title"
                            />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Description</label>
                            <Textarea
                                value={newDescription}
                                onChange={(e) => setNewDescription(e.target.value)}
                                className="text-[13px] border-slate-200 min-h-[80px] dark:border-zinc-800"
                                data-testid="input-new-description"
                            />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Priority</label>
                            <Select value={newPriority} onValueChange={setNewPriority}>
                                <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800" data-testid="select-new-priority">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Due Date</label>
                            <Input
                                type="date"
                                value={newDueDate}
                                onChange={(e) => setNewDueDate(e.target.value)}
                                className="h-9 text-[13px] border-slate-200 dark:border-zinc-800"
                                data-testid="input-new-due-date"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-9 text-[13px]">Cancel</Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={!newTitle.trim() || createMutation.isPending}
                            className="bg-[#059669] hover:bg-emerald-700 text-white h-9 text-[13px]"
                            data-testid="button-submit-complaint"
                        >
                            Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Dialog */}
            <Dialog open={!!assignTarget} onOpenChange={(o) => { if (!o) setAssignTarget(null); }}>
                <DialogContent className="max-w-md dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-bold text-[#475569] dark:text-zinc-400">Assign Complaint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Assign To *</label>
                        <Select value={assignTo} onValueChange={setAssignTo}>
                            <SelectTrigger className="h-9 text-[13px] border-slate-200 dark:border-zinc-800" data-testid="select-assign-to">
                                <SelectValue placeholder="Select a person" />
                            </SelectTrigger>
                            <SelectContent>
                                {(users ?? []).map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignTarget(null)} className="h-9 text-[13px]">Cancel</Button>
                        <Button
                            onClick={() => assignTarget && assignMutation.mutate({ id: assignTarget.id, assignedTo: assignTo })}
                            disabled={!assignTo || assignMutation.isPending}
                            className="bg-[#059669] hover:bg-emerald-700 text-white h-9 text-[13px]"
                            data-testid="button-submit-assign"
                        >
                            Assign
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resolve Dialog */}
            <Dialog open={!!resolveTarget} onOpenChange={(o) => { if (!o) setResolveTarget(null); }}>
                <DialogContent className="max-w-md dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-bold text-[#475569] dark:text-zinc-400">Resolve Complaint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Resolution Remarks *</label>
                        <Textarea
                            value={resolveRemarks}
                            onChange={(e) => setResolveRemarks(e.target.value)}
                            className="text-[13px] border-slate-200 min-h-[80px] dark:border-zinc-800"
                            data-testid="input-resolve-remarks"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResolveTarget(null)} className="h-9 text-[13px]">Cancel</Button>
                        <Button
                            onClick={() => resolveTarget && resolveMutation.mutate({ id: resolveTarget.id, remarks: resolveRemarks.trim() })}
                            disabled={!resolveRemarks.trim() || resolveMutation.isPending}
                            className="bg-[#059669] hover:bg-emerald-700 text-white h-9 text-[13px]"
                            data-testid="button-submit-resolve"
                        >
                            Resolve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Close Dialog */}
            <Dialog open={!!closeTarget} onOpenChange={(o) => { if (!o) setCloseTarget(null); }}>
                <DialogContent className="max-w-md dark:bg-zinc-900">
                    <DialogHeader>
                        <DialogTitle className="text-[16px] font-bold text-[#475569] dark:text-zinc-400">Close Complaint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Remarks (optional)</label>
                        <Textarea
                            value={closeRemarks}
                            onChange={(e) => setCloseRemarks(e.target.value)}
                            className="text-[13px] border-slate-200 min-h-[80px] dark:border-zinc-800"
                            data-testid="input-close-remarks"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseTarget(null)} className="h-9 text-[13px]">Cancel</Button>
                        <Button
                            onClick={() => closeTarget && closeMutation.mutate({ id: closeTarget.id, remarks: closeRemarks.trim() || undefined })}
                            disabled={closeMutation.isPending}
                            className="bg-[#059669] hover:bg-emerald-700 text-white h-9 text-[13px]"
                            data-testid="button-submit-close"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
