"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export/export-utils";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

const STATUSES = ["Project Create", "Data Verify", "Manager Complete", "Qa Completed", "Verification Completed", "Verification Pending"];
const COMPLETION_STATUSES = ["Manager Complete", "Qa Completed", "Verification Completed", "Verification Pending"];

type DeptFilterOption = { value: string; label: string };
type DeptRow = {
  id: string;
  company_name: string | null;
  package_type: string | null;
  status: string | null;
  project: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  payment_status: string | null;
  created_at: string | null;
  approved_at: string | null;
};
type DepartmentCommission = { companyCount: number; totalAmount: string; managerAmount: string; assistantAmount: string; alreadyCreated: boolean } | null;
type DeptResponse = { rows: DeptRow[]; commission: DepartmentCommission; amountTotal: string };
type Applied = { dept: string; city: string; status: string; start: string; end: string };

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 19).replace("T", " ");
}

export function DepartmentReportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<Applied | null>(null);

  const { data: filtersData } = useQuery<{ departments: DeptFilterOption[]; cities: string[] }>({
    queryKey: ["/api/reports/department/filters"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reports/department/filters");
      if (!res.ok) return { departments: [], cities: [] };
      return res.json();
    },
  });
  const departmentOptions = filtersData?.departments ?? [];
  const cityOptions = ["All", ...(filtersData?.cities ?? [])];

  const query = useQuery<DeptResponse>({
    queryKey: ["/api/reports/department", applied],
    enabled: !!applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (applied?.dept) params.set("department", applied.dept);
      if (applied?.city) params.set("city", applied.city);
      if (applied?.status) params.set("status", applied.status);
      if (applied?.start) params.set("startDate", applied.start);
      if (applied?.end) params.set("endDate", applied.end);
      const res = await apiRequest("GET", `/api/reports/department?${params}`);
      if (!res.ok) throw new Error("Failed to load the department report.");
      return res.json();
    },
  });

  const verifyCommissionMutation = useMutation({
    mutationFn: async () => {
      if (!applied) return;
      const res = await apiRequest("POST", "/api/reports/department/verify-commission", {
        department: applied.dept,
        status: applied.status,
        startDate: applied.start,
        endDate: applied.end,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to verify commission.");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Commission verified" });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/department"] });
    },
    onError: (err: Error) => toast({ title: "Failed to verify commission", description: err.message, variant: "destructive" }),
  });

  const handleView = () => {
    if (!selectedDept || !selectedCity || !selectedStatus || !startDate || !endDate) {
      toast({ title: "Validation Error", description: "Please select all the fields before clicking View.", variant: "destructive" });
      return;
    }
    if (startDate > endDate) {
      toast({ title: "Validation Error", description: "Start date must be on or before end date.", variant: "destructive" });
      return;
    }
    setApplied({ dept: selectedDept, city: selectedCity, status: selectedStatus, start: startDate, end: endDate });
  };

  const rows = query.data?.rows ?? [];
  const commission = query.data?.commission ?? null;
  const showCommissionPanel = !!applied && COMPLETION_STATUSES.includes(applied.status) && !!commission;
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
    const lines = rows.map((row) => exportColumns.map((c) => (c.format ? c.format((row as any)[c.key as string], row) : (row as any)[c.key as string] ?? "")).join("\t"));
    await navigator.clipboard.writeText([header, ...lines].join("\n"));
    toast({ title: "Copied to clipboard" });
  };

  const columns = useMemo((): DataTableColumn<DeptRow>[] => [
    { id: "company", header: "Company", cell: (r) => r.company_name || "-" },
    { id: "package", header: "Package", cell: (r) => r.package_type || "-" },
    { id: "status", header: "Status", cell: (r) => r.status || "-" },
    { id: "project", header: "Project", cell: (r) => r.project || "-" },
    { id: "amount", header: "Amount", cell: (r) => r.amount_pkr ?? r.amount_usd ?? "-" },
    { id: "method", header: "Method", cell: (r) => r.payment_status || "-" },
    { id: "complete", header: "Create/verify/Complete", cell: (r) => fmtDate(r.approved_at || r.created_at) },
  ], []);

  return (
    <ReportsShell title="Department Project">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Field id="dp-dept" label="Department">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger id="dp-dept">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="dp-city" label="Select City">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger id="dp-city">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="dp-status" label="Select Status">
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger id="dp-status">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="dp-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="dp-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={handleView}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection
        title="List"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              Copy
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToExcel(rows, exportColumns, "Department_Project")}>
              Excel
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToCSV(rows, exportColumns, "Department_Project")}>
              CSV
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => exportToPDF(rows, exportColumns, "Department_Project", { title: "Department Project" })}>
              PDF
            </Button>
          </div>
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={!!applied && query.isLoading}
          error={query.isError ? "Could not load the department report. Please try again." : null}
          onRetry={() => query.refetch()}
          emptyMessage={applied ? "No records found for the selected filters." : "Please select all filters and click 'View' to display the data."}
          className="min-w-[1100px]"
        />
        {showAmountTotal ? (
          <div className="mt-2 flex justify-end border-t border-zinc-200 pt-2 text-sm font-bold dark:border-zinc-800">Amount total: {amountTotal}</div>
        ) : null}
        {showCommissionPanel && commission ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap gap-4">
              <span>
                Total: <strong>{commission.companyCount} x 500 = {commission.totalAmount}</strong>
              </span>
              <span>
                Assistant: <strong>{commission.companyCount} x 200 = {commission.assistantAmount}</strong>
              </span>
              <span>
                Manager: <strong>{commission.companyCount} x 300 = {commission.managerAmount}</strong>
              </span>
            </div>
            {commission.alreadyCreated ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Already Created</span>
            ) : (
              <Button type="button" size="sm" variant="primary" disabled={verifyCommissionMutation.isPending || rows.length === 0} onClick={() => verifyCommissionMutation.mutate()}>
                Verify Commission
              </Button>
            )}
          </div>
        ) : null}
      </DrmSection>
    </ReportsShell>
  );
}
