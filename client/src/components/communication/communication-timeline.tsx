import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
    Phone,
    MessageCircle,
    Mail,
    Users,
    MapPin,
    StickyNote,
    Send,
    AlertTriangle,
    Loader2,
    Clock,
    CalendarClock,
} from "lucide-react";

/**
 * Stage 7 — reusable communication / follow-up timeline.
 *
 * Mirrors WorkflowTimeline. Reads the unified communication log via
 * GET /api/communications/:entityType/:entityId/timeline and renders a
 * chronological feed with channel / outcome / date / user filters applied
 * client-side. Safe to drop into any entity detail view (customer, lead,
 * service_customer, …).
 */

export type CommunicationEntityType =
    | "customer"
    | "lead"
    | "service_customer"
    | "opportunity"
    | "appointment"
    | "complaint"
    | "renewal"
    | "other";

type CommunicationLogRow = {
    id: string;
    entity_type: string;
    entity_id: string;
    customer_id: string | null;
    lead_id: string | null;
    user_id: string | null;
    channel: string;
    outcome: string | null;
    notes: string | null;
    next_action: string | null;
    next_followup_at: string | null;
    status: string;
    created_at: string;
    updated_at: string;
};

const CHANNELS = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT", "SMS", "NOTE", "OTHER"] as const;
const OUTCOMES = [
    "INTERESTED",
    "NOT_INTERESTED",
    "CALLBACK",
    "NO_RESPONSE",
    "CONVERTED",
    "COMPLAINT",
    "RENEWAL",
    "RESOLVED",
    "DROPOUT_RISK",
    "OTHER",
] as const;

const CHANNEL_META: Record<string, { icon: any; dot: string }> = {
    CALL: { icon: Phone, dot: "bg-emerald-500" },
    WHATSAPP: { icon: MessageCircle, dot: "bg-green-500" },
    EMAIL: { icon: Mail, dot: "bg-sky-500" },
    MEETING: { icon: Users, dot: "bg-indigo-500" },
    VISIT: { icon: MapPin, dot: "bg-amber-500" },
    SMS: { icon: Send, dot: "bg-cyan-500" },
    NOTE: { icon: StickyNote, dot: "bg-gray-400" },
    OTHER: { icon: StickyNote, dot: "bg-gray-400" },
};

function channelMeta(channel: string) {
    return CHANNEL_META[channel] ?? CHANNEL_META.OTHER;
}

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

