import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LoanAdminQueuePanel } from "@/components/gm/LoanAdminQueuePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import {
    TrendingUp,
    Users,
    DollarSign,
    CheckCircle2,
    Clock,
    AlertTriangle,
    BarChart3,
    PieChart,
    Activity,
    Target,
    Award,
    Zap,
    Check,
    X,
    LogOut,
    Search,
    ChevronRight,
    Filter,
    Send,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GmApprovalCard } from "@/components/gm-approval-card";

interface SuperHODStats {
    totalGMEntries: number;
    pendingHOD: number;
    pendingAccountManager: number;
    pendingSalesManager: number;
    pendingSuperHOD: number;
    approved: number;
    rejected: number;
    approvalRate: number;
    avgProcessingTime: string;
    totalRevenue: number;
    teamPerformance: {
        salesExecutives: number;
        accountManagers: number;
        salesManagers: number;
    };
}

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = value;
        const increment = end / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
                setCount(end);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [value, duration]);

    return <span>{count.toLocaleString()}</span>;
}

interface GMEntry {
    id: string;
    company_name?: string;
    companyName?: string;
    company?: string;
    drm_id?: string;
    drmId?: string;
    package_name?: string;
    packageName?: string;
    package?: string;
    order_dollar?: number;
    orderDollar?: number;
    member_id?: string;
    memberId?: string;
    type?: string;
    referenceId?: string;
    submittedByName?: string;
    source?: string;
    servicePerson?: string;
    dollarRate?: number | string;
    pkr?: number | string;
    extraDiscount?: number | string;
    alibabaDiscount?: number | string;
    totalDiscount?: number | string;
    status?: string;
    createdAt?: string;
    accountantStatus?: string;
    isPartial?: boolean | number;
    hodStatus?: string;
}

