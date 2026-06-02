import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type RowData = { company: string; person: string; grade: string; date: string; };

export default function ServiceBCustomer() {
    const [searchTerm, setSearchTerm] = useState("");
    const [mockData] = useState<RowData[]>([]);

    const [columns, setColumns] = useState({
        company: true,
        person: true,
        grade: true,
        date: true
    });

    const filteredData = mockData.filter(row =>
        row.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.person.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCopy = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join("\t");
        const rows = filteredData.map((row, idx) => {
            const rowData: string[] = [(idx + 1).toString()];
            if (columns.company) rowData.push(row.company);
            if (columns.person) rowData.push(row.person);
            if (columns.grade) rowData.push(row.grade);
            if (columns.date) rowData.push(row.date);
            return rowData.join("\t");
        }).join("\n");
        navigator.clipboard.writeText(`${headers}\n${rows}`);
        alert("Table data copied to clipboard!");
    };

    const handleExcel = () => {
        const headers = ["#", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].join(",");
        const rows = filteredData.map((row, idx) => {
            const rowData: string[] = [(idx + 1).toString()];
            if (columns.company) rowData.push(`"${row.company}"`);
            if (columns.person) rowData.push(`"${row.person}"`);
            if (columns.grade) rowData.push(`"${row.grade}"`);
            if (columns.date) rowData.push(`"${row.date}"`);
            return rowData.join(",");
        }).join("\n");
        const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "b-customer.csv";
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
                    B CUSTOMER
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
                            {filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-4 text-center text-slate-500 text-[13px] border-b border-slate-200 dark:text-zinc-400 dark:border-zinc-800">
                                        No data available in table
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((row, idx) => (
                                    <TableRow key={idx} className="border-b border-slate-200 dark:border-zinc-800">
                                        <TableCell className="py-2 text-[13px]">{idx + 1}</TableCell>
                                        {columns.company && <TableCell className="py-2 text-[13px]">{row.company}</TableCell>}
                                        {columns.person && <TableCell className="py-2 text-[13px]">{row.person}</TableCell>}
                                        {columns.grade && <TableCell className="py-2 text-[13px]">{row.grade}</TableCell>}
                                        {columns.date && <TableCell className="py-2 text-[13px]">{row.date}</TableCell>}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-4 text-[13px] text-slate-500 print:hidden dark:text-zinc-400">
                    <div>
                        Showing {filteredData.length === 0 ? "0 to 0 of 0" : `1 to ${filteredData.length} of ${filteredData.length}`} entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] text-slate-400 bg-white cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800">
                            Previous
                        </button>
                        <button className="px-3 py-1.5 border border-slate-200 rounded-r-[4px] text-slate-400 bg-white cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800">
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
