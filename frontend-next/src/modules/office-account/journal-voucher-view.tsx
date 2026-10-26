"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Plus, Save, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { OfficeAccountShell, DrmSection, DrmFormModal } from "@/modules/office-account/office-account-ui";
import type { AccountHead } from "@/modules/office-account/office-account-types";

const ALL = "__all__";

interface VoucherLine {
  id: string;
  voucherId: string;
  accountHeadId: string;
  debit: string;
  credit: string;
  narration: string | null;
  lineNo: number;
}
interface Voucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  status: string;
  remarks: string | null;
  branch: string | null;
  totalDebit: string;
  totalCredit: string;
  cancelReason?: string | null;
}
type VoucherDetail = Voucher & { lines: VoucherLine[] };

interface FormLine {
  accountHeadId: string;
  debit: string;
  credit: string;
  narration: string;
}
const emptyLine = (): FormLine => ({ accountHeadId: "", debit: "", credit: "", narration: "" });

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

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  POSTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="neutral" className={STATUS_TONE[status] ?? ""}>{status}</Badge>;
}

export function JournalVoucherPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<FormLine[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [viewId, setViewId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== ALL) params.set("status", statusFilter);
    if (search.trim()) params.set("q", search.trim());
    return params.toString();
  }, [statusFilter, search]);

  const { data: accountHeads = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/office/account-heads"],
    queryFn: async () => (await apiRequest("GET", "/api/office/account-heads")).json(),
  });

  const activeHeads = useMemo(
    () => accountHeads.filter((h) => h.isActive === 1).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accountHeads],
  );
  const headLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of accountHeads) map.set(h.id, `${h.code} — ${h.name}`);
    return map;
  }, [accountHeads]);

  const { data: vouchers = [], isLoading, isError, error, refetch } = useQuery<Voucher[]>({
    queryKey: ["/api/office/journal-vouchers", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/office/journal-vouchers${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load vouchers.");
      return res.json();
    },
  });

  const { data: viewVoucher } = useQuery<VoucherDetail>({
    queryKey: ["/api/office/journal-vouchers", viewId],
    enabled: !!viewId,
    queryFn: async () => (await apiRequest("GET", `/api/office/journal-vouchers/${viewId}`)).json(),
  });

  function invalidateVouchers() {
    queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/api/office/journal-vouchers") });
  }

  function resetForm() {
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setBranch("");
    setRemarks("");
    setLines([emptyLine(), emptyLine()]);
    setFormError("");
  }

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    }
    return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));
  }

  function validateForm(): string | null {
    if (!remarks.trim()) return "Remarks are required.";
    const filled = lines.filter((l) => l.accountHeadId || l.debit || l.credit || l.narration);
    if (filled.length < 2) return "At least two lines are required.";
    for (const l of filled) {
      if (!l.accountHeadId) return "Every line must have an account head.";
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d < 0 || c < 0) return "Line amounts cannot be negative.";
      if ((d > 0) === (c > 0)) return "Each line must be either a debit or a credit (exactly one, greater than zero).";
    }
    return null;
  }

  async function handleSubmit() {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
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
      await mutationRequest("POST", "/api/office/journal-vouchers", payload);
      invalidateVouchers();
      setCreateOpen(false);
      resetForm();
      toast({ title: "Draft created", description: "Journal voucher saved as draft." });
    } catch (e: any) {
      toast({ title: "Create failed", description: e?.message || "Failed to create voucher.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handlePost(id: string) {
    setPostingId(id);
    try {
      await mutationRequest("POST", `/api/office/journal-vouchers/${id}/post`, {});
      invalidateVouchers();
      toast({ title: "Posted", description: "Voucher posted to the ledger." });
    } catch (e: any) {
      toast({ title: "Post failed", description: e?.message || "Failed to post voucher.", variant: "destructive" });
    } finally {
      setPostingId(null);
    }
  }

  async function handleCancel(id: string) {
    const reason = window.prompt("Enter a reason for cancelling this voucher (required):")?.trim();
    if (!reason) return;
    setCancellingId(id);
    try {
      await mutationRequest("POST", `/api/office/journal-vouchers/${id}/cancel`, { reason });
      invalidateVouchers();
      toast({ title: "Cancelled", description: "Voucher cancelled." });
    } catch (e: any) {
      toast({ title: "Cancel failed", description: e?.message || "Failed to cancel voucher.", variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  }

  const columns: DataTableColumn<Voucher>[] = [
    { id: "no", header: "Voucher No", cell: (v) => <span className="font-mono">{v.voucherNo}</span> },
    { id: "date", header: "Date", cell: (v) => <span className="whitespace-nowrap">{fmtDate(v.voucherDate)}</span> },
    { id: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} /> },
    { id: "remarks", header: "Remarks", cell: (v) => <span className="line-clamp-1 max-w-xs">{v.remarks}</span> },
    { id: "debit", header: "Debit", cell: (v) => <span className="font-mono">{fmt(v.totalDebit)}</span> },
    { id: "credit", header: "Credit", cell: (v) => <span className="font-mono">{fmt(v.totalCredit)}</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (v) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewId(v.id)} title="View">
            <Eye className="h-4 w-4 text-zinc-500" />
          </Button>
          {v.status === "DRAFT" && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handlePost(v.id)} disabled={postingId === v.id} title="Post">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </Button>
          )}
          {v.status !== "CANCELLED" && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCancel(v.id)} disabled={cancellingId === v.id} title="Cancel">
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <OfficeAccountShell
      title="Journal Voucher"
      actions={
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" />
          New Voucher
        </Button>
      }
    >
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
          <Field id="jv-status" label="Status">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="jv-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="jv-search" label="Search" className="md:col-span-2">
            <Input id="jv-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Voucher number" />
          </Field>
        </div>
      </DrmSection>

      <DrmSection title="Vouchers">
        <DataTable
          columns={columns}
          rows={vouchers}
          rowKey={(v) => v.id}
          loading={isLoading}
          error={isError ? ((error as Error)?.message || "Failed to load vouchers.") : null}
          onRetry={() => refetch()}
          emptyMessage='No journal vouchers yet. Click "New Voucher" to create one.'
        />
      </DrmSection>

      {/* Create dialog */}
      <DrmFormModal
        open={createOpen}
        title="New Journal Voucher"
        onClose={() => setCreateOpen(false)}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving} className="gap-1.5" aria-busy={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="jv-date" label="Date">
              <Input id="jv-date" type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </Field>
            <Field id="jv-branch" label="Branch">
              <Input id="jv-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Optional" />
            </Field>
            <Field id="jv-remarks" label="Remarks *">
              <Input id="jv-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Voucher remarks" />
            </Field>
          </div>

          <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Account Head</th>
                  <th className="w-32 px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">Debit</th>
                  <th className="w-32 px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">Credit</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Narration</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      <Select value={line.accountHeadId} onValueChange={(v) => updateLine(index, { accountHeadId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select head" /></SelectTrigger>
                        <SelectContent>
                          {activeHeads.map((h) => <SelectItem key={h.id} value={h.id}>{h.code} — {h.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.debit}
                        onChange={(e) => updateLine(index, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                        className="text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.credit}
                        onChange={(e) => updateLine(index, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                        className="text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input value={line.narration} onChange={(e) => updateLine(index, { narration: e.target.value })} placeholder="Optional" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeLine(index)} disabled={lines.length <= 2}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={addLine} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Line
            </Button>
            <div className="flex items-center gap-4 text-sm">
              <span>Debit: <span className="font-mono font-bold">{fmt(totals.debit)}</span></span>
              <span>Credit: <span className="font-mono font-bold">{fmt(totals.credit)}</span></span>
              <Badge variant="neutral" className={totals.balanced ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}>
                {totals.balanced ? "Balanced" : `Out of balance: ${fmt(totals.diff)}`}
              </Badge>
            </div>
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </DrmFormModal>

      {/* View dialog */}
      <DrmFormModal
        open={!!viewId}
        title={viewVoucher?.voucherNo ?? "Voucher"}
        onClose={() => setViewId(null)}
        size="xl"
        footer={
          viewVoucher ? (
            <>
              {viewVoucher.status === "DRAFT" && (
                <Button onClick={() => handlePost(viewVoucher.id)} disabled={postingId === viewVoucher.id} className="gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Post
                </Button>
              )}
              {viewVoucher.status !== "CANCELLED" && (
                <Button variant="danger" onClick={() => handleCancel(viewVoucher.id)} disabled={cancellingId === viewVoucher.id} className="gap-1.5">
                  <XCircle className="h-4 w-4" />
                  Cancel Voucher
                </Button>
              )}
            </>
          ) : null
        }
      >
        {viewVoucher ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={viewVoucher.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500">Date</p>
                <p>{fmtDate(viewVoucher.voucherDate)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Branch</p>
                <p>{viewVoucher.branch || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Remarks</p>
                <p>{viewVoucher.remarks || "—"}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Account Head</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">Debit</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400">Credit</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">Narration</th>
                  </tr>
                </thead>
                <tbody>
                  {viewVoucher.lines?.map((l) => (
                    <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono">{headLabel.get(l.accountHeadId) ?? l.accountHeadId}</td>
                      <td className="px-3 py-2 text-right font-mono">{Number(l.debit) ? fmt(l.debit) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{Number(l.credit) ? fmt(l.credit) : "—"}</td>
                      <td className="px-3 py-2">{l.narration || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-4 text-sm">
              <span>Total Debit: <span className="font-mono font-bold">{fmt(viewVoucher.totalDebit)}</span></span>
              <span>Total Credit: <span className="font-mono font-bold">{fmt(viewVoucher.totalCredit)}</span></span>
            </div>

            {viewVoucher.status === "CANCELLED" && viewVoucher.cancelReason && (
              <p className="text-sm text-red-500">Cancelled: {viewVoucher.cancelReason}</p>
            )}
          </div>
        ) : (
          <p className="py-10 text-center text-zinc-500">Loading...</p>
        )}
      </DrmFormModal>
    </OfficeAccountShell>
  );
}
