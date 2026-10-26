"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageForbidden } from "@/components/ui/page-states";
import { PaginationBar } from "@/components/ui/pagination-bar";

export type AuditEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  module: string | null;
  reason: string | null;
  createdAt: string;
};

type AuditResponse = {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;

const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString() : "—");

type Filters = {
  actor: string;
  module: string;
  entityType: string;
  entityId: string;
  action: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters = (): Filters => ({
  actor: "",
  module: "",
  entityType: "",
  entityId: "",
  action: "",
  dateFrom: "",
  dateTo: "",
});

const auditColumns: DataTableColumn<AuditEntry>[] = [
  {
    id: "when",
    header: "When",
    cell: (r) => fmtDateTime(r.createdAt),
    className: "whitespace-nowrap text-zinc-600 dark:text-zinc-400",
  },
  {
    id: "actor",
    header: "Actor",
    cell: (r) => (
      <>
        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
          {r.actorName || r.actorEmail || r.actorId || "—"}
        </div>
        {r.actorRole ? <div className="text-[11px] text-zinc-400">{r.actorRole}</div> : null}
      </>
    ),
  },
  {
    id: "action",
    header: "Action",
    cell: (r) => r.action,
    className: "font-medium text-zinc-800 dark:text-zinc-200",
  },
  {
    id: "module",
    header: "Module",
    cell: (r) => r.module || "—",
    className: "text-zinc-600 dark:text-zinc-400",
  },
  {
    id: "entity",
    header: "Entity",
    cell: (r) => (
      <>
        <div className="font-medium text-zinc-800 dark:text-zinc-200">{r.entityLabel || r.entityType}</div>
        <div className="text-[11px] text-zinc-400">
          {r.entityType}
          {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}
        </div>
      </>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    cell: (r) => (
      <span className="block max-w-[240px] truncate" title={r.reason || ""}>
        {r.reason || "—"}
      </span>
    ),
    className: "text-zinc-600 dark:text-zinc-400",
  },
];

export function AuditLogsView() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      Object.entries(applied).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      const res = await apiFetch<AuditResponse>(`/api/audit-logs?${params.toString()}`);
      setData(res);
    } catch (e) {
      setData(null);
      if (e instanceof ApiError && e.status === 403) {
        setForbidden(true);
        return;
      }
      setError(e instanceof ApiError ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch audit list when filters/page change
    void load();
  }, [load]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const onApply = () => {
    setPage(1);
    setApplied(filters);
  };

  const onReset = () => {
    setFilters(emptyFilters());
    setApplied(emptyFilters());
    setPage(1);
  };

  const filterFields = useMemo(
    () =>
      [
        ["actor", "Actor (user id)"],
        ["module", "Module"],
        ["entityType", "Entity type"],
        ["entityId", "Entity ID"],
        ["action", "Action"],
      ] as const,
    [],
  );

  return (
    <Card>
      <PageHeader
        eyebrow="Admin"
        title="Audit Logs"
        description="Read-only audit trail. Access is enforced by Express role checks."
        actions={<Badge variant="brand">{total}</Badge>}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filterFields.map(([key, label]) => (
          <Input
            key={key}
            placeholder={label}
            aria-label={label}
            value={filters[key]}
            onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
          />
        ))}
        <Input
          type="date"
          aria-label="Date from"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
        />
        <Input
          type="date"
          aria-label="Date to"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
        />
        <div className="flex gap-2">
          <Button type="button" className="flex-1" onClick={onApply}>
            Apply
          </Button>
          <Button type="button" variant="secondary" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>

      {forbidden ? (
        <PageForbidden message="You do not have permission to view audit logs (403). Express rejected this role even if the UI route was reached." />
      ) : (
        <>
          <DataTable
            caption="Audit log entries"
            columns={auditColumns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={loading}
            error={error}
            onRetry={() => void load()}
            emptyMessage="No audit entries match these filters."
            className="min-w-[720px]"
          />
          {!loading && !error ? (
            <PaginationBar
              className="mt-4"
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              disabled={loading}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}
