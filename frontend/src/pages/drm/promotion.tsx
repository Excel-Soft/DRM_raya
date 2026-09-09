import React, { useState } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
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
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PromotionFormRow {
    id: string;
    title: string;
    package: string;
    discount: string;
    startDate: string;
    endDate: string;
    banner: File | null;
    message: string;
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
}

interface PromotionListResponse {
    data: Promotion[];
    total: number;
    page: number;
    pageSize: number;
}

const STATIC_PACKAGE_LABELS: Record<string, string> = {
    "verified-supplier": "Verified Supplier",
    "rc-up": "Rc-Up",
    "kap": "KAP",
    "ggs-pro": "GGS Pro",
    "kwa-kap": "KWA-KAP",
    "china-trip": "China Trip",
    "kwa-pro": "Kwa-Pro",
};

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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
            package: 'choose',
            discount: '0.00',
            startDate: '',
            endDate: '',
            banner: null,
            message: ''
        }
    ]);

    // Query for old promotions (real-or-empty — no mock fallback)
    const { data: promotionsData, isLoading: promotionsLoading } = useQuery<PromotionListResponse>({
        queryKey: ["/api/drm/promotions"],
        queryFn: () => apiRequestJson<PromotionListResponse>("GET", "/api/drm/promotions"),
    });

    const oldPromotions = promotionsData?.data ?? [];

    // Query for GM packages
    const { data: packagesData } = useQuery<{ packages: any[] }>({
        queryKey: ["gm-packages"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-packages");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const packages = packagesData?.packages || [];

    function invalidate() {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/promotions"] });
    }

    function resolvePackageName(value: string): string | null {
        if (!value || value === 'choose') return null;
        const pkg = packages.find((p) => String(p.id) === value);
        if (pkg) return pkg.name ?? null;
        return STATIC_PACKAGE_LABELS[value] ?? value;
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
                    packageId: row.package && row.package !== 'choose' ? row.package : null,
                    packageName: resolvePackageName(row.package),
                    subTitle: row.message.trim() || null,
                    discount: row.discount ? String(row.discount) : null,
                    startDate: row.startDate || null,
                    endDate: row.endDate || null,
                    bannerUrl,
                    mediaType,
                });
            }
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Promotion banners submitted successfully!" });
            setRows([{
                id: Date.now().toString(),
                title: '',
                package: 'choose',
                discount: '0.00',
                startDate: '',
                endDate: '',
                banner: null,
                message: ''
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

    const addRow = () => {
        setRows([...rows, {
            id: Date.now().toString(),
            title: '',
            package: 'choose',
            discount: '0.00',
            startDate: '',
            endDate: '',
            banner: null,
            message: ''
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
                        <div className="p-6 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-zinc-400">Upload Banners</h3>

                            {rows.map((row, index) => (
                                <div key={row.id} className="space-y-4 pb-4 border-b border-gray-100 last:border-0 dark:border-zinc-800">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                                        {/* Package */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-300">Package</label>
                                            <Select value={row.package} onValueChange={(val) => updateRow(row.id, 'package', val)}>
                                                <SelectTrigger className="w-full border-gray-300 rounded h-[38px] text-sm dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="choose">Choose...</SelectItem>
                                                    {packages.map((pkg) => (
                                                        <SelectItem key={pkg.id} value={pkg.id}>
                                                            {pkg.name} ({pkg.orderDollar ?? pkg.priceUsd} $)
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="verified-supplier">Verified Supplier</SelectItem>
                                                    <SelectItem value="rc-up">Rc-Up</SelectItem>
                                                    <SelectItem value="kap">KAP</SelectItem>
                                                    <SelectItem value="ggs-pro">GGS Pro</SelectItem>
                                                    <SelectItem value="kwa-kap">KWA-KAP</SelectItem>
                                                    <SelectItem value="china-trip">China Trip</SelectItem>
                                                    <SelectItem value="kwa-pro">Kwa-Pro</SelectItem>
                                                </SelectContent>
                                            </Select>
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

                            {/* Add Row Button */}
                            <Button
                                onClick={addRow}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 rounded h-9"
                            >
                                Add Row
                            </Button>

                            {/* Submit Button */}
                            <Button
                                onClick={handleSubmit}
                                disabled={createMutation.isPending}
                                className="w-full bg-[#00a65a] hover:bg-[#008d4c] text-white py-6 rounded text-base font-medium mt-4"
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
                                oldPromotions.map((promo) => (
                                    <div key={promo.id} className="border border-gray-200 rounded-lg p-4 space-y-3 dark:border-zinc-800">
                                        <div className="flex items-start gap-3">
                                            {/* Banner Thumbnail */}
                                            <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                                {promo.bannerUrl ? (
                                                    promo.mediaType === 'video' ? (
                                                        <video
                                                            src={promo.bannerUrl}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            loop
                                                            playsInline
                                                        />
                                                    ) : (
                                                        <img
                                                            src={promo.bannerUrl}
                                                            alt={promo.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                target.parentElement!.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">Banner</div>';
                                                            }}
                                                        />
                                                    )
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-semibold">
                                                        Banner
                                                    </div>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 space-y-1">
                                                <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{promo.title}</h3>
                                                {promo.subTitle && <p className="text-xs text-gray-600 dark:text-zinc-300">{promo.subTitle}</p>}
                                                {promo.packageName && <p className="text-xs text-gray-500 dark:text-zinc-400">{promo.packageName}</p>}
                                                {promo.discount && <p className="text-sm font-semibold text-[#00a65a] dark:text-zinc-400">{promo.discount}</p>}
                                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${statusBadgeClass(promo.status)}`}>
                                                    {promo.status}
                                                </span>
                                            </div>

                                            {/* Toggle */}
                                            <Switch
                                                checked={promo.isActive}
                                                disabled={toggleMutation.isPending}
                                                onCheckedChange={(checked) => toggleMutation.mutate({ id: promo.id, isActive: checked })}
                                            />
                                        </div>

                                        {/* Date Range */}
                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            {formatDate(promo.startDate)} <span className="font-semibold">To</span> {formatDate(promo.endDate)}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {promo.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => approveMutation.mutate(promo.id)}
                                                        disabled={approveMutation.isPending}
                                                        className="flex items-center gap-1 text-xs text-green-700 hover:underline disabled:opacity-50"
                                                    >
                                                        <Check className="w-3.5 h-3.5" /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const reason = window.prompt("Reason for rejection (optional):") ?? "";
                                                            rejectMutation.mutate({ id: promo.id, reason: reason.trim() || null });
                                                        }}
                                                        disabled={rejectMutation.isPending}
                                                        className="flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (window.confirm("Delete this promotion?")) {
                                                        deleteMutation.mutate(promo.id);
                                                    }
                                                }}
                                                disabled={deleteMutation.isPending}
                                                className="flex items-center gap-1 text-xs text-red-600 hover:underline disabled:opacity-50 ml-auto"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
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
