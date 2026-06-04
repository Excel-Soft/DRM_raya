import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PreviewItem = {
  userId: string;
  employeeName: string;
  department: string | null;
  branch: string | null;
  grossSalary: number;
  perDaySalary: number;
  daysPresent: number;
  daysAbsent: number;
  absenceDeduction: number;
  otherDeductions: number;
  overtimeAmount: number;
  netSalary: number;
};

type PreviewResponse = {
  period: { month: number; year: number };
  items: PreviewItem[];
  totals: { totalGross: number; totalDeductions: number; totalNet: number };
  employeeCount: number;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const now = new Date();

export default function SalaryCreate() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [viewItem, setViewItem] = useState<PreviewItem | null>(null);
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const preview = useQuery<PreviewResponse>({
    queryKey: ["/api/salary/preview", month, year],
    queryFn: async () =>
      apiRequestJson<PreviewResponse>("GET", `/api/salary/preview?month=${month}&year=${year}`),
  });

  const createRun = useMutation({
    mutationFn: async () =>
      apiRequestJson("POST", "/api/salary/runs", {
        month: Number(month),
        year: Number(year),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({ title: "Salary run created", description: `Saved a draft run for ${MONTHS[Number(month) - 1]} ${year}.` });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("409") || /already exists/i.test(err?.message || "")
        ? "A salary run for this period already exists."
        : "Could not create the salary run. You may not have permission, or something went wrong.";
      toast({ title: "Unable to create salary run", description: msg, variant: "destructive" });
    },
  });

  const items = preview.data?.items ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter((it) =>
        it.employeeName.toLowerCase().includes(term) || it.userId.toLowerCase().includes(term))
    : items;

  const periodLabel = `${month} / ${year}`;

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[17px] font-bold uppercase text-[#555]">SALARY CREATE</h1>
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">

            {/* Period + Actions */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 w-[150px] bg-white border-slate-200 text-[13px] focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 w-[110px] bg-white border-slate-200 text-[13px] focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createRun.mutate()}
                disabled={createRun.isPending || preview.isLoading || items.length === 0}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm"
              >
                {createRun.isPending ? "Saving..." : "Create Salary Run"}
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Net salary = gross (basic salary) − absence deductions for the selected
              period. Bonuses and other adjustments are not part of this computation.
            </p>

            {/* Search */}
            <div className="flex justify-end">
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs font-semibold text-slate-500">Search:</span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 mt-4">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">User ID</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Name</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Gross Salary</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Days Present</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Days Absent</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Absence RS</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Per Day RS</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Net Salary</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Month / Year</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-center text-xs">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {preview.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                    </TableRow>
                  ) : preview.isError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-[#d9534f] py-8">
                        Could not load the salary preview. You may not have permission to view payroll.
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No employees found for the selected period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.userId} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                        <TableCell className="py-3 px-3 text-[#555] font-mono text-[11px]">{item.userId.slice(0, 8)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] font-semibold">{item.employeeName || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{item.grossSalary}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{item.daysPresent}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{item.daysAbsent}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{item.absenceDeduction}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{item.perDaySalary}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] font-semibold">{item.netSalary}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{periodLabel}</TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          <button
                            onClick={() => setViewItem(item)}
                            className="text-[#00a65a] hover:text-[#008d4c] transition-colors bg-transparent border-none cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-[#777] mt-4 font-medium">
              Showing {filtered.length > 0 ? 1 : 0} to {filtered.length} of {filtered.length} entries
            </div>

          </CardContent>
        </Card>
      </div>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-[560px] w-[95vw]">
          <DialogHeader>
            <DialogTitle>Salary Detail — {viewItem?.employeeName}</DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] text-[#555]">
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Department</span><span>{viewItem.department || "-"}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Branch</span><span>{viewItem.branch || "-"}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Gross Salary</span><span>{viewItem.grossSalary}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Per Day</span><span>{viewItem.perDaySalary}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Days Present</span><span>{viewItem.daysPresent}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Days Absent</span><span>{viewItem.daysAbsent}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Absence Deduction</span><span>{viewItem.absenceDeduction}</span></div>
              <div className="flex justify-between border-b border-slate-100 pb-1"><span className="font-semibold">Overtime</span><span>{viewItem.overtimeAmount}</span></div>
              <div className="flex justify-between col-span-2 pt-1"><span className="font-bold">Net Salary</span><span className="font-bold">{viewItem.netSalary}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
