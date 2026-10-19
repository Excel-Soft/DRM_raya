import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson, mutationRequest } from "@/lib/queryClient";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
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
import { useToast } from "@/hooks/use-toast";

// Legacy's status filter values map 1:1 to department-report.service.ts's
// MODE_MAP keys — "Project Create"/"Data Verify" are historical-event modes,
// the other 4 are workflow-completion gates that also unlock a per-period
// team commission (see COMPLETION_STATUSES below).
const statuses = [
  "Project Create",
  "Data Verify",
  "Manager Complete",
  "Qa Completed",
  "Verification Completed",
  "Verification Pending"
];

const COMPLETION_STATUSES = ["Manager Complete", "Qa Completed", "Verification Completed", "Verification Pending"];

type DeptFilterOption = { value: string; label: string };
type DeptFiltersResponse = { departments: DeptFilterOption[]; cities: string[] };

type DeptRow = {
  id: string;
  company_name: string | null;
  package_type: string | null;
  status: string | null;
  entry_type: string | null;
  project: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  payment_status: string | null;
  created_at: string | null;
  approved_at: string | null;
  department: string | null;
};

type DepartmentCommission = {
  companyCount: number;
  totalAmount: string;
  managerAmount: string;
  assistantAmount: string;
  alreadyCreated: boolean;
} | null;

