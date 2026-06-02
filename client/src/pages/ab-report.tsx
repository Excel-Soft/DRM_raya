import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function AbReport() {
    const [dateRange, setDateRange] = useState({ from: "", to: "" });

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["/api/account/ab-report/stats", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-report/stats", window.location.origin);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url);
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
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch lists");
            return res.json();
        }
    });

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
                                        <TableRow className="bg-slate-50/50 hover:bg-slate-100 h-8 dark:hover:bg-zinc-800">
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
                                            { label: "Cheque Pay", count: 0, val: "0" },
                                            { label: "Loan Payment", count: 0, val: "0", icon: true },
                                            { label: "Loan Recovered", count: 0, val: "0", icon: true },
                                            { label: "Extra-Discount", count: 0, val: "0", icon: true },
                                            { label: "Extra-Discount Paid", count: 0, val: "0", icon: true },
                                            { label: "Remaing Extra-Discount", count: "----", val: "0", icon: true },
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
                                            { label: "Belance", count: "0", val: "0", icon: true },
                                            { label: "Buy", count: "0", val: "0", icon: true },
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
                                            { label: "Dollar", count: 0, val: "0", icon: true },
                                            { label: "Pkr", count: 0, val: "0", icon: true },
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
                                            { label: "Cheque Pay", count: 0, val: "0" },
                                            { label: "Loan Payment", count: 0, val: "0", icon: true },
                                            { label: "Loan Recovered", count: 0, val: "0", icon: true },
                                            { label: "Extra-Discount Paid", count: 0, val: "0" },
                                            { label: "Web Excels Closing", count: "--", val: "0", icon: true, highlight: true },
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
                <div className="lg:col-span-1">
                  <Card className="border-none shadow-md h-full">
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

                            {/* Alibaba Paid Section */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Alibaba Paid</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-amber-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">Company</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Paid)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">PKR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No entries</TableCell>
                                            </TableRow>
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
