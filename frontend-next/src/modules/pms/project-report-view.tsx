"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PageForbidden } from "@/components/ui/page-states";
import { apiRequest } from "@/lib/query/query-client";
import { PmsShell, DrmSection } from "@/modules/pms/pms-ui";

type ProjectReportRow = {
  rowNumber: number;
  id: string;
  displayId: string | null;
  name: string | null;
  package: string | null;
  status: string | null;
  person: string | null;
  customerCreateDate: string | null;
  gmPayDate: string | null;
  gmDoc: number;
  bvDate: string | null;
  invoiceDate: string | null;
  receiptDate: string | null;
  method: string | null;
  project: string | null;
  projectCreateDate: string | null;
  dataDate: string | null;
  hodDate: string | null;
  depDate: string | null;
  p15: number;
  p15Penalty: boolean;
  assignDate: string | null;
  finish: string | null;
  remaining: number;
};

type ProjectReportResponse = {
  rows: ProjectReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type FetchParams = { companyName: string; startDate: string; endDate: string };

const LIMIT_OPTIONS = [10, 25, 50, 100] as const;

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function txt(value: string | null | undefined): string {
  return value && String(value).trim() !== "" ? String(value) : "-";
}

export function ProjectReportPage() {
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);
  const [dateError, setDateError] = useState("");

  const { data, isLoading, isError, error } = useQuery<ProjectReportResponse, Error & { status?: number }>({
    queryKey: ["/api/dd-manager/project-report", fetchParams, search, page, limit],
    enabled: !!fetchParams,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("startDate", fetchParams!.startDate);
      params.set("endDate", fetchParams!.endDate);
      if (fetchParams!.companyName) params.set("companyName", fetchParams!.companyName);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await apiRequest("GET", `/api/dd-manager/project-report?${params.toString()}`);
      if (res.status === 403) throw Object.assign(new Error("forbidden"), { status: 403 });
      if (!res.ok) throw new Error("request_failed");
      return res.json();
    },
  });

  const forbidden = isError && (error as { status?: number })?.status === 403;

  const handleView = () => {
    if (!startDate || !endDate) {
      setDateError("Please select both Start Date and End Date.");
      return;
    }
    if (startDate > endDate) {
      setDateError("Start Date must be on or before End Date.");
      return;
    }
    setDateError("");
    setPage(1);
    setFetchParams({ companyName: companyName.trim(), startDate, endDate });
  };

  const rows = data?.rows ?? [];
  const total = data?.pagination?.total ?? 0;

  const columns = useMemo((): DataTableColumn<ProjectReportRow>[] => [
    { id: "n", header: "#", cell: (r) => <span className="font-bold">{r.rowNumber}</span> },
    { id: "id", header: "ID", cell: (r) => <span className="font-bold">{txt(r.displayId)}</span> },
    { id: "name", header: "Name", cell: (r) => <span className="uppercase">{txt(r.name)}</span> },
    { id: "package", header: "Package", cell: (r) => txt(r.package) },
    { id: "status", header: "Status", cell: (r) => txt(r.status) },
    { id: "person", header: "Person", cell: (r) => txt(r.person) },
    { id: "customerCreate", header: "Create", cell: (r) => fmtDate(r.customerCreateDate) },
    { id: "gmPay", header: "GM Pay", cell: (r) => fmtDate(r.gmPayDate) },
    { id: "gmDoc", header: "GM Doc", cell: (r) => r.gmDoc ?? 0, className: "tabular-nums" },
    { id: "bvDate", header: "BV Date", cell: (r) => fmtDate(r.bvDate) },
    { id: "invoice", header: "Invoice", cell: (r) => fmtDate(r.invoiceDate) },
    { id: "receipt", header: "Receipt", cell: (r) => fmtDate(r.receiptDate) },
    { id: "method", header: "Method", cell: (r) => txt(r.method) },
    { id: "project", header: "Project", cell: (r) => txt(r.project) },
    { id: "projectCreate", header: "Create", cell: (r) => fmtDate(r.projectCreateDate) },
    { id: "data", header: "Data", cell: (r) => fmtDate(r.dataDate) },
    { id: "hod", header: "Hod", cell: (r) => fmtDate(r.hodDate) },
    { id: "dep", header: "Dep", cell: (r) => fmtDate(r.depDate) },
    {
      id: "p15",
      header: "15P",
      cell: (r) =>
        r.p15Penalty ? (
          <span className="font-semibold text-red-600 dark:text-red-400">{r.p15 ?? 0}-p</span>
        ) : (
          (r.p15 ?? 0)
        ),
    },
    { id: "assign", header: "Assign", cell: (r) => fmtDate(r.assignDate) },
    { id: "finish", header: "Finish", cell: (r) => fmtDate(r.finish) },
    { id: "remaining", header: "Remaining", cell: (r) => r.remaining ?? 0, className: "tabular-nums" },
  ], []);

  return (
    <PmsShell title="Project Report" description="Check project reports across a date range.">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field id="pr-company" label="Company Name">
            <Input
              placeholder="Enter name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </Field>
          <Field id="pr-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="pr-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={handleView} disabled={isLoading} variant="primary">
              {isLoading ? "Loading…" : "View"}
            </Button>
          </div>
        </div>
        {dateError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dateError}</p> : null}
      </DrmSection>

      {forbidden ? (
        <PageForbidden message="Unable to load the project report. You may not have access." />
      ) : (
        <DrmSection
          title="Report"
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                Show
                <select
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {LIMIT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                entries
              </label>
              <Input
                type="search"
                placeholder="Search records"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-56"
                aria-label="Search records"
              />
            </div>
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={!!fetchParams && isLoading}
            emptyMessage={fetchParams ? "No entries found" : "Select a date range and click View to load the report."}
            className="min-w-[2000px]"
          />
          {fetchParams && !isLoading && total > 0 ? (
            <PaginationBar page={page} pageSize={limit} total={total} onPageChange={setPage} className="mt-4" />
          ) : null}
        </DrmSection>
      )}
    </PmsShell>
  );
}
