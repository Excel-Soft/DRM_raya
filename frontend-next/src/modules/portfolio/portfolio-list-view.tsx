"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Lock,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as LegacyButton } from "@/components/ui/legacy/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import { cn } from "@/lib/utils/cn";
import { PORTFOLIO_ADD } from "@/lib/navigation/portfolio-routes";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useAuth } from "@/providers/auth-provider";
import {
  type PortfolioRow,
  parsePortfolioList,
  portfolioCategoryLabel,
  portfolioDisplayTitle,
  portfolioImageSrc,
  portfolioUsageStatus,
} from "@/modules/portfolio/portfolio-data";
import { PortfolioNavTabs } from "@/modules/portfolio/portfolio-nav";
import {
  DrmSection,
  PORTFOLIO_RESERVATION_LOCK_HOURS,
  PortfolioSectionToolbar,
  PortfolioShell,
  computePortfolioReservationLiveStatus,
  fmtPortfolioDate,
} from "@/modules/portfolio/portfolio-ui";

type ReservationRow = {
  id: string;
  portfolioId: string;
  companyName?: string | null;
  customerCompanyName?: string | null;
  status: string;
  expiresAt: string;
};

function normalizeReservation(raw: unknown): ReservationRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const portfolioId =
    typeof o.portfolioId === "string" ? o.portfolioId : typeof o.portfolio_id === "string" ? o.portfolio_id : null;
  const status = typeof o.status === "string" ? o.status : null;
  const expiresAt =
    typeof o.expiresAt === "string" ? o.expiresAt : typeof o.expires_at === "string" ? o.expires_at : null;
  if (!id || !portfolioId || !status || !expiresAt) return null;
  return {
    id,
    portfolioId,
    status,
    expiresAt,
    companyName: typeof o.companyName === "string" ? o.companyName : null,
    customerCompanyName: typeof o.customerCompanyName === "string" ? o.customerCompanyName : null,
  };
}

function usageBadgeClass(usage: ReturnType<typeof portfolioUsageStatus>): string {
  if (usage === "booked") return "bg-blue-600";
  if (usage === "reserved") return "bg-orange-500";
  return "bg-zinc-400";
}

function usageLabel(usage: ReturnType<typeof portfolioUsageStatus>): string {
  if (usage === "booked") return "Booked";
  if (usage === "reserved") return "Reserved";
  return "Un-used";
}

