import React, { useMemo, useState } from 'react';
import { Calendar, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PromotionFormRow {
    id: string;
    title: string;
    discount: string;
    startDate: string;
    endDate: string;
    banner: File | null;
    message: string;
    targetRole: string;
    packageName: string;
}

interface RoleOption {
    id: string;
    name: string;
}

function formatRoleLabel(role: string): string {
    return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Promotion {
    id: string;
    packageId: string | null;
    packageName: string | null;
    title: string;
    subTitle: string | null;
    discount: string | null;
    bannerUrl: string | null;
    mediaType: string | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    status: string;
    reason: string | null;
    createdByName: string | null;
    createdAt: string | null;
    targetRole: string | null;
    sortRank?: number | null;
    legacySourceId?: string | null;
}

interface PromotionListResponse {
    data: Promotion[];
    total: number;
    page: number;
    pageSize: number;
}

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatDiscountLabel(discount: string | null | undefined): string {
    if (discount == null || discount === "") return "Discount: $0";
    const n = parseFloat(String(discount).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(n)) return `Discount: $${n}`;
    return `Discount: ${discount}`;
}

function statusBadgeClass(status: string): string {
    switch (status) {
        case "approved":
            return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
        case "rejected":
            return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
        default:
            return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    }
}

export default function PromotionPage() {
    const { toast } = useToast();
    const [rows, setRows] = useState<PromotionFormRow[]>([
        {
            id: '1',
            title: '',
            discount: '0.00',
            startDate: '',
            endDate: '',
            banner: null,
            message: '',
            targetRole: '',
            packageName: '',
        }
    ]);

    // Query for old promotions (real-or-empty — no mock fallback)
    const { data: promotionsData, isLoading: promotionsLoading } = useQuery<PromotionListResponse>({
        queryKey: ["/api/drm/promotions"],
        queryFn: () =>
            apiRequestJson<PromotionListResponse>("GET", "/api/drm/promotions?pageSize=50"),
    });

    const oldPromotions = useMemo(() => {
        const list = [...(promotionsData?.data ?? [])];
        list.sort((a, b) => {
            const ra = a.sortRank ?? Number.MAX_SAFE_INTEGER;
            const rb = b.sortRank ?? Number.MAX_SAFE_INTEGER;
            if (ra !== rb) return ra - rb;
            return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        });
        return list;
    }, [promotionsData?.data]);

    const [rankDraft, setRankDraft] = useState<Record<string, string>>({});

    // Real roles list (same endpoint the super-admin Roles UI uses) — lets a
    // banner be targeted to one specific role instead of showing app-wide.
    const { data: rolesData } = useQuery<RoleOption[]>({
        queryKey: ["/api/settings/roles"],
        queryFn: () => apiRequestJson<RoleOption[]>("GET", "/api/settings/roles"),
    });
    const roleOptions = rolesData ?? [];

    function invalidate() {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/promotions"] });
    }

    const createMutation = useMutation({
        mutationFn: async (formRows: PromotionFormRow[]) => {
            for (const row of formRows) {
                let bannerUrl: string | null = null;
                let mediaType: string | null = null;
                if (row.banner) {
                    bannerUrl = await fileToDataUrl(row.banner);
                    mediaType = row.banner.type.startsWith("video") ? "video" : "image";
                }
                await apiRequestJson("POST", "/api/drm/promotions", {
                    title: row.title.trim(),
                    packageName: row.packageName.trim() || null,
                    subTitle: row.message.trim() || null,
                    discount: row.discount ? String(row.discount) : null,
                    startDate: row.startDate || null,
                    endDate: row.endDate || null,
                    bannerUrl,
                    mediaType,
                    targetRole: row.targetRole || null,
                });
            }
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Promotion banners submitted successfully!" });
            setRows([{
                id: Date.now().toString(),
                title: '',
                discount: '0.00',
                startDate: '',
                endDate: '',
                banner: null,
                message: '',
                targetRole: '',
                packageName: '',
            }]);
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to submit", variant: "destructive" }),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            apiRequestJson("PATCH", `/api/drm/promotions/${id}`, { isActive }),
        onSuccess: () => invalidate(),
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to update", variant: "destructive" }),
    });

    const targetRoleMutation = useMutation({
        mutationFn: ({ id, targetRole }: { id: string; targetRole: string | null }) =>
            apiRequestJson("PATCH", `/api/drm/promotions/${id}`, { targetRole }),
        onSuccess: () => {
            toast({ title: "Target role updated" });
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to update target role", variant: "destructive" }),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("PATCH", `/api/drm/promotions/${id}/approve`),
        onSuccess: () => {
            toast({ title: "Promotion approved" });
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to approve", variant: "destructive" }),
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
            apiRequestJson("PATCH", `/api/drm/promotions/${id}/reject`, { reason }),
        onSuccess: () => {
            toast({ title: "Promotion rejected" });
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to reject", variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("DELETE", `/api/drm/promotions/${id}`),
        onSuccess: () => {
            toast({ title: "Promotion deleted" });
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to delete", variant: "destructive" }),
    });

    const rankMutation = useMutation({
        mutationFn: ({ id, sortRank }: { id: string; sortRank: number }) =>
            apiRequestJson("PATCH", `/api/drm/promotions/${id}/rank`, { sortRank }),
        onSuccess: () => {
            toast({ title: "Order updated", description: "Promotion ranks adjusted." });
            setRankDraft({});
            invalidate();
        },
        onError: (e: any) =>
            toast({ title: "Error", description: e?.message || "Failed to update rank", variant: "destructive" }),
    });

    const commitRankChange = (promo: Promotion, displayIndex: number) => {
        const current = promo.sortRank ?? displayIndex + 1;
        const raw = rankDraft[promo.id];
        const parsed = raw != null && raw !== "" ? parseInt(raw, 10) : current;
        if (!Number.isFinite(parsed) || parsed < 1) {
            setRankDraft((d) => {
                const next = { ...d };
                delete next[promo.id];
                return next;
            });
            return;
        }
        const clamped = Math.min(parsed, oldPromotions.length);
        if (clamped === current) {
            setRankDraft((d) => {
                const next = { ...d };
                delete next[promo.id];
                return next;
            });
            return;
        }
        rankMutation.mutate({ id: promo.id, sortRank: clamped });
    };

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            title: '',
            discount: '0.00',
            startDate: '',
            endDate: '',
            banner: null,
            message: '',
            targetRole: '',
            packageName: '',
        }]);
    };

    const removeRow = (id: string) => {
        setRows(rows.filter(row => row.id !== id));
    };

    const updateRow = (id: string, field: keyof PromotionFormRow, value: any) => {
        setRows(rows.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleSubmit = () => {
        const validRows = rows.filter((r) => r.title.trim());
        if (validRows.length === 0) {
            toast({ title: "Title is required", description: "Enter a banner title before submitting.", variant: "destructive" });
            return;
        }
        createMutation.mutate(validRows);
    };

    // Format date helper
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "—";
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };


    return (
        <div className="p-6 bg-gray-50 min-h-screen font-sans dark:bg-zinc-950">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Section - Add Promotion Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
                            <h2 className="text-lg font-semibold text-gray-700 uppercase dark:text-zinc-400">Add Promotion Banner</h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <p className="text-xs text-gray-500 dark:text-zinc-400 -mt-1">Upload one or more banners; use <span className="font-medium text-gray-600 dark:text-zinc-300">Add Row</span> for batch entry.</p>

                            {rows.map((row, index) => (
                                <div key={row.id} className="space-y-4 pb-5 border-b border-gray-100 last:border-0 last:pb-0 dark:border-zinc-800">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {/* Title */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Title</label>
                                            <input
                                                type="text"
                                                value={row.title}
                                                onChange={(e) => updateRow(row.id, 'title', e.target.value)}
                                                placeholder="enter banner title"
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                                            />
                                        </div>

                                        {/* Package (legacy field) */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Package</label>
                                            <input
                                                type="text"
                                                value={row.packageName}
                                                onChange={(e) => updateRow(row.id, 'packageName', e.target.value)}
                                                placeholder="Choose / package label"
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                                            />
                                        </div>

                                        {/* Discount */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">$ Discount</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={row.discount}
                                                onChange={(e) => updateRow(row.id, 'discount', e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                                            />
                                        </div>

                                        {/* Target Role */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Target Role</label>
                                            <Select value={row.targetRole || "static"} onValueChange={(val) => updateRow(row.id, 'targetRole', val === "static" ? "" : val)}>
                                                <SelectTrigger className="w-full border-gray-300 rounded h-[38px] text-sm dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="static">Static (All Roles)</SelectItem>
                                                    {roleOptions.map((r) => (
                                                        <SelectItem key={r.id} value={r.name}>{formatRoleLabel(r.name)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Start Date */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Start Date</label>
                                            <input
                                                type="date"
                                                value={row.startDate}
                                                onChange={(e) => updateRow(row.id, 'startDate', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                            />
                                        </div>

                                        {/* End Date */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">End Date</label>
                                            <input
                                                type="date"
                                                value={row.endDate}
                                                onChange={(e) => updateRow(row.id, 'endDate', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                            />
                                        </div>

                                        {/* Banner Upload */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Banner</label>
                                            <input
                                                type="file"
                                                accept="image/*,video/*"
                                                onChange={(e) => updateRow(row.id, 'banner', e.target.files?.[0] || null)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                                            />
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Message</label>
                                            {rows.length > 1 && (
                                                <button
                                                    onClick={() => removeRow(row.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <textarea
                                            value={row.message}
                                            onChange={(e) => updateRow(row.id, 'message', e.target.value)}
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a65a] resize-none dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                                        />
                                    </div>
                                </div>
                            ))}

                            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-200 dark:border-zinc-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={addRow}
                                    className="h-10 border-[#00a65a] text-[#00a65a] hover:bg-[#e4f6ec] dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                    <Plus className="w-4 h-4 mr-1.5" />
                                    Add Row
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={createMutation.isPending}
                                    className="h-10 min-w-[140px] px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white rounded-md shadow-sm"
                                >
                                    {createMutation.isPending ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                                        </span>
                                    ) : (
                                        "Submit"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Section - Old Promotions */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
                            <h2 className="text-base font-semibold text-gray-700 dark:text-zinc-400">Old Promotions</h2>
                        </div>
                        <div className="p-4 space-y-4 max-h-[800px] overflow-y-auto">
                            {promotionsLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#00a65a] dark:text-zinc-400" />
                                </div>
                            ) : oldPromotions.length > 0 ? (
                                oldPromotions.map((promo, index) => (
                                    <div key={promo.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm dark:border-zinc-800">
                                        <div className="relative bg-gray-100 dark:bg-zinc-800 min-h-[120px]">
                                            {promo.bannerUrl ? (
                                                <img
                                                    src={promo.bannerUrl}
                                                    alt={promo.title}
                                                    className="w-full max-h-40 object-contain object-center bg-white dark:bg-zinc-900"
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No banner image</div>
                                            )}
                                            <div className="absolute top-2 right-2 flex flex-col items-center gap-0.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">Rank</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={oldPromotions.length}
                                                    disabled={rankMutation.isPending}
                                                    value={rankDraft[promo.id] ?? String(promo.sortRank ?? index + 1)}
                                                    onChange={(e) =>
                                                        setRankDraft((d) => ({ ...d, [promo.id]: e.target.value }))
                                                    }
                                                    onBlur={() => commitRankChange(promo, index)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="w-11 h-10 text-center text-sm font-bold rounded-md border-2 border-[#00a65a] bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00a65a]/40 dark:bg-zinc-900 dark:text-zinc-100 dark:border-emerald-600 disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    aria-label={`Rank for ${promo.title}`}
                                                />
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-100 leading-snug">{promo.title}</h3>
                                            {promo.subTitle && (
                                                <p className="text-xs text-gray-500 dark:text-zinc-400">{promo.subTitle}</p>
                                            )}
                                            <span className="inline-block text-xs font-semibold text-[#00a65a] bg-[#e4f6ec] dark:bg-zinc-800 px-2 py-1 rounded">
                                                {formatDiscountLabel(promo.discount)}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
                                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                                <span>{formatDate(promo.startDate)}</span>
                                                <span className="font-bold uppercase text-[10px]">To</span>
                                                <span>{formatDate(promo.endDate)}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={promo.isActive}
                                                        disabled={toggleMutation.isPending}
                                                        onCheckedChange={(checked) => toggleMutation.mutate({ id: promo.id, isActive: checked })}
                                                    />
                                                    <span className={`text-xs font-medium ${promo.isActive ? 'text-[#00a65a]' : 'text-gray-400'}`}>
                                                        {promo.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm("Delete this promotion?")) {
                                                            deleteMutation.mutate(promo.id);
                                                        }
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                                </button>
                                            </div>
                                            {promo.status === 'pending' && (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${statusBadgeClass(promo.status)}`}>{promo.status}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => approveMutation.mutate(promo.id)}
                                                        disabled={approveMutation.isPending}
                                                        className="flex items-center gap-1 text-xs text-green-700 hover:underline"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const reason = window.prompt("Reason for rejection (optional):") ?? "";
                                                            rejectMutation.mutate({ id: promo.id, reason: reason.trim() || null });
                                                        }}
                                                        disabled={rejectMutation.isPending}
                                                        className="flex items-center gap-1 text-xs text-red-600 hover:underline"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                </div>
                                            )}
                                            {!promo.legacySourceId && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-400">Target Role</label>
                                                    <Select
                                                        value={promo.targetRole || "static"}
                                                        onValueChange={(val) => targetRoleMutation.mutate({ id: promo.id, targetRole: val === "static" ? null : val })}
                                                    >
                                                        <SelectTrigger className="w-full border-gray-300 rounded h-8 text-xs dark:border-zinc-800">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="static">Static (All Roles)</SelectItem>
                                                            {roleOptions.map((r) => (
                                                                <SelectItem key={r.id} value={r.name}>{formatRoleLabel(r.name)}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 dark:text-zinc-400">
                                    No promotions found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
