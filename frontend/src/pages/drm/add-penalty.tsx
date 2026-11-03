import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Eye, Pencil, Trash2, UserRoundPlus, CircleCheck, CircleX } from "lucide-react";

const GREEN = "#00a65a";

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
  employeeDisputedAt: string | null;
  disputeReason: string | null;
  disputeStatus: string | null;
  disputeResolvedByName: string | null;
  disputeResolvedAt: string | null;
  disputeResolutionNote: string | null;
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
  penaltyHeadAmounts?: Record<string, number>;
  statuses: string[];
  permissions: {
    canCreate: boolean; canEditOrDelete: boolean; canReviewEmployeeRejection: boolean;
    canDecide: boolean; canVoid: boolean; canViewReports: boolean;
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

function penaltyApprovalLabel(row: PenaltyRow): string {
  if (row.status === "VOIDED") return "Voided";
  if (row.disputeStatus === "PENDING") return "Pending (Account / HOD)";
  if (row.approvalStatus === "PENDING" && !row.employeeAcknowledgedAt) return "Pending (Employee)";
  if (row.approvalStatus === "APPROVED" && row.employeeAcknowledgedAt) return "Confirmed (Employee)";
  if (row.approvalStatus === "APPROVED") return "Approved";
  if (row.approvalStatus === "REJECTED") return "Rejected (HOD)";
  return row.approvalStatus;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    VOIDED: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    CANCELLED: "bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <Badge className={`${map[status] || map.CANCELLED} border-0 text-[11px] font-medium`}>
      {status}
    </Badge>
  );
}

/** Legacy add-penalty: create/edit UI is Person + Head + Amount only. */
const EMPTY_EDIT = {
  id: "" as string,
  employeeId: "",
  penaltyHead: "",
  amount: "",
  approvalStatus: "PENDING",
};
type EditFormState = typeof EMPTY_EDIT;

