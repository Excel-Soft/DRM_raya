import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MOCK_PENALTIES = [
    { id: 1, name: "Ahsan Ali", head: "Others", amount: 200, date: "01-04-2026", addBy: "Jibran Razzaq" },
    { id: 2, name: "M Ashjah", head: "Mobile", amount: 200, date: "01-04-2026", addBy: "Jibran Razzaq" },
    { id: 3, name: "Simran Hina", head: "Late Arrival After Lunch", amount: 150, date: "02-04-2026", addBy: "Rehman Faisal" },
    { id: 4, name: "Mehak Khalil", head: "Late Arrival After Lunch", amount: 150, date: "02-04-2026", addBy: "Rehman Faisal" },
    { id: 5, name: "Hifsa Abid", head: "Late Arrival After Lunch", amount: 150, date: "02-04-2026", addBy: "Rehman Faisal" },
    { id: 6, name: "Fatima Zubair", head: "Late Arrival After Lunch", amount: 150, date: "02-04-2026", addBy: "Rehman Faisal" },
    { id: 7, name: "SYED HURR ABBAS", head: "Gm Pending Ac", amount: 200, date: "03-04-2026", addBy: "" },
    { id: 8, name: "SYED HURR ABBAS", head: "Gm Pending Ac", amount: 200, date: "03-04-2026", addBy: "" },
    { id: 9, name: "SYED HURR ABBAS", head: "Gm Pending Ac", amount: 200, date: "04-04-2026", addBy: "" },
    { id: 10, name: "SYED HURR ABBAS", head: "Gm Pending Ac", amount: 200, date: "04-04-2026", addBy: "" },
];

export default function AddPenaltyPage() {
    const [showForm, setShowForm] = useState(false);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex space-x-1 uppercase text-[15px] font-bold tracking-wide">
                <span className="text-[#495057] dark:text-zinc-400">PENALTY / </span>
                <span 
                    className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
                    onClick={() => setShowForm(true)}
                >
                    ADD PENALTY
                </span>
            </div>

            {/* Expandable Form */}
            {showForm && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5 flex flex-col">
                        <label className="text-[13px] font-medium text-gray-700 dark:text-zinc-400">Person</label>
                        <Select>
                            <SelectTrigger className="h-9 w-full bg-white text-[13px] shadow-sm dark:bg-zinc-900">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user1">Ahsan Ali</SelectItem>
                                <SelectItem value="user2">SYED HURR ABBAS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                        <label className="text-[13px] font-medium text-gray-700 dark:text-zinc-400">Head</label>
                        <Select>
                            <SelectTrigger className="h-9 w-full bg-white text-[13px] shadow-sm dark:bg-zinc-900">
                                <SelectValue placeholder="Choose..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="others">Others</SelectItem>
                                <SelectItem value="late">Late Arrival</SelectItem>
                                <SelectItem value="mobile">Mobile</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                        <label className="text-[13px] font-medium text-gray-700 dark:text-zinc-400">Amount</label>
                        <Input placeholder="00:00" className="h-9 text-[13px] shadow-sm bg-[#f4f6f9] dark:bg-zinc-900" />
                    </div>
                    <div>
                        <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 font-medium shadow-none text-[13px]">
                            Submit
                        </Button>
                    </div>
                </div>
            )}

            {/* Table Area */}
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-0">
                    <div className="p-4 flex justify-between items-center bg-white dark:bg-zinc-900">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Show</span>
                            <Select defaultValue="10">
                                <SelectTrigger className="w-[65px] h-8 text-[13px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">entries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Search:</span>
                            <Input className="w-[200px] h-8 text-[13px]" />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f4f6f9] border-y border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">No</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Name</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Penalty Head</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Amount</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Date</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Add By</th>
                                    <th className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {MOCK_PENALTIES.map((penalty) => (
                                    <tr key={penalty.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:border-zinc-800">
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.id}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.name}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.head}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.amount}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.date}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400">{penalty.addBy}</td>
                                        <td className="px-4 py-3.5 text-[13px] text-[#495057] dark:text-zinc-400"></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 flex items-center justify-between bg-white border-t border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="text-[13px] text-[#495057] dark:text-zinc-400">
                            Showing 1 to 10 of 14 entries
                        </div>
                        <div className="flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                            <button className="px-3 py-1.5 text-[13px] text-[#6c757d] hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800" disabled>Previous</button>
                            <button className="px-3 py-1.5 text-[13px] bg-[#00a65a] text-white">1</button>
                            <button className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">2</button>
                            <button className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">Next</button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
