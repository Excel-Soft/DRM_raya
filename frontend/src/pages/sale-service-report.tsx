import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequestJson } from "@/lib/queryClient";
import { SaleServicePerformanceSection } from "@/components/sale-service-performance-section";

/**
 * Rebuild of a legacy PHP admin report (the user supplied the old PHP source
 * as a spec — not part of this app's history, built against different tables
 * entirely). Three sections, each independently filtered/loaded:
 *   1. Overall Performance report — target/achieve/A-/prediction per Sales or
 *      Service person (new GET /api/reports/sale-service/performance).
 *   2. Daily Activities — reuses the dashboard's existing Activities matrix
 *      (GET /api/dashboard/activities, already scoped to Sales+Service),
 *      with team subtotal rows added here.
 *   3. Team Work Performance — reuses the existing GET
 *      /api/dashboard/team-work-performance?scope=sales_service.
 */

const SALES_ROLES = new Set(["sales_manager", "sales_assistant_manager", "sales_executive"]);

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
// ─── Section 2 ────────────────────────────────────────────────────────────
interface ActivityMethod { done: number; target: number; minutes?: number }
interface ActivityRow {
  userId: string;
  name: string;
  role: string;
  methods: {
    mobile: ActivityMethod; whatsapp: ActivityMethod; whCall: ActivityMethod;
    inMeeting: ActivityMethod; onsite: ActivityMethod; email: ActivityMethod;
    seminar: ActivityMethod; webinar: ActivityMethod; appointment: ActivityMethod;
    meeting: ActivityMethod; aMinus: ActivityMethod; bPlus: ActivityMethod;
  };
  totals: { activities: number; timeMinutes: number };
}
interface ActivitiesResponse { data: { rows: ActivityRow[] } }

const METHOD_COLUMNS: { key: keyof ActivityRow["methods"]; label: string }[] = [
  { key: "mobile", label: "Mob" },
  { key: "whatsapp", label: "WA" },
  { key: "onsite", label: "Site" },
  { key: "email", label: "Mail" },
  { key: "seminar", label: "Sem" },
  { key: "webinar", label: "Web" },
  { key: "appointment", label: "Apt" },
  { key: "meeting", label: "Met" },
  { key: "aMinus", label: "A-" },
  { key: "bPlus", label: "B+" },
];

function DailyActivitiesSection() {
  const [period, setPeriod] = useState("TD");

  const { data, isLoading, isError } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/dashboard/activities", period],
    queryFn: () => apiRequestJson("GET", `/api/dashboard/activities?period=${period}`),
  });
  const rows = data?.data?.rows ?? [];

  const salesRows = rows.filter((r) => SALES_ROLES.has(r.role));
  const serviceRows = rows.filter((r) => !SALES_ROLES.has(r.role));

  function subtotal(group: ActivityRow[]): Record<string, number> {
    const out: Record<string, number> = { timeMinutes: 0 };
    for (const col of METHOD_COLUMNS) out[col.key] = 0;
    for (const r of group) {
      for (const col of METHOD_COLUMNS) out[col.key] += r.methods[col.key]?.done ?? 0;
      out.timeMinutes += r.totals?.timeMinutes ?? 0;
    }
    return out;
  }
  const salesTotal = subtotal(salesRows);
  const serviceTotal = subtotal(serviceRows);
  const grandTotal = subtotal(rows);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Daily Activities</h4>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TD">Today</SelectItem>
              <SelectItem value="WC">This Week</SelectItem>
              <SelectItem value="MONTH">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {METHOD_COLUMNS.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
                <TableHead className="text-center">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={METHOD_COLUMNS.length + 2} className="text-center py-6 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={METHOD_COLUMNS.length + 2} className="text-center py-6 text-rose-600">Failed to load activities.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={METHOD_COLUMNS.length + 2} className="text-center py-6 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.userId} className={SALES_ROLES.has(r.role) ? "bg-amber-50/40 dark:bg-transparent" : "bg-blue-50/40 dark:bg-transparent"}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    {METHOD_COLUMNS.map((c) => (
                      <TableCell key={c.key} className="text-center">{r.methods[c.key]?.done ?? 0}</TableCell>
                    ))}
                    <TableCell className="text-center">{Math.round(r.totals?.timeMinutes ?? 0)}m</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell>Sales Team Total ({salesRows.length})</TableCell>
                  {METHOD_COLUMNS.map((c) => <TableCell key={c.key} className="text-center">{salesTotal[c.key]}</TableCell>)}
                  <TableCell className="text-center">{Math.round(salesTotal.timeMinutes)}m</TableCell>
                </TableRow>
                <TableRow className="font-semibold">
                  <TableCell>Service Team Total ({serviceRows.length})</TableCell>
                  {METHOD_COLUMNS.map((c) => <TableCell key={c.key} className="text-center">{serviceTotal[c.key]}</TableCell>)}
                  <TableCell className="text-center">{Math.round(serviceTotal.timeMinutes)}m</TableCell>
                </TableRow>
                <TableRow className="font-bold bg-gray-100 dark:bg-zinc-800">
                  <TableCell>Grand Total ({rows.length})</TableCell>
                  {METHOD_COLUMNS.map((c) => <TableCell key={c.key} className="text-center">{grandTotal[c.key]}</TableCell>)}
                  <TableCell className="text-center">{Math.round(grandTotal.timeMinutes)}m</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section 3 ────────────────────────────────────────────────────────────
