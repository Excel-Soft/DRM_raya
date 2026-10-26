"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { customerAttributePath } from "@/lib/navigation/customer-routes";
import { LEAD_LEAD_POOL } from "@/lib/navigation/lead-routes";
import { drmFieldClass } from "@/modules/drm/drm-ui";
import { cn } from "@/lib/utils/cn";

type GmBvRow = {
  id: string;
  customerId?: string | null;
  companyName?: string;
  drmId?: string | null;
  salesPersonName?: string | null;
  accountName?: string | null;
  contactNo?: string | null;
  email?: string | null;
  status?: string | null;
  reportDate?: string | null;
  createdAt?: string | null;
};

type ListResponse = {
  items: GmBvRow[];
  total: number;
  page?: number;
  pageSize?: number;
};

const STATUS_OPTIONS = ["all", "Draft", "Submitted", "Approved", "Rejected"] as const;

function fmtDate(val?: string | null) {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function LeadGmBvPoolView() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const listPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (status !== "all") params.set("status", status);
    return `/api/gm-bv-pool?${params.toString()}`;
  }, [page, pageSize, debouncedSearch, status]);

  const { data, loading, error, refetch } = useApiResource<ListResponse>(listPath);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: DataTableColumn<GmBvRow>[] = useMemo(
    () => [
      {
        id: "drm",
        header: "DRM ID",
        className: "font-mono text-xs text-zinc-500",
        cell: (r) => r.drmId || r.id.slice(0, 8),
      },
      {
        id: "company",
        header: "Company",
        cell: (r) => <span className="font-medium">{r.companyName || "—"}</span>,
      },
      {
        id: "sales",
        header: "Sales person",
        cell: (r) => r.salesPersonName || "—",
      },
      {
        id: "contact",
        header: "Contact",
        cell: (r) => r.contactNo || r.email || "—",
      },
      {
        id: "status",
        header: "Status",
        cell: (r) => (
          <Badge variant={r.status === "Approved" ? "success" : r.status === "Rejected" ? "warning" : "neutral"}>
            {r.status || "Draft"}
          </Badge>
        ),
      },
      {
        id: "date",
        header: "Report date",
        cell: (r) => fmtDate(r.reportDate || r.createdAt),
      },
      {
        id: "action",
        header: "",
        headerClassName: "text-right",
        className: "text-right",
        cell: (r) =>
          r.customerId ? (
            <Link
              href={customerAttributePath(r.customerId)}
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Open customer
            </Link>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <Card>
      <PageHeader
        eyebrow="Lead"
        title="GM BV Pool"
        description="Gold Member business verification pool — linked customers and BV status."
        actions={
          <Link
            href={LEAD_LEAD_POOL}
            className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            Lead pool
          </Link>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-12">
        <Field id="gmbv-search" label="Search" className="md:col-span-6">
          <Input
            id="gmbv-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Company, contact, or DRM ID"
            className={cn(drmFieldClass, "h-9")}
          />
        </Field>
        <Field id="gmbv-status" label="Status" className="md:col-span-3">
          <select
            id="gmbv-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as (typeof STATUS_OPTIONS)[number]);
              setPage(1);
            }}
            className={cn(drmFieldClass, "h-9 w-full text-sm")}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end md:col-span-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <PageLoading label="Loading GM BV pool…" />
      ) : error ? (
        <PageError message={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <DataTable
            caption="GM BV pool entries"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No GM BV entries in this pool."
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Showing {rows.length} of {total} entries
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="flex items-center px-2 text-xs font-semibold">
                Page {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
