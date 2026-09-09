import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Trash2,
  Edit,
  Save,
  Download,
  Search,
  RotateCcw,
} from "lucide-react";
import type { AccountHead } from "@shared/schema";

const CATEGORIES = [
  { value: "Assets", label: "Assets", range: "10000-14999" },
  { value: "Liabilities", label: "Liabilities", range: "20000-24999" },
  { value: "OwnerEquity", label: "Owner Equity", range: "30000-34999" },
  { value: "Revenue", label: "Revenue", range: "40000-44999" },
  { value: "Expenses", label: "Expenses", range: "50000-54999" },
] as const;

const ACCOUNT_TYPES: Record<string, string[]> = {
  Assets: ["Current Asset", "Fixed Asset", "Intangible Asset", "Investment"],
  Liabilities: ["Current Liability", "Long-term Liability", "Contingent Liability"],
  OwnerEquity: ["Capital", "Retained Earnings", "Reserves"],
  Revenue: ["Operating Revenue", "Non-operating Revenue", "Other Income"],
  Expenses: ["Operating Expense", "Administrative Expense", "Financial Expense"],
};

const NORMAL_BALANCES = ["Debit", "Credit"] as const;
const PAGE_SIZE = 20;
const ALL = "__all__";
const NONE = "__none__";

const categoryLabel = (value?: string | null) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value ?? "";

const defaultNormalBalance = (category: string): string =>
  category === "Assets" || category === "Expenses" ? "Debit" : "Credit";

const fmtAmount = (value: unknown): string => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Pull a human-readable message out of the standard error envelope. */
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

type FilterState = {
  q: string;
  category: string;
  type: string;
  status: string;
};

const EMPTY_FILTERS: FilterState = {
  q: "",
  category: ALL,
  type: ALL,
  status: ALL,
};

type FormState = {
  code: string;
  name: string;
  category: string;
  type: string;
  normalBalance: string;
  openingBalance: string;
  parentAccountId: string;
  branch: string;
  description: string;
};

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

