import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

const TABLE_COLUMNS = [
    { id: "no", label: "No#" },
    { id: "date", label: "Date" },
    { id: "person", label: "Person" },
    { id: "status", label: "Status" },
    { id: "commissionType", label: "Commission Type" },
    { id: "amount", label: "Amount" },
    { id: "percent", label: "%" },
    { id: "commission", label: "Commission" },
    { id: "reward", label: "Reward" },
    { id: "teamReward", label: "Team Reward" },
    { id: "pay", label: "Pay" },
    { id: "total", label: "Total" },
    { id: "action", label: "Action" },
];

export default function CommissionVerificationPage() {
    const [activeTab, setActiveTab] = useState<"approved" | "not-approved">("approved");
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
        Object.fromEntries(TABLE_COLUMNS.map(c => [c.id, true]))
    );

    const toggleColumn = (id: string, checked: boolean) => {
        setVisibleColumns(prev => ({ ...prev, [id]: checked }));
    };

    const handleCopy = () => {
        const visibleCols = TABLE_COLUMNS.filter(c => visibleColumns[c.id]);
        const headerText = visibleCols.map(c => c.label).join("\t");
        const bodyText = "No data available in table";
        const text = headerText + "\n" + bodyText;
        
        navigator.clipboard.writeText(text).then(() => {
            alert("Table data copied to clipboard!");
        });
    };

    const handleExcel = () => {
        const visibleCols = TABLE_COLUMNS.filter(c => visibleColumns[c.id]);
        const headerCsv = visibleCols.map(c => `"${c.label}"`).join(",");
        
        // Mock data row 1 (Empty)
        const emptyRowArray = visibleCols.map(() => '""');
        if (visibleCols.length > 0) emptyRowArray[0] = '"No data available in table"';
        const emptyCsv = emptyRowArray.join(",");

        // Total Mock row
        const totalRowArray = visibleCols.map((c, i) => {
            if (i === 0) return '"Total"';
            if (c.id === "total") return '"108962"';
            return '""';
        });
        const totalCsv = totalRowArray.join(",");

        const csvContent = [headerCsv, emptyCsv, totalCsv].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'commission_verification.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handlePdf = () => {
        // Trigger browser print for simple PDF export of dashboard frame
        window.print();
    };

    const activeCols = TABLE_COLUMNS.filter(c => visibleColumns[c.id]);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] print:bg-white print:p-0 dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-6 print:hidden dark:text-zinc-400">
                Commission Verification
            </h1>

            <Card className="border border-gray-100 shadow-sm rounded-md bg-white print:shadow-none print:border-none dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-6 print:p-0">
                    {/* Top Tabs */}
                    <div className="grid grid-cols-2 gap-0 mb-8 border border-gray-200 rounded-sm overflow-hidden print:hidden dark:border-zinc-800">
                        <div
                            className={cn(
                                "py-3 text-center cursor-pointer text-[14px] font-semibold transition-colors bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800",
                                activeTab === "approved" && "bg-[#00a65a] text-white hover:bg-[#00a65a]"
                            )}
                            onClick={() => setActiveTab("approved")}
                        >
                            Commission Approved
                        </div>
                        <div
                            className={cn(
                                "py-3 text-center cursor-pointer text-[14px] font-semibold transition-colors bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800",
                                activeTab === "not-approved" && "bg-[#00a65a] text-white hover:bg-[#00a65a]"
                            )}
                            onClick={() => setActiveTab("not-approved")}
                        >
                            Commission Not Approved
                        </div>
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 print:hidden">
                        <div className="flex bg-[#6c757d] rounded-md overflow-hidden text-white shadow-sm font-medium">
                            <button onClick={handleCopy} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">Copy</button>
                            <button onClick={handleExcel} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">Excel</button>
                            <button onClick={handlePdf} className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors border-r border-[#5a6268] dark:border-zinc-800">PDF</button>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="px-4 py-2 text-[13px] hover:bg-[#5a6268] transition-colors outline-none cursor-pointer">
                                        Column visibility
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    {TABLE_COLUMNS.map(col => (
                                        <DropdownMenuCheckboxItem
                                            key={col.id}
                                            checked={visibleColumns[col.id]}
                                            onCheckedChange={(checked) => toggleColumn(col.id, checked)}
                                        >
                                            {col.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                            <Input className="w-[200px] h-8 text-[13px]" />
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-[#f8f9fa] border-y border-gray-200 text-[#495057] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    {TABLE_COLUMNS.map(col => {
                                        if (!visibleColumns[col.id]) return null;
                                        return (
                                            <th key={col.id} className="px-3 py-3 text-[12px] font-bold">
                                                {col.label}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100 dark:border-zinc-800">
                                    <td colSpan={activeCols.length} className="px-3 py-4 text-[13px] pl-4 text-[#495057] dark:text-zinc-400">
                                        No data available in table
                                    </td>
                                </tr>
                                {/* Total Row */}
                                <tr className="border-b border-gray-100 font-bold bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                    {activeCols.map((col, idx) => {
                                        // The screenshot has 'Total' as the first string and '108962' under the 'Total' column
                                        if (idx === 0) {
                                            return (
                                                <td key={col.id} className="px-3 py-3 text-[13px] pl-4 text-[#212529] dark:text-zinc-100">
                                                    Total
                                                </td>
                                            );
                                        }
                                        if (col.id === "total") {
                                            return (
                                                <td key={col.id} className="px-3 py-3 text-[13px] text-[#212529] dark:text-zinc-100">
                                                    108962
                                                </td>
                                            );
                                        }
                                        return <td key={col.id}></td>;
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Placeholder */}
                    <div className="mt-4 text-[13px] text-[#495057] print:hidden dark:text-zinc-400">
                        Showing 0 to 0 of 0 entries
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
