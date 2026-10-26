"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Edit, Loader2, Plus, RotateCcw, Save, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { downloadAuthedFile } from "@/lib/download/authed-download";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { OfficeAccountShell, DrmFormModal } from "@/modules/office-account/office-account-ui";
import type { AccountHead } from "@/modules/office-account/office-account-types";

const CATEGORIES = [
  { value: "Assets", label: "Assets" },
  { value: "Liabilities", label: "Liabilities" },
  { value: "OwnerEquity", label: "Owner Equity" },
  { value: "Revenue", label: "Revenue" },
  { value: "Expenses", label: "Expenses" },
] as const;

const ACCOUNT_TYPES: Record<string, string[]> = {
  Assets: ["Current Asset", "Fixed Asset", "Intangible Asset", "Investment"],
  Liabilities: ["Current Liability", "Long-term Liability", "Contingent Liability"],
  OwnerEquity: ["Capital", "Retained Earnings", "Reserves"],
  Revenue: ["Operating Revenue", "Non-operating Revenue", "Other Income"],
  Expenses: ["Operating Expense", "Administrative Expense", "Financial Expense"],
};

const NORMAL_BALANCES = ["Debit", "Credit"] as const;
const ALL = "__all__";
const NONE = "__none__";

function defaultNormalBalance(category: string): string {
  return category === "Assets" || category === "Expenses" ? "Debit" : "Credit";
}

interface FilterState {
  q: string;
  category: string;
  type: string;
  status: string;
}
const EMPTY_FILTERS: FilterState = { q: "", category: ALL, type: ALL, status: ALL };

interface FormState {
  code: string;
  name: string;
  category: string;
  type: string;
  normalBalance: string;
  openingBalance: string;
  parentAccountId: string;
  branch: string;
  description: string;
}
const EMPTY_FORM: FormState = {
  code: "",
  name: "",
  category: "",
  type: "",
  normalBalance: "",
  openingBalance: "0",
  parentAccountId: NONE,
  branch: "",
  description: "",
};

function buildFilterParams(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.category !== ALL) params.set("category", filters.category);
  if (filters.type !== ALL) params.set("type", filters.type);
  if (filters.status !== ALL) params.set("status", filters.status);
  return params.toString();
}

type TreeNode = AccountHead & { children: TreeNode[]; level: number; isMatch: boolean };

