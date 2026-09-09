import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2, Save, Eye, CheckCircle2, XCircle } from "lucide-react";
import type { AccountHead } from "@shared/schema";

const ALL = "__all__";

type VoucherLine = {
  id: string;
  voucherId: string;
  accountHeadId: string;
  debit: string;
  credit: string;
  narration: string | null;
  lineNo: number;
};

type Voucher = {
  id: string;
  voucherNo: string;
  voucherDate: string;
  status: string;
  remarks: string | null;
  branch: string | null;
  totalDebit: string;
  totalCredit: string;
  cancelReason?: string | null;
};

type VoucherDetail = Voucher & { lines: VoucherLine[] };

type FormLine = {
  accountHeadId: string;
  debit: string;
  credit: string;
  narration: string;
};

const emptyLine = (): FormLine => ({
  accountHeadId: "",
  debit: "",
  credit: "",
  narration: "",
});

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

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600 hover:bg-slate-100",
    POSTED: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    CANCELLED: "bg-red-100 text-red-700 hover:bg-red-100",
  };
  return (
    <Badge variant="secondary" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
};

export default function JournalVoucher() {
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [voucherDate, setVoucherDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<FormLine[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== ALL) params.set("status", statusFilter);
    if (search.trim()) params.set("q", search.trim());
    return params.toString();
  }, [statusFilter, search]);

  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
  });

  const activeHeads = useMemo(
    () =>
      (Array.isArray(accountHeads) ? accountHeads : [])
        .filter((h) => h.isActive === 1)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accountHeads],
  );

  const headLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of Array.isArray(accountHeads) ? accountHeads : []) {
      map.set(h.id, `${h.code} — ${h.name}`);
    }
    return map;
  }, [accountHeads]);

  const {
    data: vouchers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Voucher[]>({
    queryKey: [`/api/office/journal-vouchers${qs ? `?${qs}` : ""}`],
  });

  const { data: viewVoucher } = useQuery<VoucherDetail>({
    queryKey: [`/api/office/journal-vouchers/${viewId}`],
    enabled: !!viewId,
  });

  const invalidateVouchers = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/office/journal-vouchers"),
    });

  // --- Create form ----------------------------------------------------------

  const resetForm = () => {
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setBranch("");
    setRemarks("");
    setLines([emptyLine(), emptyLine()]);
    setFormError("");
  };

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    }
    return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const updateLine = (index: number, patch: Partial<FormLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));

  const validateForm = (): string | null => {
    if (!remarks.trim()) return "Remarks are required.";
    const filled = lines.filter(
      (l) => l.accountHeadId || l.debit || l.credit || l.narration,
    );
    if (filled.length < 2) return "At least two lines are required.";
    for (const l of filled) {
      if (!l.accountHeadId) return "Every line must have an account head.";
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0) return "Line amounts cannot be negative.";
      if ((d > 0) === (c > 0)) {
        return "Each line must be either a debit or a credit (exactly one, greater than zero).";
      }
    }
    return null;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        voucherDate: voucherDate ? new Date(voucherDate).toISOString() : undefined,
        branch: branch.trim() || null,
        remarks: remarks.trim(),
        lines: lines
          .filter((l) => l.accountHeadId || l.debit || l.credit || l.narration)
          .map((l, idx) => ({
            accountHeadId: l.accountHeadId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            narration: l.narration.trim() || null,
            lineNo: idx + 1,
          })),
      };
      const res = await apiRequest("POST", "/api/office/journal-vouchers", payload);
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to create voucher."));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateVouchers();
      setCreateOpen(false);
      resetForm();
      toast({ title: "Draft created", description: "Journal voucher saved as draft." });
    },
    onError: (err: any) => {
      toast({
        title: "Create failed",
        description: err?.message || "Failed to create voucher.",
        variant: "destructive",
      });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/office/journal-vouchers/${id}/post`, {});
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to post voucher."));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateVouchers();
      toast({ title: "Posted", description: "Voucher posted to the ledger." });
    },
    onError: (err: any) => {
      toast({
        title: "Post failed",
        description: err?.message || "Failed to post voucher.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const reason = window
        .prompt("Enter a reason for cancelling this voucher (required):")
        ?.trim();
      if (!reason) {
        throw new Error("Cancellation cancelled: a reason is required.");
      }
      const res = await apiRequest("POST", `/api/office/journal-vouchers/${id}/cancel`, {
        reason,
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to cancel voucher."));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateVouchers();
      toast({ title: "Cancelled", description: "Voucher cancelled." });
    },
    onError: (err: any) => {
      toast({
        title: "Cancel failed",
        description: err?.message || "Failed to cancel voucher.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError("");
    createMutation.mutate();
  };

  return (
    <ScrollArea className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1
            className="text-sm font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wide"
            data-testid="text-page-title"
          >
            Journal Voucher
          </h1>
          <Button
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
            className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            data-testid="button-new-voucher"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Voucher
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="POSTED">Posted</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs text-slate-500">Search</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Voucher number"
                  data-testid="input-search"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-none shadow-sm dark:bg-zinc-900">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-loading">
                Loading vouchers...
              </div>
            ) : isError ? (
              <div className="text-center py-16 space-y-3" data-testid="state-error">
                <p className="text-red-500 text-sm">
                  {(error as any)?.message || "Failed to load vouchers."}
                </p>
                <Button variant="outline" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground" data-testid="state-empty">
                No journal vouchers yet. Click “New Voucher” to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Voucher No</TableHead>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead className="w-24 text-center">Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead className="w-28 text-right">Debit</TableHead>
                      <TableHead className="w-28 text-right">Credit</TableHead>
                      <TableHead className="w-40 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v) => (
                      <TableRow key={v.id} data-testid={`row-voucher-${v.id}`}>
                        <TableCell className="font-mono">{v.voucherNo}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(v.voucherDate)}</TableCell>
                        <TableCell className="text-center">{statusBadge(v.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{v.remarks}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v.totalDebit)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(v.totalCredit)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewId(v.id)}
                              title="View"
                              data-testid={`button-view-${v.id}`}
                            >
                              <Eye className="h-4 w-4 text-slate-500" />
                            </Button>
                            {v.status === "DRAFT" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => postMutation.mutate(v.id)}
                                disabled={postMutation.isPending}
                                title="Post"
                                data-testid={`button-post-${v.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                            {v.status !== "CANCELLED" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelMutation.mutate(v.id)}
                                disabled={cancelMutation.isPending}
                                title="Cancel"
                                data-testid={`button-cancel-${v.id}`}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
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

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-700">New Journal Voucher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-600 font-medium">Date</Label>
                  <Input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    data-testid="input-voucher-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-600 font-medium">Branch</Label>
                  <Input
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="Optional"
                    data-testid="input-voucher-branch"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-600 font-medium">
                    Remarks <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Voucher remarks"
                    data-testid="input-voucher-remarks"
                  />
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Head</TableHead>
                      <TableHead className="w-32 text-right">Debit</TableHead>
                      <TableHead className="w-32 text-right">Credit</TableHead>
                      <TableHead>Narration</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={line.accountHeadId}
                            onValueChange={(v) => updateLine(index, { accountHeadId: v })}
                          >
                            <SelectTrigger data-testid={`select-line-head-${index}`}>
                              <SelectValue placeholder="Select head" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeHeads.map((h) => (
                                <SelectItem key={h.id} value={h.id}>
                                  {h.code} — {h.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.debit}
                            onChange={(e) =>
                              updateLine(index, {
                                debit: e.target.value,
                                credit: e.target.value ? "" : line.credit,
                              })
                            }
                            className="text-right"
                            placeholder="0.00"
                            data-testid={`input-line-debit-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.credit}
                            onChange={(e) =>
                              updateLine(index, {
                                credit: e.target.value,
                                debit: e.target.value ? "" : line.debit,
                              })
                            }
                            className="text-right"
                            placeholder="0.00"
                            data-testid={`input-line-credit-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={line.narration}
                            onChange={(e) => updateLine(index, { narration: e.target.value })}
                            placeholder="Optional"
                            data-testid={`input-line-narration-${index}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 2}
                            data-testid={`button-remove-line-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={addLine} data-testid="button-add-line">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Line
                </Button>
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    Debit: <span className="font-mono font-bold">{fmt(totals.debit)}</span>
                  </span>
                  <span>
                    Credit: <span className="font-mono font-bold">{fmt(totals.credit)}</span>
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      totals.balanced
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-100"
                    }
                    data-testid="badge-balance"
                  >
                    {totals.balanced
                      ? "Balanced"
                      : `Out of balance: ${fmt(totals.diff)}`}
                  </Badge>
                </div>
              </div>

              {formError && (
                <p className="text-sm text-red-500" data-testid="text-form-error">
                  {formError}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
              <Button
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="button-save-draft"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {createMutation.isPending ? "Saving..." : "Save Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View dialog */}
        <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-700 flex items-center gap-3">
                {viewVoucher?.voucherNo ?? "Voucher"}
                {viewVoucher && statusBadge(viewVoucher.status)}
              </DialogTitle>
            </DialogHeader>
            {viewVoucher ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Date</p>
                    <p>{fmtDate(viewVoucher.voucherDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Branch</p>
                    <p>{viewVoucher.branch || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Remarks</p>
                    <p>{viewVoucher.remarks || "—"}</p>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Head</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Narration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewVoucher.lines?.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono">
                            {headLabel.get(l.accountHeadId) ?? l.accountHeadId}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(l.debit) ? fmt(l.debit) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {Number(l.credit) ? fmt(l.credit) : "—"}
                          </TableCell>
                          <TableCell>{l.narration || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-end gap-4 text-sm">
                  <span>
                    Total Debit:{" "}
                    <span className="font-mono font-bold">{fmt(viewVoucher.totalDebit)}</span>
                  </span>
                  <span>
                    Total Credit:{" "}
                    <span className="font-mono font-bold">{fmt(viewVoucher.totalCredit)}</span>
                  </span>
                </div>

                {viewVoucher.status === "CANCELLED" && viewVoucher.cancelReason && (
                  <p className="text-sm text-red-500">
                    Cancelled: {viewVoucher.cancelReason}
                  </p>
                )}

                <DialogFooter className="gap-2">
                  {viewVoucher.status === "DRAFT" && (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => postMutation.mutate(viewVoucher.id)}
                      disabled={postMutation.isPending}
                      data-testid="button-view-post"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Post
                    </Button>
                  )}
                  {viewVoucher.status !== "CANCELLED" && (
                    <Button
                      variant="outline"
                      className="text-red-600"
                      onClick={() => cancelMutation.mutate(viewVoucher.id)}
                      disabled={cancelMutation.isPending}
                      data-testid="button-view-cancel"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Cancel Voucher
                    </Button>
                  )}
                </DialogFooter>
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground">Loading...</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
}
