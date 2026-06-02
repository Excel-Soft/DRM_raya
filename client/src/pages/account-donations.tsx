import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Donation } from "@shared/schema";

const TITLE_OPTIONS = ["Mr.", "Ms.", "Mrs.", "Dr.", "Prof.", "Engr."];

export default function AccountDonations() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [formData, setFormData] = useState({
    companyName: "",
    title: "Mr.",
    personName: "",
    amount: "",
    currency: "PKR",
    comment: "",
  });

  const { data: donations = [], isLoading } = useQuery<Donation[]>({
    queryKey: ["/api/account/donations"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) =>
      apiRequest("POST", "/api/account/donations", {
        companyName: data.companyName,
        title: data.title,
        personName: data.personName,
        amount: data.amount,
        currency: data.currency,
        comment: data.comment || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/donations"] });
      setDialogOpen(false);
      setFormData({ companyName: "", title: "Mr.", personName: "", amount: "", currency: "PKR", comment: "" });
      toast({ title: "Success", description: "Donation added successfully" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to add donation", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/account/donations/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/donations"] });
      toast({ title: "Deleted", description: "Donation has been deleted" });
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to delete donation", variant: "destructive" }),
  });

  const filteredDonations = useMemo(() => {
    if (!searchQuery) return donations;
    const q = searchQuery.toLowerCase();
    return donations.filter(
      (d) =>
        (d.personName || "").toLowerCase().includes(q) ||
        (d.companyName || "").toLowerCase().includes(q) ||
        (d.comment || "").toLowerCase().includes(q)
    );
  }, [donations, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredDonations.length / rowsPerPage));
  const paginatedDonations = filteredDonations.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.personName || !formData.amount) {
      toast({ title: "Validation Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-3 dark:bg-zinc-900">
        <h1 className="text-base font-bold tracking-wide text-gray-800 dark:text-zinc-100" style={{ letterSpacing: "0.04em" }}>
          YOUR DONATION HEAD HISTORY
        </h1>
      </div>

      <div className="p-4">
        {/* ─── Add Donation Button ─────────────────────────────── */}
        <div className="mb-4">
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-5 text-sm font-medium rounded"
            data-testid="button-add-donation"
          >
            Add Donation
          </Button>
        </div>

        {/* ─── Table Card ──────────────────────────────────────── */}
        <div className="bg-white rounded border border-gray-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          {/* Show entries + Search */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
              <span>Show</span>
              <select
                className="border border-gray-300 rounded px-2 py-1 text-sm dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
              <span>Search:</span>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1 text-sm w-44 focus:outline-none focus:border-green-500 dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-100"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 dark:border-zinc-800 dark:bg-zinc-900">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-12 dark:text-zinc-400">No#</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-zinc-400">Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-28 dark:text-zinc-400">Amount</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-zinc-400">Detail</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-28 dark:text-zinc-400">Create</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-700 w-20 dark:text-zinc-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDonations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">
                        {searchQuery ? "No donations found" : "No donations yet"}
                      </td>
                    </tr>
                  ) : (
                    paginatedDonations.map((donation, idx) => (
                      <tr
                        key={donation.id}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800"
                        data-testid={`row-donation-${donation.id}`}
                      >
                        <td className="px-4 py-2 text-gray-700 dark:text-zinc-400">
                          {(currentPage - 1) * rowsPerPage + idx + 1}
                        </td>
                        <td className="px-4 py-2 text-blue-600 cursor-pointer hover:underline" data-testid={`text-person-${donation.id}`}>
                          {donation.title ? `${donation.title} ` : ""}{donation.personName}
                        </td>
                        <td className="px-4 py-2 text-gray-800 dark:text-zinc-100">
                          {parseFloat(donation.amount || "0").toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-blue-600">
                          {donation.comment || ""}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-zinc-300">
                          {donation.createdAt
                            ? format(new Date(donation.createdAt), "dd-MM-yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => deleteMutation.mutate(donation.id)}
                            disabled={deleteMutation.isPending}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                            data-testid={`button-delete-${donation.id}`}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredDonations.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                Showing {filteredDonations.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–
                {Math.min(currentPage * rowsPerPage, filteredDonations.length)} of {filteredDonations.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  data-testid="button-prev-page"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-xs bg-green-600 text-white rounded">
                  {currentPage}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  data-testid="button-next-page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Add Donation Dialog ─────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Donation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 dark:text-zinc-300">Title</Label>
                <Select value={formData.title} onValueChange={(v) => setFormData((f) => ({ ...f, title: v }))}>
                  <SelectTrigger className="h-9 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TITLE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-zinc-300">Person Name *</Label>
                <Input
                  className="h-9 text-sm mt-1"
                  placeholder="Enter name"
                  value={formData.personName}
                  onChange={(e) => setFormData((f) => ({ ...f, personName: e.target.value }))}
                  data-testid="input-person-name"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-zinc-300">Company Name</Label>
              <Input
                className="h-9 text-sm mt-1"
                placeholder="Enter company name"
                value={formData.companyName}
                onChange={(e) => setFormData((f) => ({ ...f, companyName: e.target.value }))}
                data-testid="input-company"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 dark:text-zinc-300">Amount *</Label>
                <Input
                  className="h-9 text-sm mt-1"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                  data-testid="input-amount"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 dark:text-zinc-300">Currency</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-9 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR</SelectItem>
                    <SelectItem value="Dollar">Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600 dark:text-zinc-300">Detail / Comment</Label>
              <Textarea
                className="text-sm mt-1"
                placeholder="Add detail..."
                value={formData.comment}
                onChange={(e) => setFormData((f) => ({ ...f, comment: e.target.value }))}
                rows={2}
                data-testid="textarea-comment"
              />
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-sm" data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white h-9 text-sm" data-testid="button-submit">
                {createMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
