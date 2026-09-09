import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ArrowRight, RefreshCw, Link as LinkIcon, AlertTriangle, Loader2, Clock } from "lucide-react";

type TimelineModule = "product-posting" | "software";

type StatusHistoryRow = {
    id: string;
    taskId?: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    changedAt?: string | null;
    notes?: string | null;
    user?: { id: string; name: string | null } | null;
};

type EvidenceLinkRow = {
    id: string;
    url?: string | null;
    label?: string | null;
    linkType?: string | null;
    createdAt?: string | null;
};

type TimelineEvent = {
    id: string;
    at: number;
    atLabel: string;
    kind: "status" | "rework" | "evidence";
    title: string;
    detail?: string | null;
    actor?: string | null;
};

function formatTimestamp(value?: string | null): { ms: number; label: string } | null {
    if (!value) return null;
    const d = new Date(value);
    const ms = d.getTime();
    if (isNaN(ms)) return null;
    return {
        ms,
        label: d.toLocaleString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }),
    };
}

const KIND_META: Record<TimelineEvent["kind"], { icon: any; dot: string; iconColor: string }> = {
    status: { icon: ArrowRight, dot: "bg-emerald-500", iconColor: "text-white" },
    rework: { icon: RefreshCw, dot: "bg-amber-500", iconColor: "text-white" },
    evidence: { icon: LinkIcon, dot: "bg-sky-500", iconColor: "text-white" },
};

export function WorkflowTimeline({
    taskId,
    module = "product-posting",
    className,
}: {
    taskId?: string | null;
    module?: TimelineModule;
    className?: string;
}) {
    const enabled = !!taskId;

    const statusQuery = useQuery({
        queryKey: ["/api/pms/tasks", taskId, "status-history"],
        enabled,
        queryFn: () => apiRequestJson<StatusHistoryRow[]>("GET", `/api/pms/tasks/${taskId}/status-history`),
    });

    const reworkQuery = useQuery({
        queryKey: [`/api/${module}/task`, taskId, "rework-history"],
        enabled,
        queryFn: () =>
            apiRequestJson<{ success: boolean; data: StatusHistoryRow[] }>(
                "GET",
                `/api/${module}/task/${taskId}/rework-history`,
            ),
    });

    const evidenceQuery = useQuery({
        queryKey: [`/api/${module}/task`, taskId, "report-links"],
        enabled,
        queryFn: () =>
            apiRequestJson<{ success: boolean; data: EvidenceLinkRow[] }>(
                "GET",
                `/api/${module}/task/${taskId}/report-links`,
            ),
    });

    if (!enabled) return null;

    const isLoading = statusQuery.isLoading || reworkQuery.isLoading || evidenceQuery.isLoading;
    const isError = statusQuery.isError || reworkQuery.isError || evidenceQuery.isError;

    const buildEvents = (): TimelineEvent[] => {
        const events: TimelineEvent[] = [];
        const seenStatusIds = new Set<string>();

        const pushStatusRow = (row: StatusHistoryRow, kind: "status" | "rework") => {
            if (!row?.id || seenStatusIds.has(row.id)) return;
            const ts = formatTimestamp(row.changedAt);
            if (!ts) return;
            seenStatusIds.add(row.id);
            const from = row.fromStatus || "—";
            const to = row.toStatus || "—";
            events.push({
                id: `status-${row.id}`,
                at: ts.ms,
                atLabel: ts.label,
                kind,
                title: `${from} → ${to}`,
                detail: row.notes || null,
                actor: row.user?.name || null,
            });
        };

        // Rework history first so its kind label wins on dedupe (more specific context).
        (reworkQuery.data?.data || []).forEach((row) => pushStatusRow(row, "rework"));
        (statusQuery.data || []).forEach((row) => pushStatusRow(row, "status"));

        (evidenceQuery.data?.data || []).forEach((row) => {
            const ts = formatTimestamp(row.createdAt);
            if (!ts) return;
            events.push({
                id: `evidence-${row.id}`,
                at: ts.ms,
                atLabel: ts.label,
                kind: "evidence",
                title: row.label ? `Evidence link: ${row.label}` : "Evidence link added",
                detail: row.url || null,
                actor: null,
            });
        });

        return events.sort((a, b) => a.at - b.at);
    };

    const events = !isLoading && !isError ? buildEvents() : [];

    return (
        <div className={cn("bg-white rounded-lg border shadow-sm dark:bg-zinc-900 dark:border-zinc-800", className)}>
            <div className="px-4 py-3 border-b flex items-center gap-2 dark:border-zinc-800">
                <Clock className="h-4 w-4 text-[#00a65a] dark:text-zinc-400" />
                <h3 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Workflow Timeline</h3>
            </div>

            <div className="p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-gray-400 dark:text-zinc-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-[13px] font-medium">Loading timeline…</span>
                    </div>
                ) : isError ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-rose-500">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-[13px] font-medium">Failed to load workflow timeline.</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 dark:text-zinc-500 italic text-[13px]">
                        No workflow activity recorded for this task yet.
                    </div>
                ) : (
                    <ol className="relative ml-2 border-l border-gray-200 dark:border-zinc-700">
                        {events.map((event) => {
                            const meta = KIND_META[event.kind];
                            const Icon = meta.icon;
                            return (
                                <li key={event.id} className="mb-5 ml-5 last:mb-0">
                                    <span
                                        className={cn(
                                            "absolute -left-[11px] flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900",
                                            meta.dot,
                                        )}
                                    >
                                        <Icon className={cn("h-3 w-3", meta.iconColor)} />
                                    </span>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[13px] font-semibold text-gray-800 dark:text-zinc-100">
                                                {event.title}
                                            </p>
                                            <time className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                                                {event.atLabel}
                                            </time>
                                        </div>
                                        {event.detail && (
                                            event.kind === "evidence" ? (
                                                <a
                                                    href={event.detail.startsWith("http") ? event.detail : `https://${event.detail}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[12px] text-[#00a65a] hover:underline break-all dark:text-emerald-400"
                                                >
                                                    {event.detail}
                                                </a>
                                            ) : (
                                                <p className="text-[12px] text-gray-500 dark:text-zinc-400 break-words">
                                                    {event.detail}
                                                </p>
                                            )
                                        )}
                                        {event.actor && (
                                            <p className="text-[11px] text-gray-400 dark:text-zinc-500">by {event.actor}</p>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </div>
    );
}

export default WorkflowTimeline;
