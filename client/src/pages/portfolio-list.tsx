import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
    Search, 
    LayoutGrid, 
    List as ListIcon, 
    ChevronRight, 
    Calendar,
    User,
    Loader2,
    Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    { 
        name: "Minisite", 
        count: 4,
        subCategories: [
            { name: "Sports Wear", count: 33 },
            { name: "Casual Wear", count: 4 },
            { name: "Fitness Wear", count: 21 },
            { name: "Surgical", count: 0 },
        ]
    },
    { 
        name: "Website", 
        count: 9,
        subCategories: [
            { name: "Surgical", count: 0 },
            { name: "Sports Wear", count: 0 },
            { name: "Casual Wear", count: 0 },
            { name: "Fitness Wear", count: 0 },
            { name: "Martial Arts Wear", count: 0 },
            { name: "Health & Medical", count: 0 },
            { name: "Band Uniform", count: 0 },
            { name: "Beauty Instruments", count: 0 },
            { name: "Gloves Range", count: 0 },
        ]
    },
    { name: "Store", count: 0 },
    { name: "Catalogue", count: 0 },
    { name: "Logo", count: 0 },
    { name: "Flyer", count: 0 },
    { name: "Flex", count: 0 },
    { name: "Visiting Card", count: 0 },
    { name: "Social Media Post", count: 0 },
];

const DESIGN_OVERVIEW = [
    { name: "Used", count: 1, color: "bg-green-500" },
    { name: "Un-Used", count: 56, color: "bg-gray-400" },
    { name: "Rejected", count: 0, color: "bg-red-500" },
    { name: "Changing", count: 0, color: "bg-blue-500" },
    { name: "Reserved", count: 1, color: "bg-orange-500" },
];

