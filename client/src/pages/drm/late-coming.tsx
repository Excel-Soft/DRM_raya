import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function LateComingPage() {
    const [isAddMode, setIsAddMode] = useState(false);

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <h1 className="text-[16px] font-bold tracking-wide uppercase mb-6 flex items-center">
                <span className="text-[#495057] dark:text-zinc-400">LATE COMING</span>
                <span className="mx-1 text-[#495057] dark:text-zinc-400">/</span>
                <span 
                    className="text-[#00a65a] cursor-pointer hover:underline dark:text-zinc-400"
                    onClick={() => setIsAddMode(!isAddMode)}
                >
                    ADD LATE MINUT
                </span>
            </h1>

            {/* Conditionally Rendered Add Form */}
            {isAddMode && (
                <Card className="border border-gray-100 shadow-sm rounded-md bg-white mb-6 dark:bg-zinc-900 dark:border-zinc-800">
                    <CardContent className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Person</Label>
                                <Select>
                                    <SelectTrigger className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="p1">User 1</SelectItem>
                                        <SelectItem value="p2">User 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Purpose</Label>
                                <Input 
                                    placeholder="purpose" 
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                />
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Time In Mint</Label>
                                <Input 
                                    placeholder="time in mint" 
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                />
                            </div>

                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-medium text-[#495057] dark:text-zinc-400">Detail</Label>
                                <Input 
                                    placeholder="add detail" 
                                    className="h-9 w-full bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                />
                            </div>
                        </div>

                        <div>
                            <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-[13px] font-medium shadow-none">
                                Submit
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Data Table */}
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-5">
                    {/* Table Controls */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Show</span>
                            <Select defaultValue="10">
                                <SelectTrigger className="h-8 w-[70px] bg-white text-[13px] text-gray-600 border-gray-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">entries</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                            <Input 
                                type="search"
                                className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full border border-gray-200 overflow-hidden mb-4 dark:border-zinc-800">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-[#f2f2f2] border-b border-gray-200 dark:bg-zinc-800 dark:border-zinc-800">
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white w-[50px] dark:text-zinc-400">#</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Name</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Task</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Time</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Task Detail</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Create</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] dark:text-zinc-400">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={7} className="px-3 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                                        No data available in table
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Controls */}
                    <div className="flex justify-between items-center text-[13px] text-[#495057] dark:text-zinc-400">
                        <div>Showing 0 to 0 of 0 entries</div>
                        <div className="flex rounded-md overflow-hidden border border-gray-200 dark:border-zinc-800">
                            <button className="px-3 py-1.5 bg-[#f9f9f9] text-[#b0b0b0] cursor-not-allowed border-r border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                                Previous
                            </button>
                            <button className="px-3 py-1.5 bg-white text-[#b0b0b0] cursor-not-allowed dark:bg-zinc-900">
                                Next
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
