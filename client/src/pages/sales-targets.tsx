import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb } from "@/components/breadcrumb";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Summary = {
  achievedAmount: number;
  targetAmount: number;
  percent: number;
  previousPercent: number;
  deltaPercent: number;
};

type DetailRow = {
  key: string;
  name: string;
  achievedAmount: number;
};

type Details = {
  rows: DetailRow[];
  totals: { achievedAmount: number; targetAmount: number; percent: number };
};

export default function SalesTargets() {
  const [type, setType] = useState<"vas" | "ab">("vas");
  const [period, setPeriod] = useState<string>("thisMonth");

  const summaryQuery = useQuery<Summary>({
    queryKey: ["/api/sales/targets/summary", type, period],
    queryFn: async () => {
      const res = await fetch(`/api/sales/targets/summary?type=${type}&period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const detailsQuery = useQuery<Details>({
    queryKey: ["/api/sales/targets/details", type, period],
    queryFn: async () => {
      const res = await fetch(`/api/sales/targets/details?type=${type}&period=${period}&groupBy=day`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load details");
      return res.json();
    },
  });

  const rows = useMemo(() => detailsQuery.data?.rows ?? [], [detailsQuery.data]);

  return (
    <main className="p-6 space-y-6">
      <Breadcrumb items={[{ label: "Sales" }, { label: "Targets" }]} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Target Achievement</h1>
          <p className="text-muted-foreground text-sm">Track VAS/AB targets with period filters.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(v as "vas" | "ab")}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vas">VAS</SelectItem>
              <SelectItem value="ab">AB</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Period" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Overview of achieved vs target.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-4">
          {summaryQuery.isLoading ? (
            <div className="col-span-4 text-sm text-muted-foreground">Loading...</div>
          ) : summaryQuery.data ? (
            <>
              <Metric label="Achieved" value={`$${(summaryQuery.data.achievedAmount || 0).toLocaleString()}`} />
              <Metric label="Target" value={`$${(summaryQuery.data.targetAmount || 0).toLocaleString()}`} />
              <Metric label="Percent" value={`${Math.round(summaryQuery.data.percent)}%`} />
              <Metric label="Change vs previous" value={`${Math.round(summaryQuery.data.deltaPercent)}%`} />
            </>
          ) : (
            <div className="col-span-4 text-sm text-muted-foreground">No data.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
          <CardDescription>Daily achievement over the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          {detailsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground py-4">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">No data.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Achieved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{format(new Date(r.name), "PPP")}</TableCell>
                    <TableCell>${r.achievedAmount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
