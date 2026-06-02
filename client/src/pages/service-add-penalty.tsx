import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function ServiceAddPenalty() {
    const mockData = [
        { id: 1, name: "SYED HURR ABBAS", penaltyHead: "Gm Pending Ac", amount: "200", date: "01-04-2026", addBy: "" },
        { id: 2, name: "SYED HURR ABBAS", penaltyHead: "Gm Pending Ac", amount: "200", date: "01-04-2026", addBy: "" },
        { id: 3, name: "Ahsan Ali", penaltyHead: "Others", amount: "200", date: "01-04-2026", addBy: "Jibran Razzaq" },
        { id: 4, name: "M Ashjah", penaltyHead: "Mobile", amount: "200", date: "01-04-2026", addBy: "Jibran Razzaq" },
    ];

    const [showForm, setShowForm] = useState(false);

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">PENALTY</h2>
                <span className="text-[17px] font-bold text-slate-300">/</span>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="text-[17px] font-bold text-[#059669] uppercase tracking-tight hover:opacity-80 transition-opacity dark:text-zinc-400"
                >
                    ADD PENALTY
                </button>
            </div>

            {/* Add Penalty Form */}
            {showForm && (
                <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="flex flex-col md:flex-row items-end gap-6">
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Person</label>
                            <Select>
                                <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="p1">Jibran Razzaq</SelectItem>
                                    <SelectItem value="p2">M Ashjah</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Head</label>
                            <Select>
                                <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="h1">Gm Pending Ac</SelectItem>
                                    <SelectItem value="h2">Mobile</SelectItem>
                                    <SelectItem value="h3">Others</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="block text-[13px] font-semibold text-slate-600 mb-2 dark:text-zinc-300">Amount</label>
                            <Input
                                placeholder="00:00"
                                className="w-full h-10 text-[13px] border-slate-200 bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                        <div>
                            <Button className="bg-[#059669] hover:bg-[#047857] text-white font-medium h-10 px-8 rounded text-[13px]">
                                Submit
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="bg-white rounded-[4px] shadow-sm border border-slate-100 p-6 relative dark:bg-zinc-900 dark:border-zinc-800">

                {/* Top Controls: Show entries and Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2 text-[13px] text-slate-600 font-medium dark:text-zinc-300">
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
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">No</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Penalty Head</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Amount</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Date</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[20%] dark:text-zinc-400 dark:border-zinc-800">Add By</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap w-[10%] dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockData.map((row) => (
                                <TableRow key={row.id} className="hover:bg-transparent border-b border-slate-100 text-[13px] font-medium text-[#475569] h-12 dark:text-zinc-400 dark:border-zinc-800">
                                    <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.id}</TableCell>
                                    <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.name}</TableCell>
                                    <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.penaltyHead}</TableCell>
                                    <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.amount}</TableCell>
                                    <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.date}</TableCell>
                                    <TableCell className="py-2 border-r border-slate-100 text-[#64748b] dark:border-zinc-800">{row.addBy}</TableCell>
                                    <TableCell className="py-2"></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                    <div>
                        Showing 1 to {mockData.length} of {mockData.length} entries
                    </div>

                    <div className="flex rounded mt-4 sm:mt-0 shadow-sm">
                        <button className="px-3 py-1.5 border border-slate-200 border-r-0 rounded-l text-[#94a3b8] bg-white cursor-not-allowed hover:bg-slate-50 font-medium transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                            Previous
                        </button>
                        <button className="px-3.5 py-1.5 border-y border-[#059669] text-white bg-[#059669] font-medium relative -ml-[1px] dark:border-zinc-800">
                            1
                        </button>
                        <button className="px-3 py-1.5 border border-slate-200 border-l-0 rounded-r text-[#94a3b8] bg-white cursor-not-allowed hover:bg-slate-50 font-medium transition-colors relative -ml-[1px] dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                            Next
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
