import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MyGmCommissionWidget } from "@/components/my-gm-commission-widget";

/** Reuses the New/Renew/Expire counts already fetched by the dashboard's KPI
 *  row (/api/sales/overview) — the real customer status values this app has
 *  (not the Active/Pending/Inactive labels from the design reference, which
 *  don't exist as a field in this schema). */
export function CustomerOverviewCard({
    total,
    newCount,
    renewCount,
    expireCount,
    isLoading,
}: {
    total: number;
    newCount: number;
    renewCount: number;
    expireCount: number;
    isLoading?: boolean;
}) {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const safeTotal = Math.max(total, 1);
    const newLen = (newCount / safeTotal) * circumference;
    const renewLen = (renewCount / safeTotal) * circumference;
    const expireLen = (expireCount / safeTotal) * circumference;

    const segments = [
        { color: "#0ea5e9", len: newLen, offset: 0 },
        { color: "#059669", len: renewLen, offset: newLen },
        { color: "#f59e0b", len: expireLen, offset: newLen + renewLen },
    ];

    return (
        <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                        <Users className="h-4 w-4" />
                    </span>
                    Customer Overview
                </CardTitle>
                <Link href="/sales/customers" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400">
                    View All →
                </Link>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="flex items-center gap-5">
                {isLoading ? (
                    <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
                ) : (
                    <div className="relative h-28 w-28 shrink-0">
                        <svg className="-rotate-90 h-full w-full">
                            <circle cx="56" cy="56" r={radius} stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                            {total > 0 &&
                                segments.map((s, i) =>
                                    s.len > 0 ? (
                                        <circle
                                            key={i}
                                            cx="56"
                                            cy="56"
                                            r={radius}
                                            stroke={s.color}
                                            strokeWidth="10"
                                            fill="none"
                                            strokeDasharray={`${s.len} ${circumference - s.len}`}
                                            strokeDashoffset={-s.offset}
                                            strokeLinecap="butt"
                                        />
                                    ) : null,
                                )}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-foreground tracking-tighter">{total}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Customers</span>
                        </div>
                    </div>
                )}

                <div className="flex-1 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-sky-500" /> New
                        </span>
                        <span className="font-bold text-foreground tabular-nums">{newCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Renew
                        </span>
                        <span className="font-bold text-foreground tabular-nums">{renewCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-amber-500" /> Expire
                        </span>
                        <span className="font-bold text-foreground tabular-nums">{expireCount}</span>
                    </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <MyGmCommissionWidget />
              </div>
            </CardContent>
        </Card>
    );
}
