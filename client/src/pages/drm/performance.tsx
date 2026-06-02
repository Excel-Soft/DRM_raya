import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PERFORMANCE_MOCK = [
    { id: 1, company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25" },
    { id: 2, company: "trusmile surgical", amount: "10000", method: "364", date: "2021-07-13 17:08:25" }
];

export default function PerformancePage() {
    return (
        <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans flex flex-col dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 flex-shrink-0 dark:text-zinc-400">
                PERFORMANCE SYSTEM
            </h1>

            {/* Filter Section */}
            <div className="bg-white rounded border border-gray-100 p-6 shadow-sm flex-shrink-0 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Select User</label>
                        <Select>
                            <SelectTrigger className="h-10 text-[13px] text-gray-500 dark:text-zinc-400">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user1">M. Shahbaz</SelectItem>
                                <SelectItem value="user2">John Doe</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-2 relative">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">Start Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                                onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                            />
                            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 relative">
                        <label className="text-[12.5px] font-semibold text-[#495057] dark:text-zinc-400">End Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0" 
                                onClick={(e) => 'showPicker' in e.currentTarget && e.currentTarget.showPicker()} 
                            />
                            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
                <div>
                    <Button className="h-10 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide">
                        View
                    </Button>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white rounded border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 border-b border-gray-100 font-bold text-[15px] text-[#495057] dark:text-zinc-400 dark:border-zinc-800">
                    Performance View
                </div>
                <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                    <Table className="w-full border-collapse">
                        <TableHeader>
                            <TableRow className="bg-[#daf1e2] hover:bg-[#daf1e2] border-0 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center first:rounded-l dark:text-zinc-100">Company</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Amount</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center dark:text-zinc-100">Method</TableHead>
                                <TableHead className="text-[12.5px] font-bold text-[#212529] px-4 py-3 text-center last:rounded-r dark:text-zinc-100">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {PERFORMANCE_MOCK.map((row) => (
                                <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors border-0">
                                    <TableCell className="text-[12.5px] font-medium text-[#495057] px-4 py-4 text-center dark:text-zinc-400">{row.company}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] px-4 py-4 text-center dark:text-zinc-400">{row.amount}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] px-4 py-4 text-center dark:text-zinc-400">{row.method}</TableCell>
                                    <TableCell className="text-[12.5px] text-[#495057] px-4 py-4 text-center dark:text-zinc-400">{row.date}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
