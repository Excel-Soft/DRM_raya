import React, { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PromotionRow {
    id: string;
    title: string;
    package: string;
    discount: string;
    startDate: string;
    endDate: string;
    banner: File | null;
    message: string;
}

export default function PromotionPage() {
    const { toast } = useToast();
    const [rows, setRows] = useState<PromotionRow[]>([
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

    // Query for old promotions
    const { data: promotionsData, isLoading: promotionsLoading } = useQuery<{ success: boolean; data: any[] }>({
        queryKey: ["/api/drm/promotions"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/promotions");
            return res.json();
        },
        retry: false,
        // Use initialData to always show sample data
        initialData: {
            success: true,
            data: [
                {
                    id: '1',
                    banner_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=300&fit=crop',
                    banner_type: 'image',
                    title: 'Test Banner',
                    sub_title: 'China Trip',
                    package: 'Basic',
                    discount: '$ 900',
                    start_date: '2025-12-01',
                    end_date: '2025-12-31',
                    is_active: true
                },
                {
                    id: '2',
                    banner_url: 'https://images.unsplash.com/photo-1551033406-611cf9a28f67?w=400&h=300&fit=crop',
                    banner_type: 'image',
                    title: 'Test Banner',
                    sub_title: 'Basic',
                    package: 'Basic',
                    discount: '$ 900',
                    start_date: '2025-12-01',
                    end_date: '2025-12-31',
                    is_active: true
                },
                {
                    id: '3',
                    banner_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
                    banner_type: 'image',
                    title: 'Test Banner 1',
                    sub_title: 'Basic',
                    package: 'Basic',
                    discount: '$ 900',
                    start_date: '2025-12-01',
                    end_date: '2025-12-31',
                    is_active: true
                },
                {
                    id: '4',
                    banner_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
                    banner_type: 'image',
                    title: 'Beautiful Day with Friends',
                    sub_title: 'Basic',
                    package: 'Basic',
                    discount: '$ 0',
                    start_date: '2024-05-01',
                    end_date: '2024-05-31',
                    is_active: false
                },
            ]
        }
    });

    const oldPromotions = promotionsData?.data || [];

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

    const updateRow = (id: string, field: keyof PromotionRow, value: any) => {
        setRows(rows.map(row =>
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const handleSubmit = () => {
        toast({
            title: "Success",
            description: "Promotion banners submitted successfully!",
        });
    };

    // Format date helper
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
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
                                                accept="image/*"
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
                                className="w-full bg-[#00a65a] hover:bg-[#008d4c] text-white py-6 rounded text-base font-medium mt-4"
                            >
                                Submit
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
                                oldPromotions.map((promo: any) => (
                                    <div key={promo.id} className="border border-gray-200 rounded-lg p-4 space-y-3 dark:border-zinc-800">
                                        <div className="flex items-start gap-3">
                                            {/* Banner Thumbnail */}
                                            <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0 overflow-hidden">
                                                {promo.banner_url ? (
                                                    promo.banner_type === 'video' ? (
                                                        <video
                                                            src={promo.banner_url}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                            loop
                                                            playsInline
                                                        />
                                                    ) : (
                                                        <img
                                                            src={promo.banner_url}
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
                                                <p className="text-xs text-gray-600 dark:text-zinc-300">{promo.sub_title}</p>
                                                <p className="text-xs text-gray-500 dark:text-zinc-400">{promo.package}</p>
                                                <p className="text-sm font-semibold text-[#00a65a] dark:text-zinc-400">{promo.discount}</p>
                                            </div>

                                            {/* Toggle */}
                                            <Switch defaultChecked={promo.is_active} />
                                        </div>

                                        {/* Date Range */}
                                        <div className="text-xs text-gray-500 dark:text-zinc-400">
                                            {formatDate(promo.start_date)} <span className="font-semibold">To</span> {formatDate(promo.end_date)}
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
