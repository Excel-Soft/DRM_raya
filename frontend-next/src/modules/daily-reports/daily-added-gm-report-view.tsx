"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { apiRequestJson } from "@/lib/query/query-client";
import { DrmSection, drmFieldClass } from "@/modules/users/users-ui";
import { cn } from "@/lib/utils/cn";

type GmRow = {
  id: string;
  drm_id: string | null;
  company_name: string | null;
  sales_person_name: string | null;
  added_by_name: string | null;
  entry_type: string | null;
  package_type: string | null;
  gm_type: string | null;
  status: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  created_at: string | null;
};

type GmReportResponse = {
  rows: GmRow[];
  total: number;
  page: number;
  pageSize: number;
};

function fmtDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

const isRenewal = (entryType: string | null) => !!entryType && /renew/i.test(entryType);

export function DailyAddedGmReportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [dateError, setDateError] = useState<string | null>(null);

  const query = useQuery<GmReportResponse>({
    queryKey: ["/api/reports/daily-added-gm", applied.startDate, applied.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      return apiRequestJson<GmReportResponse>("GET", `/api/reports/daily-added-gm?${params.toString()}`);
    },
  });

  const handleSearch = () => {
    if (startDate && endDate && startDate > endDate) {
      setDateError("Start date must be on or before end date.");
      return;
    }
    setDateError(null);
    setApplied({ startDate, endDate });
  };

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;

  const columns = useMemo((): DataTableColumn<GmRow>[] => {
    return [
      {
        id: "id",
        header: "ID",
        cell: (row) => (
          <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.drm_id || row.id.slice(0, 8)}</span>
        ),
      },
      {
        id: "user",
        header: "User name",
        cell: (row) => (
          <span className="text-zinc-800 dark:text-zinc-200">{row.sales_person_name || row.added_by_name || "—"}</span>
        ),
      },
      {
        id: "company",
        header: "Company",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.company_name || "—"}</span>,
      },
      {
        id: "package",
        header: "Package",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.package_type || "—"}</span>,
      },
      {
        id: "gm_type",
        header: "GM type",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.gm_type || "—"}</span>,
      },
      {
        id: "usd",
        header: "USD",
        cell: (row) => <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{row.amount_usd ?? "—"}</span>,
        className: "whitespace-nowrap",
      },
      {
        id: "pkr",
        header: "PKR",
        cell: (row) => <span className="tabular-nums text-zinc-700 dark:text-zinc-300">{row.amount_pkr ?? "—"}</span>,
        className: "whitespace-nowrap",
      },
      {
        id: "created",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">{fmtDateTime(row.created_at)}</span>
        ),
      },
      {
        id: "entry",
        header: "Entry type",
        cell: (row) => (
          <Badge
            variant={isRenewal(row.entry_type) ? "success" : "brand"}
            className="normal-case tracking-normal"
          >
            {row.entry_type || "—"}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant="neutral" className="normal-case tracking-normal">
            {row.status || "—"}
          </Badge>
        ),
      },
    ];
  }, []);

  const filterActions = (
    <div className="flex flex-wrap items-end gap-3">
      <Field id="gm-start" label="Start date" className="w-full sm:w-44">
        <Input
          id="gm-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={drmFieldClass}
        />
      </Field>
      <Field id="gm-end" label="End date" className="w-full sm:w-44">
        <Input
          id="gm-end"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={drmFieldClass}
        />
      </Field>
      <Button type="button" variant="primary" size="sm" onClick={handleSearch} className="mb-0.5">
        <Search className="mr-2 h-4 w-4" />
        Search
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Daily reports"
        title="Daily added GM report"
        description="GM/BV entries created in the selected date range (scoped by your role on the server)."
      />

      {dateError ? <p className="text-sm text-red-600 dark:text-red-400">{dateError}</p> : null}

      <DrmSection
        title="GM records"
        description={query.isLoading ? "Loading…" : `${total} record${total === 1 ? "" : "s"} (up to 100 shown).`}
        actions={filterActions}
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={query.isLoading}
          error={query.isError ? "Could not load the GM record. Please try again." : null}
          onRetry={() => query.refetch()}
          emptyMessage="No records found for the selected date range."
          className={cn("min-w-[960px]")}
        />
      </DrmSection>
    </div>
  );
}
