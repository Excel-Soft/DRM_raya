import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { HeartPulse } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InServiceModal } from "@/components/in-service-modal";

type MetricKey =
    | "in_service"
    | "a_followup"
    | "b_plus_followup"
    | "followup_1"
    | "b_followup"
    | "followup_30_days"
    | "dropout_7_days"
    | "dropout_leads"
    | "bv_document"
    | "vas_document";

type Metrics = Record<Exclude<MetricKey, "in_service">, number>;

const metricRoutes: Record<MetricKey, string> = {
    in_service: "#",
    a_followup: "/service/a-customer",
    b_plus_followup: "/service/b-plus-customer",
    followup_1: "/service/b-customer",
    b_followup: "/service/b-minus-customer",
    followup_30_days: "/service/monthly-followup",
    dropout_7_days: "/service/weekly-dropout",
    dropout_leads: "/service/dropout-customer",
    bv_document: "/service/bv-document-list",
    vas_document: "/service/vas-document-list",
};

const orderedMetrics: { key: MetricKey; label: string }[] = [
    { key: "in_service", label: "In Service" },
    { key: "a_followup", label: "A- Followup" },
    { key: "b_plus_followup", label: "B+ Followup" },
    { key: "followup_1", label: "B Followup" },
    { key: "b_followup", label: "B- Followup" },
    { key: "followup_30_days", label: "30-Days Followup" },
    { key: "dropout_7_days", label: "7-Day Dropout" },
    { key: "dropout_leads", label: "Dropout Leads" },
    { key: "bv_document", label: "BV Document" },
    { key: "vas_document", label: "VAS Document" },
];

/** Shares its query-cache key with ImportantMetrics / NeedsAttentionCard —
 *  no extra request, just the "health" half of the same real metrics. */
export function FollowUpHealthCard() {
    const [isInServiceModalOpen, setIsInServiceModalOpen] = useState(false);
    const { data: metrics, isLoading } = useQuery<Metrics>({
        queryKey: ["/api/sales/important-metrics"],
    });

    return (
        <Card className="rounded-2xl border border-border shadow-sm">
            <CardHeader className="border-b border-border pb-4">
                <CardTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <HeartPulse className="h-4 w-4" />
                    </span>
                    Follow-up Health
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
                {isLoading ? (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 rounded-lg" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {orderedMetrics.map((metric) =>
                            metric.key === "in_service" ? (
                                <button
                                    key={metric.key}
                                    onClick={() => setIsInServiceModalOpen(true)}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-left transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                    data-testid={`followup-health-${metric.key}`}
                                >
                                    <span className="text-[13px] font-medium text-muted-foreground">{metric.label}</span>
                                    <span className="text-[13px] font-bold text-foreground">—</span>
                                </button>
                            ) : (
                                <Link
                                    key={metric.key}
                                    href={metricRoutes[metric.key]}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                    data-testid={`followup-health-${metric.key}`}
                                >
                                    <span className="text-[13px] font-medium text-muted-foreground">{metric.label}</span>
                                    <span className="text-[13px] font-bold text-foreground">{metrics?.[metric.key] ?? 0}</span>
                                </Link>
                            ),
                        )}
                    </div>
                )}
            </CardContent>

            <InServiceModal isOpen={isInServiceModalOpen} onClose={() => setIsInServiceModalOpen(false)} />
        </Card>
    );
}
