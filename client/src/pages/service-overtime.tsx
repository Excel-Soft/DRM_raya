import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plug } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function ServiceOvertime() {
    const queryClient = useQueryClient();
    const { data: records = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/overtime/all"],
    });

    const [selectedOvertime, setSelectedOvertime] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/overtime/${id}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
            if (!res.ok) throw new Error("Failed to approve");
            return res.json();
        },
        onSuccess: () => { toast({ title: "Overtime Approved" }); queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] }); setIsModalOpen(false); },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/overtime/${id}/reject`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Rejected by manager" }) });
            if (!res.ok) throw new Error("Failed to reject");
            return res.json();
        },
        onSuccess: () => { toast({ title: "Overtime Rejected" }); queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] }); setIsModalOpen(false); },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            {/* Header */}
            <div className="mb-6 flex items-center">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">OVERTIME</h2>
            </div>

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
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">#</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Name</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Task</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Time</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Task Detail</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Manager</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Create</TableHead>
                                <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-4">Loading...</TableCell>
                                </TableRow>
                            ) : records.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-4 text-slate-500">No overtime records found</TableCell>
                                </TableRow>
                            ) : (
                                records.map((row: any, index: number) => (
                                <TableRow key={row.id} className="hover:bg-transparent border-b border-slate-100 text-[13px] font-medium text-[#475569] dark:text-zinc-400 dark:border-zinc-800">
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">{index + 1}</TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">{row.userName || row.full_name || "Employee"}</TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">{row.taskTitle || "—"}</TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">{row.timeSpent} hrs</TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 text-slate-500 max-w-[180px] truncate dark:text-zinc-400 dark:border-zinc-800" title={row.reason}>{row.reason || row.taskDetails || "—"}</TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">
                                        <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${row.status === 'Approved' ? 'bg-emerald-50 text-emerald-600' : row.status === 'Rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>{row.status || 'Pending'}</span>
                                    </TableCell>
                                    <TableCell className="py-4 border-r border-slate-100 dark:border-zinc-800">{row.date ? format(new Date(row.date), "yyyy-MM-dd hh:mm:a") : ''}</TableCell>
                                    <TableCell className="py-4">
                                        <button
                                            onClick={() => {
                                                setSelectedOvertime(row);
                                                setIsModalOpen(true);
                                            }}
                                            className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer pl-2 dark:text-zinc-400"
                                        >
                                            <Plug className="h-[18px] w-[18px]" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            )))}
                        </TableBody>
                    </Table>
                </div>

                {/* Bottom Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                    <div>
                        <div>Showing 1 to {records.length} of {records.length} entries</div>
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

            {/* Overtime Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[450px] p-0 gap-0 border-0 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
                    <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-bold text-[#475569] dark:text-zinc-400">Overtime</DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Employee</label>
                            <Input value={selectedOvertime?.userName || selectedOvertime?.name || ""} disabled className="bg-[#f8fafc] border-slate-200 text-[#475569] h-10 text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Task</label>
                            <Input value={selectedOvertime?.taskTitle || selectedOvertime?.task || ""} disabled className="bg-[#f8fafc] border-slate-200 text-[#475569] h-10 text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Reason</label>
                            <textarea value={selectedOvertime?.reason || ""} disabled rows={3} className="w-full bg-[#f8fafc] border border-slate-200 rounded p-2 text-[13px] text-[#475569] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Time Requested</label>
                            <Input value={`${selectedOvertime?.timeSpent || ""} hours`} disabled className="bg-[#f8fafc] border-slate-200 text-[#475569] h-10 text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Status</label>
                            <Input value={selectedOvertime?.status || "Pending"} disabled className="bg-[#f8fafc] border-slate-200 text-[#475569] h-10 text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white sm:justify-end gap-2 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="bg-[#f1f5f9] hover:bg-slate-200 text-[#475569] border border-[#e2e8f0] font-medium h-9 px-4 rounded dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800">Close</Button>
                        {selectedOvertime?.status === 'Pending' && (
                            <>
                                <Button onClick={() => rejectMutation.mutate(selectedOvertime.id)} variant="destructive" disabled={rejectMutation.isPending} className="h-9 px-4 rounded">Reject</Button>
                                <Button onClick={() => approveMutation.mutate(selectedOvertime.id)} disabled={approveMutation.isPending} className="bg-[#059669] hover:bg-[#047857] text-white font-medium h-9 px-4 rounded">Approve</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
