"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/legacy/card";
import { Button } from "@/components/ui/button";
import { DrmFormActions, DrmSection } from "@/modules/drm/drm-ui";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Send, X, Zap, Hand, Lock, History, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/legacy/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/legacy/switch";
import { format } from "date-fns";
import { useToast } from "@/lib/hooks/use-legacy-toast";

type ProjectCreationMode = "Manual" | "Automatic";

type ProjectActivity = {
    id: string;
    company: string;
    person: string;
    project: string;
    status: string;
    department?: string;
    city?: string;
    docUpload: string;
    depApproved: string;
};

const TASK_TYPE_DURATIONS: Record<string, string> = {
    "Post Products": "60",
    "Update Images": "30",
    "Keywords Optimization": "45",
    "Minisite Update": "90",
};

function PmsActivityTable({
    activities,
    loading,
    onAction,
}: {
    activities: ProjectActivity[];
    loading: boolean;
    onAction: (row: ProjectActivity) => void;
}) {
    const columns: DataTableColumn<ProjectActivity>[] = [
        {
            id: "idx",
            header: "#",
            className: "w-12 tabular-nums text-emerald-700 dark:text-emerald-400",
            cell: (row) => activities.indexOf(row) + 1,
        },
        { id: "company", header: "Company", cell: (row) => <span className="font-medium">{row.company}</span> },
        { id: "person", header: "Person", cell: (row) => row.person },
        { id: "project", header: "Project", cell: (row) => <span className="uppercase text-xs">{row.project}</span> },
        {
            id: "status",
            header: "Status",
            cell: (row) => <Badge variant="neutral">{row.status}</Badge>,
        },
        { id: "doc", header: "Doc upload", cell: (row) => row.docUpload },
        { id: "dep", header: "Dep approved", cell: (row) => row.depApproved },
        {
            id: "action",
            header: "",
            headerClassName: "w-14 text-right",
            className: "text-right",
            cell: (row) => (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    aria-label="Assign task"
                    onClick={() => onAction(row)}
                >
                    <Send className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    return (
        <>
            <DataTable
                caption="Project activity"
                columns={columns}
                rows={activities}
                rowKey={(r) => r.id}
                loading={loading}
                emptyMessage="No project activity found for this filter."
            />
            {!loading ? (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Showing {activities.length} {activities.length === 1 ? "entry" : "entries"}
                </p>
            ) : null}
        </>
    );
}

export function PmsSettingPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [department, setDepartment] = useState("all");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<ProjectActivity | null>(null);
    const [taskForm, setTaskForm] = useState({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });

    // Project Creation Trigger: Manual (default) requires a manager to create
    // the project via PMS Pending Approvals; Automatic creates it immediately
    // when a product posting invoice is fully approved (see invoice-routes.ts).
    const { data: pmsSettings, isLoading: isSettingsLoading } = useQuery<{ projectCreationMode?: ProjectCreationMode }>({
        queryKey: ["/api/pms/settings"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/settings");
            if (!res.ok) throw new Error("Failed to load PMS settings");
            return res.json();
        },
    });

    const projectCreationMode: ProjectCreationMode =
        pmsSettings?.projectCreationMode === "Automatic" ? "Automatic" : "Manual";

    const creationModeMutation = useMutation({
        mutationFn: async (mode: ProjectCreationMode) => {
            const res = await apiRequest("POST", "/api/pms/settings", { projectCreationMode: mode });
            if (!res.ok) throw new Error("Failed to update Project Creation Trigger");
            return res.json();
        },
        onSuccess: (_data, mode) => {
            queryClient.setQueryData(["/api/pms/settings"], (old: any) => ({ ...(old || {}), projectCreationMode: mode }));
            queryClient.invalidateQueries({ queryKey: ["/api/pms/settings"] });
            toast({ title: `Project Creation Trigger set to ${mode}` });
        },
        onError: () => {
            toast({ title: "Failed to update Project Creation Trigger", variant: "destructive" });
        },
    });

    const handleToggleCreationMode = (checked: boolean) => {
        creationModeMutation.mutate(checked ? "Automatic" : "Manual");
    };

    // MD-23: Department Assignment Override — an authorized manual override of
    // the fixed DND/PRODUCT_POSTING routing rule. At most one override is
    // active at a time; the fixed rule is the fallback whenever none is.
    const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
    const [overrideForm, setOverrideForm] = useState({ newRatio: "", reason: "", effectiveFrom: "", effectiveTo: "" });
    const [disableTarget, setDisableTarget] = useState<string | null>(null);
    const [disableReason, setDisableReason] = useState("");

    const { data: overrideData } = useQuery<{ active: any; fallbackNote: string }>({
        queryKey: ["/api/pms/assignment-override"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/assignment-override");
            if (!res.ok) throw new Error("Failed to load assignment override");
            const body = await res.json();
            return body.data;
        },
    });

    const { data: overrideHistory = [] } = useQuery<any[]>({
        queryKey: ["/api/pms/assignment-override/history"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/pms/assignment-override/history");
            if (!res.ok) throw new Error("Failed to load assignment override history");
            const body = await res.json();
            return body.data;
        },
    });

    const createOverrideMutation = useMutation({
        mutationFn: async (data: typeof overrideForm) => {
            const res = await apiRequest("POST", "/api/pms/assignment-override", data);
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to create override");
            return body.data;
        },
        onSuccess: () => {
            toast({ title: "Assignment override created", description: "New Product Posting workflows will route to the overridden department while it's in effect." });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/assignment-override"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/assignment-override/history"] });
            setOverrideDialogOpen(false);
            setOverrideForm({ newRatio: "", reason: "", effectiveFrom: "", effectiveTo: "" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const disableOverrideMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const res = await apiRequest("POST", `/api/pms/assignment-override/${id}/disable`, { reason });
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to disable override");
            return body.data;
        },
        onSuccess: () => {
            toast({ title: "Override disabled", description: "Routing has reverted to the fixed fallback rule." });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/assignment-override"] });
            queryClient.invalidateQueries({ queryKey: ["/api/pms/assignment-override/history"] });
            setDisableTarget(null);
            setDisableReason("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleCreateOverride = () => {
        if (!overrideForm.newRatio || !overrideForm.reason.trim() || !overrideForm.effectiveFrom || !overrideForm.effectiveTo) {
            toast({ title: "Missing fields", description: "Department, reason, and both dates are required.", variant: "destructive" });
            return;
        }
        createOverrideMutation.mutate(overrideForm);
    };

    // Minimum Payment Thresholds — optional per (GM type, package) floor below
    // which a GM cannot be created (server/services/gm-create-policy.service.ts,
    // checkGmCreationThreshold). Empty map (the default) enforces nothing.
    const GM_TYPE_OPTIONS: { value: "FULL" | "PARTIAL" | "LOAN"; label: string }[] = [
        { value: "FULL", label: "Full" },
        { value: "PARTIAL", label: "Partial" },
        { value: "LOAN", label: "Loan" },
    ];
    const [thresholdForm, setThresholdForm] = useState({ gmType: "FULL", packageName: "", minAmount: "" });

    const { data: gmSalesConfigData, isLoading: isThresholdsLoading } = useQuery<{ config?: { minimumPaymentThresholds?: Record<string, Record<string, number>> } }>({
        queryKey: ["/api/settings/gm-sales-config"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/settings/gm-sales-config");
            if (!res.ok) throw new Error("Failed to load GM sales config");
            return res.json();
        },
    });
    const gmSalesConfig = gmSalesConfigData?.config;

    const { data: gmPackagesData } = useQuery<{ packages?: { id: string; name: string }[] }>({
        queryKey: ["/api/gm-packages"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-packages");
            if (!res.ok) throw new Error("Failed to load packages");
            return res.json();
        },
    });

    const thresholdRows = Object.entries(gmSalesConfig?.minimumPaymentThresholds || {}).flatMap(([gmType, byPackage]) =>
        Object.entries(byPackage || {}).map(([packageName, minAmount]) => ({ gmType, packageName, minAmount }))
    );

    const patchThresholdsMutation = useMutation({
        mutationFn: async (minimumPaymentThresholds: Record<string, Record<string, number>>) => {
            const res = await apiRequest("PATCH", "/api/settings/gm-sales-config", { minimumPaymentThresholds });
            if (!res.ok) throw new Error("Failed to update minimum payment thresholds");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/gm-sales-config"] });
            toast({ title: "Minimum payment thresholds updated" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const handleAddThreshold = () => {
        const amount = Number(thresholdForm.minAmount);
        if (!thresholdForm.packageName || !thresholdForm.minAmount || Number.isNaN(amount) || amount < 0) {
            toast({ title: "Missing fields", description: "Choose a package and enter a valid minimum amount.", variant: "destructive" });
            return;
        }
        const next = { ...(gmSalesConfig?.minimumPaymentThresholds || {}) };
        next[thresholdForm.gmType] = { ...(next[thresholdForm.gmType] || {}), [thresholdForm.packageName]: amount };
        patchThresholdsMutation.mutate(next);
        setThresholdForm((prev) => ({ ...prev, packageName: "", minAmount: "" }));
    };

    const handleRemoveThreshold = (gmType: string, packageName: string) => {
        const next = { ...(gmSalesConfig?.minimumPaymentThresholds || {}) };
        const byPackage = { ...(next[gmType] || {}) };
        delete byPackage[packageName];
        if (Object.keys(byPackage).length === 0) delete next[gmType];
        else next[gmType] = byPackage;
        patchThresholdsMutation.mutate(next);
    };

    const departmentLabel = (value: string) => (value === "DND" ? "D&D" : value === "PRODUCT_POSTING" ? "Product Posting" : value);

    const overrideStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: "bg-green-100 text-green-700 border-green-200",
            scheduled: "bg-blue-100 text-blue-700 border-blue-200",
            expired: "bg-gray-100 text-gray-500 border-gray-200",
            disabled: "bg-red-100 text-red-600 border-red-200",
        };
        return (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${styles[status] || styles.expired}`}>
                {status}
            </span>
        );
    };

    // Real backend-driven project activity list (replaces the old static mock data).
    // Reuses the same department-status endpoint that powers the "Department Project Report"
    // (client/src/pages/pms-status.tsx), which already exposes department/city/status filters.
    const { data: rawRows = [], isLoading, refetch } = useQuery<any[]>({
        queryKey: ["/api/pms/department-status", { department }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (department && department !== "all") params.set("department", department);
            const qs = params.toString();
            const res = await apiRequest("GET", `/api/pms/department-status${qs ? `?${qs}` : ""}`);
            if (!res.ok) throw new Error("Failed to fetch project activity");
            return res.json();
        },
    });

    const activities: ProjectActivity[] = rawRows.map((row: any) => ({
        id: row.id,
        company: row.company || "N/A",
        person: row.assign || "Not Assigned",
        project: row.project || "N/A",
        status: row.status || "N/A",
        department: row.department || "",
        city: row.city || "",
        docUpload: row.date || "N/A",
        depApproved: row.invoiceStatus || "Pending",
    }));

    const filteredActivities = activities.filter((a) =>
        !searchTerm ||
        a.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.project.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // All Users List (for assigning tasks to a Posting Executive)
    const { data: usersData, error: usersError, isLoading: isLoadingUsers } = useQuery({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            if (!res.ok) throw new Error(`Failed to fetch users: ${await res.text()}`);
            return res.json();
        },
        retry: 2,
    });

    const createTaskMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", `/api/product-posting/projects/${data.projectId}/assign-task`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/pms/department-status"] });
            refetch();
            setIsDialogOpen(false);
            setTaskForm({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });
            toast({ title: "Task Assigned", description: "The task has been successfully assigned to the executive." });
        },
        onError: (error: any) => {
            toast({ title: "Failed to assign task", description: error.message || "Please try again.", variant: "destructive" });
        },
    });

    const openDialog = (activity: ProjectActivity) => {
        setSelectedActivity(activity);
        setTaskForm({ assigneeId: "", title: "", duration: "0", links: "", dueDate: "", detail: "" });
        setIsDialogOpen(true);
    };

    const handleSaveTask = () => {
        if (!selectedActivity) return;
        if (!taskForm.assigneeId || !taskForm.title) {
            toast({ title: "Missing fields", description: "Please choose a person and a task type.", variant: "destructive" });
            return;
        }
        createTaskMutation.mutate({
            projectId: selectedActivity.id,
            assigneeId: taskForm.assigneeId,
            title: taskForm.title,
            description: taskForm.detail,
            links: taskForm.links,
            dueDate: taskForm.dueDate,
            assignedDurationMinutes: Number(taskForm.duration) || 0,
        });
    };

    const exportData = (formatType: "copy" | "csv" | "excel" | "pdf") => {
        if (!filteredActivities || filteredActivities.length === 0) {
            toast({ title: "No data to export", variant: "destructive" });
            return;
        }

        const headers = ["No#", "Company", "Person", "Project", "Status", "Doc Upload", "Dep Approved"];
        const rows = filteredActivities.map((activity, idx) => [
            String(idx + 1),
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
        <div className="space-y-4">
            <PageHeader
                eyebrow="DRM Setting"
                title="PMS project setting"
                description="Project activity, GM thresholds, and creation triggers."
            />

            {/* Project Creation Trigger */}
            <Card className="border border-gray-200 dark:border-zinc-800 mb-6" data-testid="card-project-creation-trigger">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-zinc-400">
                        Project Creation Trigger
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${projectCreationMode === "Automatic" ? "bg-green-600" : "bg-gray-400"}`}>
                                {projectCreationMode === "Automatic" ? (
                                    <Zap className="w-5 h-5 text-white" />
                                ) : (
                                    <Hand className="w-5 h-5 text-white" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">
                                    {projectCreationMode === "Automatic" ? "Automatic" : "Manual"} mode
                                </p>
                                <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md">
                                    {projectCreationMode === "Automatic"
                                        ? "A PMS project is created immediately once a product posting invoice is fully approved by Accounts."
                                        : "A manager must create the project from PMS Pending Approvals after the invoice is fully approved."}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold uppercase ${projectCreationMode === "Manual" ? "text-gray-700 dark:text-zinc-100" : "text-gray-400"}`}>
                                Manual
                            </span>
                            <Switch
                                checked={projectCreationMode === "Automatic"}
                                onCheckedChange={handleToggleCreationMode}
                                disabled={isSettingsLoading || creationModeMutation.isPending}
                                data-testid="switch-project-creation-mode"
                            />
                            <span className={`text-xs font-semibold uppercase ${projectCreationMode === "Automatic" ? "text-green-700 dark:text-green-400" : "text-gray-400"}`}>
                                Automatic
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* MD-23: Department Assignment Override */}
            <Card className="border border-gray-200 dark:border-zinc-800 mb-6" data-testid="card-assignment-override">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-zinc-400">
                        Department Assignment Override
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                        <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${overrideData?.active ? "bg-amber-500" : "bg-gray-400"}`}>
                                {overrideData?.active ? <Lock className="w-5 h-5 text-white" /> : <ShieldAlert className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                {overrideData?.active ? (
                                    <>
                                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">
                                            Override active — routing to {departmentLabel(overrideData.active.newRatio)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-lg">
                                            Approved by {overrideData.active.approvedByName || "—"} · in effect until{" "}
                                            {format(new Date(overrideData.active.effectiveTo), "dd-MM-yyyy hh:mm a")} · reason: {overrideData.active.reason}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">No active override</p>
                                        <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-lg">
                                            {overrideData?.fallbackNote || "Routing uses the fixed rule (per-project DND / Product Posting determination)."}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {overrideData?.active && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                    onClick={() => setDisableTarget(overrideData.active.id)}
                                >
                                    Disable
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => setOverrideDialogOpen(true)}
                            >
                                New override
                            </Button>
                        </div>
                    </div>

                    {overrideHistory.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-zinc-800 pt-3">
                            <div className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase mb-2 dark:text-zinc-400">
                                <History className="w-3.5 h-3.5" />
                                Override History
                            </div>
                            <div className="w-full overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[820px]">
                                    <thead>
                                        <tr className="bg-[#f4f6f9] text-[#495057] text-[11px] font-bold border-b border-gray-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                            <th className="p-2 py-2.5">Previous → New</th>
                                            <th className="p-2 py-2.5">Reason</th>
                                            <th className="p-2 py-2.5">Approved By</th>
                                            <th className="p-2 py-2.5">Effective Window</th>
                                            <th className="p-2 py-2.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overrideHistory.map((row: any) => (
                                            <tr key={row.id} className="border-b border-gray-100 dark:border-zinc-800">
                                                <td className="p-2 py-2.5 text-[12px] text-[#6c757d]">
                                                    {departmentLabel(row.previousRatio)} → <b>{departmentLabel(row.newRatio)}</b>
                                                </td>
                                                <td className="p-2 py-2.5 text-[12px] text-[#6c757d] max-w-[220px] truncate" title={row.reason}>{row.reason}</td>
                                                <td className="p-2 py-2.5 text-[12px] text-[#6c757d]">{row.approvedByName || "—"}</td>
                                                <td className="p-2 py-2.5 text-[12px] text-[#6c757d]">
                                                    {format(new Date(row.effectiveFrom), "dd-MM-yyyy")} – {format(new Date(row.effectiveTo), "dd-MM-yyyy")}
                                                </td>
                                                <td className="p-2 py-2.5">{overrideStatusBadge(row.liveStatus)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Minimum Payment Thresholds */}
            <Card className="border border-gray-200 dark:border-zinc-800 mb-6" data-testid="card-minimum-payment-thresholds">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide dark:text-zinc-400">
                        Minimum Payment Thresholds
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 max-w-2xl">
                        Optional per GM-type / package floor. A GM below the configured minimum is blocked at creation.
                        Leave empty (no rules) to enforce nothing — the current, unrestricted behaviour.
                    </p>

                    <div className="flex flex-wrap items-end gap-3 mb-4">
                        <div className="space-y-1.5">
                            <Label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">GM Type</Label>
                            <Select value={thresholdForm.gmType} onValueChange={(v) => setThresholdForm((prev) => ({ ...prev, gmType: v }))}>
                                <SelectTrigger className="h-[36px] w-[130px] text-[13px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {GM_TYPE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Package</Label>
                            <Select value={thresholdForm.packageName} onValueChange={(v) => setThresholdForm((prev) => ({ ...prev, packageName: v }))}>
                                <SelectTrigger className="h-[36px] w-[200px] text-[13px]">
                                    <SelectValue placeholder="Choose package..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(gmPackagesData?.packages || []).map((pkg) => (
                                        <SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Minimum Amount (USD)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={thresholdForm.minAmount}
                                onChange={(e) => setThresholdForm((prev) => ({ ...prev, minAmount: e.target.value }))}
                                className="h-[36px] w-[150px] text-[13px]"
                                placeholder="e.g. 500"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={handleAddThreshold}
                            disabled={patchThresholdsMutation.isPending}
                        >
                            {patchThresholdsMutation.isPending ? "Saving…" : "Add rule"}
                        </Button>
                    </div>

                    <div className="w-full overflow-x-auto border-t border-gray-100 dark:border-zinc-800">
                        <table className="w-full text-left border-collapse min-w-[560px]">
                            <thead>
                                <tr className="bg-[#f4f6f9] text-[#495057] text-[11px] font-bold border-b border-gray-200 dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="p-2 py-2.5">GM Type</th>
                                    <th className="p-2 py-2.5">Package</th>
                                    <th className="p-2 py-2.5">Minimum Amount (USD)</th>
                                    <th className="p-2 py-2.5 text-right pr-4">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isThresholdsLoading ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-gray-400">Loading...</td></tr>
                                ) : thresholdRows.length === 0 ? (
                                    <tr><td colSpan={4} className="p-4 text-center text-[13px] text-gray-400">No thresholds configured — no minimum is enforced.</td></tr>
                                ) : thresholdRows.map((row) => (
                                    <tr key={`${row.gmType}-${row.packageName}`} className="border-b border-gray-100 dark:border-zinc-800">
                                        <td className="p-2 py-2.5 text-[12px] text-[#6c757d]">
                                            {GM_TYPE_OPTIONS.find((o) => o.value === row.gmType)?.label || row.gmType}
                                        </td>
                                        <td className="p-2 py-2.5 text-[12px] text-[#6c757d]">{row.packageName}</td>
                                        <td className="p-2 py-2.5 text-[12px] text-[#6c757d] tabular-nums">${row.minAmount}</td>
                                        <td className="p-2 py-2.5 text-right pr-4">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                onClick={() => handleRemoveThreshold(row.gmType, row.packageName)}
                                                disabled={patchThresholdsMutation.isPending}
                                            >
                                                Remove
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <DrmSection
                title="Project activity"
                description="Filter by department or export the current list."
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Department</label>
                        <Select value={department} onValueChange={setDepartment}>
                            <SelectTrigger className="h-9 w-[170px] text-sm">
                                <SelectValue placeholder="All departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                <SelectItem value="SEO/SMM">SEO/SMM</SelectItem>
                                <SelectItem value="Development">Development</SelectItem>
                                <SelectItem value="Design">Design</SelectItem>
                                <SelectItem value="Product Posting">Product Posting</SelectItem>
                                <SelectItem value="D&D">D&D</SelectItem>
                            </SelectContent>
                        </Select>
                        <Input
                            className="h-9 w-[200px] text-sm"
                            placeholder="Search…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                }
            >
                <div className="mb-3 flex flex-wrap gap-2">
                    {(
                        [
                            ["copy", "Copy"],
                            ["excel", "Excel"],
                            ["csv", "CSV"],
                            ["pdf", "PDF"],
                        ] as const
                    ).map(([key, label]) => (
                        <Button key={key} type="button" variant="secondary" size="sm" onClick={() => exportData(key)}>
                            {label}
                        </Button>
                    ))}
                </div>
                <PmsActivityTable activities={filteredActivities} loading={isLoading} onAction={openDialog} />
            </DrmSection>

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
                                <Select
                                    value={taskForm.assigneeId}
                                    onValueChange={(v) => setTaskForm(prev => ({ ...prev, assigneeId: v }))}
                                >
                                    <SelectTrigger className="h-[38px] w-full bg-white text-[13px] text-gray-500 border-gray-200 shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
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
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Task</Label>
                                <Select
                                    value={taskForm.title}
                                    onValueChange={(v) => setTaskForm(prev => ({ ...prev, title: v, duration: TASK_TYPE_DURATIONS[v] || prev.duration }))}
                                >
                                    <SelectTrigger className="h-[38px] w-full bg-white text-[13px] text-gray-500 border-gray-200 shadow-none dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Post Products">Post Products</SelectItem>
                                        <SelectItem value="Update Images">Update Images</SelectItem>
                                        <SelectItem value="Keywords Optimization">Keywords Optimization</SelectItem>
                                        <SelectItem value="Minisite Update">Minisite Update</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 3 - Three Columns */}
                        <div className="grid grid-cols-3 gap-x-4 mb-5">
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Task Time (m)</Label>
                                <Input
                                    type="number"
                                    value={taskForm.duration}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, duration: e.target.value }))}
                                    className="h-[38px] bg-[#f1f4f9] border-gray-200 text-[13px] shadow-none focus-visible:ring-0 dark:border-zinc-800 dark:bg-zinc-900"
                                />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Links</Label>
                                <Input
                                    placeholder="Working Links"
                                    value={taskForm.links}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, links: e.target.value }))}
                                    className="h-[38px] bg-white border-gray-200 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-[#059669] dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Next Day</Label>
                                <Input
                                    type="datetime-local"
                                    value={taskForm.dueDate}
                                    onClick={(e) => (e.target as any).showPicker?.()}
                                    onFocus={(e) => (e.target as any).showPicker?.()}
                                    onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
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
                                value={taskForm.detail}
                                onChange={(e) => setTaskForm(prev => ({ ...prev, detail: e.target.value }))}
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
                            type="button"
                            variant="primary"
                            onClick={handleSaveTask}
                            disabled={createTaskMutation.isPending}
                        >
                            {createTaskMutation.isPending ? "Saving..." : "Save task"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MD-23: New Override dialog */}
            <Dialog open={overrideDialogOpen} onOpenChange={(open) => { setOverrideDialogOpen(open); if (!open) setOverrideForm({ newRatio: "", reason: "", effectiveFrom: "", effectiveTo: "" }); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Department Assignment Override</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Department</Label>
                            <Select value={overrideForm.newRatio} onValueChange={(v) => setOverrideForm((prev) => ({ ...prev, newRatio: v }))}>
                                <SelectTrigger className="h-[38px] text-[13px]">
                                    <SelectValue placeholder="Choose department..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PRODUCT_POSTING">Product Posting</SelectItem>
                                    <SelectItem value="DND">D&D</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Effective From</Label>
                                <Input
                                    type="datetime-local"
                                    value={overrideForm.effectiveFrom}
                                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                                    className="h-[38px] text-[13px]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Effective To</Label>
                                <Input
                                    type="datetime-local"
                                    value={overrideForm.effectiveTo}
                                    onChange={(e) => setOverrideForm((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                                    className="h-[38px] text-[13px]"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Reason (required)</Label>
                            <Textarea
                                placeholder="Why is this override needed?"
                                value={overrideForm.reason}
                                onChange={(e) => setOverrideForm((prev) => ({ ...prev, reason: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setOverrideDialogOpen(false)}>Cancel</Button>
                        <Button
                            type="button"
                            variant="primary"
                            disabled={createOverrideMutation.isPending}
                            onClick={handleCreateOverride}
                        >
                            {createOverrideMutation.isPending ? "Saving..." : "Create override"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MD-23: Disable Override dialog */}
            <Dialog open={!!disableTarget} onOpenChange={(open) => { if (!open) { setDisableTarget(null); setDisableReason(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disable Assignment Override</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label className="text-[13px] font-bold text-slate-500 dark:text-zinc-400">Reason (optional)</Label>
                        <Textarea
                            placeholder="Why is this override being disabled early?"
                            value={disableReason}
                            onChange={(e) => setDisableReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => { setDisableTarget(null); setDisableReason(""); }}>Cancel</Button>
                        <Button
                            type="button"
                            variant="danger"
                            disabled={disableOverrideMutation.isPending}
                            onClick={() => disableTarget && disableOverrideMutation.mutate({ id: disableTarget, reason: disableReason })}
                        >
                            {disableOverrideMutation.isPending ? "Disabling..." : "Disable"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
