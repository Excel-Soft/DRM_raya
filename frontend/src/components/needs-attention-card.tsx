import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, UserX, MessageSquareWarning, CalendarClock, Wallet, ListChecks, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ImportantMetrics {
    not_follow_yet: number;
    complaints: number;
    due_payment: number;
}

interface Appointment {
    id: string;
    company: string;
    purpose: string;
    time: string;
}

/** Shares its two query-cache keys with ImportantMetrics (service-exec pages)
 *  and the hero stat chips above — no extra network calls, just a different
 *  arrangement of the same real numbers. */
export function NeedsAttentionCard() {
    const { data: metrics, isLoading } = useQuery<ImportantMetrics>({
        queryKey: ["/api/sales/important-metrics"],
    });
    const { data: appointments, isLoading: apptLoading } = useQuery<Appointment[]>({
        queryKey: ["/api/sales/appointments/today"],
    });

    const nextAppt = appointments?.[0];
    const isLoadingAny = isLoading || apptLoading;

    const rows = [
        {
            key: "not_follow_yet",
            label: "Not Follow Yet",
            sublabel: "Customers waiting for follow-up",
            icon: UserX,
            iconBg: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
            count: metrics?.not_follow_yet ?? 0,
            href: "/service/not-follow-customer",
        },
        {
            key: "complaints",
            label: "Complaints",
            sublabel: "Open complaints",
            icon: MessageSquareWarning,
            iconBg: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
            count: metrics?.complaints ?? 0,
            href: "/service/complaint-list",
        },
        {
            key: "appointment",
            label: "Today Appointment",
            sublabel: nextAppt ? `${nextAppt.company} · ${nextAppt.purpose} · ${nextAppt.time}` : "No appointments today",
            icon: CalendarClock,
            iconBg: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
            count: appointments?.length ?? 0,
            href: undefined,
        },
        {
            key: "due_payment",
            label: "Due Payment",
            sublabel: "Awaiting payment",
            icon: Wallet,
            iconBg: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
            count: metrics?.due_payment ?? 0,
            href: "/service/due-vas-payment",
        },
    ];

    return (
        <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <AlertCircle className="h-4 w-4" />
                    </span>
                    Needs Attention
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-3">
                {isLoadingAny ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                            <Skeleton className="h-9 w-9 rounded-xl" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                    ))
                ) : (
                    <>
                        {rows.map((row) => {
                            const Icon = row.icon;
                            const content = (
                                <>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.iconBg}`}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold text-foreground">{row.label}</div>
                                            <div className="text-xs text-muted-foreground truncate">{row.sublabel}</div>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold text-foreground tabular-nums">{row.count}</span>
                                </>
                            );
                            return row.href ? (
                                <Link key={row.key} href={row.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60" data-testid={`needs-attention-${row.key}`}>
                                    {content}
                                </Link>
                            ) : (
                                <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5" data-testid={`needs-attention-${row.key}`}>
                                    {content}
                                </div>
                            );
                        })}

                        <Link href="/service/todo-list" className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60" data-testid="needs-attention-todo_list">
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                                    <ListChecks className="h-4 w-4" />
                                </span>
                                <div>
                                    <div className="text-sm font-semibold text-foreground">To Do List</div>
                                    <div className="text-xs text-muted-foreground">Your pending tasks</div>
                                </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