export default function PortfolioList() {
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedCategory, setSelectedCategory] = useState("Minisite");

    const { data: portfolios = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/portfolio"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/portfolio");
            return res.json();
        }
    });

    const filtered = (Array.isArray(portfolios) ? portfolios : []).filter(p => 
        (p.keyword || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.mainCategory || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-4 p-0 bg-[#f4f7f6] min-h-screen dark:bg-zinc-950">
            {/* Page Header */}
            <div className="px-6 py-4 bg-white border-b flex items-center justify-between dark:bg-zinc-900">
                <h1 className="text-[14px] font-bold text-gray-800 uppercase tracking-tight dark:text-zinc-100">VIEW ALL PORTFOLIO DESIGN</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 p-6">
                {/* Sidebar Filter */}
                <div className="w-full lg:w-64 flex flex-col gap-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-4 dark:bg-zinc-900 dark:border-zinc-800">
                        <h2 className="text-[13px] font-bold text-gray-700 mb-4 uppercase dark:text-zinc-400">Filter</h2>
                        
                        <div className="space-y-1">
                            <h3 className="text-[12px] font-bold text-gray-500 mb-2 dark:text-zinc-400">All Categories</h3>
                            {CATEGORIES.map((cat) => (
                                <div key={cat.name}>
                                    <div 
                                        className={cn(
                                            "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-[12px]",
                                            selectedCategory === cat.name ? "text-gray-900 font-bold" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                        )}
                                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? "" : (cat.name as string))}
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronRight className={cn("w-3 h-3 transition-transform", selectedCategory === cat.name && "rotate-90")} />
                                            <span>{cat.name}</span>
                                        </div>
                                        <span className="text-gray-600 font-bold dark:text-zinc-300">({cat.count})</span>
                                    </div>

                                    {selectedCategory === cat.name && (cat as any).subCategories && (
                                        <div className="ml-6 mt-1 space-y-2 mb-2">
                                            {(cat as any).subCategories.map((sub: any) => (
                                                <div key={sub.name} className="flex items-center justify-between text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer dark:text-zinc-400">
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox className="w-3.5 h-3.5 rounded-sm border-gray-300 dark:border-zinc-800" />
                                                        <span>{sub.name}</span>
                                                    </div>
                                                    <span>({sub.count})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 space-y-3">
                            <h3 className="text-[12px] font-bold text-gray-500 mb-2 dark:text-zinc-400">Design Overview</h3>
                            {DESIGN_OVERVIEW.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-[12px]">
                                    <div className="flex items-center gap-2">
                                        <Checkbox className="w-3.5 h-3.5" />
                                        <span className="text-gray-600 font-medium dark:text-zinc-300">{item.name}</span>
                                    </div>
                                    <span className="text-gray-400">({item.count})</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <h3 className="text-[12px] font-bold text-gray-500 mb-2 dark:text-zinc-400">Customer Rating</h3>
                            <Button className="w-full bg-[#00a65a] hover:bg-[#008d4c] text-white text-[12px] h-9 mt-4 shadow-none">
                                Load More
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-4">
                    <Card className="shadow-none border-gray-200 dark:border-zinc-800">
                        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            <h2 className="text-[14px] font-bold text-gray-700 uppercase dark:text-zinc-400">PORTFOLIO DESIGN</h2>
                            
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="h-9 pl-8 pr-3 text-[12px] border-gray-200 bg-gray-50 focus:bg-white dark:bg-zinc-900 dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-md dark:bg-zinc-900">
                                    <button 
                                        className={cn("p-1.5 rounded", viewMode === "grid" ? "bg-white dark:bg-zinc-900 shadow-sm text-[#00a65a]" : "text-gray-400")}
                                        onClick={() => setViewMode("grid")}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button 
                                        className={cn("p-1.5 rounded", viewMode === "list" ? "bg-white dark:bg-zinc-900 shadow-sm text-[#00a65a]" : "text-gray-400")}
                                        onClick={() => setViewMode("list")}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-2 mb-4">
                         <div className="bg-white border px-3 py-1 rounded-md flex items-center gap-2 dark:bg-zinc-900">
                             <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">Booking</span>
                             <span className="bg-red-500 text-white text-[10px] px-1 rounded-sm">0</span>
                         </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <Loader2 className="h-8 w-8 text-[#00a65a] animate-spin dark:text-zinc-400" />
                        </div>
                    ) : (
                        <div className={cn(
                            "grid gap-6",
                            viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1"
                        )}>
                            {filtered.length === 0 ? (
                                <div className="col-span-full h-64 flex flex-col items-center justify-center bg-white rounded-lg border border-dashed border-gray-300 dark:bg-zinc-900 dark:border-zinc-800">
                                    <ImageIcon className="w-12 h-12 text-gray-200 mb-2" />
                                    <p className="text-gray-400 text-[13px]">No portfolio designs found matching your filter.</p>
                                </div>
                            ) : (
                                filtered.map((item) => (
                                    <Card key={item.id} className="overflow-hidden shadow-none hover:shadow-md transition-shadow border-gray-200 group dark:border-zinc-800">
                                        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden dark:bg-zinc-900">
                                            {/* Portfolio Image */}
                                            {item.fullImage ? (
                                                <img 
                                                    src={item.fullImage} 
                                                    alt={item.keyword} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-200">
                                                    <ImageIcon className="w-12 h-12" />
                                                </div>
                                            )}
                                            
                                            {/* Top Badges */}
                                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                <div className="bg-[#00a65a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                    <span>BP</span>
                                                    <span>PKG</span>
                                                </div>
                                            </div>
                                        </div>
                                        <CardContent className="p-4 space-y-2">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-zinc-400">
                                                <User className="w-3 h-3" />
                                                <span>Design By: <span className="text-red-500 font-medium">{item.designBy || "Muhammad Tuqeer Razaq"}</span></span>
                                            </div>
                                            <h3 className="text-[13px] font-bold text-gray-800 line-clamp-1 dark:text-zinc-100">{item.keyword || "Sports Wear"}</h3>
                                            
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2 dark:border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                                                        item.status === "Used" ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                                                    )}>
                                                        {item.status || "un-used"}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-zinc-400">
                                                        <Calendar className="w-3 h-3" />
                                                        <span>{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                                <Checkbox className="w-3.5 h-3.5" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

