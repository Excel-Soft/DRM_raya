import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ChevronRight,
    CheckCircle2,
    TrendingUp,
    RefreshCw,
    ShieldCheck,
    MoreHorizontal,
    Calendar,
    List,
    Clock,
    ArrowRight,
    FileText,
    Users,
    CheckSquare,
    Moon,
    Play,
    Settings,
    ClipboardList,
    BarChart3,
    Briefcase,
    Award,
    DollarSign,
    AlertCircle,
    Target,
    Building2,
    Package,
} from "lucide-react";
import { ProductPostingExecutiveWidget } from "@/components/product-posting-executive-widget";
import { ProductPostingManagerWidget } from "@/components/product-posting-manager-widget";

// ── Types ───────────────────────────────────────────────────────────────────

type Project = {
    id: string;
    name: string;
    description?: string;
    status: "Active" | "OnHold" | "Completed";
    workSpace?: string;
    companyName?: string;
    startDate?: string;
    endDate?: string;
    taskStats: {
        total: number;
        toDo: number;
        inProgress: number;
        blocked: number;
        completed: number;
    };
};

type ActivityRow = {
    userId: string;
    name: string;
    methods: {
        [key: string]: { done: number; target: number };
    };
    totals: {
        activities: number;
        timeMinutes: number;
    };
};

// ── Types ──
type TabType = "waiting" | "delay" | "approved";

// Keep items that are just links
const projectOverviewLinks: Record<string, Array<{ label: string; icon: any; href: string; highlight?: boolean }>> = {
    General: [
        { label: "Pms Setting", icon: Settings, href: "/drm/pms-setting" },
        { label: "Running Project", icon: Play, href: "/pms/running-projects" },
        { label: "Project Task", icon: ClipboardList, href: "/pms/tasks" },
        { label: "Project Report", icon: FileText, href: "/reports" },
    ],
    Program: [
        { label: "Task Create", icon: CheckSquare, href: "/pms/tasks" },
        { label: "Pending Project", icon: Users, href: "/pms/approvals" },
        { label: "Team Reports", icon: BarChart3, href: "/pms/team-workspace" },
        { label: "Dep Projects", icon: Building2, href: "/pms/status" },
    ],
    "Project Management": [
        { label: "Project Task", icon: ClipboardList, href: "/pms/tasks" },
        { label: "Project Report", icon: Clock, href: "/reports" },
    ],
    Performance: [
        { label: "Loan Application", icon: Briefcase, href: "/hr/loan" },
        { label: "Performance", icon: Award, href: "/sales/targets" },
    ],
    "Performance ": [
        { label: "Over Time", icon: Clock, href: "/hr/overtime" },
        { label: "Loan Application", icon: Briefcase, href: "/hr/loan" },
        { label: "Increment", icon: Award, href: "/hr/overtime" },
        { label: "Project List", icon: ClipboardList, href: "/pms/running-projects" },
        { label: "Commission Verification", icon: DollarSign, href: "/account/gm-entries" },
    ],
    Other: [
        { label: "Project List", icon: ClipboardList, href: "/pms/running-projects" },
        { label: "Add Penalty", icon: AlertCircle, href: "/hr/attendance" },
        { label: "Commission Verification", icon: DollarSign, href: "/account/gm-entries" },
        { label: "Overall Report", icon: FileText, href: "/reports" },
        { label: "Complete Project D&D P&P", icon: Briefcase, href: "/pms/task-history" },
    ],
    "General Services": [
        { label: "Customer", icon: Users, href: "/sales/customers" },
        { label: "Attendance", icon: Clock, href: "/hr/attendance" },
        { label: "Lead", icon: Target, href: "/sales/lead-pools" },
        { label: "Training", icon: Award, href: "/training" },
    ],
};



