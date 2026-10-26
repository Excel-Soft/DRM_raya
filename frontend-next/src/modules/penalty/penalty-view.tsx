"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PenaltyShell, DrmSection, DrmFormModal } from "@/modules/penalty/penalty-ui";

interface ApiUser {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string | null;
  role: string | null;
  roleId: string | null;
  department: string | null;
}
interface UserGroup {
  roleId: string;
  roleLabel: string;
  users: ApiUser[];
}
interface PenaltyRow {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeEmail: string | null;
  department: string | null;
  penaltyHead: string;
  reason: string;
  amount: string | number;
  penaltyDate: string;
  approvalStatus: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  managerRemarks: string | null;
  hodRemarks: string | null;
  addedById: string | null;
  addedByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedByName: string | null;
  rejectedAt: string | null;
  status: string;
  voidReason: string | null;
  voidedById: string | null;
  voidedByName: string | null;
  voidedAt: string | null;
  employeeAcknowledgedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
interface ListResult {
  data: PenaltyRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: {
    totalPenalties: number; pendingCount: number; approvedCount: number;
    rejectedCount: number; voidedCount: number; totalAmount: number;
  };
}
interface MetaResult {
  penaltyHeads: string[];
  statuses: string[];
  permissions: {
    canCreate: boolean; canDecide: boolean; canVoid: boolean; canViewReports: boolean;
    isFullAccess: boolean; role: string;
  };
}

const DEFAULT_HEADS = [
  "Missed Deadline", "Quality Issue", "Policy Violation", "Late Arrival",
  "Late Arrival After Lunch", "Mobile", "GM Pending AC", "Rework / Revision",
  "Complaint", "Other",
];

function fmtMoney(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString();
}
function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  VOIDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  CANCELLED: "bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="neutral" className={`${STATUS_TONE[status] || STATUS_TONE.CANCELLED} normal-case tracking-normal`}>
      {status}
    </Badge>
  );
}

const EMPTY_FORM = {
  id: "" as string,
  employeeId: "",
  department: "",
  penaltyHead: "",
  reason: "",
  amount: "",
  penaltyDate: new Date().toISOString().slice(0, 10),
  attachmentUrl: "",
  attachmentName: "",
  managerRemarks: "",
  approvalStatus: "PENDING",
};
type FormState = typeof EMPTY_FORM;

