import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Target, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthHeader } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface TargetSummary {
  achievedAmount: number;
  targetAmount: number;
  percent: number;
  previousPercent: number;
  deltaPercent: number;
}

export function TargetAchieve({ onViewMore, dark = false }: { onViewMore?: () => void; dark?: boolean }) {
  const { data, isLoading } = useQuery<TargetSummary>({
    queryKey: ["/api/sales/targets/summary?type=vas&period=thisMonth"],
    queryFn: async () => {
      const res = await fetch("/api/sales/targets/summary?type=vas&period=thisMonth", {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to load target summary");
      return res.json();
    },
  });

  const percentage = data?.percent || 0;
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const isPositive = (data?.deltaPercent ?? 0) >= 0;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl shadow-sm group transition-all duration-300",
        dark
          ? "border-0 bg-gradient-to-br from-[hsl(var(--hero-from))] to-[hsl(var(--hero-to))] text-white hover:shadow-lg"
          : "border border-border bg-card hover:shadow-lg",
      )}
    >
      <CardHeader className={cn("p-5 pb-2 border-b", dark ? "border-white/10" : "border-border")}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className={cn("text-base font-bold flex items-center gap-2 tracking-tight", dark ? "text-white" : "text-foreground")}>
              <Target className={cn("h-5 w-5", dark ? "text-[hsl(var(--hero-accent))]" : "text-emerald-500")} />
              Target Achievement
            </CardTitle>
            <p className={cn("text-[10px] font-black uppercase tracking-widest leading-none", dark ? "text-white/60" : "text-muted-foreground")}>This Month Target</p>
          </div>
          {isPositive ? (
            <TrendingUp className={cn("h-5 w-5 opacity-50", dark ? "text-[hsl(var(--hero-accent))]" : "text-emerald-500")} />
          ) : (
            <TrendingDown className="h-5 w-5 opacity-50 text-rose-400" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-2 space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            <div className="flex justify-center relative py-2">
              <Skeleton className="w-44 h-44 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
            <div className="flex items-center justify-between px-1">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        ) : (
          <>
            {/* Radial Gauge */}
            <div className="flex justify-center relative py-2">
              <div className="relative w-44 h-44">
                <svg className="transform -rotate-90 w-full h-full">
                  {/* Background circle */}
                  <circle
                    cx="88"
                    cy="88"
                    r={radius}
                    stroke={dark ? "rgba(255,255,255,0.15)" : "hsl(var(--muted))"}
                    strokeWidth="14"
                    fill="none"
                  />
                  {/* Progress circle with gradient */}
                  <circle
                    cx="88"
                    cy="88"
                    r={radius}
                    stroke="url(#gauge-gradient)"
                    strokeWidth="14"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={dark ? "#6ee7b7" : "#047857"} />
                      <stop offset="100%" stopColor={dark ? "#d1fae5" : "#34d399"} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn("text-4xl font-black tracking-tighter", dark ? "text-white" : "text-foreground")}>{Math.round(percentage)}%</span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-widest", dark ? "text-white/60" : "text-muted-foreground")}>Achieved</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className={cn("space-y-1 rounded-xl p-3 border", dark ? "bg-white/10 border-white/10" : "bg-muted/50 border-border")}>
                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none", dark ? "text-white/60" : "text-muted-foreground")}>Revenue</p>
                <p className={cn("text-xl font-black tracking-tight leading-none", dark ? "text-white" : "text-foreground")}>${data?.achievedAmount?.toLocaleString() ?? 0}</p>
              </div>
              <div className={cn("space-y-1 rounded-xl p-3 border", dark ? "bg-white/10 border-white/10" : "bg-muted/50 border-border")}>
                <p className={cn("text-[9px] font-black uppercase tracking-widest leading-none", dark ? "text-white/60" : "text-muted-foreground")}>Target</p>
                <p className={cn("text-xl font-black tracking-tight leading-none", dark ? "text-white" : "text-foreground")}>${data?.targetAmount?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "p-1.5 rounded-lg",
                  dark
                    ? "bg-white/10 text-[hsl(var(--hero-accent))]"
                    : isPositive ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                )}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
                <div>
                  <p className={cn("text-[9px] font-bold uppercase tracking-widest leading-none", dark ? "text-white/60" : "text-muted-foreground")}>Vs Last Period</p>
                  <p className={cn("text-xs font-black leading-none mt-1", dark ? "text-white" : isPositive ? "text-emerald-600" : "text-rose-600")}>
                    {isPositive ? "+" : ""}{Math.round(data?.deltaPercent ?? 0)}%
                  </p>
                </div>
              </div>

              {onViewMore ? (
                <Button variant="ghost" size="sm" onClick={onViewMore} className={cn("h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors", dark ? "text-white hover:bg-white/10" : "text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40")}>
                  View More
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              ) : (
                <Link href="/sales/performance-evaluation?type=vas&period=thisMonth">
                  <Button variant="ghost" size="sm" className={cn("h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-colors", dark ? "text-white hover:bg-white/10" : "text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40")}>
                    View More
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
