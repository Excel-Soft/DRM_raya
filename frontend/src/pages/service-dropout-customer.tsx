import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type RowData = {
    id: string;
    companyName: string | null;
    personName: string | null;
    reason: string | null;
    serviceTypes: string[] | string | null;
    recoveryNote: string | null;
    createdAt: string | null;
};

type ApiResponse = { data: RowData[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;

function fmtDate(v: string | null | undefined): string {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

function txt(v: string | null | undefined): string {
    return v == null || v === "" ? "—" : v;
}

function listTxt(v: string[] | string | null | undefined): string {
    if (v == null) return "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    return v === "" ? "—" : String(v);
}

export default function ServiceDropoutCustomer() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const [columns, setColumns] = useState({
        company: true,
        person: true,
        purpose: true,
        service: true,
        note: true,
        date: true
    });

    const { data, isLoading } = useQuery<ApiResponse>({
        queryKey: ["/api/service/dropouts", page, debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", String(PAGE_SIZE));
            if (debouncedSearch) params.set("search", debouncedSearch);
            return apiRequestJson("GET", `/api/service/dropouts?${params.toString()}`);
        },
    });

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);

    const handleCopy = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join("\t");
        const body = rows.map((row, idx) => {
            const rowData: string[] = [(from + idx).toString()];
            if (columns.company) rowData.push(txt(row.companyName));
            if (columns.person) rowData.push(txt(row.personName));
            if (columns.purpose) rowData.push(txt(row.reason));
            if (columns.service) rowData.push(listTxt(row.serviceTypes));
            if (columns.note) rowData.push(txt(row.recoveryNote));
            if (columns.date) rowData.push(fmtDate(row.createdAt));
            return rowData.join("\t");
        }).join("\n");
        navigator.clipboard.writeText(`${headers}\n${body}`);
        alert("Table data copied to clipboard!");
    };

    const handleExcel = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join(",");
        const body = rows.map((row, idx) => {
            const rowData: string[] = [(from + idx).toString()];
            if (columns.company) rowData.push(`"${txt(row.companyName)}"`);
            if (columns.person) rowData.push(`"${txt(row.personName)}"`);
            if (columns.purpose) rowData.push(`"${txt(row.reason)}"`);
            if (columns.service) rowData.push(`"${listTxt(row.serviceTypes)}"`);
            if (columns.note) rowData.push(`"${txt(row.recoveryNote)}"`);
            if (columns.date) rowData.push(`"${fmtDate(row.createdAt)}"`);
            return rowData.join(",");
        }).join("\n");
        const blob = new Blob([`${headers}\n${body}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dropout-customer.csv";
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
                    DROPOUT CUSTOMER
                </h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="mb-4">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">View Detail</h3>
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
                                <DropdownMenuCheckboxItem checked={columns.purpose} onCheckedChange={(v) => setColumns(p => ({ ...p, purpose: v }))}>Purpose</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.service} onCheckedChange={(v) => setColumns(p => ({ ...p, service: v }))}>Service</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.note} onCheckedChange={(v) => setColumns(p => ({ ...p, note: v }))}>Note</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.date} onCheckedChange={(v) => setColumns(p => ({ ...p, date: v }))}>Date</DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Top Right Search */}
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] text-slate-600 font-medium dark:text-zinc-300">Search:</span>
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                {columns.person && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Person</TableHead>}
                                {columns.purpose && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Purpose</TableHead>}
                                {columns.service && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Service</TableHead>}
                                {columns.note && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Note</TableHead>}
                                {columns.date && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Date</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={row.id} className="border-b border-slate-200 dark:border-zinc-800">
                                        <TableCell className="py-2 text-[13px]">{from + idx}</TableCell>
                                        {columns.company && <TableCell className="py-2 text-[13px]">{txt(row.companyName)}</TableCell>}
                                        {columns.person && <TableCell className="py-2 text-[13px]">{txt(row.personName)}</TableCell>}
                                        {columns.purpose && <TableCell className="py-2 text-[13px]">{txt(row.reason)}</TableCell>}
                                        {columns.service && <TableCell className="py-2 text-[13px]">{listTxt(row.serviceTypes)}</TableCell>}
                                        {columns.note && <TableCell className="py-2 text-[13px]">{txt(row.recoveryNote)}</TableCell>}
                                        {columns.date && <TableCell className="py-2 text-[13px]">{fmtDate(row.createdAt)}</TableCell>}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-4 text-[13px] text-slate-500 print:hidden dark:text-zinc-400">
                    <div>
                        Showing {from} to {to} of {total} entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className={`px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] bg-white dark:bg-zinc-900 dark:border-zinc-800 ${page <= 1 ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className={`px-3 py-1.5 border border-slate-200 rounded-r-[4px] bg-white dark:bg-zinc-900 dark:border-zinc-800 ${page >= totalPages ? "text-slate-400 cursor-not-allowed" : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
