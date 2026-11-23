import { PromotionBannerWidget } from "@/components/promotion-banner-widget";
import { cn } from "@/lib/utils";

/** Standard right-sidebar promotion block on role dashboards (Executive / Manager / Admin). */
export function DashboardPromotionAside({
  title = "Promotion Baners",
  className,
  titleClassName,
}: {
  title?: string;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <h2
        className={cn(
          "text-sm font-bold text-slate-800 tracking-tight dark:text-zinc-100",
          titleClassName,
        )}
      >
        {title}
      </h2>
      <PromotionBannerWidget />
    </div>
  );
}