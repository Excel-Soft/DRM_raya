import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Calendar, Loader2, CheckCircle2, XCircle, Download, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";

export default function AbReport() {
    const [dateRange, setDateRange] = useState({ from: "", to: "" });

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["/api/account/ab-report/stats", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-report/stats", window.location.origin);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        }
    });

    const { data: dollarList, isLoading: listLoading } = useQuery({
        queryKey: ["/api/account/dollar-system/list", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/dollar-system/list", window.location.origin);
            if (dateRange.from) url.searchParams.append("startDate", dateRange.from);
            if (dateRange.to) url.searchParams.append("endDate", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch lists");
            return res.json();
        }
    });

    const { data: closingSummary, isLoading: closingLoading } = useQuery({
        queryKey: ["/api/account/ab-closing/summary", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-closing/summary", window.location.origin);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch closing summary");
            return res.json();
        }
    });

    const { data: abPaymentsData } = useQuery({
        queryKey: ["/api/account/ab-payments", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-payments", window.location.origin);
            url.searchParams.append("status", "paid");
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch AB payments");
            return res.json();
        }
    });

    const handleExportCsv = () => {
        const url = new URL("/api/account/ab-payments/export", window.location.origin);
        url.searchParams.append("status", "paid");
        if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
        if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
        window.open(url.toString(), "_blank");
    };

    if (statsLoading || listLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="ml-2 text-slate-600 font-medium dark:text-zinc-300">Loading Real Data...</span>
            </div>
        );
    }

    const account = stats?.account || {};
    const closingItems = stats?.closing || [];
    const rec = closingSummary?.reconciliation || {};
    const cp  = closingSummary?.customerPayment || {};
    const dp  = closingSummary?.dollarPurchased || {};
    const abp = closingSummary?.abPayments || {};
    const chk = closingSummary?.checklist || {};
    const auditRows = closingSummary?.auditHistory || [];
    const paidAbRows = abPaymentsData?.data || [];

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950 p-6 space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2 uppercase dark:text-zinc-100">
                        AB CLOSING REPORT
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md p-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                        <input 
                            type="date" 
                            className="text-xs border-none focus:ring-0 h-8 bg-transparent dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                            value={dateRange.from}
                            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        />
                        <span className="text-slate-400 text-xs">to</span>
                        <input 
                            type="date" 
                            className="text-xs border-none focus:ring-0 h-8 bg-transparent dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                            value={dateRange.to}
                            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        />
                   </div>
                </div>
            </div>

            {/* Header / Filter Section */}
            <div className="bg-emerald-700 text-white rounded-t-lg px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="bg-white text-emerald-800 hover:bg-emerald-50 border-white font-bold h-8 dark:bg-zinc-900">
                        {dateRange.from ? `From ${dateRange.from}` : "Current Quarter"} <Info className="ml-1 h-3.5 w-3.5" />
                    </Button>
                </div>
                <div className="font-bold uppercase tracking-wider">Account</div>
                <div className="w-20"></div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-md p-4 flex items-center gap-3 text-blue-700 text-sm font-medium -mt-6 mx-0 mb-6 dark:bg-zinc-900/50 dark:border-zinc-800 dark:text-blue-400">
                <Info className="h-4 w-4" />
                Currently viewing: <span className="font-bold">{dateRange.from ? `Range: ${dateRange.from} to ${dateRange.to || 'Today'}` : "Full History Stats"}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-8">
                    {/* ACCOUNT Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* CASH Column */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Cash</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Client Payment</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">{account.cash?.clientPayment?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.cash?.clientPayment?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Cheque</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">{account.cash?.cheque?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.cash?.cheque?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">Loan Recovered <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">{account.cash?.loanRecovered?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.cash?.loanRecovered?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Last Closing</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-emerald-50/50 hover:bg-emerald-50 h-8">
                                            <TableCell className="py-1 font-bold text-emerald-700">Total</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 px-1">{account.cash?.total?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 text-right">{(account.cash?.total?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* DOLLARS Column */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Dollars</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Balance</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.dollars?.balance?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Buy</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.dollars?.buy?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">Required <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">Get Funds <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-emerald-50/50 hover:bg-emerald-50 h-8">
                                            <TableCell className="py-1 font-bold text-emerald-700">Total</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 px-1">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 text-right">{(account.dollars?.total?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* TEMP PAYMENT Column */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Temp Payment</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">Temp Gm <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">{account.tempPayment?.tempGm?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">{(account.tempPayment?.tempGm?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Martini Pending</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Pending Cheque</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Advance Pay</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-600 text-right">0</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-emerald-50/50 hover:bg-emerald-50 h-8">
                                            <TableCell className="py-1 font-bold text-emerald-700">Total</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 px-1">{account.tempPayment?.total?.count || 0}</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 text-right">{(account.tempPayment?.total?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* ACCOUNT CLOSING Column */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Account Closing</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Client Payment</TableCell>
                                            <TableCell className="py-1 font-medium text-blue-500 px-1">0</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 text-right dark:text-zinc-400">{(account.accountClosing?.clientPayment?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Cheque <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-medium text-blue-500 px-1">0</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 text-right dark:text-zinc-400">{(account.accountClosing?.cheque?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 dark:text-zinc-300">Pending Cheque</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 text-right dark:text-zinc-400">0</TableCell>
                                        </TableRow>
                                        <TableRow className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">Extra Amount <Info className="h-3 w-3 text-slate-400" /></TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">0</TableCell>
                                            <TableCell className="py-1 font-bold text-slate-700 text-right dark:text-zinc-400">0</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-100 h-8 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                            <TableCell className="py-1 font-bold text-emerald-700 font-bold">Total</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 px-1">0</TableCell>
                                            <TableCell className="py-1 font-bold text-emerald-700 text-right">{(account.accountClosing?.total?.amount || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>

                    {/* WEB EXCELS Sections Header */}
                    <div className="bg-emerald-700 text-white rounded-lg px-4 py-2 flex items-center justify-center font-bold uppercase tracking-wider">
                        Web Excels
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* WEB EXCELS CASH */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Cash</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        {[
                                            { label: "Cheque Pay", count: account.webExcels?.cash?.chequePay?.count || 0, val: (account.webExcels?.cash?.chequePay?.amount || 0).toLocaleString() },
                                            { label: "Loan Payment", count: account.webExcels?.cash?.loanPayment?.count || 0, val: (account.webExcels?.cash?.loanPayment?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Loan Recovered", count: account.webExcels?.cash?.loanRecovered?.count || 0, val: (account.webExcels?.cash?.loanRecovered?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Extra-Discount", count: account.webExcels?.cash?.extraDiscount?.count || 0, val: (account.webExcels?.cash?.extraDiscount?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Extra-Discount Paid", count: account.webExcels?.cash?.extraDiscountPaid?.count || 0, val: (account.webExcels?.cash?.extraDiscountPaid?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Remaining Extra-Discount", count: "----", val: (account.webExcels?.cash?.remainingExtraDiscount?.amount || 0).toLocaleString(), icon: true },
                                        ].map((r, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">
                                                    {r.label} {r.icon && <Info className="h-3 w-3 text-slate-400" />}
                                                </TableCell>
                                                <TableCell className="py-1 font-bold text-slate-700 px-1 dark:text-zinc-400">{r.count}</TableCell>
                                                <TableCell className="py-1 font-bold text-emerald-600 text-right">{r.val}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* WEB EXCELS DOLLARS */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Dollars</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        {[
                                            { label: "Balance", count: account.webExcels?.dollars?.balance?.count || 0, val: `$${(account.webExcels?.dollars?.balance?.amount || 0).toLocaleString()}`, icon: true },
                                            { label: "Buy", count: account.webExcels?.dollars?.buy?.count || 0, val: `$${(account.webExcels?.dollars?.buy?.amount || 0).toLocaleString()}`, icon: true },
                                        ].map((r, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-1 font-medium text-slate-600 flex items-center gap-1 dark:text-zinc-300">
                                                    {r.label} {r.icon && <Info className="h-3 w-3 text-slate-400" />}
                                                </TableCell>
                                                <TableCell className="py-1 font-bold text-slate-700 px-1 text-center dark:text-zinc-400">{r.count}</TableCell>
                                                <TableCell className="py-1 font-bold text-emerald-600 text-right">{r.val}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* PENDING RECOVERY */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Pending Recovery</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        {[
                                            { label: "Dollar", count: account.webExcels?.pendingRecovery?.dollar?.count || 0, val: `$${(account.webExcels?.pendingRecovery?.dollar?.amount || 0).toLocaleString()}`, icon: true },
                                            { label: "Pkr", count: account.webExcels?.pendingRecovery?.pkr?.count || 0, val: (account.webExcels?.pendingRecovery?.pkr?.amount || 0).toLocaleString(), icon: true },
                                        ].map((r, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 h-8 text-slate-700 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400">
                                                <TableCell className="py-1 font-medium">{r.label}</TableCell>
                                                <TableCell className="py-1 font-bold text-center">{r.icon && <Info className="h-3 w-3 text-slate-400 inline mr-1" />} {r.count}</TableCell>
                                                <TableCell className="py-1 font-bold text-right">{r.val}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* WEB EXCELS CLOSING */}
                        <Card className="border-none shadow-sm h-full">
                            <CardHeader className="bg-emerald-600 py-1.5 px-3 rounded-t-md">
                                <CardTitle className="text-xs font-bold text-white text-center uppercase tracking-widest">Web Excels Closing</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="text-[11px]">
                                    <TableBody>
                                        {[
                                            { label: "Cheque Pay", count: account.webExcels?.closing?.chequePay?.count || 0, val: (account.webExcels?.closing?.chequePay?.amount || 0).toLocaleString() },
                                            { label: "Loan Payment", count: account.webExcels?.closing?.loanPayment?.count || 0, val: (account.webExcels?.closing?.loanPayment?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Loan Recovered", count: account.webExcels?.closing?.loanRecovered?.count || 0, val: (account.webExcels?.closing?.loanRecovered?.amount || 0).toLocaleString(), icon: true },
                                            { label: "Extra-Discount Paid", count: account.webExcels?.closing?.extraDiscountPaid?.count || 0, val: (account.webExcels?.closing?.extraDiscountPaid?.amount || 0).toLocaleString() },
                                            { label: "Web Excels Closing", count: "--", val: (account.webExcels?.closing?.webExcelsClosing?.amount || 0).toLocaleString(), icon: true, highlight: true },
                                        ].map((r, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 h-8 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className={`py-1 font-medium ${r.highlight ? 'text-emerald-600 font-bold' : 'text-slate-600 dark:text-slate-300'} flex items-center gap-1`}>
                                                    {r.label} {r.icon && <Info className="h-3 w-3 text-emerald-600/50" />}
                                                </TableCell>
                                                <TableCell className="py-1 font-bold text-slate-700 px-1 text-center dark:text-zinc-400">{r.count}</TableCell>
                                                <TableCell className={`py-1 font-bold text-right ${r.highlight ? 'text-emerald-600' : 'text-slate-700'}`}>{r.val}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Right CLOSING Summary Column */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="border-none shadow-md">
                    <CardHeader className="bg-emerald-700 py-2 rounded-t-lg">
                      <CardTitle className="text-sm font-bold text-white text-center uppercase">Closing</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 bg-white dark:bg-zinc-900">
                      <Table className="text-[12px]">
                        <TableBody>
                          {closingItems.map((r: any, i: number) => (
                            <TableRow key={i} className={`hover:bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-slate-700 ${r.border ? 'bg-slate-50/50 dark:bg-zinc-900/50' : ''}`}>
                              <TableCell className="py-2 text-slate-700 font-medium dark:text-zinc-400">{r.label}</TableCell>
                              <TableCell className="py-2 text-slate-400 font-medium px-1">{(r.icon || i < 4) && <Info className="h-3 w-3 inline mr-1" />} {r.type}</TableCell>
                              <TableCell className={`py-2 text-right font-bold ${r.color || 'text-slate-700'}`}>
                                {r.val}
                                {r.sub && <div className="text-[9px] font-normal text-slate-400 leading-tight">{r.sub}</div>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {closingItems.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-4 text-slate-400">No closing data</TableCell>
                                </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Phase 8 — AB Reconciliation Panel */}
                  <Card className="border-none shadow-md">
                    <CardHeader className="bg-slate-700 py-2 rounded-t-lg">
                      <CardTitle className="text-sm font-bold text-white text-center uppercase">AB Reconciliation</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 bg-white dark:bg-zinc-900 space-y-2 text-[11px]">
                      {closingLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-emerald-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Customer Paid (USD)</div>
                              <div className="text-emerald-700 font-black text-sm dark:text-emerald-400">${Number(cp.totalUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">PKR {Number(cp.totalPkr || 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Dollar Purchased</div>
                              <div className="text-blue-700 font-black text-sm dark:text-blue-400">${Number(dp.totalUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(dp.count || 0)} records</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">AB Paid</div>
                              <div className="text-amber-700 font-black text-sm dark:text-amber-400">${Number(abp.paidUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(abp.paidCount || 0)} payments</div>
                            </div>
                            <div className="bg-red-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Remaining</div>
                              <div className={`font-black text-sm ${Number(rec.remainingBalanceUsd||0)>0?'text-red-600 dark:text-red-400':'text-emerald-600 dark:text-emerald-400'}`}>${Number(rec.remainingBalanceUsd||0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(rec.unresolvedCount || 0)} unresolved GMs</div>
                            </div>
                          </div>

                          {/* Pending/Processing badges */}
                          <div className="flex gap-2 flex-wrap pt-1">
                            {Number(abp.pendingUsd||0)>0 && <Badge className="bg-yellow-100 text-yellow-700 border-none text-[10px] font-black">⏳ Pending ${Number(abp.pendingUsd).toLocaleString()}</Badge>}
                            {Number(abp.processingUsd||0)>0 && <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] font-black">⚙ Processing ${Number(abp.processingUsd).toLocaleString()}</Badge>}
                            {Number(abp.rejectedUsd||0)>0 && <Badge className="bg-red-100 text-red-700 border-none text-[10px] font-black">✗ Rejected ${Number(abp.rejectedUsd).toLocaleString()}</Badge>}
                          </div>

                          {/* Checklist */}
                          <div className="border-t pt-2 space-y-1 dark:border-zinc-700">
                            <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Close Checklist</div>
                            {([
                              { label: 'No Pending AB Payments', ok: chk.noPendingAbPayments },
                              { label: 'No Unresolved GMs', ok: chk.noUnresolvedGm },
                              { label: 'No Rejected Payments', ok: chk.noRejectedAbPayments },
                            ] as {label:string;ok:boolean}[]).map((item, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {item.ok ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={12} className="text-red-400 flex-shrink-0" />}
                                <span className={`text-[10px] font-medium ${item.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500'}`}>{item.label}</span>
                              </div>
                            ))}
                          </div>

                          {/* Export */}
                          <Button size="sm" onClick={handleExportCsv}
                            className="w-full h-8 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black uppercase mt-1">
                            <Download size={11} className="mr-1"/> Export AB Payments CSV
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Audit History */}
                  {auditRows.length > 0 && (
                    <Card className="border-none shadow-md">
                      <CardHeader className="bg-gray-600 py-2 rounded-t-lg">
                        <CardTitle className="text-sm font-bold text-white text-center uppercase">Audit History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 bg-white dark:bg-zinc-900 space-y-1">
                        {auditRows.map((row: any, i: number) => (
                          <div key={i} className="text-[10px] border-b border-gray-100 dark:border-zinc-800 pb-1">
                            <span className="font-black text-gray-700 dark:text-zinc-300">{row.actor_name || 'System'}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{row.action?.replace(/_/g,' ')}</span>
                            <span className="text-gray-300 mx-1">·</span>
                            <span className="text-gray-400">{row.created_at ? format(new Date(row.created_at), 'MM/dd HH:mm') : ''}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
            </div>

            {/* DOLLAR SYSTEM INTEGRATED AT BOTTOM */}
            <div className="pt-10 border-t border-slate-200 mt-10 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-slate-800 uppercase mb-6 dark:text-zinc-100">Dollar System</h2>
                <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase dark:text-zinc-400">Start Date</label>
                                <input 
                                    type="date" 
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    value={dateRange.from}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase dark:text-zinc-400">End Date</label>
                                <input 
                                    type="date" 
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    value={dateRange.to}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                />
                            </div>
                            <Button className="bg-emerald-700 hover:bg-emerald-800 h-10 font-bold uppercase transition-all shadow-md">
                                View
                            </Button>
                        </div>

                        <div className="flex flex-col xl:flex-row gap-4 border-t border-slate-100 pt-6 overflow-hidden dark:border-zinc-800">
                            {/* Client Payment Section */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Client Payment</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-emerald-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">Company</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Client)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">PKR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dollarList?.clientPayments?.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{new Date(item.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">{item.company}</TableCell>
                                                    <TableCell className="px-1">{item.dollar}</TableCell>
                                                    <TableCell className="px-1">{item.rate}</TableCell>
                                                    <TableCell className="px-1">{item.received}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!dollarList?.clientPayments || dollarList.clientPayments.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No entries</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Dollar Buy Section */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Dollar Buy</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-blue-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">PayPal</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Buy)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">PKR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dollarList?.dollarBuys?.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{new Date(item.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">{item.paypalEmail || 'N/A'}</TableCell>
                                                    <TableCell className="px-1">{item.dollar}</TableCell>
                                                    <TableCell className="px-1">{item.rate}</TableCell>
                                                    <TableCell className="px-1">{item.received}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!dollarList?.dollarBuys || dollarList.dollarBuys.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No entries</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Alibaba Paid Section - Phase 8: real ab_payments records */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Alibaba Paid</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-amber-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Paid Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">Company / AB ID</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Paid)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paidAbRows.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{item.paid_date ? format(new Date(item.paid_date), 'MM/dd/yy') : '-'}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">
                                                        <div>{item.company_name || '-'}</div>
                                                        <div className="text-[9px] font-normal text-gray-400">{item.ab_id || 'No AB ID'}</div>
                                                    </TableCell>
                                                    <TableCell className="px-1 text-emerald-600 font-black">${Number(item.amount_usd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</TableCell>
                                                    <TableCell className="px-1">{item.rate || '-'}</TableCell>
                                                    <TableCell className="px-1">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">paid</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {paidAbRows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No paid AB records yet</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
