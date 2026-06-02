import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type RowData = { companyName: string; salePerson: string; total: number; pay: number; due: number; date: string; };

export default function ServiceDueVasPayment() {
    const [searchTerm, setSearchTerm] = useState("");
    const [mockData] = useState<RowData[]>([]);

    const [columns, setColumns] = useState({
        companyName: true,
        salePerson: true,
        total: true,
        pay: true,
        due: true,
        date: true
    });

    const filteredData = mockData.filter(row =>
        row.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.salePerson.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sumPay = filteredData.reduce((acc, row) => acc + row.pay, 0);
    const sumDue = filteredData.reduce((acc, row) => acc + row.due, 0);

    const handleCopy = () => {
        const headers = ["No.", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].map(k => k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())).join("\t");

        const rows = filteredData.map((row, idx) => {
            const rowData: string[] = [(idx + 1).toString()];
            if (columns.companyName) rowData.push(row.companyName);
            if (columns.salePerson) rowData.push(row.salePerson);
            if (columns.total) rowData.push(row.total.toString());
            if (columns.pay) rowData.push(row.pay.toString());
            if (columns.due) rowData.push(row.due.toString());
            if (columns.date) rowData.push(row.date);
            return rowData.join("\t");
        });

        // Add total row
        const totalRowData: string[] = ["Total"];
        if (columns.companyName) totalRowData.push("");
        if (columns.salePerson) totalRowData.push("");
        if (columns.total) totalRowData.push("");
        if (columns.pay) totalRowData.push(sumPay.toString());
        if (columns.due) totalRowData.push(sumDue.toString());
        if (columns.date) totalRowData.push("0");
        rows.push(totalRowData.join("\t"));

        navigator.clipboard.writeText(`${headers}\n${rows.join("\n")}`);
        alert("Table data copied to clipboard!");
    };

    const handleExcel = () => {
        const headers = ["No.", ...Object.keys(columns).filter(k => columns[k as keyof typeof columns])].map(k => k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())).join(",");

        const rows = filteredData.map((row, idx) => {
            const rowData: string[] = [(idx + 1).toString()];
            if (columns.companyName) rowData.push(`"${row.companyName}"`);
            if (columns.salePerson) rowData.push(`"${row.salePerson}"`);
            if (columns.total) rowData.push(`"${row.total}"`);
            if (columns.pay) rowData.push(`"${row.pay}"`);
            if (columns.due) rowData.push(`"${row.due}"`);
            if (columns.date) rowData.push(`"${row.date}"`);
            return rowData.join(",");
        });

        const totalRowData: string[] = ["Total"];
        if (columns.companyName) totalRowData.push('""');
        if (columns.salePerson) totalRowData.push('""');
        if (columns.total) totalRowData.push('""');
        if (columns.pay) totalRowData.push(`"${sumPay}"`);
        if (columns.due) totalRowData.push(`"${sumDue}"`);
        if (columns.date) totalRowData.push('"0"');
        rows.push(totalRowData.join(","));

        const blob = new Blob([`${headers}\n${rows.join("\n")}`], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "due-vas-payment.csv";
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
                                <DropdownMenuCheckboxItem checked={columns.total} onCheckedChange={(v) => setColumns(p => ({ ...p, total: v }))}>Total</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.pay} onCheckedChange={(v) => setColumns(p => ({ ...p, pay: v }))}>Pay</DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem checked={columns.due} onCheckedChange={(v) => setColumns(p => ({ ...p, due: v }))}>Due</DropdownMenuCheckboxItem>
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
                                <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 w-16 dark:text-zinc-100">No.</TableHead>
                                {columns.companyName && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Company Name</TableHead>}
                                {columns.salePerson && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Sale Person</TableHead>}
                                {columns.total && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Total</TableHead>}
                                {columns.pay && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Pay</TableHead>}
                                {columns.due && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Due</TableHead>}
                                {columns.date && <TableHead className="text-[13px] font-bold text-slate-800 py-2.5 dark:text-zinc-100">Date</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((row, idx) => (
                                <TableRow key={idx} className="border-b border-slate-200 dark:border-zinc-800">
                                    <TableCell className="py-2 text-[13px]">{idx + 1}</TableCell>
                                    {columns.companyName && <TableCell className="py-2 text-[13px]">{row.companyName}</TableCell>}
                                    {columns.salePerson && <TableCell className="py-2 text-[13px]">{row.salePerson}</TableCell>}
                                    {columns.total && <TableCell className="py-2 text-[13px]">{row.total}</TableCell>}
                                    {columns.pay && <TableCell className="py-2 text-[13px]">{row.pay}</TableCell>}
                                    {columns.due && <TableCell className="py-2 text-[13px]">{row.due}</TableCell>}
                                    {columns.date && <TableCell className="py-2 text-[13px]">{row.date}</TableCell>}
                                </TableRow>
                            ))}
                            {/* Total Row matching the screenshot */}
                            <TableRow className="border-b border-slate-200 bg-white font-bold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                <TableCell className="py-2 text-[13px]">Total</TableCell>
                                {columns.companyName && <TableCell className="py-2 text-[13px]"></TableCell>}
                                {columns.salePerson && <TableCell className="py-2 text-[13px]"></TableCell>}
                                {columns.total && <TableCell className="py-2 text-[13px]"></TableCell>}
                                {columns.pay && <TableCell className="py-2 text-[13px] text-slate-600 font-normal dark:text-zinc-300">{sumPay}</TableCell>}
                                {columns.due && <TableCell className="py-2 text-[13px] text-slate-600 font-normal dark:text-zinc-300">{sumDue}</TableCell>}
                                {columns.date && <TableCell className="py-2 text-[13px] text-slate-600 font-normal dark:text-zinc-300">0</TableCell>}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center mt-4 text-[13px] text-slate-500 print:hidden dark:text-zinc-400">
                    <div>
                        Showing 1 to 1 of 1 entries
                    </div>
                    <div className="flex mt-2 md:mt-0">
                        <button className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l-[4px] text-slate-400 bg-white cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800">
                            Previous
                        </button>
                        <button className="px-3 py-1.5 border bg-[#059669] border-[#059669] rounded-r-[4px] text-white dark:border-zinc-800">
                            1
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
