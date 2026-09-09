import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequestJson } from "@/lib/queryClient";

type RowData = {
    id: string;
    customerId: string | null;
    companyName: string | null;
    executiveName: string | null;
    packageName: string | null;
    total: number | string | null;
    dueDate: string | null;
    paymentStatus: string | null;
    agingBucket: string | null;
};

type ListResponse = { data: RowData[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 25;

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

function formatAmount(value: number | string | null): string {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (Number.isNaN(n)) return "—";
    return n.toString();
}

export default function ServiceDueVasPayment() {
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);

    const [columns, setColumns] = useState({
        companyName: true,
        salePerson: true,
        packageName: true,
        total: true,
        status: true,
        date: true,
    });

    const queryString = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        ...(searchTerm ? { search: searchTerm } : {}),
    }).toString();

    const { data, isLoading } = useQuery<ListResponse>({
        queryKey: ["/api/service/payments/due", page, searchTerm],
        queryFn: () => apiRequestJson<ListResponse>("GET", `/api/service/payments/due?${queryString}`),
    });

    const rows = data?.data ?? [];
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endEntry = Math.min(page * PAGE_SIZE, total);

    const sumTotal = rows.reduce((acc, row) => {
        const n = Number(row.total);
        return acc + (Number.isNaN(n) ? 0 : n);
    }, 0);

    const handleCopy = () => {
        const headers = ["No.", "Company Name", "Sale Person", "Package", "Total", "Status", "Date"].join("\t");
        const body = rows.map((row, idx) =>
            [startEntry + idx, row.companyName || "", row.executiveName || "", row.packageName || "", formatAmount(row.total), row.paymentStatus || "", formatDate(row.dueDate)].join("\t")
        );
        body.push(["Total", "", "", "", sumTotal.toString(), "", ""].join("\t"));
        navigator.clipboard.writeText(`${headers}\n${body.join("\n")}`);
        alert("Table data copied to clipboard!");
    };

    const handleExcel = () => {
        const headers = ["No.", "Company Name", "Sale Person", "Package", "Total", "Status", "Date"].join(",");
        const body = rows.map((row, idx) =>
            [startEntry + idx, `"${row.companyName || ""}"`, `"${row.executiveName || ""}"`, `"${row.packageName || ""}"`, `"${formatAmount(row.total)}"`, `"${row.paymentStatus || ""}"`, `"${formatDate(row.dueDate)}"`].join(",")
        );
        body.push(["Total", '""', '""', '""', `"${sumTotal}"`, '""', '""'].join(","));
        const blob = new Blob([`${headers}\n${body.join("\n")}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "due-vas-payment.csv";
        a.click();
    };

    const handlePDF = () => {
        window.print();
    };

    const visibleColCount = 1 + Object.values(columns).filter(Boolean).length;

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen printable-area dark:bg-zinc-950">
            {/* Header Title */}
            <div className="mb-4 flex items-center gap-2 text-[#059669] dark:text-zinc-400">
                <ArrowRight className="w-5 h-5" />
                <h2 className="text-[17px] font-bold uppercase tracking-tight text-[#475569] dark:text-zinc-400">
                    DUE VAS PAYMENT
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
                                <DropdownMenuCheckboxItem checked={columns.companyName} onCheckedChange={(v) => setColumns(p => ({ ...p, companyName: v }))}>Company Name</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.salePerson} onCheckedChange={(v) => setColumns(p => ({ ...p, salePerson: v }))}>Sale Person</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.packageName} onCheckedChange={(v) => setColumns(p => ({ ...p, packageName: v }))}>Package</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.total} onCheckedChange={(v) => setColumns(p => ({ ...p, total: v }))}>Total</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.status} onCheckedChange={(v) => setColumns(p => ({ ...p, status: v }))}>Status</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.date} onCheckedChange={(v) => setColumns(p => ({ ...p, date: v }))}>Date</DropdownMenuCheckboxItem>
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
                                <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 w-16 dark:text-zinc-100">No.</TableHead>
                                {columns.companyName && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Company Name</TableHead>}
                                {columns.salePerson && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Sale Person</TableHead>}
                                {columns.packageName && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Package</TableHead>}
                                {columns.total && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Total</TableHead>}
                                {columns.status && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Status</TableHead>}
                                {columns.date && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Date</TableHead>}
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
                                <>
                                    {rows.map((row, idx) => (
                                        <TableRow key={row.id} className="border-b border-slate-200 dark:border-zinc-800">
                                            <TableCell className="py-2 text-[13px]">{startEntry + idx}</TableCell>
                                            {columns.companyName && <TableCell className="py-2 text-[13px]">{row.companyName || "—"}</TableCell>}
                                            {columns.salePerson && <TableCell className="py-2 text-[13px]">{row.executiveName || "—"}</TableCell>}
                                            {columns.packageName && <TableCell className="py-2 text-[13px]">{row.packageName || "—"}</TableCell>}
                                            {columns.total && <TableCell className="py-2 text-[13px]">{formatAmount(row.total)}</TableCell>}
                                            {columns.status && <TableCell className="py-2 text-[13px] capitalize">{row.paymentStatus ? row.paymentStatus.replace(/_/g, " ") : "—"}</TableCell>}
                                            {columns.date && <TableCell className="py-2 text-[13px]">{formatDate(row.dueDate)}</TableCell>}
                                        </TableRow>
                                    ))}
                                    {/* Total Row */}
                                    <TableRow className="border-b border-slate-200 bg-white font-bold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                        <TableCell className="py-2 text-[13px]">Total</TableCell>
                                        {columns.companyName && <TableCell className="py-2 text-[13px]"></TableCell>}
                                        {columns.salePerson && <TableCell className="py-2 text-[13px]"></TableCell>}
                                        {columns.packageName && <TableCell className="py-2 text-[13px]"></TableCell>}
                                        {columns.total && <TableCell className="py-2 text-[13px] text-slate-600 font-normal dark:text-zinc-300">{sumTotal}</TableCell>}
                                        {columns.status && <TableCell className="py-2 text-[13px]"></TableCell>}
                                        {columns.date && <TableCell className="py-2 text-[13px]"></TableCell>}
                                    </TableRow>
                                </>
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
        </div>
    );
}
