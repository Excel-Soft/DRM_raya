"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { downloadAuthedFile, DownloadError } from "@/lib/download/authed-download";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { OfficeAccountShell, DrmSection } from "@/modules/office-account/office-account-ui";
import type { AccountHead } from "@/modules/office-account/office-account-types";

const ALL = "__all__";
const PAGE_SIZE = 50;

interface LedgerRow {
  id: string;
  date: string;
  entryType: string;
  amount: string;
  currency: string;
  description: string | null;
  category: string | null;
  status: string;
  referenceId: string | null;
  referenceType: string | null;
  voucherId: string | null;
  branch: string | null;
  remarks: string | null;
  accountHeadId: string | null;
  accountHeadCode: string | null;
  accountHeadName: string | null;
  debit: string;
  credit: string;
}

interface LedgerSummary {
  totals: { debit: string; credit: string; difference: string; count: number };
  byAccountHead: Array<{ accountHeadId: string; code: string | null; name: string | null; debit: string; credit: string; balance: string }>;
}

interface FilterState {
  startDate: string;
  endDate: string;
  accountHeadId: string;
  branch: string;
  referenceType: string;
  status: string;
  q: string;
}

const EMPTY_FILTERS: FilterState = {
  startDate: "",
  endDate: "",
  accountHeadId: ALL,
  branch: "",
  referenceType: ALL,
  status: ALL,
  q: "",
};

function fmt(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

function buildQs(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.accountHeadId !== ALL) params.set("accountHeadId", filters.accountHeadId);
  if (filters.branch.trim()) params.set("branch", filters.branch.trim());
  if (filters.referenceType !== ALL) params.set("referenceType", filters.referenceType);
  if (filters.status !== ALL) params.set("status", filters.status);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return params.toString();
}

