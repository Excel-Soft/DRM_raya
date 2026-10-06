import React, { useMemo, useState, useEffect } from "react";
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
  ChevronDown,
  ChevronRight,
  Loader2
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

type TreeNode = AccountHead & { children: TreeNode[], level: number, isMatch: boolean };

export default function ChartOfAccounts() {
  const { toast } = useToast();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  
  const [autoCodeLoading, setAutoCodeLoading] = useState(false);

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

  const typeFilterOptions = useMemo(() => {
    const pool = headsList.filter(
      (h) => filters.category === ALL || h.category === filters.category,
    );
    return Array.from(new Set(pool.map((h) => h.type).filter(Boolean))).sort();
  }, [headsList, filters.category]);

  const tree = useMemo(() => {
    const term = filters.q.trim().toLowerCase();
    
    // Create nodes
    const map = new Map<string, TreeNode>();
    headsList.forEach(h => {
      map.set(h.id, { ...h, children: [], level: 1, isMatch: false });
    });

    const roots: TreeNode[] = [];
    
    headsList.forEach(h => {
      if (h.parentAccountId && map.has(h.parentAccountId)) {
        const parent = map.get(h.parentAccountId)!;
        const node = map.get(h.id)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        roots.push(map.get(h.id)!);
      }
    });
    
    const evaluateMatch = (node: TreeNode): boolean => {
      let matches = true;
      if (filters.category !== ALL && node.category !== filters.category) matches = false;
      if (filters.type !== ALL && node.type !== filters.type) matches = false;
      if (filters.status === "active" && node.isActive !== 1) matches = false;
      if (filters.status === "inactive" && node.isActive === 1) matches = false;
      if (term) {
        const hay = `${node.code} ${node.name}`.toLowerCase();
        if (!hay.includes(term)) matches = false;
      }
      
      let childMatches = false;
      for (const child of node.children) {
        if (evaluateMatch(child)) childMatches = true;
      }
      
      node.isMatch = matches || childMatches;
      return node.isMatch;
    };
    
    const filteredRoots: TreeNode[] = [];
    for (const root of roots) {
      if (evaluateMatch(root)) {
        filteredRoots.push(root);
      }
    }
    
    return filteredRoots;
  }, [headsList, filters]);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
  };
  
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const fetchNextCode = async (parentId: string, level: number) => {
    setAutoCodeLoading(true);
    try {
      const qs = new URLSearchParams();
      if (parentId !== NONE) qs.set("parentId", parentId);
      qs.set("level", level.toString());
      
      const res = await apiRequest("GET", `/api/office/account-heads/next-code?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({ ...prev, code: data.nextCode }));
      }
    } catch (err) {
      console.error("Failed to auto generate code", err);
    } finally {
      setAutoCodeLoading(false);
    }
  };

  const openCreate = (parentHead?: TreeNode) => {
    setEditingId(null);
    let level = 1;
    let initialCategory = "";
    let initialType = "";
    
    if (parentHead) {
      level = parentHead.level + 1;
      initialCategory = parentHead.category || "";
      initialType = parentHead.type || "";
    }
    
    setForm({
      ...EMPTY_FORM,
      parentAccountId: parentHead ? parentHead.id : NONE,
      category: initialCategory,
      type: initialType
    });
    setErrors({});
    setDialogOpen(true);
    
    fetchNextCode(parentHead ? parentHead.id : NONE, level);
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
  

  const renderCards = (nodes: TreeNode[]) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {nodes.map(parent => {
          if (!parent.isMatch) return null;
          return (
          <Card key={parent.id} className="border shadow-sm flex flex-col dark:bg-zinc-900 overflow-hidden">
            <div 
              className="flex justify-between items-center p-3 cursor-pointer select-none" 
              style={{ backgroundColor: '#ffd6d6', borderBottom: '2px solid #ff9999' }}
              onClick={() => toggleExpand(parent.id)}
            >
              <h6 className="mb-0 text-slate-800 font-bold m-0 text-sm flex items-center">
                ({parent.code}) {parent.name}
              </h6>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-green-700 bg-white/50 hover:bg-white rounded-full" 
                  onClick={(e) => { e.stopPropagation(); openCreate(parent); }}
                  title="Add Child Head"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-800 hover:bg-black/5">
                  {expanded.has(parent.id) || filters.q.trim().length > 0 ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {(expanded.has(parent.id) || filters.q.trim().length > 0) && (
              <div className="flex-1 overflow-x-auto p-0 bg-white dark:bg-zinc-950">
                <Table className="m-0 border-0 text-xs">
                  <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                    <TableRow className="border-b-2">
                      <TableHead className="w-10 text-center text-slate-500 py-2">S.No</TableHead>
                      <TableHead className="w-16 text-slate-500 py-2">Code</TableHead>
                      <TableHead className="text-slate-500 py-2">Head</TableHead>
                      <TableHead className="text-center w-16 text-slate-500 py-2">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parent.children.map((child, idx) => {
                      if (!child.isMatch && filters.q.trim().length > 0) return null;
                      return (
                      <TableRow key={child.id} className={idx % 2 === 0 ? "bg-slate-50/50 dark:bg-zinc-900/50" : "bg-white dark:bg-zinc-950"}>
                        <TableCell className="text-center py-2">
                          <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-200 font-normal px-1.5 py-0 rounded">
                            {idx + 1}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 font-mono text-[10px] px-1.5 py-0 rounded">
                            {child.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{child.name}</div>
                          {child.children.length > 0 && (
                            <ul className="list-none m-0 mt-2 p-0 space-y-1.5 ml-1">
                              {child.children.map(trans => (
                                <li key={trans.id} className="pl-2 border-l-[3px] border-cyan-400">
                                  <div className="flex justify-between items-start group">
                                    <div className="flex items-start gap-1">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-cyan-400 text-cyan-700 bg-cyan-50 font-mono shrink-0 leading-tight rounded">
                                        {trans.code}
                                      </Badge>
                                      <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium leading-tight mt-0.5">
                                        &rarr; {trans.name}
                                      </span>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-2 shrink-0">
                                      <Button variant="ghost" size="icon" className="h-4 w-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-sm" onClick={() => openCreate(trans)} title="Add Sub-Transaction">
                                        <Plus className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-4 w-4 bg-amber-500 hover:bg-amber-600 text-white rounded-sm" onClick={() => openEdit(trans)} title="Edit">
                                        <Edit className="h-2.5 w-2.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  {trans.children.length > 0 && (
                                    <ul className="list-none m-0 mt-1 pl-1 space-y-1 ml-1 text-[10px]">
                                      {trans.children.map(subTrans => (
                                        <li key={subTrans.id} className="flex justify-between items-start group/sub pl-1.5 border-l-2 border-emerald-400 text-slate-500">
                                          <div className="flex items-start gap-1">
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] px-1 py-0 font-mono shrink-0 leading-tight rounded">
                                              {subTrans.code}
                                            </Badge>
                                            <span className="leading-tight mt-0.5 font-medium">
                                              &#8627; {subTrans.name}
                                            </span>
                                          </div>
                                          <Button variant="ghost" size="icon" className="h-4 w-4 bg-amber-500 hover:bg-amber-600 text-white rounded-sm opacity-0 group-hover/sub:opacity-100 transition-opacity ml-2 shrink-0" onClick={() => openEdit(subTrans)} title="Edit">
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
                        </TableCell>
                        <TableCell className="text-center align-top pt-2">
                          <div className="flex items-center justify-center gap-1">
                             <Button variant="ghost" size="icon" className="h-5 w-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded" onClick={() => openCreate(child)} title="Add Transaction">
                               <Plus className="h-3 w-3" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-5 w-5 bg-amber-500 hover:bg-amber-600 text-white rounded" onClick={() => openEdit(child)} title="Edit">
                               <Edit className="h-3 w-3" />
                             </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        )})}
      </div>
    );
  };


  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">
            Chart of Accounts
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-1.5" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button onClick={() => openCreate()} className="bg-[#00a65a] hover:bg-[#008d4c] text-white">
              <Plus className="h-4 w-4 mr-1" />
              Add Parent Head
            </Button>
          </div>
        </div>

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
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Category</Label>
                <Select
                  value={filters.category}
                  onValueChange={(v) => updateFilter({ category: v, type: ALL })}
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={resetFilters} title="Reset filters">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            Loading account heads...
          </div>
        ) : isError ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-red-500 text-sm">
              {(error as any)?.message || "Failed to load account heads."}
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {headsList.length === 0
              ? "No account heads yet. Click 'Add Parent Head' to create your first one."
              : "No account heads match the current filters."}
          </div>
        ) : (
          renderCards(tree)
        )}


        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-700">
                {editingId ? "Edit Account Head" : "Add Account Head"}
              </DialogTitle>
            </DialogHeader>
            
            {autoCodeLoading && !editingId && (
              <div className="bg-blue-50/50 p-3 rounded-md flex items-center gap-3 text-blue-600 text-sm animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating next account code...
              </div>
            )}
            
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                  <SelectTrigger>
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
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
                onClick={handleSubmit}
                disabled={saveMutation.isPending || autoCodeLoading}
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
