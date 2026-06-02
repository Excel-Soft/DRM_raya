import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

import { Breadcrumb } from "@/components/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

// ÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

type Project = {
    id: string;
    name: string;
    description?: string;
    status: "Active" | "OnHold" | "Completed";
    workSpace?: string;
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

// ÔöÇÔöÇ Static mock data matching the screenshots ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

// ÔöÇÔöÇ Types ÔöÇÔöÇ
type TabType = "waiting" | "delay" | "approved";

// Keep items that are just links
const projectOverviewLinks = {
    General: [
        { label: "Pms Setting", icon: Settings, href: "/drm/pms-setting" },
        { label: "Running Project", icon: Play, href: "/pms/running-projects", highlight: true },
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
        { label: "Complete Project D&D P&P", icon: Briefcase, href: "/pms/status", highlight: true },
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

// ÔöÇÔöÇ Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export default function ProductPostingDashboard() {
    // ÔöÇÔöÇ Role detection ÔöÇÔöÇ
    const userRoleName = (localStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");

    const [activeTab, setActiveTab] = useState<TabType>("waiting");
    const [activityPeriod, setActivityPeriod] = useState("TD");
    const [dailyReportPeriod, setDailyReportPeriod] = useState("today");
    const [selectedProjectForMove, setSelectedProjectForMove] = useState<any>(null);
    const [selectedAssignee, setSelectedAssignee] = useState("");
    const [verifyDocModalOpen, setVerifyDocModalOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [moveTaskModalOpen, setMoveTaskModalOpen] = useState(false);

    // ÔöÇÔöÇ Queries ÔöÇÔöÇ

    // 1. PMS Stats for KPI cards and donut chart
    const { data: pmsStats } = useQuery({
        queryKey: ["/api/pms/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/stats");
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
        queryKey: ["/api/hod/daily-report"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/daily-report");
            return res.json();
        }
    });

    // 6. HOD Important Stats
    const { data: hodImportantStats } = useQuery({
        queryKey: ["/api/hod/dashboard/important-stats"],
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
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/projects/documents/pending");
            return res.json();
        }
    });

    const verifyDocMutation = useMutation({
        mutationFn: async ({ id, action, reason }: { id: string, action: string, reason?: string }) => {
            await apiRequest("PUT", `/api/projects/documents/${id}/verify`, { action, reason });
        },
        onSuccess: () => {
            refetchPendingDocs();
            queryClient.invalidateQueries({ queryKey: ["/api/pms/projects?withStats=true"] });
            setVerifyDocModalOpen(false);
            alert("Document verified successfully.");
        }
    });

    // 9. Executives List
    const { data: executivesData } = useQuery({
        queryKey: ["/api/users", { role: "product_posting_executive" }],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users?role=product_posting_executive");
            return res.json();
        }
    });

    const createTaskMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", "/api/pms/tasks", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/pms/projects?withStats=true"] });
            setMoveTaskModalOpen(false);
            setSelectedAssignee("");
            alert("Task assigned to Executive successfully!");
        }
    });

    // ÔöÇÔöÇ Mappings ÔöÇÔöÇ

    const dynamicStatCards = useMemo(() => {
        const stats = pmsStats?.tasks || { total: 0, inProgress: 0, completed: 0, overdue: 0 };
        const projectCount = pmsStats?.projects?.totalProjects || 0;

        return [
            {
                label: "Total Projects",
                value: projectCount.toLocaleString(),
                subValue: (pmsStats?.projects?.activeProjects || 0).toString(),
                trend: "+0%", // Trend logic not available in simple stats
                trendUp: true,
                icon: "­ƒôè",
                color: "#1a7a4a",
            },
            {
                label: "Verification",
                value: (pmsStats?.tasks?.blocked || 0).toString(),
                subValue: (pmsStats?.tasks?.blocked || 0).toString(),
                trend: "0%",
                trendUp: true,
                icon: "­ƒöä",
                color: "#d4a843",
            },
            {
                label: "Tasks",
                value: stats.total.toLocaleString(),
                subValue: stats.total.toString(),
                trend: "0%",
                trendUp: true,
                icon: "­ƒôï",
                color: "#1a7a4a",
            },
            {
                label: "Free",
                value: (pmsStats?.tasks?.toDo || 0).toString(),
                subValue: "c0",
                trend: "0%",
                trendUp: true,
                icon: "­ƒôì",
                color: "#4a4a4a",
            },
        ];
    }, [pmsStats]);

    const dynamicTableData = useMemo(() => {
        const safeProjects = Array.isArray(projects) ? projects : (projects as any)?.data || [];

        const pendingDocs = pendingDocsData?.data || [];

        const waiting = safeProjects.filter((p: any) => p.status === "Active").map((p: any, i: number) => {
            const doc = pendingDocs.find((d: any) => d.projectId === p.id);
            return {
                no: `${i + 1}/${p.id.slice(0, 4)}`,
                company: p.workSpace || "N/A",
                project: p.name,
                status: doc ? "Verify Doc" : "Active",
                doc: doc,
                id: p.id,
                time: p.startDate ? new Date(p.startDate).toLocaleString() : "N/A",
            };
        });

        const delay = safeProjects.filter((p: any) => p.status === "OnHold").map((p: any, i: number) => ({
            no: `${i + 1}/${p.id.slice(0, 4)}`,
            company: p.workSpace || "N/A",
            project: p.name,
            status: "Delay",
            time: p.startDate ? new Date(p.startDate).toLocaleString() : "N/A",
        }));

        const approved = safeProjects.filter((p: any) => p.status === "Completed").map((p: any, i: number) => ({
            no: `${i + 1}/${p.id.slice(0, 4)}`,
            company: p.workSpace || "N/A",
            project: p.name,
            status: "Approved",
            time: p.endDate ? new Date(p.endDate).toLocaleString() : "N/A",
        }));

        return { waiting, delay, approved };
    }, [projects]);

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
            totalSpent: row.spent
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
            <div className="product-posting-dashboard space-y-2">
                <Breadcrumb
                    items={[
                        { label: "DASHBOARD" },
                        { label: "PRODUCT POSTING" },
                        { label: "PRODUCT POSTING MANAGER" },
                    ]}
                />

                {userRoleName === "product_posting_executive" ? (
                    <div className="grid gap-4">
                        <ProductPostingExecutiveWidget />
                    </div>
                ) : (
                    /* Two-column layout */
                    <div className="grid gap-2 lg:grid-cols-[2fr,1fr] min-w-0" style={{ maxWidth: "100%" }}>
                        {/* ÔöÇÔöÇ LEFT COLUMN ÔöÇÔöÇ */}
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
                                                <p style={{ fontSize: "20px", fontWeight: 700 }} className="text-foreground leading-tight">
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
                                                        <span style={{ fontSize: "11px" }} className="text-muted-foreground">­ƒöÆ {card.subValue}</span>
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
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                            <MoreHorizontal style={{ width: "14px", height: "14px" }} />
                                        </Button>
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
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}></th>
                                                <th className="px-3 py-2 text-left font-semibold" style={{ fontSize: "12px" }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentTableRows.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="px-3 py-4 text-center text-muted-foreground"
                                                        style={{ fontSize: "12px" }}
                                                    >
                                                        No records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentTableRows.map((row) => (
                                                    <tr
                                                        key={row.no}
                                                        className="border-b last:border-0 hover:bg-muted/40 transition-colors"
                                                    >
                                                        <td className="px-3 py-2 text-muted-foreground" style={{ fontSize: "12px" }}>
                                                            {row.no}
                                                        </td>
                                                        <td className="px-3 py-2 font-semibold" style={{ fontSize: "12px" }}>{row.company}</td>
                                                        <td className="px-3 py-2" style={{ fontSize: "12px" }}>{row.project}</td>
                                                        <td className="px-3 py-2">
                                                            <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 font-semibold" style={{ fontSize: "11px" }}>
                                                                {row.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-muted-foreground" style={{ fontSize: "11px" }}>
                                                            {row.time}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {row.status === "Verify Doc" ? (
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-primary text-white hover:bg-primary/90 h-8 gap-1"
                                                                    onClick={() => {
                                                                        setSelectedDoc(row.doc);
                                                                        setVerifyDocModalOpen(true);
                                                                    }}
                                                                >
                                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                                    Verify
                                                                </Button>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <CheckCircle2 style={{ width: "18px", height: "18px", color: "#00a65a" }} />
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-8 py-0 px-2 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                                        onClick={() => {
                                                                            setSelectedProjectForMove(row);
                                                                            setMoveTaskModalOpen(true);
                                                                        }}
                                                                    >
                                                                        Assign
                                                                    </Button>
                                                                </div>
                                                            )}
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
                                        <SelectTrigger className="w-40 h-8 rounded-full border-gray-300" style={{ fontSize: "12px" }}>
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
                                    <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-white to-gray-50 border p-3">
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
                                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
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
                                    <div className="overflow-auto rounded-lg border" style={{ maxHeight: "280px" }}>
                                        <table className="w-full" style={{ fontSize: "12px" }}>
                                            <thead className="sticky top-0 bg-white z-10">
                                                <tr className="border-b bg-muted/30">
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
                                                {dynamicDailyReportRows.map((proj, idx) => (
                                                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
                                                                    className="h-6 w-6 rounded-full hover:bg-green-50 transition-colors cursor-pointer border shadow-sm border-gray-100 bg-white"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        setSelectedProjectForMove(proj.project);
                                                                        setMoveTaskModalOpen(true);
                                                                    }}
                                                                >
                                                                    <ArrowRight className="w-3.5 h-3.5 text-[#00a65a]" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination */}
                                    <div className="flex items-center justify-between pt-1">
                                        <p style={{ fontSize: "11px" }} className="text-muted-foreground">Showing 1 to {dynamicDailyReportRows.length} of {dynamicDailyReportRows.length} entries</p>
                                        <div className="flex items-center gap-1">
                                            <Select defaultValue="1">
                                                <SelectTrigger className="w-20 h-7" style={{ fontSize: "11px" }}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1" style={{ fontSize: "11px" }}>1 / of 1</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" style={{ fontSize: "11px" }}>&lt;</Button>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" style={{ fontSize: "11px" }}>&lt;</Button>
                                            <Button size="sm" className="h-7 w-7 p-0 bg-[#00a65a] text-white hover:bg-[#00a65a]/90 rounded" style={{ fontSize: "11px" }}>1</Button>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" style={{ fontSize: "11px" }}>&gt;</Button>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" style={{ fontSize: "11px" }}>&gt;</Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>

                        {/* ÔöÇÔöÇ RIGHT COLUMN ÔöÇÔöÇ */}
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
                                        <h3 style={{ fontSize: "16px", fontWeight: 800 }} className="text-white leading-tight">
                                            WebExcels Elite Solutions
                                        </h3>
                                    </div>
                                </div>
                                <CardContent className="p-4 bg-white">
                                    <p style={{ fontSize: "12px", lineHeight: "1.5" }} className="text-gray-600 font-medium">
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
                                        {Object.entries(projectOverviewLinks).slice(0, 2).map(([category, links]) => (
                                            <div key={category}>
                                                <p style={{ fontSize: "12px", fontWeight: 600 }} className="text-muted-foreground mb-1 mt-2 border-b pb-1">
                                                    {category}
                                                </p>
                                                {links.map((link, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={link.href}
                                                        className={cn(
                                                            "flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors",
                                                            link.highlight && "bg-green-50 border border-green-200"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <link.icon style={{ width: "14px", height: "14px" }} className="text-muted-foreground" />
                                                            <span style={{ fontSize: "12px" }} className={cn(link.highlight ? "text-green-700 font-semibold" : "")}>
                                                                {link.label}
                                                            </span>
                                                        </div>
                                                        <ChevronRight style={{ width: "12px", height: "12px" }} className="text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                                        {Object.entries(projectOverviewLinks).slice(2, 4).map(([category, links]) => (
                                            <div key={category}>
                                                <p style={{ fontSize: "12px", fontWeight: 600 }} className="text-muted-foreground mb-1 mt-2 border-b pb-1">
                                                    {category.trim()}
                                                </p>
                                                {links.map((link, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={link.href}
                                                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <link.icon style={{ width: "14px", height: "14px" }} className="text-muted-foreground" />
                                                            <span style={{ fontSize: "12px" }}>{link.label}</span>
                                                        </div>
                                                        <ChevronRight style={{ width: "12px", height: "12px" }} className="text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                                        {Object.entries(projectOverviewLinks).slice(4).map(([category, links]) => (
                                            <div key={category}>
                                                <p style={{ fontSize: "12px", fontWeight: 600 }} className="text-muted-foreground mb-1 mt-2 border-b pb-1">
                                                    {category.trim()}
                                                </p>
                                                {links.map((link, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={link.href}
                                                        className={cn(
                                                            "flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors",
                                                            link.highlight && "bg-green-50 border border-green-200"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <link.icon style={{ width: "14px", height: "14px" }} className="text-muted-foreground" />
                                                            <span style={{ fontSize: "12px" }} className={cn(link.highlight ? "text-green-700 font-semibold" : "")}>
                                                                {link.label}
                                                            </span>
                                                        </div>
                                                        <ChevronRight style={{ width: "12px", height: "12px" }} className="text-muted-foreground" />
                                                    </a>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Important Section */}
                            <Card className="border-none shadow-none bg-transparent mb-2 relative z-10">
                                <CardHeader className="p-0 pb-2">
                                    <CardTitle className="text-[14px] font-bold text-gray-700">Important</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                        {dynamicImportantStats.map((stat, idx) => (
                                            <a
                                                key={idx}
                                                href={stat.href || "#"}
                                                className={cn(
                                                    "group flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer text-left outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 pointer-events-auto",
                                                    idx === dynamicImportantStats.length - 1 && "col-span-2"
                                                )}
                                                style={{ borderLeft: `4px solid ${stat.color}` }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                                                    <span className="text-[11px] text-gray-500 font-medium">{stat.label}</span>
                                                </div>
                                                <span className="text-[13px] text-gray-800 font-bold italic">{stat.value}</span>
                                            </a>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

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
                                    <DonutChart stats={hodImportantStats?.data?.activities} />
                                </CardContent>
                            </Card>

                            {/* Daily Activities Table */}
                            <Card className="flex flex-col h-[400px]">
                                <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2 shrink-0">
                                    <CardTitle style={{ fontSize: "14px", fontWeight: 600 }}>Daily Activities</CardTitle>
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-md border-gray-200">
                                        <List className="h-4 w-4 text-gray-500" />
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto px-4 pb-4 pt-2 custom-scrollbar">
                                    <table className="w-full border-collapse" style={{ fontSize: "12px" }}>
                                        <thead>
                                            <tr className="border-b border-gray-100">
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "50%" }}>Name</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "20%" }}>Method</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 whitespace-nowrap" style={{ width: "20%" }}>Target</th>
                                                <th className="pb-3 text-left font-medium text-gray-400 text-right whitespace-nowrap" style={{ width: "10%" }}>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {dynamicDailyActivities.map((row, idx) => (
                                                <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-2.5">
                                                        <div className="flex items-center gap-2 pr-1">
                                                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-100 bg-[#f0f2f5] flex items-center justify-center text-gray-400 font-semibold text-[10px]">
                                                                {row.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                                            </div>
                                                            <span className="font-medium text-gray-700" style={{ fontSize: "11px" }}>{row.name}</span>
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
                                                            <div className="bg-[#f0f2f5] px-2 py-0.5 rounded-md font-medium text-gray-600 whitespace-nowrap" style={{ fontSize: "10px" }}>
                                                                {row.target.split(" ").slice(0, 2).join(" ")} <span className="text-gray-400 font-normal ml-0.5">{row.target.split(" ")[2]}</span>
                                                            </div>
                                                            <span className="font-bold text-gray-500 text-[10px]">{row.timeVal}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <div className="inline-block bg-[#f0f2f5] px-2 py-0.5 rounded-md font-bold text-gray-700 text-[10px]">
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

            {/* Move Task Modal */}
            <Dialog open={moveTaskModalOpen} onOpenChange={setMoveTaskModalOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                    <div className="flex items-center justify-between p-4 border-b">
                        <DialogTitle className="text-[18px] font-bold text-gray-600">Assign Work to Executive</DialogTitle>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-600">Project</label>
                            <Input
                                readOnly
                                value={selectedProjectForMove?.project || ""}
                                className="bg-slate-50 border-gray-200 text-gray-600 h-10 pointer-events-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[13px] font-semibold text-gray-600">Assign To Executive</label>
                            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                                <SelectTrigger className="w-full h-10 text-gray-700">
                                    <SelectValue placeholder="Select Executive..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(executivesData?.users || []).map((user: any) => (
                                        <SelectItem key={user.id} value={user.id}>{user.fullName} ({user.email})</SelectItem>
                                    ))}
                                    {(!executivesData?.users || executivesData.users.length === 0) && (
                                        <SelectItem disabled value="none">No executives found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center justify-end p-4 py-3 border-t gap-2 bg-white mt-2">
                        <Button variant="secondary" className="bg-[#f0f2f5] hover:bg-gray-200 text-black px-6 font-semibold" onClick={() => setMoveTaskModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#00a65a]/90 text-white px-6 font-semibold"
                            disabled={!selectedAssignee || createTaskMutation.isPending}
                            onClick={() => {
                                createTaskMutation.mutate({
                                    projectId: selectedProjectForMove.id,
                                    assigneeId: selectedAssignee,
                                    status: 'ToDo',
                                    title: `Post for ${selectedProjectForMove.project}`,
                                    description: `Please post products for project: ${selectedProjectForMove.project} (${selectedProjectForMove.company})`
                                });
                            }}
                        >
                            {createTaskMutation.isPending ? "Assigning..." : "Assign Task"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Document Verification Modal */}
            <Dialog open={verifyDocModalOpen} onOpenChange={setVerifyDocModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Verify Project Requirements</DialogTitle>
                    </DialogHeader>
                    {selectedDoc && (
                        <div className="grid gap-4 py-4">
                            <div className="p-3 bg-slate-50 border rounded-md">
                                <p className="text-sm font-semibold mb-1">Document URL:</p>
                                <a
                                    href={selectedDoc.documentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline break-all"
                                >
                                    {selectedDoc.documentUrl}
                                </a>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Rejection Reason (if any)</label>
                                <Input
                                    placeholder="State reason if rejecting..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => verifyDocMutation.mutate({
                                        id: selectedDoc.id,
                                        action: 'REJECT',
                                        reason: rejectionReason
                                    })}
                                    disabled={verifyDocMutation.isPending}
                                    className="border-red-200 text-red-600 hover:bg-red-50"
                                >
                                    Reject
                                </Button>
                                <Button
                                    onClick={() => verifyDocMutation.mutate({
                                        id: selectedDoc.id,
                                        action: 'APPROVE'
                                    })}
                                    disabled={verifyDocMutation.isPending}
                                    className="bg-[#00a65a] hover:bg-[#00a65a]/90"
                                >
                                    Approve & Mark Ready
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
