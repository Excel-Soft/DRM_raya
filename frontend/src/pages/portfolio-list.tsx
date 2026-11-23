import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getAuthHeader, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Search,
    LayoutGrid,
    List as ListIcon,
    ChevronRight,
    Calendar,
    User,
    Loader2,
    Image as ImageIcon,
    Lock,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";

const RESERVATION_LOCK_HOURS = 48;

type PortfolioCategoryTaxonomy = {
    mainCategories: { id: string; name: string }[];
    subCategoriesByMainId: Record<string, { id: string; name: string }[]>;
};

function normalizeDesignStatus(raw?: string | null): string {
    const s = (raw || "un-used").trim().toLowerCase();
    if (s === "used") return "Used";
    if (s === "un-used" || s === "unused") return "Un-Used";
    if (s === "rejected") return "Rejected";
    if (s === "changing") return "Changing";
    if (s === "reserved") return "Reserved";
    return raw?.trim() || "Un-Used";
}

function portfolioOverviewStatus(
    item: { status?: string },
    reservation: { status: string; expiresAt: string } | undefined,
): string {
    const live = reservation ? computeLiveStatus(reservation) : null;
    if (live === "active" || live === "confirmed") return "Reserved";
    return normalizeDesignStatus(item.status);
}

function portfolioThumbSrc(item: { fullImage?: string; bodyImage?: string; topHeaderImage?: string }) {
    return item.fullImage || item.bodyImage || item.topHeaderImage || "";
}

