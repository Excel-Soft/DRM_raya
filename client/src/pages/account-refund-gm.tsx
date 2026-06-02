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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, ChevronDown } from "lucide-react";
import type { RefundGmEntry } from "@shared/schema";

type Customer = { id: string; company_name: string; drm_id?: string; person_name?: string };
type User = { id: string; full_name: string; email: string; role: string };

export default function AccountRefundGm() {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const companyRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const rowsPerPage = 10;

  const [formData, setFormData] = useState({
    companyName: "",
    amount: "0.0",
    amountType: "Pkr",
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

  // ── Real customers from DB ────────────────────────────────────
  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/account/customers-list"],
    staleTime: 60_000,
  });

  // ── Real users from DB (for Person dropdown) ─────────────────
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/account/users-list"],
    staleTime: 60_000,
  });

  // Filter customers by search text
  const filteredCustomers = companySearch.trim()
    ? allCustomers.filter(
      (c) =>
        c.company_name?.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.drm_id?.toLowerCase().includes(companySearch.toLowerCase())
    )
    : allCustomers;

  // ── Refund entries ────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery<RefundGmEntry[]>({
    queryKey: ["/api/account/refund-gm"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) =>
      apiRequest("POST", "/api/account/refund-gm", {
        companyName: data.companyName,
        personName: data.personName,
        amount: data.amount,
        amountType: data.amountType,
        comment: data.comment || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/refund-gm"] });
      setFormData({ companyName: "", amount: "0.0", amountType: "Pkr", personName: "", comment: "" });
      setCompanySearch("");
      toast({ title: "Success", description: "Refund entry added successfully" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to add refund entry", variant: "destructive" }),
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

                {/* Company Name */}
                <div className="relative" ref={companyRef}>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Company Name</Label>
                  <div
                    className="relative flex items-center h-9 border border-gray-300 rounded bg-white cursor-pointer px-3 dark:bg-zinc-900 dark:border-zinc-800"
                    onClick={() => setShowCompanyDropdown((v) => !v)}
                  >
                    <span className={`flex-1 text-sm truncate ${formData.companyName ? "text-gray-800 dark:text-slate-200" : "text-gray-400"}`}>
                      {formData.companyName || "Search Company Through Id/Name"}
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
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.slice(0, 100).map((c, idx) => (
                            <div
                              key={c.id}
                              className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 hover:bg-green-50 ${idx === 0 && !companySearch ? "bg-green-600 text-white hover:bg-green-700" : ""}`}
                              onClick={() => {
                                setFormData((f) => ({ ...f, companyName: c.company_name }));
                                setCompanySearch("");
                                setShowCompanyDropdown(false);
                              }}
                            >
                              <span className={`font-semibold text-xs ${idx === 0 && !companySearch ? "text-white" : "text-green-700"}`}>
                                {c.drm_id || c.id?.substring(0, 8)}
                              </span>
                              <span className="truncate">{c.company_name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-sm text-gray-400 text-center">No companies found</div>
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
                      <SelectItem value="Pkr">Pkr</SelectItem>
                      <SelectItem value="Dollar">Dollar</SelectItem>
                      <SelectItem value="Euro">Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Person — real users dropdown */}
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block dark:text-zinc-300">Person:</Label>
                  <Select
                    value={formData.personName}
                    onValueChange={(v) => setFormData((f) => ({ ...f, personName: v }))}
                  >
                    <SelectTrigger className="h-9 text-sm border-gray-300 dark:border-zinc-800">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {allUsers.map((u) => (
                        <SelectItem key={u.id} value={u.full_name}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-20 dark:text-zinc-400">Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-700 w-16 dark:text-zinc-400">Action</th>
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
                          <span className="text-gray-500 text-xs dark:text-zinc-400">{entry.status || "pending"}</span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => deleteMutation.mutate(entry.id)}
                            disabled={deleteMutation.isPending}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
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
    </div>
  );
}
