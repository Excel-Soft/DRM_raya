import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SalesKpiCardProps {
  title: string;
  count: number;
  amount: number;
  icon: LucideIcon;
  className?: string;
  color?: string;
  iconBg?: string;
  isLoading?: boolean;
}

export function SalesKpiCard({
  title,
  count,
  amount,
  icon: Icon,
  className,
  color = "text-slate-600",
  iconBg = "bg-slate-500",
  isLoading = false
}: SalesKpiCardProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0 }).format(val);
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border border-white/60 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl transition-all duration-500 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1.5 rounded-2xl",
        className
      )}
      data-testid={`card-kpi-${title.toLowerCase().replace(/[\s\/]/g, '-')}`}
    >
      {/* Background Accent Gradient */}
      <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-700 bg-gradient-to-br", iconBg)} />

      <CardContent className="p-4 relative">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
              {title}
            </p>
            <div className="space-y-0.5 mt-2">
              {isLoading ? (
                <>
                  <div className="h-6 w-16 bg-slate-200/50 animate-pulse rounded-md dark:bg-zinc-800" />
                  <div className="h-4 w-20 bg-slate-200/50 animate-pulse rounded-md mt-1 dark:bg-zinc-800" />
                </>
              ) : (
                <>
                  <div
                    className="text-2xl font-black text-foreground tracking-tight leading-none uppercase"
                    data-testid={`text-count-${title.toLowerCase().replace(/[\s\/]/g, '-')}`}
                  >
                    {count}
                  </div>
                  <div
                    className={cn("text-xs font-bold tracking-wide flex items-center gap-1 mt-1", color)}
                    data-testid={`text-amount-${title.toLowerCase().replace(/[\s\/]/g, '-')}`}
                  >
                    <span className="opacity-60">$</span>
                    {formatCurrency(amount)}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-6",
            iconBg
          )}>
            <Icon className="h-7 w-7 transition-all duration-500 group-hover:scale-110" strokeWidth={2.5} />

            {/* Decorative Ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-white/20 scale-90 group-hover:scale-100 transition-transform duration-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
