import { useMemo, useState } from "react";
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

/**
 * "Overall Performance report" — target/achieve/A-/prediction per Sales or
 * Service person (GET /api/reports/sale-service/performance). Shared between
 * the full "Sale & Service Report" page (sale-service-report.tsx, 3 sections)
 * and the standalone "Update Sale And Service Report" page
 * (update-sale-service-report.tsx) — the legacy dashboard has two separate
 * buttons/PHP pages for these, but both only ever showed this one section.
 */

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface PerformanceRow {
  no: number;
  userId: string;
  name: string;
  branch: string | null;
  role: string;
  target: number;
  achieved: number;
  remain: number;
  aMinus: number;
  prediction: number;
}
interface PerformanceResponse {
  rows: PerformanceRow[];
  totals: { target: number; achieved: number; remain: number; aMinus: number; prediction: number };
}

export function SaleServicePerformanceSection({ cardTitle = "Overall Performance report" }: { cardTitle?: string }) {
  const [department, setDepartment] = useState<string>("");
  const [office, setOffice] = useState<string>("");
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<{ department: string; office: string; startDate: string; endDate: string } | null>(null);

  const { data: officesData } = useQuery<{ offices: string[] }>({
    queryKey: ["/api/reports/sale-service/offices"],
    queryFn: () => apiRequestJson("GET", "/api/reports/sale-service/offices"),
  });
  const offices = officesData?.offices ?? [];

  const { data, isLoading, isError } = useQuery<PerformanceResponse>({
    queryKey: ["/api/reports/sale-service/performance", applied],
    enabled: !!applied,
    queryFn: () => {
      const p = new URLSearchParams({
        department: applied!.department,
        startDate: applied!.startDate,
        endDate: applied!.endDate,
      });
      if (applied!.office) p.set("office", applied!.office);
      return apiRequestJson("GET", `/api/reports/sale-service/performance?${p.toString()}`);
    },
  });

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!search.trim()) return all;
    const term = search.trim().toLowerCase();
    return all.filter((r) => r.name?.toLowerCase().includes(term));
  }, [data, search]);

  function clearFilters() {
    setDepartment("");
    setOffice("");
    setStartDate(todayMinus(30));
    setEndDate(todayMinus(0));
    setSearch("");
    setApplied(null);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h4 className="card-title mb-3 text-[15px] font-bold text-[#495057] dark:text-zinc-300">{cardTitle}</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5 items-end mb-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger><SelectValue placeholder="Choose Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sale</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Office</Label>
            <Select value={office} onValueChange={(v) => setOffice(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All Offices" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Offices</SelectItem>
                {offices.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!department}
              onClick={() => setApplied({ department, office, startDate, endDate })}
            >
              Apply Filter
            </Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </div>
        {applied && (
          <div className="mb-3 max-w-[300px]">
            <Input placeholder="Search by person name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        {applied && (
          <div className="overflow-x-auto">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Achieve</TableHead>
                  <TableHead>Remain</TableHead>
                  <TableHead>A-</TableHead>
                  <TableHead>Prediction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-gray-500">Loading...</TableCell></TableRow>
                ) : isError ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-rose-600">Failed to load performance report.</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-6 text-gray-500">No records found.</TableCell></TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell>{r.no}</TableCell>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.branch ?? "-"}</TableCell>
                      <TableCell>{money(r.target)}</TableCell>
                      <TableCell>{money(r.achieved)}</TableCell>
                      <TableCell>{money(r.remain)}</TableCell>
                      <TableCell>{r.aMinus}</TableCell>
                      <TableCell>{r.prediction}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data && rows.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell colSpan={3} className="text-center">TOTAL</TableCell>
                    <TableCell>{money(data.totals.target)}</TableCell>
                    <TableCell>{money(data.totals.achieved)}</TableCell>
                    <TableCell>{money(data.totals.remain)}</TableCell>
                    <TableCell>{data.totals.aMinus}</TableCell>
                    <TableCell>{data.totals.prediction}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