const STATUS_TONE: Record<string, string> = {
  Posted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Reversed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Reversal: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function GeneralLedgerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const qs = useMemo(() => buildQs(filters), [filters]);

  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: async () => (await apiRequest("GET", "/api/office/account-heads")).json(),
  });

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery<LedgerRow[]>({
    queryKey: ["/api/office/ledger", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/office/ledger${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load ledger.");
      return res.json();
    },
  });

  const { data: summary } = useQuery<LedgerSummary>({
    queryKey: ["/api/office/ledger/summary", qs],
    queryFn: async () => (await apiRequest("GET", `/api/office/ledger/summary${qs ? `?${qs}` : ""}`)).json(),
  });

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }
  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return rows.map((r) => {
      balance += (Number(r.debit) || 0) - (Number(r.credit) || 0);
      return { ...r, runningBalance: balance };
    });
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rowsWithBalance.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rowsWithBalance.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function invalidateLedger() {
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office/ledger") });
  }

  async function handleReverse(row: LedgerRow) {
    const reason = window.prompt("Enter a reason for reversing this manual journal (required):")?.trim();
    if (!reason) return;
    setReversingId(row.id);
    try {
      const body = await mutationRequest<{ reversedCount?: number }>("POST", `/api/office/ledger/${row.id}/reverse`, { reason });
      invalidateLedger();
      toast({ title: "Reversed", description: `Posted ${body?.reversedCount ?? 0} reversing entr${body?.reversedCount === 1 ? "y" : "ies"}.` });
    } catch (e: any) {
      toast({ title: "Reversal failed", description: e?.message || "Failed to reverse entry.", variant: "destructive" });
    } finally {
      setReversingId(null);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadAuthedFile(`/api/office/ledger/export${qs ? `?${qs}` : ""}`, `office-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      toast({ title: "Export failed", description: e instanceof DownloadError ? e.message : e?.message || "Failed to export ledger.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  const sortedHeads = useMemo(() => [...accountHeads].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })), [accountHeads]);

  const canReverse = (r: LedgerRow) => r.status === "Posted" && !r.voucherId && r.referenceType === "manual_journal";

  const columns: DataTableColumn<typeof pageRows[number]>[] = [
    { id: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.date)}</span> },
    { id: "code", header: "Code", cell: (r) => <span className="font-mono">{r.accountHeadCode ?? "—"}</span> },
    {
      id: "account",
      header: "Account / Description",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.accountHeadName ?? "—"}</div>
          {r.description && <div className="text-xs text-zinc-500">{r.description}</div>}
        </div>
      ),
    },
    { id: "reference", header: "Reference", cell: (r) => <span className="text-xs text-zinc-500">{r.referenceType ?? "—"}</span> },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <Badge variant="neutral" className={STATUS_TONE[r.status] ?? ""}>
          {r.status}
        </Badge>
      ),
    },
    { id: "debit", header: "Debit", cell: (r) => <span className="font-mono">{Number(r.debit) ? fmt(r.debit) : "—"}</span> },
    { id: "credit", header: "Credit", cell: (r) => <span className="font-mono">{Number(r.credit) ? fmt(r.credit) : "—"}</span> },
    { id: "balance", header: "Balance", cell: (r) => <span className="font-mono">{fmt(r.runningBalance)}</span> },
    {
      id: "action",
      header: "Action",
      cell: (r) =>
        canReverse(r) ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => handleReverse(r)}
            disabled={reversingId === r.id}
            title="Reverse manual journal"
          >
            <Undo2 className="h-4 w-4 text-amber-600" />
          </Button>
        ) : (
          <span className="text-zinc-300">—</span>
        ),
    },
  ];

  return (
    <OfficeAccountShell
      title="General Ledger"
      actions={
        <Button variant="secondary" onClick={handleExport} disabled={isExporting} className="gap-1.5">
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Total Debit</p>
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{fmt(summary?.totals?.debit)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Total Credit</p>
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{fmt(summary?.totals?.credit)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Difference</p>
          <p className={`text-lg font-bold ${Number(summary?.totals?.difference ?? 0) === 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmt(summary?.totals?.difference)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">Entries</p>
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">{summary?.totals?.count ?? 0}</p>
        </div>
      </div>

      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field id="gl-from" label="From">
            <Input id="gl-from" type="date" value={filters.startDate} onChange={(e) => updateFilter({ startDate: e.target.value })} />
          </Field>
          <Field id="gl-to" label="To">
            <Input id="gl-to" type="date" value={filters.endDate} onChange={(e) => updateFilter({ endDate: e.target.value })} />
          </Field>
          <Field id="gl-account-head" label="Account Head">
            <Select value={filters.accountHeadId} onValueChange={(v) => updateFilter({ accountHeadId: v })}>
              <SelectTrigger id="gl-account-head"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All account heads</SelectItem>
                {sortedHeads.map((h) => <SelectItem key={h.id} value={h.id}>{h.code} — {h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="gl-reference" label="Reference">
            <Select value={filters.referenceType} onValueChange={(v) => updateFilter({ referenceType: v })}>
              <SelectTrigger id="gl-reference"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All references</SelectItem>
                <SelectItem value="journal_voucher">Journal Voucher</SelectItem>
                <SelectItem value="manual_journal">Manual Journal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="gl-status" label="Status">
            <Select value={filters.status} onValueChange={(v) => updateFilter({ status: v })}>
              <SelectTrigger id="gl-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="Posted">Posted</SelectItem>
                <SelectItem value="Reversed">Reversed</SelectItem>
                <SelectItem value="Reversal">Reversal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="gl-branch" label="Branch">
            <Input id="gl-branch" value={filters.branch} onChange={(e) => updateFilter({ branch: e.target.value })} placeholder="Branch" />
          </Field>
          <Field id="gl-search" label="Search">
            <Input id="gl-search" value={filters.q} onChange={(e) => updateFilter({ q: e.target.value })} placeholder="Description / remarks" />
          </Field>
          <Button variant="ghost" onClick={resetFilters} className="gap-1.5">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="Ledger">
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError ? ((error as Error)?.message || "Failed to load ledger.") : null}
          onRetry={() => refetch()}
          emptyMessage="No ledger entries match the current filters."
          className="min-w-[1100px]"
        />
        {!isLoading && !isError && rowsWithBalance.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-end gap-6 border-t border-zinc-200 pt-2 text-sm font-medium dark:border-zinc-800">
            <span>Totals (all filtered)</span>
            <span className="font-mono font-bold">Debit: {fmt(summary?.totals?.debit)}</span>
            <span className="font-mono font-bold">Credit: {fmt(summary?.totals?.credit)}</span>
            <span className="font-mono font-bold">Diff: {fmt(summary?.totals?.difference)}</span>
          </div>
        )}
        {!isLoading && !isError && rowsWithBalance.length > 0 && (
          <PaginationBar page={currentPage} pageSize={PAGE_SIZE} total={rowsWithBalance.length} onPageChange={setPage} className="mt-4" />
        )}
      </DrmSection>
    </OfficeAccountShell>
  );
}
