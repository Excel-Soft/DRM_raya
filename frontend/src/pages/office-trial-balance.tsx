import { useMemo, useState, Fragment } from "react";
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
        <div className="flex min-h-[38px] w-full items-center justify-between rounded-md border border-input bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 cursor-pointer">
          <div className="flex flex-wrap gap-1.5 items-center flex-1">
            {selected.length === 0 ? (
              <span className="text-slate-500 dark:text-zinc-400">All</span>
            ) : (
              selected.map(val => {
                const opt = options.find(o => o.value === val);
                return (
                  <span key={val} className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-medium border border-slate-200 dark:border-zinc-700">
                    <X className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors" onClick={(e) => remove(e, val)} />
                    {opt?.label || val}
                  </span>
                );
              })
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {selected.length > 0 && (
              <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 cursor-pointer transition-colors" onClick={clearAll} />
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
  parentHeads: string[];
  childHeads: string[];
  branch: string[];
  startDate: string;
  endDate: string;
  includeZeroBalance: boolean;
}

function buildParams(f: AppliedFilters, dbAccountHeads: any[]): string {
  const p = new URLSearchParams();
  
  if (f.accountingHeads.length) {
    const categories = Array.from(new Set(f.accountingHeads.map(id => dbAccountHeads.find(h => h.id === id)?.category).filter(Boolean)));
    if (categories.length) p.set("accountType", categories.join(","));
  }
  
  if (f.branch.length) {
    p.set("branch", f.branch.join(","));
  }
  if (f.startDate) p.set("startDate", f.startDate);
  if (f.endDate) p.set("endDate", f.endDate);
  if (f.includeZeroBalance) p.set("includeZeroBalance", "true");
  return p.toString();
}

function money(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : (value || 0);
  if (n === 0) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function HierarchicalView({ dbAccountHeads, rows, applied, totals }: { dbAccountHeads: any[], rows: TrialBalanceRow[], applied: AppliedFilters | null, totals: any }) {
  const includeZeroBalance = applied?.includeZeroBalance || false;
  const tbMap = new Map<string, number>();
  for (const r of rows) {
    const dr = parseFloat(r.closingDebit) || 0;
    const cr = parseFloat(r.closingCredit) || 0;
    const isDebitNormal = ["Assets", "Expenses"].includes(r.category || "");
    const net = isDebitNormal ? dr - cr : cr - dr;
    tbMap.set(r.accountHeadId, net);
  }

  const childrenMap = new Map<string, any[]>();
  for (const h of dbAccountHeads) {
    if (h.parentAccountId) {
      if (!childrenMap.has(h.parentAccountId)) childrenMap.set(h.parentAccountId, []);
      childrenMap.get(h.parentAccountId)!.push(h);
    }
  }

  const buildTree = (node: any): any => {
    const children = (childrenMap.get(node.id) || []).map(buildTree);
    const ownAmount = tbMap.get(node.id) || 0;
    const childrenAmount = children.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalAmount = ownAmount + childrenAmount;
    return { ...node, children, totalAmount };
  };

  const roots = dbAccountHeads
    .filter(h => !h.parentAccountId)
    .filter(h => applied?.accountingHeads?.length ? applied.accountingHeads.includes(h.id) : true)
    .map(buildTree);
  
  // Prune the tree based on parent and child filters if applied
  if (applied?.parentHeads?.length) {
    for (const r of roots) {
      if (r.children) {
        r.children = r.children.filter((c: any) => applied.parentHeads.includes(c.id));
      }
    }
  }
  
  if (applied?.childHeads?.length) {
    for (const r of roots) {
      if (r.children) {
        for (const c of r.children) {
          if (c.children) {
            c.children = c.children.filter((cc: any) => applied.childHeads.includes(cc.id));
          }
        }
      }
    }
  }

  // Recalculate totals after pruning
  const recalcTotals = (node: any): number => {
    let childSum = 0;
    if (node.children) {
      for (const c of node.children) {
        childSum += recalcTotals(c);
      }
    }
    const ownAmount = tbMap.get(node.id) || 0;
    node.totalAmount = ownAmount + childSum;
    return node.totalAmount;
  };
  
  for (const r of roots) {
    recalcTotals(r);
  }

  let globalRowNum = 0;

  const renderNode = (node: any, level: number = 0): React.ReactNode => {
    if (!includeZeroBalance && Math.abs(node.totalAmount) < 0.01) return null;

    globalRowNum++;
    const currentNum = globalRowNum;
    
    let bgClass = "bg-white dark:bg-zinc-900";
    if (level === 0) bgClass = "bg-[#cfe2ff] hover:bg-[#cfe2ff] dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 font-semibold";
    else if (level === 1) bgClass = "bg-[#d1ecf1] hover:bg-[#d1ecf1] dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100 font-medium";

    const hasChildren = node.children && node.children.length > 0;

    return (
      <Fragment key={node.id}>
        <TableRow className={`${bgClass} border-b border-slate-200 dark:border-zinc-800`}>
          <TableCell className="text-[13px]">{currentNum}</TableCell>
          {level === 0 && (
            <>
              <TableCell className="text-[13px]">{node.code}</TableCell>
              <TableCell colSpan={3} className="text-[13px] uppercase">{node.name}</TableCell>
            </>
          )}
          {level === 1 && (
            <>
              <TableCell></TableCell>
              <TableCell className="text-[13px]">{node.code}</TableCell>
              <TableCell colSpan={2} className="text-[13px]">{node.name}</TableCell>
            </>
          )}
          {level >= 2 && (
            <>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell colSpan={2} className="text-[13px]">{node.code ? `${node.code} - ` : ''}{node.name}</TableCell>
            </>
          )}
          <TableCell className="text-center text-[13px]">-</TableCell>
          <TableCell className="text-right text-[13px] font-bold">{money(node.totalAmount)}</TableCell>
        </TableRow>
        {hasChildren && node.children.map((c: any) => renderNode(c, level + 1))}
        {level === 0 && (
          <TableRow className="h-[5px] bg-[#f8f9fa] dark:bg-zinc-950 border-none hover:bg-[#f8f9fa]">
            <TableCell colSpan={7} className="p-0"></TableCell>
          </TableRow>
        )}
      </Fragment>
    );
  };

  const totalAssetsExp = roots.filter(r => ["Assets", "Expenses"].includes(r.category)).reduce((sum, r) => sum + r.totalAmount, 0);
  const totalLiabEqRev = roots.filter(r => !["Assets", "Expenses"].includes(r.category)).reduce((sum, r) => sum + r.totalAmount, 0);
  // In a balanced TB, Assets + Expenses = Liab + Equity + Revenue. 
  // We will just show the total of Debits (or whichever is bigger) as the Grand Total for visual purposes.
  const grandTotal = Math.max(totalAssetsExp, totalLiabEqRev);

  return (
    <>
      {roots.map(r => renderNode(r, 0))}
      {totals && (
        <TableRow className="bg-[#e9ecef] dark:bg-zinc-800 font-bold border-t-2 border-slate-300">
          <TableCell colSpan={5} className="text-right text-[13px] font-bold">Grand Total (Balanced):</TableCell>
          <TableCell className="text-center text-[13px] font-bold">-</TableCell>
          <TableCell className="text-right text-[13px] font-bold text-green-700 dark:text-green-400">{money(grandTotal)}</TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function OfficeTrialBalance() {
  const { toast } = useToast();
  const [accountingHeads, setAccountingHeads] = useState<string[]>([]);
  const [parentHeads, setParentHeads] = useState<string[]>([]);
  const [childHeads, setChildHeads] = useState<string[]>([]);
  const [branch, setBranch] = useState<string[]>([]);
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
    queryFn: () => apiRequestJson<TrialBalanceResponse>("GET", `/api/office/trial-balance?${buildParams(applied!, dbAccountHeads)}`),
    enabled: applied !== null && dbAccountHeads.length > 0,
  });

  const handleGenerate = () => {
    setApplied({ accountingHeads, parentHeads, childHeads, branch, startDate, endDate, includeZeroBalance });
  };

  const handleExport = async () => {
    const filters = applied ?? { accountingHeads, parentHeads, childHeads, branch, startDate, endDate, includeZeroBalance };
    setExporting(true);
    try {
      const res = await apiRequest("GET", `/api/office/trial-balance/export?${buildParams(filters, dbAccountHeads)}`);
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
                  Select Accounting Head <span className="text-red-500">*</span>
                </Label>
                <MultiSelect
                  options={dbAccountHeads.filter(h => !h.parentAccountId).map(h => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
                  selected={accountingHeads}
                  onChange={(vals) => {
                    setAccountingHeads(vals);
                    setParentHeads([]);
                    setChildHeads([]);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Parent Head
                </Label>
                <MultiSelect
                  options={dbAccountHeads.filter(h => h.parentAccountId && (accountingHeads.length === 0 || accountingHeads.includes(h.parentAccountId))).map(h => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
                  selected={parentHeads}
                  onChange={(vals) => {
                    setParentHeads(vals);
                    setChildHeads([]);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Child Head
                </Label>
                <MultiSelect
                  options={dbAccountHeads.filter(h => h.parentAccountId && parentHeads.includes(h.parentAccountId)).map(h => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
                  selected={childHeads}
                  onChange={setChildHeads}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Select Office <span className="text-red-500">*</span>
                </Label>
                <MultiSelect
                  options={branchOptions.map(b => ({ label: b, value: b }))}
                  selected={branch}
                  onChange={setBranch}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm"
                  required
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
                  <TableHeader className="bg-slate-100 dark:bg-zinc-800">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[5%]">S.No</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[12%]">Parent Code</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[25%]">Parent Head</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[12%]">Child Code</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[25%]">Child Head</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[8%] text-center">Transactions</TableHead>
                      <TableHead className="text-[13px] font-bold text-slate-700 w-[13%] text-right">Total Amount (PKR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading || isFetching ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">Loading report…</TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-rose-600 text-sm">
                          {error instanceof Error ? error.message : "Failed to build the trial balance."}
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-sm">No records found for the selected criteria.</TableCell>
                      </TableRow>
                    ) : (
                      <HierarchicalView 
                        dbAccountHeads={dbAccountHeads} 
                        rows={rows} 
                        applied={applied}
                        totals={totals}
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