export default function AddPenaltyPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [inlineEmployeeId, setInlineEmployeeId] = useState("");
  const [inlineHead, setInlineHead] = useState("");
  const [inlineAmount, setInlineAmount] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ ...EMPTY_EDIT });
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignForm, setReassignForm] = useState<EditFormState>({ ...EMPTY_EDIT });
  const [reassignReason, setReassignReason] = useState("");

  const [viewRow, setViewRow] = useState<PenaltyRow | null>(null);
  const [approvalRow, setApprovalRow] = useState<PenaltyRow | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [hodRemarks, setHodRemarks] = useState("");
  const [deleteRow, setDeleteRow] = useState<PenaltyRow | null>(null);
  const [voidRow, setVoidRow] = useState<PenaltyRow | null>(null);
  const [voidReason, setVoidReason] = useState("");

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
  const headAmounts = metaQuery.data?.penaltyHeadAmounts ?? {};

  function amountForHead(head: string): string {
    const n = headAmounts[head];
    return n != null && !Number.isNaN(n) ? String(n) : "";
  }

  function onInlineHeadChange(head: string) {
    setInlineHead(head);
    const amt = amountForHead(head);
    if (amt !== "") setInlineAmount(amt);
  }

  function onEditHeadChange(head: string) {
    const amt = amountForHead(head);
    setEditForm((f) => ({
      ...f,
      penaltyHead: head,
      ...(amt !== "" ? { amount: amt } : {}),
    }));
  }

  function onReassignHeadChange(head: string) {
    const amt = amountForHead(head);
    setReassignForm((f) => ({
      ...f,
      penaltyHead: head,
      amount: amt !== "" ? amt : f.amount,
    }));
  }

  const usersQuery = useQuery<{ groups: UserGroup[] }>({
    queryKey: ["/api/penalties/users"],
    enabled: !!perms?.canCreate || !!perms?.canEditOrDelete,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/penalties/users");
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });
  const userGroups = usersQuery.data?.groups ?? [];
  const allUsers = useMemo(() => userGroups.flatMap((g) => g.users), [userGroups]);

  const listKey = ["/api/penalties", page, limit, search, statusFilter] as const;
  const listQuery = useQuery<ListResult>({
    queryKey: listKey,
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const emp = allUsers.find((u) => u.id === inlineEmployeeId);
      const body = {
        employeeId: inlineEmployeeId,
        department: emp?.department || null,
        penaltyHead: inlineHead,
        reason: inlineHead,
        amount: Number(inlineAmount),
        penaltyDate: new Date().toISOString().slice(0, 10),
      };
      const res = await apiRequest("POST", "/api/penalties", body);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to add penalty");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty added" });
      setInlineEmployeeId("");
      setInlineHead("");
      setInlineAmount("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reassignMutation = useMutation({
    mutationFn: async (payload: EditFormState) => {
      const body = {
        employeeId: payload.employeeId,
        penaltyHead: payload.penaltyHead,
        amount: Number(payload.amount),
      };
      const res = await apiRequest("PATCH", `/api/penalties/${payload.id}/reassign`, body);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Re-assign failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty re-assigned" });
      setReassignOpen(false);
      setReassignReason("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: EditFormState) => {
      const emp = allUsers.find((u) => u.id === payload.employeeId);
      const body = {
        employeeId: payload.employeeId,
        department: emp?.department || null,
        penaltyHead: payload.penaltyHead,
        reason: payload.penaltyHead,
        amount: Number(payload.amount),
      };
      const res = await apiRequest("PATCH", `/api/penalties/${payload.id}`, body);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty updated" });
      setEditOpen(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approvalMutation = useMutation({
    mutationFn: async () => {
      if (!approvalRow) return;
      const res = await apiRequest("PATCH", `/api/penalties/${approvalRow.id}/approval`, {
        approvalStatus: approvalDecision,
        hodRemarks: hodRemarks || null,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Action failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: approvalDecision === "APPROVED" ? "Penalty approved" : "Penalty rejected" });
      setApprovalRow(null);
      setHodRemarks("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/penalties/${id}/acknowledge`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Action failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty acknowledged" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolveDisputeMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "uphold" | "withdraw"; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/penalties/${id}/dispute/resolve`, { action, note });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Action failed");
      return json;
    },
    onSuccess: (_data, { action }) => {
      toast({ title: action === "withdraw" ? "Dispute upheld — penalty withdrawn" : "Dispute dismissed — penalty stands" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/penalties/${id}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Delete failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty deleted" });
      setDeleteRow(null);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidRow) return;
      const res = await apiRequest("PATCH", `/api/penalties/${voidRow.id}/void`, {
        reason: voidReason.trim(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Void failed");
      return json;
    },
    onSuccess: () => {
      toast({ title: "Penalty voided" });
      setVoidRow(null);
      setVoidReason("");
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openReassign(row: PenaltyRow) {
    setReassignReason(row.disputeReason ?? "");
    setReassignForm({
      id: row.id,
      employeeId: row.employeeId,
      penaltyHead: row.penaltyHead,
      amount: String(row.amount ?? ""),
      approvalStatus: row.approvalStatus,
    });
    setReassignOpen(true);
  }

  function openEdit(row: PenaltyRow) {
    setEditForm({
      id: row.id,
      employeeId: row.employeeId,
      penaltyHead: row.penaltyHead,
      amount: String(row.amount ?? ""),
      approvalStatus: row.approvalStatus,
    });
    setEditOpen(true);
  }

  function submitInlineCreate() {
    if (!inlineEmployeeId) return toast({ title: "Person is required", variant: "destructive" });
    if (!inlineHead) return toast({ title: "Head is required", variant: "destructive" });
    if (inlineAmount === "" || isNaN(Number(inlineAmount)) || Number(inlineAmount) < 0) {
      return toast({ title: "Valid amount is required", variant: "destructive" });
    }
    createMutation.mutate();
  }

  function submitReassign() {
    if (!reassignForm.employeeId) return toast({ title: "Person is required", variant: "destructive" });
    if (!reassignForm.penaltyHead) return toast({ title: "Head is required", variant: "destructive" });
    if (reassignForm.amount === "" || isNaN(Number(reassignForm.amount)) || Number(reassignForm.amount) < 0) {
      return toast({ title: "Valid amount is required", variant: "destructive" });
    }
    reassignMutation.mutate(reassignForm);
  }

  function submitEdit() {
    if (!editForm.employeeId) return toast({ title: "Person is required", variant: "destructive" });
    if (!editForm.penaltyHead) return toast({ title: "Head is required", variant: "destructive" });
    if (editForm.amount === "" || isNaN(Number(editForm.amount)) || Number(editForm.amount) < 0) {
      return toast({ title: "Valid amount is required", variant: "destructive" });
    }
    updateMutation.mutate(editForm);
  }

  const canDecide = !!perms?.canDecide;
  const canVoid = !!perms?.canVoid;
  const canCreate = !!perms?.canCreate;
  const canEditOrDelete = !!perms?.canEditOrDelete;
  const canReviewRejection = !!perms?.canReviewEmployeeRejection;
  const editApproved = editOpen && editForm.approvalStatus === "APPROVED" && !perms?.isFullAccess;

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
      {/* Header */}
      <div className="mb-4 flex space-x-1 uppercase text-[15px] font-bold tracking-wide">
        <span className="text-[#495057] dark:text-zinc-400">PENALTY / </span>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowInlineForm((v) => !v)}
            className="text-[#00a65a] dark:text-zinc-200 hover:opacity-80 transition-opacity"
          >
            ADD PENALTY
          </button>
        ) : (
          <span className="text-[#00a65a] dark:text-zinc-200">ADD PENALTY</span>
        )}
      </div>

      {/* Legacy inline form: Person, Head, Amount, Submit */}
      {canCreate && showInlineForm && (
        <Card className="mb-5 border border-gray-100 shadow-sm rounded-md bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-end gap-6">
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-300">Person</Label>
                <Select value={inlineEmployeeId} onValueChange={setInlineEmployeeId}>
                  <SelectTrigger className="w-full h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.name || u.email || u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-300">Head</Label>
                <Select value={inlineHead} onValueChange={onInlineHeadChange}>
                  <SelectTrigger className="w-full h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {heads.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-300">Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="00.00"
                  value={inlineAmount}
                  onChange={(e) => setInlineAmount(e.target.value)}
                  className="w-full h-10 text-[13px] bg-[#f8f9fa] dark:bg-zinc-950"
                />
              </div>
              <div>
                <Button
                  onClick={submitInlineCreate}
                  disabled={createMutation.isPending}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-10 px-8 font-medium shadow-none text-[13px]"
                >
                  Submit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total", value: summary.totalPenalties },
            { label: "Pending", value: summary.pendingCount },
            { label: "Approved", value: summary.approvedCount },
            { label: "Rejected", value: summary.rejectedCount },
            { label: "Voided", value: summary.voidedCount },
            { label: "Total Amount", value: fmtMoney(summary.totalAmount) },
          ].map((c) => (
            <Card key={c.label} className="border border-gray-100 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <CardContent className="p-3">
                <div className="text-[11px] uppercase tracking-wide text-[#6c757d] dark:text-zinc-500">{c.label}</div>
                <div className="text-[20px] font-bold text-[#495057] dark:text-zinc-200">{c.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table Area */}
      <Card className="border border-gray-100 shadow-sm rounded-md bg-white overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <CardContent className="p-0">
          <div className="p-4 flex flex-wrap justify-between items-center gap-3 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Show</span>
              <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[70px] h-8 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">entries</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[130px] h-8 text-[13px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-[13px] text-[#495057] font-medium dark:text-zinc-400">Search:</span>
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-[200px] h-8 text-[13px]"
                placeholder="Name, head, reason..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f4f6f9] border-y border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                  {["No", "Name", "Penalty Head", "Amount", "Date", "Add By", "Approval Status", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[12px] font-bold text-[#495057] dark:text-zinc-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#6c757d]">Loading…</td></tr>
                )}
                {listQuery.isError && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-red-600">Failed to load penalties.</td></tr>
                )}
                {!listQuery.isLoading && !listQuery.isError && rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[#6c757d]">No penalty records found.</td></tr>
                )}
                {rows.map((row, idx) => {
                  const no = pagination ? (pagination.page - 1) * pagination.limit + idx + 1 : idx + 1;
                  const isVoided = row.status === "VOIDED";
                  const isPending = row.approvalStatus === "PENDING" && !isVoided;
                  const employeeRejected = row.disputeStatus === "PENDING";
                  const awaitingEmployee = isPending && !employeeRejected && !row.employeeAcknowledgedAt;
                  const hodCanDecide = canDecide && isPending && !awaitingEmployee && !employeeRejected;
                  const canEditRow = canEditOrDelete && isPending && !employeeRejected;
                  return (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800 dark:border-zinc-800">
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{no}</td>
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.employeeName ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.penaltyHead}</td>
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{fmtMoney(row.amount)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{fmtDate(row.penaltyDate)}</td>
                      <td className="px-4 py-3 text-[13px] text-[#495057] dark:text-zinc-400">{row.addedByName ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <Badge className="bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-0 text-[11px] font-medium">
                          {penaltyApprovalLabel(row)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[13px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            title="View"
                            onClick={() => setViewRow(row)}
                            className="p-1 rounded hover:bg-blue-50 dark:hover:bg-zinc-800 text-blue-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEditRow && (
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEdit(row)}
                              className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-zinc-800 text-[#00a65a]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canReviewRejection && employeeRejected && (
                            <button
                              type="button"
                              title="Re-assign after rejection"
                              onClick={() => openReassign(row)}
                              className="p-1 rounded hover:bg-indigo-50 dark:hover:bg-zinc-800 text-indigo-600"
                            >
                              <UserRoundPlus className="h-4 w-4" />
                            </button>
                          )}
                          {hodCanDecide && (
                            <>
                              <button
                                onClick={() => { setApprovalRow(row); setApprovalDecision("APPROVED"); setHodRemarks(""); }}
                                className="text-[11px] text-green-700 hover:underline px-1"
                              >Approve</button>
                              <button
                                onClick={() => { setApprovalRow(row); setApprovalDecision("REJECTED"); setHodRemarks(""); }}
                                className="text-[11px] text-red-600 hover:underline px-1"
                              >Reject</button>
                            </>
                          )}
                          {canEditRow && (
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => setDeleteRow(row)}
                              className="p-1 rounded hover:bg-red-50 dark:hover:bg-zinc-800 text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {canVoid && !isVoided && (
                            <button
                              onClick={() => { setVoidRow(row); setVoidReason(""); }}
                              className="text-[12px] text-orange-600 hover:underline"
                            >Void</button>
                          )}
                          {!row.employeeAcknowledgedAt && row.disputeStatus !== "PENDING" && !isVoided && (
                            <button
                              onClick={() => acknowledgeMutation.mutate(row.id)}
                              className="text-[12px] text-purple-600 hover:underline"
                            >Acknowledge</button>
                          )}
                          {(canReviewRejection || canDecide) && row.disputeStatus === "PENDING" && (
                            <>
                              <button
                                type="button"
                                disabled={resolveDisputeMutation.isPending}
                                onClick={() => resolveDisputeMutation.mutate({ id: row.id, action: "uphold" })}
                                className="p-1 rounded hover:bg-blue-50 dark:hover:bg-zinc-800 text-blue-600 disabled:opacity-50"
                                title={row.disputeReason ? `Penalty stands — reject employee reason: ${row.disputeReason}` : "Penalty stands (reject employee reason)"}
                              >
                                <CircleCheck className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={resolveDisputeMutation.isPending}
                                onClick={() => resolveDisputeMutation.mutate({ id: row.id, action: "withdraw" })}
                                className="p-1 rounded hover:bg-orange-50 dark:hover:bg-zinc-800 text-orange-600 disabled:opacity-50"
                                title={row.disputeReason ? `Withdraw penalty — uphold employee rejection: ${row.disputeReason}` : "Withdraw penalty (uphold employee rejection)"}
                              >
                                <CircleX className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 bg-white border-t border-gray-100 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="text-[13px] text-[#495057] dark:text-zinc-400">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
              </div>
              <div className="flex bg-white rounded-md border border-gray-200 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <button
                  className="px-3 py-1.5 text-[13px] text-[#6c757d] hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >Previous</button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((n) => Math.abs(n - pagination.page) <= 2 || n === 1 || n === pagination.totalPages)
                  .map((n, i, arr) => (
                    <span key={n} className="flex">
                      {i > 0 && arr[i - 1] !== n - 1 && (
                        <span className="px-2 py-1.5 text-[13px] text-[#6c757d]">…</span>
                      )}
                      <button
                        onClick={() => setPage(n)}
                        className={`px-3 py-1.5 text-[13px] border-l border-gray-200 dark:border-zinc-800 ${
                          n === pagination.page
                            ? "bg-[#00a65a] text-white"
                            : "text-[#495057] hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >{n}</button>
                    </span>
                  ))}
                <button
                  className="px-3 py-1.5 text-[13px] text-[#495057] hover:bg-gray-50 border-l border-gray-200 disabled:opacity-50 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >Next</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit — same three fields as legacy */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Penalty</DialogTitle>
            {editApproved && (
              <DialogDescription className="text-amber-600">
                This penalty is approved — editing is restricted.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Person</Label>
              <Select
                value={editForm.employeeId}
                onValueChange={(v) => setEditForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Head</Label>
              <Select
                value={editForm.penaltyHead}
                onValueChange={onEditHeadChange}
              >
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {heads.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                placeholder="00.00"
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-10 text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={submitEdit}
              disabled={updateMutation.isPending || editApproved}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            >
              {updateMutation.isPending ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-assign after employee rejection */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Re-assign Penalty</DialogTitle>
            <DialogDescription>
              Employee rejected this penalty. Update the assignee or details, then send again.
            </DialogDescription>
          </DialogHeader>
          {reassignReason && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3 text-[12px] text-red-800 dark:text-red-200">
              <span className="font-semibold">Rejection reason: </span>{reassignReason}
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">Person</Label>
              <Select
                value={reassignForm.employeeId}
                onValueChange={(v) => setReassignForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {allUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName || u.name || u.email || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Head</Label>
              <Select value={reassignForm.penaltyHead} onValueChange={onReassignHeadChange}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {heads.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">Amount</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={reassignForm.amount}
                onChange={(e) => setReassignForm((f) => ({ ...f, amount: e.target.value }))}
                className="h-10 text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button
              onClick={submitReassign}
              disabled={reassignMutation.isPending}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
            >
              {reassignMutation.isPending ? "Saving…" : "Re-assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View detail */}
      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Penalty Detail</DialogTitle></DialogHeader>
          {viewRow && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <Detail label="Employee" value={viewRow.employeeName} />
              <Detail label="Email" value={viewRow.employeeEmail} />
              <Detail label="Department" value={viewRow.department} />
              <Detail label="Penalty Head" value={viewRow.penaltyHead} />
              <Detail label="Amount" value={fmtMoney(viewRow.amount)} />
              <Detail label="Penalty Date" value={fmtDate(viewRow.penaltyDate)} />
              <Detail label="Added By" value={viewRow.addedByName} />
              <Detail label="Status" valueNode={statusBadge(viewRow.approvalStatus)} />
              <div className="col-span-2"><Detail label="Reason" value={viewRow.reason} /></div>
              <div className="col-span-2"><Detail label="Manager Remarks" value={viewRow.managerRemarks} /></div>
              <div className="col-span-2"><Detail label="HOD Remarks" value={viewRow.hodRemarks} /></div>
              <Detail label="Approved By" value={viewRow.approvedByName} />
              <Detail label="Approved At" value={fmtDateTime(viewRow.approvedAt)} />
              <Detail label="Rejected By" value={viewRow.rejectedByName} />
              <Detail label="Rejected At" value={fmtDateTime(viewRow.rejectedAt)} />
              {viewRow.status === "VOIDED" && (
                <>
                  <Detail label="Lifecycle" valueNode={statusBadge("VOIDED")} />
                  <Detail label="Voided By" value={viewRow.voidedByName} />
                  <Detail label="Voided At" value={fmtDateTime(viewRow.voidedAt)} />
                  <div className="col-span-2"><Detail label="Void Reason" value={viewRow.voidReason} /></div>
                </>
              )}
              <Detail label="Acknowledged" value={viewRow.employeeAcknowledgedAt ? fmtDateTime(viewRow.employeeAcknowledgedAt) : "Not acknowledged"} />
              {viewRow.employeeDisputedAt && (
                <>
                  <Detail label="Disputed At" value={fmtDateTime(viewRow.employeeDisputedAt)} />
                  <Detail label="Dispute Status" value={viewRow.disputeStatus} />
                  <div className="col-span-2"><Detail label="Dispute Reason" value={viewRow.disputeReason} /></div>
                  {viewRow.disputeResolvedAt && (
                    <>
                      <Detail label="Dispute Resolved By" value={viewRow.disputeResolvedByName} />
                      <Detail label="Dispute Resolved At" value={fmtDateTime(viewRow.disputeResolvedAt)} />
                      <div className="col-span-2"><Detail label="Resolution Note" value={viewRow.disputeResolutionNote} /></div>
                    </>
                  )}
                </>
              )}
              <Detail label="Created" value={fmtDateTime(viewRow.createdAt)} />
              <Detail label="Updated" value={fmtDateTime(viewRow.updatedAt)} />
              {viewRow.attachmentUrl && (
                <div className="col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-[#6c757d]">Attachment</div>
                  <a href={viewRow.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
                    {viewRow.attachmentName || viewRow.attachmentUrl}
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setViewRow(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval modal */}
      <Dialog open={!!approvalRow} onOpenChange={(o) => !o && setApprovalRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{approvalDecision === "APPROVED" ? "Approve Penalty" : "Reject Penalty"}</DialogTitle>
            <DialogDescription>
              {approvalRow?.employeeName} — {approvalRow?.penaltyHead} ({fmtMoney(approvalRow?.amount ?? null)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={approvalDecision === "APPROVED" ? "default" : "outline"}
                onClick={() => setApprovalDecision("APPROVED")}
                className={approvalDecision === "APPROVED" ? "bg-[#00a65a] hover:bg-[#008d4c]" : ""}
              >Approve</Button>
              <Button
                variant={approvalDecision === "REJECTED" ? "destructive" : "outline"}
                onClick={() => setApprovalDecision("REJECTED")}
              >Reject</Button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">
                HOD Remarks{approvalDecision === "REJECTED" && <span className="text-red-600"> *</span>}
              </Label>
              <Textarea value={hodRemarks} onChange={(e) => setHodRemarks(e.target.value)} className="text-[13px]" />
              {approvalDecision === "REJECTED" && !hodRemarks.trim() && (
                <p className="text-[12px] text-red-600">Remarks are required to reject a penalty.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalRow(null)}>Cancel</Button>
            <Button
              onClick={() => approvalMutation.mutate()}
              disabled={approvalMutation.isPending || (approvalDecision === "REJECTED" && !hodRemarks.trim())}
              className={approvalDecision === "APPROVED" ? "bg-[#00a65a] hover:bg-[#008d4c] text-white" : ""}
              variant={approvalDecision === "REJECTED" ? "destructive" : "default"}
            >
              {approvalMutation.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete penalty?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the penalty for {deleteRow?.employeeName}. This action can only be done on pending penalties.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRow && deleteMutation.mutate(deleteRow.id)}
              className="bg-red-600 hover:bg-red-700"
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Void confirm */}
      <Dialog open={!!voidRow} onOpenChange={(o) => !o && setVoidRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Void Penalty</DialogTitle>
            <DialogDescription>
              {voidRow?.employeeName} — {voidRow?.penaltyHead} ({fmtMoney(voidRow?.amount ?? null)}).
              Voiding cancels this penalty's liability while keeping its history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[13px]">Reason<span className="text-red-600"> *</span></Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="text-[13px]"
              placeholder="Why is this penalty being voided?"
            />
            {!voidReason.trim() && (
              <p className="text-[12px] text-red-600">A reason is required to void a penalty.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidRow(null)}>Cancel</Button>
            <Button
              onClick={() => voidMutation.mutate()}
              disabled={voidMutation.isPending || !voidReason.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {voidMutation.isPending ? "Voiding…" : "Void Penalty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value, valueNode }: { label: string; value?: string | null; valueNode?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[#6c757d] dark:text-zinc-500">{label}</div>
      <div className="text-[13px] text-[#495057] dark:text-zinc-300 break-words">
        {valueNode ?? (value && value !== "" ? value : "—")}
      </div>
    </div>
  );
}