interface TeamWorkRow {
  userId: string | null;
  name: string;
  leads: number;
  follow: number;
  notFollow: number;
  aMinusCustomer: number;
  bPlusCustomer: number;
  bCustomer: number;
  bMinusCustomer: number;
  callConnected: number;
  notResponse: number;
  appointment: number;
  meeting: number;
}
interface TeamWorkResponse { data: { items: TeamWorkRow[] } }

function TeamWorkPerformanceSection() {
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [applied, setApplied] = useState<{ start: string; end: string }>({ start: startDate, end: endDate });

  const { data, isLoading, isError } = useQuery<TeamWorkResponse>({
    queryKey: ["/api/dashboard/team-work-performance", applied],
    queryFn: () => apiRequestJson(
      "GET",
      `/api/dashboard/team-work-performance?scope=sales_service&start=${applied.start}&end=${applied.end}`,
    ),
  });
  const rows = data?.data?.items ?? [];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Team Work Performance</h4>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={() => setApplied({ start: startDate, end: endDate })}>View</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Follow</TableHead>
                <TableHead>Not Follow</TableHead>
                <TableHead>A-</TableHead>
                <TableHead>B+</TableHead>
                <TableHead>B</TableHead>
                <TableHead>B-</TableHead>
                <TableHead>Call Connected</TableHead>
                <TableHead>Appointment</TableHead>
                <TableHead>Meeting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-6 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={11} className="text-center py-6 text-rose-600">Failed to load team work performance.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-6 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={r.userId ?? i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.leads}</TableCell>
                    <TableCell>{r.follow}</TableCell>
                    <TableCell>{r.notFollow}</TableCell>
                    <TableCell>{r.aMinusCustomer}</TableCell>
                    <TableCell>{r.bPlusCustomer}</TableCell>
                    <TableCell>{r.bCustomer}</TableCell>
                    <TableCell>{r.bMinusCustomer}</TableCell>
                    <TableCell>{r.callConnected}</TableCell>
                    <TableCell>{r.appointment}</TableCell>
                    <TableCell>{r.meeting}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SaleServiceReport() {
  return (
    <div className="p-6 space-y-6">
      <h4 className="mb-0 font-size-18 text-xl font-bold text-[#495057] dark:text-zinc-300">Sale And Service Report</h4>
      <SaleServicePerformanceSection />
      <DailyActivitiesSection />
      <TeamWorkPerformanceSection />
    </div>
  );
}
