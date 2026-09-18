import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightCircle } from "lucide-react";
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
    <Card className="border-0 shadow-sm" data-testid="card-activities-grid">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 pb-2">
        <h3 className="text-lg font-bold text-slate-700 dark:text-zinc-400 tracking-tight">Activities</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            className="w-[140px] rounded-md h-8 text-xs border-slate-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all dark:bg-zinc-900 dark:border-zinc-800"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            className="w-[140px] rounded-md h-8 text-xs border-slate-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 transition-all dark:bg-zinc-900 dark:border-zinc-800"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md h-8 px-4 text-xs font-medium shadow-sm transition-all focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1" onClick={handleGo}>Go</Button>
          <Button variant="secondary" className="bg-slate-600 hover:bg-slate-700 text-white rounded-md h-8 px-4 text-xs font-medium shadow-sm transition-all focus:ring-2 focus:ring-slate-500 focus:ring-offset-1" onClick={handleReset}>Reset</Button>
        </div>
      </div>
      <div className="p-4 pt-2">
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 pb-2 text-sm font-bold text-[#446077] dark:text-zinc-400">
            <div className="pl-2">Method</div>
            <div className="text-center">Target</div>
            <div className="text-center">Talk Time</div>
            <div className="text-center">Default Time</div>
          </div>

          {/* Activity rows */}
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={`skel-${i}`}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 py-1.5 text-sm items-center border-b border-gray-100 last:border-0 dark:border-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="text-center flex justify-center">
                  <Skeleton className="h-6 w-[80px]" />
                </div>
                <div className="text-center flex justify-center">
                  <Skeleton className="h-6 w-[80px]" />
                </div>
                <div className="text-center flex justify-center">
                  <Skeleton className="h-6 w-[80px]" />
                </div>
              </div>
            ))
          ) : (
            data?.rows.map((row) => {
              return (
                <div
                  key={row.method}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-4 py-1.5 text-sm items-center border-b border-gray-100 last:border-0 dark:border-zinc-800"
                  data-testid={`activity-row-${row.method}`}
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-400">
                    <ArrowRightCircle className="w-4 h-4 text-emerald-500" />
                    <span>{activityLabels[row.method]}</span>
                  </div>
                  <div className="text-center">
                    <div className="bg-[#f0f0f0] py-1 px-2 text-slate-700 font-medium inline-block min-w-[80px] dark:bg-zinc-900 dark:text-zinc-400">
                      {row.target} ({row.actualCount ?? 0}) {row.targetPercent}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-[#f0f0f0] py-1 px-2 text-slate-700 font-medium inline-block min-w-[80px] dark:bg-zinc-900 dark:text-zinc-400">
                      {row.actual}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="bg-[#f0f0f0] py-1 px-2 text-slate-700 font-medium inline-block min-w-[80px] dark:bg-zinc-900 dark:text-zinc-400">
                      {row.defaultTime}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Summary line */}
          {data && (
            <div className="pt-4 text-sm text-center text-slate-700 dark:text-zinc-400">
              Talk Time ({data.totalMinutes}) W-H 8(480 M) Spent({data.totalMinutes} M) Free({Math.max(0, 480 - data.totalMinutes)} M)
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
