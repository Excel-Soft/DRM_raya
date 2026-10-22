import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Target, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

interface TargetSummary {
    achievedAmount: number;
    targetAmount: number;
    percent: number;
}

/** Same real endpoint TargetAchieve uses (shared query-cache key — no extra
 *  request), rendered as a compact donut + legend instead of the big gauge. */
export function TargetOverviewCard() {
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

    const percentage = Math.max(0, Math.min(100, data?.percent ?? 0));
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const target = data?.targetAmount ?? 0;
    const revenue = data?.achievedAmount ?? 0;
    const remaining = Math.max(0, target - revenue);

    return (
        <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Target className="h-4 w-4" />
                    </span>
                    Target Overview
                </CardTitle>
                <Link href="/sales/performance-evaluation?type=vas&period=thisMonth" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400">
                    View Details →
                </Link>
            </CardHeader>
            <CardContent className="flex items-center gap-5 pt-5">
                {isLoading ? (
                    <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
                ) : (
                    <div className="relative h-28 w-28 shrink-0">
                        <svg className="-rotate-90 h-full w-full">
                            <circle cx="56" cy="56" r={radius} stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                            <circle
                                cx="56"
                                cy="56"
                                r={radius}
                                stroke="#059669"
                                strokeWidth="10"
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-black text-foreground tracking-tighter">{Math.round(percentage)}%</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Achieved</span>
                        </div>
                    </div>
                )}

                <div className="flex-1 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-sky-500" /> Target
                        </span>
                        <span className="font-bold text-foreground tabular-nums">${target.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Revenue
                        </span>
                        <span className="font-bold text-foreground tabular-nums">${revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-amber-500" /> Remaining
                        </span>
                        <span className="font-bold text-foreground tabular-nums">${remaining.toLocaleString()}</span>
                    </div>
                </div>
            </CardContent>
            <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                    <p className="font-semibold">{target === 0 ? "Keep going!" : percentage >= 100 ? "Target achieved!" : "Keep going!"}</p>
                    <p className="text-emerald-700/80 dark:text-emerald-400/80">
                        {target === 0 ? "Set a target to start tracking progress." : `${Math.round(100 - percentage)}% left to hit this month's target.`}
                    </p>
                </div>
            </div>
        </Card>
    );
}