type DeptResponse = {
  rows: DeptRow[];
  total: number;
  page: number;
  pageSize: number;
  commission: DepartmentCommission;
  amountTotal: string;
};

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export default function DepartmentReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deptSearch, setDeptSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ dept: string; city: string; status: string; start: string; end: string } | null>(null);

  const { data: filtersData } = useQuery<DeptFiltersResponse>({
    queryKey: ["/api/reports/department/filters"],
    queryFn: async () => apiRequestJson("GET", "/api/reports/department/filters"),
  });
  const departmentOptions = filtersData?.departments ?? [];
  const cityOptions = ["All", ...(filtersData?.cities ?? [])];

  const filteredDepts = departmentOptions.filter(d => d.label.toLowerCase().includes(deptSearch.toLowerCase()));
  const filteredCities = cityOptions.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  const filteredStatuses = statuses.filter(s => s.toLowerCase().includes(statusSearch.toLowerCase()));

  const query = useQuery<DeptResponse>({
    queryKey: ["/api/reports/department", applied?.dept, applied?.city, applied?.status, applied?.start, applied?.end],
    enabled: !!applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (applied?.dept) params.set("department", applied.dept);
      if (applied?.city) params.set("city", applied.city);
      if (applied?.status) params.set("status", applied.status);
      if (applied?.start) params.set("startDate", applied.start);
      if (applied?.end) params.set("endDate", applied.end);
      return apiRequestJson("GET", `/api/reports/department?${params.toString()}`);
    },
  });

  const verifyCommissionMutation = useMutation({
    mutationFn: async () => {
      if (!applied) return;
      return mutationRequest("POST", "/api/reports/department/verify-commission", {
        department: applied.dept,
        status: applied.status,
        startDate: applied.start,
        endDate: applied.end,
      });
    },
    onSuccess: () => {
      toast({ title: "Commission verified" });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/department"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to verify commission", description: err?.message, variant: "destructive" });
    },
  });

  const handleView = () => {
    if (!selectedDept || !selectedCity || !selectedStatus || !startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Please select all the fields (Department, City, Status, Start Date, End Date) before clicking View.",
        variant: "destructive"
      });
      return;
    }
    if (startDate > endDate) {
      toast({
        title: "Validation Error",
        description: "Start date must be on or before end date.",
        variant: "destructive"
      });
      return;
    }
    setApplied({ dept: selectedDept, city: selectedCity, status: selectedStatus, start: startDate, end: endDate });
  };

  const rows = query.data?.rows ?? [];
  const commission = query.data?.commission ?? null;
  const showCommissionPanel = !!applied && COMPLETION_STATUSES.includes(applied.status) && !!commission;
  // Legacy's "Project Create" mode (func.php ~line 20836-20845) appends a
  // simpler Amount-only total row — "Data Verify" and the completion modes
  // (handled by showCommissionPanel above) don't have one.
  const showAmountTotal = !!applied && applied.status === "Project Create" && rows.length > 0;
  const amountTotal = query.data?.amountTotal ?? "0";

  const exportColumns: ExportColumn<DeptRow>[] = [
    { key: "company_name", header: "Company", format: (v) => v ?? "" },
    { key: "package_type", header: "Package", format: (v) => v ?? "" },
    { key: "status", header: "Status", format: (v) => v ?? "" },
    { key: "project", header: "Project", format: (v) => v ?? "" },
    { key: "amount_pkr", header: "Amount", format: (v, row) => v ?? row.amount_usd ?? "" },
    { key: "payment_status", header: "Method", format: (v) => v ?? "" },
    { key: "approved_at", header: "Create/verify/Complete", format: (v, row) => fmtDate(v ?? row.created_at) },
  ];

  const handleCopy = async () => {
    if (!rows.length) return;
    const header = exportColumns.map((c) => c.header).join("\t");
    const lines = rows.map((row) =>
      exportColumns.map((c) => (c.format ? c.format((row as any)[c.key as string], row) : (row as any)[c.key as string] ?? "")).join("\t"),
    );
    try {
      await navigator.clipboard.writeText([header, ...lines].join("\n"));
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] dark:text-zinc-300 uppercase tracking-wide">
          DEPARTMENT PROJECT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

              {/* Department */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose ..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white dark:bg-zinc-900 z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search department..."
                        value={deptSearch}
                        onChange={(e) => setDeptSearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredDepts.map((d) => (
                        <SelectItem key={d.value} value={d.value} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {d.label}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* City */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">Select City</Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white dark:bg-zinc-900 z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search city..."
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredCities.map((c, idx) => (
                        <SelectItem key={idx} value={c} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {c}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">Select Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="p-0">
                    <div className="p-2 sticky top-0 bg-white dark:bg-zinc-900 z-10 border-b border-slate-100">
                      <Input
                        placeholder="Search status..."
                        value={statusSearch}
                        onChange={(e) => setStatusSearch(e.target.value)}
                        className="h-8 text-xs focus-visible:ring-0"
                      />
                    </div>
                    <div className="max-h-[250px] overflow-y-auto p-1">
                      {filteredStatuses.map((s, idx) => (
                        <SelectItem key={idx} value={s} className="text-[13px] focus:bg-[#00a65a] focus:text-white cursor-pointer py-2">
                          {s}
                        </SelectItem>
                      ))}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">Start Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">End Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus-visible:ring-0"
                  />
                </div>
              </div>

            </div>

            <div className="mt-6">
              <Button onClick={handleView} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm">
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm overflow-hidden mt-6">
          <div className="border-b border-slate-100 dark:border-zinc-800 py-4 px-6 bg-white dark:bg-zinc-900">
            <h2 className="text-[15px] font-bold text-[#555] dark:text-zinc-300 mb-3">List</h2>
            <div className="flex flex-wrap gap-[1px] bg-[#6c757d] p-[1px] rounded-sm overflow-hidden w-fit">
              <Button variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={handleCopy}>
                Copy
              </Button>
              <Button variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={() => exportToExcel(rows, exportColumns, "Department_Project")}>
                Excel
              </Button>
              <Button variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={() => exportToCSV(rows, exportColumns, "Department_Project")}>
                CSV
              </Button>
              <Button variant="ghost" size="sm" className="px-4 bg-[#6c757d] text-white hover:bg-[#5a6268] hover:text-white h-8 text-xs font-semibold rounded-none" onClick={() => exportToPDF(rows, exportColumns, "Department_Project", { title: "Department Project" })}>
                PDF
              </Button>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] dark:bg-zinc-900 hover:bg-[#d9f2e6] dark:hover:bg-zinc-900">
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">#</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Company</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Package</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Status</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Project</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Amount</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Method</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] dark:text-zinc-300 text-left">Create/verify/Complete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {!applied ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Please select all filters and click 'View' to display the data.
                      </TableCell>
                    </TableRow>
                  ) : query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#d9534f] dark:text-red-400 py-8">
                        Could not load the department report. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No records found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item, idx) => (
                      <TableRow key={item.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f8f9fa] dark:hover:bg-zinc-800 transition-colors">
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{idx + 1}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.company_name || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.package_type || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.status || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.project || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.amount_pkr ?? item.amount_usd ?? "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{item.payment_status || "-"}</TableCell>
                        <TableCell className="py-4 px-4 text-[#555] dark:text-zinc-300">{fmtDate(item.approved_at || item.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {showAmountTotal && (
                    <TableRow className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">{amountTotal}</TableCell>
                      <TableCell className="py-4 px-4" />
                      <TableCell className="py-4 px-4" />
                    </TableRow>
                  )}
                  {/* Legacy's own Total row (func.php ~line 21029-21046) reuses
                      the SAME 8-column grid as the data rows above, rather than
                      a separate summary block: #=Total, Company={count} x 500,
                      Package={count*500}, Status=Assistant, Project={count} x
                      200 = {amount}, Amount=Manager, Method={count} x 300 =
                      {amount}, Create/verify/Complete=button/Already Created. */}
                  {showCommissionPanel && commission && (
                    <TableRow className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">Total</TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">{commission.companyCount} x 500</TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">{commission.totalAmount}</TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">Assistant</TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">
                        {commission.companyCount} x 200 = {commission.assistantAmount}
                      </TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">Manager</TableCell>
                      <TableCell className="py-4 px-4 font-bold text-[#555] dark:text-zinc-300">
                        {commission.companyCount} x 300 = {commission.managerAmount}
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        {commission.alreadyCreated ? (
                          <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">Already Created</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => verifyCommissionMutation.mutate()}
                            disabled={verifyCommissionMutation.isPending || rows.length === 0}
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 h-8 text-xs font-semibold rounded-sm"
                          >
                            Verify Commission
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
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