// Donut chart SVG component
// Donut chart SVG component
function DonutChart({ stats }: { stats?: any }) {
    const total = stats?.totalProjects || 0;
    const complete = stats?.completedProjects || 0;
    const pending = stats?.activeProjects || 0;
    const free = stats?.onHoldProjects || 0;
    // Calculate percentages for the donut
    const sum = total + complete + pending + free || 1; // Avoid division by zero

    const radius = 55;
    const cx = 75;
    const cy = 75;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;

    const segments = [
        { percent: (total / sum) * 100 || 0, color: "#1a7a4a" },    // Total Project (Green)
        { percent: (complete / sum) * 100 || 0, color: "#d4a843" }, // Complete (Yellow)
        { percent: (pending / sum) * 100 || 0, color: "#8bc9a3" },  // Pending (Light Green)
        { percent: (free / sum) * 100 || 0, color: "#4a4a4a" },     // Free (Gray)
    ];

    let offset = 0;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", width: "150px", height: "150px" }}>
                <svg width="150" height="150" viewBox="0 0 150 150">
                    {segments.map((seg, i) => {
                        const dashArray = `${(seg.percent / 100) * circumference} ${circumference}`;
                        const dashOffset = -(offset / 100) * circumference;
                        offset += seg.percent;
                        return (
                            <circle
                                key={i}
                                cx={cx}
                                cy={cy}
                                r={radius}
                                fill="none"
                                stroke={seg.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={dashArray}
                                strokeDashoffset={dashOffset}
                                transform={`rotate(-90 ${cx} ${cy})`}
                                style={{ transition: "stroke-dasharray 0.5s ease" }}
                            />
                        );
                    })}
                </svg>
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    textAlign: "center",
                }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "#333" }}>{total.toLocaleString()}</div>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1a7a4a", display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "#333", minWidth: "75px" }}>Total Project</span>
                    <span style={{ fontWeight: 700, color: "#333" }}>{total.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d4a843", display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "#333", minWidth: "75px" }}>Complete</span>
                    <span style={{ fontWeight: 700, color: "#333" }}>{complete.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8bc9a3", display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "#333", minWidth: "75px" }}>Pending</span>
                    <span style={{ fontWeight: 700, color: "#333" }}>{pending.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4a4a4a", display: "inline-block" }} />
                    <span style={{ fontWeight: 600, color: "#333", minWidth: "75px" }}>Free</span>
                    <span style={{ fontWeight: 700, color: "#333" }}>{free.toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 text-[14px]">
            <span className="font-bold text-gray-600 min-w-[160px] dark:text-zinc-300">{label}</span>
            <span className="text-gray-400 font-bold">&gt;</span>
            <span className="text-gray-700 font-semibold dark:text-zinc-400">{value || ""}</span>
        </div>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProductPostingDashboard() {
    const { toast } = useToast();
    const [location] = useLocation();
    const forcedExecutive = location.includes("/product-posting/executive");
    const forcedManager = location.includes("/product-posting/manager");
    const userRoleName = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");

    const isExecutiveView = forcedExecutive || (
        (userRoleName === "product_posting_executive" || userRoleName === "posting_executive") && 
        !forcedManager
    );

    const [storageSync, setStorageSync] = useState(0);

    useEffect(() => {
        const handleStorageChange = () => setStorageSync(prev => prev + 1);
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const [activeTab, setActiveTab] = useState<TabType>("waiting");
    const [activityPeriod, setActivityPeriod] = useState(() => sessionStorage.getItem('globalTimePeriod') || "TD");
    const [dailyReportPeriod, setDailyReportPeriod] = useState("today");
    const [dailyReportPage, setDailyReportPage] = useState(1);

    useEffect(() => {
        const handlePeriodChange = (e: any) => setActivityPeriod(e.detail);
        window.addEventListener('globalTimePeriodChange', handlePeriodChange);
        return () => window.removeEventListener('globalTimePeriodChange', handlePeriodChange);
    }, []);

    const [selectedProjectForMove, setSelectedProjectForMove] = useState<any>(null);

    const globalPeriod = sessionStorage.getItem("globalPeriod") || "TD";

    useEffect(() => {
        if (globalPeriod === "TD") {
            setActivityPeriod("TD");
            setDailyReportPeriod("today");
        } else if (globalPeriod === "WC") {
            setActivityPeriod("WC");
            setDailyReportPeriod("weekly");
        } else if (globalPeriod === "MN") {
            setActivityPeriod("MONTH");
            setDailyReportPeriod("weekly");
        } else if (globalPeriod === "QT") {
            setActivityPeriod("MONTH");
            setDailyReportPeriod("weekly");
        } else if (globalPeriod === "YR") {
            setActivityPeriod("MONTH");
            setDailyReportPeriod("weekly");
        }
    }, [globalPeriod]);

    const [taskDetails, setTaskDetails] = useState({
        assigneeId: "",
        title: "",
        duration: "0",
        links: "",
        dueDate: "",
        detail: ""
    });
    const [verifyDocModalOpen, setVerifyDocModalOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [moveTaskModalOpen, setMoveTaskModalOpen] = useState(false);
    const [dataVerificationModalOpen, setDataVerificationModalOpen] = useState(false);
    const [confirmSaveModalOpen, setConfirmSaveModalOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "task" | null>(null);
    const [verificationDetails, setVerificationDetails] = useState({ image: "", detail: "" });

    // ── Queries ──

    // 1. PMS Stats for KPI cards and donut chart
    const { data: pmsStats } = useQuery({
        queryKey: ["/api/pms/stats", globalPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/pms/stats?period=${globalPeriod}`);
            return res.json();
        }
    });

    // 2. Projects for the status table
    const { data: projects = [] } = useQuery<Project[]>({
        queryKey: ["/api/pms/projects?withStats=true"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/projects?withStats=true");
            return res.json();
        }
    });

    // 3. Dashboard Activities
    const { data: activitiesData } = useQuery({
        queryKey: ["/api/dashboard/activities", activityPeriod],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/dashboard/activities?period=${activityPeriod}`);
            return res.json();
        }
    });

    // 4. Sales Targets for KwA
    const { data: targetsData } = useQuery({
        queryKey: ["/api/sales/targets/ab"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/targets/ab");
            return res.json();
        }
    });

    // 5. HOD Daily Report
    const { data: hodDailyReport } = useQuery({
        queryKey: ["/api/hod/daily-report", dailyReportPeriod],
        enabled: !isExecutiveView,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/daily-report?period=${dailyReportPeriod}`);
            return res.json();
        }
    });

    // ── Helper ──
    const renderLinkSection = (sliceStart: number, sliceEnd?: number) => {
        return Object.entries(projectOverviewLinks).slice(sliceStart, sliceEnd).map(([category, links]) => (
            <div key={category}>
                <p style={{ fontSize: "12px", fontWeight: 600 }} className="text-muted-foreground mb-1 mt-2 pb-1">
                    {category.trim()}
                </p>
                {links.map((link, idx) => {
                    const isActive = location === link.href;
                    return (
                        <a
                            key={idx}
                            href={link.href}
                            className={cn(
                                "flex items-center justify-between py-1.5 px-2 rounded transition-all duration-200 group",
                                isActive 
                                    ? "bg-emerald-50 border border-emerald-100 shadow-sm" 
                                    : "hover:bg-slate-50 dark:bg-zinc-900 border border-transparent"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <link.icon className={cn(
                                    "w-3.5 h-3.5 transition-colors",
                                    isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-300"
                                )} />
                                <span className={cn(
                                    "text-[12px] transition-colors",
                                    isActive ? "text-emerald-700 font-bold" : "text-slate-600 dark:text-slate-300 font-medium"
                                )}>
                                    {link.label}
                                </span>
                            </div>
                            <ChevronRight className={cn(
                                "w-3 h-3 transition-transform",
                                isActive ? "text-emerald-500 translate-x-0.5" : "text-slate-300"
                            )} />
                        </a>
                    );
                })}
            </div>
        ));
    };
    // 6. HOD Important Stats
    const { data: hodImportantStats } = useQuery({
        queryKey: ["/api/hod/dashboard/important-stats"],
        enabled: !isExecutiveView,
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/dashboard/important-stats");
            return res.json();
        }
    });

    // 7. Current User for profile info
    const { data: userData } = useQuery({
        queryKey: ["/api/auth/me"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/auth/me");
            return res.json();
        }
    });

    // 8. Pending Documents
    const { data: pendingDocsData, refetch: refetchPendingDocs } = useQuery({
        queryKey: ["/api/projects/documents/pending"],
        enabled: !isExecutiveView,
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/projects/documents/pending");
            return res.json();
        }
    });

    const { data: detailsResponse } = useQuery({
        queryKey: ["project-details", selectedDoc?.projectId],
        enabled: !!selectedDoc?.projectId,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/projects/${selectedDoc.projectId}/details`);
            return res.json();
        }
    });
    const projectDetails = detailsResponse?.data;

    const { data: managerQueueData, refetch: refetchManagerQueue } = useQuery({
        queryKey: ["/api/product-posting/manager/queue", activityPeriod],
        enabled: !isExecutiveView,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/product-posting/manager/queue?period=${activityPeriod}`);
            return res.json();
        }
    });

    const verifyDocMutation = useMutation({
        mutationFn: async ({ id, action, reason }: { id: string, action: string, reason?: string }) => {
            await apiRequestJson("PUT", `/api/projects/documents/${id}/verify`, { action, reason });
        },
        onSuccess: () => {
            refetchPendingDocs();
            refetchManagerQueue();
            queryClient.invalidateQueries({ queryKey: ["/api/pms/projects?withStats=true"] });
            setVerifyDocModalOpen(false);
            setDataVerificationModalOpen(false);
            setVerificationDetails({ image: "", detail: "" });
            toast({
                title: "Success",
                description: "Document verified successfully.",
                className: "bg-emerald-50 border-emerald-200 text-emerald-800"
            });
        },
        onError: (error: any) => {
            console.error("Verification error:", error);
            toast({
                title: "Verification Failed",
                description: error.message || "Could not verify document. Please try again.",
                variant: "destructive"
            });
        }
    });

    // 9. All Users List for Assignment
    const { data: usersData, error: usersError, isLoading: isLoadingUsers } = useQuery({
        queryKey: ["/api/users"],
        enabled: !isExecutiveView,
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            if (!res.ok) throw new Error(`Failed to fetch users: ${await res.text()}`);
            return res.json();
        },
        retry: 2
    });

    const createTaskMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", `/api/product-posting/projects/${data.projectId}/assign-task`, data);
        },
        onSuccess: () => {
            refetchManagerQueue();
            queryClient.invalidateQueries({ queryKey: ["/api/pms/projects?withStats=true"] });
            setMoveTaskModalOpen(false);
            setTaskDetails({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });
            toast({
                title: "Task Assigned",
                description: "The task has been successfully assigned to the executive.",
                variant: "default",
            });
        }
    });

    const managerCompleteMutation = useMutation({
        mutationFn: async ({ taskId }: { taskId: string }) => {
            await apiRequest("POST", `/api/product-posting/tasks/${taskId}/manager-complete`, {});
        },
        onSuccess: () => {
            refetchManagerQueue();
            alert("Task moved to QA review.");
        }
    });

    // ── Mappings ──

    const dynamicStatCards = useMemo(() => {
        const stats = pmsStats?.tasks || { total: 0, inProgress: 0, completed: 0, overdue: 0 };
        const projectCount = pmsStats?.projects?.total || 0;

        return [
            {
                label: "Total Projects",
                value: projectCount.toLocaleString(),
                subValue: (pmsStats?.projects?.active || 0).toString(),
                trend: "+0%", // Trend logic not available in simple stats
                trendUp: true,
                icon: "📊",
                color: "#1a7a4a",
            },
            {
                label: "Verification",
                value: (pmsStats?.tasks?.blocked || 0).toString(),
                subValue: (pmsStats?.tasks?.blocked || 0).toString(),
                trend: "0%",
                trendUp: true,
                icon: "🔄",
                color: "#d4a843",
            },
            {
                label: "Tasks",
                value: stats.total.toLocaleString(),
                subValue: stats.total.toString(),
                trend: "0%",
                trendUp: true,
                icon: "📋",
                color: "#1a7a4a",
            },
            {
                label: "Free",
                value: (pmsStats?.tasks?.toDo || 0).toString(),
                subValue: "c0",
                trend: "0%",
                trendUp: true,
                icon: "📍",
                color: "#4a4a4a",
            },
        ];
    }, [pmsStats]);

    const dynamicTableData = useMemo(() => {
        let queueItems = managerQueueData?.data || [];
        const userRole = (userData as any)?.activeRoleId || (userData as any)?.role;
        const isAdmin = userRole === "admin";

        // Filter queue items based on manager role
        // NOTE: Server-side already filters by invoiceProjectName per role.
        // Client-side only applies extra filters for dd_manager if needed.
        if (!isAdmin) {
            const isDDManager = userRole === "dd_manager" || userRole === "d_d_manager";
            const isQAManager = userRole === "qa_manager";

            if (isDDManager) {
                // D&D Manager sees Minisite AND Listing Page projects
                // Server already filters, but also check invoiceProjectName on client for safety
                queueItems = queueItems.filter((item: any) => {
                    const invName = (item.invoiceProjectName || "").toLowerCase();
                    const name = (item.project?.name || "").toLowerCase();
                    // If no invoice linked, hide from DD manager (their items should have invoices)
                    if (!invName) return false;
                    return invName.includes("minisite") || invName.includes("mini site") ||
                           invName.includes("listing") ||
                           name.includes("minisite") || name.includes("listing");
                });
            } else if (isQAManager) {
                queueItems = queueItems.filter((_item: any) => {
                    return false;
                });
            }
            // product_posting_manager: server already filtered, show all returned items
        }




        let waiting = queueItems
            .filter((item: any) => !["RETURNED_FOR_CHANGE", "VERIFICATION_COMPLETE", "PROJECT_OVERVIEW", "QA_REVIEW"].includes(item.currentPhase))
            .map((item: any, i: number) => ({
                no: `${i + 1}/${item.project.id.slice(0, 4)}`,
                company: item.project.companyName || "N/A",
                project: item.project.name,
                status: (!item.documents || item.documents.length === 0 || !item.documents.some((d: any) => d.documentUrl)) ? "Documents Pending" : item.phaseLabel,
                doc: item.documents?.length > 0 ? item.documents[0] : null,
                id: item.project.id,
                taskId: item.taskId,
                canAssign: ["PROJECT_OVERVIEW", "TASK_ASSIGNMENT", "RETURNED_FOR_CHANGE"].includes(item.currentPhase),
                canComplete: item.currentPhase === "RUNNING_PROJECT" && !!item.executiveSubmittedAt,
                time: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A",
            }));

        let delay = queueItems
            .filter((item: any) => item.currentPhase === "RETURNED_FOR_CHANGE" || item.overtimeExceededBy > 0)
            .map((item: any, i: number) => ({
                no: `${i + 1}/${item.project.id.slice(0, 4)}`,
                company: item.project.companyName || "N/A",
                project: item.project.name,
                status: item.overtimeExceededBy > 0 ? `Overtime +${item.overtimeExceededBy}m` : ((!item.documents || item.documents.length === 0 || !item.documents.some((d: any) => d.documentUrl)) ? "Documents Pending" : item.phaseLabel),
                id: item.project.id,
                taskId: item.taskId,
                canAssign: item.currentPhase === "RETURNED_FOR_CHANGE",
                canComplete: false,
                time: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A",
            }));

        let approved = queueItems
            .filter((item: any) => ["VERIFICATION_COMPLETE", "PROJECT_OVERVIEW", "QA_REVIEW"].includes(item.currentPhase))
            .map((item: any, i: number) => ({
                no: `${i + 1}/${item.project.id.slice(0, 4)}`,
                company: item.project.companyName || "N/A",
                project: item.project.name,
                status: (!item.documents || item.documents.length === 0 || !item.documents.some((d: any) => d.documentUrl)) ? "Documents Pending" : item.phaseLabel,
                id: item.project.id,
                taskId: item.taskId,
                canAssign: ["PROJECT_OVERVIEW", "VERIFICATION_COMPLETE", "QA_REVIEW"].includes(item.currentPhase),
                canComplete: false,
                time: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "N/A",
            }));
            
        // Deduplicate approved by Project Name and Company to handle accidentally repeated entries
        const seen = new Set();
        approved = approved.filter((item: any) => {
            const key = `${item.company}-${item.project}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return { waiting, delay, approved };
    }, [managerQueueData, storageSync]);

    const dynamicDailyActivities = useMemo(() => {
        if (!activitiesData?.success || !activitiesData.data?.rows) return [];

        return activitiesData.data.rows.flatMap((user: ActivityRow) => {
            return Object.entries(user.methods).filter(([_, val]) => val.done > 0).map(([method, val]) => {
                const percent = val.target > 0 ? Math.round((val.done / val.target) * 100) : 0;
                return {
                    name: user.name,
                    method: method.charAt(0).toUpperCase() + method.slice(1),
                    methodColor: method === "mobile" ? "copy" : "new", // Simplified color mapping
                    target: `${val.target} (${val.done}) ${percent}%`,
                    timeVal: user.totals.timeMinutes,
                    time: user.totals.timeMinutes.toLocaleString(),
                };
            });
        });
    }, [activitiesData]);

    const donutChartStats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        let startPeriod: Date;
        if (activityPeriod === "TD") {
            startPeriod = startOfDay;
        } else if (activityPeriod === "WC") {
            const day = startOfDay.getDay();
            const diff = (day === 0 ? -6 : 1) - day;
            const monday = new Date(startOfDay);
            monday.setDate(startOfDay.getDate() + diff);
            startPeriod = monday;
        } else { // MONTH
            startPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const filteredProjects = projects.filter((p: any) => {
            const dateToCheck = p.updatedAt ? new Date(p.updatedAt) : (p.createdAt ? new Date(p.createdAt) : null);
            return dateToCheck ? dateToCheck >= startPeriod : true;
        });

        const total = filteredProjects.length;
        const complete = filteredProjects.filter((p: any) => p.status === "Completed").length;
        const pending = filteredProjects.filter((p: any) => p.status === "Active").length;
        const free = filteredProjects.filter((p: any) => p.status === "OnHold").length;

        return {
            totalProjects: total,
            completedProjects: complete,
            activeProjects: pending,
            onHoldProjects: free
        };
    }, [projects, activityPeriod]);

    const dynamicImportantStats = useMemo(() => {
        const h = hodImportantStats?.data || {};
        const target = targetsData?.rows?.[0] || {};

        return [
            { label: "Upcoming", value: (h.upcoming || 0).toString(), icon: Calendar, color: "#3b82f6", href: "/pms/approvals" },
            { label: "In Progress", value: (h.inProgress || 0).toString(), icon: Play, color: "#f59e0b", href: "/pms/running-projects" },
            { label: "Completed", value: (h.completed || 0).toString(), icon: CheckCircle2, color: "#10b981", href: "/pms/status" },
            { label: "Delay Projects", value: (h.delayProjects || 0).toString(), icon: AlertCircle, color: "#ef4444", href: "/pms/status" },
            { label: "K Kwa", value: target.kwa || "0", icon: TrendingUp, color: "#64748b", href: "/sales/targets" },
            { label: "Target", value: target.priceTarget || "$0", icon: Target, color: "#6366f1", href: "/sales/targets" },
            { label: "Leave Application", value: (h.leaveApplication || 0).toString(), icon: Users, color: "#a855f7", href: "/hr/leave" },
        ];
    }, [hodImportantStats, targetsData]);

    const dynamicDailyReportRows = useMemo(() => {
        if (!hodDailyReport?.success || !hodDailyReport.data) return [];
        return hodDailyReport.data.map((row: any) => ({
            company: row.company,
            project: row.project,
            status: row.status,
            statusColor: row.status === "Approved" ? "green" : (row.status === "Rejected" ? "red" : "yellow"),
            freeTime: `${row.free} hrs`,
            freeTimeSub: "",
            totalSpent: row.spent,
            projectId: row.projectId,
            id: row.projectId || ""
        }));
    }, [hodDailyReport]);

    const currentTableRows = dynamicTableData[activeTab];

    const dotColor = (c: string) => {
        switch (c) {
            case "green": return "#00a65a";
            case "orange": return "#f0a500";
            case "blue": return "#3b82f6";
            case "purple": return "#8b5cf6";
            case "red": return "#ef4444";
            case "yellow": return "#eab308";
            default: return "#999";
        }
    };

    return (
        <div className="flex-1 overflow-x-hidden overflow-y-auto" style={{ fontSize: "12px" }}>
            {/* Modals handled at the top of the component for better DOM positioning */}
            <Dialog open={moveTaskModalOpen} onOpenChange={setMoveTaskModalOpen}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/30">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-[20px] font-bold text-gray-700 dark:text-zinc-400">Create New Task</DialogTitle>
                            <span className="text-[14px] font-bold text-emerald-500">
                                {(() => {
                                    const now = new Date();
                                    const day = String(now.getDate()).padStart(2, '0');
                                    const month = String(now.getMonth() + 1).padStart(2, '0');
                                    const year = now.getFullYear();
                                    let hours = now.getHours();
                                    const minutes = String(now.getMinutes()).padStart(2, '0');
                                    const ampm = hours >= 12 ? 'AM' : 'PM';
                                    hours = hours % 12;
                                    hours = hours ? hours : 12;
                                    const strHours = String(hours).padStart(2, '0');
                                    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
                                })()}
                            </span>
                        </div>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Company</label>
                                <Input
                                    readOnly
                                    value={selectedProjectForMove?.company || ""}
                                    className="bg-slate-50 border-gray-200 text-gray-600 h-10 text-[13px] pointer-events-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Project</label>
                                <Input
                                    readOnly
                                    value={selectedProjectForMove?.project || ""}
                                    className="bg-slate-50 border-gray-200 text-gray-600 h-10 text-[13px] pointer-events-none dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Person</label>
                                <Select 
                                    value={taskDetails.assigneeId} 
                                    onValueChange={(v) => setTaskDetails(prev => ({ ...prev, assigneeId: v }))}
                                >
                                    <SelectTrigger className="h-10 border-gray-200 text-[13px] text-gray-700 dark:border-zinc-800 dark:text-zinc-400">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isLoadingUsers ? (
                                            <div className="p-2 text-center text-gray-400 text-[12px]">Loading users...</div>
                                        ) : usersError ? (
                                            <div className="p-2 text-center text-rose-500 text-[12px]">Error: {(usersError as any).message}</div>
                                        ) : usersData?.users ? (
                                            usersData.users
                                            .filter((u: any) => {
                                                const uRole = (u.role || "").toLowerCase();
                                                const rs = (u.roles || []).map((r: any) => String(r).toLowerCase());
                                                
                                                return uRole === "posting_executive" || 
                                                       uRole === "product_posting_executive" ||
                                                       rs.includes("posting_executive") || 
                                                       rs.includes("product_posting_executive");
                                            })
                                            .map((user: any) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.fullName || user.username}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <div className="p-2 text-center text-gray-400 text-[12px]">No data</div>
                                        )}
                                        {usersData?.users && usersData.users.length > 0 && usersData.users.filter((u: any) => {
                                            const r = (u.role || "").toLowerCase();
                                            const uName = (u.fullName || u.username || "").toLowerCase();
                                            const rs = (u.roles || []).map((role: any) => String(role).toLowerCase());
                                            return uName.includes("nouman") || r.includes("posting") || r.includes("executive") || r.includes("dd") || rs.some((role: string) => role.includes("posting") || role.includes("executive"));
                                        }).length === 0 && (
                                            <SelectItem value="none" disabled>No executives found</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Task</label>
                                        <Select 
                                            value={taskDetails.title} 
                                            onValueChange={(v) => {
                                                const defaultTimes: Record<string, string> = {
                                                    "Post Products": "60",
                                                    "Update Images": "30",
                                                    "Keywords Optimization": "45",
                                                    "Minisite Update": "90"
                                                };
                                                setTaskDetails(prev => ({ 
                                                    ...prev, 
                                                    title: v,
                                                    duration: defaultTimes[v] || "0" 
                                                }));
                                            }}
                                        >
                                            <SelectTrigger className="h-10 border-gray-200 text-[13px] text-gray-700 dark:border-zinc-800 dark:text-zinc-400">
                                                <SelectValue placeholder="Choose..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedProjectForMove?.project && !["Post Products", "Update Images", "Keywords Optimization", "Minisite Update"].includes(selectedProjectForMove.project) && (
                                                    <SelectItem value={selectedProjectForMove.project}>
                                                        {selectedProjectForMove.project}
                                                    </SelectItem>
                                                )}
                                                <SelectItem value="Post Products">Post Products</SelectItem>
                                                <SelectItem value="Update Images">Update Images</SelectItem>
                                                <SelectItem value="Keywords Optimization">Keywords Optimization</SelectItem>
                                                <SelectItem value="Minisite Update">Minisite Update</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Task Time (m)</label>
                                <Input
                                    type="number"
                                    value={taskDetails.duration}
                                    onChange={(e) => setTaskDetails(prev => ({ ...prev, duration: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Links</label>
                                <Input
                                    placeholder="Working Links"
                                    value={taskDetails.links}
                                    onChange={(e) => setTaskDetails(prev => ({ ...prev, links: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Next Day</label>
                                <Input
                                    type="datetime-local"
                                    onClick={(e) => (e.target as any).showPicker?.()}
                                    onFocus={(e) => (e.target as any).showPicker?.()}
                                    value={taskDetails.dueDate}
                                    onChange={(e) => setTaskDetails(prev => ({ ...prev, dueDate: e.target.value }))}
                                    className="border-gray-200 h-10 text-[13px] cursor-pointer dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[13px] font-bold text-gray-600 dark:text-zinc-300">Detail</label>
                            <textarea
                                className="w-full border border-gray-200 rounded-md p-3 text-[13px] min-h-[100px] outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800"
                                placeholder="Add detail"
                                value={taskDetails.detail}
                                onChange={(e) => setTaskDetails(prev => ({ ...prev, detail: e.target.value }))}
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-50 dark:border-zinc-800">
                            <Button
                                variant="ghost"
                                className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-900 font-bold h-11 px-8 rounded-lg text-[14px] dark:bg-zinc-900 dark:text-zinc-100"
                                onClick={() => setMoveTaskModalOpen(false)}
                            >
                                Close
                            </Button>
                            <Button
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-8 rounded-lg shadow-lg active:scale-95 text-[14px]"
                                onClick={() => {
                                    if (!taskDetails.assigneeId || !taskDetails.title) {
                                        alert("Please select a person and a task type.");
                                        return;
                                    }
                                    setConfirmAction("task");
                                    setConfirmSaveModalOpen(true);
                                    setMoveTaskModalOpen(false);
                                }}
                                disabled={createTaskMutation.isPending}
                            >
                                {createTaskMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unified Comprehensive Verification Modal */}
            <Dialog open={verifyDocModalOpen} onOpenChange={setVerifyDocModalOpen}>
                <DialogContent className="max-w-[1100px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/30">
                        <DialogTitle className="text-[14px] font-bold text-gray-500 uppercase tracking-[0.05em] dark:text-zinc-400">PROJECTS OVERVIEW & VERIFICATION</DialogTitle>
                    </div>
                    
                    <div className="p-8 pb-10">
                        {selectedDoc && (() => {
                            const displayTime = (() => {
                                const rawTime = selectedDoc?.rawRow?.time || selectedDoc?.time || projectDetails?.createdAt || projectDetails?.project?.createdAt;
                                if (!rawTime || rawTime === "N/A") return "22 May 2026 05:12 PM";
                                try {
                                    const d = new Date(rawTime);
                                    if (isNaN(d.getTime())) return rawTime;
                                    return d.toLocaleString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        hour12: true,
                                    }).replace(",", "");
                                } catch (e) {
                                    return "22 May 2026 05:12 PM";
                                }
                            })();

                            return (
                                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr,1fr] gap-12">
                                    {/* Left Side: Details & Form */}
                                    <div className="space-y-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-100">
                                                    <div className="relative">
                                                         <Building2 className="w-9 h-9 text-white opacity-20 absolute -top-1 -left-1" />
                                                         <Briefcase className="w-7 h-7 text-white relative z-10" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight dark:text-zinc-100">
                                                        {projectDetails?.project?.companyName || selectedDoc?.rawRow?.company || "QUBA FASHION"}
                                                    </h3>
                                                    <p className="text-[15px] text-gray-500 font-medium dark:text-zinc-400">
                                                        {selectedDoc?.rawRow?.executiveName || "Ramish Khurram"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2 pt-1">
                                                <Calendar className="h-5 w-5 text-[#00a65a] dark:text-zinc-400" />
                                                <div className="text-right">
                                                    <p className="text-[13px] font-bold text-gray-700 dark:text-zinc-400">Upload Date</p>
                                                    <p className="text-[12px] text-gray-500 whitespace-nowrap dark:text-zinc-400">
                                                        {displayTime}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <h4 className="text-[14px] font-bold text-gray-800 uppercase dark:text-zinc-100">Project Details :</h4>
                                            <div className="grid gap-2 pl-1">
                                                <DetailRow label="Product_detail_add" value={projectDetails?.id ? String(parseInt(projectDetails.id.split("-")[0], 16) % 100000) : "10867"} />
                                                <DetailRow label="Company" value={projectDetails?.project?.companyName || selectedDoc?.rawRow?.company || "QUBA FASHION"} />
                                                <DetailRow label="Package" value={projectDetails?.packageName || "Basic Plus"} />
                                                <DetailRow label="Web_url" value={projectDetails?.minisiteUrl} />
                                                <DetailRow label="Phone" value={projectDetails?.phone} />
                                                <DetailRow label="Mobile" value={projectDetails?.mobile} />
                                                <DetailRow label="Address" value={projectDetails?.address} />
                                                <DetailRow label="Referance_web" value={projectDetails?.reference} />
                                                <DetailRow label="Categories" value={projectDetails?.categories} />
                                                <DetailRow label="Detail" value={projectDetails?.detailNotes} />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 pt-6 border-t border-gray-100 dark:border-zinc-800">
                                            <Button 
                                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold h-11 px-10 rounded shadow-md transition-all active:scale-95 text-[14px]"
                                                onClick={() => {
                                                    setConfirmAction("approve");
                                                    setConfirmSaveModalOpen(true);
                                                }}
                                                disabled={verifyDocMutation.isPending}
                                            >
                                                Approve
                                            </Button>
                                            <Button 
                                                className="bg-[#ef4444] hover:bg-[#d32f2f] text-white font-bold h-11 px-10 rounded shadow-md transition-all active:scale-95 text-[14px]"
                                                onClick={() => {
                                                    setRejectionReason("");
                                                    setConfirmAction("reject");
                                                    setConfirmSaveModalOpen(true);
                                                }}
                                                disabled={verifyDocMutation.isPending}
                                            >
                                                Reject
                                            </Button>
                                            <Button 
                                                variant="outline"
                                                className="h-11 px-10 rounded text-[14px]"
                                                onClick={() => setVerifyDocModalOpen(false)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Right Side: Attached Files */}
                                    <div className="space-y-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100 h-fit dark:border-zinc-800">
                                        <div className="flex items-center justify-between border-b pb-3">
                                            <h4 className="text-[14px] font-bold text-gray-700 uppercase tracking-wide dark:text-zinc-400">Attached Files</h4>
                                        </div>
                                        <div className="space-y-3">
                                            <a 
                                                href={selectedDoc.documentUrl || projectDetails?.evidenceUrl || "#"} 
                                                download="Data.xlsx"
                                                className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm group hover:border-[#00a65a] transition-all cursor-pointer no-underline dark:bg-zinc-900 dark:border-zinc-800"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-emerald-50 text-[#00a65a] rounded-lg flex items-center justify-center ring-4 ring-emerald-50/50 dark:bg-zinc-800 dark:text-emerald-400">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-gray-800 mb-0 dark:text-zinc-100">Data.xlsx</p>
                                                        <p className="text-[11px] text-gray-400 font-medium">Size : 33 KB</p>
                                                    </div>
                                                </div>
                                                <Download className="h-4 w-4 text-gray-400 group-hover:text-[#00a65a] transition-colors" />
                                            </a>
                                        </div>
                                        <div className="pt-2 border-t mt-4">
                                            <p className="text-[11px] text-gray-500 font-medium leading-relaxed dark:text-zinc-400">
                                                Please verify all requirements before approving for QA. Ensure the Main Image meets quality standards.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Step 3: Confirm Save Modal */}
            <Dialog open={confirmSaveModalOpen} onOpenChange={setConfirmSaveModalOpen}>
                <DialogContent className="max-w-[400px] p-0 overflow-hidden border-none bg-white rounded-xl shadow-2xl dark:bg-zinc-900">
                    <div className="p-8 text-center space-y-6">
                        <div className={cn(
                            "w-20 h-20 rounded-full flex items-center justify-center mx-auto ring-8",
                            confirmAction === "reject" 
                                ? "bg-rose-50 ring-rose-50/50" 
                                : "bg-emerald-50 ring-emerald-50/50"
                        )}>
                            {confirmAction === "reject" ? (
                                <AlertCircle className="w-10 h-10 text-[#ef4444] dark:text-zinc-400" />
                            ) : (
                                <CheckCircle2 className="w-10 h-10 text-[#00a65a] dark:text-zinc-400" />
                            )}
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-[20px] font-bold text-gray-800 dark:text-zinc-100">Are you sure?</h3>
                            <p className="text-[14px] text-gray-500 font-medium dark:text-zinc-400">
                                {confirmAction === "task" 
                                    ? "Do you want to save and assign this task to the selected executive?"
                                    : confirmAction === "reject"
                                        ? "Do you want to reject this project requirement? This will return it to pending."
                                        : "Do you want to verify and approve this project requirement? This action cannot be undone."}
                            </p>
                        </div>

                        {confirmAction === "reject" && (
                            <div className="space-y-2 text-left">
                                <label className="text-[12px] font-bold text-gray-700 dark:text-zinc-300">Rejection Reason</label>
                                <textarea
                                    className="w-full border border-gray-200 rounded-md p-3 text-[13px] min-h-[80px] outline-none focus:ring-1 focus:ring-rose-500 dark:border-zinc-800"
                                    placeholder="Explain why the project is being rejected..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-4 pt-2">
                            <Button 
                                variant="ghost"
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold h-11 px-8 rounded-xl text-[14px] flex-1 dark:bg-zinc-900 dark:text-zinc-400"
                                onClick={() => {
                                    setConfirmSaveModalOpen(false);
                                    if (confirmAction === "task") {
                                        setMoveTaskModalOpen(true);
                                    }
                                    setConfirmAction(null);
                                }}
                            >
                                No
                            </Button>
                            <Button 
                                className={cn(
                                    "text-white font-bold h-11 px-8 rounded-xl shadow-lg flex-1 text-[14px]",
                                    confirmAction === "reject"
                                        ? "bg-[#ef4444] hover:bg-[#d32f2f] shadow-rose-100"
                                        : "bg-[#00a65a] hover:bg-[#008d4c] shadow-emerald-100"
                                )}
                                onClick={() => {
                                    if (confirmAction === "task") {
                                        createTaskMutation.mutate({
                                            projectId: selectedProjectForMove.id,
                                            assigneeId: taskDetails.assigneeId,
                                            title: taskDetails.title,
                                            description: taskDetails.detail,
                                            links: taskDetails.links,
                                            dueDate: taskDetails.dueDate,
                                            assignedDurationMinutes: Number(taskDetails.duration) || 0,
                                        });
                                    } else if (confirmAction === "reject") {
                                        if (!rejectionReason.trim()) {
                                            alert("Please enter a rejection reason.");
                                            return;
                                        }
                                        verifyDocMutation.mutate({ 
                                            id: selectedDoc.id, 
                                            action: 'REJECT', 
                                            reason: rejectionReason 
                                        });
                                    } else {
                                        verifyDocMutation.mutate({ 
                                            id: selectedDoc.id, 
                                            action: 'APPROVE', 
                                            reason: 'Approved' 
                                        });
                                    }
                                    setConfirmSaveModalOpen(false);
                                    setVerifyDocModalOpen(false);
                                    setConfirmAction(null);
                                }}
                                disabled={verifyDocMutation.isPending || createTaskMutation.isPending}
                            >
                                {verifyDocMutation.isPending || createTaskMutation.isPending ? "Processing..." : "Yes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="product-posting-dashboard wide-page p-4 sm:p-6 space-y-6">
                <Breadcrumb
                    items={
                        isExecutiveView
                            ? [{ label: "DASHBOARD" }, { label: "POSTING EXECUTIVE" }]
                            : [{ label: "DASHBOARD" }, { label: "PRODUCT POSTING MANAGER" }]
                    }
                />

                {isExecutiveView ? (
                    <div className="grid gap-4">
                        <ProductPostingExecutiveWidget />
                    </div>
                ) : (
                    /* Two-column layout (Original Design) */
                    <div className="grid gap-2 lg:grid-cols-[2fr,1fr] min-w-0" style={{ maxWidth: "100%" }}>
                        {/* ── LEFT COLUMN ── */}
                        <div className="space-y-3 min-w-0 overflow-hidden">
                            {/* Stat Cards - Top row */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {dynamicStatCards.map((card) => (
                                    <Card key={card.label} className="shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="p-3">
                                            <p style={{ fontSize: "12px", fontWeight: 500 }} className="text-muted-foreground uppercase tracking-wide">
                                                {card.label}
                                            </p>
                                            <div className="flex items-center justify-between mt-1">
                                                <p style={{ fontSize: "14px", fontWeight: 700 }} className="text-foreground leading-tight">
                                                    {card.value}
                                                </p>
                                                <div className="flex items-center gap-1">
                                                    <TrendingUp style={{ width: "14px", height: "14px", color: card.color }} />
                                                    <span style={{ fontSize: "11px", color: card.color, fontWeight: 600 }}>
                                                        {card.trend}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
                                                {card.label === "Verification" ? (
                                                    <>
                                                        <span style={{ fontSize: "11px" }} className="text-muted-foreground">🔒 {card.subValue}</span>
                                                        <span style={{ fontSize: "11px", color: card.color, marginLeft: "4px" }}>+{card.trend}</span>
                                                    </>
                                                ) : card.label === "Tasks" ? (
                                                    <>
                                                        <CheckCircle2 style={{ width: "12px", height: "12px", color: card.color }} />
                                                        <span style={{ fontSize: "11px" }} className="text-muted-foreground">{card.subValue}</span>
                                                        <span style={{ fontSize: "11px", color: card.color, marginLeft: "4px" }}>{card.trend}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 style={{ width: "12px", height: "12px", color: "#999" }} />
                                                        <span style={{ fontSize: "11px" }} className="text-muted-foreground">{card.subValue}</span>
                                                    </>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Verification & Assign Project */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-3 p-3">
                                    <CardTitle style={{ fontSize: "14px", fontWeight: 600 }}>
                                        Verification &amp; Assign Project
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        {(["waiting", "delay", "approved"] as TabType[]).map(
                                            (tab) => (
                                                <Button
                                                    key={tab}
                                                    size="sm"
                                                    className={cn(
                                                        "capitalize h-7 px-4",
                                                        activeTab === tab
                                                            ? "bg-[#00a65a] text-white hover:bg-[#00a65a]/90"
                                                            : "bg-transparent border text-foreground hover:bg-muted"
                                                    )}
                                                    style={{ fontSize: "12px" }}
                                                    variant={activeTab === tab ? "default" : "outline"}
                                                    onClick={() => setActiveTab(tab)}
                                                >
                                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="overflow-x-auto px-3 pb-3 pt-0">
                                    <table className="w-full" style={{ fontSize: "12px" }}>
                                        <thead>
                                            <tr className="bg-muted/50">
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>No#</th>
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>Company</th>
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>Project</th>
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>Status</th>
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentTableRows.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={5}
                                                        className="px-3 py-4 text-center text-muted-foreground"
                                                        style={{ fontSize: "12px" }}
                                                    >
                                                        No records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentTableRows.map((row: any) => (
                                                    <tr
                                                        key={row.no}
                                                        className="last:border-0 hover:bg-muted/40 transition-colors"
                                                    >
                                                        <td className="px-3 py-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                                                            {row.no}
                                                        </td>
                                                        <td className="px-3 py-2 font-semibold" style={{ fontSize: "12px" }}>{row.company}</td>
                                                        <td className="px-3 py-2" style={{ fontSize: "12px" }}>{row.project}</td>
                                                        <td className="px-3 py-2">
                                                            <Badge 
                                                                className={cn(
                                                                    "font-semibold",
                                                                    row.status === "Documents Pending" 
                                                                        ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100" 
                                                                        : "bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
                                                                )} 
                                                                style={{ fontSize: "11px" }}
                                                            >
                                                                {row.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full hover:bg-green-50 p-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (activeTab === "approved") {
                                                                        setSelectedProjectForMove({
                                                                            id: row.id,
                                                                            company: row.company,
                                                                            project: row.project
                                                                        });
                                                                        setTaskDetails({
                                                                            assigneeId: "",
                                                                            title: row.project,
                                                                            duration: "0",
                                                                            links: "",
                                                                            dueDate: "",
                                                                            detail: ""
                                                                        });
                                                                        setMoveTaskModalOpen(true);
                                                                    } else {
                                                                        setSelectedDoc(row.doc ? { ...row.doc, rawRow: row } : { 
                                                                            id: row.id,
                                                                            projectId: row.id, 
                                                                            projectName: row.project,
                                                                            documentUrl: "",
                                                                            rawRow: row
                                                                        });
                                                                        setVerifyDocModalOpen(true);
                                                                    }
                                                                }}
                                                            >
                                                                <CheckCircle2 className={cn(
                                                                    "w-5 h-5 transition-colors",
                                                                    (activeTab === "approved" || row.doc) ? "text-[#00a65a]" : "text-gray-500 dark:text-slate-400"
                                                                )} />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>

                            {/* Daily Report Section - matching screenshot design */}
                            <Card className="shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-3">
                                    <div className="flex items-center gap-2">
                                        <CheckSquare style={{ width: "18px", height: "18px", color: "#00a65a" }} />
                                        <CardTitle style={{ fontSize: "14px", fontWeight: 700 }}>Daily Report</CardTitle>
                                    </div>
                                    <Select value={dailyReportPeriod} onValueChange={setDailyReportPeriod}>
                                        <SelectTrigger className="w-40 h-8 rounded-full border-gray-300 dark:border-zinc-800" style={{ fontSize: "12px" }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="yesterday" style={{ fontSize: "12px" }}>Yesterday Report</SelectItem>
                                            <SelectItem value="today" style={{ fontSize: "12px" }}>Daily Report</SelectItem>
                                            <SelectItem value="weekly" style={{ fontSize: "12px" }}>Weekly Report</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </CardHeader>
                                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                                    {/* User profile + stat cards row */}
                                    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-white to-gray-50 p-3">
                                        {/* User avatar and info */}
                                        <div className="flex items-center gap-3 min-w-[200px]">
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-white font-bold shrink-0 ring-2 ring-white shadow" style={{ fontSize: "14px" }}>
                                                {userData?.fullName?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "??"}
                                            </div>
                                            <div>
                                                <p style={{ fontSize: "14px", fontWeight: 700 }} className="text-foreground">{userData?.fullName || "Loading..."}</p>
                                                <p style={{ fontSize: "11px" }} className="text-muted-foreground">Login Time: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        {/* Stat cards */}
                                        <div className="flex-1 grid grid-cols-3 gap-2">
                                            <div className="rounded-lg bg-gradient-to-br from-[#00a65a] to-[#2d8a4e] p-2.5 text-white">
                                                <p style={{ fontSize: "11px", fontWeight: 500 }} className="opacity-90">Total Projects</p>
                                                <p style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.2 }}>{hodImportantStats?.data?.activities?.totalProjects || 0}</p>
                                            </div>
                                            <div className="rounded-lg bg-gradient-to-br from-[#00a65a] to-[#2d8a4e] p-2.5 text-white">
                                                <div className="flex items-center justify-between">
                                                    <p style={{ fontSize: "11px", fontWeight: 500 }} className="opacity-90">Total Tasks</p>
                                                    <CheckCircle2 style={{ width: "16px", height: "16px", opacity: 0.8 }} />
                                                </div>
                                                <p style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1.2 }}>{hodImportantStats?.data?.activities?.complete || 0}</p>
                                            </div>
                                            <div className="rounded-lg bg-gradient-to-br from-[#00a65a] to-[#2d8a4e] p-2.5 text-white">
                                                <div className="flex items-center justify-between">
                                                    <p style={{ fontSize: "11px", fontWeight: 500 }} className="opacity-90">Total Free</p>
                                                    <Moon style={{ width: "16px", height: "16px", opacity: 0.8 }} />
                                                </div>
                                                <p style={{ fontSize: "14px", fontWeight: 700, lineHeight: 1.4 }}>{hodImportantStats?.data?.activities?.free || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full rounded-full bg-[#00a65a]" style={{ width: "100%" }} />
                                    </div>

                                    {/* Summary row */}
                                    <div className="flex items-center gap-6" style={{ fontSize: "12px" }}>
                                        <div className="flex items-center gap-1.5">
                                            <Clock style={{ width: "13px", height: "13px", color: "#999" }} />
                                            <span className="font-semibold">Total Spent:</span>
                                            <span className="text-muted-foreground">{dynamicDailyReportRows.length} entries</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock style={{ width: "13px", height: "13px", color: "#999" }} />
                                            <span className="font-semibold">Total Free:</span>
                                            <span className="text-muted-foreground">{hodImportantStats?.data?.activities?.free || 0} tasks</span>
                                        </div>
                                    </div>

                                    {/* Scrollable table */}
                                    <div className="overflow-auto rounded-lg" style={{ maxHeight: "280px" }}>
                                        <table className="w-full" style={{ fontSize: "12px" }}>
                                            <thead className="sticky top-0 bg-white z-10 dark:bg-zinc-900">
                                                <tr className="bg-muted/30">
                                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ fontSize: "12px" }}>
                                                        <div className="flex items-center gap-1">
                                                            <ClipboardList style={{ width: "13px", height: "13px", color: "#666" }} />
                                                            Company
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ fontSize: "12px" }}>
                                                        <div className="flex items-center gap-1">
                                                            <FileText style={{ width: "13px", height: "13px", color: "#666" }} />
                                                            Project
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ fontSize: "12px" }}>
                                                        <div className="flex items-center gap-1">
                                                            <Clock style={{ width: "13px", height: "13px", color: "#666" }} />
                                                            Status
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ fontSize: "12px" }}>
                                                        <div className="flex items-center gap-1">
                                                            <Clock style={{ width: "13px", height: "13px", color: "#666" }} />
                                                            Free Time
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2.5 text-left font-semibold" style={{ fontSize: "12px" }}>Total Spent</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dynamicDailyReportRows.slice((dailyReportPage - 1) * 10, dailyReportPage * 10).map((proj: any, idx: number) => (
                                                    <tr key={idx} className="last:border-0 hover:bg-muted/30 transition-colors">
                                                        <td className="px-3 py-2.5" style={{ fontSize: "12px" }}>
                                                            <div className="flex items-center gap-2">
                                                                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor(proj.statusColor), display: "inline-block", flexShrink: 0 }} />
                                                                <span className="font-medium">{proj.company}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-muted-foreground" style={{ fontSize: "12px" }}>
                                                            <div className="flex items-center gap-1">
                                                                <FileText style={{ width: "12px", height: "12px", color: "#999", flexShrink: 0 }} />
                                                                {proj.project}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <Badge
                                                                className={cn(
                                                                    "font-medium",
                                                                    proj.statusColor === "red" && "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
                                                                    proj.statusColor === "green" && "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
                                                                    proj.statusColor === "yellow" && "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
                                                                )}
                                                                style={{ fontSize: "10px" }}
                                                            >
                                                                {proj.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2.5" style={{ fontSize: "12px" }}>
                                                            <div>
                                                                <span className="text-muted-foreground">{proj.freeTime}</span>
                                                                {proj.freeTimeSub && (
                                                                    <div>
                                                                        <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700" style={{ fontSize: "10px" }}>{proj.freeTimeSub}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5" style={{ fontSize: "12px" }}>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 rounded font-semibold",
                                                                    proj.statusColor === "red" ? "text-foreground" : "text-[#00a65a] bg-green-50"
                                                                )} style={{ fontSize: "11px" }}>
                                                                    {proj.totalSpent}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 rounded-full hover:bg-green-50 transition-colors cursor-pointer border shadow-sm border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setSelectedProjectForMove({
                                                                            id: proj.projectId || proj.id || "",
                                                                            company: proj.company,
                                                                            project: proj.project
                                                                        });
                                                                        setTaskDetails({
                                                                            assigneeId: "",
                                                                            title: proj.project,
                                                                            duration: "0",
                                                                            links: "",
                                                                            dueDate: "",
                                                                            detail: ""
                                                                        });
                                                                        setMoveTaskModalOpen(true);
                                                                    }}
                                                                >
                                                                    <ArrowRight className="w-3.5 h-3.5 text-[#00a65a] dark:text-zinc-400" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {dynamicDailyReportRows.length > 10 && (
                                        <div className="flex items-center justify-between pt-4 px-2 text-sm text-slate-500">
                                            <p style={{ fontSize: "11px" }} className="text-muted-foreground">
                                                Showing {(dailyReportPage - 1) * 10 + 1} to {Math.min(dailyReportPage * 10, dynamicDailyReportRows.length)} of {dynamicDailyReportRows.length} entries
                                            </p>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setDailyReportPage(p => Math.max(1, p - 1))} 
                                                    disabled={dailyReportPage === 1}
                                                >
                                                    Prev
                                                </Button>
                                                <div className="flex items-center px-2 font-medium" style={{ fontSize: "11px" }}>
                                                    Page {dailyReportPage} of {Math.ceil(dynamicDailyReportRows.length / 10)}
                                                </div>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => setDailyReportPage(p => Math.min(Math.ceil(dynamicDailyReportRows.length / 10), p + 1))} 
                                                    disabled={dailyReportPage === Math.ceil(dynamicDailyReportRows.length / 10)}
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        {/* ── RIGHT COLUMN ── */}
                        <div className="space-y-2 min-w-0 overflow-hidden">
                            {/* Professional Promotional Banner */}
                            <Card className="overflow-hidden border-none shadow-lg group">
                                <div
                                    className="relative h-32 p-4 flex flex-col justify-end bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                                    style={{ backgroundImage: "url('/promo_banner.png')" }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <Award className="w-3.5 h-3.5 text-amber-400" />
                                            <p style={{ fontSize: "10px", fontWeight: 600 }} className="text-amber-400 uppercase tracking-[0.1em]">Premium Partner</p>
                                        </div>
                                        <h3 style={{ fontSize: "14px", fontWeight: 800 }} className="text-white leading-tight">
                                            WebExcels Elite Solutions
                                        </h3>
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-white dark:bg-zinc-900">
                                    <p style={{ fontSize: "12px", lineHeight: "1.5" }} className="text-gray-600 font-medium dark:text-zinc-300">
                                        Experience the next generation of Alibaba Product Posting & Digital Strategy.
                                    </p>
                                    <Button
                                        className="mt-3 w-full h-9 bg-[#1a7a4a] hover:bg-[#145d39] text-white rounded-lg shadow-md transition-all flex items-center justify-center gap-2 group/btn"
                                        style={{ fontSize: "12px", fontWeight: 600 }}
                                    >
                                        Explore Elite Services
                                        <TrendingUp className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1" />
                                    </Button>
                                </CardContent>
                            </Card>


                            {/* Projects Overview */}
                            <Card>
                                <CardHeader className="p-3 pb-2">
                                    <CardTitle style={{ fontSize: "14px", fontWeight: 600 }}>Projects Overview</CardTitle>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 pt-0">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                                        {renderLinkSection(0, 2)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                                        {renderLinkSection(2, 4)}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                                        {renderLinkSection(4)}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Important Section */}
                            <div className="bg-white rounded-lg shadow-sm p-4 mb-2 dark:bg-zinc-900">
                                <h2 className="text-[14px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important</h2>
                                <div className="space-y-4">
                                    {dynamicImportantStats.map((stat, rowIndex) => (
                                        <div key={rowIndex} className="flex justify-between items-center py-1.5 last:border-0">
                                            <a href={stat.href || "#"} className="flex flex-1 justify-between text-[13px] hover:opacity-80 transition-opacity">
                                                <span className="text-gray-600 font-medium dark:text-zinc-300">{stat.label}</span>
                                                <span className="text-gray-900 font-bold dark:text-zinc-100">{stat.value}</span>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Activities - Donut Chart */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-2 p-3 pb-2">
                                    <CardTitle style={{ fontSize: "14px", fontWeight: 600 }}>Activities</CardTitle>
                                    <Select value={activityPeriod} onValueChange={setActivityPeriod}>
                                        <SelectTrigger className="w-16 h-7" style={{ fontSize: "12px" }}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TD" style={{ fontSize: "12px" }}>TD</SelectItem>
                                            <SelectItem value="WC" style={{ fontSize: "12px" }}>WC</SelectItem>
                                            <SelectItem value="MONTH" style={{ fontSize: "12px" }}>Month</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </CardHeader>
                                <CardContent className="px-3 pb-3 pt-1">
                                    <DonutChart stats={donutChartStats} />
                                </CardContent>
                            </Card>

                            {/* Daily Activities Table */}
                            <Card className="flex flex-col h-[400px]">
                                <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2 shrink-0">
                                    <CardTitle style={{ fontSize: "14px", fontWeight: 600 }}>Daily Activities</CardTitle>
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-md border-gray-200 dark:border-zinc-800">
                                        <List className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto px-4 pb-4 pt-2 custom-scrollbar">
                                    <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
                                        <thead>
                                            <tr className="">
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "50%" }}>Name</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "20%" }}>Method</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "20%" }}>Target</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 text-right whitespace-nowrap" style={{ width: "10%" }}>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {dynamicDailyActivities.map((row: any, idx: number) => (
                                                <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-2.5">
                                                        <div className="flex items-center gap-2 pr-1">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100 bg-[#f0f2f5] flex items-center justify-center text-gray-400 font-semibold text-[10px] dark:border-zinc-800 dark:bg-zinc-900">
                                                                {row.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                                            </div>
                                                            <span className="font-medium text-gray-700 dark:text-zinc-400" style={{ fontSize: "11px" }}>{row.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5">
                                                        <div
                                                            className={cn(
                                                                "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-semibold text-white shadow-sm whitespace-nowrap",
                                                                row.methodColor === "copy" ? "bg-[#369b74]" : "bg-[#e8ba6c]"
                                                            )}
                                                            style={{ width: "100%" }}
                                                        >
                                                            {row.method}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="bg-[#f0f2f5] px-2 py-0.5 rounded-md font-medium text-gray-600 whitespace-nowrap dark:text-zinc-300 dark:bg-zinc-900" style={{ fontSize: "10px" }}>
                                                                {row.target.split(" ").slice(0, 2).join(" ")} <span className="text-gray-400 font-normal ml-0.5">{row.target.split(" ")[2]}</span>
                                                            </div>
                                                            <span className="font-bold text-gray-500 text-[10px] dark:text-zinc-400">{row.timeVal}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <div className="inline-block bg-[#f0f2f5] px-2 py-0.5 rounded-md font-bold text-gray-700 text-[10px] dark:bg-zinc-900 dark:text-zinc-400">
                                                            {row.time}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
