import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SalaryRun = {
  id: string;
  period_month: number;
  period_year: number;
  branch: string | null;
  department: string | null;
  status: string;
  employee_count: number;
  total_gross: string | null;
  total_deductions: string | null;
  total_net: string | null;
};

type SalaryRunItem = {
  id: string;
  employee_name: string | null;
  department: string | null;
  branch: string | null;
  gross_salary: string | null;
  per_day_salary: string | null;
  days_present: number | null;
  days_absent: number | null;
  absence_deduction: string | null;
  overtime_amount: string | null;
  net_salary: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(m: number, y: number) {
  return `${MONTHS[m - 1] || m} ${y}`;
}

export default function SalaryReport() {
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  const runsQuery = useQuery<{ runs: SalaryRun[] }>({
    queryKey: ["/api/salary/runs"],
    queryFn: async () => apiRequestJson("GET", "/api/salary/runs"),
  });

  const runDetail = useQuery<{ run: SalaryRun; items: SalaryRunItem[] }>({
    queryKey: ["/api/salary/runs", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => apiRequestJson("GET", `/api/salary/runs/${selectedRunId}`),
  });

  const runs = runsQuery.data?.runs ?? [];
  const items = runDetail.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter((it) => (it.employee_name || "").toLowerCase().includes(term))
    : items;

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4">
          <h1 className="text-[17px] font-bold text-[#555] uppercase">SALARY REPORT</h1>
          <div>
            <Button
              onClick={() => window.print()}
              disabled={!selectedRunId || items.length === 0}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-semibold rounded-sm h-9"
            >
              Print Slip
            </Button>
          </div>
        </div>

        {/* Run selector */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col gap-2 max-w-md">
              <Label className="text-xs text-[#555] font-semibold">Select Salary Run</Label>
              {runsQuery.isLoading ? (
                <p className="text-sm text-slate-500">Loading runs...</p>
              ) : runsQuery.isError ? (
                <p className="text-sm text-[#d9534f]">Could not load salary runs. You may not have permission to view payroll.</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-slate-500">No salary runs have been created yet. Create one from the Salary Create screen.</p>
              ) : (
                <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-xs text-[#555] rounded-sm focus:ring-0">
                    <SelectValue placeholder="Choose a run..." />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {monthLabel(r.period_month, r.period_year)}
                        {r.department ? ` · ${r.department}` : ""}
                        {r.branch ? ` · ${r.branch}` : ""} — {r.status} ({r.employee_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Data Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-6">

            <div className="flex flex-wrap items-end justify-end gap-4">
              <div className="flex flex-col gap-1 items-end">
                <Label className="text-xs text-[#555] font-semibold">Search:</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#e0f3e8]">
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">#</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Name</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Department</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Gross Salary</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Per Day</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Present</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Absent</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Absence RS</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Overtime</TableHead>
                    <TableHead className="py-2.5 px-2 font-bold text-[#333] text-left text-xs">Net Salary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {!selectedRunId ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        Select a salary run to view its line items.
                      </TableCell>
                    </TableRow>
                  ) : runDetail.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                    </TableRow>
                  ) : runDetail.isError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-[#d9534f] py-8">
                        Could not load this salary run.
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No salary lines in this run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, idx) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                        <TableCell className="py-3 px-2 text-[#555] font-semibold">{idx + 1}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.employee_name || "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.department || "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.gross_salary ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.per_day_salary ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.days_present ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.days_absent ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.absence_deduction ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555]">{item.overtime_amount ?? "-"}</TableCell>
                        <TableCell className="py-3 px-2 text-[#555] font-semibold">{item.net_salary ?? "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
