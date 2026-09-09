import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ProjectActivity {
    id: number;
    company: string;
    person: string;
    project: string;
    status: string;
    docUpload: string;
    depApproved: string;
}

// This screen does not yet have a backend data source. Until one is wired in it
// renders an honest empty state rather than fabricated rows.
const PROJECT_ACTIVITIES: ProjectActivity[] = [];

export default function PmsSettingPage() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

    const openDialog = (activity: any) => {
        setSelectedActivity(activity);
        setIsDialogOpen(true);
    };

    const exportData = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (!PROJECT_ACTIVITIES || PROJECT_ACTIVITIES.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["No#", "Company", "Person", "Project", "Status", "Doc Upload", "Dep Approved"];
        const rows = PROJECT_ACTIVITIES.map((activity) => [
            activity.id.toString(),
            activity.company,
            activity.person,
            activity.project,
            activity.status,
            activity.docUpload,
            activity.depApproved
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
            link.download = `project-activity.${ext}`;
            link.click();
            toast({ title: `${formatType.toUpperCase()} file downloaded` });
        } else if (formatType === "pdf") {
            window.print();
        }
    };

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 dark:text-zinc-400">List of Project Activity</h1>

            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-6">
                    {/* Top Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => exportData('copy')} className="bg-[#66758c] hover:bg-[#576477] text-white rounded h-9 px-4 text-[13px] font-medium shadow-none">Copy</Button>
                            <Button onClick={() => exportData('excel')} className="bg-[#66758c] hover:bg-[#576477] text-white rounded h-9 px-4 text-[13px] font-medium shadow-none">Excel</Button>
                            <Button onClick={() => exportData('csv')} className="bg-[#66758c] hover:bg-[#576477] text-white rounded h-9 px-4 text-[13px] font-medium shadow-none">CSV</Button>
                            <Button onClick={() => exportData('pdf')} className="bg-[#66758c] hover:bg-[#576477] text-white rounded h-9 px-4 text-[13px] font-medium shadow-none">PDF</Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-600 font-medium dark:text-zinc-300">Search:</span>
                            <Input
                                className="w-[180px] h-[34px] text-[13px] rounded-sm border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300 focus-visible:ring-offset-0 transition-none dark:border-zinc-800"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="w-full overflow-x-auto border-t border-gray-100 dark:border-zinc-800">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-[#f4f6f9] text-[#495057] text-[13px] font-bold border-b border-gray-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="p-3 py-4 w-[70px] pl-4">No#</th>
                                    <th className="p-3 py-4">Company</th>
                                    <th className="p-3 py-4">Person</th>
                                    <th className="p-3 py-4">Project</th>
                                    <th className="p-3 py-4">Status</th>
                                    <th className="p-3 py-4">Doc Upload</th>
                                    <th className="p-3 py-4">Dep Approved</th>
                                    <th className="p-3 py-4 text-center pr-4">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PROJECT_ACTIVITIES.filter((a) => !searchTerm || a.company.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-[13px] text-[#868e96]">No project activity to display. This screen is not yet connected to a live data source.</td>
                                    </tr>
                                ) : PROJECT_ACTIVITIES.filter((a) => !searchTerm || a.company.toLowerCase().includes(searchTerm.toLowerCase())).map((activity, index) => (
                                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors dark:border-zinc-800">
                                        <td className="p-3 py-[18px] pl-4 text-[13px] font-bold text-[#00a65a] dark:text-zinc-400">{activity.id}</td>
                                        <td className="p-3 py-[18px] text-[13px] font-semibold text-[#6c757d]">{activity.company}</td>
                                        <td className="p-3 py-[18px] text-[13px] text-[#6c757d]">{activity.person}</td>
                                        <td className="p-3 py-[18px] text-[13px] text-[#6c757d] uppercase">{activity.project}</td>
                                        <td className="p-3 py-[18px]">
                                            <span className="bg-[#f1f3f5] text-[#868e96] border border-gray-200 text-[11px] px-3.5 py-1 rounded-full font-medium shadow-sm dark:bg-zinc-800 dark:border-zinc-800">
                                                {activity.status}
                                            </span>
                                        </td>
                                        <td className="p-3 py-[18px] text-[13px] text-[#6c757d]">{activity.docUpload}</td>
                                        <td className="p-3 py-[18px] text-[13px] text-[#6c757d]">{activity.depApproved}</td>
                                        <td className="p-3 py-[18px] text-center pr-4">
                                            <button 
                                                onClick={() => openDialog(activity)}
                                                className="text-[#e74c3c] hover:text-red-700 hover:scale-110 transition-all p-1 inline-flex items-center justify-center bg-transparent border-0 cursor-pointer" 
                                                aria-label="Action"
                                            >
                                                <Send size={18} strokeWidth={1.5} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-6 text-[13px] text-[#868e96] pl-2 font-medium">
                        Showing {PROJECT_ACTIVITIES.length === 0 ? 0 : 1} to {PROJECT_ACTIVITIES.length} of {PROJECT_ACTIVITIES.length} entries
                    </div>
                </CardContent>
            </Card>

            {/* Create New Task Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-[700px] p-0 border-0 shadow-lg font-sans bg-white overflow-hidden [&>button]:hidden dark:bg-zinc-900">
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-bold text-slate-700 flex items-center gap-2 m-0 p-0 dark:text-zinc-400">
                            Create New Task 
                            <span className="text-[#059669] text-[15px] font-semibold tracking-wide lowercase dark:text-zinc-400">
                                {format(new Date(), "dd-MM-yyyy hh:mm a")}
                            </span>
                        </DialogTitle>
                        <button 
                            onClick={() => setIsDialogOpen(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                        >
                            <X size={20} strokeWidth={1.5} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-5 mb-5">
                            {/* Row 1 */}
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Company</Label>
                                <Input 
                                    readOnly 
                                    value={selectedActivity?.company || ""} 
                                    className="h-[38px] bg-[#f1f4f9] border-gray-200 text-[13px] text-slate-500 shadow-none focus-visible:ring-0 cursor-not-allowed dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" 
                                />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Project</Label>
                                <Input 
                                    readOnly 
                                    value={selectedActivity?.project || ""} 
                                    className="h-[38px] bg-[#f1f4f9] border-gray-200 text-[13px] text-slate-500 shadow-none focus-visible:ring-0 cursor-not-allowed dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" 
                                />
                            </div>

                            {/* Row 2 */}
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Person</Label>
                                <Select>
                                    <SelectTrigger className="h-[38px] w-full bg-white text-[13px] text-gray-500 border-gray-200 shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="person1">Person 1</SelectItem>
                                        <SelectItem value="person2">Person 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Task</Label>
                                <Select>
                                    <SelectTrigger className="h-[38px] w-full bg-white text-[13px] text-gray-500 border-gray-200 shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="t1">Task 1</SelectItem>
                                        <SelectItem value="t2">Task 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 3 - Three Columns */}
                        <div className="grid grid-cols-3 gap-x-4 mb-5">
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Task Time</Label>
                                <Input 
                                    className="h-[38px] bg-[#f1f4f9] border-gray-200 text-[13px] shadow-none focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900" 
                                />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Links</Label>
                                <Input 
                                    placeholder="Working Links" 
                                    className="h-[38px] bg-white border-gray-200 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-[#059669] dark:bg-zinc-900 dark:border-zinc-800" 
                                />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Next Day</Label>
                                <Input 
                                    type="datetime-local" 
                                    className="h-[38px] bg-white border-gray-200 text-[13px] shadow-none text-slate-500 focus-visible:ring-1 focus-visible:ring-[#059669] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" 
                                    placeholder="dd/mm/yyyy --:--"
                                />
                            </div>
                        </div>

                        {/* Row 4 - Full Width Textarea */}
                        <div className="space-y-1.5 flex flex-col mb-4">
                            <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Detail</Label>
                            <Textarea 
                                placeholder="Add detail" 
                                className="min-h-[80px] w-full bg-white text-[13px] text-gray-600 border-gray-200 shadow-none focus-visible:ring-1 focus-visible:ring-[#059669] resize-y dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" 
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <Button 
                            variant="secondary" 
                            onClick={() => setIsDialogOpen(false)}
                            className="bg-[#f1f4f9] hover:bg-[#e2e8f0] text-slate-600 font-medium h-[38px] px-6 text-[13px] shadow-none dark:text-zinc-300 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                            Close
                        </Button>
                        <Button 
                            className="bg-[#059669] hover:bg-[#047857] text-white font-medium h-[38px] px-6 text-[13px] shadow-none"
                        >
                            Save
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
