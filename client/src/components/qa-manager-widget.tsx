import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
    Users, RefreshCw, Tag, Target, ChevronRight,
    Search as SearchIcon, CheckCircle2, LayoutDashboard, Database,
    UserPlus, Clock, Calendar, MessageSquare, AlertTriangle, X,
    FileText, Download, Briefcase, Send
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
 
 interface ProjectRow {
     no: number;
     company: string;
     tasker: string;
     project: string;
     status: string;
     statusTag?: string;
     time: string;
     id?: number;
 }

// ── helpers ────────────────────────────────────────────────────────────────────
function StatCard({ label, icon: Icon, value, colorClass = "bg-[#00a65a]" }: { label: string; icon: any; value: string | number; colorClass?: string }) {
    return (
        <div className="flex-1 p-4 bg-white rounded-lg border flex items-center justify-between gap-3 min-w-[200px] shadow-sm dark:bg-zinc-900">
            <div>
                <p className="text-[13px] text-gray-500 font-medium mb-1 dark:text-zinc-400">{label}</p>
                <p className="text-[24px] font-bold text-gray-800 dark:text-zinc-100">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center shrink-0`}>
                <Icon className="h-6 w-6 text-white" />
            </div>
        </div>
    );
}

function SideLink({ label, href }: { label: string; href: string }) {
    const [, setLocation] = useLocation();
    return (
        <button
            onClick={() => setLocation(href)}
            className="flex items-center justify-between w-full px-3 py-2.5 text-[12px] font-medium text-gray-700 bg-gray-50 rounded border hover:bg-white hover:shadow-sm transition-all group dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
        >
            <span>{label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-gray-600 transition-transform" />
        </button>
    );
}

const isTodayProject = (row: any) => {
    // 1. Check raw date if available
    const rawDate = row.raw?.qaReviewedAt || row.raw?.executiveSubmittedAt || row.raw?.updatedAt || row.raw?.createdAt;
    if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            const today = new Date();
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
        }
    }
    
    // 2. Check time string
    if (typeof row.time === "string") {
        const t = row.time.trim();
        if (t === "N/A") return false;
        
        // Check local yyyy-mm-dd
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const localTodayStr = `${yyyy}-${mm}-${dd}`;
        
        if (t === localTodayStr) {
            return true;
        }
        
        // If it contains a dash (and didn't match localTodayStr), it's a different date
        if (t.includes("-")) {
            return false;
        }
        
        // If it contains a month abbreviation, it's a past date
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (months.some(m => t.toLowerCase().includes(m.toLowerCase()))) {
            return false;
        }
        
        // If it contains a colon (time format like 10:57 AM), it represents today's time
        if (t.includes(":")) {
            return true;
        }
    }
    
    return false;
};

// ── Main Component ─────────────────────────────────────────────────────────────
export function QAManagerWidget() {
    const [, setLocation] = useLocation();
    const [projectTab, setProjectTab] = useState<"today" | "pending">("today");
    const [sellingPeriod, setSellingPeriod] = useState("LD");
    const [entriesCount, setEntriesCount] = useState("10");
    const [searchQuery, setSearchQuery] = useState("");
    const [hiddenProjectKeys, setHiddenProjectKeys] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('mock_qa_hidden_keys') || '[]');
        } catch {
            return [];
        }
    });
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [detailProject, setDetailProject] = useState<any>(null);
    const [isLinksDialogOpen, setIsLinksDialogOpen] = useState(false);
    const [linksProject, setLinksProject] = useState<any>(null);
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [statusValue, setStatusValue] = useState("");
    const [levelValue, setLevelValue] = useState("");
    const [remarksValue, setRemarksValue] = useState("");
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isLevelOpen, setIsLevelOpen] = useState(false);

    const openStatusDialog = (project: any) => {
        setSelectedProject(project);
        setIsStatusDialogOpen(true);
        setStatusValue("");
        setLevelValue("");
        setRemarksValue("");
    };

    const openDetailDialog = (project: any) => {
        setDetailProject(project);
        setIsDetailDialogOpen(true);
    };

    const openLinksDialog = (project: any) => {
        setLinksProject(project);
        setIsLinksDialogOpen(true);
    };

    const getProjectKey = (project: any) => {
        if (project?.id) return `id:${project.id}`;
        return `fallback:${project?.company || ""}|${project?.project || ""}|${project?.tasker || ""}`;
    };



    const hideProject = (project: any) => {
        const key = getProjectKey(project);
        setHiddenProjectKeys((current) => {
            if (current.includes(key)) return current;
            const newKeys = [...current, key];
            localStorage.setItem('mock_qa_hidden_keys', JSON.stringify(newKeys));
            return newKeys;
        });
    };

    // Queries (Reusing existing endpoints where possible for dynamic feel)
    const { data: pmsStats } = useQuery({
        queryKey: ["/api/pms/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/stats");
            return res.json();
        }
    });

    const { data: myTasksData } = useQuery({
        queryKey: ["/api/product-posting/qa/queue"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/product-posting/qa/queue");
            return res.json();
        }
    });

    const { data: projectsData } = useQuery({
        queryKey: ["/api/pms/projects", { withStats: "true" }],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/projects?withStats=true");
            return res.json();
        }
    });

    const qaReviewMutation = useMutation({
        mutationFn: async ({ taskId, action, remarks }: { taskId: string; action: "complete" | "return"; remarks?: string }) =>
            apiRequest("POST", `/api/product-posting/tasks/${taskId}/qa-review`, { action, remarks }),
        onSuccess: (_data, variables) => {
            if (selectedProject) {
                hideProject(selectedProject);
            }
            queryClient.invalidateQueries({ queryKey: ["/api/product-posting/qa/queue"] });
            queryClient.invalidateQueries({ queryKey: ["/api/product-posting/verification/queue"] });
            queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-executions"] });
            setIsStatusDialogOpen(false);
            setStatusValue("");
            setLevelValue("");
            setRemarksValue("");
            if (!variables?.taskId && selectedProject) {
                // Keep the fallback/mock rows responsive even when they do not have real task IDs.
                hideProject(selectedProject);
            }
        }
    });

    const queueRows = myTasksData?.data || [];

    const projectListData = queueRows.slice(0, 50).map((p: any, idx: number) => ({
        no: idx + 1,
        company: p.companyName || "N/A",
        tasker: p.assignee?.name || "Posting Executive",
        project: p.name || p.title,
        status: p.phaseLabel || p.status,
        statusTag: p.returnCount ? `rework ${p.returnCount}` : 'awaiting qa',
        time: p.executiveSubmittedAt ? new Date(p.executiveSubmittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
        id: p.taskId,
        raw: p,
    })).filter((p: any) => !hiddenProjectKeys.includes(getProjectKey(p))) || [];

    const changingProjectsData = queueRows.filter((p: any) => p.returnCount > 0).map((p: any, idx: number) => ({
        no: idx + 1,
        company: p.companyName || "N/A",
        tasker: p.assignee?.name || "Posting Executive",
        project: p.name || p.title,
        status: p.phaseLabel || p.status,
        time: p.updatedAt ? new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A",
        id: p.taskId,
        raw: p,
    })).filter((p: any) => !hiddenProjectKeys.includes(getProjectKey(p))) || [];

    const filteredChangingProjects = changingProjectsData
        .filter((p: any) =>
            p.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.tasker.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, parseInt(entriesCount));

    const [qaStorageProjects, setQaStorageProjects] = useState<any[]>([]);

    useEffect(() => {
        const fetchQaData = () => {
            try {
                const saved = JSON.parse(localStorage.getItem('qa-projects') || '[]');
                if (Array.isArray(saved) && saved.length > 0) {
                    setQaStorageProjects(saved.map((s: any, idx: number) => {
                        const rawLinks = s.links || (s.qaLinks ? s.qaLinks.split('\n').map((l: string) => l.trim()).filter(Boolean) : []);
                        return {
                            no: `New-${idx+1}`,
                            company: s.company,
                            tasker: s.name || "Admin User", 
                            project: s.project,
                            status: "Complete",
                            time: new Date().toISOString().split('T')[0],
                            links: rawLinks,
                            qaLinks: s.qaLinks,
                            raw: {
                                evidenceLinks: rawLinks.map((url: string) => ({ url, label: "Submitted Link" }))
                            }
                        };
                    }));
                } else {
                    setQaStorageProjects([]);
                }
            } catch(e) {
                setQaStorageProjects([]);
            }
        };
        fetchQaData();
        window.addEventListener('storage', fetchQaData);
        const interval = setInterval(fetchQaData, 1000);
        return () => {
            window.removeEventListener('storage', fetchQaData);
            clearInterval(interval);
        };
    }, []);

    const defaultPendingData = [
        { no: 1, company: "ATTRACTIVE FASHION", tasker: "Roshan Aslam", project: "Alibaba Minisite", status: "Complete", time: "2026-04-21" },
        { no: 2, company: "Test Leads New", tasker: "Muhammad Habib Ahmed", project: "Listing Page", status: "Complete", time: "2026-04-16" },
        { no: 3, company: "Khilan industries", tasker: "Ayesha Saleem", project: "Alibaba Product Posting", status: "Complete", time: "2026-04-21" },
        { no: 4, company: "BETA APPARELS", tasker: "Nirmal Ashknaz", project: "Alibaba Product Posting", status: "Complete", time: "2026-04-21" },
        { no: 5, company: "ERIT SPORTS", tasker: "Amina Tahir", project: "Alibaba Product Posting", status: "Complete", time: "2026-04-21" },
        { no: 6, company: "BHUTTA ENTERPRISES", tasker: "ESHA ARSHAD", project: "Alibaba Product Posting", status: "Complete", time: "2026-04-21" }
    ];

    const visibleDefaultPendingData = defaultPendingData.filter((row: any) => !hiddenProjectKeys.includes(getProjectKey(row)));

    const allProjectsMapped = [...qaStorageProjects, ...projectListData, ...visibleDefaultPendingData]
        .filter((row: any) => !hiddenProjectKeys.includes(getProjectKey(row)))
        .map((row: any) => ({
            ...row,
            time: row.time || format(new Date(), "yyyy-MM-dd")
        }));

    const todayProjects = allProjectsMapped
        .filter(isTodayProject)
        .map((row: any, idx: number) => ({ ...row, no: idx + 1 }));

    const pendingProjects = allProjectsMapped
        .filter((row: any) => !isTodayProject(row))
        .map((row: any, idx: number) => ({ ...row, no: idx + 1 }));

    const projectsToDisplay = projectTab === "today" ? todayProjects : pendingProjects;

    return (
        <div className="space-y-4 min-w-0">
            {/* Top Layout: Left 2fr, Right 1fr */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">

                {/* Left Column */}
                <div className="space-y-4">
                    {/* Top Selling */}
                    <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-[15px] font-bold text-gray-800 dark:text-zinc-100">Top Selling</h2>
                            <Select value={sellingPeriod} onValueChange={setSellingPeriod}>
                                <SelectTrigger className="w-16 h-7 text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LD">LD</SelectItem>
                                    <SelectItem value="TD">TD</SelectItem>
                                    <SelectItem value="WK">WK</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-4 flex-wrap">
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setProjectTab("today")}>
                                <StatCard label="Total Project" icon={Users} value={pmsStats?.projects?.total || "6030"} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setProjectTab("pending")}>
                                <StatCard label="Pending Reviews" icon={RefreshCw} value={queueRows.length || "0"} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLocation("/pms/status")}>
                                <StatCard label="Complete" icon={Tag} value={pmsStats?.projects?.completedProjects || "5102"} />
                            </div>
                            <div className="flex-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLocation("/pms/status")}>
                                <StatCard label="Changing" icon={Target} value="925" />
                            </div>
                        </div>
                    </div>

                    {/* Project List */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-zinc-900">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                            <div className="flex items-center gap-2">
                                <h2 className="text-[15px] font-bold text-gray-800 dark:text-zinc-100">Project List</h2>
                                <LayoutDashboard className="h-4 w-4 text-[#00a65a] dark:text-zinc-400" />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg dark:bg-zinc-900">
                                <button
                                    onClick={() => setProjectTab("today")}
                                    className={`px-6 py-1.5 text-[12px] font-bold rounded-md transition-all ${projectTab === "today" ? "bg-[#00a65a] text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 font-medium"}`}
                                >
                                    Today
                                </button>
                                <button
                                    onClick={() => setProjectTab("pending")}
                                    className={`px-6 py-1.5 text-[12px] font-bold rounded-md transition-all ${projectTab === "pending" ? "bg-[#00a65a] text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-700 font-medium"}`}
                                >
                                    Pending
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-[13px] border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-[#f8f9fa] border-b dark:bg-zinc-900">
                                        <th className="px-4 py-4 text-left font-bold text-gray-700 w-16 dark:text-zinc-400">No#</th>
                                        <th className="px-4 py-4 text-left font-bold text-gray-700 dark:text-zinc-400">Detail</th>
                                        <th className="px-4 py-4 text-left font-bold text-gray-700 dark:text-zinc-400">Status/Time</th>
                                        <th className="px-4 py-4 text-center font-bold text-gray-700 dark:text-zinc-400">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-zinc-900">
                                    {projectsToDisplay.length > 0 ? (
                                        projectsToDisplay.map((row: any) => (
                                            <tr key={row.no} className="border-b hover:bg-gray-50/50 transition-colors group">
                                                <td className="px-4 py-6 text-gray-500 align-middle dark:text-zinc-400">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox className="rounded shadow-none border-gray-300 data-[state=checked]:bg-[#00a65a] data-[state=checked]:border-[#00a65a] dark:border-zinc-800" />
                                                        <span className="font-medium">{row.no}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-6 align-middle">
                                                    <div className="space-y-1">
                                                        <div className="flex gap-1.5"><span className="font-black text-gray-800 dark:text-zinc-100">Company:</span> <span className="text-gray-500 font-bold uppercase dark:text-zinc-400">{row.company}</span></div>
                                                        <div className="flex gap-1.5"><span className="font-black text-gray-800 dark:text-zinc-100">Tasker:</span> <span className="text-gray-500 font-bold dark:text-zinc-400">{row.tasker}</span></div>
                                                        <div className="flex gap-1.5"><span className="font-black text-gray-800 dark:text-zinc-100">Project:</span> <span className="text-gray-500 font-bold dark:text-zinc-400">{row.project}</span></div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-6 align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-4 py-1 rounded-full text-[12px] font-bold bg-gray-100 text-gray-500 border border-gray-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                            {row.status || "Complete"}
                                                        </span>
                                                        <span className="text-gray-400">/</span>
                                                        <span className="text-gray-500 font-bold dark:text-zinc-400">{row.time || format(new Date(), "yyyy-MM-dd")}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-6 align-middle">
                                                    <div className="flex items-center justify-center gap-4">
                                                        <Database 
                                                            className="h-5 w-5 text-[#00a65a] cursor-pointer hover:scale-110 transition-transform dark:text-zinc-400" 
                                                            onClick={() => openDetailDialog(row)} 
                                                        />
                                                        <Tag 
                                                            className="h-5 w-5 text-[#00a65a] -rotate-45 cursor-pointer hover:scale-110 transition-transform dark:text-zinc-400" 
                                                            onClick={() => openLinksDialog(row)} 
                                                        />
                                                        <Send 
                                                            className="h-5 w-5 text-[#00a65a] cursor-pointer hover:scale-110 transition-transform dark:text-zinc-400" 
                                                            onClick={() => openStatusDialog(row)} 
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-10 text-center text-gray-400 italic font-medium">No projects found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Promotion Banners */}
                    <div className="bg-white rounded-lg border shadow-sm overflow-hidden dark:bg-zinc-900">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Promotion Banners</h2>
                        </div>
                        <div className="h-[140px] bg-gray-100 flex items-center justify-center relative group dark:bg-zinc-900">
                            <img
                                src="https://img.freepik.com/free-photo/group-businesswomen-working-office_23-2148908920.jpg"
                                alt="Promotion"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
                        </div>
                    </div>

                    {/* Projects Overview */}
                    <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                        <div className="px-4 py-3 border-b">
                            <h2 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Projects Overview</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-2">
                            <SideLink label="Check Duplication" href="/sales/duplicate-checker" />
                            <SideLink label="Add Customer" href="/sales/add-customer" />
                            <SideLink label="Temporary" href="/customer/temporary-contact" />
                            <SideLink label="Over Time" href="/hr/overtime" />
                            <SideLink label="Leave Application" href="/hr/leave-request" />
                            <SideLink label="Attendance" href="/hr/attendance" />
                            <SideLink label="Project List" href="/pms/tasks" />
                        </div>
                    </div>

                    {/* Important */}
                    <div className="bg-white rounded-lg border shadow-sm p-4 dark:bg-zinc-900">
                        <h2 className="text-[15px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important</h2>
                        <div className="space-y-2">
                            <button onClick={() => setLocation("/drm/delay-project")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Delay Projects</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">416</span>
                            </button>
                            <button onClick={() => setLocation("/drm/online-form")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Notice</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">0</span>
                            </button>
                            <button onClick={() => setLocation("/support/complaints")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Complaints</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">51(10200)</span>
                            </button>
                            <button onClick={() => setLocation("/training")} className="w-full flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Event</span>
                                <span className="text-gray-900 font-bold text-[13px] dark:text-zinc-100">99</span>
                            </button>
                            <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                                <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">Login Time</span>
                                <span className="text-[#00a65a] font-bold text-[13px] dark:text-zinc-400">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom: Changing Projects */}
            <div className="bg-white rounded-lg border shadow-sm dark:bg-zinc-900">
                <div className="flex items-center justify-between px-4 py-4 border-b">
                    <h2 className="text-[16px] font-bold text-gray-800 dark:text-zinc-100">Changing Projects</h2>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-zinc-300">
                            <span>Show</span>
                            <Select value={entriesCount} onValueChange={setEntriesCount}>
                                <SelectTrigger className="w-16 h-8 text-[12px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="25">25</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                            <span>entries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-gray-600 dark:text-zinc-300">Search:</span>
                            <div className="relative">
                                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search company, project..."
                                    className="h-8 w-48 pl-8 pr-3 text-[12px] border rounded-md focus:outline-none focus:ring-1 focus:ring-[#00a65a]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                            <thead>
                                <tr className="bg-gray-50 border-b dark:bg-zinc-900">
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x first:border-l-0 dark:text-zinc-300">No#</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Company</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Tasker</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Project</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Status</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Detail</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x dark:text-zinc-300">Time</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 border-x last:border-r-0 text-center dark:text-zinc-300">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredChangingProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                                            No matching records found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredChangingProjects.map((row: ProjectRow) => (
                                        <tr key={row.no} className="border-b hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800">
                                            <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">{row.no}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800 uppercase dark:text-zinc-100">{row.company}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.tasker}</td>
                                            <td className="px-4 py-3 text-gray-600 dark:text-zinc-300">{row.project}</td>
                                            <td className="px-4 py-3">
                                                <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900">
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Database className="h-4 w-4 text-[#00a65a] cursor-pointer dark:text-zinc-400" onClick={() => openDetailDialog(row)} />
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-medium dark:text-zinc-400">{row.time}</td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => openStatusDialog(row)}
                                                    className="text-[#00a65a] hover:bg-emerald-50 p-1 rounded-full transition-colors dark:text-zinc-400"
                                                >
                                                    <ChevronRight className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Project Status Dialog */}
                <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                    <DialogContent className="max-w-[550px] p-0 overflow-hidden border border-gray-100 shadow-xl bg-white rounded-lg dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogHeader className="px-6 py-5 flex flex-row items-center justify-between border-b border-gray-100 dark:border-zinc-800">
                            <DialogTitle className="text-[18px] font-semibold text-gray-600 dark:text-zinc-300">Project Status</DialogTitle>
                            {/* Radix UI typically adds its own close button, but if you need a custom one here, we disable default using CSS or just rely on default. Assuming default X works per shadcn standard. */}
                        </DialogHeader>

                        <div className="px-6 py-4 bg-white space-y-4 dark:bg-zinc-900">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Company</Label>
                                    <Input
                                        readOnly
                                        value={selectedProject?.company || "ATTRACTIVE FASHION"}
                                        className="bg-[#f0f2f5]/50 border-gray-200 text-gray-600 h-10 text-[13px] dark:text-zinc-300 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Project</Label>
                                    <Input
                                        readOnly
                                        value={selectedProject?.project || "Alibaba Minisite"}
                                        className="bg-[#f0f2f5]/50 border-gray-200 text-gray-600 h-10 text-[13px] dark:text-zinc-300 dark:border-zinc-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Status</Label>
                                    <Popover open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isStatusOpen}
                                                className="w-full justify-between h-10 border-gray-200 text-gray-500 font-normal px-3 bg-white text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                            >
                                                {statusValue || "Choose..."}
                                                <ChevronRight className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isStatusOpen ? "rotate-90" : ""}`} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-gray-100 dark:border-zinc-800" align="start">
                                            <Command className="rounded-lg">
                                                <div className="p-2 border-b bg-white dark:bg-zinc-900">
                                                    <CommandInput placeholder="" className="h-9 border border-gray-200 rounded px-2 text-[13px] bg-white outline-none dark:bg-zinc-900 dark:border-zinc-800" />
                                                </div>
                                                <CommandList>
                                                    <div className="px-3 py-2 text-[12px] font-bold text-gray-400">Person</div>
                                                    <CommandItem
                                                        value="Choose..."
                                                        onSelect={() => {
                                                            setStatusValue("Choose...");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className="px-3 py-2 text-[13px] text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                                    >
                                                        Choose...
                                                    </CommandItem>
                                                    <CommandItem
                                                        value="Complete"
                                                        onSelect={() => {
                                                            setStatusValue("Complete");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className={`px-3 py-2 text-[13px] cursor-pointer ${statusValue === "Complete" ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                    >
                                                        Complete
                                                    </CommandItem>
                                                    <CommandItem
                                                        value="Changing"
                                                        onSelect={() => {
                                                            setStatusValue("Changing");
                                                            setIsStatusOpen(false);
                                                        }}
                                                        className={`px-3 py-2 text-[13px] cursor-pointer ${statusValue === "Changing" ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                    >
                                                        Changing
                                                    </CommandItem>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Project Level</Label>
                                    <Popover open={isLevelOpen} onOpenChange={setIsLevelOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={isLevelOpen}
                                                className="w-full justify-between h-10 border-gray-200 text-gray-500 font-normal px-3 bg-white text-[13px] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                            >
                                                {levelValue || "Choose..."}
                                                <ChevronRight className={`ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform ${isLevelOpen ? "rotate-90" : ""}`} />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border-gray-100 dark:border-zinc-800" align="start">
                                            <Command className="rounded-lg">
                                                <div className="p-2 border-b bg-white dark:bg-zinc-900">
                                                    <CommandInput placeholder="" className="h-9 border border-gray-200 rounded px-2 text-[13px] bg-white outline-none dark:bg-zinc-900 dark:border-zinc-800" />
                                                </div>
                                                <CommandList className="max-h-[250px]">
                                                    <div className="px-3 py-2 text-[12px] font-bold text-gray-400">Person</div>
                                                    <CommandItem
                                                        value="Choose..."
                                                        onSelect={() => {
                                                            setLevelValue("Choose...");
                                                            setIsLevelOpen(false);
                                                        }}
                                                        className="px-3 py-2 text-[13px] text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                                    >
                                                        Choose...
                                                    </CommandItem>
                                                    {["Excellent", "Very Good", "Good", "Normal", "Very Poor"].map((lvl) => (
                                                        <CommandItem
                                                            key={lvl}
                                                            value={lvl}
                                                            onSelect={() => {
                                                                setLevelValue(lvl);
                                                                setIsLevelOpen(false);
                                                            }}
                                                            className={`px-3 py-2 text-[13px] cursor-pointer ${levelValue === lvl ? "bg-[#00a65a] text-white font-semibold" : "text-gray-600 dark:text-slate-300 hover:bg-emerald-50"}`}
                                                        >
                                                            {lvl}
                                                        </CommandItem>
                                                    ))}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Project</Label>
                                <Textarea
                                    value={remarksValue}
                                    onChange={(e) => setRemarksValue(e.target.value)}
                                    className="min-h-[100px] border-gray-200 focus:ring-[#00a65a] focus:border-[#00a65a] resize-none dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="bg-white px-6 py-4 flex justify-end gap-3 border-t border-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                            <Button
                                variant="secondary"
                                onClick={() => setIsStatusDialogOpen(false)}
                                className="bg-[#f0f2f5] hover:bg-gray-200 text-black px-6 font-medium shadow-none h-9 text-[14px] dark:bg-zinc-900"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    if (selectedProject?.id) {
                                        qaReviewMutation.mutate({
                                            taskId: selectedProject?.id,
                                            action: statusValue === "Changing" ? "return" : "complete",
                                            remarks: remarksValue,
                                        });
                                    } else {
                                        // Simulate a successful save for mock fallback data
                                        if (selectedProject) {
                                            hideProject(selectedProject);
                                            // Make it appear in Verification Manager for mock testing
                                            if (statusValue !== "Changing") {
                                                try {
                                                    const queue = JSON.parse(localStorage.getItem('mock_verification_queue') || '[]');
                                                    queue.push({
                                                        ...selectedProject,
                                                        status: "Verification Pending"
                                                    });
                                                    localStorage.setItem('mock_verification_queue', JSON.stringify(queue));
                                                    window.dispatchEvent(new Event('storage'));
                                                } catch(e) {}
                                            } else {
                                                // Send to D&D Manager & P&P Project Queue (Waiting tab)
                                                try {
                                                    const newItem = {
                                                        id: selectedProject.id || `mock-${Date.now()}`,
                                                        docId: `doc-${Date.now()}`,
                                                        company: selectedProject.company || selectedProject.companyName || "N/A",
                                                        project: selectedProject.project || selectedProject.name || "N/A",
                                                        status: "QA-CHANGES", 
                                                        time: new Date().toLocaleDateString('en-GB'),
                                                        isVerifiable: true
                                                    };
                                                
                                                    const waitingQueue = JSON.parse(localStorage.getItem('mock_dd_waiting_queue') || '[]');
                                                    waitingQueue.unshift(newItem);
                                                    localStorage.setItem('mock_dd_waiting_queue', JSON.stringify(waitingQueue));
                                                    
                                                    const ppWaitingQueue = JSON.parse(localStorage.getItem('mock_pp_waiting_queue') || '[]');
                                                    ppWaitingQueue.unshift(newItem);
                                                    localStorage.setItem('mock_pp_waiting_queue', JSON.stringify(ppWaitingQueue));
                                                    
                                                    window.dispatchEvent(new Event('storage'));
                                                } catch(e) {}
                                            }
                                        }
                                        setIsStatusDialogOpen(false);
                                        setStatusValue("");
                                        setLevelValue("");
                                        setRemarksValue("");
                                    }
                                }}
                                disabled={!selectedProject || !statusValue || qaReviewMutation.isPending}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-medium shadow-none h-9 text-[14px]"
                            >
                                {qaReviewMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Projects Overview Dialog */}
                <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                    <DialogContent className="max-w-[1100px] p-0 overflow-hidden border border-gray-100 shadow-2xl bg-[#eff2f6] rounded-md dark:border-zinc-800 dark:bg-zinc-900">
                        <DialogHeader className="bg-white px-8 py-5 flex flex-row items-center justify-between shadow-sm dark:bg-zinc-900">
                            <DialogTitle className="text-[15px] font-bold text-gray-600 uppercase tracking-wide dark:text-zinc-300">Projects Overview</DialogTitle>
                        </DialogHeader>

                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr,350px] gap-6">
                                {/* Left Side: Summary & Details */}
                                <div className="bg-white rounded-md shadow-sm p-8 max-h-[70vh] overflow-y-auto dark:bg-zinc-900">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Stylized Logo for Company */}
                                            <div className="w-14 h-14 bg-white rounded-md flex items-center justify-center dark:bg-zinc-900">
                                              <img src="https://images.crunchbase.com/image/upload/c_pad,h_256,w_256,f_auto,q_auto:eco,dpr_1/b3c7bd127fc1800de1a4" alt="logo" className="w-full h-full object-contain" />
                                            </div>
                                            <div>
                                                <h3 className="text-[17px] font-medium text-gray-800 uppercase tracking-wide dark:text-zinc-100">{detailProject?.company || "ATTRACTIVE FASHION"}</h3>
                                                <p className="text-[13px] text-gray-400 mt-1">{detailProject?.tasker || "Zohaib Nisar Ahmad"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 pt-1 border-l pl-4 border-gray-100 dark:border-zinc-800">
                                            <Calendar className="h-[18px] w-[18px] text-[#00a65a] mt-[1px] dark:text-zinc-400" />
                                            <div>
                                                <p className="text-[14px] font-bold text-gray-600 dark:text-zinc-300">Upload Date</p>
                                                <p className="text-[12px] text-gray-400 font-medium whitespace-nowrap mt-1">11 Feb 2026 11:37 AM</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-10">
                                        <h4 className="text-[16px] font-bold text-gray-700 dark:text-zinc-400">Project Details :</h4>
                                        <div className="grid gap-3.5 pl-1">
                                            <DetailRow label="Product_detail_add" value="9703" />
                                            <DetailRow label="Company" value={detailProject?.company || "ATTRACTIVE FASHION"} />
                                            <DetailRow label="Package" value="Verified Supplier" />
                                            <DetailRow label="Web_url" value="" />
                                            <DetailRow label="Phone" value="3400037616" />
                                            <DetailRow label="Mobile" value="3400037616" />
                                            <DetailRow label="Address" value="" />
                                            <DetailRow label="Referance_web" value="" />
                                            <DetailRow label="Categories" value="" />
                                            <DetailRow label="Detail" value="" />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Attached Files */}
                                <div className="bg-white rounded-md shadow-sm p-6 max-h-[200px] dark:bg-zinc-900">
                                    <h4 className="text-[14px] font-bold text-gray-700 mb-6 dark:text-zinc-400">
                                        Attached Files
                                    </h4>
                                    <div className="space-y-4">
                                        <div
                                            onClick={() => {
                                                const content = "Project Data for " + (detailProject?.company || "ATTRACTIVE FASHION");
                                                const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.setAttribute('download', 'Data.xlsx');
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="flex items-center justify-between p-3.5 bg-white rounded-md border shadow-sm group hover:border-[#00a65a] transition-all cursor-pointer dark:bg-zinc-900"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-semibold text-gray-800 dark:text-zinc-100">Data.xlsx</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">Size : 133 KB</p>
                                                </div>
                                            </div>
                                            <div className="text-gray-400 group-hover:text-[#00a65a] transition-colors pr-2">
                                                <Download className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Links Dialog */}
                <Dialog open={isLinksDialogOpen} onOpenChange={setIsLinksDialogOpen}>
                    <DialogContent className="max-w-[800px] p-0 overflow-hidden border border-gray-100 shadow-xl bg-white rounded-lg dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogHeader className="px-6 py-4 flex flex-row items-center justify-between border-b border-gray-100 dark:border-zinc-800">
                            <DialogTitle className="text-[20px] font-semibold text-[#545a6d] dark:text-zinc-400">Links</DialogTitle>
                        </DialogHeader>

                        <div className="p-8 max-h-[70vh] overflow-y-auto bg-white dark:bg-zinc-900">
                            <div className="space-y-4">
                                {(() => {
                                    const evidenceLinks = (() => {
                                        if (linksProject?.raw?.evidenceLinks && linksProject.raw.evidenceLinks.length > 0) {
                                            return linksProject.raw.evidenceLinks.map((link: any) => ({
                                                url: link.url,
                                                label: link.label || null
                                            }));
                                        }
                                        if (linksProject?.links && linksProject.links.length > 0) {
                                            return linksProject.links.map((url: string) => ({
                                                url,
                                                label: null
                                            }));
                                        }
                                        if (linksProject?.qaLinks) {
                                            const urlList = typeof linksProject.qaLinks === 'string'
                                                ? linksProject.qaLinks.split('\n').map((l: string) => l.trim()).filter(Boolean)
                                                : (Array.isArray(linksProject.qaLinks) ? linksProject.qaLinks : []);
                                            if (urlList.length > 0) {
                                                return urlList.map((url: string) => ({
                                                    url,
                                                    label: null
                                                }));
                                            }
                                        }
                                        return null;
                                    })();

                                    if (evidenceLinks && evidenceLinks.length > 0) {
                                        return evidenceLinks.map((link: any, idx: number) => (
                                            <div key={idx} className="flex items-start gap-1.5 text-[15px] font-medium leading-relaxed">
                                                <span className="text-gray-500 dark:text-zinc-400">{idx + 1}.</span>
                                                <div className="flex-1 min-w-0">
                                                    {link.label && (
                                                        <span className="text-gray-400 dark:text-zinc-500 mr-2 font-bold bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[12px] uppercase">
                                                            {link.label}
                                                        </span>
                                                    )}
                                                    <a
                                                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[#00a65a] hover:underline break-all dark:text-zinc-400 font-semibold"
                                                    >
                                                        {link.url}
                                                    </a>
                                                </div>
                                            </div>
                                        ));
                                    } else {
                                        return (
                                            <div className="py-6 text-center text-gray-400 dark:text-zinc-500 italic">
                                                No evidence links have been submitted for this task yet.
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-3 text-[14px]">
            <span className="font-bold text-gray-600 min-w-[150px] dark:text-zinc-300">{label}</span>
            <span className="text-gray-400">&gt;</span>
            <span className="text-gray-700 font-medium dark:text-zinc-400">{value}</span>
        </div>
    );
}