export function PortfolioListView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [reserveTarget, setReserveTarget] = useState<{ id: string; keyword: string } | null>(null);
  const [reserveCompanyName, setReserveCompanyName] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [extendTarget, setExtendTarget] = useState<string | null>(null);
  const [extendReason, setExtendReason] = useState("");

  const isVerificationManager = user?.role === "verification_manager" || user?.role === "admin";

  const { data: portfolioList = [], isLoading, isError, refetch } = useQuery<PortfolioRow[]>({
    queryKey: ["/api/portfolio"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/portfolio");
      if (!res.ok) throw new Error("Failed to load portfolios");
      const raw = await res.json();
      return parsePortfolioList(raw);
    },
  });

  const { data: reservations = [] } = useQuery<ReservationRow[]>({
    queryKey: ["/api/portfolio/reservations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/portfolio/reservations");
      const raw = await res.json();
      const arr = Array.isArray(raw) ? raw : [];
      return arr.map(normalizeReservation).filter((r): r is ReservationRow => r !== null);
    },
    refetchInterval: 60_000,
  });

  const reservationByPortfolio = useMemo(() => {
    const map = new Map<string, ReservationRow>();
    for (const r of reservations) {
      if (!map.has(r.portfolioId)) map.set(r.portfolioId, r);
    }
    return map;
  }, [reservations]);

  const reserveMutation = useMutation({
    mutationFn: async ({ portfolioId, companyName }: { portfolioId: string; companyName: string }) => {
      const res = await apiRequest("POST", `/api/portfolio/${portfolioId}/reserve`, {
        companyName: companyName.trim() || undefined,
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed to reserve portfolio");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Portfolio reserved",
        description: `Locked for ${PORTFOLIO_RESERVATION_LOCK_HOURS} hours pending verification.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
      setReserveTarget(null);
      setReserveCompanyName("");
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
      toast({ title: "Reservation confirmed", description: "The portfolio is now booked." });
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
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
      toast({ title: "Reservation rejected", description: "The lock has been released." });
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
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
        hours: PORTFOLIO_RESERVATION_LOCK_HOURS,
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed to extend reservation");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Reservation extended",
        description: `New expiry set ${PORTFOLIO_RESERVATION_LOCK_HOURS} hours from now.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/portfolio/reservations"] });
      setExtendTarget(null);
      setExtendReason("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const categories = useMemo(() => {
    const mainMap = new Map<string, { count: number; subMap: Map<string, number> }>();
    for (const p of portfolioList) {
      const main = p.mainCategory?.trim() || "Uncategorized";
      if (!mainMap.has(main)) mainMap.set(main, { count: 0, subMap: new Map() });
      const entry = mainMap.get(main)!;
      entry.count++;
      const sub = p.subCategory?.trim();
      if (sub) entry.subMap.set(sub, (entry.subMap.get(sub) || 0) + 1);
    }
    return Array.from(mainMap.entries())
      .map(([name, { count, subMap }]) => ({
        name,
        count,
        subCategories: Array.from(subMap.entries()).map(([subName, subCount]) => ({ name: subName, count: subCount })),
      }))
      .sort((a, b) => b.count - a.count);
  }, [portfolioList]);

  const statusOverview = useMemo(() => {
    let unUsed = 0;
    let reserved = 0;
    let booked = 0;
    for (const p of portfolioList) {
      const r = reservationByPortfolio.get(p.id);
      const live = r ? computePortfolioReservationLiveStatus(r) : null;
      const effectiveLive = live === "expired" || live === "rejected" ? null : live;
      const usage = portfolioUsageStatus(effectiveLive);
      if (usage === "booked") booked++;
      else if (usage === "reserved") reserved++;
      else unUsed++;
    }
    return [
      { name: "Un-used", count: unUsed, color: "bg-zinc-400" },
      { name: "Reserved", count: reserved, color: "bg-orange-500" },
      { name: "Booked", count: booked, color: "bg-blue-600" },
    ];
  }, [portfolioList, reservationByPortfolio]);

  const pendingVerificationCount = useMemo(() => {
    let count = 0;
    reservationByPortfolio.forEach((r) => {
      if (computePortfolioReservationLiveStatus(r) === "active") count++;
    });
    return count;
  }, [reservationByPortfolio]);

  const hasActiveFilters = Boolean(selectedCategory || selectedSubCategory || search.trim());

  const filtered = portfolioList.filter((p) => {
    const title = portfolioDisplayTitle(p).toLowerCase();
    const catLine = portfolioCategoryLabel(p).toLowerCase();
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || title.includes(q) || catLine.includes(q) || (p.serverLink || "").toLowerCase().includes(q);
    const main = p.mainCategory?.trim() || "Uncategorized";
    const matchesCategory = !selectedCategory || main === selectedCategory;
    const matchesSub = !selectedSubCategory || (p.subCategory || "") === selectedSubCategory;
    return matchesSearch && matchesCategory && matchesSub;
  });

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedSubCategory("");
    setSearch("");
  };

  const renderCard = (item: PortfolioRow) => {
    const reservation = reservationByPortfolio.get(item.id);
    const liveStatus = reservation ? computePortfolioReservationLiveStatus(reservation) : null;
    const effectiveLive = liveStatus === "expired" || liveStatus === "rejected" ? null : liveStatus;
    const isLocked = effectiveLive === "active" || effectiveLive === "confirmed";
    const usage = portfolioUsageStatus(effectiveLive);
    const hoursLeft =
      reservation && effectiveLive === "active"
        ? Math.max(0, Math.ceil((new Date(reservation.expiresAt).getTime() - Date.now()) / (60 * 60 * 1000)))
        : null;
    const thumb = portfolioImageSrc(item);
    const title = portfolioDisplayTitle(item);
    const categoryLine = portfolioCategoryLabel(item);
    const liveHref = item.serverLink
      ? item.serverLink.startsWith("http")
        ? item.serverLink
        : `https://${item.serverLink}`
      : null;

    return (
      <article
        key={item.id}
        className={cn(
          "overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950",
          viewMode === "list" && "flex flex-col sm:flex-row",
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900",
            viewMode === "grid" ? "aspect-[4/3] w-full" : "aspect-[16/10] w-full sm:w-52 md:w-64",
          )}
        >
          {thumb ? (
            <img src={thumb} alt={title} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full min-h-[140px] items-center justify-center text-zinc-300">
              <ImageIcon className="h-10 w-10" aria-hidden />
            </div>
          )}
          <span className="absolute left-2 top-2 max-w-[85%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
            {categoryLine}
          </span>
          <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
            {effectiveLive === "active" && (
              <span className="flex items-center gap-1 rounded bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {hoursLeft}h left
              </span>
            )}
            {effectiveLive === "confirmed" && (
              <span className="flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                Booked
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {liveHref ? (
              <a
                href={liveHref}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                title="Open live link"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <span className={cn("rounded px-2 py-0.5 text-[9px] font-bold uppercase text-white", usageBadgeClass(usage))}>
              {usageLabel(usage)}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Calendar className="h-3 w-3" aria-hidden />
              {fmtPortfolioDate(item.createdAt)}
            </span>
          </div>

          {isLocked && reservation && (
            <p className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock className="h-3 w-3" aria-hidden />
              {reservation.companyName || reservation.customerCompanyName || "Reserved"}
              {effectiveLive === "active" ? ` · expires ${new Date(reservation.expiresAt).toLocaleString()}` : " · confirmed"}
            </p>
          )}

          {!isLocked && (
            <LegacyButton
              type="button"
              size="sm"
              variant="outline"
              className="mt-auto h-8 w-full border-orange-300 text-[11px] text-orange-700 hover:bg-orange-50"
              onClick={() => setReserveTarget({ id: item.id, keyword: title })}
            >
              <Lock className="mr-1 h-3 w-3" aria-hidden />
              Reserve for {PORTFOLIO_RESERVATION_LOCK_HOURS}h
            </LegacyButton>
          )}

          {isVerificationManager && effectiveLive === "active" && reservation && (
            <div className="flex gap-1.5 pt-1">
              <Button
                type="button"
                size="sm"
                className="h-8 flex-1 bg-emerald-600 text-[11px] hover:bg-emerald-700"
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate(reservation.id)}
              >
                Confirm
              </Button>
              <LegacyButton type="button" size="sm" variant="outline" className="h-8 flex-1 text-[11px]" onClick={() => setExtendTarget(reservation.id)}>
                Extend
              </LegacyButton>
              <LegacyButton type="button" size="sm" variant="destructive" className="h-8 flex-1 text-[11px]" onClick={() => setRejectTarget(reservation.id)}>
                Reject
              </LegacyButton>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <PortfolioShell
      title="View portfolio designs"
      description="Browse designs, filter by category, and manage 48-hour reservation locks."
      actions={<PortfolioNavTabs />}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,260px)_1fr] lg:items-start">
        <DrmSection title="Filters" className="lg:sticky lg:top-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Categories</p>
            {hasActiveFilters ? (
              <button type="button" className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400" onClick={clearFilters}>
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-[320px] space-y-0.5 overflow-y-auto pr-1">
            {categories.length === 0 ? (
              <p className="text-xs italic text-zinc-400">No categories yet.</p>
            ) : (
              categories.map((cat) => (
                <div key={cat.name}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition",
                      selectedCategory === cat.name
                        ? "bg-emerald-50 font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                        : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900",
                    )}
                    onClick={() => {
                      if (selectedCategory === cat.name) {
                        setSelectedCategory("");
                        setSelectedSubCategory("");
                      } else {
                        setSelectedCategory(cat.name);
                        setSelectedSubCategory("");
                      }
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronRight className={cn("h-3 w-3", selectedCategory === cat.name && "rotate-90")} aria-hidden />
                      {cat.name}
                    </span>
                    <span className="font-semibold tabular-nums">({cat.count})</span>
                  </button>
                  {selectedCategory === cat.name && cat.subCategories.length > 0 && (
                    <ul className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-800">
                      {cat.subCategories.map((sub) => (
                        <li key={sub.name}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between rounded px-1.5 py-1 text-[11px] transition",
                              selectedSubCategory === sub.name
                                ? "bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
                            )}
                            onClick={() => setSelectedSubCategory(selectedSubCategory === sub.name ? "" : sub.name)}
                          >
                            <span>{sub.name}</span>
                            <span className="tabular-nums">({sub.count})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Availability</p>
            {statusOverview.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <span className={cn("h-2 w-2 rounded-full", item.color)} aria-hidden />
                  {item.name}
                </span>
                <span className="tabular-nums text-zinc-400">({item.count})</span>
              </div>
            ))}
          </div>
        </DrmSection>

        <DrmSection title="Gallery">
          <PortfolioSectionToolbar
            leading={
              <>
                <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">Booking queue</span>
                  <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">{pendingVerificationCount}</span>
                </span>
                <span className="text-xs text-zinc-500">
                  Showing <strong className="text-zinc-800 dark:text-zinc-200">{filtered.length}</strong> of {portfolioList.length}
                </span>
              </>
            }
            trailing={
              <>
                <div className="relative w-full min-w-[200px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
                  <Input
                    placeholder="Search keyword, category, link…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>
                <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
                  <button
                    type="button"
                    className={cn("rounded-md p-1.5", viewMode === "grid" ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800" : "text-zinc-400")}
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={cn("rounded-md p-1.5", viewMode === "list" ? "bg-white text-emerald-600 shadow-sm dark:bg-zinc-800" : "text-zinc-400")}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <ListIcon className="h-4 w-4" />
                  </button>
                </div>
              </>
            }
          />

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
            </div>
          ) : isError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-300">Could not load portfolio designs.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
              <ImageIcon className="h-12 w-12 text-zinc-200" aria-hidden />
              <p className="text-sm text-zinc-500">
                {portfolioList.length === 0 ? "No portfolio designs yet." : "No designs match your filters."}
              </p>
              {portfolioList.length === 0 ? (
                <Link
                  href={PORTFOLIO_ADD}
                  className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Add first design
                </Link>
              ) : hasActiveFilters ? (
                <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className={cn("grid gap-4", viewMode === "grid" ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1")}>
              {filtered.map(renderCard)}
            </div>
          )}
        </DrmSection>
      </div>

      <Dialog open={!!reserveTarget} onOpenChange={(open) => !open && (setReserveTarget(null), setReserveCompanyName(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve portfolio</DialogTitle>
            <DialogDescription>
              Locks &quot;{reserveTarget?.keyword}&quot; for {PORTFOLIO_RESERVATION_LOCK_HOURS} hours while it is presented for booking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reserved for (company / customer)</Label>
            <Input placeholder="e.g. Acme Corp" value={reserveCompanyName} onChange={(e) => setReserveCompanyName(e.target.value)} />
          </div>
          <DialogFooter>
            <LegacyButton type="button" variant="outline" onClick={() => (setReserveTarget(null), setReserveCompanyName(""))}>
              Cancel
            </LegacyButton>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={reserveMutation.isPending}
              onClick={() => reserveTarget && reserveMutation.mutate({ portfolioId: reserveTarget.id, companyName: reserveCompanyName })}
            >
              {reserveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Reserve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && (setRejectTarget(null), setRejectReason(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject reservation</DialogTitle>
            <DialogDescription>Releases the lock immediately so the design can be reserved again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this reservation being rejected?" />
          </div>
          <DialogFooter>
            <LegacyButton type="button" variant="outline" onClick={() => (setRejectTarget(null), setRejectReason(""))}>
              Cancel
            </LegacyButton>
            <LegacyButton
              type="button"
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ reservationId: rejectTarget, reason: rejectReason })}
            >
              Reject
            </LegacyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!extendTarget} onOpenChange={(open) => !open && (setExtendTarget(null), setExtendReason(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend reservation lock</DialogTitle>
            <DialogDescription>
              Pushes the expiry {PORTFOLIO_RESERVATION_LOCK_HOURS} hours from now. A reason is required and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea value={extendReason} onChange={(e) => setExtendReason(e.target.value)} placeholder="Why does this lock need more time?" />
          </div>
          <DialogFooter>
            <LegacyButton type="button" variant="outline" onClick={() => (setExtendTarget(null), setExtendReason(""))}>
              Cancel
            </LegacyButton>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={extendMutation.isPending || !extendReason.trim()}
              onClick={() => extendTarget && extendMutation.mutate({ reservationId: extendTarget, reason: extendReason })}
            >
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortfolioShell>
  );
}
