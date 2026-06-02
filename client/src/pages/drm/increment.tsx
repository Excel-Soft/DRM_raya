import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const MOCK_DATA = [
    {
        id: 1,
        name: "Muhammad Tuqeer Razaq",
        salary: 34500,
        leavesCalc: "2 x 1150",
        amount: 2300,
        totalMin: 14868,
        relaxationMin: 4560,
        incrementMin: 10308,
        totalLeaves: "(Leaves (24-40) > 24) = 16",
        incrementLeaves: 16,
        fullDetail: "Total Task 59/ Pending 0/ Running 11/ Running 35",
        notice: 0,
        lastIncrement: "03 Oct, 2025",
        startDate: "03 Sep, 2026"
    },
    {
        id: 2,
        name: "Bilal Ramzan",
        salary: 50000,
        leavesCalc: "4 x 1667",
        amount: 6668,
        totalMin: 8404,
        relaxationMin: 4080,
        incrementMin: 4324,
        totalLeaves: "(Leaves (24-20) > 24) = 0",
        incrementLeaves: 0,
        fullDetail: "Total Task 0/ Pending 0/ Running 0/ Running 0",
        notice: 0,
        lastIncrement: "02 Aug, 2025",
        startDate: "02 Jul, 2026"
    },
    {
        id: 3,
        name: "Rehan Ali",
        salary: 30000,
        leavesCalc: "10 x 1000",
        amount: 10000,
        totalMin: 14798,
        relaxationMin: 4080,
        incrementMin: 10718,
        totalLeaves: "(Leaves (24-15) > 24) = 0",
        incrementLeaves: 0,
        fullDetail: "Total Task 284/ Pending 0/ Running 5/ Running 1",
        notice: 0,
        lastIncrement: "02 Sep, 2025",
        startDate: "02 Aug, 2026"
    }
];

export default function IncrementPage() {
    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[16px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">
                Increment
            </h1>

            {/* Top Filter Card */}
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Select User</Label>
                            <Select>
                                <SelectTrigger className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user1">Muhammad Tuqeer Razaq</SelectItem>
                                    <SelectItem value="user2">Bilal Ramzan</SelectItem>
                                    <SelectItem value="user3">Rehan Ali</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Start Date</Label>
                            <Input 
                                type="date" 
                                className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 uppercase dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                placeholder="yyyy-m-dd"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">End Date</Label>
                            <Input 
                                type="date" 
                                className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 uppercase dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                placeholder="yyyy-m-dd"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-[13px] font-medium shadow-none">
                            View
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Table Area */}
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-0 table-responsive-wrapper">
                    {/* Toolbar */}
                    <div className="p-4 flex justify-between items-center bg-white border-b border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Show</span>
                            <Select defaultValue="30">
                                <SelectTrigger className="w-[65px] h-8 text-[13px] text-gray-700 dark:text-zinc-400">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="30">30</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">entries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Search:</span>
                            <Input className="w-[200px] h-8 text-[13px] border-gray-200 dark:border-zinc-800" />
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead>
                                <tr className="bg-[#f4f6f9] border-y border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">No</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Name</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Salary</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Leaves x Per Day</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Amount</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">Total Min</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">Relaxation Min</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">Increment Min</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">Total Leaves</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] whitespace-nowrap dark:text-zinc-400">Increment Leaves</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] min-w-[200px] dark:text-zinc-400">Full Detail</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Notice</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Last Increment</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Start Date</th>
                                    <th className="px-3 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_DATA.map((row) => (
                                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.id}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#00a65a] hover:underline cursor-pointer dark:text-zinc-400">{row.name}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.salary}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.leavesCalc}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.amount}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#00a65a] dark:text-zinc-400">{row.totalMin}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.relaxationMin}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.incrementMin}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.totalLeaves}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.incrementLeaves}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.fullDetail}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.notice}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{row.lastIncrement}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] whitespace-nowrap dark:text-zinc-400">{row.startDate}</td>
                                        <td className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 flex items-center justify-between border-t border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="text-[13px] text-[#495057] dark:text-zinc-400">
                            Showing 1 to 3 of 3 entries
                        </div>
                        <div className="flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <button className="px-3 py-1.5 text-[13px] text-[#6c757d] hover:bg-gray-50 focus:outline-none disabled:opacity-50 dark:hover:bg-zinc-800" disabled>Previous</button>
                            <button className="px-3 py-1.5 text-[13px] bg-[#00a65a] text-white focus:outline-none">1</button>
                            <button className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 disabled:opacity-50 focus:outline-none dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800" disabled>Next</button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
