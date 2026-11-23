import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { Trash2, ChevronDown, Pencil } from "lucide-react";
import type { RefundGmEntry } from "@shared/schema";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

type User = { id: string; full_name: string; email: string; role: string };

// A specific GM/order (not just a company name) — the Paid-Alibaba refund
// check needs a real gm_entries row to check against.
type GmOption = {
  id: string;
  drmId: string | null;
  company: string | null;
  orderDollar: string | number | null;
  pkr: string | number | null;
  status: string | null;
  isRefunded: boolean | null;
};

// Edit + status change are for admin, Account and HOD only (backend enforces the same).
const GM_EDIT_ROLES = ["admin", "super_admin", "adm", "account_manager", "account", "super_hod", "hod"];
function canEditGmEntries(): boolean {
  let role = "";
  try { role = sessionStorage.getItem("userRole") || ""; } catch { /* ignore */ }
  return GM_EDIT_ROLES.includes(role.toLowerCase().replace(/[\s-]+/g, "_"));
}

// Stored values match what the HOD verification queue writes ('Approved' / 'Rejected').
const REFUND_STATUSES = ["Pending", "Approved", "Rejected", "Clear"];
const statusKey = (s: string | null | undefined) => {
  const v = (s || "pending").toLowerCase();
  return REFUND_STATUSES.find((x) => x.toLowerCase() === v) || "Pending";
};
const STATUS_CLS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Clear: "bg-blue-100 text-blue-700",
  Rejected: "bg-red-100 text-red-700",
};

type RefundEditForm = { companyName: string; personName: string; amount: string; amountType: string; comment: string };