export function AddPenaltyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [formPending, setFormPending] = useState(false);

  const [viewRow, setViewRow] = useState<PenaltyRow | null>(null);
  const [approvalRow, setApprovalRow] = useState<PenaltyRow | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [hodRemarks, setHodRemarks] = useState("");
  const [approvalPending, setApprovalPending] = useState(false);
  const [deleteRow, setDeleteRow] = useState<PenaltyRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [voidRow, setVoidRow] = useState<PenaltyRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidPending, setVoidPending] = useState(false);
  const [ackPendingId, setAckPendingId] = useState<string | null>(null);

  const metaQuery = useQuery<MetaResult>({
    queryKey: ["/api/penalties/meta"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/penalties/meta");
      if (!res.ok) throw new Error("Failed to load meta");
      return res.json();
    },
  });
  const perms = metaQuery.data?.permissions;
  const heads = metaQuery.data?.penaltyHeads ?? DEFAULT_HEADS;

  const usersQuery = useQuery<{ groups: UserGroup[] }>({
    queryKey: ["/api/penalties/users"],
    enabled: !!perms?.canCreate,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/penalties/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });
  const userGroups = usersQuery.data?.groups ?? [];
  const allUsers = useMemo(() => userGroups.flatMap((g) => g.users), [userGroups]);

  const listQuery = useQuery<ListResult>({
    queryKey: ["/api/penalties", page, limit, search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(limit));
      if (search.trim()) p.set("search", search.trim());
      if (statusFilter !== "all") p.set("approvalStatus", statusFilter);
      const res = await apiRequest("GET", `/api/penalties?${p.toString()}`);
      if (!res.ok) throw new Error("Failed to load penalties");
      return res.json();
    },
  });

  const rows = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;
  const summary = listQuery.data?.summary;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditing(false);
    setFormOpen(true);
  }
  function openEdit(row: PenaltyRow) {
    setForm({
      id: row.id,
      employeeId: row.employeeId,
      department: row.department ?? "",
      penaltyHead: row.penaltyHead,
      reason: row.reason,
      amount: String(row.amount ?? ""),
      penaltyDate: row.penaltyDate ? row.penaltyDate.slice(0, 10) : EMPTY_FORM.penaltyDate,
      attachmentUrl: row.attachmentUrl ?? "",
      attachmentName: row.attachmentName ?? "",
      managerRemarks: row.managerRemarks ?? "",
      approvalStatus: row.approvalStatus,
    });
    setEditing(true);
    setFormOpen(true);
  }

  function selectEmployee(userId: string) {
    const u = allUsers.find((x) => x.id === userId);
    setForm((f) => ({ ...f, employeeId: userId, department: u?.department ?? f.department }));
  }

  async function submitForm() {
    if (!form.employeeId) return toast({ title: "Employee is required", variant: "destructive" });
    if (!form.penaltyHead) return toast({ title: "Penalty head is required", variant: "destructive" });
    if (!form.reason.trim()) return toast({ title: "Reason is required", variant: "destructive" });
    if (form.amount === "" || isNaN(Number(form.amount)) || Number(form.amount) < 0)
      return toast({ title: "Amount must be 0 or greater", variant: "destructive" });
    if (!form.penaltyDate) return toast({ title: "Penalty date is required", variant: "destructive" });

    setFormPending(true);
    try {
      const body = {
        employeeId: form.employeeId,
        department: form.department || null,
        penaltyHead: form.penaltyHead,
        reason: form.reason,
        amount: Number(form.amount),
        penaltyDate: form.penaltyDate,
        attachmentUrl: form.attachmentUrl || null,
        attachmentName: form.attachmentName || null,
        managerRemarks: form.managerRemarks || null,
        approvalStatus: form.approvalStatus,
      };
      if (form.id) {
        await mutationRequest("PATCH", `/api/penalties/${form.id}`, body);
      } else {
        await mutationRequest("POST", "/api/penalties", body);
      }
      toast({ title: editing ? "Penalty updated" : "Penalty added" });
      setFormOpen(false);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setFormPending(false);
    }
  }

  async function submitApproval() {
    if (!approvalRow) return;
    setApprovalPending(true);
    try {
      await mutationRequest("PATCH", `/api/penalties/${approvalRow.id}/approval`, {
        approvalStatus: approvalDecision,
        hodRemarks: hodRemarks || null,
      });
      toast({ title: approvalDecision === "APPROVED" ? "Penalty approved" : "Penalty rejected" });
      setApprovalRow(null);
      setHodRemarks("");
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApprovalPending(false);
    }
  }

  async function acknowledge(id: string) {
    setAckPendingId(id);
    try {
      await mutationRequest("PATCH", `/api/penalties/${id}/acknowledge`);
      toast({ title: "Penalty acknowledged" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAckPendingId(null);
    }
  }

  async function submitDelete() {
    if (!deleteRow) return;
    setDeletePending(true);
    try {
      await mutationRequest("DELETE", `/api/penalties/${deleteRow.id}`);
      toast({ title: "Penalty deleted" });
      setDeleteRow(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletePending(false);
    }
  }

  async function submitVoid() {
    if (!voidRow) return;
    setVoidPending(true);
    try {
      await mutationRequest("PATCH", `/api/penalties/${voidRow.id}/void`, { reason: voidReason.trim() });
      toast({ title: "Penalty voided" });
      setVoidRow(null);
      setVoidReason("");
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setVoidPending(false);
    }
  }

  const selectedEmployeeLabel = useMemo(() => {
    const u = allUsers.find((x) => x.id === form.employeeId);
    if (u) return u.fullName || u.name || u.email || "Employee";
    if (form.employeeId && editing) return viewRow?.employeeName ?? "Selected employee";
    return "";
  }, [allUsers, form.employeeId, editing, viewRow]);

  const canDecide = !!perms?.canDecide;
  const canVoid = !!perms?.canVoid;
  const canCreate = !!perms?.canCreate;
  const editApproved = editing && form.approvalStatus === "APPROVED" && !perms?.isFullAccess;

  const columns: DataTableColumn<PenaltyRow>[] = [
    { id: "no", header: "No", cell: (row) => (pagination ? (pagination.page - 1) * pagination.limit + rows.indexOf(row) + 1 : rows.indexOf(row) + 1) },
    { id: "name", header: "Name", cell: (row) => row.employeeName ?? "—" },
    { id: "head", header: "Penalty Head", cell: (row) => row.penaltyHead },
    { id: "amount", header: "Amount", cell: (row) => fmtMoney(row.amount) },
    { id: "date", header: "Date", cell: (row) => fmtDate(row.penaltyDate) },
    { id: "addedBy", header: "Added By", cell: (row) => row.addedByName ?? "—" },
    {
      id: "status",
      header: "Approval Status",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={row.approvalStatus} />
          {row.status === "VOIDED" && <StatusBadge status="VOIDED" />}
        </div>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => {
        const isVoided = row.status === "VOIDED";
        const isPending = row.approvalStatus === "PENDING" && !isVoided;
        return (
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button type="button" onClick={() => setViewRow(row)} className="text-blue-600 hover:underline">View</button>
            {canCreate && isPending && (
              <button type="button" onClick={() => openEdit(row)} className="text-emerald-700 hover:underline dark:text-emerald-400">Edit</button>
            )}
            {canDecide && isPending && (
              <>
                <button type="button" onClick={() => { setApprovalRow(row); setApprovalDecision("APPROVED"); setHodRemarks(""); }} className="text-green-700 hover:underline">Approve</button>
                <button type="button" onClick={() => { setApprovalRow(row); setApprovalDecision("REJECTED"); setHodRemarks(""); }} className="text-red-600 hover:underline">Reject</button>
              </>
            )}
            {canCreate && isPending && (
              <button type="button" onClick={() => setDeleteRow(row)} className="text-red-600 hover:underline">Delete</button>
            )}
            {canVoid && !isVoided && (
              <button type="button" onClick={() => { setVoidRow(row); setVoidReason(""); }} className="text-orange-600 hover:underline">Void</button>
            )}
            {!row.employeeAcknowledgedAt && !isVoided && (
              <button type="button" disabled={ackPendingId === row.id} onClick={() => acknowledge(row.id)} className="text-purple-600 hover:underline disabled:opacity-50">
                {ackPendingId === row.id ? "Acknowledging…" : "Acknowledge"}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <PenaltyShell title="Add Penalty">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            { label: "Total", value: summary.totalPenalties },
            { label: "Pending", value: summary.pendingCount },
            { label: "Approved", value: summary.approvedCount },
            { label: "Rejected", value: summary.rejectedCount },
            { label: "Voided", value: summary.voidedCount },
            { label: "Total Amount", value: fmtMoney(summary.totalAmount) },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">{c.label}</div>
              <div className="text-xl font-bold text-zinc-700 dark:text-zinc-200">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <DrmSection
        title="Penalties"
        actions={canCreate ? <Button onClick={openCreate}>+ Add Penalty</Button> : null}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium">Show</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="font-medium">entries</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="font-medium">Search:</span>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-[200px]" placeholder="Name, head, reason..." />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          error={listQuery.isError ? "Failed to load penalties." : null}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No penalty records found."
        />

        {pagination && pagination.total > 0 && (
          <PaginationBar page={pagination.page} pageSize={pagination.limit} total={pagination.total} onPageChange={setPage} className="mt-4" />
        )}
      </DrmSection>

      {/* Add / Edit form */}
      <DrmFormModal
        open={formOpen}
        title={editing ? "Edit Penalty" : "Add Penalty"}
        onClose={() => setFormOpen(false)}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={submitForm} disabled={formPending || editApproved} aria-busy={formPending}>
              {formPending ? "Saving…" : editing ? "Update" : "Submit"}
            </Button>
          </>
        }
      >
        {editApproved && (
          <p className="mb-3 text-sm text-amber-600">This penalty is approved — editing is restricted.</p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="pen-employee" label="Employee *">
            <Select value={form.employeeId} onValueChange={selectEmployee}>
              <SelectTrigger id="pen-employee">
                <SelectValue placeholder="Choose employee...">{selectedEmployeeLabel || undefined}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {userGroups.map((g) => (
                  <SelectGroup key={g.roleId}>
                    <SelectLabel>{g.roleLabel}</SelectLabel>
                    {g.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="pen-department" label="Department">
            <Input
              id="pen-department"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
              placeholder="Auto-filled from employee"
            />
          </Field>
          <Field id="pen-head" label="Penalty Head *">
            <Select value={form.penaltyHead} onValueChange={(v) => setForm((f) => ({ ...f, penaltyHead: v }))}>
              <SelectTrigger id="pen-head"><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>
                {heads.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="pen-amount" label="Penalty Amount *">
            <Input
              id="pen-amount"
              type="number" min="0" step="any"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field id="pen-date" label="Penalty Date *">
            <Input id="pen-date" type="date" value={form.penaltyDate} onChange={(e) => setForm((f) => ({ ...f, penaltyDate: e.target.value }))} />
          </Field>
          {canDecide && (
            <Field id="pen-approval" label="Approval Status">
              <Select value={form.approvalStatus} onValueChange={(v) => setForm((f) => ({ ...f, approvalStatus: v }))}>
                <SelectTrigger id="pen-approval"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="APPROVED">APPROVED</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field id="pen-reason" label="Penalty Reason *" className="md:col-span-2">
            <Textarea
              id="pen-reason"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Describe the reason for this penalty"
            />
          </Field>
          <Field id="pen-attachment-url" label="Evidence URL">
            <Input
              id="pen-attachment-url"
              value={form.attachmentUrl}
              onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
              placeholder="https://..."
            />
          </Field>
          <Field id="pen-attachment-name" label="Evidence Name">
            <Input
              id="pen-attachment-name"
              value={form.attachmentName}
              onChange={(e) => setForm((f) => ({ ...f, attachmentName: e.target.value }))}
              placeholder="e.g. screenshot.png"
            />
          </Field>
          <Field id="pen-manager-remarks" label="Manager Remarks" className="md:col-span-2">
            <Textarea
              id="pen-manager-remarks"
              value={form.managerRemarks}
              onChange={(e) => setForm((f) => ({ ...f, managerRemarks: e.target.value }))}
            />
          </Field>
        </div>
      </DrmFormModal>

      {/* View detail */}
      <DrmFormModal
        open={!!viewRow}
        title="Penalty Detail"
        onClose={() => setViewRow(null)}
        footer={<Button variant="secondary" onClick={() => setViewRow(null)}>Close</Button>}
      >
        {viewRow && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="Employee" value={viewRow.employeeName} />
            <Detail label="Email" value={viewRow.employeeEmail} />
            <Detail label="Department" value={viewRow.department} />
            <Detail label="Penalty Head" value={viewRow.penaltyHead} />
            <Detail label="Amount" value={fmtMoney(viewRow.amount)} />
            <Detail label="Penalty Date" value={fmtDate(viewRow.penaltyDate)} />
            <Detail label="Added By" value={viewRow.addedByName} />
            <Detail label="Status" valueNode={<StatusBadge status={viewRow.approvalStatus} />} />
            <div className="col-span-2"><Detail label="Reason" value={viewRow.reason} /></div>
            <div className="col-span-2"><Detail label="Manager Remarks" value={viewRow.managerRemarks} /></div>
            <div className="col-span-2"><Detail label="HOD Remarks" value={viewRow.hodRemarks} /></div>
            <Detail label="Approved By" value={viewRow.approvedByName} />
            <Detail label="Approved At" value={fmtDateTime(viewRow.approvedAt)} />
            <Detail label="Rejected By" value={viewRow.rejectedByName} />
            <Detail label="Rejected At" value={fmtDateTime(viewRow.rejectedAt)} />
            {viewRow.status === "VOIDED" && (
              <>
                <Detail label="Lifecycle" valueNode={<StatusBadge status="VOIDED" />} />
                <Detail label="Voided By" value={viewRow.voidedByName} />
                <Detail label="Voided At" value={fmtDateTime(viewRow.voidedAt)} />
                <div className="col-span-2"><Detail label="Void Reason" value={viewRow.voidReason} /></div>
              </>
            )}
            <Detail label="Acknowledged" value={viewRow.employeeAcknowledgedAt ? fmtDateTime(viewRow.employeeAcknowledgedAt) : "Not acknowledged"} />
            <Detail label="Created" value={fmtDateTime(viewRow.createdAt)} />
            <Detail label="Updated" value={fmtDateTime(viewRow.updatedAt)} />
            {viewRow.attachmentUrl && (
              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Attachment</div>
                <a href={viewRow.attachmentUrl} target="_blank" rel="noreferrer" className="break-all text-blue-600 hover:underline">
                  {viewRow.attachmentName || viewRow.attachmentUrl}
                </a>
              </div>
            )}
          </div>
        )}
      </DrmFormModal>

      {/* Approval modal */}
      <DrmFormModal
        open={!!approvalRow}
        title={approvalDecision === "APPROVED" ? "Approve Penalty" : "Reject Penalty"}
        onClose={() => setApprovalRow(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApprovalRow(null)}>Cancel</Button>
            <Button
              variant={approvalDecision === "REJECTED" ? "danger" : "primary"}
              onClick={submitApproval}
              disabled={approvalPending || (approvalDecision === "REJECTED" && !hodRemarks.trim())}
              aria-busy={approvalPending}
            >
              {approvalPending ? "Saving…" : "Confirm"}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          {approvalRow?.employeeName} — {approvalRow?.penaltyHead} ({fmtMoney(approvalRow?.amount ?? null)})
        </p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button variant={approvalDecision === "APPROVED" ? "primary" : "secondary"} onClick={() => setApprovalDecision("APPROVED")}>Approve</Button>
            <Button variant={approvalDecision === "REJECTED" ? "danger" : "secondary"} onClick={() => setApprovalDecision("REJECTED")}>Reject</Button>
          </div>
          <Field id="pen-hod-remarks" label={`HOD Remarks${approvalDecision === "REJECTED" ? " *" : ""}`}>
            <Textarea id="pen-hod-remarks" value={hodRemarks} onChange={(e) => setHodRemarks(e.target.value)} />
          </Field>
          {approvalDecision === "REJECTED" && !hodRemarks.trim() && (
            <p className="text-xs text-red-600">Remarks are required to reject a penalty.</p>
          )}
        </div>
      </DrmFormModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteRow}
        title="Delete penalty?"
        description={`This will remove the penalty for ${deleteRow?.employeeName ?? ""}. This action can only be done on pending penalties.`}
        confirmLabel="Delete"
        destructive
        pending={deletePending}
        onConfirm={submitDelete}
        onCancel={() => setDeleteRow(null)}
      />

      {/* Void confirm */}
      <DrmFormModal
        open={!!voidRow}
        title="Void Penalty"
        onClose={() => setVoidRow(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoidRow(null)}>Cancel</Button>
            <Button variant="danger" onClick={submitVoid} disabled={voidPending || !voidReason.trim()} aria-busy={voidPending}>
              {voidPending ? "Voiding…" : "Void Penalty"}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          {voidRow?.employeeName} — {voidRow?.penaltyHead} ({fmtMoney(voidRow?.amount ?? null)}).
          Voiding cancels this penalty&apos;s liability while keeping its history. This cannot be undone.
        </p>
        <Field id="pen-void-reason" label="Reason *">
          <Textarea id="pen-void-reason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Why is this penalty being voided?" />
        </Field>
        {!voidReason.trim() && <p className="mt-1 text-xs text-red-600">A reason is required to void a penalty.</p>}
      </DrmFormModal>
    </PenaltyShell>
  );
}

function Detail({ label, value, valueNode }: { label: string; value?: string | null; valueNode?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-500">{label}</div>
      <div className="break-words text-sm text-zinc-700 dark:text-zinc-300">
        {valueNode ?? (value && value !== "" ? value : "—")}
      </div>
    </div>
  );
}
