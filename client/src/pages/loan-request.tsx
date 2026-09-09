import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LoanRequest, User } from "@shared/schema";
import { Trash2 } from "lucide-react";

export default function LoanRequestPage() {
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"list" | "add" | "history">("list");
    
    const userRoleName = (typeof window !== "undefined" ? sessionStorage.getItem("userRole") : "")?.toLowerCase().replace(/\s+/g, "_") || "";
    const isSalesExecutive = userRoleName === "sales_executive";
    
    // Add form state
    const [addForm, setAddForm] = useState({ employee: sessionStorage.getItem("userName") || "", amount: "", instalment: "", detail: "" });
    
    // History form state
    const [historyForm, setHistoryForm] = useState({ employee: sessionStorage.getItem("userName") || "", start: "", end: "" });
    const [appliedStart, setAppliedStart] = useState("");
    const [appliedEnd, setAppliedEnd] = useState("");

    const { data: loanRequests, isLoading: loadingRequests } = useQuery<LoanRequest[]>({
        queryKey: ["/api/loans"],
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequest("DELETE", `/api/loans/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
            queryClient.invalidateQueries({ queryKey: ["/api/loans/stats"] });
            toast({ title: "Loan request deleted successfully" });
        },
        onError: () => {
            toast({
                title: "Failed to delete loan request",
                variant: "destructive",
            });
        },
    });
    
    const addMutation = useMutation({
        mutationFn: async (data: any) => {
            return apiRequest("POST", "/api/loans", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
            toast({ title: "Loan added successfully" });
            setAddForm({ employee: sessionStorage.getItem("userName") || "", amount: "", instalment: "", detail: "" });
            setActiveTab("list");
        },
        onError: () => {
            toast({ title: "Failed to add loan", variant: "destructive" });
        }
    });

    const exportData = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (!loanRequests || loanRequests.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["No#", "Employee", "Advance", "Detail", "Instalment", "Remaining", "Manager", "Hod", "Date"];
        const rows = loanRequests.map((loan, idx) => [
            (idx + 1).toString(),
            (loan as any).userName || "Employee",
            loan.amount.toString(),
            loan.detail,
            loan.installmentAmount.toString(),
            loan.remainingAmount.toString(),
            loan.managerApprovedByUserId ? "Approved" : "Pending",
            loan.hodApprovedByUserId ? "Approved" : "Pending",
            loan.createdAt ? format(new Date(loan.createdAt), "MMM d, yyyy") : "-"
        ]);

        if (formatType === "copy") {
            const text = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
            navigator.clipboard.writeText(text);
            toast({ title: "Data copied to clipboard" });
        } else if (formatType === "csv" || formatType === "excel") {
            const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
            const mime = formatType === "csv" ? "text/csv" : "application/vnd.ms-excel";
            const ext = formatType === "csv" ? "csv" : "xls";
            const blob = new Blob([csv], { type: mime });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `advance-salary.${ext}`;
            link.click();
            toast({ title: `${formatType.toUpperCase()} file downloaded` });
        } else if (formatType === "pdf") {
            window.print();
        }
    };

    const filteredRequests = loanRequests?.filter((l) => {
        if (activeTab === "history") {
            if (appliedStart && l.createdAt) {
                const startDate = new Date(appliedStart);
                startDate.setHours(0, 0, 0, 0);
                if (new Date(l.createdAt).getTime() < startDate.getTime()) return false;
            }
            if (appliedEnd && l.createdAt) {
                const endDate = new Date(appliedEnd);
                endDate.setHours(23, 59, 59, 999);
                if (new Date(l.createdAt).getTime() > endDate.getTime()) return false;
            }
        }

        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        const userName = ((l as any).userName || "Employee").toLowerCase();
        return (
            userName.includes(query) ||
            l.detail?.toLowerCase().includes(query) ||
            l.status?.toLowerCase().includes(query)
        );
    }) || [];

    const handleAddSubmit = () => {
        if (!addForm.amount || !addForm.instalment) {
            toast({ title: "Amount and Instalment are required", variant: "destructive" });
            return;
        }
        addMutation.mutate({
            amount: addForm.amount,
            installmentAmount: addForm.instalment,
            remainingAmount: addForm.amount,
            detail: addForm.detail,
            status: "Pending"
        });
    };

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] font-sans dark:bg-zinc-950">
            <div className="flex items-center gap-2 mb-6 text-[16px] font-bold tracking-wide uppercase">
                <button 
                    onClick={() => setActiveTab("list")} 
                    className={`${activeTab === "list" ? "text-[#00a65a]" : "text-[#495057] dark:text-zinc-400"} hover:text-[#00a65a] transition-colors`}
                >
                    ADVANCE SALARY LIST
                </button>
                <span className="text-gray-400">/</span>
                <button 
                    onClick={() => setActiveTab("add")} 
                    className={`${activeTab === "add" ? "text-[#00a65a]" : "text-[#495057] dark:text-zinc-400"} hover:text-[#00a65a] transition-colors`}
                >
                    ADD LOAN
                </button>
                <span className="text-gray-400">/</span>
                <button 
                    onClick={() => setActiveTab("history")} 
                    className={`${activeTab === "history" ? "text-[#00a65a]" : "text-[#495057] dark:text-zinc-400"} hover:text-[#00a65a] transition-colors`}
                >
                    LOAN HISTORY
                </button>
            </div>

            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-5">
                    
                    {activeTab === "add" && (
                        <div className="mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Employee</label>
                                    <Input 
                                        value={addForm.employee}
                                        readOnly
                                        className="h-9 text-[13px] bg-gray-200 cursor-not-allowed dark:bg-zinc-800" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Amount:</label>
                                    <Input 
                                        type="number"
                                        placeholder="00:00"
                                        value={addForm.amount}
                                        onChange={(e) => setAddForm({...addForm, amount: e.target.value})}
                                        className="h-9 text-[13px]" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Instalment:</label>
                                    <Input 
                                        type="number"
                                        placeholder="Instalment"
                                        value={addForm.instalment}
                                        onChange={(e) => setAddForm({...addForm, instalment: e.target.value})}
                                        className="h-9 text-[13px]" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Detail</label>
                                    <Input 
                                        placeholder="add detail"
                                        value={addForm.detail}
                                        onChange={(e) => setAddForm({...addForm, detail: e.target.value})}
                                        className="h-9 text-[13px]" 
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={handleAddSubmit}
                                disabled={addMutation.isPending}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[3px]"
                            >
                                Submit
                            </Button>
                        </div>
                    )}

                    {activeTab === "history" && (
                        <div className="mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Employee</label>
                                    <Input 
                                        value={historyForm.employee}
                                        readOnly
                                        className="h-9 text-[13px] bg-gray-200 cursor-not-allowed dark:bg-zinc-800" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">Start:</label>
                                    <Input 
                                        type="date"
                                        value={historyForm.start}
                                        onChange={(e) => setHistoryForm({...historyForm, start: e.target.value})}
                                        className="h-9 text-[13px]" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] text-[#495057] mb-1 dark:text-zinc-400">End:</label>
                                    <Input 
                                        type="date"
                                        value={historyForm.end}
                                        onChange={(e) => setHistoryForm({...historyForm, end: e.target.value})}
                                        className="h-9 text-[13px]" 
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={() => {
                                    setAppliedStart(historyForm.start);
                                    setAppliedEnd(historyForm.end);
                                }}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[3px]"
                            >
                                View
                            </Button>
                        </div>
                    )}

                    {/* Table Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 mt-2">
                        {/* Action Buttons */}
                        <div className="flex bg-[#6c757d] rounded-[3px] overflow-hidden shadow-sm h-8">
                            <button 
                                onClick={() => exportData('copy')}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                            >
                                Copy
                            </button>
                            <button 
                                onClick={() => exportData('excel')}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                            >
                                Excel
                            </button>
                            <button 
                                onClick={() => exportData('csv')}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] border-r border-[#5a6268] transition-colors dark:border-zinc-800"
                            >
                                CSV
                            </button>
                            <button 
                                onClick={() => exportData('pdf')}
                                className="px-3 text-[13px] text-white hover:bg-[#5a6268] transition-colors"
                            >
                                PDF
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-[#495057] dark:text-zinc-400">Search:</span>
                            <Input 
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 w-[200px] bg-white text-[13px] text-gray-500 shadow-sm border-gray-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full border border-gray-200 overflow-hidden mb-4 rounded-t dark:border-zinc-800">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f1f5f9] border-b border-gray-200 dark:bg-zinc-800 dark:border-zinc-800">
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white w-[50px] dark:text-zinc-400">No#</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Employee</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Advance</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Detail</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Instalment</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Remaining</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Manager</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Hod</th>
                                    <th className="px-3 py-3 text-[13px] font-bold text-[#495057] border-r border-white dark:text-zinc-400">Date</th>
                                    {!isSalesExecutive && <th className="px-3 py-3 text-[13px] font-bold text-[#495057] dark:text-zinc-400">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {!loadingRequests && filteredRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={isSalesExecutive ? 9 : 10} className="px-3 py-4 text-[13px] text-[#495057] text-center dark:text-zinc-400">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRequests.map((loan, idx) => (
                                        <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{idx + 1}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{(loan as any).userName || "Employee"}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.amount}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.detail}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.installmentAmount}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.remainingAmount}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.managerApprovedByUserId ? "Approved" : "Pending"}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">{loan.hodApprovedByUserId ? "Approved" : "Pending"}</td>
                                            <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">
                                                {loan.createdAt ? format(new Date(loan.createdAt), "MMM d, yyyy") : "-"}
                                            </td>
                                            {!isSalesExecutive && (
                                                <td className="px-3 py-4 text-[13px] text-gray-700 dark:text-zinc-400">
                                                    <button 
                                                        onClick={() => deleteMutation.mutate(loan.id)}
                                                        className="w-7 h-7 bg-red-50 text-red-500 rounded flex items-center justify-center hover:bg-red-100 border border-red-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Summary row if empty, mocked in screenshots */}
                    {!loadingRequests && filteredRequests.length === 0 && (
                        <div className="flex border-b border-gray-100 py-3 px-3 dark:border-zinc-800">
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Total</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">0</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">Remaining</div>
                            <div className="flex-1 text-center text-[13px] font-bold text-gray-700 dark:text-zinc-400">0</div>
                            <div className="flex-[3]"></div>
                        </div>
                    )}

                    {/* Footer Controls */}
                    <div className="text-[13px] text-[#495057] mt-4 dark:text-zinc-400">
                        Showing {filteredRequests.length > 0 ? 1 : 0} to {filteredRequests.length} of {filteredRequests.length} entries
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
