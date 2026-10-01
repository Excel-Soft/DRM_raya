import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiRequestJson } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Promotion = {
  id: string;
  bannerUrl: string | null;
  title?: string | null;
};

// Real company-wide (or role-targeted — see drm/promotion.tsx's Target Role
// field) banner carousel. GET /api/drm/promotions?scope=banner surfaces
// approved+active promotions, open to any authenticated role. Reusable: drop
// onto any dashboard.
export function PromotionBannerWidget() {
  const [bannerIndex, setBannerIndex] = useState(0);

  const promotionsQuery = useQuery<{ data: Promotion[] }>({
    queryKey: ["/api/drm/promotions", "banner"],
    queryFn: () => apiRequestJson<{ data: Promotion[] }>("GET", "/api/drm/promotions?scope=banner"),
  });
  const promotions = promotionsQuery.data?.data ?? [];
  const activeBanner = promotions[bannerIndex % Math.max(promotions.length, 1)];

  // Auto-advance every 4s when there's more than one banner to slide through.
  useEffect(() => {
    if (promotions.length <= 1) return;
    const id = setInterval(() => {
      setBannerIndex((i) => (i + 1) % promotions.length);
    }, 4000);
    return () => clearInterval(id);
  }, [promotions.length]);

  if (promotionsQuery.isLoading) {
    return (
      <Card className="dashboard-card overflow-hidden h-[185px] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!activeBanner?.bannerUrl) {
    return (
      <Card className="dashboard-card overflow-hidden h-[185px] flex items-center justify-center text-sm text-muted-foreground">
        No active promotions
      </Card>
    );
  }

  return (
    <Card className="dashboard-card overflow-hidden relative h-[185px] group">
      <img src={activeBanner.bannerUrl} alt={activeBanner.title || "Promotion Banner"} className="w-full h-full object-cover" />
      {activeBanner.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
          <p className="text-[13px] font-bold text-white">{activeBanner.title}</p>
        </div>
      )}
      {promotions.length > 1 && (
        <>
          <button
            onClick={() => setBannerIndex((i) => (i - 1 + promotions.length) % promotions.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:bg-white transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setBannerIndex((i) => (i + 1) % promotions.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 flex items-center justify-center shadow opacity-0 group-hover:opacity-100 hover:bg-white transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {promotions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === bannerIndex % promotions.length ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