function ReserveCompanySearch({
    value,
    customerId,
    onChange,
    disabled,
}: {
    value: string;
    customerId: string;
    onChange: (next: { customerId: string; companyName: string }) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 280);
        return () => clearTimeout(t);
    }, [search]);

    const { data: companies = [], isFetching } = useQuery<{ id: string; companyName: string; drmId?: string }[]>({
        queryKey: ["/api/customers/search", debounced],
        queryFn: async () => {
            const q = debounced || "a";
            const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}&limit=25`, {
                headers: { ...getAuthHeader() },
                credentials: "include",
            });
            const json = await res.json();
            return (json.customers as { id: string; companyName: string; drmId?: string }[]) || [];
        },
        enabled: open,
        staleTime: 30_000,
    });

    return (
        <Popover open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={disabled}
                    className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
                >
                    <span className="truncate">{value || "Search company name or DRM ID"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Type company name…" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{isFetching ? "Searching…" : "No company found."}</CommandEmpty>
                        <CommandGroup>
                            {companies.map((c) => {
                                const label = c.drmId ? `${c.companyName} (${c.drmId})` : c.companyName;
                                return (
                                    <CommandItem
                                        key={c.id}
                                        value={label}
                                        onSelect={() => {
                                            onChange({ customerId: c.id, companyName: c.companyName });
                                            setOpen(false);
                                        }}
                                    >
                                        {label}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// MD-21: Portfolio Reserve — a 48h lock on a portfolio while it's being
// presented to a customer/company for booking. The DB row only ever stores a
// human decision ('active' | 'confirmed' | 'rejected'); an 'active'
// reservation that has passed its expiry is treated as released here, on the
// client, purely for display — the server is the source of truth for
// `liveStatus` and re-computes it the same way on every request.
function computeLiveStatus(r: { status: string; expiresAt: string }): "active" | "confirmed" | "rejected" | "expired" {
    if (r.status === "active" && new Date(r.expiresAt).getTime() <= Date.now()) return "expired";
    return r.status as "active" | "confirmed" | "rejected";
}

export default function PortfolioList() {
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedSubCategory, setSelectedSubCategory] = useState("");
    const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({});
    const [reserveTarget, setReserveTarget] = useState<{ id: string; keyword: string } | null>(null);
    const [reserveCompanyName, setReserveCompanyName] = useState("");
    const [reserveCustomerId, setReserveCustomerId] = useState("");
    const [detailTarget, setDetailTarget] = useState<string | null>(null);
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [extendTarget, setExtendTarget] = useState<string | null>(null);
    const [extendReason, setExtendReason] = useState("");

    const { data: portfolios = [], isLoading } = useQuery<any[]>({
        queryKey: ["/api/portfolio"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/portfolio");
            return res.json();
        }
    });

    const { data: currentUser } = useQuery<any>({
        queryKey: ["/api/auth/me"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/auth/me");
            return res.json();
        }
    });
    const isVerificationManager = currentUser?.role === "verification_manager" || currentUser?.role === "admin";

    const { data: categoryTaxonomy } = useQuery<PortfolioCategoryTaxonomy>({
        queryKey: ["/api/portfolio/categories"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/portfolio/categories");
            return res.json();
        },
    });

    const { data: detailPortfolio, isLoading: detailLoading } = useQuery<any>({
        queryKey: ["/api/portfolio", detailTarget],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/portfolio/${detailTarget}`);
            return res.json();
        },
        enabled: !!detailTarget,
    });

    const { data: reservations = [] } = useQuery<any[]>({
        queryKey: ["/api/portfolio/reservations"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/portfolio/reservations");
            return res.json();
        },
        refetchInterval: 60_000, // keep the 48h countdown / auto-release state reasonably fresh
    });

    // Most recent reservation per portfolio (the list is already ordered newest-first).
    const reservationByPortfolio = useMemo(() => {
        const map = new Map<string, any>();
        for (const r of Array.isArray(reservations) ? reservations : []) {
            if (!map.has(r.portfolioId)) map.set(r.portfolioId, r);
        }
        return map;
    }, [reservations]);

    const reserveMutation = useMutation({
        mutationFn: async ({
            portfolioId,
            companyName,
            customerId,
        }: {
            portfolioId: string;
            companyName: string;
            customerId?: string;
        }) => {
            const res = await apiRequest("POST", `/api/portfolio/${portfolioId}/reserve`, {
                companyName: companyName.trim() || undefined,
                customerId: customerId || undefined,
            });
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to reserve portfolio");
            return body;
        },
        onSuccess: () => {
            toast({ title: "Portfolio Reserved", description: `Locked for ${RESERVATION_LOCK_HOURS} hours pending verification.` });
            queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
            setReserveTarget(null);
            setReserveCompanyName("");
            setReserveCustomerId("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const confirmMutation = useMutation({
        mutationFn: async (reservationId: string) => {
            const res = await apiRequest("POST", `/api/portfolio/reservations/${reservationId}/confirm`);
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to confirm reservation");
            return body;
        },
        onSuccess: () => {
            toast({ title: "Reservation Confirmed", description: "The portfolio is now booked." });
            queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ reservationId, reason }: { reservationId: string; reason: string }) => {
            const res = await apiRequest("POST", `/api/portfolio/reservations/${reservationId}/reject`, {
                reason: reason.trim() || undefined,
            });
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to reject reservation");
            return body;
        },
        onSuccess: () => {
            toast({ title: "Reservation Rejected", description: "The lock has been released." });
            queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
            setRejectTarget(null);
            setRejectReason("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const extendMutation = useMutation({
        mutationFn: async ({ reservationId, reason }: { reservationId: string; reason: string }) => {
            const res = await apiRequest("POST", `/api/portfolio/reservations/${reservationId}/extend`, {
                reason: reason.trim(),
                hours: RESERVATION_LOCK_HOURS,
            });
            const body = await res.json();
            if (!res.ok || !body.success) throw new Error(body.message || "Failed to extend reservation");
            return body;
        },
        onSuccess: () => {
            toast({ title: "Reservation Extended", description: `New expiry set ${RESERVATION_LOCK_HOURS} hours from now.` });
            queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
            setExtendTarget(null);
            setExtendReason("");
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const portfolioList = Array.isArray(portfolios) ? portfolios : [];

    // Category/sub-category filter list + counts, computed from the real portfolio rows
    // instead of a hardcoded list that didn't match what "Add Portfolio" actually lets you pick.
    const categories = useMemo(() => {
        const mainMap = new Map<string, { count: number; subMap: Map<string, number> }>();
        for (const p of portfolioList) {
            const main = (p.mainCategory || "Uncategorized").trim() || "Uncategorized";
            if (!mainMap.has(main)) mainMap.set(main, { count: 0, subMap: new Map() });
            const entry = mainMap.get(main)!;
            entry.count++;
            const sub = (p.subCategory || "").trim();
            if (sub) entry.subMap.set(sub, (entry.subMap.get(sub) || 0) + 1);
        }

        const mains = categoryTaxonomy?.mainCategories;
        if (mains?.length) {
            return mains.map((m) => {
                const fromData = mainMap.get(m.name);
                const subsFromApi = categoryTaxonomy.subCategoriesByMainId?.[m.id] ?? [];
                return {
                    name: m.name,
                    count: fromData?.count ?? 0,
                    subCategories: subsFromApi.map((s) => ({
                        name: s.name,
                        count: fromData?.subMap.get(s.name) ?? 0,
                    })),
                };
            });
        }

        return Array.from(mainMap.entries())
            .map(([name, { count, subMap }]) => ({
                name,
                count,
                subCategories: Array.from(subMap.entries()).map(([subName, subCount]) => ({ name: subName, count: subCount })),
            }))
            .sort((a, b) => b.count - a.count);
    }, [portfolioList, categoryTaxonomy]);

    // Design/status overview counts, computed from the real portfolio rows.
    // Portfolios don't yet have a "status" column, so every row is "Un-Used" until some
    // other flow (e.g. a real reservation/usage feature) sets one.
    const statusOverview = useMemo(() => {
        const counts: Record<string, number> = { Used: 0, "Un-Used": 0, Rejected: 0, Changing: 0, Reserved: 0 };
        for (const p of portfolioList) {
            const bucket = portfolioOverviewStatus(p, reservationByPortfolio.get(p.id));
            if (bucket in counts) counts[bucket]++;
            else counts["Un-Used"]++;
        }
        return [
            { name: "Used", count: counts.Used, color: "bg-green-500" },
            { name: "Un-Used", count: counts["Un-Used"], color: "bg-gray-400" },
            { name: "Rejected", count: counts.Rejected, color: "bg-red-500" },
            { name: "Changing", count: counts.Changing, color: "bg-blue-500" },
            { name: "Reserved", count: counts.Reserved, color: "bg-orange-500" },
        ];
    }, [portfolioList, reservationByPortfolio]);

    const activeStatusFilters = useMemo(
        () => Object.entries(statusFilters).filter(([, on]) => on).map(([name]) => name),
        [statusFilters],
    );

    // Reservations awaiting a Verification Manager action (confirm/reject/extend)
    // before their 48h lock auto-releases.
    const pendingVerificationCount = useMemo(() => {
        let count = 0;
        reservationByPortfolio.forEach((r) => {
            if (computeLiveStatus(r) === "active") count++;
        });
        return count;
    }, [reservationByPortfolio]);

    const filtered = portfolioList.filter((p) => {
        const matchesSearch =
            (p.keyword || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.mainCategory || "").toLowerCase().includes(search.toLowerCase()) ||
            (p.designBy || "").toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !selectedCategory || (p.mainCategory || "Uncategorized") === selectedCategory;
        const matchesSubCategory = !selectedSubCategory || (p.subCategory || "") === selectedSubCategory;
        const overview = portfolioOverviewStatus(p, reservationByPortfolio.get(p.id));
        const matchesStatus =
            activeStatusFilters.length === 0 || activeStatusFilters.includes(overview);
        return matchesSearch && matchesCategory && matchesSubCategory && matchesStatus;
    });

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
                            {categories.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic py-1">No categories yet.</p>
                            ) : (
                                categories.map((cat) => (
                                    <div key={cat.name}>
                                        <div
                                            className={cn(
                                                "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors text-[12px]",
                                                selectedCategory === cat.name ? "text-gray-900 font-bold" : "text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                            )}
                                            onClick={() => {
                                                const next = selectedCategory === cat.name ? "" : cat.name;
                                                setSelectedCategory(next);
                                                setSelectedSubCategory("");
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronRight className={cn("w-3 h-3 transition-transform", selectedCategory === cat.name && "rotate-90")} />
                                                <span>{cat.name}</span>
                                            </div>
                                            <span className="text-gray-600 font-bold dark:text-zinc-300">({cat.count})</span>
                                        </div>

                                        {selectedCategory === cat.name && cat.subCategories.length > 0 && (
                                            <div className="ml-6 mt-1 space-y-2 mb-2">
                                                {cat.subCategories.map((sub) => (
                                                    <div
                                                        key={sub.name}
                                                        className="flex items-center justify-between text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer dark:text-zinc-400"
                                                        onClick={() => setSelectedSubCategory(selectedSubCategory === sub.name ? "" : sub.name)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                className="w-3.5 h-3.5 rounded-sm border-gray-300 dark:border-zinc-800"
                                                                checked={selectedSubCategory === sub.name}
                                                                onCheckedChange={(checked) =>
                                                                    setSelectedSubCategory(checked ? sub.name : "")
                                                                }
                                                            />
                                                            <span className={cn(selectedSubCategory === sub.name && "font-semibold text-gray-800")}>{sub.name}</span>
                                                        </div>
                                                        <span>({sub.count})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-8 space-y-3">
                            <h3 className="text-[12px] font-bold text-gray-500 mb-2 dark:text-zinc-400">Design Overview</h3>
                            {statusOverview.map((item) => (
                                <div
                                    key={item.name}
                                    className="flex items-center justify-between text-[12px] cursor-pointer"
                                    onClick={() =>
                                        setStatusFilters((prev) => ({ ...prev, [item.name]: !prev[item.name] }))
                                    }
                                >
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            className="w-3.5 h-3.5"
                                            checked={!!statusFilters[item.name]}
                                            onCheckedChange={(checked) =>
                                                setStatusFilters((prev) => ({ ...prev, [item.name]: !!checked }))
                                            }
                                        />
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
                         <div className="bg-white border px-3 py-1 rounded-md flex items-center gap-2 dark:bg-zinc-900" title="Reservations awaiting Verification Manager action">
                             <span className="text-[12px] font-bold text-[#00a65a] dark:text-zinc-400">Booking</span>
                             <span className="bg-red-500 text-white text-[10px] px-1 rounded-sm">{pendingVerificationCount}</span>
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
                                filtered.map((item) => {
                                    const reservation = reservationByPortfolio.get(item.id);
                                    const liveStatus = reservation ? computeLiveStatus(reservation) : null;
                                    const isLocked = liveStatus === "active" || liveStatus === "confirmed";
                                    const hoursLeft = reservation && liveStatus === "active"
                                        ? Math.max(0, Math.ceil((new Date(reservation.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000)))
                                        : null;
                                    const thumb = portfolioThumbSrc(item);
                                    const displayStatus = portfolioOverviewStatus(item, reservation);
                                    return (
                                    <Card key={item.id} className="overflow-hidden shadow-none hover:shadow-md transition-shadow border-gray-200 group dark:border-zinc-800">
                                        <div
                                            className="relative aspect-[4/3] bg-gray-100 overflow-hidden dark:bg-zinc-900 cursor-pointer"
                                            onClick={() => setDetailTarget(item.id)}
                                        >
                                            {/* Portfolio Image */}
                                            {thumb ? (
                                                <img
                                                    src={thumb}
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
                                                {liveStatus === "active" && (
                                                    <div className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                        <Lock className="w-2.5 h-2.5" />
                                                        <span>{hoursLeft}h left</span>
                                                    </div>
                                                )}
                                                {liveStatus === "confirmed" && (
                                                    <div className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                                                        <Lock className="w-2.5 h-2.5" />
                                                        <span>Booked</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <CardContent className="p-4 space-y-2">
                                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-zinc-400">
                                                <User className="w-3 h-3" />
                                                <span>Design By: <span className="text-red-500 font-medium">{item.designBy || "—"}</span></span>
                                            </div>
                                            <h3 className="text-[13px] font-bold text-gray-800 line-clamp-1 dark:text-zinc-100">{item.keyword || "Sports Wear"}</h3>

                                            <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2 dark:border-zinc-800">
                                                <div className="flex items-center gap-3">
                                                    <span className={cn(
                                                        "text-[9px] font-bold px-2 py-0.5 rounded uppercase",
                                                        displayStatus === "Used" && "bg-green-500 text-white",
                                                        displayStatus === "Un-Used" && "bg-gray-400 text-white",
                                                        displayStatus === "Rejected" && "bg-red-500 text-white",
                                                        displayStatus === "Changing" && "bg-blue-500 text-white",
                                                        displayStatus === "Reserved" && "bg-orange-500 text-white",
                                                    )}>
                                                        {displayStatus}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-zinc-400">
                                                        <Calendar className="w-3 h-3" />
                                                        <span>{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                                <Checkbox className="w-3.5 h-3.5" />
                                            </div>

                                            {/* MD-21: Portfolio Reserve */}
                                            {isLocked && reservation && (
                                                <div className="text-[10px] text-gray-500 dark:text-zinc-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {reservation.companyName || reservation.customerCompanyName || "Reserved"}
                                                        {liveStatus === "active" ? ` · expires ${new Date(reservation.expiresAt).toLocaleString()}` : " · confirmed"}
                                                    </span>
                                                </div>
                                            )}

                                            {!isLocked && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full h-8 text-[11px] border-orange-300 text-orange-600 hover:bg-orange-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReserveTarget({ id: item.id, keyword: item.keyword || "this design" });
                                                    }}
                                                >
                                                    <Lock className="w-3 h-3 mr-1" />
                                                    Reserve for {RESERVATION_LOCK_HOURS}h
                                                </Button>
                                            )}

                                            {isVerificationManager && liveStatus === "active" && reservation && (
                                                <div className="flex items-center gap-1.5 pt-1">
                                                    <Button
                                                        size="sm"
                                                        className="flex-1 h-8 text-[11px] bg-[#00a65a] hover:bg-[#008d4c]"
                                                        disabled={confirmMutation.isPending}
                                                        onClick={() => confirmMutation.mutate(reservation.id)}
                                                    >
                                                        Confirm
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 h-8 text-[11px] border-gray-300 text-gray-600"
                                                        onClick={() => setExtendTarget(reservation.id)}
                                                    >
                                                        Extend
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="flex-1 h-8 text-[11px]"
                                                        onClick={() => setRejectTarget(reservation.id)}
                                                    >
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* MD-21: Reserve dialog */}
            <Dialog open={!!reserveTarget} onOpenChange={(open) => { if (!open) { setReserveTarget(null); setReserveCompanyName(""); setReserveCustomerId(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reserve Portfolio</DialogTitle>
                        <DialogDescription>
                            Locks "{reserveTarget?.keyword}" for {RESERVATION_LOCK_HOURS} hours while it's presented for booking.
                            It auto-releases if a Verification Manager takes no action before then.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Reserved For (Company / Customer)</Label>
                        <ReserveCompanySearch
                            value={reserveCompanyName}
                            customerId={reserveCustomerId}
                            disabled={reserveMutation.isPending}
                            onChange={({ customerId, companyName }) => {
                                setReserveCustomerId(customerId);
                                setReserveCompanyName(companyName);
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setReserveTarget(null); setReserveCompanyName(""); setReserveCustomerId(""); }}>Cancel</Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c]"
                            disabled={reserveMutation.isPending}
                            onClick={() =>
                                reserveTarget &&
                                reserveMutation.mutate({
                                    portfolioId: reserveTarget.id,
                                    companyName: reserveCompanyName,
                                    customerId: reserveCustomerId,
                                })
                            }
                        >
                            {reserveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Reserve
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Portfolio design detail (legacy full template preview) */}
            <Dialog open={!!detailTarget} onOpenChange={(open) => { if (!open) setDetailTarget(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{detailPortfolio?.keyword || "Portfolio design"}</DialogTitle>
                        <DialogDescription>
                            {detailPortfolio?.mainCategory}
                            {detailPortfolio?.subCategory ? ` · ${detailPortfolio.subCategory}` : ""}
                            {detailPortfolio?.designBy ? ` · Design by ${detailPortfolio.designBy}` : ""}
                        </DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-[#00a65a]" />
                        </div>
                    ) : detailPortfolio ? (
                        <div className="space-y-4 border rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                            {detailPortfolio.topHeaderImage ? (
                                <img src={detailPortfolio.topHeaderImage} alt="Header" className="w-full" />
                            ) : null}
                            {Array.isArray(detailPortfolio.sliders) && detailPortfolio.sliders.length > 0 ? (
                                <div className="flex gap-2 overflow-x-auto px-2 py-2 bg-gray-50 dark:bg-zinc-900">
                                    {detailPortfolio.sliders.map((src: string, i: number) => (
                                        <img key={i} src={src} alt={`Slide ${i + 1}`} className="h-40 shrink-0 rounded border object-cover" />
                                    ))}
                                </div>
                            ) : null}
                            {detailPortfolio.bodyImage ? (
                                <img src={detailPortfolio.bodyImage} alt="Body" className="w-full" />
                            ) : null}
                            {detailPortfolio.fullImage ? (
                                <img src={detailPortfolio.fullImage} alt="Main" className="w-full" />
                            ) : null}
                            {!detailPortfolio.topHeaderImage && !detailPortfolio.bodyImage && !detailPortfolio.fullImage && (
                                <p className="text-sm text-muted-foreground p-4">No preview images available for this design.</p>
                            )}
                            {detailPortfolio.serverLink ? (
                                <p className="text-[11px] text-gray-500 px-4 pb-4 break-all">
                                    Server path: {detailPortfolio.serverLink}
                                </p>
                            ) : null}
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MD-21: Reject dialog */}
            <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Reservation</DialogTitle>
                        <DialogDescription>Releases the lock immediately so the design can be reserved again.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Reason (optional)</Label>
                        <Textarea
                            placeholder="Why is this reservation being rejected?"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={rejectMutation.isPending}
                            onClick={() => rejectTarget && rejectMutation.mutate({ reservationId: rejectTarget, reason: rejectReason })}
                        >
                            {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MD-21: Extend dialog — a reason is required, along with the acting user and an audit log entry (both handled server-side) */}
            <Dialog open={!!extendTarget} onOpenChange={(open) => { if (!open) { setExtendTarget(null); setExtendReason(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Extend Reservation Lock</DialogTitle>
                        <DialogDescription>Pushes the expiry {RESERVATION_LOCK_HOURS} hours from now. A reason is required and recorded in the audit log.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label className="text-[13px] font-semibold text-gray-600 dark:text-zinc-300">Reason (required)</Label>
                        <Textarea
                            placeholder="Why does this lock need more time?"
                            value={extendReason}
                            onChange={(e) => setExtendReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setExtendTarget(null); setExtendReason(""); }}>Cancel</Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c]"
                            disabled={extendMutation.isPending || !extendReason.trim()}
                            onClick={() => extendTarget && extendMutation.mutate({ reservationId: extendTarget, reason: extendReason })}
                        >
                            {extendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Extend
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

