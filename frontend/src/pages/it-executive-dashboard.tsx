import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ItAssetManagementSection } from "@/components/it-asset-management-section";
import { Server, CheckCircle, Archive, AlertTriangle, ChevronRight, Play, CheckSquare } from "lucide-react";

interface AssetStats {
    overview: { totalAssets: number; inUse: number; inCustody: number; damaged: number };
    distribution: Array<{ assetType: string; count: number }>;
    projectTypes: { newProject: number; renewal: number };
}

interface Promotion {
    id: string;
    bannerUrl: string | null;
    title?: string | null;
}

interface DomainItem {
    id: string;
    expiryDate: string | null;
}

interface LeaveRequestItem {
    id: string;
    status: string;
}

const DISTRIBUTION_LABELS: Record<string, string> = {
    Laptop: "Laptops",
    Mobile: "Mobiles",
    LED: "LEDs",
    Desktop: "Desktops",
    Tablet: "Tablets",
    Other: "Other Types",
};
const DISTRIBUTION_ORDER = ["Laptop", "Mobile", "LED", "Desktop", "Tablet", "Other"];

// route: undefined -> no real page/data exists anywhere in the app yet for
// this tile (confirmed against the backend + the equivalent IT Manager
// dashboard, which leaves the same 3 as static "—" placeholders with a code
// comment saying so) -> tile shows a "Coming soon" toast instead of navigating.
const PROJECTS_OVERVIEW_TILES: Array<{ label: string; route?: string }> = [
    { label: "Over Time", route: "/hr/overtime" },
    { label: "Domain Report", route: "/it/system-report" },
    { label: "Domain List", route: "/it/domains" },
    { label: "Domain Backup", route: "/it/backup" },
];

