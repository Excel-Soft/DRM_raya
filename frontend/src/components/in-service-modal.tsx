import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Book, FileText, MessageSquare, History } from "lucide-react";

interface ServiceCustomerRow {
    serviceCustomer: {
        id: string;
        status?: string | null;
        expiryDate?: string | null;
    };
    customerDetails?: {
        companyName?: string | null;
        accountName?: string | null;
    } | null;
}

const QUARTERS = [
    { id: "q1", label: "Q1 Apr-Jun", months: ["Apr", "May", "Jun"], monthIdx: [3, 4, 5] },
    { id: "q2", label: "Q2 Jul-Sep", months: ["Jul", "Aug", "Sep"], monthIdx: [6, 7, 8] },
    { id: "q3", label: "Q3 Oct-Dec", months: ["Oct", "Nov", "Dec"], monthIdx: [9, 10, 11] },
    { id: "q4", label: "Q4 Jan-Mar", months: ["Jan", "Feb", "Mar"], monthIdx: [0, 1, 2] },
];

export function InServiceModal({
    isOpen,
    onClose,
    apiEndpoint,
}: {
    isOpen: boolean;
    onClose: () => void;
    /** Real filtered-customer endpoint, e.g. "/api/service/executive/customers/in-service".
     *  Left undefined for departments with no service-style in-service dataset yet. */
    apiEndpoint?: string;
}) {
    const [activeTab, setActiveTab] = useState("q1");
    const [showHistory, setShowHistory] = useState(false);

    const { data, isLoading } = useQuery<ServiceCustomerRow[]>({
        queryKey: apiEndpoint ? [apiEndpoint] : ["in-service-modal-disabled"],
        enabled: isOpen && Boolean(apiEndpoint),
    });

    const rows = Array.isArray(data) ? data : [];

    // Bucket every row by the calendar month its expiry date falls in.
    const monthCounts = useMemo(() => {
        const counts = new Array(12).fill(0);
        for (const row of rows) {
            const expiry = row?.serviceCustomer?.expiryDate;
            if (!expiry) continue;
            const d = new Date(expiry);
            if (!Number.isNaN(d.getTime())) counts[d.getMonth()] += 1;
        }
        return counts;
    }, [rows]);

    const tabs = QUARTERS.map((q) => ({
        ...q,
        count: q.monthIdx.reduce((sum, idx) => sum + monthCounts[idx], 0),
    }));

    const activeTabData = tabs.find((t) => t.id === activeTab) || tabs[0];

    // Rows whose expiry falls within the active quarter.
    const quarterRows = useMemo(() => {
        return rows.filter((row) => {
            const expiry = row?.serviceCustomer?.expiryDate;
            if (!expiry) return false;
            const d = new Date(expiry);
            if (Number.isNaN(d.getTime())) return false;
            return activeTabData.monthIdx.includes(d.getMonth());
        });
    }, [rows, activeTabData]);

    // Renewal/Upgrade/Dropout display rule: a record that has already been
    // renewed or upgraded is surfaced at the TOP of the active list (it's the
    // most actionable/most recently touched); a dropped-out record is pulled
    // OUT of the active list entirely and moved to the History tab below.
    const { activeRows, historyRows } = useMemo(() => {
        const active: ServiceCustomerRow[] = [];
        const history: ServiceCustomerRow[] = [];
        for (const row of quarterRows) {
            if (row.serviceCustomer.status === "dropout") history.push(row);
            else active.push(row);
        }
        active.sort((a, b) => {
            const rank = (s?: string | null) => (s === "renewed" || s === "upgraded" ? 0 : 1);
            return rank(a.serviceCustomer.status) - rank(b.serviceCustomer.status);
        });
        return { activeRows: active, historyRows: history };
    }, [quarterRows]);

    const companyName = (row: ServiceCustomerRow) =>
        row.customerDetails?.companyName || row.customerDetails?.accountName || "Unknown";

    const statusLabel = (status?: string | null) => {
        switch (status) {
            case "renewed": return "Renewed";
            case "upgraded": return "Upgraded";
            case "dropout": return "Dropout";
            case "expiring": return "Expiring";
            case "expired": return "Expired";
            default: return "Active";
        }
    };

    const statusClass = (status?: string | null) => {
        switch (status) {
            case "renewed":
            case "upgraded":
                return "bg-[#d1fae5] text-[#059669]";
            case "dropout":
                return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
            case "expiring":
                return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
            default:
                return "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300";
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl p-6 bg-[#f8fafc] gap-6 dark:bg-zinc-900">
                <DialogHeader>
                    <DialogTitle className="text-[17px] font-bold text-slate-700 dark:text-zinc-400">
                        In Service Customer
                    </DialogTitle>
                </DialogHeader>

                <div>
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 gap-6 dark:border-zinc-800">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setShowHistory(false); }}
                                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${activeTab === tab.id
                                        ? "border-[#059669] text-[#059669]"
                                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                            >
                                <span className="text-[13px] font-bold">{tab.label}</span>
                                <span className={`text-[11px] font-bold px-1.5 rounded-full ${activeTab === tab.id ? "bg-[#d1fae5]" : "bg-slate-200"
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Cards grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        {[Book, FileText, MessageSquare].map((Icon, i) => (
                            <div key={i} className="bg-white rounded-[6px] shadow-sm border border-slate-100 p-4 flex justify-between items-center dark:bg-zinc-900 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-[12px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">{activeTabData.months[i]} Expire</h3>
                                    <p className="text-[20px] font-bold text-slate-800 dark:text-zinc-100">{monthCounts[activeTabData.monthIdx[i]]}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center dark:bg-zinc-800">
                                    <Icon className="w-5 h-5 text-[#059669] dark:text-zinc-400" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Customer list for the active quarter, with the renewal/upgrade/dropout
                        display rule applied: renewed & upgraded records float to the top of
                        the active list; dropouts are pulled out into History below. */}
                    {apiEndpoint && (
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">
                                    {activeTabData.label} Customers
                                </h4>
                                {historyRows.length > 0 && (
                                    <button
                                        onClick={() => setShowHistory((v) => !v)}
                                        className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-700 dark:text-zinc-400"
                                    >
                                        <History className="w-3.5 h-3.5" />
                                        {showHistory ? "Hide" : "Show"} History ({historyRows.length})
                                    </button>
                                )}
                            </div>

                            <div className="border border-slate-100 rounded-[6px] overflow-hidden dark:border-zinc-800">
                                {isLoading ? (
                                    <div className="py-6 text-center text-[13px] text-slate-500 dark:text-zinc-400">Loading...</div>
                                ) : (showHistory ? historyRows : activeRows).length === 0 ? (
                                    <div className="py-6 text-center text-[13px] text-slate-500 dark:text-zinc-400">
                                        {showHistory ? "No dropout history for this quarter." : "No customers expiring this quarter."}
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-50/50 dark:bg-zinc-900">
                                                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400">Company</th>
                                                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400">Expiry</th>
                                                <th className="px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showHistory ? historyRows : activeRows).map((row) => (
                                                <tr key={row.serviceCustomer.id} className="border-t border-slate-50 dark:border-zinc-800">
                                                    <td className="px-3 py-2 text-[12px] font-medium text-slate-700 dark:text-zinc-300">{companyName(row)}</td>
                                                    <td className="px-3 py-2 text-[12px] text-slate-500 dark:text-zinc-400">
                                                        {row.serviceCustomer.expiryDate ? new Date(row.serviceCustomer.expiryDate).toLocaleDateString() : "-"}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusClass(row.serviceCustomer.status)}`}>
                                                            {statusLabel(row.serviceCustomer.status)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
