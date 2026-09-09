import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type AccordionData = {
    id: string;
    title: string;
    count: number;
    columns: string[];
    data: any[];
};

const ACCORDION_ITEMS: AccordionData[] = [
    { id: "drm-attendance", title: "Drm Attendance Report", count: 0, columns: ["S.No", "Name", "Date"], data: [] },
    { id: "total-recieved", title: "Total Received", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "total-unapproved", title: "Total Un-Approved", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "total-approved", title: "Total Approved", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { 
        id: "total-running", 
        title: "Total Running", 
        count: 1, 
        columns: ["S.No", "Company Name", "Project", "Date"], 
        data: [
            { sno: "1", company: "WELC", project: "SEO (1)", date: "06/04/2026" }
        ] 
    },
    { id: "qa-recieved", title: "QA Received", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "qa-approved", title: "QA Approved", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "qa-reject", title: "QA Reject / Changing", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "delay-projects", title: "Delay Projects", count: 0, columns: ["S.No", "Company Name", "Project", "Date"], data: [] },
    { id: "total-completed", title: "Total Completed Projects", count: 0, columns: ["S.No", "Company Name", "Project", "Qa Date", "Vfy Date"], data: [] },
    { id: "total-compliant", title: "Total Compliant", count: 0, columns: ["S.No", "Company Name", "Priority", "Date"], data: [] },
    { id: "resolved-compliant", title: "Resolved Compliant", count: 0, columns: ["S.No", "Company Name", "Priority", "Date"], data: [] },
];

export default function OverallReportPage() {
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

    const toggleItem = (id: string) => {
        setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">Project Management</h1>
            
            <Card className="border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <CardContent className="p-6">
                    {/* Top Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-gray-100 gap-4 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Show :</span>
                            <Checkbox className="rounded-sm border-gray-300 shadow-none data-[state=checked]:bg-[#00a65a] data-[state=checked]:border-[#00a65a] dark:border-zinc-800" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Input 
                                type="date"
                                className="w-[140px] h-9 text-[13px] text-gray-500 border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300 cursor-pointer dark:text-zinc-400 dark:border-zinc-800" 
                            />
                            <Input 
                                type="date"
                                className="w-[140px] h-9 text-[13px] text-gray-500 border-gray-300 focus-visible:ring-1 focus-visible:ring-gray-300 cursor-pointer dark:text-zinc-400 dark:border-zinc-800" 
                            />
                            <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 w-10 px-0 shadow-none rounded-sm flex items-center justify-center">
                                <Search size={16} />
                            </Button>
                        </div>
                    </div>

                    {/* Accordion List */}
                    <div className="w-full border border-gray-200 rounded-sm dark:border-zinc-800">
                        {ACCORDION_ITEMS.map((item, index) => {
                            const isOpen = openItems[item.id];
                            return (
                                <div key={item.id} className={cn("border-b border-gray-200 dark:border-slate-700 last:border-b-0")}>
                                    {/* Accordion Header */}
                                    <div 
                                        className={cn(
                                            "flex justify-between items-center px-4 py-3 cursor-pointer select-none transition-colors",
                                            isOpen ? "bg-[#f2f4fb] text-[#4f67c3]" : "bg-white dark:bg-zinc-900 text-[#495057] dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                        )}
                                        onClick={() => toggleItem(item.id)}
                                    >
                                        <span className="text-[14px] font-medium tracking-tight">
                                            {item.title} ({item.count})
                                        </span>
                                        {isOpen ? <ChevronUp size={18} className="text-[#a5b2e0]" /> : <ChevronDown size={18} className="text-gray-400" />}
                                    </div>

                                    {/* Accordion Content */}
                                    {isOpen && (
                                        <div className="bg-white border-t border-gray-200 p-0 overflow-x-auto dark:bg-zinc-900 dark:border-zinc-800">
                                            <table className="w-full text-left min-w-[600px] border-collapse">
                                                <thead>
                                                    <tr className="bg-white border-b border-gray-200 text-[#495057] text-[12px] font-bold dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                                        {item.columns.map((col, idx) => (
                                                            <th key={idx} className="p-3 pl-4 first:pl-4">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {item.data.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={item.columns.length} className="p-3 text-center text-[#6c757d] text-[13px] bg-gray-50 dark:bg-zinc-900">
                                                                No records found.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        item.data.map((row, rIdx) => (
                                                            <tr key={rIdx} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 dark:border-zinc-800">
                                                                {item.columns.map((col, cIdx) => {
                                                                    // Simple extraction mapping for rendering row values based on column name pattern match
                                                                    const keyMap: Record<string, string> = {
                                                                        "S.No": "sno",
                                                                        "Name": "name",
                                                                        "Company Name": "company",
                                                                        "Project": "project",
                                                                        "Date": "date",
                                                                        "Qa Date": "qaDate",
                                                                        "Vfy Date": "vfyDate",
                                                                        "Priority": "priority"
                                                                    };
                                                                    const rowKey = keyMap[col];
                                                                    const value = row[rowKey];
                                                                    // For 'SEO (1)', screenshot shows text is blue
                                                                    const isBlue = typeof value === 'string' && value.includes("(");
                                                                    
                                                                    return (
                                                                        <td key={cIdx} className={cn(
                                                                            "p-3 py-4 text-[13px] first:pl-4",
                                                                            isBlue ? "text-[#4f67c3] font-medium" : "text-[#495057] dark:text-slate-400"
                                                                        )}>
                                                                            {value}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
