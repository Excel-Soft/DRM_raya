import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight, Plus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DocRow = {
    id: string;
    customerId: string | null;
    companyName: string | null;
    personName: string | null;
    grade: string | null;
    docType: string;
    name: string;
    url: string | null;
    packageName: string | null;
    verificationStatus: string;
    dueDate: string | null;
    remarks: string | null;
    uploadedByName: string | null;
    createdAt: string | null;
};

type ListResponse = { data: DocRow[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    };
    return <Badge className={`${map[status] || map.pending} border-0 capitalize`}>{status}</Badge>;
}

export default function ServiceVasDocumentList() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<DocRow | null>(null);
    const [form, setForm] = useState({ name: "", url: "", packageName: "", dueDate: "", remarks: "" });

    const [columns, setColumns] = useState({
        company: true,
        name: true,
        person: true,
        grade: true,
        status: true,
        dueDate: true,
    });

    const queryString = new URLSearchParams({
        docType: "VAS",
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(searchTerm ? { search: searchTerm } : {}),
    }).toString();

    const { data, isLoading } = useQuery<ListResponse>({
        queryKey: ["/api/service/documents", "VAS", page, searchTerm],
        queryFn: () => apiRequestJson<ListResponse>("GET", `/api/service/documents?${queryString}`),
    });

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endEntry = Math.min(page * PAGE_SIZE, total);

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/service/documents", "VAS"] });

    const createMutation = useMutation({
        mutationFn: (payload: any) => apiRequestJson("POST", "/api/service/documents", payload),
        onSuccess: () => {
            invalidate();
            toast({ title: "Document created" });
            closeForm();
        },
        onError: (err: any) => toast({ title: "Failed to create", description: err?.message, variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: any }) => apiRequestJson("PATCH", `/api/service/documents/${id}`, payload),
        onSuccess: () => {
            invalidate();
            toast({ title: "Document updated" });
            closeForm();
        },
        onError: (err: any) => toast({ title: "Failed to update", description: err?.message, variant: "destructive" }),
    });

    const verifyMutation = useMutation({
        mutationFn: ({ id, verificationStatus }: { id: string; verificationStatus: string }) =>
            apiRequestJson("PATCH", `/api/service/documents/${id}/verify`, { verificationStatus }),
        onSuccess: () => {
            invalidate();
            toast({ title: "Verification updated" });
        },
        onError: (err: any) => toast({ title: "Failed to verify", description: err?.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("DELETE", `/api/service/documents/${id}`),
        onSuccess: () => {
            invalidate();
            toast({ title: "Document deleted" });
        },
        onError: (err: any) => toast({ title: "Failed to delete", description: err?.message, variant: "destructive" }),
    });

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", url: "", packageName: "", dueDate: "", remarks: "" });
        setFormOpen(true);
    };

    const openEdit = (row: DocRow) => {
        setEditing(row);
        setForm({
            name: row.name || "",
            url: row.url || "",
            packageName: row.packageName || "",
            dueDate: row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : "",
            remarks: row.remarks || "",
        });
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditing(null);
    };

    const handleSubmit = () => {
        if (!form.name.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        const payload = {
            docType: "VAS",
            name: form.name.trim(),
            url: form.url.trim() || undefined,
            packageName: form.packageName.trim() || undefined,
            dueDate: form.dueDate || undefined,
            remarks: form.remarks.trim() || undefined,
        };
        if (editing) {
            updateMutation.mutate({ id: editing.id, payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleCopy = () => {
        const headers = ["#", "Company", "Name", "Person", "Grade", "Status", "Due Date"].join("\t");
        const body = rows.map((row, idx) =>
            [idx + 1, row.companyName || "", row.name || "", row.personName || "", row.grade || "", row.verificationStatus, formatDate(row.dueDate)].join("\t")
        ).join("\n");
        navigator.clipboard.writeText(`${headers}\n${body}`);
        toast({ title: "Table data copied to clipboard!" });
    };

    const handleExcel = () => {
        const headers = ["#", "Company", "Name", "Person", "Grade", "Status", "Due Date"].join(",");
        const body = rows.map((row, idx) =>
            [idx + 1, `"${row.companyName || ""}"`, `"${row.name || ""}"`, `"${row.personName || ""}"`, `"${row.grade || ""}"`, `"${row.verificationStatus}"`, `"${formatDate(row.dueDate)}"`].join(",")
        ).join("\n");
        const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "vas-document.csv";
        a.click();
    };

    const handlePDF = () => {
        window.print();
    };

    const visibleColCount = 1 + Object.values(columns).filter(Boolean).length + 1;

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen printable-area dark:bg-zinc-950">
            {/* Header Title */}
            <div className="mb-4 flex items-center gap-2 text-[#059669] dark:text-zinc-400">
                <ArrowRight className="w-5 h-5" />
                <h2 className="text-[17px] font-bold uppercase tracking-tight text-[#475569] dark:text-zinc-400">
                    VAS DOCUMENT
                </h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">View Detail</h3>
                    <Button onClick={openCreate} size="sm" className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] print:hidden">
                        <Plus className="w-4 h-4 mr-1" /> New Document
                    </Button>
                </div>
                <p className="text-[12px] text-slate-400 mb-3 dark:text-zinc-500">
                    Attachments are stored as links (http/https URLs). There is no file upload storage.
                </p>

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
                                <DropdownMenuCheckboxItem checked={columns.name} onCheckedChange={(v) => setColumns(p => ({ ...p, name: v }))}>Name</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.person} onCheckedChange={(v) => setColumns(p => ({ ...p, person: v }))}>Person</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.grade} onCheckedChange={(v) => setColumns(p => ({ ...p, grade: v }))}>Grade</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.status} onCheckedChange={(v) => setColumns(p => ({ ...p, status: v }))}>Status</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.dueDate} onCheckedChange={(v) => setColumns(p => ({ ...p, dueDate: v }))}>Due Date</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Top Right Search */}
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-slate-600 font-medium dark:text-zinc-300">Search:</span>
                        <Input
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            className="h-8 w-48 text-[13px] border-slate-300 rounded-[4px] dark:border-zinc-800"
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
                                {columns.name && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Name</TableHead>}
                                {columns.person && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Person</TableHead>}
                                {columns.grade && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Grade</TableHead>}
                                {columns.status && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Status</TableHead>}
                                {columns.dueDate && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Due Date</TableHead>}
                                <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100 print:hidden">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColCount} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={visibleColCount} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={row.id} className="border-b border-slate-200 dark:border-zinc-800">
                                        <TableCell className="py-2 text-[13px]">{startEntry + idx}</TableCell>
                                        {columns.company && <TableCell className="py-2 text-[13px]">{row.companyName || "—"}</TableCell>}
                                        {columns.name && (
                                            <TableCell className="py-2 text-[13px]">
                                                {row.url ? (
                                                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-[#059669] underline">{row.name}</a>
                                                ) : (row.name || "—")}
                                            </TableCell>
                                        )}
                                        {columns.person && <TableCell className="py-2 text-[13px]">{row.personName || "—"}</TableCell>}
                                        {columns.grade && <TableCell className="py-2 text-[13px]">{row.grade || "—"}</TableCell>}
                                        {columns.status && <TableCell className="py-2 text-[13px]"><StatusBadge status={row.verificationStatus} /></TableCell>}
                                        {columns.dueDate && <TableCell className="py-2 text-[13px]">{formatDate(row.dueDate)}</TableCell>}
                                        <TableCell className="py-2 text-[13px] print:hidden">
                                            <div className="flex items-center gap-2">
                                                <Select value={row.verificationStatus} onValueChange={(v) => verifyMutation.mutate({ id: row.id, verificationStatus: v })}>
                                                    <SelectTrigger className="h-8 w-28 text-[12px]"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Pending</SelectItem>
                                                        <SelectItem value="verified">Verified</SelectItem>
                                                        <SelectItem value="rejected">Rejected</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(row.id); }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
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
                    <div>
                        Showing {total === 0 ? "0 to 0 of 0" : `${startEntry} to ${endEntry} of ${total}`} entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] bg-white disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded-r-[4px] bg-white disabled:text-slate-400 disabled:cursor-not-allowed text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={(o) => { if (!o) closeForm(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editing ? "Edit VAS Document" : "New VAS Document"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Name *</label>
                            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-[13px]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Attachment URL (http/https)</label>
                            <Input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." className="h-9 text-[13px]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Package Name</label>
                            <Input value={form.packageName} onChange={(e) => setForm(f => ({ ...f, packageName: e.target.value }))} className="h-9 text-[13px]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Due Date</label>
                            <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} className="h-9 text-[13px]" />
                        </div>
                        <div>
                            <label className="text-[12px] font-medium text-slate-700 mb-1 block dark:text-zinc-400">Remarks</label>
                            <Textarea value={form.remarks} onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))} className="text-[13px] min-h-[60px]" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeForm}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#059669] hover:bg-[#047857] text-white">
                            {editing ? "Save" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
