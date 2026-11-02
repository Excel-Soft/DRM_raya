import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, extractApiError, mutationRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── Types ─────────────────────────────────────────────────────────────
interface TempGmEntry {
  id: string;
  company_name: string;
  person_name: string;
  amount: string;
  amount_type: string;
  reason: string;
  comment: string | null;
  status: string;
  createdAt: string;
}

interface Customer {
  id: string;
  company_name: string;
  person_name: string | null;
  drm_id: string | null;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const REASONS = [
  "leads transfer issue",
  "company is not registered yet",
  "wrong info added by the Sales",
  "gm not add by the Sales",
];

const formSchema = z.object({
  companyName: z.string().min(1, "Required"),
  personName: z.string().min(1, "Required"),
  amount: z.string().min(1, "Required"),
  amountType: z.string().min(1, "Required"),
  reason: z.string().min(1, "Select a reason"),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Component ──────────────────────────────────────────────────────────
export default function AccountTempGm() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TempGmEntry | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const pageSize = 10;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: "",
      personName: "",
      amount: "",
      amountType: "PKR",
      reason: "",
      comment: "",
    },
  });

  const watchedCompany = form.watch("companyName");

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery<TempGmEntry[]>({
    queryKey: ["/api/account/temp-gm"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/account/customers-list"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/account/users-list"],
  });

  const { data: eligibility } = useQuery<{
    canAddTempGm: boolean;
    hasActiveGm: boolean;
    hasBlockingTempGm: boolean;
  }>({
    queryKey: ["/api/account/temp-gm/eligibility", watchedCompany],
    queryFn: async () => {
      const q = encodeURIComponent(watchedCompany.trim());
      const res = await apiRequest("GET", `/api/account/temp-gm/eligibility?companyName=${q}`);
      const body = await res.json();
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    enabled: !!watchedCompany?.trim(),
  });

  // ── Filtered customers for autocomplete ─────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!companySearch.trim()) return customers.slice(0, 20);
    const q = companySearch.toLowerCase();
    return customers
      .filter(c =>
        c.company_name?.toLowerCase().includes(q) ||
        c.drm_id?.toLowerCase().includes(q) ||
        c.person_name?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [companySearch, customers]);

  // ── Mutations ────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: FormValues) => mutationRequest("POST", "/api/account/temp-gm", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/temp-gm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/temp-gm/eligibility"] });
      queryClient.invalidateQueries({ queryKey: ["hod-verification-temp-gm"] });
      form.reset({ companyName: "", personName: "", amount: "", amountType: "PKR", reason: "", comment: "" });
      setCompanySearch("");
      setShowForm(false);
      toast({ title: "✅ Success", description: "Entry submitted successfully" });
    },
    onError: (err: Error) =>
      toast({ title: "Cannot add Temp GM", description: err.message || "Failed to submit", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteReason: reason }: { id: string; deleteReason: string }) =>
      mutationRequest("DELETE", `/api/account/temp-gm/${id}`, { deleteReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/temp-gm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/temp-gm/eligibility"] });
      setDeleteTarget(null);
      setDeleteReason("");
      toast({ title: "Deleted", description: "Temp GM removed (soft delete)" });
    },
    onError: (err: Error) =>
      toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────
  const totalAmount = entries.reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
  const totalPages = Math.ceil(entries.length / pageSize);
  const pageEntries = entries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const onSubmit = (data: FormValues) => {
    if (eligibility && !eligibility.canAddTempGm) {
      toast({
        title: "Cannot add Temp GM",
        description: eligibility.hasActiveGm
          ? "This company already has a GM (Full, Loan, or Partial)."
          : "This company already has an active Temp GM.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  };

  const canSubmitTempGm = !eligibility || eligibility.canAddTempGm;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="px-5 pt-4 pb-6">

        {/* ── Page Title ── */}
        <div className="mb-4">
          <h1 className="text-[15px] font-bold text-gray-800 dark:text-zinc-100">
            TEMPORARY GM /{" "}
            <button
              onClick={() => setShowForm(f => !f)}
              className="text-green-600 hover:text-green-800 underline-offset-2 hover:underline transition-colors focus:outline-none"
            >
              ADD TEMPORARY GM {showForm ? "▲" : "▼"}
            </button>
          </h1>
        </div>

        {/* ── Form Panel (toggle) ── */}
        {showForm && (
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="border border-gray-200 rounded p-4 bg-white mb-5 dark:bg-zinc-900 dark:border-zinc-800">

              {/* Row 1 — 4 fields */}
              <div className="grid grid-cols-4 gap-3 mb-3">

                {/* Company — searchable autocomplete */}
                <div className="relative">
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 dark:text-zinc-300">Company Name</label>
                  <div className="relative">
                    <input
                      value={companySearch}
                      onChange={e => {
                        setCompanySearch(e.target.value);
                        form.setValue("companyName", e.target.value);
                        setShowCompanyDropdown(true);
                      }}
                      onFocus={() => setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                      placeholder="Search by Company / DRM ID"
                      className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 pr-6 text-gray-700 focus:outline-none focus:border-green-500 dark:border-zinc-800 dark:text-zinc-400"
                    />
                    <Search className="absolute right-1.5 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
                  </div>
                  {showCompanyDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto dark:bg-zinc-900 dark:border-zinc-800">
                      {filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            const label = c.company_name + (c.drm_id ? ` (${c.drm_id})` : "");
                            setCompanySearch(label);
                            form.setValue("companyName", c.company_name);
                            // Auto-fill person if available
                            if (c.person_name) form.setValue("personName", c.person_name);
                            setShowCompanyDropdown(false);
                          }}
                          className="px-2 py-1.5 text-[11px] cursor-pointer hover:bg-green-50 border-b border-gray-50 dark:border-zinc-800"
                        >
                          <span className="font-medium text-gray-800 dark:text-zinc-100">{c.company_name}</span>
                          {c.drm_id && <span className="text-gray-400 ml-1">({c.drm_id})</span>}
                          {c.person_name && <span className="text-gray-500 ml-1 dark:text-zinc-400">• {c.person_name}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.formState.errors.companyName && (
                    <p className="text-[10px] text-red-500 mt-0.5">{form.formState.errors.companyName.message}</p>
                  )}
                  {watchedCompany?.trim() && eligibility && !eligibility.canAddTempGm && (
                    <p className="text-[10px] text-red-600 mt-1">
                      {eligibility.hasActiveGm
                        ? "This company already has a GM. Temp GM is not allowed."
                        : "An active Temp GM already exists for this company."}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 dark:text-zinc-300">Amount:</label>
                  <input
                    {...form.register("amount")}
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:border-green-500 dark:border-zinc-800 dark:text-zinc-400"
                  />
                </div>

                {/* Amount Type */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 dark:text-zinc-300">Amount Type:</label>
                  <select
                    {...form.register("amountType")}
                    className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:border-green-500 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="PKR">PKR</option>
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                {/* Person — real users from DB */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1 dark:text-zinc-300">Person:</label>
                  <select
                    {...form.register("personName")}
                    className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:border-green-500 bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                  >
                    <option value="">Choose...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.full_name}>{u.full_name}</option>
                    ))}
                  </select>
                  {form.formState.errors.personName && (
                    <p className="text-[10px] text-red-500 mt-0.5">{form.formState.errors.personName.message}</p>
                  )}
                </div>
              </div>

              {/* Row 2 — Reason radio buttons */}
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1.5 dark:text-zinc-300">Reason:</label>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        value={r}
                        {...form.register("reason")}
                        className="accent-green-600 w-3 h-3"
                      />
                      <span className="text-[11px] text-gray-700 dark:text-zinc-400">{r}</span>
                    </label>
                  ))}
                </div>
                {form.formState.errors.reason && (
                  <p className="text-[10px] text-red-500 mt-0.5">{form.formState.errors.reason.message}</p>
                )}
              </div>

              {/* Row 3 — Comment */}
              <div className="mb-3">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1 dark:text-zinc-300">Comment:</label>
                <textarea
                  {...form.register("comment")}
                  placeholder="add detail"
                  rows={3}
                  className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 text-gray-700 focus:outline-none focus:border-green-500 resize-none dark:border-zinc-800 dark:text-zinc-400"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={createMutation.isPending || !canSubmitTempGm}
                className="bg-green-600 hover:bg-green-700 text-white text-[12px] font-semibold px-5 py-1.5 rounded transition-colors disabled:opacity-60"
              >
                {createMutation.isPending ? "Submitting..." : "Submit"}
              </button>
            </div>
          </form>
        )}

        {/* ── Entries Table ── */}
        <div className="border border-gray-200 rounded overflow-x-auto dark:border-zinc-800">
          {isLoading ? (
            <div className="flex justify-center items-center h-20 text-gray-500 text-sm dark:text-zinc-400">Loading...</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 dark:bg-zinc-900 dark:border-zinc-800">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">No#</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Company</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Person</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Reason</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Comment</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap dark:text-zinc-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400 text-[11px]">
                      No entries yet. Click "ADD TEMPORARY GM" above to submit one.
                    </td>
                  </tr>
                ) : (
                  <>
                    {pageEntries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800"
                      >
                        <td className="px-3 py-2">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-zinc-400">
                          {entry.createdAt ? format(new Date(entry.createdAt), "dd MMM yyyy hh:mm aa") : "-"}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-zinc-100">{entry.company_name}</td>
                        <td className="px-3 py-2 text-blue-600">{entry.person_name}</td>
                        <td className="px-3 py-2">{parseFloat(entry.amount || "0").toLocaleString()}</td>
                        <td className="px-3 py-2">{entry.reason}</td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={entry.comment || ""}>{entry.comment || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${entry.status === "approved" ? "bg-green-100 text-green-700" :
                              entry.status === "rejected" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                            }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(entry);
                              setDeleteReason("");
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            title="Soft delete with reason"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="border-t border-gray-200 bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                      <td colSpan={4} className="px-3 py-2 font-bold text-gray-700 dark:text-zinc-400">Total</td>
                      <td className="px-3 py-2 font-bold text-gray-700 dark:text-zinc-400">
                        {totalAmount.toLocaleString()}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {entries.length > pageSize && (
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-gray-500 dark:text-zinc-400">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, entries.length)} of {entries.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="text-[11px] px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >Previous</button>
              <span className="text-[11px] px-2 py-1 text-gray-500 dark:text-zinc-400">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="text-[11px] px-2 py-1 border rounded disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >Next</button>
            </div>
          </div>
        )}

        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg max-w-md w-full p-4 border dark:border-zinc-800">
              <h2 className="text-sm font-bold text-gray-800 dark:text-zinc-100 mb-2">Delete Temp GM</h2>
              <p className="text-[11px] text-gray-600 dark:text-zinc-400 mb-3">
                Company: <strong>{deleteTarget.company_name}</strong>. After delete, sales can add GM from the pool for this company.
              </p>
              <label className="block text-[11px] font-semibold text-gray-600 dark:text-zinc-300 mb-1">Reason (required)</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
                className="w-full text-[11px] border border-gray-300 rounded px-2 py-1.5 mb-3 dark:border-zinc-800"
                placeholder="Why is this Temp GM being removed?"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeleteReason(""); }}
                  className="text-[11px] px-3 py-1.5 border rounded dark:border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteReason.trim().length < 3 || deleteMutation.isPending}
                  onClick={() =>
                    deleteMutation.mutate({ id: deleteTarget.id, deleteReason: deleteReason.trim() })
                  }
                  className="text-[11px] px-3 py-1.5 bg-red-600 text-white rounded disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Confirm delete"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
