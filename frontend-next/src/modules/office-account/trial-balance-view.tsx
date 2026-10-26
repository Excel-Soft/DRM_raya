"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/legacy/dropdown-menu";
import { apiRequest } from "@/lib/query/query-client";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { OfficeAccountShell, DrmSection } from "@/modules/office-account/office-account-ui";
import type { AccountHead } from "@/modules/office-account/office-account-types";

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
  totals: Record<string, string>;
  imbalance: boolean;
  imbalanceAmount: string;
  currencyWarning: boolean;
  currencies: string[];
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

interface TreeNode extends AccountHead {
  children: TreeNode[];
  totalAmount: number;
}

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  function toggle(val: string) {
    if (val === "all") {
      onChange([]);
    } else {
      onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
    }
  }
  function remove(e: React.MouseEvent, val: string) {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== val));
  }
  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex min-h-[38px] w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {selected.length === 0 ? (
              <span className="text-zinc-500 dark:text-zinc-400">All</span>
            ) : (
              selected.map((val) => {
                const opt = options.find((o) => o.value === val);
                return (
                  <span
                    key={val}
                    className="flex items-center gap-1 rounded border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <X className="h-3 w-3 cursor-pointer text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" onClick={(e) => remove(e, val)} />
                    {opt?.label || val}
                  </span>
                );
              })
            )}
          </div>
          <div className="ml-2 flex shrink-0 items-center gap-2">
            {selected.length > 0 && (
              <X className="h-3.5 w-3.5 cursor-pointer text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" onClick={clearAll} />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[300px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto" align="start">
        <DropdownMenuCheckboxItem checked={selected.length === 0} onCheckedChange={() => toggle("all")} className="font-medium">
          All
        </DropdownMenuCheckboxItem>
        {options.map((opt) => (
          <DropdownMenuCheckboxItem key={opt.value} checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)}>
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function money(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value || 0;
  if (n === 0) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildParams(f: AppliedFilters, dbAccountHeads: AccountHead[]): string {
  const p = new URLSearchParams();
  if (f.accountingHeads.length) {
    const categories = Array.from(new Set(f.accountingHeads.map((id) => dbAccountHeads.find((h) => h.id === id)?.category).filter(Boolean)));
    if (categories.length) p.set("accountType", categories.join(","));
  }
  if (f.branch.length) p.set("branch", f.branch.join(","));
  if (f.startDate) p.set("startDate", f.startDate);
  if (f.endDate) p.set("endDate", f.endDate);
  if (f.includeZeroBalance) p.set("includeZeroBalance", "true");
  return p.toString();
}

function HierarchicalRows({
  dbAccountHeads,
  rows,
  applied,
}: {
  dbAccountHeads: AccountHead[];
  rows: TrialBalanceRow[];
  applied: AppliedFilters | null;
}) {
  const includeZeroBalance = applied?.includeZeroBalance || false;
  const tbMap = new Map<string, number>();
  for (const r of rows) {
    const dr = parseFloat(r.closingDebit) || 0;
    const cr = parseFloat(r.closingCredit) || 0;
    const isDebitNormal = ["Assets", "Expenses"].includes(r.category || "");
    tbMap.set(r.accountHeadId, isDebitNormal ? dr - cr : cr - dr);
  }

  const childrenMap = new Map<string, AccountHead[]>();
  for (const h of dbAccountHeads) {
    if (h.parentAccountId) {
      if (!childrenMap.has(h.parentAccountId)) childrenMap.set(h.parentAccountId, []);
      childrenMap.get(h.parentAccountId)!.push(h);
    }
  }

  function buildTree(node: AccountHead): TreeNode {
    const children = (childrenMap.get(node.id) || []).map(buildTree);
    const ownAmount = tbMap.get(node.id) || 0;
    const childrenAmount = children.reduce((sum, c) => sum + c.totalAmount, 0);
    return { ...node, children, totalAmount: ownAmount + childrenAmount };
  }

  const roots = dbAccountHeads
    .filter((h) => !h.parentAccountId)
    .filter((h) => (applied?.accountingHeads?.length ? applied.accountingHeads.includes(h.id) : true))
    .map(buildTree);

  if (applied?.parentHeads?.length) {
    for (const r of roots) r.children = r.children.filter((c) => applied.parentHeads.includes(c.id));
  }
  if (applied?.childHeads?.length) {
    for (const r of roots) {
      for (const c of r.children) {
        c.children = c.children.filter((cc) => applied.childHeads.includes(cc.id));
      }
    }
  }

  function recalcTotals(node: TreeNode): number {
    let childSum = 0;
    for (const c of node.children) childSum += recalcTotals(c);
    node.totalAmount = (tbMap.get(node.id) || 0) + childSum;
    return node.totalAmount;
  }
  for (const r of roots) recalcTotals(r);

  let globalRowNum = 0;
  const out: React.ReactNode[] = [];

  function renderNode(node: TreeNode, level: number) {
    if (!includeZeroBalance && Math.abs(node.totalAmount) < 0.01) return;
    globalRowNum++;
    const currentNum = globalRowNum;

    let rowClass = "bg-white dark:bg-zinc-900";
    if (level === 0) rowClass = "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 font-semibold";
    else if (level === 1) rowClass = "bg-cyan-50 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100 font-medium";

    out.push(
      <tr key={node.id} className={`${rowClass} border-b border-zinc-200 dark:border-zinc-800`}>
        <td className="px-3 py-2 text-[13px]">{currentNum}</td>
        {level === 0 && (
          <>
            <td className="px-3 py-2 text-[13px]">{node.code}</td>
            <td className="px-3 py-2 text-[13px] uppercase" colSpan={3}>{node.name}</td>
          </>
        )}
        {level === 1 && (
          <>
            <td />
            <td className="px-3 py-2 text-[13px]">{node.code}</td>
            <td className="px-3 py-2 text-[13px]" colSpan={2}>{node.name}</td>
          </>
        )}
        {level >= 2 && (
          <>
            <td />
            <td />
            <td className="px-3 py-2 text-[13px]" colSpan={2}>{node.code ? `${node.code} - ` : ""}{node.name}</td>
          </>
        )}
        <td className="px-3 py-2 text-center text-[13px]">-</td>
        <td className="px-3 py-2 text-right text-[13px] font-bold">{money(node.totalAmount)}</td>
      </tr>,
    );
    for (const c of node.children) renderNode(c, level + 1);
    if (level === 0) {
      out.push(
        <tr key={`${node.id}-spacer`} className="h-[5px] border-none bg-zinc-50 dark:bg-zinc-950">
          <td colSpan={7} className="p-0" />
        </tr>,
      );
    }
  }
  for (const r of roots) renderNode(r, 0);

  const totalAssetsExp = roots.filter((r) => ["Assets", "Expenses"].includes(r.category || "")).reduce((sum, r) => sum + r.totalAmount, 0);
  const totalLiabEqRev = roots.filter((r) => !["Assets", "Expenses"].includes(r.category || "")).reduce((sum, r) => sum + r.totalAmount, 0);
  const grandTotal = Math.max(totalAssetsExp, totalLiabEqRev);

  return (
    <>
      {out}
      <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-bold dark:bg-zinc-800">
        <td className="px-3 py-2 text-right text-[13px] font-bold" colSpan={5}>Grand Total (Balanced):</td>
        <td className="px-3 py-2 text-center text-[13px] font-bold">-</td>
        <td className="px-3 py-2 text-right text-[13px] font-bold text-green-700 dark:text-green-400">{money(grandTotal)}</td>
      </tr>
    </>
  );
}

export function TrialBalanceReportPage() {
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

  const { data: dbAccountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: async () => (await apiRequest("GET", "/api/office/account-heads")).json(),
  });

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of dbAccountHeads) if (h.branch?.trim()) set.add(h.branch.trim());
    return Array.from(set).sort();
  }, [dbAccountHeads]);

  const { data: report, isLoading, isFetching, isError, error } = useQuery<TrialBalanceResponse>({
    queryKey: ["/api/office/trial-balance", applied],
    enabled: applied !== null && dbAccountHeads.length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/office/trial-balance?${buildParams(applied!, dbAccountHeads)}`);
      if (!res.ok) throw new Error("Failed to build the trial balance.");
      return res.json();
    },
  });

  function handleGenerate() {
    setApplied({ accountingHeads, parentHeads, childHeads, branch, startDate, endDate, includeZeroBalance });
  }

  async function handleExport() {
    const filters = applied ?? { accountingHeads, parentHeads, childHeads, branch, startDate, endDate, includeZeroBalance };
    setExporting(true);
    try {
      await downloadAuthedFile(`/api/office/trial-balance/export?${buildParams(filters, dbAccountHeads)}`, "trial-balance.csv");
    } catch (e) {
      toast({ title: "Export failed", description: e instanceof Error ? e.message : "Could not export the trial balance.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const rows = report?.rows ?? [];
  const showResults = applied !== null;

  return (
    <OfficeAccountShell title="Trial Balance Report">
      <DrmSection title="Filters">
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Field id="tb-accounting-head" label="Select Accounting Head *">
            <MultiSelect
              options={dbAccountHeads.filter((h) => !h.parentAccountId).map((h) => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
              selected={accountingHeads}
              onChange={(vals) => { setAccountingHeads(vals); setParentHeads([]); setChildHeads([]); }}
            />
          </Field>
          <Field id="tb-parent-head" label="Select Parent Head">
            <MultiSelect
              options={dbAccountHeads.filter((h) => h.parentAccountId && (accountingHeads.length === 0 || accountingHeads.includes(h.parentAccountId))).map((h) => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
              selected={parentHeads}
              onChange={(vals) => { setParentHeads(vals); setChildHeads([]); }}
            />
          </Field>
          <Field id="tb-child-head" label="Select Child Head">
            <MultiSelect
              options={dbAccountHeads.filter((h) => h.parentAccountId && parentHeads.includes(h.parentAccountId)).map((h) => ({ label: `${h.code} - ${h.name}`, value: h.id }))}
              selected={childHeads}
              onChange={setChildHeads}
            />
          </Field>
          <Field id="tb-office" label="Select Office *">
            <MultiSelect options={branchOptions.map((b) => ({ label: b, value: b }))} selected={branch} onChange={setBranch} />
          </Field>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Field id="tb-start" label="Start Date *">
            <Input id="tb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="tb-end" label="End Date *">
            <Input id="tb-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <Checkbox checked={includeZeroBalance} onCheckedChange={(v) => setIncludeZeroBalance(v === true)} />
            Include zero-balance accounts
          </label>

          <div className="ml-auto flex gap-3">
            <Button onClick={handleGenerate} disabled={isFetching} className="gap-2">
              <Search className="h-4 w-4" />
              Generate Report
            </Button>
            <Button onClick={handleExport} disabled={exporting || rows.length === 0} variant="secondary" className="gap-2">
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>
      </DrmSection>

      {showResults && (
        <DrmSection title="Report">
          <div className="space-y-4">
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
                  Ledger entries span multiple currencies ({report.currencies.join(", ")}). Totals are not currency-converted and may not
                  be meaningful — filter to a single currency source.
                </span>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-950/80">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">S.No</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Parent Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Parent Head</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Child Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Child Head</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Transactions</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Total Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                  {isLoading || isFetching ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">Loading report…</td></tr>
                  ) : isError ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-rose-600">{error instanceof Error ? error.message : "Failed to build the trial balance."}</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">No records found for the selected criteria.</td></tr>
                  ) : (
                    <HierarchicalRows dbAccountHeads={dbAccountHeads} rows={rows} applied={applied} />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DrmSection>
      )}
    </OfficeAccountShell>
  );
}
