import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ServiceLeaveApplication() {
    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">PENDING LEAVE</h2>
                <span className="text-[17px] font-bold text-slate-300">/</span>
                <h2 className="text-[17px] font-bold text-[#059669] uppercase tracking-tight dark:text-zinc-400">FORMS</h2>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Top Controls: Show entries and Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                        <span>Show</span>
                        <Select defaultValue="10">
                            <SelectTrigger className="w-[70px] h-8 text-[13px] border-slate-200 dark:border-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <span>entries</span>
                    </div>

                    <div className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                        <span>Search:</span>
                        <Input className="w-[200px] h-8 text-[13px] border-slate-200 dark:border-zinc-800" />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                            <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">No</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Purpose</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Type</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Alternative</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Detail</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Monthly Leaves</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Monthly Half Leaves</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Day</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Time</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Start</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">End</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-slate-600 py-3 whitespace-nowrap dark:text-zinc-300">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                <TableCell colSpan={14} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                    No data available in table
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-[13px] text-slate-500 gap-4 dark:text-zinc-400">
                    <div>
                        Showing 0 to 0 of 0 entries
                    </div>
                    <div className="flex">
                        <button className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l text-slate-400 bg-white cursor-not-allowed hover:bg-slate-50 font-medium dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                            Previous
                        </button>
                        <button className="px-3 py-1.5 border border-slate-200 rounded-r text-slate-400 bg-white cursor-not-allowed hover:bg-slate-50 font-medium dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
