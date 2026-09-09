// Service Commission Verifications — reachable from the Service Manager dashboard
// (service-manager-dashboard.tsx → activeView "commission-verifications", opened
// from the "Commission Verifications" menu item).
//
// HONEST EMPTY STATE (Patch 3 Stage 11, Task A): no backend data source is wired
// for this screen yet, so it renders an explicit empty state. It must NOT display
// fabricated totals or rows, and must NOT offer copy/export of mock/empty data.
// When a real commission-verification API exists, wire it via `apiRequest` and a
// server-side, role-scoped, filter-respecting export (see EXPORT_STANDARD.md).
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

    // No backend data source is wired yet — render an honest empty state; never
    // fabricate rows or totals here.
    const visibleColCount = Object.values(cols).filter((c) => c.visible).length;

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

                {/* Empty-state notice — honest: no data source wired yet */}
                <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    No commission-verification data source is connected yet. This screen shows an empty state — no rows or totals are fabricated, and export is disabled until a real API is wired.
                </div>

                {/* Toolbar Row */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                    {/* Column visibility only — no Copy/Excel/PDF over empty/mock data */}
                    <div className="flex bg-[#64748b] text-white rounded text-[13px] font-medium shadow-sm flex-wrap">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="px-4 py-2 hover:bg-[#475569] transition-colors rounded text-left outline-none">Column visibility</button>
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
                            {/* Honest empty state — no fabricated data or totals */}
                            <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                <TableCell colSpan={Math.max(1, visibleColCount)} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                    No data available in table
                                </TableCell>
                            </TableRow>
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
