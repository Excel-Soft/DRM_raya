import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info, Calendar, Loader2, CheckCircle2, XCircle, Download, Clock, AlertTriangle, ShieldCheck, ChevronDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Visual language ported from the legacy abreport.php admin theme ───
const HEADING_GREEN = "#099153";
const HEADING_GREEN_DARK = "#018b4d";
const BOX_BORDER = "border-[#8080804d] dark:border-zinc-700";

function fmt(n: number | string | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Tooltip({ children, text }: { children: ReactNode; text: string }) {
  return (
    <span className="group/tip relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-[#535353] px-2 py-1 text-[9px] font-medium text-white opacity-0 shadow transition-opacity duration-150 group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div
      className="py-1.5 text-center text-[13px] font-semibold uppercase tracking-wide text-white"
      style={{ backgroundColor: HEADING_GREEN }}
    >
      {title}
    </div>
  );
}

type Breakdown = {
  label: string; count: number | string; amount: number | string; onView?: () => void;
  action?: { label: string; onClick: () => void };
};

function MetricRow({
  label, count, amount, prefix = "", infoTooltip, breakdown, highlight, onView,
}: {
  label: string; count: number | string; amount: number | string; prefix?: string;
  infoTooltip?: string; breakdown?: Breakdown[]; highlight?: boolean; onView?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasBreakdown = !!breakdown?.length;
  return (
    <>
      <tr
        className={`h-8 border-b ${BOX_BORDER} ${hasBreakdown ? "cursor-pointer hover:bg-emerald-50 dark:hover:bg-zinc-800" : ""} ${highlight ? "bg-emerald-50/70 dark:bg-emerald-900/10" : ""}`}
        onClick={() => hasBreakdown && setOpen((o) => !o)}
      >
        <td className="py-1 px-2 text-[11px] font-medium capitalize text-slate-700 dark:text-zinc-300">
          <span className="inline-flex items-center gap-1">
            {label}
            {onView ? (
              <Tooltip text={infoTooltip || `View ${label}`}>
                <button onClick={(e) => { e.stopPropagation(); onView(); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-500">
                  <Eye className="h-3 w-3" />
                </button>
              </Tooltip>
            ) : infoTooltip && (
              <Tooltip text={infoTooltip}><Info className="h-3 w-3 text-slate-400" /></Tooltip>
            )}
            {hasBreakdown && <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />}
          </span>
        </td>
        <td className="px-2 py-1 text-[11px] font-bold text-slate-600 dark:text-zinc-400">{count}</td>
        <td className={`px-2 py-1 text-right text-[11px] font-bold ${highlight ? "text-emerald-700 dark:text-emerald-400" : "text-emerald-600"}`}>
          {prefix}{typeof amount === "number" ? fmt(amount) : amount}
        </td>
      </tr>
      {open && breakdown!.map((b, i) => b.action ? (
        <tr key={i} className={`border-b ${BOX_BORDER}`}>
          <td colSpan={3} className="p-0">
            <button
              onClick={(e) => { e.stopPropagation(); b.action!.onClick(); }}
              className="w-full py-1.5 text-center text-[10px] font-bold uppercase text-white"
              style={{ backgroundColor: HEADING_GREEN }}
            >
              {b.action.label}
            </button>
          </td>
        </tr>
      ) : (
        <tr key={i} className={`border-b ${BOX_BORDER}`} style={{ backgroundColor: `${HEADING_GREEN_DARK}0d` }}>
          <td className="py-1 pl-7 pr-2 text-[10px] capitalize text-slate-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              {b.label}
              {b.onView && (
                <button onClick={(e) => { e.stopPropagation(); b.onView!(); }} className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-500">
                  <Eye className="h-3 w-3" />
                </button>
              )}
            </span>
          </td>
          <td className="px-2 py-1 text-[10px] text-slate-500 dark:text-zinc-400">{b.count}</td>
          <td className="px-2 py-1 text-right text-[10px] text-slate-500 dark:text-zinc-400">{typeof b.amount === "number" ? fmt(b.amount) : b.amount}</td>
        </tr>
      ))}
    </>
  );
}

function DataBox({
  title, totalLabel = "Total", totalCount, totalAmount, totalPrefix = "", children, showTotal = true,
}: {
  title: string; totalLabel?: string; totalCount?: number | string; totalAmount?: number | string; totalPrefix?: string; children: ReactNode; showTotal?: boolean;
}) {
  return (
    <div>
      <SectionHeading title={title} />
      <div className={`border border-t-0 ${BOX_BORDER} bg-white dark:bg-zinc-900`}>
        <table className="w-full border-collapse">
          <tbody>
            {children}
            {showTotal && (
              <tr className="h-8 bg-emerald-50/70 dark:bg-emerald-900/10">
                <td className="px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{totalLabel}</td>
                <td className="px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{totalCount}</td>
                <td className="px-2 py-1 text-right text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {totalPrefix}{typeof totalAmount === "number" ? fmt(totalAmount) : totalAmount}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Right-panel "closing" row — <a>-styled label, a P(KR)/D(ollar) badge with a hover
// tooltip explaining the figure, matching the legacy closing_table design.
function ClosingRow({
  label, value, badge, tooltip, bold, colorClass,
}: {
  label: string; value: string; badge: "P" | "D"; tooltip: string; bold?: boolean; colorClass?: string;
}) {
  return (
    <tr className={`h-8 border-b ${BOX_BORDER} hover:bg-slate-50 dark:hover:bg-zinc-800`}>
      <td className={`px-2 py-1.5 text-[11px] ${bold ? "font-bold" : "font-medium"} ${colorClass || "text-slate-700 dark:text-zinc-300"}`}>
        <span className="cursor-default underline-offset-2 hover:underline">{label}</span>
      </td>
      <td className="px-1 py-1.5 text-center">
        <Tooltip text={tooltip}>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[9px] font-black text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">{badge}</span>
        </Tooltip>
      </td>
      <td className={`px-2 py-1.5 text-right text-[11px] ${bold ? "font-bold" : "font-semibold"} ${colorClass || "text-slate-700 dark:text-zinc-300"}`}>{value}</td>
    </tr>
  );
}

// ─── Time-range dropdown — ported from the legacy .custom_dropdown nested menu ───
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function computePresetRange(key: string): { from: string; to: string; label: string } {
  const now = new Date();
  if (key === "today") {
    return { from: iso(now), to: iso(now), label: "today" };
  }
  if (key === "weekly") {
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { from: iso(monday), to: iso(sunday), label: "weekly" };
  }
  if (key.startsWith("month:")) {
    const m = Number(key.split(":")[1]);
    const start = new Date(now.getFullYear(), m, 1);
    const end = new Date(now.getFullYear(), m + 1, 0);
    return { from: iso(start), to: iso(end), label: MONTH_NAMES[m].toLowerCase() };
  }
  const q = Math.floor(now.getMonth() / 3);
  if (key === "current-quarter") {
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: iso(start), to: iso(end), label: "Current quarter" };
  }
  if (key === "last-quarter") {
    const lastQ = q === 0 ? 3 : q - 1;
    const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const start = new Date(year, lastQ * 3, 1);
    const end = new Date(year, lastQ * 3 + 3, 0);
    return { from: iso(start), to: iso(end), label: "Last quarter" };
  }
  if (key === "both-quarter") {
    const lastQ = q === 0 ? 3 : q - 1;
    const lastYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const start = new Date(lastYear, lastQ * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: iso(start), to: iso(end), label: "Both quarter" };
  }
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { from: iso(start), to: iso(end), label: "Current quarter" };
}

function TimeRangeDropdown({
  currentLabel, currentFrom, currentTo, onApply,
}: {
  currentLabel: string; currentFrom: string; currentTo: string;
  onApply: (from: string, to: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const currentMonth = new Date().getMonth();

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSub(null); setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (key: string) => {
    const r = computePresetRange(key);
    onApply(r.from, r.to, r.label);
    setOpen(false); setSub(null);
  };

  const navItem = "flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] capitalize text-slate-700 hover:bg-[#099153] hover:text-white dark:text-zinc-200";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded border border-[#00000030] bg-white px-3 py-1.5 text-[12px] font-medium capitalize text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {currentLabel}
        {currentFrom && (
          <Tooltip text={`${currentFrom} to ${currentTo}`}>
            <Info className="h-3.5 w-3.5 text-slate-400" />
          </Tooltip>
        )}
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded border border-[#cfcfcf] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button onClick={() => pick("today")} className={navItem}>today</button>
          <button onClick={() => pick("weekly")} className={navItem}>weekly</button>

          <div className="relative">
            <button onClick={() => setSub((s) => (s === "month" ? null : "month"))} className={navItem}>
              month <ChevronDown className="h-3 w-3" />
            </button>
            {sub === "month" && (
              <div className="absolute left-full top-0 max-h-64 w-40 overflow-y-auto rounded border border-[#cfcfcf] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {MONTH_NAMES.map((m, idx) => {
                  const disabled = idx > currentMonth;
                  return (
                    <button
                      key={m}
                      disabled={disabled}
                      onClick={() => pick(`month:${idx}`)}
                      className={`block w-full px-3 py-1.5 text-left text-[12px] capitalize ${disabled ? "cursor-not-allowed text-slate-300 line-through dark:text-zinc-600" : "text-slate-700 hover:bg-[#099153] hover:text-white dark:text-zinc-200"}`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setSub((s) => (s === "quarter" ? null : "quarter"))} className={navItem}>
              quarter <ChevronDown className="h-3 w-3" />
            </button>
            {sub === "quarter" && (
              <div className="absolute left-full top-0 w-40 rounded border border-[#cfcfcf] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button onClick={() => pick("current-quarter")} className={navItem}>Current quarter</button>
                <button onClick={() => pick("last-quarter")} className={navItem}>Last quarter</button>
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => setSub((s) => (s === "section" ? null : "section"))} className={navItem}>
              section <ChevronDown className="h-3 w-3" />
            </button>
            {sub === "section" && (
              <div className="absolute left-full top-0 w-40 rounded border border-[#cfcfcf] bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <button onClick={() => pick("both-quarter")} className={navItem}>Both quarters</button>
              </div>
            )}
          </div>

          <div className="mt-1 border-t border-[#eee] p-2 dark:border-zinc-700">
            <button
              onClick={() => setShowCustom((s) => !s)}
              className="flex w-full items-center justify-center gap-1 rounded bg-sky-600 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700"
            >
              <Calendar className="h-3 w-3" /> Filter by Date Range
            </button>
            {showCustom && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500 dark:text-zinc-400">Start Date</label>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase text-slate-500 dark:text-zinc-400">End Date</label>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
                </div>
                <button
                  onClick={() => { if (customFrom && customTo) { onApply(customFrom, customTo, "Custom Date Range"); setOpen(false); setShowCustom(false); } }}
                  className="w-full rounded py-1.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: HEADING_GREEN }}
                >
                  View
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AbReport() {
    const [dateRange, setDateRange] = useState({ from: "", to: "" });
    const [rangeLabel, setRangeLabel] = useState("Current Quarter");

    const applyRange = (from: string, to: string, label: string) => {
        setDateRange({ from, to });
        setRangeLabel(label);
    };

    const [chequeDetail, setChequeDetail] = useState<{ bucket: "full" | "paid" | "unpaid"; type?: string } | null>(null);
    const setChequeDetailBucket = (bucket: "full" | "paid" | "unpaid", type?: string) => setChequeDetail({ bucket, type });
    const chequeDetailLabels: Record<string, string> = { full: "Full Cheque", paid: "Paid Cheque", unpaid: "Un-Paid Cheque" };

    const { data: chequeDetailData, isLoading: chequeDetailLoading } = useQuery({
        queryKey: ["/api/account/ab-report/cheque-detail", chequeDetail, dateRange],
        queryFn: () => {
            const url = new URL("/api/account/ab-report/cheque-detail", window.location.origin);
            url.searchParams.append("bucket", String(chequeDetail?.bucket));
            if (chequeDetail?.type) url.searchParams.append("type", chequeDetail.type);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            return apiRequestJson("GET", url.pathname + url.search);
        },
        enabled: !!chequeDetail,
    });

    const [metricDetail, setMetricDetail] = useState<{ key: string; label: string } | null>(null);

    const { data: metricDetailData, isLoading: metricDetailLoading } = useQuery({
        queryKey: ["/api/account/ab-report/metric-detail", metricDetail?.key, dateRange],
        queryFn: () => {
            const [metricKey, extraFilter] = String(metricDetail?.key).split(":");
            const url = new URL("/api/account/ab-report/metric-detail", window.location.origin);
            url.searchParams.append("metric", metricKey);
            if (metricKey === "temp-gm" && extraFilter) url.searchParams.append("reason", extraFilter);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            return apiRequestJson("GET", url.pathname + url.search);
        },
        enabled: !!metricDetail,
    });

    const viewMetric = (key: string, label: string) => setMetricDetail({ key, label });

    const fmtCell = (col: any, val: any) => {
        if (val === null || val === undefined || val === "") return "-";
        if (col.type === "date") return format(new Date(val), "MM/dd/yyyy");
        if (col.align === "right") return fmt(val);
        return String(val);
    };

    const [notesMetric, setNotesMetric] = useState<{ key: string; label: string } | null>(null);
    const [newNote, setNewNote] = useState("");

    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ["/api/account/ab-report/stats", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-report/stats", window.location.origin);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        }
    });

    const { data: dollarList, isLoading: listLoading } = useQuery({
        queryKey: ["/api/account/dollar-system/list", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/dollar-system/list", window.location.origin);
            if (dateRange.from) url.searchParams.append("startDate", dateRange.from);
            if (dateRange.to) url.searchParams.append("endDate", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch lists");
            return res.json();
        }
    });

    const { data: closingSummary, isLoading: closingLoading } = useQuery({
        queryKey: ["/api/account/ab-closing/summary", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-closing/summary", window.location.origin);
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch closing summary");
            return res.json();
        }
    });

    const { data: abPaymentsData } = useQuery({
        queryKey: ["/api/account/ab-payments", dateRange],
        queryFn: async () => {
            const url = new URL("/api/account/ab-payments", window.location.origin);
            url.searchParams.append("status", "paid");
            if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
            if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
            const res = await fetch(url.toString(), { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch AB payments");
            return res.json();
        }
    });

    const { data: todayClosing } = useQuery({
        queryKey: ["/api/account/ab-closing/today"],
        queryFn: () => apiRequestJson("GET", "/api/account/ab-closing/today"),
        refetchInterval: 60_000,
    });

    const { data: closingHistory } = useQuery({
        queryKey: ["/api/account/ab-closing/history"],
        queryFn: () => apiRequestJson("GET", "/api/account/ab-closing/history"),
    });

    const queryClient = useQueryClient();
    const { toast } = useToast();

    const confirmClosing = useMutation({
        mutationFn: (payload: { stage: "account" | "hod"; snapshot?: Record<string, any> }) =>
            apiRequestJson("POST", "/api/account/ab-closing/confirm", payload),
        onSuccess: () => {
            toast({ title: "Closing confirmed" });
            queryClient.invalidateQueries({ queryKey: ["/api/account/ab-closing/today"] });
            queryClient.invalidateQueries({ queryKey: ["/api/account/ab-closing/history"] });
            queryClient.invalidateQueries({ queryKey: ["/api/account/ab-report/stats"] });
        },
        onError: (err: any) => {
            toast({ title: "Could not confirm closing", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const { data: notesData, isLoading: notesLoading } = useQuery({
        queryKey: ["/api/account/ab-report/notes", notesMetric?.key],
        queryFn: () => apiRequestJson("GET", `/api/account/ab-report/notes?metric=${encodeURIComponent(String(notesMetric?.key))}`),
        enabled: !!notesMetric,
    });

    const addNote = useMutation({
        mutationFn: (payload: { metric: string; note: string }) => apiRequestJson("POST", "/api/account/ab-report/notes", payload),
        onSuccess: () => {
            setNewNote("");
            queryClient.invalidateQueries({ queryKey: ["/api/account/ab-report/notes", notesMetric?.key] });
        },
        onError: (err: any) => {
            toast({ title: "Could not add note", description: err?.message || "Please try again.", variant: "destructive" });
        },
    });

    const handleExportCsv = () => {
        const url = new URL("/api/account/ab-payments/export", window.location.origin);
        url.searchParams.append("status", "paid");
        if (dateRange.from) url.searchParams.append("dateFrom", dateRange.from);
        if (dateRange.to) url.searchParams.append("dateTo", dateRange.to);
        window.open(url.toString(), "_blank");
    };

    if (statsLoading || listLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-zinc-900">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="ml-2 text-slate-600 font-medium dark:text-zinc-300">Loading Real Data...</span>
            </div>
        );
    }

    const account = stats?.account || {};
    const closingItems = stats?.closing || [];
    const rec = closingSummary?.reconciliation || {};
    const cp  = closingSummary?.customerPayment || {};
    const dp  = closingSummary?.dollarPurchased || {};
    const abp = closingSummary?.abPayments || {};
    const chk = closingSummary?.checklist || {};
    const auditRows = closingSummary?.auditHistory || [];
    const paidAbRows = abPaymentsData?.data || [];

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-zinc-950 p-6 space-y-6">
            {/* Breadcrumb — "Dollar Buying / View Ab Report" in the legacy page */}
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-800 dark:text-zinc-100">
                    Dollar Buying <span className="text-slate-400 dark:text-zinc-600">/</span>{" "}
                    <span style={{ color: HEADING_GREEN_DARK }}>View Ab Report</span>
                </h4>
            </div>

            {/* Heading bar with the time-range dropdown, matching the legacy .heading + .custom_dropdown */}
            <div className="flex items-center justify-between rounded border border-[#80808036] bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
                <TimeRangeDropdown
                    currentLabel={rangeLabel}
                    currentFrom={dateRange.from}
                    currentTo={dateRange.to}
                    onApply={applyRange}
                />
                <h1 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-200">account</h1>
            </div>

            <div className="-mt-4 flex items-center gap-3 rounded-md border border-sky-100 bg-sky-50 p-3 text-sm font-medium text-sky-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-sky-400">
                <Info className="h-4 w-4 flex-shrink-0" />
                Currently viewing: <strong className="capitalize">{rangeLabel}</strong>
                {dateRange.from && <span>({dateRange.from} - {dateRange.to || "Today"})</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-8">
                    {/* ACCOUNT Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* CASH Column */}
                        <DataBox title="cash" totalCount={account.cash?.total?.count || 0} totalAmount={account.cash?.total?.amount || 0}>
                            <MetricRow
                                label="client payment"
                                count={account.cash?.clientPayment?.count || 0}
                                amount={account.cash?.clientPayment?.amount || 0}
                                breakdown={[
                                    { label: "Full payment", count: account.cash?.clientPayment?.full?.count || 0, amount: account.cash?.clientPayment?.full?.amount || 0, onView: () => viewMetric("client-payment-full", "Full Payment") },
                                    { label: "Loan First payment Received", count: account.cash?.clientPayment?.loanFirst?.count || 0, amount: account.cash?.clientPayment?.loanFirst?.amount || 0, onView: () => viewMetric("client-payment-loanfirst", "Loan First Payment Received") },
                                    { label: "Partial payment", count: account.cash?.clientPayment?.partial?.count || 0, amount: account.cash?.clientPayment?.partial?.amount || 0, onView: () => viewMetric("client-payment-partial", "Partial Payment") },
                                ]}
                            />
                            <MetricRow
                                label="cheque"
                                count={account.cash?.cheque?.count || 0}
                                amount={account.cash?.cheque?.amount || 0}
                                breakdown={[
                                    { label: "Full cheque", count: (account.cash?.cheque?.count || 0) + (account.tempPayment?.pendingCheque?.count || 0), amount: (account.cash?.cheque?.amount || 0) + (account.tempPayment?.pendingCheque?.amount || 0), onView: () => setChequeDetailBucket("full") },
                                    { label: "Paid cheque", count: account.cash?.cheque?.count || 0, amount: account.cash?.cheque?.amount || 0, onView: () => setChequeDetailBucket("paid") },
                                    { label: "Un-paid cheque", count: account.tempPayment?.pendingCheque?.count || 0, amount: account.tempPayment?.pendingCheque?.amount || 0, onView: () => setChequeDetailBucket("unpaid") },
                                ]}
                            />
                            <MetricRow label="Loan Recovered" count={account.cash?.loanRecovered?.count || 0} amount={account.cash?.loanRecovered?.amount || 0} infoTooltip="Company Loan Recovered" onView={() => viewMetric("loan-recovered", "Loan Recovered")} />
                            <MetricRow
                                label="Last closing"
                                count={account.cash?.lastClosing?.count || 0}
                                amount={account.cash?.lastClosing?.amount || 0}
                                breakdown={[
                                    { label: "Full Closing Cheque", count: account.cash?.lastClosing?.closingCheque?.full?.count || 0, amount: account.cash?.lastClosing?.closingCheque?.full?.amount || 0, onView: () => setChequeDetailBucket("full", "Closing") },
                                    { label: "Paid Closing Cheque", count: account.cash?.lastClosing?.closingCheque?.paid?.count || 0, amount: account.cash?.lastClosing?.closingCheque?.paid?.amount || 0, onView: () => setChequeDetailBucket("paid", "Closing") },
                                    { label: "Un-Paid Closing Cheque", count: account.cash?.lastClosing?.closingCheque?.unpaid?.count || 0, amount: account.cash?.lastClosing?.closingCheque?.unpaid?.amount || 0, onView: () => setChequeDetailBucket("unpaid", "Closing") },
                                ]}
                            />
                        </DataBox>

                        {/* DOLLARS Column */}
                        <DataBox title="dollars" totalCount={account.dollars?.buy?.count || 0} totalAmount={account.dollars?.total?.amount || 0} totalPrefix="$">
                            <MetricRow
                                label="Balance"
                                count={account.dollars?.balance?.count || 0}
                                amount={account.dollars?.balance?.amount || 0}
                                prefix="$"
                                breakdown={[
                                    { label: "Last Quarter", count: account.dollars?.balance?.lastQuarter?.count || 0, amount: account.dollars?.balance?.lastQuarter?.amount || 0, onView: () => viewMetric("balance-last-quarter", "Balance — Last Quarter") },
                                    { label: "Current Quarter", count: account.dollars?.balance?.currentQuarter?.count || 0, amount: account.dollars?.balance?.currentQuarter?.amount || 0, onView: () => viewMetric("balance-current-quarter", "Balance — Current Quarter") },
                                ]}
                            />
                            <MetricRow
                                label="Buy"
                                count={account.dollars?.buy?.count || 0}
                                amount={account.dollars?.buy?.amount || 0}
                                prefix="$"
                                breakdown={[
                                    { label: "Martini Show", count: account.dollars?.buy?.martiniShow?.count || 0, amount: account.dollars?.buy?.martiniShow?.amount || 0, onView: () => viewMetric("martini-show", "Martini Show") },
                                    { label: "Martini Pending", count: account.dollars?.buy?.martiniPending?.count || 0, amount: account.dollars?.buy?.martiniPending?.amount || 0, onView: () => viewMetric("martini-pending", "Martini Pending") },
                                    { label: "Martini Refund", count: account.dollars?.buy?.martiniRefund?.count || 0, amount: account.dollars?.buy?.martiniRefund?.amount || 0, onView: () => viewMetric("martini-refund", "Martini Refund") },
                                    { label: "Account Paid", count: account.dollars?.buy?.accountPaid?.count || 0, amount: account.dollars?.buy?.accountPaid?.amount || 0, onView: () => viewMetric("buy-account-paid", "Account Paid") },
                                ]}
                            />
                            <MetricRow
                                label="Required"
                                count={account.dollars?.required?.count || 0}
                                amount={account.dollars?.required?.amount || 0}
                                prefix="$"
                                infoTooltip="Required To Pay Full Amount"
                                breakdown={[
                                    { label: "Full Required To Pay", count: account.dollars?.required?.full?.count || 0, amount: account.dollars?.required?.full?.amount || 0, onView: () => viewMetric("required-full", "Full Required To Pay") },
                                    { label: "Partial Required To Pay", count: account.dollars?.required?.partial?.count || 0, amount: account.dollars?.required?.partial?.amount || 0, onView: () => viewMetric("required-partial", "Partial Required To Pay") },
                                ]}
                            />
                            <MetricRow
                                label="get funds" count={account.dollars?.getFunds?.count || 0} amount={account.dollars?.getFunds?.amount || 0} prefix="$"
                                infoTooltip="Cash in hand / Dollar Rate = get funds"
                            />
                        </DataBox>

                        {/* TEMP PAYMENT Column */}
                        <DataBox title="temp payment" totalCount={account.tempPayment?.total?.count || 0} totalAmount={account.tempPayment?.total?.amount || 0}>
                            <MetricRow
                                label="Temp Gm"
                                count={account.tempPayment?.tempGm?.count || 0}
                                amount={account.tempPayment?.tempGm?.amount || 0}
                                infoTooltip="Pending/Not yet cleared Temp GM entries"
                                breakdown={(account.tempPayment?.tempGm?.breakdown || []).map((b: any) => ({
                                    label: b.reason, count: b.count, amount: b.amount,
                                    onView: () => viewMetric(`temp-gm:${b.reason}`, b.reason),
                                }))}
                            />
                            <MetricRow
                                label="Martini Pending"
                                count={account.tempPayment?.martiniPending?.count || 0}
                                amount={account.tempPayment?.martiniPending?.amount || 0}
                                prefix="$"
                                breakdown={[
                                    { label: "Martini Client Shorts", count: account.tempPayment?.martiniPending?.clientShorts?.count || 0, amount: account.tempPayment?.martiniPending?.clientShorts?.amount || 0, onView: () => viewMetric("martini-pending-shorts", "Martini Client Shorts") },
                                    { label: "Martini Cheque", count: account.tempPayment?.martiniPending?.cheque?.count || 0, amount: account.tempPayment?.martiniPending?.cheque?.amount || 0, onView: () => viewMetric("martini-pending-cheque", "Martini Cheque") },
                                ]}
                            />
                            <MetricRow label="Pending Cheque" count={account.tempPayment?.pendingCheque?.count || 0} amount={account.tempPayment?.pendingCheque?.amount || 0} />
                            <MetricRow label="Advance Pay" count={account.tempPayment?.advancePay?.count || 0} amount={account.tempPayment?.advancePay?.amount || 0} onView={() => viewMetric("advance-pay", "Advance Pay")} />
                        </DataBox>

                        {/* ACCOUNT CLOSING Column */}
                        <DataBox title="account closing" totalCount={account.accountClosing?.total?.count || 0} totalAmount={account.accountClosing?.total?.amount || 0}>
                            <MetricRow
                                label="Client Payment"
                                count={account.accountClosing?.clientPayment?.count || 0}
                                amount={account.accountClosing?.clientPayment?.amount || 0}
                                breakdown={[
                                    { label: "Full Payment", count: account.accountClosing?.clientPayment?.full?.count || 0, amount: account.accountClosing?.clientPayment?.full?.amount || 0, onView: () => viewMetric("client-payment-full", "Full Payment") },
                                    { label: "Loan First Payment Received", count: account.accountClosing?.clientPayment?.loanFirst?.count || 0, amount: account.accountClosing?.clientPayment?.loanFirst?.amount || 0, onView: () => viewMetric("client-payment-loanfirst", "Loan First Payment Received") },
                                    { label: "Partial Payment", count: account.accountClosing?.clientPayment?.partial?.count || 0, amount: account.accountClosing?.clientPayment?.partial?.amount || 0, onView: () => viewMetric("client-payment-partial", "Partial Payment") },
                                ]}
                            />
                            <MetricRow
                                label="Cheque"
                                count={account.accountClosing?.cheque?.count || 0}
                                amount={account.accountClosing?.cheque?.amount || 0}
                                breakdown={[
                                    { label: "Full Cheque", count: (account.accountClosing?.cheque?.count || 0) + (account.accountClosing?.pendingCheque?.count || 0), amount: (account.accountClosing?.cheque?.amount || 0) + (account.accountClosing?.pendingCheque?.amount || 0), onView: () => setChequeDetailBucket("full") },
                                    { label: "Paid Cheque", count: account.accountClosing?.cheque?.count || 0, amount: account.accountClosing?.cheque?.amount || 0, onView: () => setChequeDetailBucket("paid") },
                                    { label: "Un-Paid Cheque", count: account.accountClosing?.pendingCheque?.count || 0, amount: account.accountClosing?.pendingCheque?.amount || 0, onView: () => setChequeDetailBucket("unpaid") },
                                ]}
                            />
                            <MetricRow label="Pending Cheque" count={account.accountClosing?.pendingCheque?.count || 0} amount={account.accountClosing?.pendingCheque?.amount || 0} />
                            <MetricRow label="Extra Amount" count={account.accountClosing?.extraAmount?.count || 0} amount={account.accountClosing?.extraAmount?.amount || 0} infoTooltip="Extra Discount Received" onView={() => viewMetric("extra-discount-received", "Extra Discount Received")} />
                        </DataBox>
                    </div>

                    {/* WEB EXCELS Sections Header */}
                    <SectionHeading title="Web Excels" />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* WEB EXCELS CASH */}
                        <DataBox
                            title="cash"
                            totalCount={(account.webExcels?.cash?.chequePay?.count || 0) + (account.webExcels?.cash?.loanPayment?.count || 0) + (account.webExcels?.cash?.loanRecovered?.count || 0)}
                            totalAmount={(account.webExcels?.cash?.chequePay?.amount || 0) + (account.webExcels?.cash?.loanPayment?.amount || 0) + (account.webExcels?.cash?.loanRecovered?.amount || 0) + (account.webExcels?.cash?.extraDiscount?.amount || 0)}
                        >
                            <MetricRow
                                label="Cheque Pay"
                                count={account.webExcels?.cash?.chequePay?.count || 0}
                                amount={account.webExcels?.cash?.chequePay?.amount || 0}
                                breakdown={[
                                    { label: "Full Cheque", count: (account.webExcels?.cash?.chequePay?.count || 0) + (account.tempPayment?.pendingCheque?.count || 0), amount: (account.webExcels?.cash?.chequePay?.amount || 0) + (account.tempPayment?.pendingCheque?.amount || 0), onView: () => setChequeDetailBucket("full") },
                                    { label: "Paid Cheque", count: account.webExcels?.cash?.chequePay?.count || 0, amount: account.webExcels?.cash?.chequePay?.amount || 0, onView: () => setChequeDetailBucket("paid") },
                                    { label: "Un-Paid Cheque", count: account.tempPayment?.pendingCheque?.count || 0, amount: account.tempPayment?.pendingCheque?.amount || 0, onView: () => setChequeDetailBucket("unpaid") },
                                ]}
                            />
                            <MetricRow
                                label="Loan Payment"
                                count={account.webExcels?.cash?.loanPayment?.count || 0}
                                amount={account.webExcels?.cash?.loanPayment?.amount || 0}
                                breakdown={[
                                    { label: "Pay Loan Payment", count: account.webExcels?.cash?.loanPayment?.count || 0, amount: account.webExcels?.cash?.loanPayment?.amount || 0, onView: () => viewMetric("loan-payment", "Pay Loan Payment") },
                                ]}
                            />
                            <MetricRow
                                label="Loan Recovered"
                                count={account.webExcels?.cash?.loanRecovered?.count || 0}
                                amount={account.webExcels?.cash?.loanRecovered?.amount || 0}
                                breakdown={[
                                    { label: "Loan Recovered", count: account.webExcels?.cash?.loanRecovered?.count || 0, amount: account.webExcels?.cash?.loanRecovered?.amount || 0, onView: () => viewMetric("loan-recovered", "Loan Recovered") },
                                ]}
                            />
                            <MetricRow
                                label="Extra-Discount"
                                count={account.webExcels?.cash?.extraDiscount?.count || 0}
                                amount={account.webExcels?.cash?.extraDiscount?.amount || 0}
                                infoTooltip="Extra Discount Received"
                                breakdown={[
                                    { label: "Extra-Discount Received", count: account.webExcels?.cash?.extraDiscount?.count || 0, amount: account.webExcels?.cash?.extraDiscount?.amount || 0, onView: () => viewMetric("extra-discount-received", "Extra Discount Received") },
                                ]}
                            />
                            <MetricRow
                                label="Extra-Discount Paid"
                                count={account.webExcels?.cash?.extraDiscountPaid?.count || 0}
                                amount={account.webExcels?.cash?.extraDiscountPaid?.amount || 0}
                                breakdown={[
                                    { label: "Extra-Discount Paid", count: account.webExcels?.cash?.extraDiscountPaid?.count || 0, amount: account.webExcels?.cash?.extraDiscountPaid?.amount || 0, onView: () => viewMetric("extra-discount-paid", "Extra Discount Paid") },
                                ]}
                            />
                            <MetricRow
                                label="Remaining Extra-Discount"
                                count="----"
                                amount={account.webExcels?.cash?.remainingExtraDiscount?.amount || 0}
                                breakdown={[
                                    { label: "", count: "", amount: "", action: { label: "Add Details", onClick: () => setNotesMetric({ key: "remaining-extra-discount", label: "Remaining Extra-Discount" }) } },
                                ]}
                            />
                        </DataBox>

                        {/* WEB EXCELS DOLLARS */}
                        <DataBox
                            title="dollars"
                            totalCount={account.webExcels?.dollars?.buy?.count || 0}
                            totalAmount={(account.webExcels?.dollars?.balance?.amount || 0) + (account.webExcels?.dollars?.buy?.amount || 0)}
                            totalPrefix="$"
                        >
                            <MetricRow
                                label="Balance"
                                count={account.webExcels?.dollars?.balance?.count || 0}
                                amount={account.webExcels?.dollars?.balance?.amount || 0}
                                prefix="$"
                                breakdown={[{ label: "", count: "", amount: "", action: { label: "Add Details", onClick: () => setNotesMetric({ key: "webexcels-balance", label: "Balance" }) } }]}
                            />
                            <MetricRow
                                label="Buy"
                                count={account.webExcels?.dollars?.buy?.count || 0}
                                amount={account.webExcels?.dollars?.buy?.amount || 0}
                                prefix="$"
                                breakdown={[{ label: "", count: "", amount: "", action: { label: "Add Details", onClick: () => setNotesMetric({ key: "webexcels-buy", label: "Buy" }) } }]}
                            />
                        </DataBox>

                        {/* PENDING RECOVERY */}
                        <DataBox title="pending recovery" showTotal={false}>
                            <MetricRow
                                label="Dollar"
                                count={account.webExcels?.pendingRecovery?.dollar?.count || 0}
                                amount={account.webExcels?.pendingRecovery?.dollar?.amount || 0}
                                prefix="$"
                                breakdown={[{ label: "In Dollar", count: account.webExcels?.pendingRecovery?.dollar?.count || 0, amount: account.webExcels?.pendingRecovery?.dollar?.amount || 0, onView: () => viewMetric("required", "Required To Pay") }]}
                            />
                            <MetricRow
                                label="Pkr"
                                count={account.webExcels?.pendingRecovery?.pkr?.count || 0}
                                amount={account.webExcels?.pendingRecovery?.pkr?.amount || 0}
                                breakdown={[{ label: "In Pkr", count: account.webExcels?.pendingRecovery?.pkr?.count || 0, amount: account.webExcels?.pendingRecovery?.pkr?.amount || 0, onView: () => viewMetric("required", "Required To Pay") }]}
                            />
                        </DataBox>

                        {/* WEB EXCELS CLOSING */}
                        <DataBox title="web excels closing" showTotal={false}>
                            <MetricRow
                                label="Cheque Pay"
                                count={account.webExcels?.closing?.chequePay?.count || 0}
                                amount={account.webExcels?.closing?.chequePay?.amount || 0}
                                breakdown={[
                                    { label: "Full Cheque", count: (account.webExcels?.closing?.chequePay?.count || 0) + (account.tempPayment?.pendingCheque?.count || 0), amount: (account.webExcels?.closing?.chequePay?.amount || 0) + (account.tempPayment?.pendingCheque?.amount || 0), onView: () => setChequeDetailBucket("full") },
                                    { label: "Paid Cheque", count: account.webExcels?.closing?.chequePay?.count || 0, amount: account.webExcels?.closing?.chequePay?.amount || 0, onView: () => setChequeDetailBucket("paid") },
                                    { label: "Un-Paid Cheque", count: account.tempPayment?.pendingCheque?.count || 0, amount: account.tempPayment?.pendingCheque?.amount || 0, onView: () => setChequeDetailBucket("unpaid") },
                                ]}
                            />
                            <MetricRow
                                label="Loan Payment"
                                count={account.webExcels?.closing?.loanPayment?.count || 0}
                                amount={account.webExcels?.closing?.loanPayment?.amount || 0}
                                breakdown={[{ label: "Pay Loan Payment", count: account.webExcels?.closing?.loanPayment?.count || 0, amount: account.webExcels?.closing?.loanPayment?.amount || 0, onView: () => viewMetric("loan-payment", "Pay Loan Payment") }]}
                            />
                            <MetricRow
                                label="Loan Recovered"
                                count={account.webExcels?.closing?.loanRecovered?.count || 0}
                                amount={account.webExcels?.closing?.loanRecovered?.amount || 0}
                                breakdown={[{ label: "Loan Recovered", count: account.webExcels?.closing?.loanRecovered?.count || 0, amount: account.webExcels?.closing?.loanRecovered?.amount || 0, onView: () => viewMetric("loan-recovered", "Loan Recovered") }]}
                            />
                            <MetricRow
                                label="Extra-Discount Paid"
                                count={account.webExcels?.closing?.extraDiscountPaid?.count || 0}
                                amount={account.webExcels?.closing?.extraDiscountPaid?.amount || 0}
                                breakdown={[{ label: "Extra-Discount Paid", count: account.webExcels?.closing?.extraDiscountPaid?.count || 0, amount: account.webExcels?.closing?.extraDiscountPaid?.amount || 0, onView: () => viewMetric("extra-discount-paid", "Extra Discount Paid") }]}
                            />
                            <MetricRow label="Web Excels Closing" count="--" amount={account.webExcels?.closing?.webExcelsClosing?.amount || 0} highlight infoTooltip="Cheque Pay + Loan Payment + Loan Recovered - Extra-Discount Paid" />
                        </DataBox>
                    </div>
                </div>

                {/* Right CLOSING Summary Column */}
                <div className="lg:col-span-1 space-y-4">
                  {/* Daily Closing Sign-off (Account -> HOD) — ported button_wrapper interaction */}
                  <div>
                    <div className="flex items-center justify-center gap-1 py-1.5 text-[13px] font-semibold uppercase tracking-wide text-white bg-slate-800">
                      <ShieldCheck className="h-3.5 w-3.5" /> Today's Closing
                    </div>
                    <div className={`border border-t-0 ${BOX_BORDER} bg-white p-3 text-[11px] dark:bg-zinc-900 space-y-2`}>
                      <div className="flex items-center gap-2">
                        {todayClosing?.accountVerified
                          ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          : <Clock size={14} className="text-amber-500 flex-shrink-0" />}
                        <span className={todayClosing?.accountVerified ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
                          Accounts {todayClosing?.accountVerified ? "confirmed" : "pending"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {todayClosing?.hodVerified
                          ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          : <Clock size={14} className="text-amber-500 flex-shrink-0" />}
                        <span className={todayClosing?.hodVerified ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-slate-500"}>
                          HOD {todayClosing?.hodVerified ? "confirmed" : "pending"}
                        </span>
                      </div>

                      {todayClosing?.canConfirmAccount && (
                        <button
                          disabled={confirmClosing.isPending}
                          onClick={() => confirmClosing.mutate({ stage: "account", snapshot: stats?.meta?.closingSnapshot || {} })}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded py-1.5 text-[10px] font-bold uppercase text-sky-900 bg-[#bde0fe] hover:brightness-95 disabled:opacity-60"
                        >
                          {confirmClosing.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                          accounts dep please confirm today closing
                        </button>
                      )}
                      {todayClosing?.canConfirmHod && (
                        <button
                          disabled={confirmClosing.isPending}
                          onClick={() => confirmClosing.mutate({ stage: "hod" })}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded py-1.5 text-[10px] font-bold uppercase text-emerald-900 bg-[#c7f9cc] hover:brightness-95 disabled:opacity-60"
                        >
                          {confirmClosing.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                          hod please confirm today closing
                        </button>
                      )}
                      {!todayClosing?.canConfirmAccount && !todayClosing?.canConfirmHod && (
                        <div className="pt-1 text-[10px] italic text-slate-400">
                          {todayClosing?.accountVerified && todayClosing?.hodVerified
                            ? "Already Create! — fully confirmed for today."
                            : todayClosing?.accountVerified
                              ? "Pending By HOD!"
                              : "Pending By Account Department!"}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <SectionHeading title="closing" />
                    <div className={`border border-t-0 ${BOX_BORDER} bg-white dark:bg-zinc-900`}>
                      <table className="w-full border-collapse">
                        <tbody>
                          {closingItems.map((r: any, i: number) => (
                            <ClosingRow
                              key={i}
                              label={r.label}
                              value={r.val}
                              badge={r.type === "D" ? "D" : "P"}
                              tooltip={r.tooltip || r.label}
                              bold={r.bold}
                              colorClass={r.color}
                            />
                          ))}
                          {closingItems.length === 0 && (
                            <tr><td colSpan={3} className="py-4 text-center text-slate-400">No closing data</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Phase 8 — AB Reconciliation Panel */}
                  <Card className="border-none shadow-md">
                    <CardHeader className="bg-slate-700 py-2 rounded-t-lg">
                      <CardTitle className="text-sm font-bold text-white text-center uppercase">AB Reconciliation</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 bg-white dark:bg-zinc-900 space-y-2 text-[11px]">
                      {closingLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-emerald-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Customer Paid (USD)</div>
                              <div className="text-emerald-700 font-black text-sm dark:text-emerald-400">${Number(cp.totalUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">PKR {Number(cp.totalPkr || 0).toLocaleString()}</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Dollar Purchased</div>
                              <div className="text-blue-700 font-black text-sm dark:text-blue-400">${Number(dp.totalUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(dp.count || 0)} records</div>
                            </div>
                            <div className="bg-amber-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">AB Paid</div>
                              <div className="text-amber-700 font-black text-sm dark:text-amber-400">${Number(abp.paidUsd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(abp.paidCount || 0)} payments</div>
                            </div>
                            <div className="bg-red-50 dark:bg-zinc-800 rounded p-2">
                              <div className="text-[10px] text-gray-500 uppercase font-bold dark:text-zinc-400">Remaining</div>
                              <div className={`font-black text-sm ${Number(rec.remainingBalanceUsd||0)>0?'text-red-600 dark:text-red-400':'text-emerald-600 dark:text-emerald-400'}`}>${Number(rec.remainingBalanceUsd||0).toLocaleString(undefined,{minimumFractionDigits:2})}</div>
                              <div className="text-gray-400 text-[10px]">{Number(rec.unresolvedCount || 0)} unresolved GMs</div>
                            </div>
                          </div>

                          {/* Pending/Processing badges */}
                          <div className="flex gap-2 flex-wrap pt-1">
                            {Number(abp.pendingUsd||0)>0 && <Badge className="bg-yellow-100 text-yellow-700 border-none text-[10px] font-black">⏳ Pending ${Number(abp.pendingUsd).toLocaleString()}</Badge>}
                            {Number(abp.processingUsd||0)>0 && <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] font-black">⚙ Processing ${Number(abp.processingUsd).toLocaleString()}</Badge>}
                            {Number(abp.rejectedUsd||0)>0 && <Badge className="bg-red-100 text-red-700 border-none text-[10px] font-black">✗ Rejected ${Number(abp.rejectedUsd).toLocaleString()}</Badge>}
                          </div>

                          {/* Checklist */}
                          <div className="border-t pt-2 space-y-1 dark:border-zinc-700">
                            <div className="text-[10px] font-black uppercase text-gray-500 mb-1">Close Checklist</div>
                            {([
                              { label: 'No Pending AB Payments', ok: chk.noPendingAbPayments },
                              { label: 'No Unresolved GMs', ok: chk.noUnresolvedGm },
                              { label: 'No Rejected Payments', ok: chk.noRejectedAbPayments },
                            ] as {label:string;ok:boolean}[]).map((item, i) => (
                              <div key={i} className="flex items-center gap-2">
                                {item.ok ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={12} className="text-red-400 flex-shrink-0" />}
                                <span className={`text-[10px] font-medium ${item.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-500'}`}>{item.label}</span>
                              </div>
                            ))}
                          </div>

                          {/* Export */}
                          <Button size="sm" onClick={handleExportCsv}
                            className="w-full h-8 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black uppercase mt-1">
                            <Download size={11} className="mr-1"/> Export AB Payments CSV
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Audit History */}
                  {auditRows.length > 0 && (
                    <Card className="border-none shadow-md">
                      <CardHeader className="bg-gray-600 py-2 rounded-t-lg">
                        <CardTitle className="text-sm font-bold text-white text-center uppercase">Audit History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 bg-white dark:bg-zinc-900 space-y-1">
                        {auditRows.map((row: any, i: number) => (
                          <div key={i} className="text-[10px] border-b border-gray-100 dark:border-zinc-800 pb-1">
                            <span className="font-black text-gray-700 dark:text-zinc-300">{row.actor_name || 'System'}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{row.action?.replace(/_/g,' ')}</span>
                            <span className="text-gray-300 mx-1">·</span>
                            <span className="text-gray-400">{row.created_at ? format(new Date(row.created_at), 'MM/dd HH:mm') : ''}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Closing History — last confirmed/pending daily sign-offs */}
                  {(closingHistory?.data?.length || 0) > 0 && (
                    <Card className="border-none shadow-md">
                      <CardHeader className="bg-gray-600 py-2 rounded-t-lg">
                        <CardTitle className="text-sm font-bold text-white text-center uppercase">Closing History</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 bg-white dark:bg-zinc-900 space-y-1">
                        {closingHistory.data.slice(0, 10).map((row: any, i: number) => (
                          <div key={i} className="text-[10px] border-b border-gray-100 dark:border-zinc-800 pb-1 flex items-center justify-between">
                            <span className="font-black text-gray-700 dark:text-zinc-300">{format(new Date(row.closing_date), 'MMM dd, yyyy')}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${row.account_dep_status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>Accounts</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${row.hod_dep_status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>HOD</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
            </div>

            {/* DOLLAR SYSTEM INTEGRATED AT BOTTOM */}
            <div className="pt-10 border-t border-slate-200 mt-10 dark:border-zinc-800">
                <h2 className="text-xl font-bold text-slate-800 uppercase mb-6 dark:text-zinc-100">Dollar System</h2>
                <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8">
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase dark:text-zinc-400">Start Date</label>
                                <input 
                                    type="date" 
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    value={dateRange.from}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase dark:text-zinc-400">End Date</label>
                                <input 
                                    type="date" 
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 [&::-webkit-calendar-picker-indicator]:dark:invert"
                                    value={dateRange.to}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                />
                            </div>
                            <Button className="bg-emerald-700 hover:bg-emerald-800 h-10 font-bold uppercase transition-all shadow-md">
                                View
                            </Button>
                        </div>

                        <div className="flex flex-col xl:flex-row gap-4 border-t border-slate-100 pt-6 overflow-hidden dark:border-zinc-800">
                            {/* Client Payment Section */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Client Payment</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-emerald-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">Company</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Client)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">PKR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dollarList?.clientPayments?.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{new Date(item.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">{item.company}</TableCell>
                                                    <TableCell className="px-1">{item.dollar}</TableCell>
                                                    <TableCell className="px-1">{item.rate}</TableCell>
                                                    <TableCell className="px-1">{item.received}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!dollarList?.clientPayments || dollarList.clientPayments.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No entries</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Dollar Buy Section */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Dollar Buy</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-blue-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">PayPal</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Buy)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">PKR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {dollarList?.dollarBuys?.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{new Date(item.date).toLocaleDateString()}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">{item.paypalEmail || 'N/A'}</TableCell>
                                                    <TableCell className="px-1">{item.dollar}</TableCell>
                                                    <TableCell className="px-1">{item.rate}</TableCell>
                                                    <TableCell className="px-1">{item.received}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!dollarList?.dollarBuys || dollarList.dollarBuys.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No entries</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Alibaba Paid Section - Phase 8: real ab_payments records */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-center text-slate-700 py-2 dark:text-zinc-400">Alibaba Paid</h3>
                                <div className="border border-slate-100 rounded-sm dark:border-zinc-800">
                                    <Table className="text-[10px] border-collapse">
                                        <TableHeader className="bg-amber-50 text-slate-700 font-bold dark:text-zinc-400 dark:bg-zinc-900">
                                            <TableRow className="h-8">
                                                <TableHead className="text-center font-bold px-1">Paid Date</TableHead>
                                                <TableHead className="text-center font-bold px-1">Company / AB ID</TableHead>
                                                <TableHead className="text-center font-bold px-1">$(Paid)</TableHead>
                                                <TableHead className="text-center font-bold px-1">Rate</TableHead>
                                                <TableHead className="text-center font-bold px-1">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paidAbRows.map((item: any, i: number) => (
                                                <TableRow key={i} className="hover:bg-slate-50 text-center text-slate-600 h-8 border-b border-slate-100 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800">
                                                    <TableCell className="px-1">{item.paid_date ? format(new Date(item.paid_date), 'MM/dd/yy') : '-'}</TableCell>
                                                    <TableCell className="font-bold text-slate-800 px-1 truncate max-w-[80px] dark:text-zinc-100">
                                                        <div>{item.company_name || '-'}</div>
                                                        <div className="text-[9px] font-normal text-gray-400">{item.ab_id || 'No AB ID'}</div>
                                                    </TableCell>
                                                    <TableCell className="px-1 text-emerald-600 font-black">${Number(item.amount_usd || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</TableCell>
                                                    <TableCell className="px-1">{item.rate || '-'}</TableCell>
                                                    <TableCell className="px-1">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-700">paid</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {paidAbRows.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-4 text-slate-400 italic">No paid AB records yet</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cheque drill-down — "View Data" modal, matching the legacy eye-icon pattern */}
            <Dialog open={!!chequeDetail} onOpenChange={(open) => !open && setChequeDetail(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{chequeDetail ? `${chequeDetail.type ? chequeDetail.type + " " : ""}${chequeDetailLabels[chequeDetail.bucket]}` : ""}</DialogTitle>
                    </DialogHeader>
                    {chequeDetailLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full border-collapse text-[12px]">
                                <thead>
                                    <tr className={`border-b ${BOX_BORDER} text-left text-slate-500 dark:text-zinc-400`}>
                                        <th className="px-2 py-1.5 font-semibold">Cheque #</th>
                                        <th className="px-2 py-1.5 font-semibold">Bank</th>
                                        <th className="px-2 py-1.5 font-semibold">Company</th>
                                        <th className="px-2 py-1.5 font-semibold">Date</th>
                                        <th className="px-2 py-1.5 font-semibold text-right">Amount</th>
                                        <th className="px-2 py-1.5 font-semibold text-right">Used</th>
                                        <th className="px-2 py-1.5 font-semibold text-right">Remaining</th>
                                        <th className="px-2 py-1.5 font-semibold text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(chequeDetailData?.data || []).map((c: any) => (
                                        <tr key={c.id} className={`border-b ${BOX_BORDER} hover:bg-slate-50 dark:hover:bg-zinc-800`}>
                                            <td className="px-2 py-1.5 text-slate-700 dark:text-zinc-300">{c.cheque_number}</td>
                                            <td className="px-2 py-1.5 text-slate-600 dark:text-zinc-400">{c.bank_name || "-"}</td>
                                            <td className="px-2 py-1.5 text-slate-600 dark:text-zinc-400">{c.company_name || "-"}</td>
                                            <td className="px-2 py-1.5 text-slate-500 dark:text-zinc-400">{format(new Date(c.cheque_date), "MM/dd/yyyy")}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-700 dark:text-zinc-300">{fmt(c.amount)}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-500 dark:text-zinc-400">{fmt(c.used_amount)}</td>
                                            <td className="px-2 py-1.5 text-right text-slate-500 dark:text-zinc-400">{fmt(c.remaining_amount)}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">{c.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {(chequeDetailData?.data || []).length === 0 && (
                                        <tr><td colSpan={8} className="py-6 text-center text-slate-400 italic">No cheques found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Generic metric drill-down — "View Data" for any row with real listable rows behind it */}
            <Dialog open={!!metricDetail} onOpenChange={(open) => !open && setMetricDetail(null)}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{metricDetail?.label}</DialogTitle>
                    </DialogHeader>
                    {metricDetailLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-500" /></div>
                    ) : (
                        <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
                            <table className="w-full border-collapse text-[12px]">
                                <thead>
                                    <tr className={`border-b ${BOX_BORDER} text-left text-slate-500 dark:text-zinc-400`}>
                                        {(metricDetailData?.columns || []).map((col: any) => (
                                            <th key={col.key} className={`whitespace-nowrap px-2 py-1.5 font-semibold ${col.align === "right" ? "text-right" : ""}`}>{col.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(metricDetailData?.data || []).map((row: any, i: number) => (
                                        <tr key={i} className={`border-b ${BOX_BORDER} hover:bg-slate-50 dark:hover:bg-zinc-800`}>
                                            {(metricDetailData?.columns || []).map((col: any) => (
                                                <td key={col.key} className={`whitespace-nowrap px-2 py-1.5 text-slate-700 dark:text-zinc-300 ${col.align === "right" ? "text-right" : ""}`}>
                                                    {fmtCell(col, row[col.key])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {(metricDetailData?.data || []).length === 0 && (
                                        <tr><td colSpan={(metricDetailData?.columns || []).length || 1} className="py-6 text-center text-slate-400 italic">No records found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reconciliation notes — "Add Details" for purely-derived figures with no raw rows */}
            <Dialog open={!!notesMetric} onOpenChange={(open) => { if (!open) { setNotesMetric(null); setNewNote(""); } }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{notesMetric?.label} — Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
                            {notesLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-emerald-500" /></div>
                            ) : (notesData?.data || []).length === 0 ? (
                                <div className="py-4 text-center text-sm italic text-slate-400">No details added yet.</div>
                            ) : (
                                (notesData?.data || []).map((n: any) => (
                                    <div key={n.id} className={`rounded border ${BOX_BORDER} p-2`}>
                                        <div className="text-[13px] text-slate-700 dark:text-zinc-300">{n.note}</div>
                                        <div className="mt-1 text-[10px] text-slate-400">{n.created_by_name || "Unknown"} · {format(new Date(n.created_at), "MMM dd, yyyy HH:mm")}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add a reconciliation note..."
                                className="h-9 flex-1 rounded border border-slate-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                            <button
                                disabled={!newNote.trim() || addNote.isPending}
                                onClick={() => notesMetric && addNote.mutate({ metric: notesMetric.key, note: newNote.trim() })}
                                className="rounded px-3 text-sm font-bold text-white disabled:opacity-50"
                                style={{ backgroundColor: HEADING_GREEN }}
                            >
                                {addNote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
