import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ServiceCustomer = {
    id: number | string;
    companyName: string | null;
    accountName: string | null;
    grade: string | null;
    status?: string | null;
    executiveName?: string | null;
    createdAt: string | null;
};

type CustomerListResponse = {
    data: ServiceCustomer[];
    total: number;
    page: number;
    pageSize: number;
};

const PAGE_SIZE = 25;
const GRADE = "B_PLUS";

export default function ServiceBPlusCustomer() {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);

    const [columns, setColumns] = useState({
        company: true,
        person: true,
        grade: true,
        date: true
    });

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const { data, isLoading } = useQuery<CustomerListResponse>({
        queryKey: ["/api/service/customers", GRADE, page, debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("grade", GRADE);
            params.set("page", String(page));
            params.set("pageSize", String(PAGE_SIZE));
            if (debouncedSearch) params.set("search", debouncedSearch);
            return apiRequestJson("GET", `/api/service/customers?${params.toString()}`);
        },
    });

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endEntry = Math.min(page * PAGE_SIZE, total);

    const formatDate = (d: string | null | undefined) => {
        if (!d) return "—";
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString();
    };

    const handleCopy = () => {
        const header = ["#"];
        if (columns.company) header.push("Company");
        if (columns.person) header.push("Person");
        if (columns.grade) header.push("Grade");
        if (columns.date) header.push("Date");
        const lines = rows.map((row, idx) => {
            const r: string[] = [String(startEntry + idx)];
            if (columns.company) r.push(row.companyName ?? "");
            if (columns.person) r.push(row.accountName ?? "");
            if (columns.grade) r.push(row.grade ?? "");
            if (columns.date) r.push(formatDate(row.createdAt));
            return r.join("\t");
        });
        navigator.clipboard.writeText([header.join("\t"), ...lines].join("\n"));
        alert("Table data copied to clipboard!");
    };

    const handleExcel = () => {
        const header = ["#"];
        if (columns.company) header.push("Company");
        if (columns.person) header.push("Person");
        if (columns.grade) header.push("Grade");
        if (columns.date) header.push("Date");
        const lines = rows.map((row, idx) => {
            const r: string[] = [String(startEntry + idx)];
            if (columns.company) r.push(`"${row.companyName ?? ""}"`);
            if (columns.person) r.push(`"${row.accountName ?? ""}"`);
            if (columns.grade) r.push(`"${row.grade ?? ""}"`);
            if (columns.date) r.push(`"${formatDate(row.createdAt)}"`);
            return r.join(",");
        });
        const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "b-plus-customer.csv";
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
                    B+ CUSTOMER
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
                                <DropdownMenuCheckboxItem checked={columns.grade} onCheckedChange={(v) => setColumns(p => ({ ...p, grade: v }))}>Grade</DropdownMenuCheckboxItem>
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
                                {columns.grade && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Grade</TableHead>}
                                {columns.date && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Date</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        {isLoading ? "Loading..." : "No data available in table"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row, idx) => (
                                    <TableRow key={row.id} className="border-b border-slate-200 dark:border-zinc-800">
                                        <TableCell className="py-2 text-[13px]">{startEntry + idx}</TableCell>
                                        {columns.company && <TableCell className="py-2 text-[13px]">{row.companyName ?? "—"}</TableCell>}
                                        {columns.person && <TableCell className="py-2 text-[13px]">{row.accountName ?? "—"}</TableCell>}
                                        {columns.grade && <TableCell className="py-2 text-[13px]">{row.grade ?? "—"}</TableCell>}
                                        {columns.date && <TableCell className="py-2 text-[13px]">{formatDate(row.createdAt)}</TableCell>}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-4 text-[13px] text-slate-500 print:hidden dark:text-zinc-400">
                    <div>
                        Showing {startEntry} to {endEntry} of {total} entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] bg-white text-slate-600 hover:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 border border-slate-200 rounded-r-[4px] bg-white text-slate-600 hover:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