export default function AccountRefundGm() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [companySearch, setCompanySearch] = useState("");
  const [gmSearchDebounced, setGmSearchDebounced] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const companyRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const rowsPerPage = 10;
  const canEdit = canEditGmEntries();
  const [editTarget, setEditTarget] = useState<RefundGmEntry | null>(null);
  const [editForm, setEditForm] = useState<RefundEditForm>({ companyName: "", personName: "", amount: "", amountType: "PKR", comment: "" });
  const openEdit = (e: RefundGmEntry) => {
    setEditTarget(e);
    setEditForm({
      companyName: e.companyName || "",
      personName: e.personName || "",
      amount: e.amount != null ? String(parseFloat(String(e.amount))) : "",
      amountType: ["USD", "EUR"].includes(String(e.amountType)) ? String(e.amountType) : "PKR",
      comment: e.comment || "",
    });
  };

  const [formData, setFormData] = useState({
    gmEntryId: "",
    companyName: "",
    amount: "0.0",
    amountType: "PKR",
    personName: "",
    comment: "",
  });

  // Close company dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce the GM search box before hitting the server.
  useEffect(() => {
    const t = setTimeout(() => setGmSearchDebounced(companySearch.trim()), 300);
    return () => clearTimeout(t);
  }, [companySearch]);

  // ── Real GM/order entries from DB — searching by company name, DRM ID,
  // member ID or order ID (same search this endpoint already supports for
  // the GM Pool page itself). A specific GM row is what the Paid-Alibaba
  // check needs, not just a company name string.
  const { data: gmSearchRes, isFetching: isSearchingGm } = useQuery<{ data: GmOption[] }>({
    queryKey: ["/api/gm-pool", "refund-search", gmSearchDebounced],
    queryFn: () => apiRequestJson("GET", `/api/gm-pool?search=${encodeURIComponent(gmSearchDebounced)}&pageSize=20`),
    enabled: gmSearchDebounced.length > 0,
  });
  const gmOptions = gmSearchRes?.data ?? [];

  // ── Real users from DB (for Person dropdown) ─────────────────
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/account/users-list"],
    staleTime: 60_000,
  });

  // ── Refund entries ────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery<RefundGmEntry[]>({
    queryKey: ["/api/account/refund-gm"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) =>
      apiRequestJson("POST", "/api/account/refund-gm", {
        gmEntryId: data.gmEntryId,
        companyName: data.companyName,
        personName: data.personName,
        amount: data.amount,
        amountType: data.amountType,
        comment: data.comment || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/refund-gm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
      setFormData({ gmEntryId: "", companyName: "", amount: "0.0", amountType: "PKR", personName: "", comment: "" });
      setCompanySearch("");
      toast({ title: "Success", description: "Refund entry added successfully" });
    },
    onError: (err: any) =>
      toast({ title: "Could not add refund", description: err?.message || "Failed to add refund entry", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RefundEditForm }) =>
      apiRequestJson("PATCH", `/api/account/refund-gm/${id}`, {
        companyName: data.companyName.trim(),
        personName: data.personName.trim(),
        amount: data.amount,
        amountType: data.amountType,
        comment: data.comment.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/refund-gm"] });
      setEditTarget(null);
      toast({ title: "Updated", description: "Refund entry updated" });
    },
    onError: (err: any) =>
      toast({ title: "Update failed", description: err?.message || "Failed to update entry", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequestJson("PATCH", `/api/account/refund-gm/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/refund-gm"] });
      toast({ title: "Status updated", description: "Refund status changed" });
    },
    onError: (err: any) =>
      toast({ title: "Status update failed", description: err?.message || "Failed to update status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/account/refund-gm/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/refund-gm"] });
      toast({ title: "Deleted", description: "Refund entry deleted" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gmEntryId) {
      toast({ title: "Validation Error", description: "Search and select the specific GM/order to refund", variant: "destructive" });
      return;
    }
    if (!formData.companyName || !formData.amount || !formData.personName) {
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const totalPages = Math.ceil(entries.length / rowsPerPage);
  const paginatedEntries = entries.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-3 dark:bg-zinc-900">
        <h1 className="text-base font-bold tracking-wide" style={{ letterSpacing: "0.04em" }}>
          <span className="text-gray-800 dark:text-zinc-100">CLIENT REFUND PAYMENT</span>
          <span
            className="text-green-600 cursor-pointer hover:text-green-700 hover:underline select-none transition-colors"
            onClick={() => {
              setShowForm((prev) => !prev);
              if (!showForm) {
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }
            }}
            title={showForm ? "Click to hide form" : "Click to add refund"}
          >
            {" / ADD REFUND"}
          </span>
        </h1>
      </div>

      <div className="p-4">
        {/* ─── Form Card ──────────────────────────────────────────── */}
        {showForm && (
          <div ref={formRef} className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <form onSubmit={handleSubmit}>
              {/* Row 1: Company | Amount | Amount Type | Person */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">

                {/* GM/Order — picking a specific GM is what lets the backend check
                    whether it's already reached Paid Alibaba before allowing a refund. */}
                <div className="relative" ref={companyRef}>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">GM / Company</Label>
                  <div
                    className="relative flex items-center h-9 border border-gray-300 rounded bg-white cursor-pointer px-3 dark:bg-zinc-900 dark:border-zinc-800"
                    onClick={() => setShowCompanyDropdown((v) => !v)}
                  >
                    <span className={`flex-1 text-sm truncate ${formData.companyName ? "text-gray-800 dark:text-slate-200" : "text-gray-400"}`}>
                      {formData.companyName || "Search GM by company/DRM ID/order ID"}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 ml-1 transition-transform ${showCompanyDropdown ? "rotate-180" : ""}`} />
                  </div>

                  {showCompanyDropdown && (
                    <div className="absolute z-50 w-full bg-white border border-gray-300 rounded shadow-lg mt-0.5 max-h-64 flex flex-col dark:bg-zinc-900 dark:border-zinc-800">
                      {/* Search inside dropdown */}
                      <div className="p-2 border-b border-gray-100 dark:border-zinc-800">
                        <input
                          autoFocus
                          className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-green-500 dark:border-zinc-800"
                          placeholder="Type to search..."
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                        />
                      </div>
                      <div className="overflow-auto flex-1">
                        {!companySearch.trim() ? (
                          <div className="px-3 py-3 text-sm text-gray-400 text-center">Start typing to search GMs</div>
                        ) : isSearchingGm ? (
                          <div className="px-3 py-3 text-sm text-gray-400 text-center">Searching...</div>
                        ) : gmOptions.length > 0 ? (
                          gmOptions.map((g) => (
                            <div
                              key={g.id}
                              className={`px-3 py-2 text-sm flex items-center gap-2 ${g.isRefunded ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-green-50"}`}
                              onClick={() => {
                                if (g.isRefunded) return;
                                setFormData((f) => {
                                  // Auto-fill the order's own amount as a starting point — still a
                                  // plain editable number input, so it can be adjusted up or down
                                  // (e.g. a partial refund) before submitting.
                                  const autoAmount = f.amountType === "PKR" ? g.pkr : g.orderDollar;
                                  return {
                                    ...f,
                                    gmEntryId: g.id,
                                    companyName: g.company || "",
                                    amount: autoAmount != null && Number(autoAmount) > 0 ? String(autoAmount) : f.amount,
                                  };
                                });
                                setCompanySearch("");
                                setShowCompanyDropdown(false);
                              }}
                            >
                              <span className="font-semibold text-xs text-green-700">{g.drmId || g.id.substring(0, 8)}</span>
                              <span className="truncate flex-1">{g.company}</span>
                              {g.isRefunded ? (
                                <span className="text-[10px] font-semibold text-red-500 uppercase shrink-0">Refunded</span>
                              ) : (
                                <span className="text-[11px] text-gray-400 shrink-0">${Number(g.orderDollar || 0).toLocaleString()}</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-sm text-gray-400 text-center">No matching GM found</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Amount:</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                    className="text-sm h-9 border-gray-300 dark:border-zinc-800"
                  />
                </div>

                {/* Amount Type */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Amount Type:</Label>
                  <Select
                    value={formData.amountType}
                    onValueChange={(v) => setFormData((f) => ({ ...f, amountType: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm border-gray-300 dark:border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Person — real users dropdown */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Person:</Label>
                  <RoleGroupedUserSelect
                    grouped={false}
                    users={allUsers}
                    value={formData.personName}
                    onChange={(v) => setFormData((f) => ({ ...f, personName: v }))}
                    getValue={(u: any) => String(u.full_name || "")}
                    placeholder="Choose..."
                    className="h-9 text-sm border-gray-300 dark:border-zinc-800"
                  />
                </div>
              </div>

              {/* Row 2: Comment */}
              <div className="mb-3">
                <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Comment</Label>
                <Textarea
                  placeholder="add detail"
                  value={formData.comment}
                  onChange={(e) => setFormData((f) => ({ ...f, comment: e.target.value }))}
                  rows={3}
                  className="text-sm border-gray-300 resize-y dark:border-zinc-800"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white h-9 px-6 text-sm font-medium rounded"
              >
                {createMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </form>
          </div>
        )}

        {/* ─── Table ──────────────────────────────────────────────── */}
        <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No refund entries yet</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-10 dark:text-zinc-400">No#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-40 dark:text-zinc-400">Date</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 dark:text-zinc-400">Company</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-32 dark:text-zinc-400">Person</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-24 dark:text-zinc-400">Amount</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 dark:text-zinc-400">Comment</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-28 dark:text-zinc-400">Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-20 dark:text-zinc-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800"
                      >
                        <td className="px-3 py-2 text-gray-700 dark:text-zinc-400">
                          {(currentPage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-zinc-300">
                          {format(new Date(entry.createdAt), "dd MMM yyyy hh:mm aa")}
                        </td>
                        <td className="px-3 py-2 font-semibold text-green-700 uppercase">
                          {entry.companyName}
                        </td>
                        <td className="px-3 py-2 text-green-600">{entry.personName}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-zinc-100">
                          {parseFloat(entry.amount).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-gray-600 max-w-xs dark:text-zinc-300">
                          <span className="line-clamp-2">{entry.comment || "—"}</span>
                        </td>
                        <td className="px-3 py-2">
                          {canEdit ? (
                            <select
                              value={statusKey(entry.status)}
                              disabled={statusMutation.isPending}
                              onChange={(e) => statusMutation.mutate({ id: entry.id, status: e.target.value })}
                              className={`text-xs font-semibold rounded px-1.5 py-0.5 border-0 cursor-pointer ${STATUS_CLS[statusKey(entry.status)]}`}
                              title="Change status"
                            >
                              {REFUND_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${STATUS_CLS[statusKey(entry.status)]}`}>
                              {statusKey(entry.status)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(entry)}
                              className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center justify-center transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMutation.mutate(entry.id)}
                            disabled={deleteMutation.isPending}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    Showing {(currentPage - 1) * rowsPerPage + 1}–
                    {Math.min(currentPage * rowsPerPage, entries.length)} of {entries.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      Prev
                    </button>
                    <span className="px-3 py-1 text-xs text-gray-700 dark:text-zinc-400">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg max-w-md w-full p-4 border dark:border-zinc-800">
            <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-3">Edit Refund GM</h2>
            <div className="space-y-2">
              {([["companyName", "Company"], ["personName", "Person"]] as const).map(([k, label]) => (
                <div key={k}>
                  <Label className="text-xs text-gray-600 dark:text-zinc-300">{label} <span className="text-red-500">*</span></Label>
                  <Input
                    className="h-9 text-sm mt-1"
                    value={editForm[k]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-600 dark:text-zinc-300">Amount <span className="text-red-500">*</span></Label>
                  <Input
                    className="h-9 text-sm mt-1"
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 dark:text-zinc-300">Amount Type</Label>
                  <Select value={editForm.amountType} onValueChange={(v) => setEditForm((f) => ({ ...f, amountType: v }))}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-zinc-300">Comment</Label>
                <Textarea
                  className="text-sm mt-1"
                  rows={3}
                  value={editForm.comment}
                  onChange={(e) => setEditForm((f) => ({ ...f, comment: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button type="button" variant="outline" className="h-9 text-sm" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm"
                disabled={editMutation.isPending || !editForm.companyName.trim() || !editForm.personName.trim() || !(parseFloat(editForm.amount) > 0)}
                onClick={() => editMutation.mutate({ id: editTarget.id, data: editForm })}
              >
                {editMutation.isPending ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
