import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

const DUMMY_DATA = [
    { id: 1, company: "trusmile surgical", amount: 10000, method: 364, date: "2021-07-13 17:08:25" },
    { id: 2, company: "trusmile surgical", amount: 10000, method: 364, date: "2021-07-13 17:08:25" },
    { id: 3, company: "excelstech", amount: 15000, method: 120, date: "2023-01-15 10:00:00" },
    { id: 4, company: "alpha tech", amount: 5000, method: 50, date: "2024-05-20 14:30:00" },
];

export default function VasSystem() {
    const [monthWise, setMonthWise] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filteredData, setFilteredData] = useState(DUMMY_DATA);

    const handleView = () => {
        let result = DUMMY_DATA;
        if (startDate) {
            result = result.filter(item => new Date(item.date) >= new Date(startDate));
        }
        if (endDate) {
            result = result.filter(item => new Date(item.date) <= new Date(endDate + 'T23:59:59'));
        }
        setFilteredData(result);
    };
    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 space-y-6 dark:bg-zinc-950">
            <h1 className="text-xl font-bold text-slate-700 uppercase mb-4 dark:text-zinc-400">VAS SYSTEM</h1>
            
            {/* Top Filter Section */}
            <div className="bg-white rounded border border-slate-200 p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <div className="grid grid-cols-3 gap-6 mb-4">
                    {/* Select User */}
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <label className="text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Select User</label>
                            <label className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-zinc-300">
                                <Checkbox 
                                    className="rounded-sm border-slate-300 dark:border-zinc-800" 
                                    checked={monthWise}
                                    onCheckedChange={(c) => setMonthWise(!!c)}
                                /> Month Wise
                            </label>
                        </div>
                        <Input value="M. Shahbaz" readOnly className="bg-slate-50 text-slate-500 border-slate-200 h-10 shadow-none focus-visible:ring-0 cursor-default dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                    </div>

                    {/* Start Date */}
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-700 mb-2 dark:text-zinc-400">Start Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 border-slate-200 text-slate-500 shadow-none focus-visible:ring-0 dark:text-zinc-400 dark:border-zinc-800" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* End Date */}
                    <div>
                        <label className="block text-[13px] font-semibold text-slate-700 mb-2 dark:text-zinc-400">End Date</label>
                        <div className="relative">
                            <Input 
                                type="date" 
                                className="h-10 border-slate-200 text-slate-500 shadow-none focus-visible:ring-0 dark:text-zinc-400 dark:border-zinc-800" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <Button 
                    className="bg-[#059669] hover:bg-emerald-700 text-white font-medium px-8 h-10 rounded"
                    onClick={handleView}
                >
                    View
                </Button>
            </div>

            {/* Bottom Table Section */}
            <div className="bg-white rounded border border-slate-200 p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <h2 className="text-[15px] font-bold text-slate-700 mb-4 dark:text-zinc-400">VAS View</h2>
                
                <div className="overflow-hidden border border-slate-100 rounded dark:border-zinc-800">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[#d1fae5] hover:bg-[#d1fae5] border-b-0 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                                <TableHead className="text-[13px] font-bold text-slate-800 text-center py-3 h-auto dark:text-zinc-100">Company</TableHead>
                                <TableHead className="text-[13px] font-bold text-slate-800 text-center py-3 h-auto dark:text-zinc-100">Amount</TableHead>
                                <TableHead className="text-[13px] font-bold text-slate-800 text-center py-3 h-auto dark:text-zinc-100">Method</TableHead>
                                <TableHead className="text-[13px] font-bold text-slate-800 text-center py-3 h-auto dark:text-zinc-100">Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length > 0 ? (
                                filteredData.map((row, idx) => (
                                    <TableRow key={row.id} className={`${idx === filteredData.length - 1 ? 'border-b-0' : 'border-b border-slate-100 dark:border-slate-700'} hover:bg-slate-50 dark:bg-zinc-900`}>
                                        <TableCell className="text-[13px] text-slate-600 font-medium text-center py-4 dark:text-zinc-300">{row.company}</TableCell>
                                        <TableCell className="text-[13px] text-slate-600 font-medium text-center py-4 dark:text-zinc-300">{row.amount}</TableCell>
                                        <TableCell className="text-[13px] text-slate-600 font-medium text-center py-4 dark:text-zinc-300">{row.method}</TableCell>
                                        <TableCell className="text-[13px] text-slate-600 font-medium text-center py-4 dark:text-zinc-300">{row.date}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-b-0">
                                    <TableCell colSpan={4} className="text-center py-8 text-slate-500 dark:text-zinc-400">No data found for the selected date range.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