function PendingApprovalsList() {
    const { toast } = useToast();

    const { data: approvals, isLoading } = useQuery<{ data: GMEntry[]; meta: { total: number } }>({
        queryKey: ["/api/hod/approvals"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/hod/approvals?page=1&limit=10");
            const json = await response.json();

            // For GM entries, fetch additional details
            if (json.data && json.data.length > 0) {
                const gmEntries = json.data.filter((item: any) => item.source === 'gm_entries');
                if (gmEntries.length > 0) {
                    // Fetch GM entry details
                    const gmDetailsPromises = gmEntries.map(async (entry: any) => {
                        try {
                            const detailsResponse = await apiRequest("GET", `/api/gm-pool/${entry.referenceId}`);
                            const details = await detailsResponse.json();
                            return { ...entry, ...details.data };
                        } catch (error) {
                            console.error("Failed to fetch GM details:", error);
                            return entry;
                        }
                    });

                    const gmDetails = await Promise.all(gmDetailsPromises);

                    // Merge GM details back into the data array
                    json.data = json.data.map((item: any) => {
                        if (item.source === 'gm_entries') {
                            const details = gmDetails.find((d: any) => d.id === item.id);
                            return details || item;
                        }
                        return item;
                    });
                }
            }

            return json;
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiRequest("POST", `/api/hod/approvals/${id}/approve`, {});
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/hod/approvals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/super-stats"] });
            toast({
                title: "Success",
                description: "GM entry approved successfully",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to approve GM entry",
                variant: "destructive",
            });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiRequest("POST", `/api/hod/approvals/${id}/reject`, {});
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/hod/approvals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/super-stats"] });
            toast({
                title: "Success",
                description: "GM entry rejected",
            });
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to reject GM entry",
                variant: "destructive",
            });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!approvals?.data || approvals.data.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No pending approvals</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[400px]">
            <div className="space-y-3">
                {approvals.data.map((entry) => {
                    // Check if this is a GM entry
                    const isGMEntry = entry.source === 'gm_entries';

                    return (
                        <div
                            key={entry.id}
                            className="p-4 bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-200 hover:shadow-md transition-shadow dark:border-zinc-800"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {isGMEntry ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-800 text-lg dark:text-zinc-100">
                                                    {entry.companyName || entry.company_name || "Unknown Company"}
                                                </h3>
                                                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                                    GM Entry
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2 dark:text-zinc-300">
                                                DRM ID: <span className="font-mono font-medium">{entry.drmId || entry.drm_id || "N/A"}</span>
                                            </p>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div>
                                                    <span className="text-slate-500 dark:text-zinc-400">Amount:</span>{" "}
                                                    <span className="font-bold text-emerald-600">
                                                        ${(entry.orderDollar || entry.order_dollar || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 dark:text-zinc-400">Member:</span>{" "}
                                                    <span className="font-medium">{entry.memberId || entry.member_id || "N/A"}</span>
                                                </div>
                                                {(entry.packageName || entry.package_name) && (
                                                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                                        {entry.packageName || entry.package_name}
                                                    </Badge>
                                                )}
                                            </div>
                                            {entry.submittedByName && (
                                                <p className="text-xs text-slate-500 mt-2 dark:text-zinc-400">
                                                    Submitted by: {entry.submittedByName}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-slate-800 text-lg dark:text-zinc-100">
                                                    {entry.type || "Unknown Type"}
                                                </h3>
                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                                    {entry.source?.replace('_', ' ') || "Other"}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600 mb-2 dark:text-zinc-300">
                                                ID: <span className="font-mono font-medium">{entry.referenceId || entry.id}</span>
                                            </p>
                                            {entry.submittedByName && (
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">
                                                    Submitted by: {entry.submittedByName}
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => approveMutation.mutate(entry.id)}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                    >
                                        <Check className="h-4 w-4 mr-1" />
                                        Approve
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => rejectMutation.mutate(entry.id)}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                    >
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ScrollArea>
    );
}

function WithdrawalRequestsCard() {
    const { toast } = useToast();
    const { data, isLoading, refetch } = useQuery<{ entries: any[] }>({
        queryKey: ["/api/gm-pool/pending-withdrawals"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-pool/pending-withdrawals");
            return res.json();
        },
        refetchInterval: 30000,
    });

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/gm-pool/${id}/withdraw-approve`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Entry has been marked as Withdrawn." });
            refetch();
            queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
        },
        onError: () => toast({ title: "Error", description: "Failed to approve withdrawal", variant: "destructive" }),
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/gm-pool/${id}/withdraw-reject`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Rejected", description: "Withdrawal request has been rejected." });
            refetch();
        },
        onError: () => toast({ title: "Error", description: "Failed to reject withdrawal", variant: "destructive" }),
    });

    const entries = data?.entries || [];

    return (
        <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-amber-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LogOut className="h-5 w-5 text-amber-600" />
                    Withdrawal Requests
                    {entries.length > 0 && (
                        <span className="ml-2 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {entries.length}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                        <LogOut className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No pending withdrawal requests</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {entries.map((entry) => (
                            <div key={entry.id} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 truncate dark:text-zinc-100">
                                            {entry.company_name || "Unknown Company"}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5 dark:text-zinc-400">
                                            DRM: <span className="font-mono">{entry.drm_id || "—"}</span>
                                            {" · "}
                                            Member: <span className="font-medium">{entry.member_id || "—"}</span>
                                        </p>
                                        {entry.withdrawal_reason && (
                                            <p className="text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 mt-1">
                                                Reason: {entry.withdrawal_reason}
                                            </p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-1">
                                            Requested: {new Date(entry.withdrawal_requested_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={() => approveMutation.mutate(entry.id)}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                        >
                                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => rejectMutation.mutate(entry.id)}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                        >
                                            <X className="h-3.5 w-3.5 mr-1" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface ProjectDeadline {
    id: string;
    companyName: string;
    project: string;
    dep: string;
    deadlines: string;
    userName?: string;
    userAvatar?: string;
}

interface DailyReportEntry {
    id: string;
    name: string;
    company: string;
    project: string;
    free: string;
    task: string;
    status: string;
    run: string;
    spent: string;
    userAvatar?: string;
}

interface ImportantStats {
    delayProjects: number;
    upcoming: number;
    completed: number;
    inProgress: number;
    pending: number;
    qaVerification: number;
    leaveApplication: number;
    activeTeam: number;
    depVerification: number;
    abClosingReport: number;
    activetTeam: number;
    lateComing: number;
    commissionVerification: number;
    increment: number;
    rolesDetails: number;
    dailyAddedGMReport: number;
    activities: {
        totalProjects: number;
        complete: number;
        pending: number;
        delay: number;
        free: number;
    };
}

export default function SuperHODDashboard() {
    const [, setLocation] = useLocation();
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (selectedRequest) {
            setFormData({ ...selectedRequest });
        } else {
            setFormData(null);
        }
    }, [selectedRequest]);

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const endpoint = selectedRequest?.isGmApproval
                ? `/api/hod/verification/gms/${selectedRequest.id}/status`
                : `/api/hod/gm-pool/${selectedRequest.id}/super-hod-update`;

            const method = selectedRequest?.isGmApproval ? "POST" : "PATCH";

            // For GM Approval, the backend expects 'status' based on 'hodStatus'
            const payload = selectedRequest?.isGmApproval
                ? { ...data, status: data.hodStatus || 'Approved' }
                : data;

            const res = await apiRequest(method, endpoint, payload);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Request updated successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/super-hod-update-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/gms"] });
            if (selectedRequest?.isGmApproval) setSelectedRequest(null);
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to update request", variant: "destructive" });
        }
    });

    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/hod/gm-pool/${selectedRequest.id}/super-hod-approve`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Request approved successfully" });
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/super-hod-update-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/gms"] });
            if (selectedRequest?.isGmApproval) setSelectedRequest(null);
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to approve request", variant: "destructive" });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/hod/gm-pool/${selectedRequest.id}/super-hod-reject`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Rejected", description: "Request rejected" });
            setSelectedRequest(null);
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/super-hod-update-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hod/verification/gms"] });
            if (selectedRequest?.isGmApproval) setSelectedRequest(null);
        },
        onError: (err: any) => {
            toast({ title: "Error", description: err.message || "Failed to reject request", variant: "destructive" });
        }
    });

    const handleFieldChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        updateMutation.mutate(formData);
    };

    const [waitingPage, setWaitingPage] = useState(1);
    const [gmPage, setGmPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const [topSellingFilter, setTopSellingFilter] = useState("LD");
    const [dailyReportFilter, setDailyReportFilter] = useState("daily");
    const [projectDeadlineFilter, setProjectDeadlineFilter] = useState("WK");
    const [activitiesFilter, setActivitiesFilter] = useState("TD");

    const { data: stats, isLoading: statsLoading, isError: statsError, error: e1 } = useQuery<SuperHODStats>({
        queryKey: ["/api/hod/super-stats"],
        queryFn: async () => {
            const response = await apiRequest("GET", "/api/hod/super-stats");
            const json = await response.json();
            if (!response.ok) throw new Error(json.message || "Failed to load super stats");
            return json.data || {};
        },
    });

    const { data: importantStats, isLoading: importantLoading, isError: importantError, error: e2 } = useQuery<ImportantStats>({
        queryKey: ["/api/hod/dashboard/important-stats", topSellingFilter],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/dashboard/important-stats?period=${topSellingFilter}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load important stats");
            return json.data || { activities: {} };
        }
    });

    const { data: dailyReport, isLoading: dailyLoading, isError: dailyError, error: e3 } = useQuery<DailyReportEntry[]>({
        queryKey: ["/api/hod/daily-report", dailyReportFilter],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/daily-report?period=${dailyReportFilter}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load daily report");
            return json.data || [];
        }
    });

    // The server's date-range logic only distinguishes "LD" (30 days) from
    // everything else (7 days) — there's no separate TD/MO behavior, so both
    // map onto the 7-day bucket and only "MO" reaches the 30-day one.
    const projectDeadlineServerFilter = projectDeadlineFilter === "MO" ? "LD" : "WK";
    const { data: projectDeadlines, isLoading: deadlinesLoading, isError: deadlinesError, error: e4 } = useQuery<ProjectDeadline[]>({
        queryKey: ["/api/hod/dashboard/project-deadlines", projectDeadlineServerFilter],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/dashboard/project-deadlines?filter=${projectDeadlineServerFilter}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load project deadlines");
            return json.data || [];
        }
    });

    const { data: todayMeetings } = useQuery<{ items: any[] }>({
        queryKey: ["/api/dashboard/daily-team-meeting"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/dashboard/daily-team-meeting");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load today's meetings");
            return json.data || { items: [] };
        }
    });

    const { data: activitiesStats } = useQuery<ImportantStats>({
        queryKey: ["/api/hod/dashboard/important-stats", "activities", activitiesFilter],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/hod/dashboard/important-stats?period=${activitiesFilter}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load activities stats");
            return json.data || { activities: {} };
        }
    });

    const { data: waitingProjects, isError: waitingError, isLoading: waitingLoading, error: e5 } = useQuery<any[]>({
        queryKey: ["/api/hod/verification/waiting"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/verification/waiting");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load waiting projects");
            return json.data || [];
        }
    });

    const { data: leaveRequests, isError: leaveError, isLoading: leaveLoading, error: e6 } = useQuery<any[]>({
        queryKey: ["/api/hod/verification/leave-requests"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/verification/leave-requests");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load leave requests");
            return json.data || [];
        }
    });

    const { data: gmApprovals, isError: gmError, isLoading: gmLoading, error: e7 } = useQuery<any[]>({
        queryKey: ["/api/gm-pool/pending-super-hod"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-pool/pending-super-hod");
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || json.message || "Failed to load gm approvals");
            // The pending-super-hod endpoint returns { entries: [...] }
            return json.entries || [];
        }
    });

    const { data: updateRequests, isError: updateError, isLoading: updateLoading, error: e8 } = useQuery<any[]>({
        queryKey: ["/api/hod/verification/super-hod-update-requests"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/hod/verification/super-hod-update-requests");
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || "Failed to load update requests");
            return json.data || [];
        }
    });

    const { data: withdrawalData, isLoading: withdrawalLoading, refetch: refetchWithdrawals } = useQuery<{ entries: any[] }>({
        queryKey: ["/api/gm-pool/pending-withdrawals"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-pool/pending-withdrawals");
            return res.json();
        }
    });

    const approveWithdrawMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/gm-pool/${id}/withdraw-approve`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Approved", description: "Withdrawal has been approved." });
            refetchWithdrawals();
            queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
        },
        onError: () => toast({ title: "Error", description: "Failed to approve withdrawal", variant: "destructive" }),
    });

    const rejectWithdrawMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/gm-pool/${id}/withdraw-reject`, {});
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Rejected", description: "Withdrawal request has been rejected." });
            refetchWithdrawals();
        },
        onError: () => toast({ title: "Error", description: "Failed to reject withdrawal", variant: "destructive" }),
    });

    const withdrawalRequests = withdrawalData?.entries || [];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
        },
    };

    const isLoading = statsLoading || importantLoading || dailyLoading || deadlinesLoading || waitingLoading || leaveLoading || gmLoading || updateLoading;
    const isError = statsError || importantError || dailyError || deadlinesError || waitingError || leaveError || gmError || updateError;

    if (isError) {
        const errorDetails = [e1, e2, e3, e4, e5, e6, e7, e8]
            .filter(e => e)
            .map(e => e?.message)
            .join(", ");
        console.error("Dashboard data failed to load:", errorDetails);
        // Continue rendering gracefully with fallbacks instead of blocking the UI
    }

    return (
        <>
            <div className="flex-1 bg-[#F8FAFC] min-h-screen dark:bg-zinc-950">
                {/* Header / Breadcrumb */}
                <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <motion.div
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span className="font-bold text-slate-800 tracking-tight text-[11px] dark:text-zinc-100">DASHBOARD</span>
                        <span className="text-slate-300">/</span>
                        <span className="font-bold text-emerald-600 tracking-tight text-[11px]">HEAD OF DEPARTMENT</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-500 font-medium text-[11px] dark:text-zinc-400">SUPER HOD</span>
                    </motion.div>
                </div>

                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="flex gap-6 p-6"
                >
                    {/* Main Content Area (75%) */}
                    <div className="flex-1 max-w-[calc(100%-340px)] space-y-6">
                        {/* Top Selling Section */}
                        <motion.div variants={itemVariants} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Top Selling</h2>
                                <Select value={topSellingFilter} onValueChange={setTopSellingFilter}>
                                    <SelectTrigger className="w-[80px] h-8 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="LD" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LD">LD</SelectItem>
                                        <SelectItem value="WK">WK</SelectItem>
                                        <SelectItem value="MH">MH</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                {[
                                    { title: "Total Project", value: importantStats?.activities?.totalProjects || 0, icon: Users, color: "emerald" },
                                    { title: "Verification", value: importantStats?.qaVerification || 0, icon: TrendingUp, color: "emerald" },
                                    { title: "Data Pending", value: importantStats?.pending || 0, icon: Filter, color: "emerald" },
                                    { title: "Free", value: importantStats?.activities?.free || 0, icon: Target, color: "emerald" },
                                ].map((stat, idx) => (
                                    <Card key={idx} className="border-none shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-0">
                                            <div className="p-4 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.title}</p>
                                                    <p className="text-2xl font-bold text-slate-800 group-hover:text-emerald-600 transition-colors dark:text-zinc-100">{stat.value.toLocaleString()}</p>
                                                </div>
                                                <div className="h-11 w-11 rounded-full bg-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(5,150,105,0.3)]">
                                                    <stat.icon className="h-5 w-5 text-white" />
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </motion.div>

                        {/* Patch 5 Stage 3: Loan admin approval queue + return tracking */}
                        <motion.div variants={itemVariants}>
                            <LoanAdminQueuePanel />
                        </motion.div>

                        {/* Verification Of Project Section */}
                        <motion.div variants={itemVariants} id="verification-of-project">
                            <Card className="border-none shadow-sm overflow-hidden">
                                <CardHeader className="pb-0 pt-4 px-6 bg-white dark:bg-zinc-900">
                                    <Tabs defaultValue="gm-approval" className="w-full">
                                        <div className="flex items-center justify-between mb-4">
                                            <CardTitle className="text-base font-bold text-slate-800 dark:text-zinc-100">Verification Of Project</CardTitle>
                                            <TabsList className="bg-transparent h-auto p-0 gap-4">
                                                {[
                                                    { label: 'Waiting', key: 'waiting', count: waitingProjects?.length || 0 },
                                                    { label: 'Leave Form', key: 'leave-form', count: leaveRequests?.length || 0 },
                                                    { label: 'Gm Approval', key: 'gm-approval', count: gmApprovals?.length || 0 },
                                                    { label: 'Update Request', key: 'update-request', count: updateRequests?.length || 0 },
                                                    { label: 'Withdraw Request', key: 'withdraw-request', count: withdrawalRequests?.length || 0 }
                                                ].map((tab) => (
                                                    <TabsTrigger
                                                        key={tab.key}
                                                        value={tab.key}
                                                        className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg px-4 py-2 rounded-md text-sm font-semibold border border-slate-200 bg-white text-slate-600 transition-all relative flex items-center gap-2 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800"
                                                    >
                                                        {tab.label}
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab.key === 'update-request' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 dark:text-slate-300'}`}>
                                                            {tab.count}
                                                        </span>
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </div>

                                        <div className="bg-[#F1F5F9] rounded-lg p-1 min-h-[300px] mb-4 dark:bg-zinc-900">
                                            <TabsContent value="waiting" className="m-0">
                                                <Table>
                                                    <TableHeader><TableRow className="border-none hover:bg-transparent"><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">No#</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Company</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Drm Id</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Created By</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Status</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 text-right dark:text-zinc-300">Date</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {waitingProjects?.length === 0 ? (
                                                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400 font-medium">No waiting projects</TableCell></TableRow>
                                                        ) : (() => {
                                                            const data = waitingProjects || [];
                                                            const paginated = data.slice((waitingPage - 1) * ITEMS_PER_PAGE, waitingPage * ITEMS_PER_PAGE);
                                                            return paginated.map((row, i) => (
                                                                <TableRow key={row.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                                    <TableCell className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{(waitingPage - 1) * ITEMS_PER_PAGE + i + 1}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.companyName}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.drmId}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.createdByName}</TableCell>
                                                                    <TableCell><Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-100 uppercase">{row.status}</Badge></TableCell>
                                                                    <TableCell className="text-xs text-slate-500 text-right dark:text-zinc-400">{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                                                                </TableRow>
                                                            ));
                                                        })()}
                                                    </TableBody>
                                                </Table>
                                                
                                                {/* Pagination for Waiting */}
                                                {waitingProjects && waitingProjects.length > ITEMS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 px-2 text-sm text-slate-500">
                                                        <div>
                                                            Showing {(waitingPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(waitingPage * ITEMS_PER_PAGE, waitingProjects.length)} of {waitingProjects.length} entries
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => setWaitingPage(p => Math.max(1, p - 1))} disabled={waitingPage === 1}>Prev</Button>
                                                            <div className="flex items-center px-2 font-medium">Page {waitingPage} of {Math.ceil(waitingProjects.length / ITEMS_PER_PAGE)}</div>
                                                            <Button variant="outline" size="sm" onClick={() => setWaitingPage(p => Math.min(Math.ceil(waitingProjects.length / ITEMS_PER_PAGE), p + 1))} disabled={waitingPage === Math.ceil(waitingProjects.length / ITEMS_PER_PAGE)}>Next</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="leave-form" className="m-0">
                                                <Table>
                                                    <TableHeader><TableRow className="border-none hover:bg-transparent"><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">No#</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">User</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Type</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 dark:text-zinc-300">Duration</TableHead><TableHead className="text-[11px] font-bold text-slate-600 uppercase py-4 text-right dark:text-zinc-300">Status</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {leaveRequests?.length === 0 ? (
                                                            <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400 font-medium">No leave requests</TableCell></TableRow>
                                                        ) : leaveRequests?.map((row, i) => (
                                                            <TableRow key={row.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                                <TableCell className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{i + 1}</TableCell>
                                                                <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.userName}</TableCell>
                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.type}</TableCell>
                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{new Date(row.fromDate).toLocaleDateString()} - {new Date(row.toDate).toLocaleDateString()}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge className={cn(
                                                                        "text-[10px]",
                                                                        row.status === "Approved" ? "bg-emerald-500 hover:bg-emerald-600" :
                                                                        row.status === "Rejected" ? "bg-red-500 hover:bg-red-600" :
                                                                        "bg-amber-500 hover:bg-amber-600"
                                                                    )}>{(row.status || "Pending").toUpperCase()}</Badge>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TabsContent>

                                            <TabsContent value="gm-approval" className="m-0">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader><TableRow className="border-none hover:bg-transparent">{['No#', 'Drm Id', 'Company', 'Sale Person', 'Service Person', 'Package', 'Type', 'Dollar', 'Dollar Rate', 'Pkr', 'Extra Discount', 'Total Discount', 'Status', 'Create Date', 'HOD Date', 'Last Updation Date', 'Accountant', 'Webxl Behalf', 'Approved By HOD', 'Action'].map((head) => (
                                                            <TableHead key={head} className="text-[11px] font-bold text-slate-600 uppercase tracking-tight py-4 whitespace-nowrap dark:text-zinc-300">{head}</TableHead>
                                                        ))}</TableRow></TableHeader>
                                                        <TableBody>
                                                            {gmApprovals?.length === 0 ? (
                                                                <TableRow><TableCell colSpan={20} className="text-center py-12 text-slate-400 font-medium">No pending GM approvals</TableCell></TableRow>
                                                            ) : (() => {
                                                                const data = gmApprovals || [];
                                                                const paginated = data.slice((gmPage - 1) * ITEMS_PER_PAGE, gmPage * ITEMS_PER_PAGE);
                                                                return paginated.map((row, idx) => {
                                                                    const extraDisc = parseFloat(row.extraDiscount?.toString() || "0");
                                                                    const alibabaDisc = parseFloat(row.alibabaDiscount?.toString() || "0");
                                                                    const totalDisc = extraDisc + alibabaDisc;

                                                                    return (
                                                                            <TableRow key={row.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                                                <TableCell className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{(gmPage - 1) * ITEMS_PER_PAGE + idx + 1}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.drm_id || row.drmId}</TableCell>
                                                                                <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.company_name || row.company}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.sales_person_name || row.salePerson}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.added_by_name || row.servicePerson || "-"}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.package_type || row.package}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.entry_type || row.type}</TableCell>
                                                                                <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">${row.amount_usd ?? row.orderDollar}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.dollar_rate || row.dollarRate}</TableCell>
                                                                                <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.amount_pkr ?? row.pkr}</TableCell>
                                                                            <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">${Math.round(extraDisc)}</TableCell>
                                                                            <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">${Math.round(totalDisc)}</TableCell>
                                                                            <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100 uppercase">{row.status}</Badge></TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.created_at || row.createdAt ? format(new Date(row.created_at || row.createdAt), "dd/MM/yyyy HH:mm:ss a") : "-"}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.hod_approved_at || row.hodApprovedAt || row.approved_at || row.approvedAt ? format(new Date(row.hod_approved_at || row.hodApprovedAt || row.approved_at || row.approvedAt), "dd/MM/yyyy HH:mm:ss a") : "N/A"}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.updated_at || row.updatedAt ? format(new Date(row.updated_at || row.updatedAt), "dd/MM/yyyy HH:mm:ss a") : "-"}</TableCell>
                                                                                <TableCell><Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-100 uppercase dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800">{row.accountant_status || row.accountantStatus || "Pending"}</Badge></TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.is_partial_payment || row.isPartial ? "Partial GM" : "Full GM"}</TableCell>
                                                                                <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.hod_status || row.hodStatus || "N/A"}</TableCell>
                                                                            <TableCell>
                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => {
                                                                                    setSelectedRequest({ ...row, companyName: row.company, isGmApproval: true });
                                                                                    setIsModalOpen(true);
                                                                                    setFormData({
                                                                                        status: row.status,
                                                                                        installments: row.installments || [],
                                                                                        extraDiscountHod: row.extraDiscount || 0,
                                                                                        dollarRate: row.dollarRate,
                                                                                        pkr: row.pkr,
                                                                                        orderDollar: row.orderDollar,
                                                                                        customerDollar: row.customerDollar,
                                                                                        notes: "",
                                                                                        accountType: row.type || "New"
                                                                                    });
                                                                                }}>
                                                                                    <ChevronRight className="h-4 w-4" />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                });
                                                            })()}
                                                        </TableBody>
                                                    </Table>
                                                </div>

                                                {/* Pagination for GM Approval */}
                                                {gmApprovals && gmApprovals.length > ITEMS_PER_PAGE && (
                                                    <div className="flex items-center justify-between pt-4 px-2 text-sm text-slate-500">
                                                        <div>
                                                            Showing {(gmPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(gmPage * ITEMS_PER_PAGE, gmApprovals.length)} of {gmApprovals.length} entries
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button variant="outline" size="sm" onClick={() => setGmPage(p => Math.max(1, p - 1))} disabled={gmPage === 1}>Prev</Button>
                                                            <div className="flex items-center px-2 font-medium">Page {gmPage} of {Math.ceil(gmApprovals.length / ITEMS_PER_PAGE)}</div>
                                                            <Button variant="outline" size="sm" onClick={() => setGmPage(p => Math.min(Math.ceil(gmApprovals.length / ITEMS_PER_PAGE), p + 1))} disabled={gmPage === Math.ceil(gmApprovals.length / ITEMS_PER_PAGE)}>Next</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </TabsContent>

                                            <TabsContent value="update-request" className="m-0">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="border-none hover:bg-transparent">
                                                                {['No#', 'Drm Id', 'Company', 'Sale Person', 'Package', 'Type', 'Dollar', 'Dollar Rate', 'Pkr', 'Discount', 'Extra Discount', 'Total Discount', 'Status', 'Create', 'Accountant', 'Action'].map((head) => (
                                                                    <TableHead key={head} className="text-[11px] font-bold text-slate-600 uppercase tracking-tight py-4 whitespace-nowrap dark:text-zinc-300">{head}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {updateRequests?.length === 0 ? (
                                                                <TableRow><TableCell colSpan={16} className="text-center py-12 text-slate-400 font-medium">No update requests</TableCell></TableRow>
                                                            ) : updateRequests?.map((row, idx) => (
                                                                <TableRow key={row.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                                    <TableCell className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.drmId}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.companyName}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.salePerson}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.package}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.type}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">${row.orderDollar}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.dollarRate}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.pkr != null ? Math.round(Number(row.pkr)) : "-"}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.discount}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.extraDiscount != null ? Math.round(Number(row.extraDiscount)) : "-"}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.totalDiscount}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-100 uppercase whitespace-nowrap">{row.status}</Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-[10px] font-medium text-slate-500 whitespace-nowrap dark:text-zinc-400">
                                                                        {new Date(row.createdAt).toLocaleString('en-GB', {
                                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                                            hour12: true
                                                                        }).replace(',', '')}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-100 uppercase">{row.accountantStatus}</Badge>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                            onClick={() => setSelectedRequest(row)}
                                                                        >
                                                                            <Send className="h-4 w-4 rotate-[315deg]" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="withdraw-request" className="m-0">
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="border-none hover:bg-transparent">
                                                                {['No#', 'Drm Id', 'Company', 'Member ID', 'Order ID', 'Reason', 'Date', 'Action'].map((head) => (
                                                                    <TableHead key={head} className="text-[11px] font-bold text-slate-600 uppercase tracking-tight py-4 whitespace-nowrap dark:text-zinc-300">{head}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {withdrawalRequests.length === 0 ? (
                                                                <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400 font-medium">No withdrawal requests</TableCell></TableRow>
                                                            ) : withdrawalRequests.map((row, idx) => (
                                                                <TableRow key={row.id} className="bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                                    <TableCell className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{idx + 1}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.drm_id}</TableCell>
                                                                    <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.company_name}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.member_id}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.order_id}</TableCell>
                                                                    <TableCell className="text-xs font-medium text-slate-600 dark:text-zinc-300">{row.withdrawal_reason || '—'}</TableCell>
                                                                    <TableCell className="text-xs text-slate-500 whitespace-nowrap dark:text-zinc-400">
                                                                        {new Date(row.withdrawal_requested_at).toLocaleString()}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]"
                                                                                onClick={() => approveWithdrawMutation.mutate(row.id)}
                                                                                disabled={approveWithdrawMutation.isPending || rejectWithdrawMutation.isPending}
                                                                            >
                                                                                Approve
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="destructive"
                                                                                className="h-7 text-[10px]"
                                                                                onClick={() => rejectWithdrawMutation.mutate(row.id)}
                                                                                disabled={approveWithdrawMutation.isPending || rejectWithdrawMutation.isPending}
                                                                            >
                                                                                Reject
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </TabsContent>
                                        </div>
                                    </Tabs>
                                </CardHeader>
                            </Card>
                        </motion.div>

                        {/* Daily Report Section */}
                        <motion.div variants={itemVariants} className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Daily Report</h2>
                                <Select value={dailyReportFilter} onValueChange={setDailyReportFilter}>
                                    <SelectTrigger className="w-[140px] h-8 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="Daily Report" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily Report</SelectItem>
                                        <SelectItem value="weekly">Weekly Report</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Card className="border-none shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-white dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent">
                                            {['Name', 'Company', 'Project', 'Free', 'Task', 'Status', 'Spent'].map((head) => (
                                                <TableHead key={head} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-4">{head}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dailyReport?.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400 font-medium">No reports today</TableCell></TableRow>
                                        ) : dailyReport?.map((row) => (
                                            <TableRow key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${row.name}`} />
                                                            <AvatarFallback>{row.name?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium text-slate-500 dark:text-zinc-400">{row.company}</TableCell>
                                                <TableCell className="text-xs font-medium text-slate-800 dark:text-zinc-100">{row.project}</TableCell>
                                                <TableCell className="text-xs font-bold text-slate-400">{row.free}</TableCell>
                                                <TableCell className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.task}</TableCell>
                                                <TableCell>
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded bg-${row.status === 'Pending' ? 'amber-50 text-amber-600' : 'emerald-50 text-emerald-600'} uppercase font-mono`}>
                                                        {row.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400">{row.spent}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </motion.div>

                        {/* Project Deadline Section */}
                        <motion.div variants={itemVariants} className="space-y-4 pb-10">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Project Deadline</h2>
                                <Select value={projectDeadlineFilter} onValueChange={setProjectDeadlineFilter}>
                                    <SelectTrigger className="w-[80px] h-8 bg-white border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="WK" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TD">TD</SelectItem>
                                        <SelectItem value="WK">WK</SelectItem>
                                        <SelectItem value="MO">MO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Card className="border-none shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-white dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent">
                                            {['Name', 'Company', 'Project', 'Dep', 'Deadlines'].map((head) => (
                                                <TableHead key={head} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-4">{head}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {projectDeadlines?.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400 font-medium">No deadlines found</TableCell></TableRow>
                                        ) : projectDeadlines?.map((row) => (
                                            <TableRow key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${row.userName}`} />
                                                            <AvatarFallback>{row.userName?.[0]}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">{row.userName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium text-slate-500 uppercase tracking-tight dark:text-zinc-400">{row.companyName}</TableCell>
                                                <TableCell className="text-xs font-medium text-slate-800 dark:text-zinc-100">{row.project}</TableCell>
                                                <TableCell className="text-xs font-bold text-[#6366F1] bg-[#6366F1]/5 px-2 py-0.5 rounded tracking-tight">{row.dep}</TableCell>
                                                <TableCell className="text-xs font-medium text-slate-300 bg-slate-50 px-2.5 py-1 rounded dark:bg-zinc-900">{row.deadlines}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Right Sidebar (25%) */}
                    <motion.div variants={itemVariants} className="w-[320px] space-y-6">
                        {/* Promotion Baners */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-slate-800 tracking-tight dark:text-zinc-100">Promotion Baners</h2>
                            <Card className="border-none shadow-sm overflow-hidden relative group">
                                <div className="aspect-[16/7] bg-emerald-50 flex items-center justify-center">
                                    <img
                                        src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400"
                                        alt="Promotion"
                                        className="object-cover w-full h-full opacity-80 group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            </Card>
                        </div>

                        {/* Today Meeting */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-slate-800 tracking-tight dark:text-zinc-100">Today Meeting</h2>
                            <Card className="border-none shadow-sm overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="h-7 text-[10px] font-bold text-slate-500 uppercase py-2 pl-4 dark:text-zinc-400">Person</TableHead>
                                            <TableHead className="h-7 text-[10px] font-bold text-slate-500 uppercase py-2 dark:text-zinc-400">Detail</TableHead>
                                            <TableHead className="h-7 text-[10px] font-bold text-slate-500 uppercase py-2 text-right pr-4 dark:text-zinc-400">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(todayMeetings?.items?.length ?? 0) === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-6 text-[11px] text-slate-400 font-medium">No meetings scheduled today</TableCell>
                                            </TableRow>
                                        ) : (
                                            todayMeetings!.items.map((m) => (
                                                <TableRow key={m.id} className="hover:bg-transparent border-none">
                                                    <TableCell className="text-[11px] font-semibold text-slate-700 py-2 pl-4 dark:text-zinc-300">{m.userName}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 py-2 dark:text-zinc-400">{m.notes || "-"}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-500 py-2 text-right pr-4 dark:text-zinc-400">
                                                        {m.startsAt ? new Date(m.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>

                        {/* Important Stats List */}
                        <div className="bg-white rounded-lg border shadow-sm p-4 text-left cursor-default mb-2 dark:bg-zinc-900">
                            <h2 className="text-[15px] font-bold text-gray-800 mb-4 dark:text-zinc-100">Important</h2>
                            <div className="space-y-4">
                                {[
                                    { label: "Delay Projects", value: importantStats?.delayProjects || 0, nav: "/projects?status=delayed" },
                                    { label: "Upcoming", value: importantStats?.upcoming || 0, nav: "/projects/upcoming" },
                                    { label: "Completed", value: importantStats?.completed || 0, nav: "/projects?status=completed" },
                                    { label: "Qa Verification", value: importantStats?.qaVerification || 0, nav: "/projects?status=qa-verification" },
                                    { label: "Leave Application", value: importantStats?.leaveApplication || 0, nav: "/leave-management", hasArrow: true },
                                    { label: "Loan Application", value: 0, nav: "/hr/loan", hasArrow: true },
                                    { label: "Add Penalty", value: 0, nav: "/drm/add-penalty", hasArrow: true },
                                    { label: "Sale & Service Report", value: 0, nav: "/reports", hasArrow: true },
                                    { label: "Update Sale And Service", value: 0, nav: "/reports", hasArrow: true },
                                    { label: "Annual Leaves Reports", value: 0, nav: "/reports", hasArrow: true },
                                    { label: "Ab Closing Report", value: 0, nav: "/account/ab-report", hasArrow: true },
                                    { label: "In Progress", value: importantStats?.inProgress || 0, nav: "/projects?status=in-progress" },
                                    { label: "Pending", value: importantStats?.pending || 0, nav: "/projects?status=pending" },
                                    { label: "Dep Verification", value: importantStats?.depVerification || 0, nav: "scroll:verification-of-project", hasArrow: true },
                                    { label: "Activet Team", value: importantStats?.activeTeam || 0, nav: "/users" },
                                    { label: "Late Coming", value: 0, nav: "/drm/late-coming", hasArrow: true },
                                    { label: "Commission Verification", value: 0, nav: "/drm/commission-verification", hasArrow: true },
                                    { label: "Increment", value: 0, nav: "/drm/increment", hasArrow: true },
                                    { label: "Roles Details", value: 0, nav: "/users", hasArrow: true },
                                    { label: "Daily Added GM Report", value: 0, nav: "/reports", hasArrow: true },
                                ].map((stat, rowIndex) => (
                                    <div
                                      key={rowIndex}
                                      onClick={() => {
                                        if (!stat.nav || stat.nav === "#") return;
                                        if (stat.nav.startsWith("scroll:")) {
                                            document.getElementById(stat.nav.slice("scroll:".length))?.scrollIntoView({ behavior: "smooth", block: "start" });
                                            return;
                                        }
                                        setLocation(stat.nav);
                                      }}
                                      className="flex flex-1 justify-between items-center py-1.5 border-b border-gray-100 last:border-0 hover:opacity-80 transition-opacity cursor-pointer dark:border-zinc-800"
                                    >
                                        <span className="text-gray-600 font-medium text-[13px] dark:text-zinc-300">{stat.label}</span>
                                        <span className={`font-bold text-[13px] ${stat.hasArrow ? "text-blue-600" : "text-gray-900"}`}>{stat.hasArrow ? ">" : stat.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Activities Progress Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-800 tracking-tight dark:text-zinc-100">Activities</h2>
                                <Select value={activitiesFilter} onValueChange={setActivitiesFilter}>
                                    <SelectTrigger className="w-[60px] h-7 bg-white border-slate-200 text-[10px] font-bold dark:bg-zinc-900 dark:border-zinc-800">
                                        <SelectValue placeholder="TD" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TD">TD</SelectItem>
                                        <SelectItem value="WK">WK</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { label: "Total Project", value: activitiesStats?.activities?.totalProjects || 0, color: "bg-emerald-500" },
                                    { label: "Completed", value: activitiesStats?.activities?.complete || 0, color: "bg-blue-500" },
                                    { label: "Pending", value: activitiesStats?.activities?.pending || 0, color: "bg-amber-500" },
                                    { label: "Delay", value: activitiesStats?.activities?.delay || 0, color: "bg-red-500" },
                                    { label: "Free", value: activitiesStats?.activities?.free || 0, color: "bg-slate-400" },
                                ].map((activity, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-tight">
                                            <span className="text-slate-500 dark:text-zinc-400">{activity.label}</span>
                                            <span className="text-slate-700 dark:text-zinc-400">{activity.value}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-1000", activity.color)}
                                                style={{ width: `${(activity.value / (activitiesStats?.activities?.totalProjects || 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>


            {/* Gm Update Request / GM Approval Modal */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-6xl bg-white p-0 overflow-hidden border-none shadow-2xl rounded-2xl dark:bg-zinc-900">
                    <DialogHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between dark:border-zinc-800">
                        <DialogTitle className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                            {selectedRequest?.isGmApproval ? "HOD Approval Details" : "Gm Update Request"}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedRequest?.isGmApproval ? (
                        <div className="p-8 overflow-y-auto max-h-[85vh]">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                {/* Row 1 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Company ID</Label>
                                    <Input value={selectedRequest?.drmId || ""} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Company Name</Label>
                                    <Input value={selectedRequest?.companyName || ""} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Member ID</Label>
                                    <Input value={selectedRequest?.memberId || ""} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Order ID</Label>
                                    <Input value={selectedRequest?.id || ""} readOnly className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>

                                {/* Row 3 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Package</Label>
                                    <Select value={formData?.packageName || selectedRequest?.package || ""} onValueChange={(val) => handleFieldChange('packageName', val)}>
                                        <SelectTrigger className="h-10 text-xs font-semibold border-slate-200 bg-slate-50 text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Basic Plus">Basic Plus</SelectItem>
                                            <SelectItem value="Premium">Premium</SelectItem>
                                            <SelectItem value="Gold">Gold</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Package Price</Label>
                                    <Input
                                        value={formData?.packagePrice || ""}
                                        onChange={(e) => handleFieldChange('packagePrice', e.target.value)}
                                        className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Type</Label>
                                    <Select value={formData?.accountType || "New"} onValueChange={(val) => handleFieldChange('accountType', val)}>
                                        <SelectTrigger className="h-10 text-xs font-semibold border-slate-200 text-slate-700 dark:border-zinc-800 dark:text-zinc-400">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="New">New</SelectItem>
                                            <SelectItem value="Renewal">Renewal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Row 4 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Customer PKR</Label>
                                    <Input
                                        value={formData?.pkr || ""}
                                        onChange={(e) => handleFieldChange('pkr', e.target.value)}
                                        className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Order Dollar</Label>
                                    <Input
                                        value={formData?.orderDollar || ""}
                                        onChange={(e) => handleFieldChange('orderDollar', e.target.value)}
                                        className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Dollar Rate $</Label>
                                    <Input
                                        value={formData?.dollarRate || ""}
                                        onChange={(e) => handleFieldChange('dollarRate', e.target.value)}
                                        className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>

                                {/* Row 5 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Customer Dollar $</Label>
                                    <Input
                                        value={(() => {
                                            const pkr = parseFloat(formData?.pkr || "0");
                                            const rate = parseFloat(formData?.dollarRate || "1");
                                            return (pkr / (rate || 1)).toFixed(2);
                                        })()}
                                        readOnly
                                        className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Alibaba Discount $</Label>
                                    <Input
                                        value={formData?.alibabaDiscount || "0"}
                                        onChange={(e) => handleFieldChange('alibabaDiscount', e.target.value)}
                                        className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Extra Discount $</Label>
                                    <Input
                                        value={formData?.extraDiscountHod || "0"}
                                        onChange={(e) => handleFieldChange('extraDiscountHod', e.target.value)}
                                        className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>

                                {/* Row 6 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Extra Discount PKR</Label>
                                    <Input
                                        value={(() => {
                                            const extra = parseFloat(formData?.extraDiscountHod || "0");
                                            const rate = parseFloat(formData?.dollarRate || "0");
                                            return (extra * rate).toFixed(2);
                                        })()}
                                        readOnly
                                        className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Total Discount</Label>
                                    <Input
                                        value={(() => {
                                            const extra = parseFloat(formData?.extraDiscountHod || "0");
                                            const alibaba = parseFloat(formData?.alibabaDiscount || "0");
                                            return (extra + alibaba).toFixed(2);
                                        })()}
                                        readOnly
                                        className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                    />
                                </div>

                                {/* Row 7 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Status</Label>
                                    <Input value={selectedRequest?.status || "Customer Paid"} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Accountant</Label>
                                    <Input value={selectedRequest?.accountantStatus || "Pending"} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>

                                {/* Row 8 */}
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Create Date</Label>
                                    <Input value={selectedRequest?.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : ""} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Approval</Label>
                                    <Select value={formData?.hodStatus || "Choose..."} onValueChange={(val) => handleFieldChange('hodStatus', val)}>
                                        <SelectTrigger className="h-10 text-xs font-semibold border-slate-200 text-slate-700 dark:border-zinc-800 dark:text-zinc-400">
                                            <SelectValue placeholder="Choose..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Approved">Approved</SelectItem>
                                            <SelectItem value="Rejected">Rejected</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Snapshot */}
                                <div className="md:col-span-3 space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Snapshot</Label>
                                    <div className="h-8 flex items-center px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-400 italic dark:bg-zinc-900 dark:border-zinc-800">No snapshot available</div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedRequest(null)}
                                    className="h-10 px-6 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50 rounded-lg dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800"
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={updateMutation.isPending}
                                    className="h-10 px-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 rounded-lg transition-all"
                                >
                                    {updateMutation.isPending ? "Saving..." : "Save"}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-[80vh]">
                            {/* Main Form Area */}
                            <div className="flex-1 p-8 overflow-y-auto">
                                <div className="grid grid-cols-3 gap-6">
                                    {/* Row 1 */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Name</Label>
                                        <Input value={formData?.companyName || ""} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Member Id</Label>
                                        <Input
                                            value={formData?.drmId || ""}
                                            onChange={(e) => handleFieldChange('drmId', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Order Id</Label>
                                        <Input
                                            value={formData?.orderId || ""}
                                            onChange={(e) => handleFieldChange('orderId', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>

                                    {/* Row 2 */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Customer Dollar</Label>
                                        <Input
                                            value={formData?.customerDollar || ""}
                                            readOnly
                                            className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Customer PKR</Label>
                                        <Input
                                            value={formData?.pkr || ""}
                                            readOnly
                                            className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Dollar Rate</Label>
                                        <Input
                                            value={formData?.dollarRate || ""}
                                            onChange={(e) => handleFieldChange('dollarRate', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>

                                    {/* Row 3 */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Order Dollar</Label>
                                        <Input
                                            value={formData?.orderDollar || ""}
                                            onChange={(e) => handleFieldChange('orderDollar', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Package</Label>
                                        <Select value={formData?.package || ""} onValueChange={(val) => handleFieldChange('package', val)}>
                                            <SelectTrigger className="h-10 text-xs font-semibold border-slate-200 text-slate-700 dark:border-zinc-800 dark:text-zinc-400">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Basic">Basic</SelectItem>
                                                <SelectItem value="Premium">Premium</SelectItem>
                                                <SelectItem value="Gold">Gold</SelectItem>
                                                <SelectItem value="Standard">Standard</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Entry Type</Label>
                                        <Input
                                            value={formData?.entryType || ""}
                                            onChange={(e) => handleFieldChange('entryType', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>

                                    {/* Row 4 */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Alibaba Discount</Label>
                                        <Input
                                            value={formData?.abDiscount || ""}
                                            onChange={(e) => handleFieldChange('abDiscount', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">$ Extra Discount</Label>
                                        <Input
                                            value={formData?.extraDiscount || ""}
                                            onChange={(e) => handleFieldChange('extraDiscount', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Extra Pkr Discount</Label>
                                        <Input
                                            value={formData?.extraPkrDiscount || ""}
                                            onChange={(e) => handleFieldChange('extraPkrDiscount', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>

                                    {/* Row 5 */}
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Extra Discount Hod</Label>
                                        <Input
                                            value={formData?.extraDiscountHod || ""}
                                            onChange={(e) => handleFieldChange('extraDiscountHod', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Request Status</Label>
                                        <Input value={formData?.updateRequestStatus || "Pending"} readOnly className="bg-slate-50 border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Account Type</Label>
                                        <Input
                                            value={formData?.accountType || "Normal"}
                                            onChange={(e) => handleFieldChange('accountType', e.target.value)}
                                            className="bg-white border-slate-200 h-10 text-xs font-semibold text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        />
                                    </div>
                                </div>

                                {/* Comment / Notes */}
                                <div className="mt-8 space-y-2">
                                    <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Notes / Reason</Label>
                                    <Textarea
                                        value={formData?.notes || ""}
                                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                                        className="min-h-[100px] bg-white border-slate-200 text-xs font-medium text-slate-700 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                                        placeholder="Enter update notes or reason here..."
                                    />
                                </div>

                                {/* Actions */}
                                <div className="mt-12 flex justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedRequest(null)}
                                        className="h-11 px-6 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        disabled={updateMutation.isPending}
                                        className="h-11 px-8 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-100 rounded-xl transition-all"
                                    >
                                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                    </Button>
                                    <div className="w-px h-8 bg-slate-100 mx-1 self-center dark:bg-zinc-900" />
                                    <Button
                                        onClick={() => rejectMutation.mutate()}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                        variant="outline"
                                        className="h-11 px-6 text-xs font-bold text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 rounded-xl"
                                    >
                                        {rejectMutation.isPending ? "Rejecting..." : "Reject Request"}
                                    </Button>
                                    <Button
                                        onClick={() => approveMutation.mutate()}
                                        disabled={approveMutation.isPending || rejectMutation.isPending}
                                        className="h-11 px-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 rounded-xl transition-all"
                                    >
                                        <Check className="h-4 w-4 mr-2" />
                                        {approveMutation.isPending ? "Approving..." : "Approve Update"}
                                    </Button>
                                </div>
                            </div>

                            {/* Sidebar Info */}
                            <div className="w-[320px] bg-slate-50/70 border-l border-slate-100 p-8 space-y-6 dark:border-zinc-800">
                                <div className="space-y-3">
                                    <h3 className="text-sm font-black text-red-500 tracking-tight flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Changing Required
                                    </h3>
                                    <div className="bg-slate-200/50 p-2 px-3 rounded text-[10px] font-black text-slate-500 inline-block uppercase tracking-tighter dark:text-zinc-400">
                                        Requested By: <span className="ml-1 text-slate-600 dark:text-zinc-300">{formData?.requestedBy || "N/A"}</span>
                                    </div>
                                </div>
                                <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                    <p className="text-[12px] text-slate-600 font-bold leading-relaxed italic opacity-90 dark:text-zinc-300">
                                        "{formData?.notes || "No additional notes provided for this update request."}"
                                    </p>
                                </div>

                                <div className="pt-8 opacity-40">
                                    <div className="h-px bg-slate-200 w-full mb-4"></div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">WebExcels DRM System v1.0</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </>
    );
}
