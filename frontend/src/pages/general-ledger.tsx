import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Download, RotateCcw, Undo2 } from "lucide-react";
import type { AccountHead } from "@shared/schema";

const ALL = "__all__";
const PAGE_SIZE = 50;

type LedgerRow = {
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
};

type LedgerSummary = {
  totals: { debit: string; credit: string; difference: string; count: number };
  byAccountHead: Array<{
    accountHeadId: string;
    code: string | null;
    name: string | null;
    debit: string;
    credit: string;
    balance: string;
  }>;
};

type FilterState = {
  startDate: string;
  endDate: string;
  accountHeadId: string;
  branch: string;
  referenceType: string;
  status: string;
  q: string;
};

const EMPTY_FILTERS: FilterState = {
  startDate: "",
  endDate: "",
  accountHeadId: ALL,
  branch: "",
  referenceType: ALL,
  status: ALL,
  q: "",
};

const fmt = (value: unknown): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const fmtDate = (value: string): string => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return (
      body?.error?.message ||
      body?.message ||
      (typeof body?.error === "string" ? body.error : fallback)
    );
  } catch {
    return fallback;
  }
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

export default function GeneralLedger() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const qs = useMemo(() => buildQs(filters), [filters]);

  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<LedgerRow[]>({
    queryKey: [`/api/office/ledger${qs ? `?${qs}` : ""}`],
  });

  const { data: summary } = useQuery<LedgerSummary>({
    queryKey: [`/api/office/ledger/summary${qs ? `?${qs}` : ""}`],
  });

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Running balance is cumulative across the full chronological result set, so
  // it is computed before pagination slicing.
  const rowsWithBalance = useMemo(() => {
    let balance = 0;
    return rows.map((r) => {
      balance += (Number(r.debit) || 0) - (Number(r.credit) || 0);
      return { ...r, runningBalance: balance };
    });
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(rowsWithBalance.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rowsWithBalance.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const reverseMutation = useMutation({
    mutationFn: async (row: LedgerRow) => {
      const reason = window
        .prompt("Enter a reason for reversing this manual journal (required):")
        ?.trim();
      if (!reason) {
        throw new Error("Reversal cancelled: a reason is required.");
      }
      const res = await apiRequest("POST", `/api/office/ledger/${row.id}/reverse`, {
        reason,
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to reverse entry."));
      }
      return res.json();
    },
    onSuccess: (body: any) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/office/ledger"),
      });
      toast({
        title: "Reversed",
        description: `Posted ${body?.reversedCount ?? 0} reversing entr${
          body?.reversedCount === 1 ? "y" : "ies"
        }.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Reversal failed",
        description: err?.message || "Failed to reverse entry.",
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiRequest(
        "GET",
        `/api/office/ledger/export${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) {
        toast({
          title: "Export failed",
          description: await readError(res, "Failed to export ledger."),
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `office-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message || "Failed to export ledger.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const sortedHeads = useMemo(
    () =>
      [...(Array.isArray(accountHeads) ? accountHeads : [])].sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      ),
    [accountHeads],
  );

  const canReverse = (r: LedgerRow) =>
    r.status === "Posted" && !r.voucherId && r.referenceType === "manual_journal";

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      Posted: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
      Reversed: "bg-amber-100 text-amber-700 hover:bg-amber-100",
      Reversal: "bg-slate-100 text-slate-600 hover:bg-slate-100",
    };
    return (
      <Badge variant="secondary" className={map[status] ?? ""}>
        {status}
      </Badge>
    );
  };

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1
            className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide"
            data-testid="text-page-title"
          >
            General Ledger
          </h1>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-1.5" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-none shadow-sm dark:bg-zinc-900">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Total Debit</p>
              <p className="text-lg font-bold text-slate-700 dark:text-zinc-200" data-testid="text-total-debit">
                {fmt(summary?.totals?.debit)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm dark:bg-zinc-900">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Total Credit</p>
              <p className="text-lg font-bold text-slate-700 dark:text-zinc-200" data-testid="text-total-credit">
                {fmt(summary?.totals?.credit)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm dark:bg-zinc-900">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Difference</p>
              <p
                className={`text-lg font-bold ${
                  Number(summary?.totals?.difference ?? 0) === 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
                data-testid="text-difference"
              >
                {fmt(summary?.totals?.difference)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm dark:bg-zinc-900">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Entries</p>
              <p className="text-lg font-bold text-slate-700 dark:text-zinc-200" data-testid="text-count">
                {summary?.totals?.count ?? 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">From</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter({ startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">To</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter({ endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Account Head</Label>
                <Select
                  value={filters.accountHeadId}
                  onValueChange={(v) => updateFilter({ accountHeadId: v })}
                >
                  <SelectTrigger data-testid="select-account-head">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All account heads</SelectItem>
                    {sortedHeads.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.code} — {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Reference</Label>
                <Select
                  value={filters.referenceType}
                  onValueChange={(v) => updateFilter({ referenceType: v })}
                >
                  <SelectTrigger data-testid="select-reference-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All references</SelectItem>
                    <SelectItem value="journal_voucher">Journal Voucher</SelectItem>
                    <SelectItem value="manual_journal">Manual Journal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => updateFilter({ status: v })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="Posted">Posted</SelectItem>
                    <SelectItem value="Reversed">Reversed</SelectItem>
                    <SelectItem value="Reversal">Reversal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Branch</Label>
                <Input
                  value={filters.branch}
                  onChange={(e) => updateFilter({ branch: e.target.value })}
                  placeholder="Branch"
                  data-testid="input-branch"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Search</Label>
                <Input
                  value={filters.q}
                  onChange={(e) => updateFilter({ q: e.target.value })}
                  placeholder="Description / remarks"
                  data-testid="input-search"
                />
              </div>
              <div className="space-y-1.5 flex items-end">
                <Button
                  variant="ghost"
                  onClick={resetFilters}
                  className="w-full"
                  data-testid="button-reset-filters"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-loading">
                Loading ledger...
              </div>
            ) : isError ? (
              <div className="text-center py-16 space-y-3" data-testid="state-error">
                <p className="text-red-500 text-sm">
                  {(error as any)?.message || "Failed to load ledger."}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : rowsWithBalance.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-empty">
                No ledger entries match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-28">Code</TableHead>
                      <TableHead>Account / Description</TableHead>
                      <TableHead className="w-32">Reference</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-28 text-right">Debit</TableHead>
                      <TableHead className="w-28 text-right">Credit</TableHead>
                      <TableHead className="w-32 text-right">Balance</TableHead>
                      <TableHead className="w-16 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => (
                      <TableRow key={r.id} data-testid={`row-ledger-${r.id}`}>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-mono">{r.accountHeadCode ?? "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium">{r.accountHeadName ?? "—"}</div>
                          {r.description && (
                            <div className="text-xs text-slate-500">{r.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {r.referenceType ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(r.debit) ? fmt(r.debit) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(r.credit) ? fmt(r.credit) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmt(r.runningBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          {canReverse(r) ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => reverseMutation.mutate(r)}
                              disabled={reverseMutation.isPending}
                              title="Reverse manual journal"
                              data-testid={`button-reverse-${r.id}`}
                            >
                              <Undo2 className="h-4 w-4 text-amber-600" />
                            </Button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-medium">
                        Totals (all filtered)
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {fmt(summary?.totals?.debit)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {fmt(summary?.totals?.credit)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {fmt(summary?.totals?.difference)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && !isError && rowsWithBalance.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span data-testid="text-result-count">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, rowsWithBalance.length)} of{" "}
              {rowsWithBalance.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
