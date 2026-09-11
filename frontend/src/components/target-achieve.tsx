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

export function TargetAchieve({ onViewMore }: { onViewMore?: () => void }) {
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
    <Card className="overflow-hidden border border-border shadow-sm bg-card group hover:shadow-lg transition-all duration-300">
      <CardHeader className="p-5 pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-500" />
              Target Achieve
            </CardTitle>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">This Month Target</p>
          </div>
          {isPositive ? <TrendingUp className="h-5 w-5 text-emerald-500 opacity-50" /> : <TrendingDown className="h-5 w-5 text-rose-500 opacity-50" />}
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
                    stroke="hsl(var(--muted))"
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
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-foreground tracking-tighter">{Math.round(percentage)}%</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Achieved</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 bg-muted/50 rounded-xl p-3 border border-border">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Revenue</p>
                <p className="text-xl font-black text-foreground tracking-tight leading-none">${data?.achievedAmount?.toLocaleString() ?? 0}</p>
              </div>
              <div className="space-y-1 bg-muted/50 rounded-xl p-3 border border-border">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">Target</p>
                <p className="text-xl font-black text-foreground tracking-tight leading-none">${data?.targetAmount?.toLocaleString() ?? 0}</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <div className={cn("p-1.5 rounded-lg", isPositive ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400")}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Vs Last Period</p>
                  <p className={cn("text-xs font-black leading-none mt-1", isPositive ? "text-emerald-600" : "text-rose-600")}>
                    {isPositive ? "+" : ""}{Math.round(data?.deltaPercent ?? 0)}%
                  </p>
                </div>
              </div>

              {onViewMore ? (
                <Button variant="ghost" size="sm" onClick={onViewMore} className="h-8 text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 transition-colors">
                  View More
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              ) : (
                <Link href="/sales/targets?type=vas&period=thisMonth">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 transition-colors">
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