export default function ItExecutiveDashboard() {
    const [, navigate] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [bannerIndex, setBannerIndex] = useState(0);

    // Tasks the IT Manager assigns from the Approval tab's "Assign Task" form
    // (POST /api/pms/tasks) land here. GET /api/pms/tasks auto-scopes to
    // "owned by or assigned to me" for a non-managerial role like
    // it_executive, so no extra assignedToUserId filter is needed — just the
    // status per tab.
    const [projectTab, setProjectTab] = useState<"assign" | "working" | "complete">("assign");
    const PROJECT_TAB_STATUS: Record<typeof projectTab, string> = {
        assign: "ToDo",
        working: "InProgress",
        complete: "Completed",
    };
    const { data: myTasks = [], isLoading: tasksLoading } = useQuery<any[]>({
        queryKey: [`/api/pms/tasks?status=${PROJECT_TAB_STATUS[projectTab]}`],
    });
    const updateTaskStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            return apiRequestJson("PATCH", `/api/it/tasks/${id}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [`/api/pms/tasks?status=ToDo`] });
            queryClient.invalidateQueries({ queryKey: [`/api/pms/tasks?status=InProgress`] });
            queryClient.invalidateQueries({ queryKey: [`/api/pms/tasks?status=Completed`] });
            toast({ title: "Task updated" });
        },
        onError: (err: any) => {
            toast({ title: err?.message || "Failed to update task", variant: "destructive" });
        },
    });

    const handleTileClick = (tile: { label: string; route?: string }) => {
        if (tile.route) navigate(tile.route);
        else toast({ title: "Coming soon", description: `${tile.label} isn't available yet.` });
    };

    const { data: statsRes } = useQuery<{ data: AssetStats }>({
        queryKey: ["/api/it/asset-inventory/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/asset-inventory/stats");
            if (!res.ok) throw new Error("Failed to load asset stats");
            return res.json();
        },
    });
    const stats = statsRes?.data;

    const { data: promotionsRes } = useQuery<{ data: Promotion[] }>({
        queryKey: ["/api/drm/promotions", "banner"],
        queryFn: async () => {
            // scope=banner surfaces approved+active promotions from any creator —
            // the same opt-in company-wide banner widgets use elsewhere.
            const res = await apiRequest("GET", "/api/drm/promotions?scope=banner");
            if (!res.ok) return { data: [] };
            return res.json();
        },
    });
    const promotions: Promotion[] = promotionsRes?.data ?? [];
    const activeBanner = promotions[bannerIndex % Math.max(promotions.length, 1)];

    const distributionByType = new Map((stats?.distribution ?? []).map((d) => [d.assetType, d.count]));
    const maxDistributionCount = Math.max(1, ...DISTRIBUTION_ORDER.map((t) => distributionByType.get(t) ?? 0));

    const { data: servers } = useQuery<any[]>({
        queryKey: ["/api/it/servers"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/servers");
            if (!res.ok) return [];
            return res.json();
        },
    });
    const { data: registries } = useQuery<any[]>({
        queryKey: ["/api/it/registries"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/registries");
            if (!res.ok) return [];
            return res.json();
        },
    });
    const { data: hostingPackages } = useQuery<any[]>({
        queryKey: ["/api/it/hosting-packages"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/hosting-packages");
            if (!res.ok) return [];
            return res.json();
        },
    });
    const { data: domains } = useQuery<DomainItem[]>({
        queryKey: ["/api/it/domains"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/domains");
            if (!res.ok) return [];
            return res.json();
        },
    });
    const { data: leaveRequests } = useQuery<LeaveRequestItem[]>({
        queryKey: ["/api/leave"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/leave");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // "expiring soon" = expiry within the next 90 days — same window the IT
    // Manager dashboard uses for its own domain-expiry breakdown.
    const expiringSoonCount = (domains ?? []).filter((d) => {
        if (!d.expiryDate) return false;
        const day = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86_400_000);
        return day >= 0 && day <= 90;
    }).length;
    const pendingLeaveCount = (leaveRequests ?? []).filter((r) => r.status === "Pending").length;

    const IMPORTANT_TILES: Array<{ label: string; route?: string; value?: number }> = [
        { label: "Total Hosting" },
        { label: "Total Use" },
        { label: "Server", route: "/it/servers", value: servers?.length },
        { label: "Registry", route: "/it/servers", value: registries?.length },
        { label: "Hosting Pkg", route: "/it/servers", value: hostingPackages?.length },
        { label: "Pending", route: "/it/domains", value: expiringSoonCount },
        { label: "Leave Application", route: "/hr/leave-request", value: pendingLeaveCount },
        { label: "Dollar Rate" },
    ];

    return (
        <div className="p-4 bg-slate-50/50 dark:bg-zinc-950 min-h-screen font-sans">
            {/* Breadcrumb */}
            <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                    <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="text-slate-500 uppercase dark:text-zinc-400">IT EXECUTIVE</span>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 mb-6">
                {/* IT Assets Overview (8 cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <h2 className="text-[16px] font-bold text-slate-700 mb-4 dark:text-zinc-400">IT Assets Overview</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Total Assets</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats?.overview.totalAssets ?? 0}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Server className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">In Use</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats?.overview.inUse ?? 0}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">In Custody</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats?.overview.inCustody ?? 0}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Archive className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Damaged</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{stats?.overview.damaged ?? 0}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* Assign / Working / Complete Project — tasks the IT Manager
                        assigns from an Approved document (see it-manager-dashboard.tsx's
                        Assign Task form) land in "Assign Project" (ToDo); this executive
                        moves them along themselves. */}
                    <Card className="border border-slate-200 shadow-sm rounded-sm bg-white overflow-hidden mt-4 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80">
                            {([
                                { key: "assign", label: "Assign Project" },
                                { key: "working", label: "Working Project" },
                                { key: "complete", label: "Complete Project" },
                            ] as const).map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setProjectTab(tab.key)}
                                    className={cn(
                                        "px-4 py-1.5 text-[12px] font-bold rounded-md transition-all",
                                        projectTab === tab.key ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {tasksLoading ? (
                                <div className="p-6 text-center text-[13px] text-slate-400">Loading...</div>
                            ) : myTasks.length === 0 ? (
                                <div className="p-6 text-center text-[13px] text-slate-400">
                                    {projectTab === "assign" ? "No new tasks assigned yet." : projectTab === "working" ? "Nothing in progress." : "Nothing completed yet."}
                                </div>
                            ) : myTasks.map((task: any) => (
                                <div key={task.id} className="flex items-center justify-between p-3">
                                    <div>
                                        <p className="text-[13px] font-bold text-slate-800 dark:text-zinc-100">{task.title}</p>
                                        {task.description && <p className="text-[11px] text-slate-400">{task.description}</p>}
                                    </div>
                                    {projectTab === "assign" && (
                                        <Button
                                            size="sm"
                                            className="h-8 px-3 text-[12px] bg-emerald-600 hover:bg-emerald-700"
                                            disabled={updateTaskStatusMutation.isPending}
                                            onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "InProgress" })}
                                        >
                                            <Play className="w-3.5 h-3.5 mr-1" /> Start Working
                                        </Button>
                                    )}
                                    {projectTab === "working" && (
                                        <Button
                                            size="sm"
                                            className="h-8 px-3 text-[12px] bg-emerald-600 hover:bg-emerald-700"
                                            disabled={updateTaskStatusMutation.isPending}
                                            onClick={() => updateTaskStatusMutation.mutate({ id: task.id, status: "Completed" })}
                                        >
                                            <CheckSquare className="w-3.5 h-3.5 mr-1" /> Mark Complete
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Right column (4 cols): Promotion Banners, Projects Overview, Important, Asset Distribution */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    <div>
                        <h2 className="text-[16px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Promotion Banners</h2>
                        {activeBanner?.bannerUrl ? (
                            <Card className="overflow-hidden border-none shadow-sm rounded-[10px] relative h-[90px] group">
                                <img src={activeBanner.bannerUrl} alt="Promotion Banner" className="w-full h-full object-cover" />
                                {promotions.length > 1 && (
                                    <div className="absolute inset-0 flex items-center justify-between px-2 bg-gradient-to-t from-black/10 to-transparent">
                                        <button
                                            onClick={() => setBannerIndex((i) => (i - 1 + promotions.length) % promotions.length)}
                                            className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronRight className="rotate-180 h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => setBannerIndex((i) => (i + 1) % promotions.length)}
                                            className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <Card className="border-none shadow-sm rounded-[10px] h-[90px] flex items-center justify-center text-sm text-muted-foreground">
                                No active promotions
                            </Card>
                        )}
                    </div>

                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <div className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Projects Overview</h3>
                        </div>
                        <div className="p-4 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 gap-2">
                                {PROJECTS_OVERVIEW_TILES.map((tile) => (
                                    <div
                                        key={tile.label}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleTileClick(tile)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTileClick(tile); }}
                                        className="bg-slate-50 p-2.5 px-3 flex justify-between items-center text-[13px] text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                    >
                                        <span className="font-medium">{tile.label}</span>
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <div className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Important</h3>
                        </div>
                        <div className="p-0 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 text-[13px]">
                                {IMPORTANT_TILES.map((tile, idx) => (
                                    <div
                                        key={tile.label}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleTileClick(tile)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleTileClick(tile); }}
                                        className={`flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800 ${idx % 2 === 0 ? "" : "border-l"}`}
                                    >
                                        <span className="text-slate-500 font-medium dark:text-zinc-400">{tile.label}</span>
                                        <span className={tile.value !== undefined ? "text-slate-700 font-semibold md:ml-2 dark:text-zinc-100" : "text-slate-400 font-semibold md:ml-2 dark:text-zinc-500"}>
                                            {tile.value !== undefined ? tile.value : "—"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <div className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <h3 className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Asset Distribution</h3>
                        </div>
                        <div className="p-4 bg-white dark:bg-zinc-900 space-y-4">
                            {DISTRIBUTION_ORDER.map((type) => {
                                const count = distributionByType.get(type) ?? 0;
                                return (
                                    <div key={type}>
                                        <div className="flex justify-between text-[13px] mb-1">
                                            <span className="text-slate-600 font-medium dark:text-zinc-300">{DISTRIBUTION_LABELS[type]}</span>
                                            <span className="text-slate-700 font-semibold dark:text-zinc-100">{count}</span>
                                        </div>
                                        <Progress value={(count / maxDistributionCount) * 100} className="h-2" />
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            </div>

            <ItAssetManagementSection />
        </div>
    );
}
