import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function ServiceVasSystem() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    return (
        <div className="flex-1 overflow-auto bg-[#f8fafc] font-sans h-full dark:bg-zinc-900">
            <div className="p-4 space-y-4">
                <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">VAS SYSTEM</h2>

                <Card className="border border-slate-100 shadow-sm rounded-md dark:border-zinc-800">
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Select User</label>
                                    <div className="flex items-center gap-1">
                                        <Checkbox id="month-wise" />
                                        <label htmlFor="month-wise" className="text-xs font-semibold text-slate-600 cursor-pointer dark:text-zinc-300">Month Wise</label>
                                    </div>
                                </div>
                                <Select defaultValue="shahbaz">
                                    <SelectTrigger className="h-9 bg-slate-50 border-slate-200 text-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="shahbaz">M. Shahbaz</SelectItem>
                                        <SelectItem value="other">Other User</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600 block mb-1 dark:text-zinc-300">Start Date</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    onClick={(e) => "showPicker" in HTMLInputElement.prototype && e.currentTarget.showPicker()}
                                    className="h-9 border-slate-200 text-sm cursor-pointer dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-600 block mb-1 dark:text-zinc-300">End Date</label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    onClick={(e) => "showPicker" in HTMLInputElement.prototype && e.currentTarget.showPicker()}
                                    className="h-9 border-slate-200 text-sm cursor-pointer dark:border-zinc-800"
                                />
                            </div>
                        </div>
                        <div>
                            <Button className="bg-[#059669] hover:bg-[#059669]/90 text-white h-9 px-8">
                                View
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <h2 className="text-[15px] font-bold text-[#475569] mt-6 mb-2 dark:text-zinc-400">VAS View</h2>

                <Card className="border border-slate-100 shadow-sm rounded-md overflow-hidden dark:border-zinc-800">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-[#d1fae5]/50">
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="text-center font-bold text-slate-700 py-3 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-400">Amount</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-400">Method</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-400">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                        <TableCell className="text-center text-sm font-medium text-slate-700 py-3 dark:text-zinc-400">trusmile surgical</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">10000</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">364</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">2021-07-13 17:08:25</TableCell>
                                    </TableRow>
                                    <TableRow className="border-slate-100 hover:bg-slate-50/50 dark:border-zinc-800">
                                        <TableCell className="text-center text-sm font-medium text-slate-700 py-3 dark:text-zinc-400">trusmile surgical</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">10000</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">364</TableCell>
                                        <TableCell className="text-center text-sm text-slate-600 dark:text-zinc-300">2021-07-13 17:08:25</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
