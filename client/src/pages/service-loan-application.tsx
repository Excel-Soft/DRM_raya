import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function ServiceLoanApplication() {
    const { toast } = useToast();
    const tableRef = useRef<HTMLTableElement>(null);

    const mockData = [
        { id: "1", employee: "Ali Hassan", advance: "50,000", detail: "Medical Emergency", instalment: "5,000", remaining: "45,000", manager: "Pending", hod: "Pending", date: "2026-03-25", action: "Review" },
        { id: "2", employee: "Sarah Khan", advance: "20,000", detail: "House Maintenance", instalment: "2,000", remaining: "18,000", manager: "Approved", hod: "Pending", date: "2026-03-28", action: "Review" }
    ];

    const handleCopy = () => {
        if (!tableRef.current) return;
        const rows = Array.from(tableRef.current.querySelectorAll("tr"));
        const text = rows.map(row => Array.from(row.querySelectorAll("th, td"))
            .map(cell => cell.textContent?.trim() || "")
            .join("\t")).join("\n");
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "Table Copied",
                description: "The Advance Salary data has been copied to your clipboard.",
            });
        });
    };

    const handleExcel = () => {
        if (!tableRef.current) return;
        const tableHtml = tableRef.current.outerHTML;
        // Constructing a basic Excel spreadsheet HTML wrapper for correct display encoding
        const html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>${tableHtml}</body>
            </html>
        `;
        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "Advance_Salary_List.xls";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCSV = () => {
        if (!tableRef.current) return;
        const rows = Array.from(tableRef.current.querySelectorAll("tr"));
        const csvContent = "data:text/csv;charset=utf-8," +
            rows.map(row => Array.from(row.querySelectorAll("th, td"))
                .map(cell => `"${(cell.textContent?.trim() || "").replace(/"/g, '""')}"`)
                .join(",")
            ).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.href = encodedUri;
        link.download = "Advance_Salary_List.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePDF = () => {
        toast({
            title: "Print Dialog Options",
            description: "Please select 'Save as PDF' from the destination dropdown inside the print dialog box.",
        });
        setTimeout(() => {
            window.print();
        }, 800);
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">ADVANCE SALARY LIST</h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Weird Text & Export Buttons segment */}
                <div className="mb-6">
                    <p className="text-[12px] text-slate-500 mb-2 leading-tight dark:text-zinc-400">
                        Sales DepartmentSales DepartmentSales DepartmentD&D Department D&D Department Accounts DepartmentAccounts DepartmentDeactiveDeactiveD&D Department D&D Department DeactiveDeactive
                    </p>
                    <div className="inline-flex rounded shadow-sm" role="group">
                        <button type="button" onClick={handleCopy} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#64748b] border border-[#64748b] rounded-l hover:bg-slate-600 focus:z-10 focus:ring-2 focus:ring-slate-500 transition-colors dark:border-zinc-800">
                            Copy
                        </button>
                        <button type="button" onClick={handleExcel} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#64748b] border-t border-b border-r border-[#64748b] hover:bg-slate-600 focus:z-10 focus:ring-2 focus:ring-slate-500 transition-colors dark:border-zinc-800">
                            Excel
                        </button>
                        <button type="button" onClick={handleCSV} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#64748b] border-t border-b border-r border-[#64748b] hover:bg-slate-600 focus:z-10 focus:ring-2 focus:ring-slate-500 transition-colors dark:border-zinc-800">
                            CSV
                        </button>
                        <button type="button" onClick={handlePDF} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#64748b] border-t border-b border-r border-[#64748b] rounded-r hover:bg-slate-600 focus:z-10 focus:ring-2 focus:ring-slate-500 transition-colors dark:border-zinc-800">
                            PDF
                        </button>
                    </div>
                </div>

                {/* Search Area aligned right */}
                <div className="flex justify-end mb-4">
                    <div className="flex flex-col items-end">
                        <label className="text-[12px] font-semibold text-slate-600 mb-1 dark:text-zinc-300">Search:</label>
                        <Input className="w-[180px] h-8 text-[13px] border-slate-200 dark:border-zinc-800" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table ref={tableRef}>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">No#</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Employee</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Advance</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Detail</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Instalment</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Remaining</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Manager</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Hod</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Date</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockData.map((row) => (
                                <TableRow key={row.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.id}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.employee}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.advance}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.detail}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.instalment}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.remaining}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-amber-500 py-3">{row.manager}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.hod}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-slate-500 py-3 dark:text-zinc-400">{row.date}</TableCell>
                                    <TableCell className="text-[13px] font-medium text-blue-500 hover:text-blue-600 cursor-pointer py-3">{row.action}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="mt-4 text-[13px] text-slate-500 dark:text-zinc-400">
                    Showing 1 to {mockData.length} of {mockData.length} entries
                </div>

            </div>
        </div>
    );
}