export function CommunicationTimeline({
    entityType,
    entityId,
    className,
}: {
    entityType?: CommunicationEntityType | null;
    entityId?: string | null;
    className?: string;
}) {
    const enabled = !!entityType && !!entityId;

    const [channelFilter, setChannelFilter] = useState<string>("");
    const [outcomeFilter, setOutcomeFilter] = useState<string>("");
    const [userFilter, setUserFilter] = useState<string>("");
    const [fromDate, setFromDate] = useState<string>("");
    const [toDate, setToDate] = useState<string>("");

    const query = useQuery({
        queryKey: ["/api/communications", entityType, entityId, "timeline"],
        enabled,
        queryFn: () =>
            apiRequestJson<{ success: boolean; data: CommunicationLogRow[] }>(
                "GET",
                `/api/communications/${entityType}/${entityId}/timeline`,
            ),
    });

    const rows = query.data?.data ?? [];

    const userOptions = useMemo(() => {
        const set = new Set<string>();
        rows.forEach((r) => r.user_id && set.add(r.user_id));
        return Array.from(set);
    }, [rows]);

    const filtered = useMemo(() => {
        const fromMs = fromDate ? new Date(fromDate).getTime() : null;
        const toMs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
        return rows.filter((r) => {
            if (channelFilter && r.channel !== channelFilter) return false;
            if (outcomeFilter && r.outcome !== outcomeFilter) return false;
            if (userFilter && r.user_id !== userFilter) return false;
            const ts = formatTimestamp(r.created_at);
            if (!ts) return false;
            if (fromMs !== null && ts.ms < fromMs) return false;
            if (toMs !== null && ts.ms > toMs) return false;
            return true;
        });
    }, [rows, channelFilter, outcomeFilter, userFilter, fromDate, toDate]);

    if (!enabled) return null;

    const isLoading = query.isLoading;
    const isError = query.isError;

    const selectCls =
        "text-[12px] border rounded px-2 py-1 bg-white dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100";

    return (
        <div className={cn("bg-white rounded-lg border shadow-sm dark:bg-zinc-900 dark:border-zinc-800", className)}>
            <div className="px-4 py-3 border-b flex items-center gap-2 dark:border-zinc-800">
                <Clock className="h-4 w-4 text-[#00a65a] dark:text-zinc-400" />
                <h3 className="text-[14px] font-bold text-gray-800 dark:text-zinc-100">Communication Timeline</h3>
            </div>

            <div className="px-4 py-3 border-b flex flex-wrap gap-2 items-center dark:border-zinc-800">
                <select
                    className={selectCls}
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    data-testid="filter-channel"
                >
                    <option value="">All channels</option>
                    {CHANNELS.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <select
                    className={selectCls}
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    data-testid="filter-outcome"
                >
                    <option value="">All outcomes</option>
                    {OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                {userOptions.length > 0 && (
                    <select
                        className={selectCls}
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        data-testid="filter-user"
                    >
                        <option value="">All users</option>
                        {userOptions.map((u) => (
                            <option key={u} value={u}>
                                {u.slice(0, 8)}…
                            </option>
                        ))}
                    </select>
                )}
                <input
                    type="date"
                    className={selectCls}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    data-testid="filter-from"
                />
                <input
                    type="date"
                    className={selectCls}
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    data-testid="filter-to"
                />
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
                        <span className="text-[13px] font-medium">Failed to load communication timeline.</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 dark:text-zinc-500 italic text-[13px]">
                        No communications recorded for this record yet.
                    </div>
                ) : (
                    <ol className="relative ml-2 border-l border-gray-200 dark:border-zinc-700">
                        {filtered.map((row) => {
                            const meta = channelMeta(row.channel);
                            const Icon = meta.icon;
                            const ts = formatTimestamp(row.created_at);
                            const nextTs = formatTimestamp(row.next_followup_at);
                            return (
                                <li key={row.id} className="mb-5 ml-5 last:mb-0">
                                    <span
                                        className={cn(
                                            "absolute -left-[11px] flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900",
                                            meta.dot,
                                        )}
                                    >
                                        <Icon className="h-3 w-3 text-white" />
                                    </span>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[13px] font-semibold text-gray-800 dark:text-zinc-100">
                                                {row.channel}
                                                {row.outcome && (
                                                    <span className="ml-2 inline-block rounded-full bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-zinc-300">
                                                        {row.outcome}
                                                    </span>
                                                )}
                                                {row.status && row.status !== "COMPLETED" && (
                                                    <span className="ml-2 inline-block rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                                        {row.status}
                                                    </span>
                                                )}
                                            </p>
                                            <time className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                                                {ts?.label ?? ""}
                                            </time>
                                        </div>
                                        {row.notes && (
                                            <p className="text-[12px] text-gray-500 dark:text-zinc-400 break-words">
                                                {row.notes}
                                            </p>
                                        )}
                                        {row.next_action && (
                                            <p className="text-[12px] text-gray-600 dark:text-zinc-300">
                                                Next: {row.next_action}
                                            </p>
                                        )}
                                        {nextTs && (
                                            <p className="flex items-center gap-1 text-[11px] text-[#00a65a] dark:text-emerald-400">
                                                <CalendarClock className="h-3 w-3" />
                                                Follow-up due {nextTs.label}
                                            </p>
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

export default CommunicationTimeline;