export function ChartOfAccountsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [autoCodeLoading, setAutoCodeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: accountHeads = [], isLoading, isError, error, refetch } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: async () => (await apiRequest("GET", "/api/office/account-heads")).json(),
  });

  const typeFilterOptions = useMemo(() => {
    const pool = accountHeads.filter((h) => filters.category === ALL || h.category === filters.category);
    return Array.from(new Set(pool.map((h) => h.type).filter(Boolean))).sort();
  }, [accountHeads, filters.category]);

  const tree = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    const map = new Map<string, TreeNode>();
    accountHeads.forEach((h) => map.set(h.id, { ...h, children: [], level: 1, isMatch: false }));

    const roots: TreeNode[] = [];
    accountHeads.forEach((h) => {
      if (h.parentAccountId && map.has(h.parentAccountId)) {
        const parent = map.get(h.parentAccountId)!;
        const node = map.get(h.id)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(map.get(h.id)!);
      }
    });

    function evaluateMatch(node: TreeNode): boolean {
      let matches = true;
      if (filters.category !== ALL && node.category !== filters.category) matches = false;
      if (filters.type !== ALL && node.type !== filters.type) matches = false;
      if (filters.status === "active" && node.isActive !== 1) matches = false;
      if (filters.status === "inactive" && node.isActive === 1) matches = false;
      if (term && !`${node.code} ${node.name}`.toLowerCase().includes(term)) matches = false;

      let childMatches = false;
      for (const child of node.children) if (evaluateMatch(child)) childMatches = true;
      node.isMatch = matches || childMatches;
      return node.isMatch;
    }

    return roots.filter((root) => evaluateMatch(root));
  }, [accountHeads, filters]);

  function updateFilter(patch: Partial<FilterState>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }
  function resetFilters() {
    setFilters(EMPTY_FILTERS);
  }
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function fetchNextCode(parentId: string, level: number) {
    setAutoCodeLoading(true);
    try {
      const qs = new URLSearchParams();
      if (parentId !== NONE) qs.set("parentId", parentId);
      qs.set("level", level.toString());
      const res = await apiRequest("GET", `/api/office/account-heads/next-code?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, code: data.nextCode }));
      }
    } catch (err) {
      console.error("Failed to auto generate code", err);
    } finally {
      setAutoCodeLoading(false);
    }
  }

  function openCreate(parentHead?: TreeNode) {
    setEditingId(null);
    const level = parentHead ? parentHead.level + 1 : 1;
    setForm({
      ...EMPTY_FORM,
      parentAccountId: parentHead ? parentHead.id : NONE,
      category: parentHead?.category || "",
      type: parentHead?.type || "",
    });
    setErrors({});
    setDialogOpen(true);
    fetchNextCode(parentHead ? parentHead.id : NONE, level);
  }

  function openEdit(head: AccountHead) {
    setEditingId(head.id);
    setForm({
      code: head.code ?? "",
      name: head.name ?? "",
      category: head.category ?? "",
      type: head.type ?? "",
      normalBalance: head.normalBalance ?? "",
      openingBalance: head.openingBalance != null ? String(head.openingBalance) : "0",
      parentAccountId: head.parentAccountId ?? NONE,
      branch: head.branch ?? "",
      description: head.description ?? "",
    });
    setErrors({});
    setDialogOpen(true);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = "Code is required.";
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.category) next.category = "Category is required.";
    if (!form.type) next.type = "Type is required.";
    if (form.openingBalance.trim() && !Number.isFinite(Number(form.openingBalance))) {
      next.openingBalance = "Opening balance must be a number.";
    }
    if (editingId && form.parentAccountId !== NONE && form.parentAccountId === editingId) {
      next.parentAccountId = "An account head cannot be its own parent.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload() {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category,
      type: form.type,
      normalBalance: form.normalBalance || defaultNormalBalance(form.category),
      openingBalance: form.openingBalance.trim() === "" ? "0" : form.openingBalance.trim(),
      parentAccountId: form.parentAccountId === NONE ? null : form.parentAccountId,
      branch: form.branch.trim() || null,
      description: form.description.trim() || null,
    };
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editingId) {
        await mutationRequest("PATCH", `/api/office/account-heads/${editingId}`, buildPayload());
        toast({ title: "Updated", description: "Account head updated successfully." });
      } else {
        await mutationRequest("POST", "/api/office/account-heads", buildPayload());
        toast({ title: "Created", description: "Account head created successfully." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message || "Failed to save account head.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const qs = buildFilterParams(filters);
      await downloadAuthedFile(`/api/office/account-heads/export${qs ? `?${qs}` : ""}`, `account-heads-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export account heads.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  const parentOptions = useMemo(
    () => accountHeads.filter((h) => h.id !== editingId).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accountHeads, editingId],
  );
  const typeOptionsForForm = form.category ? ACCOUNT_TYPES[form.category] ?? [] : [];

  return (
    <OfficeAccountShell
      title="Chart of Accounts"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={isExporting} className="gap-1.5">
            <Download className="h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button onClick={() => openCreate()} className="gap-1">
            <Plus className="h-4 w-4" />
            Add Parent Head
          </Button>
        </div>
      }
    >
      <Card>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Field id="coa-search" label="Search" className="lg:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input id="coa-search" value={filters.q} onChange={(e) => updateFilter({ q: e.target.value })} placeholder="Search code or name" className="pl-8" />
            </div>
          </Field>
          <Field id="coa-category" label="Category">
            <Select value={filters.category} onValueChange={(v) => updateFilter({ category: v, type: ALL })}>
              <SelectTrigger id="coa-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="coa-type" label="Type">
            <Select value={filters.type} onValueChange={(v) => updateFilter({ type: v })}>
              <SelectTrigger id="coa-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {typeFilterOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="coa-status" label="Status">
            <div className="flex gap-2">
              <Select value={filters.status} onValueChange={(v) => updateFilter({ status: v })}>
                <SelectTrigger id="coa-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={resetFilters} title="Reset filters">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>
      </Card>

      {isLoading ? (
        <p className="py-16 text-center text-zinc-500">Loading account heads...</p>
      ) : isError ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm text-red-500">{(error as Error)?.message || "Failed to load account heads."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : tree.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          {accountHeads.length === 0 ? "No account heads yet. Click 'Add Parent Head' to create your first one." : "No account heads match the current filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tree.map((parent) => {
            if (!parent.isMatch) return null;
            const isOpen = expanded.has(parent.id) || filters.q.trim().length > 0;
            return (
              <Card key={parent.id} className="flex flex-col overflow-hidden !p-0">
                <div
                  className="flex cursor-pointer select-none items-center justify-between bg-rose-100 p-3 dark:bg-rose-950/40"
                  onClick={() => toggleExpand(parent.id)}
                >
                  <h6 className="m-0 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    ({parent.code}) {parent.name}
                  </h6>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 rounded-full bg-white/50 p-0 text-emerald-700 hover:bg-white"
                      onClick={(e) => { e.stopPropagation(); openCreate(parent); }}
                      title="Add Child Head"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-zinc-700">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="flex-1 overflow-x-auto bg-white dark:bg-zinc-950">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr className="border-b-2 border-zinc-200 dark:border-zinc-800">
                          <th className="w-10 py-2 text-center text-zinc-500">S.No</th>
                          <th className="w-16 py-2 text-left text-zinc-500">Code</th>
                          <th className="py-2 text-left text-zinc-500">Head</th>
                          <th className="w-16 py-2 text-center text-zinc-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parent.children.map((child, idx) => {
                          if (!child.isMatch && filters.q.trim().length > 0) return null;
                          return (
                            <tr key={child.id} className={idx % 2 === 0 ? "bg-zinc-50/50 dark:bg-zinc-900/50" : "bg-white dark:bg-zinc-950"}>
                              <td className="py-2 text-center">
                                <Badge variant="neutral" className="rounded px-1.5 py-0 font-normal">{idx + 1}</Badge>
                              </td>
                              <td className="py-2">
                                <Badge variant="neutral" className="rounded bg-emerald-500 px-1.5 py-0 font-mono text-[10px] text-white">{child.code}</Badge>
                              </td>
                              <td className="py-2 align-top">
                                <div className="font-bold text-zinc-800 dark:text-zinc-200">{child.name}</div>
                                {child.children.length > 0 && (
                                  <ul className="m-0 ml-1 mt-2 list-none space-y-1.5 p-0">
                                    {child.children.map((trans) => (
                                      <li key={trans.id} className="border-l-[3px] border-cyan-400 pl-2">
                                        <div className="group flex items-start justify-between">
                                          <div className="flex items-start gap-1">
                                            <Badge variant="neutral" className="shrink-0 rounded border border-cyan-400 bg-cyan-50 px-1 py-0 font-mono text-[9px] leading-tight text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                                              {trans.code}
                                            </Badge>
                                            <span className="mt-0.5 text-[11px] font-medium leading-tight text-zinc-600 dark:text-zinc-400">&rarr; {trans.name}</span>
                                          </div>
                                          <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button variant="ghost" size="sm" className="h-4 w-4 rounded-sm bg-emerald-500 p-0 text-white hover:bg-emerald-600" onClick={() => openCreate(trans)} title="Add Sub-Transaction">
                                              <Plus className="h-2.5 w-2.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-4 w-4 rounded-sm bg-amber-500 p-0 text-white hover:bg-amber-600" onClick={() => openEdit(trans)} title="Edit">
                                              <Edit className="h-2.5 w-2.5" />
                                            </Button>
                                          </div>
                                        </div>
                                        {trans.children.length > 0 && (
                                          <ul className="m-0 ml-1 mt-1 list-none space-y-1 pl-1 text-[10px]">
                                            {trans.children.map((subTrans) => (
                                              <li key={subTrans.id} className="group/sub flex items-start justify-between border-l-2 border-emerald-400 pl-1.5 text-zinc-500">
                                                <div className="flex items-start gap-1">
                                                  <Badge variant="neutral" className="shrink-0 rounded bg-emerald-500 px-1 py-0 font-mono text-[9px] leading-tight text-white">{subTrans.code}</Badge>
                                                  <span className="mt-0.5 font-medium leading-tight">&#8627; {subTrans.name}</span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="ml-2 h-4 w-4 shrink-0 rounded-sm bg-amber-500 p-0 text-white opacity-0 transition-opacity hover:bg-amber-600 group-hover/sub:opacity-100" onClick={() => openEdit(subTrans)} title="Edit">
                                                  <Edit className="h-2 w-2" />
                                                </Button>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="py-2 pt-2 text-center align-top">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-5 w-5 rounded bg-emerald-500 p-0 text-white hover:bg-emerald-600" onClick={() => openCreate(child)} title="Add Transaction">
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-5 w-5 rounded bg-amber-500 p-0 text-white hover:bg-amber-600" onClick={() => openEdit(child)} title="Edit">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <DrmFormModal
        open={dialogOpen}
        title={editingId ? "Edit Account Head" : "Add Account Head"}
        onClose={() => setDialogOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || autoCodeLoading} className="gap-1.5" aria-busy={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Head"}
            </Button>
          </>
        }
      >
        {autoCodeLoading && !editingId && (
          <div className="mb-4 flex animate-pulse items-center gap-3 rounded-md bg-blue-50 p-3 text-sm text-blue-600 dark:bg-blue-950/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating next account code...
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="coa-form-category" label="Category *" error={errors.category}>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((prev) => ({ ...prev, category: v, type: "", normalBalance: prev.normalBalance || defaultNormalBalance(v) }))}
            >
              <SelectTrigger id="coa-form-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field id="coa-form-type" label="Type *" error={errors.type}>
            <Select value={form.type} onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))} disabled={!form.category}>
              <SelectTrigger id="coa-form-type"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {typeOptionsForForm.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field id="coa-form-code" label="Code *" error={errors.code}>
            <Input id="coa-form-code" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} placeholder="e.g. 10101" />
          </Field>

          <Field id="coa-form-name" label="Name *" error={errors.name}>
            <Input id="coa-form-name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Account head name" />
          </Field>

          <Field id="coa-form-balance" label="Normal Balance">
            <Select value={form.normalBalance || defaultNormalBalance(form.category)} onValueChange={(v) => setForm((prev) => ({ ...prev, normalBalance: v }))}>
              <SelectTrigger id="coa-form-balance"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {NORMAL_BALANCES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field id="coa-form-opening" label="Opening Balance" error={errors.openingBalance}>
            <Input id="coa-form-opening" type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm((prev) => ({ ...prev, openingBalance: e.target.value }))} placeholder="0.00" />
          </Field>

          <Field id="coa-form-parent" label="Parent Head" error={errors.parentAccountId}>
            <Select value={form.parentAccountId} onValueChange={(v) => setForm((prev) => ({ ...prev, parentAccountId: v }))}>
              <SelectTrigger id="coa-form-parent"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None (top level)</SelectItem>
                {parentOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field id="coa-form-branch" label="Branch">
            <Input id="coa-form-branch" value={form.branch} onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))} placeholder="Optional" />
          </Field>

          <Field id="coa-form-description" label="Description" className="sm:col-span-2">
            <Textarea id="coa-form-description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Optional notes" className="h-20 resize-none" />
          </Field>
        </div>
      </DrmFormModal>
    </OfficeAccountShell>
  );
}
