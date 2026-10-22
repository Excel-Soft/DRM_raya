import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Phone,
  MessageCircle,
  PhoneCall,
  Users,
  MapPin,
  Mail,
  CalendarCheck,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityMethod = "mobile" | "whatsapp" | "wh_call" | "in_meeting" | "out_meeting" | "email" | "appointment" | "seminar";
type Period = "TD" | "WC" | "MC" | "QC" | "YC";

interface ActivityPlanRow {
  method: ActivityMethod;
  target: number;
  actualCount: number;
  targetPercent: number;
  actual: number;
  defaultTime: number;
}

interface ActivityPlanResponse {
  period: string;
  rows: ActivityPlanRow[];
  totalMinutes: number;
  current?: {
    period: string;
    from: string;
    to: string;
    totalMinutes: number;
    perMethodMinutes: Partial<Record<ActivityMethod, number>>;
  };
  future?: {
    period: string;
    from: string;
    to: string;
    projectedTotalMinutes: number;
  };
}

const activityLabels: Record<ActivityMethod, string> = {
  mobile: "Mobile",
  whatsapp: "Whatsapp",
  wh_call: "WH-Call",
  in_meeting: "In-meeting",
  out_meeting: "Out-meeting",
  email: "E-mail",
  appointment: "Appointment",
  seminar: "Seminar",
};

const activityIcons: Record<ActivityMethod, LucideIcon> = {
  mobile: Phone,
  whatsapp: MessageCircle,
  wh_call: PhoneCall,
  in_meeting: Users,
  out_meeting: MapPin,
  email: Mail,
  appointment: CalendarCheck,
  seminar: Mic,
};

const activityColors: Record<ActivityMethod, string> = {
  mobile: "bg-sky-500",
  whatsapp: "bg-emerald-500",
  wh_call: "bg-indigo-500",
  in_meeting: "bg-amber-500",
  out_meeting: "bg-rose-500",
  email: "bg-violet-500",
  appointment: "bg-cyan-500",
  seminar: "bg-pink-500",
};

export function ActivitiesGrid() {
  const [period, setPeriod] = useState<Period>("TD");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState({ from: "", to: "" });

  const queryUrl = activeDateFilter.from && activeDateFilter.to
    ? `/api/sales/activity-plan?from=${activeDateFilter.from}&to=${activeDateFilter.to}`
    : `/api/sales/activity-plan?period=${period}`;

  const { data, isLoading } = useQuery<ActivityPlanResponse>({
    queryKey: [queryUrl],
  });

  const handleGo = () => {
    if (dateFrom && dateTo) {
      setActiveDateFilter({ from: dateFrom, to: dateTo });
    }
  };

  const handleReset = () => {
    setDateFrom("");
    setDateTo("");
    setActiveDateFilter({ from: "", to: "" });
  };

  return (
    <Card className="rounded-2xl border border-border shadow-sm" data-testid="card-activities-grid">
      <div className="flex flex-col gap-4 border-b border-border p-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Activity className="h-[18px] w-[18px]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground tracking-tight">Activities</h3>
            <p className="text-xs text-muted-foreground">Call & meeting performance</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              className="w-[150px] rounded-lg h-8 pl-8 text-xs shadow-sm focus-visible:ring-emerald-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <span className="text-muted-foreground text-xs">to</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              className="w-[150px] rounded-lg h-8 pl-8 text-xs shadow-sm focus-visible:ring-emerald-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg h-8 px-4 text-xs font-medium shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1" onClick={handleGo}>Go</Button>
          <Button variant="secondary" className="rounded-lg h-8 px-4 text-xs font-medium shadow-sm transition-all" onClick={handleReset}>Reset</Button>
        </div>
      </div>
      <div className="p-5 pt-4">
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[1.3fr_1.7fr_0.8fr_0.8fr] gap-4 pb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <div>Method</div>
            <div>Target Progress</div>
            <div className="text-center">Talk Time</div>
            <div className="text-center">Default Time</div>
          </div>

          {/* Activity rows */}
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className="grid grid-cols-[1.3fr_1.7fr_0.8fr_0.8fr] gap-4 py-2.5 text-sm items-center border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
                <div className="flex justify-center">
                  <Skeleton className="h-6 w-[60px]" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-6 w-[60px]" />
                </div>
              </div>
            ))
          ) : (
            data?.rows.map((row) => {
              const Icon = activityIcons[row.method];
              const pct = Math.max(0, Math.min(100, row.targetPercent ?? 0));
              return (
                <div
                  key={row.method}
                  className="grid grid-cols-[1.3fr_1.7fr_0.8fr_0.8fr] gap-4 py-2.5 text-sm items-center border-b border-border last:border-0"
                  data-testid={`activity-row-${row.method}`}
                >
                  <div className="flex items-center gap-2.5 text-foreground">
                    <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white", activityColors[row.method])}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium">{activityLabels[row.method]}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", activityColors[row.method])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-[72px] shrink-0 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                      {row.actualCount ?? 0}/{row.target} · {pct}%
                    </span>
                  </div>
                  <div className="text-center">
                    <div className="rounded-lg bg-muted py-1 px-2 text-foreground font-semibold inline-block min-w-[56px] tabular-nums">
                      {row.actual}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="rounded-lg bg-muted py-1 px-2 text-foreground font-semibold inline-block min-w-[56px] tabular-nums">
                      {row.defaultTime}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Summary line */}
          {data && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-xl bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground">
              <span>Talk Time <b className="text-foreground">{data.totalMinutes}m</b></span>
              <span className="text-border">•</span>
              <span>Working Hours <b className="text-foreground">480m</b></span>
              <span className="text-border">•</span>
              <span>Spent <b className="text-foreground">{data.totalMinutes}m</b></span>
              <span className="text-border">•</span>
              <span>Free <b className="text-emerald-600 dark:text-emerald-400">{Math.max(0, 480 - data.totalMinutes)}m</b></span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
