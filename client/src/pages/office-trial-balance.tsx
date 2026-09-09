import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, X, Download, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, apiRequestJson, extractApiError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function MultiSelect({ options, selected, onChange }: { options: {label: string, value: string}[], selected: string[], onChange: (vals: string[]) => void }) {
  const toggle = (val: string) => {
    if (val === "all") {
      onChange([]);
    } else {
      const isSelected = selected.includes(val);
      if (isSelected) {
        onChange(selected.filter(v => v !== val));
      } else {
        onChange([...selected, val]);
      }
    }
  };

  const remove = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(selected.filter(v => v !== val));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex min-h-[38px] w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer">
          <div className="flex flex-wrap gap-1.5 items-center flex-1">
            {selected.length === 0 ? (
              <span className="text-slate-500">All</span>
            ) : (
              selected.map(val => {
                const opt = options.find(o => o.value === val);
                return (
                  <span key={val} className="flex items-center gap-1 bg-[#f1f5f9] text-slate-700 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">
                    <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-900 transition-colors" onClick={(e) => remove(e, val)} />
                    {opt?.label || val}
                  </span>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {selected.length > 0 && (
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-900 cursor-pointer transition-colors" onClick={clearAll} />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px] overflow-y-auto" align="start">
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onCheckedChange={() => toggle("all")}
          className="font-medium"
        >
          All
        </DropdownMenuCheckboxItem>
        {options.map(opt => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggle(opt.value)}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Real account-head categories (account_head_category enum in shared/schema.ts).
const ACCOUNTING_HEAD_OPTIONS = [
  { label: "Assets", value: "Assets" },
  { label: "Liabilities", value: "Liabilities" },
  { label: "Owner Equity", value: "OwnerEquity" },
  { label: "Revenue", value: "Revenue" },
  { label: "Expenses", value: "Expenses" },
];

interface TrialBalanceRow {
  accountHeadId: string;
  code: string | null;
  name: string | null;
  category: string | null;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
}

interface TrialBalanceResponse {
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: string;
    openingCredit: string;
    periodDebit: string;
    periodCredit: string;
    closingDebit: string;
    closingCredit: string;
  };
  imbalance: boolean;
  imbalanceAmount: string;
  currencyWarning: boolean;
  currencies: string[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface AppliedFilters {
  accountingHeads: string[];
  branch: string;
  startDate: string;
  endDate: string;
  includeZeroBalance: boolean;
}

function buildParams(f: AppliedFilters): string {
  const p = new URLSearchParams();
  if (f.accountingHeads.length) p.set("accountType", f.accountingHeads.join(","));
  if (f.branch.trim()) p.set("branch", f.branch.trim());
  if (f.startDate) p.set("startDate", f.startDate);
  if (f.endDate) p.set("endDate", f.endDate);
  if (f.includeZeroBalance) p.set("includeZeroBalance", "true");
  return p.toString();
}

function money(value: string | null | undefined): string {
  const n = parseFloat(value ?? "") || 0;
  if (n === 0) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OfficeTrialBalance() {
  const { toast } = useToast();
  const [accountingHeads, setAccountingHeads] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeZeroBalance, setIncludeZeroBalance] = useState(false);
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [exporting, setExporting] = useState(false);

  // Used only to suggest real branch values for the (optional) branch filter.
  const { data: dbAccountHeads = [] } = useQuery<any[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of dbAccountHeads) {
      if (h?.branch && String(h.branch).trim()) set.add(String(h.branch).trim());
    }
    return Array.from(set).sort();
  }, [dbAccountHeads]);

  const {
    data: report,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery<TrialBalanceResponse>({
    queryKey: ["/api/office/trial-balance", applied],
    queryFn: () => apiRequestJson<TrialBalanceResponse>("GET", `/api/office/trial-balance?${buildParams(applied!)}`),
    enabled: applied !== null,
  });

  const handleGenerate = () => {
    setApplied({ accountingHeads, branch, startDate, endDate, includeZeroBalance });
  };

  const handleExport = async () => {
    const filters = applied ?? { accountingHeads, branch, startDate, endDate, includeZeroBalance };
    setExporting(true);
    try {
      const res = await apiRequest("GET", `/api/office/trial-balance/export?${buildParams(filters)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(extractApiError(body, res.status));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "trial-balance.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not export the trial balance.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const rows = report?.rows ?? [];
  const totals = report?.totals;
  const showResults = applied !== null;

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-zinc-950 min-h-screen">
      <div className="p-6 max-w-[1600px] mx-auto space-y-4">
        <h1 className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
          Trial Balance Report
        </h1>

        <Card className="border-none shadow-sm shadow-slate-200 dark:shadow-none dark:bg-zinc-900">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Accounting Head (Category)
                </Label>
                <MultiSelect
                  options={ACCOUNTING_HEAD_OPTIONS}
                  selected={accountingHeads}
                  onChange={setAccountingHeads}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Branch
                </Label>
                <Input
                  list="tb-branch-options"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="All branches"
                  className="w-full text-sm"
                />
                <datalist id="tb-branch-options">
                  {branchOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeZeroBalance}
                  onChange={(e) => setIncludeZeroBalance(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Include zero-balance accounts
              </label>

              <div className="flex gap-3 ml-auto">
                <Button
                  onClick={handleGenerate}
                  disabled={isFetching}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white transition-colors gap-2 font-medium"
                >
                  <Search className="w-4 h-4" />
                  Generate Report
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={exporting || rows.length === 0}
                  variant="outline"
                  className="gap-2 font-medium"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? "Exporting…" : "Export CSV"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showResults && (
          <Card className="border-none shadow-sm shadow-slate-200 dark:shadow-none dark:bg-zinc-900">
            <CardContent className="p-6 space-y-4">
              {report?.imbalance && (
                <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Trial balance does not balance — closing debits and credits differ by{" "}
                    <strong>{Number(report.imbalanceAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>.
                  </span>
                </div>
              )}
              {report?.currencyWarning && (
                <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Ledger entries span multiple currencies ({report.currencies.join(", ")}). Totals are not currency-converted and may not be meaningful — filter to a single currency source.
                  </span>
                </div>
              )}

              <div className="w-full border border-slate-100 rounded overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-zinc-800">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-bold">Code</TableHead>
                      <TableHead className="text-xs font-bold">Account</TableHead>
                      <TableHead className="text-xs font-bold text-right">Opening Dr</TableHead>
                      <TableHead className="text-xs font-bold text-right">Opening Cr</TableHead>
                      <TableHead className="text-xs font-bold text-right">Period Dr</TableHead>
                      <TableHead className="text-xs font-bold text-right">Period Cr</TableHead>
                      <TableHead className="text-xs font-bold text-right">Closing Dr</TableHead>
                      <TableHead className="text-xs font-bold text-right">Closing Cr</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading || isFetching ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-sm">Loading trial balance…</TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-rose-600 text-sm">
                          {error instanceof Error ? error.message : "Failed to build the trial balance."}
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500 text-sm">No accounts match these filters.</TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {rows.map((r) => (
                          <TableRow key={r.accountHeadId} className="border-b border-slate-100">
                            <TableCell className="text-sm font-mono text-slate-600">{r.code}</TableCell>
                            <TableCell className="text-sm text-slate-700">{r.name}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(r.openingDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(r.openingCredit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(r.periodDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(r.periodCredit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums font-medium">{money(r.closingDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums font-medium">{money(r.closingCredit)}</TableCell>
                          </TableRow>
                        ))}
                        {totals && (
                          <TableRow className="bg-slate-50 dark:bg-zinc-800 font-bold border-t-2 border-slate-200">
                            <TableCell className="text-sm" colSpan={2}>Totals</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.openingDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.openingCredit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.periodDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.periodCredit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.closingDebit)}</TableCell>
                            <TableCell className="text-sm text-right tabular-nums">{money(totals.closingCredit)}</TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {report && report.pagination.total > rows.length && (
                <p className="text-xs text-slate-500">
                  Showing {rows.length} of {report.pagination.total} accounts (page {report.pagination.page} of {report.pagination.totalPages}).
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