export default function ChartOfAccounts() {
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    data: accountHeads = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const headsList = Array.isArray(accountHeads) ? accountHeads : [];

  const codeById = useMemo(
    () => new Map(headsList.map((h) => [h.id, h.code])),
    [headsList],
  );

  // Distinct types present in the data, scoped to the chosen category, used to
  // populate the Type filter (handles custom types beyond the defaults).
  const typeFilterOptions = useMemo(() => {
    const pool = headsList.filter(
      (h) => filters.category === ALL || h.category === filters.category,
    );
    return Array.from(new Set(pool.map((h) => h.type).filter(Boolean))).sort();
  }, [headsList, filters.category]);

  const filtered = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    return headsList
      .filter((h) => {
        if (filters.category !== ALL && h.category !== filters.category) return false;
        if (filters.type !== ALL && h.type !== filters.type) return false;
        if (filters.status === "active" && h.isActive !== 1) return false;
        if (filters.status === "inactive" && h.isActive === 1) return false;
        if (term) {
          const hay = `${h.code} ${h.name}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [headsList, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // --- Form helpers ---------------------------------------------------------

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (head: AccountHead) => {
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
  };

  const validate = (): boolean => {
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
  };

  const buildPayload = () => ({
    code: form.code.trim(),
    name: form.name.trim(),
    category: form.category,
    type: form.type,
    normalBalance: form.normalBalance || defaultNormalBalance(form.category),
    openingBalance: form.openingBalance.trim() === "" ? "0" : form.openingBalance.trim(),
    parentAccountId: form.parentAccountId === NONE ? null : form.parentAccountId,
    branch: form.branch.trim() || null,
    description: form.description.trim() || null,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const url = editingId
        ? `/api/office/account-heads/${editingId}`
        : "/api/office/account-heads";
      const method = editingId ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to save account head."));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      setDialogOpen(false);
      toast({
        title: editingId ? "Updated" : "Created",
        description: editingId
          ? "Account head updated successfully."
          : "Account head created successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Failed to save account head.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (head: AccountHead) => {
      const res = await apiRequest("PATCH", `/api/office/account-heads/${head.id}`, {
        isActive: head.isActive === 1 ? 0 : 1,
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to update status."));
      }
      return res.json();
    },
    onSuccess: (updated: AccountHead) => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      toast({
        title: updated?.isActive === 1 ? "Activated" : "Deactivated",
        description: `${updated?.code ?? "Account head"} is now ${updated?.isActive === 1 ? "active" : "inactive"}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Update failed",
        description: err?.message || "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (head: AccountHead) => {
      const reason = window
        .prompt(`Enter a reason for deleting "${head.code} — ${head.name}" (required):`)
        ?.trim();
      if (!reason) {
        throw new Error("Deletion cancelled: a reason is required.");
      }
      const res = await apiRequest("DELETE", `/api/office/account-heads/${head.id}`, {
        reason,
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to delete account head."));
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: (body: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/account-heads"] });
      if (body?.softDisabled) {
        toast({
          title: "Disabled",
          description:
            "This account head is referenced by ledger postings, so it was deactivated instead of deleted.",
        });
      } else {
        toast({ title: "Deleted", description: "Account head deleted." });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Not deleted",
        description: err?.message || "Failed to delete account head.",
        variant: "destructive",
      });
    },
  });

  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const qs = buildFilterParams(filters);
      const res = await apiRequest(
        "GET",
        `/api/office/account-heads/export${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) {
        toast({
          title: "Export failed",
          description: await readError(res, "Failed to export account heads."),
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `account-heads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message || "Failed to export account heads.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = () => {
    if (!validate()) return;
    saveMutation.mutate(buildPayload());
  };

  const parentOptions = useMemo(
    () =>
      headsList
        .filter((h) => h.id !== editingId)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [headsList, editingId],
  );

  const typeOptionsForForm = form.category ? ACCOUNT_TYPES[form.category] ?? [] : [];

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1
            className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide"
            data-testid="text-page-title"
          >
            Chart of Accounts
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="button-export"
            >
              <Download className="h-4 w-4 mr-1.5" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              onClick={openCreate}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
              data-testid="button-add-account"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Account Head
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs text-slate-500">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={filters.q}
                    onChange={(e) => updateFilter({ q: e.target.value })}
                    placeholder="Search code or name"
                    className="pl-8"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(v) => updateFilter({ category: v, type: ALL })}
                >
                  <SelectTrigger data-testid="select-filter-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Type</Label>
                <Select
                  value={filters.type}
                  onValueChange={(v) => updateFilter({ type: v })}
                >
                  <SelectTrigger data-testid="select-filter-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All types</SelectItem>
                    {typeFilterOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Status</Label>
                <div className="flex gap-2">
                  <Select
                    value={filters.status}
                    onValueChange={(v) => updateFilter({ status: v })}
                  >
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetFilters}
                    title="Reset filters"
                    data-testid="button-reset-filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-loading">
                Loading account heads...
              </div>
            ) : isError ? (
              <div className="text-center py-16 space-y-3" data-testid="state-error">
                <p className="text-red-500 text-sm">
                  {(error as any)?.message || "Failed to load account heads."}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-empty">
                {headsList.length === 0
                  ? "No account heads yet. Click “Add Account Head” to create your first one."
                  : "No account heads match the current filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-32">Code</TableHead>
                      <TableHead>Account Head</TableHead>
                      <TableHead className="w-28">Category</TableHead>
                      <TableHead className="w-40">Type</TableHead>
                      <TableHead className="w-28">Parent</TableHead>
                      <TableHead className="w-24">Normal</TableHead>
                      <TableHead className="w-32 text-right">Opening</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((head, index) => (
                      <TableRow key={head.id} data-testid={`row-account-${head.id}`}>
                        <TableCell className="text-slate-400">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </TableCell>
                        <TableCell className="font-mono">{head.code}</TableCell>
                        <TableCell className="font-medium">{head.name}</TableCell>
                        <TableCell>{categoryLabel(head.category)}</TableCell>
                        <TableCell className="text-slate-500">{head.type}</TableCell>
                        <TableCell className="font-mono text-slate-500">
                          {head.parentAccountId
                            ? codeById.get(head.parentAccountId) ?? "—"
                            : "—"}
                        </TableCell>
                        <TableCell>{head.normalBalance ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtAmount(head.openingBalance)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={head.isActive === 1}
                              onCheckedChange={() => toggleMutation.mutate(head)}
                              disabled={toggleMutation.isPending}
                              data-testid={`switch-active-${head.id}`}
                            />
                            <Badge
                              variant={head.isActive === 1 ? "default" : "secondary"}
                              className={
                                head.isActive === 1
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : ""
                              }
                            >
                              {head.isActive === 1 ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(head)}
                              data-testid={`button-edit-${head.id}`}
                            >
                              <Edit className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(head)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${head.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {!isLoading && !isError && filtered.length > 0 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span data-testid="text-result-count">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
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

        {/* Add / Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-700">
                {editingId ? "Edit Account Head" : "Add Account Head"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">
                  Category <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((prev) => ({
                      ...prev,
                      category: v,
                      type: "",
                      normalBalance: prev.normalBalance || defaultNormalBalance(v),
                    }))
                  }
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-xs text-red-500">{errors.category}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">
                  Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, type: v }))}
                  disabled={!form.category}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptionsForForm.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-red-500">{errors.type}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. 10101"
                  data-testid="input-code"
                />
                {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Account head name"
                  data-testid="input-name"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Normal Balance</Label>
                <Select
                  value={form.normalBalance || defaultNormalBalance(form.category)}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, normalBalance: v }))
                  }
                >
                  <SelectTrigger data-testid="select-normal-balance">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {NORMAL_BALANCES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, openingBalance: e.target.value }))
                  }
                  placeholder="0.00"
                  data-testid="input-opening-balance"
                />
                {errors.openingBalance && (
                  <p className="text-xs text-red-500">{errors.openingBalance}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Parent Head</Label>
                <Select
                  value={form.parentAccountId}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, parentAccountId: v }))
                  }
                >
                  <SelectTrigger data-testid="select-parent">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None (top level)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.parentAccountId && (
                  <p className="text-xs text-red-500">{errors.parentAccountId}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Branch</Label>
                <Input
                  value={form.branch}
                  onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Optional"
                  data-testid="input-branch"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-slate-600 font-medium">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Optional notes"
                  className="resize-none h-20"
                  data-testid="input-description"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
                data-testid="button-submit"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saveMutation.isPending
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Head"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
