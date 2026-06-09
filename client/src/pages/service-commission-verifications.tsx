// DEPRECATED / NOT ROUTED: This page is not registered in App.tsx and is not
// rendered anywhere in the app. It is retained as a static scaffold only. It uses
// placeholder data and is intentionally left untouched (no live data source).
// Do not wire it to real APIs without first adding a route and product sign-off.
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ServiceCommissionVerifications() {
    const [activeTab, setActiveTab] = useState<"approved" | "not-approved">("approved");

    const [cols, setCols] = useState({
        no: { label: "No#", visible: true },
        date: { label: "Date", visible: true },
        person: { label: "Person", visible: true },
        status: { label: "Status", visible: true },
        type: { label: "Commission Type", visible: true },
        amount: { label: "Amount", visible: true },
        percent: { label: "%", visible: true },
        commission: { label: "Commission", visible: true },
        reward: { label: "Reward", visible: true },
        teamReward: { label: "Team Reward", visible: true },
        pay: { label: "Pay", visible: true },
        total: { label: "Total", visible: true },
        action: { label: "Action", visible: true },
    });

    const mockData: any[] = []; // Currently empty matching screenshot, but ready for data

    const handleCopy = () => {
        if (mockData.length === 0) {
            alert("No data available to copy.");
            return;
        }
        const headers = Object.values(cols).filter(c => c.visible).map(c => c.label).join('\t');
        const text = headers + '\n' + mockData.map(d => Object.values(d).join('\t')).join('\n');
        navigator.clipboard.writeText(text);
        alert("Copied to clipboard");
    };

    const handleExcel = () => {
        if (mockData.length === 0) {
            alert("No data available to export to Excel.");
            return;
        }
        const headers = Object.values(cols).filter(c => c.visible).map(c => c.label).join(',');
        const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + mockData.map(e => Object.values(e).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "commission_data.csv");
        document.body.appendChild(link);
        link.click();
    };

    const handlePDF = () => {
        window.print();
    };

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">COMMISSION VERIFICATION</h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Tabs Row */}
                <div className="flex bg-white mb-6 border border-[#e2e8f0] rounded overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab("approved")}
                        className={`flex-1 py-3 text-[14px] font-semibold transition-colors ${activeTab === "approved"
                            ? "bg-[#059669] text-white"
                            : "bg-white dark:bg-zinc-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900"
                            }`}
                    >
                        Commission Approved
                    </button>
                    <button
                        onClick={() => setActiveTab("not-approved")}
                        className={`flex-1 py-3 text-[14px] font-semibold transition-colors ${activeTab === "not-approved"
                            ? "bg-[#059669] text-white"
                            : "bg-white dark:bg-zinc-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:bg-zinc-900"
                            }`}
                    >
                        Commission Not Approved
                    </button>
                </div>

                {/* Toolbar Row */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                    {/* Action Buttons */}
                    <div className="flex bg-[#64748b] text-white rounded text-[13px] font-medium shadow-sm flex-wrap">
                        <button onClick={handleCopy} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors rounded-l dark:border-zinc-800">Copy</button>
                        <button onClick={handleExcel} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors dark:border-zinc-800">Excel</button>
                        <button onClick={handlePDF} className="px-4 py-2 hover:bg-[#475569] border-r border-[#475569] transition-colors dark:border-zinc-800">PDF</button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="px-4 py-2 hover:bg-[#475569] transition-colors rounded-r text-left outline-none">Column visibility</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto">
                                {Object.entries(cols).map(([key, col]) => (
                                    <DropdownMenuCheckboxItem
                                        key={key}
                                        checked={col.visible}
                                        onCheckedChange={(checked) => {
                                            setCols(prev => ({
                                                ...prev,
                                                [key]: { ...prev[key as keyof typeof prev], visible: checked }
                                            }));
                                        }}
                                    >
                                        {col.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Search */}
                    <div className="flex flex-col items-end gap-1 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
                        <label>Search:</label>
                        <Input className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                {cols.no.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">No#</TableHead>}
                                {cols.date.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Date</TableHead>}
                                {cols.person.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Person</TableHead>}
                                {cols.status.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Status</TableHead>}
                                {cols.type.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Commission Type</TableHead>}
                                {cols.amount.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Amount</TableHead>}
                                {cols.percent.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">%</TableHead>}
                                {cols.commission.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Commission</TableHead>}
                                {cols.reward.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Reward</TableHead>}
                                {cols.teamReward.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Team Reward</TableHead>}
                                {cols.pay.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Pay</TableHead>}
                                {cols.total.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Total</TableHead>}
                                {cols.action.visible && <TableHead className="text-[12px] font-bold text-[#475569] py-3 whitespace-nowrap dark:text-zinc-400">Action</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Empty Data Row */}
                            <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                <TableCell colSpan={Object.values(cols).filter(c => c.visible).length} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                    No data available in table
                                </TableCell>
                            </TableRow>

                            {/* Totals Row */}
                            {Object.values(cols).filter(c => c.visible).length > 0 && (
                                <TableRow className="hover:bg-transparent bg-slate-50 border-b border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                    <TableCell colSpan={Math.max(1, Object.values(cols).filter(c => c.visible).length - 2)} className="py-3 font-bold text-[13px] text-[#475569] dark:text-zinc-400">
                                        Total
                                    </TableCell>
                                    <TableCell colSpan={2} className="py-3 font-bold text-[13px] text-[#475569] dark:text-zinc-400">
                                        108962
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex justify-between items-center mt-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                    <div>
                        Showing 0 to 0 of 0 entries
                    </div>
                </div>

            </div>
        </div>
    );
}
