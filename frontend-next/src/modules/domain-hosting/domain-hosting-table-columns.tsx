"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { cn } from "@/lib/utils/cn";
import {
  DhExpiryCell,
  DomainAttributeDialog,
  DomainQuotationDialog,
  fmtDhDate,
  type DomainRow,
} from "./domain-hosting-shared";
import { dhSelectTriggerClass } from "./domain-hosting-ui";

export function domainIndexColumn<T extends { id: string }>(rows: T[]): DataTableColumn<T> {
  return {
    id: "no",
    header: "#",
    className: "w-12 tabular-nums text-zinc-500",
    cell: (row) => {
      const idx = rows.findIndex((r) => r.id === row.id);
      return idx >= 0 ? idx + 1 : "—";
    },
  };
}

type DomainColumnOptions = {
  rows: DomainRow[];
  onCopied: () => void;
  onEdit?: (row: DomainRow) => void;
  onDelete?: (row: DomainRow) => void;
  deletePending?: boolean;
};

export function buildDomainTableColumns(opts: DomainColumnOptions): DataTableColumn<DomainRow>[] {
  const { rows, onCopied, onEdit, onDelete, deletePending } = opts;
  const cols: DataTableColumn<DomainRow>[] = [
    domainIndexColumn(rows),
    {
      id: "company",
      header: "Company",
      cell: (row) => <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.company || "—"}</span>,
    },
    {
      id: "domain",
      header: "Domain",
      cell: (row) => (
        <Badge variant="brand" className="normal-case">
          {row.domainName || row.domain || "—"}
        </Badge>
      ),
    },
    { id: "domExp", header: "Domain expiry", cell: (row) => <DhExpiryCell date={row.expiryDate} /> },
    { id: "hostExp", header: "Hosting", cell: (row) => <DhExpiryCell date={row.hostingExpiryDate} /> },
    { id: "sslExp", header: "SSL", cell: (row) => <DhExpiryCell date={row.sslExpiryDate} /> },
    {
      id: "registered",
      header: "Registered",
      cell: (row) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{fmtDhDate(row.createdAt)}</span>,
    },
    {
      id: "actions",
      header: "",
      className: "w-44 text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <DomainAttributeDialog item={row} onCopied={onCopied} />
          <DomainQuotationDialog item={row} />
          {onEdit ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(row)} aria-label="Edit domain">
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              onClick={() => onDelete(row)}
              disabled={deletePending}
              aria-label="Delete domain"
            >
              {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return cols;
}

export type ServerRow = {
  id: string;
  name?: string;
  ip?: string;
  provider?: string;
  capacityMb?: number | null;
  usedSpaceMb?: number | null;
  daysLeft?: number | null;
  expiryDate?: string | null;
  status?: string;
};

function serverExpiryBadge(server: ServerRow): ReactNode {
  if (server.daysLeft == null) {
    return (
      <Badge variant="neutral" className="normal-case">
        N/A
      </Badge>
    );
  }
  if (server.daysLeft < 0) {
    return (
      <Badge variant="warning" className="normal-case">
        Expired
      </Badge>
    );
  }
  if (server.daysLeft <= 30) {
    return (
      <Badge variant="brand" className="normal-case">
        {server.daysLeft}d left
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="normal-case">
      {server.daysLeft}d left
    </Badge>
  );
}

function serverStatusVariant(status: string): "success" | "neutral" | "warning" | "brand" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "ARCHIVED":
      return "warning";
    case "INACTIVE":
      return "neutral";
    default:
      return "neutral";
  }
}

type ServerColumnOptions = {
  rows: ServerRow[];
  statusOptions: readonly string[];
  onStatusChange: (id: string, status: string) => void;
  onEdit: (row: ServerRow) => void;
  onDelete: (row: ServerRow) => void;
  deletePending?: boolean;
};

export function buildServerTableColumns(opts: ServerColumnOptions): DataTableColumn<ServerRow>[] {
  const { rows, statusOptions, onStatusChange, onEdit, onDelete, deletePending } = opts;
  return [
    domainIndexColumn(rows),
    {
      id: "name",
      header: "Server",
      cell: (row) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{row.name || "—"}</span>,
    },
    {
      id: "host",
      header: "Host / IP",
      cell: (row) => <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{row.ip || "—"}</span>,
    },
    {
      id: "provider",
      header: "Provider",
      cell: (row) => row.provider || "—",
    },
    {
      id: "space",
      header: "Storage",
      cell: (row) =>
        row.capacityMb != null ? (
          <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
            {row.usedSpaceMb ?? 0} / {row.capacityMb} MB
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "expiry",
      header: "Expiry",
      cell: (row) => (
        <div className="space-y-1">
          {serverExpiryBadge(row)}
          {row.expiryDate ? (
            <p className="text-[11px] text-zinc-500">{fmtDhDate(row.expiryDate)}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const label = String(row.status ?? "ACTIVE").trim().toUpperCase();
        const normalized = statusOptions.includes(label) ? label : "ACTIVE";
        return (
          <div className="flex min-w-[140px] flex-col gap-1.5">
            <Badge variant={serverStatusVariant(normalized)} className="w-fit normal-case">
              {normalized}
            </Badge>
            <Select value={normalized} onValueChange={(val) => onStatusChange(row.id, val)}>
              <SelectTrigger className={cn(dhSelectTriggerClass, "h-8 text-xs")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(row)} aria-label="Edit server">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={() => onDelete(row)}
            disabled={deletePending}
            aria-label="Delete server"
          >
            {deletePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];
}
