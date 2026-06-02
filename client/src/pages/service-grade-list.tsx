import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function ServiceGradeList() {
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">GRADE SYSTEM</h2>
            </div>

            {/* Form Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Select User</label>
                        <Select>
                            <SelectTrigger className="w-full h-9 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user1">M Sajawal</SelectItem>
                                <SelectItem value="user2">Mehreena Moeed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Replicating the typo in the screenshot where the second field is also "Select User" */}
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Select User</label>
                        <Select>
                            <SelectTrigger className="w-full h-9 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grade1">Standard</SelectItem>
                                <SelectItem value="grade2">Premium</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Start Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className="flex border border-slate-200 rounded cursor-pointer group dark:border-zinc-800">
                                    <div className={cn("flex-1 px-3 py-2 text-[13px] text-left", !startDate && "text-slate-500 dark:text-slate-400")}>
                                        {startDate ? format(startDate, "yyyy-MM-dd") : "yyyy-m-d"}
                                    </div>
                                    <div className="bg-slate-50 px-3 flex items-center justify-center border-l border-slate-200 rounded-r group-hover:bg-slate-100 transition-colors dark:bg-zinc-900 dark:border-zinc-800">
                                        <CalendarIcon className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                                    </div>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={startDate}
                                    onSelect={setStartDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">End Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <div className="flex border border-slate-200 rounded cursor-pointer group dark:border-zinc-800">
                                    <div className={cn("flex-1 px-3 py-2 text-[13px] text-left", !endDate && "text-slate-500 dark:text-slate-400")}>
                                        {endDate ? format(endDate, "yyyy-MM-dd") : "yyyy-m-d"}
                                    </div>
                                    <div className="bg-slate-50 px-3 flex items-center justify-center border-l border-slate-200 rounded-r group-hover:bg-slate-100 transition-colors dark:bg-zinc-900 dark:border-zinc-800">
                                        <CalendarIcon className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                                    </div>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={endDate}
                                    onSelect={setEndDate}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <Button className="bg-[#059669] hover:bg-[#047857] text-white px-8 h-9 rounded text-[13px] font-medium">
                    View
                </Button>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="mb-4">
                    <h3 className="text-[15px] font-bold text-[#475569] dark:text-zinc-400">View Grade List</h3>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#d1fae5] border-b border-slate-200 hover:bg-[#d1fae5] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">#</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Company</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Package</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Price</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Comm</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Reward</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">VAS</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">KWA</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Method</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Person</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Pay</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">BV</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Rc/New</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Type</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-800 py-3 whitespace-nowrap dark:text-zinc-100">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="hover:bg-slate-50 border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">1</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">trusmile surgical</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">10000</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">364</TableCell>
                                <TableCell className="text-[12px] font-medium text-slate-600 py-3 dark:text-zinc-300">2021-07-13 17:08:25</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
