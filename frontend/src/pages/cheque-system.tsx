import { memo, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Loader2 } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiRequestJson, queryClient, getAuthHeader } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Cheque } from "@shared/schema";

const PAGE_SIZE = 20;
const ASKARI_LOGO = "/askari-logo.jpg";

// Status labels used across the page (legacy: Un-used / Used).
const STATUS_LABEL: Record<string, string> = {
  Pending: "Un-used",
  Cleared: "Used",
  Bounced: "Bounced",
  Cancelled: "Cancelled",
};
const STATUS_TABS = ["all", "Pending", "Cleared", "Bounced", "Cancelled"] as const;

// "Closing" is the old-DRM name; kept so old cheques can still be matched/filtered.
const CHEQUE_TYPES = ["For Dollar", "For Expense", "Recovery", "Closing", "Last Closing", "Direct Purchase"];

function numberToWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return "";
  const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
    if (n < 1_000_000) return convert(Math.floor(n / 1000)) + " thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
    if (n < 1_000_000_000) return convert(Math.floor(n / 1_000_000)) + " million" + (n % 1_000_000 !== 0 ? " " + convert(n % 1_000_000) : "");
    return convert(Math.floor(n / 1_000_000_000)) + " billion" + (n % 1_000_000_000 !== 0 ? " " + convert(n % 1_000_000_000) : "");
  };
  return convert(Math.floor(num)) + " only";
}

const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Old cheque numbers were stored with spaces ("0 0 0 0 0 0 8 5"); keep digits only. */
function chequeDigitsOf(raw: string | null | undefined): string[] {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.padStart(8, "0").slice(-Math.max(8, digits.length)).split("");
}

function dateDigitsOf(raw: unknown): string[] | null {
  const d = raw ? new Date(raw as any) : null;
  if (!d || isNaN(d.getTime())) return null;
  return format(d, "ddMMyyyy").split("");
}

interface ChequeCardProps {
  cheque: Cheque;
  onStatusChange: (id: string, status: string) => void;
  statusPending: boolean;
}

/** One Askari Bank cheque leaf. Memoised; off-screen cards skip layout/paint (content-visibility). */
const ChequeCard = memo(function ChequeCard({ cheque, onStatusChange, statusPending }: ChequeCardProps) {
  const amount = parseFloat(String(cheque.amount ?? "0")) || 0;
  const words = numberToWords(amount);
  const dateDigits = dateDigitsOf(cheque.chequeDate);
  const isUnused = cheque.status === "Pending";

  return (
    <div
      className="relative w-full max-w-[880px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 340px" } as React.CSSProperties}
    >
      {/* Type ribbon */}
      {cheque.chequeType && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-28 w-28 overflow-hidden">
          <div className="absolute -left-12 top-6 w-52 -rotate-45 border-y border-sky-200 bg-[#d0eaf9] py-1 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#0f5c9c] shadow-sm">
            {cheque.chequeType}
          </div>
        </div>
      )}

      {/* Top half */}
      <div className="px-6 pb-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pl-12">
          <img
            src={ASKARI_LOGO}
            alt="Askari Bank Limited"
            loading="lazy"
            decoding="async"
            width={250}
            height={64}
            className="h-14 w-auto select-none object-contain"
            draggable={false}
          />
          <div className="flex items-center gap-3">
            <span className="text-right text-xs font-bold leading-tight text-slate-400">Cheque<br />No</span>
            <div className="flex gap-0.5 rounded-sm bg-[#d0eaf9] px-2 py-1.5">
              {chequeDigitsOf(cheque.chequeNumber).map((digit, i) => (
                <span key={i} className="w-[18px] text-center font-mono text-[17px] font-semibold text-slate-800">{digit}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="text-[12px] font-medium uppercase leading-[1.35] text-slate-700 dark:text-zinc-300">
            <strong className="text-[13px]">ASKARI BANK LIMITED</strong>
            <br />
            IBB DHA KARACHI JAMI COMMERCIAL PHASE VII DHA KHI
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">Date</span>
            {dateDigits ? (
              <div className="flex gap-0.5">
                {dateDigits.map((digit, i) => (
                  <span
                    key={i}
                    className={cn(
                      "flex h-7 w-[18px] items-center justify-center border border-slate-300 bg-white font-mono text-[15px] text-slate-800",
                      (i === 2 || i === 4) && "ml-1.5",
                    )}
                  >
                    {digit}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom half */}
      <div className="bg-[#d0eaf9] px-6 pb-4 pt-5 dark:bg-sky-950/40">
        <div className="mb-4 flex items-end">
          <span className="w-16 shrink-0 text-sm font-bold text-slate-500">Pay</span>
          <div className="min-w-0 flex-1 border-b border-slate-400 pb-0.5">
            <span className="block truncate pl-2 text-[15px] font-medium uppercase text-slate-800 dark:text-zinc-100" title={cheque.companyName}>
              {cheque.companyName}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-end">
              <span className="w-16 shrink-0 text-sm font-bold text-slate-500">Rupees</span>
              <div className="min-w-0 flex-1 border-b border-slate-400 pb-0.5">
                <span className="block pl-2 text-[14px] capitalize leading-snug text-slate-800 dark:text-zinc-100">{words || "—"}</span>
              </div>
            </div>
          </div>
          <div className="flex h-[40px] w-full shrink-0 items-center gap-2 border-2 border-slate-500 bg-white/60 px-3 md:w-[230px] dark:bg-zinc-900/60">
            <span className="text-sm font-bold text-slate-500">PKR</span>
            <span className="text-[17px] font-bold text-slate-900 dark:text-zinc-100">{amount.toLocaleString("en-US")}/-</span>
          </div>
        </div>

        {cheque.notes && (
          <p className="mt-3 line-clamp-2 text-[12px] italic text-slate-600 dark:text-zinc-400" title={cheque.notes}>
            Note: {cheque.notes}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold text-slate-400">Please do not write below this line</span>
            <Select value={cheque.status} onValueChange={(v) => onStatusChange(cheque.id, v)} disabled={statusPending}>
              <SelectTrigger
                className={cn(
                  "h-7 w-36 px-2 text-[11px] font-semibold",
                  isUnused ? "border-red-200 bg-red-50 text-red-600" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-56 pt-1 text-center">
            <div className="border-t border-slate-400" />
            <span className="mt-0.5 block text-[12px] text-slate-400">Signature</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function ChequeSystem() {
  const { toast } = useToast();

  const [chequeDigits, setChequeDigits] = useState<string[]>(Array(8).fill(""));
  const [formData, setFormData] = useState({
    companyName: "",
    amount: "",
    chequeDate: "",
    notes: "",
    chequeType: "",
  });
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: cheques = [], isLoading } = useQuery<Cheque[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: () => fetch(`/api/office/cheques`, { headers: getAuthHeader(), credentials: "include" }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/office/cheques", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/cheques"] });
      setFormData({ companyName: "", amount: "", chequeDate: "", notes: "", chequeType: "" });
      setChequeDigits(Array(8).fill(""));
      setStatusFilter("all");
      setPage(1);
      toast({ title: "Success", description: "Cheque added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add cheque", variant: "destructive" });
    },
  });

  // Marks a cheque used/unused (and Bounced/Cancelled) — PATCH /api/office/cheques/:id/status.
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequestJson("PATCH", `/api/office/cheques/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/office/cheques"] });
      toast({ title: "Updated", description: "Cheque status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Could not update status", description: err?.message || "Failed to update cheque status", variant: "destructive" });
    },
  });

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...chequeDigits];
    next[index] = digit;
    setChequeDigits(next);
    if (digit && index < 7) (document.getElementById(`cheque-digit-${index + 1}`) as HTMLInputElement | null)?.focus();
  };
  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chequeDigits[index] && index > 0) {
      (document.getElementById(`cheque-digit-${index - 1}`) as HTMLInputElement | null)?.focus();
    }
  };

  const handleSubmit = () => {
    const chequeNumber = chequeDigits.join("");
    if (!chequeNumber || !formData.amount || !formData.companyName || !formData.chequeDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    // Askari Bank cheque UI -> bank name is fixed.
    createMutation.mutate({ ...formData, chequeNumber, bankName: "Askari Bank", currency: "PKR" });
  };

  const chequesList = Array.isArray(cheques) ? cheques : [];

  const totals = useMemo(() => {
    let unused = 0, used = 0, unusedCount = 0, usedCount = 0;
    const counts: Record<string, number> = { all: chequesList.length };
    for (const c of chequesList) {
      const amt = parseFloat(String(c.amount ?? "0")) || 0;
      counts[c.status] = (counts[c.status] ?? 0) + 1;
      if (c.status === "Pending") { unused += amt; unusedCount++; } else { used += amt; usedCount++; }
    }
    return { unused, used, unusedCount, usedCount, counts };
  }, [chequesList]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return chequesList.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      if (`${c.companyName ?? ""} ${c.chequeType ?? ""} ${c.notes ?? ""}`.toLowerCase().includes(q)) return true;
      return !!qDigits && String(c.chequeNumber ?? "").replace(/\D/g, "").includes(qDigits);
    });
  }, [chequesList, statusFilter, search]);

  useEffect(() => setPage(1), [statusFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const pageButtons: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1) pageButtons.push(n);
    else if (pageButtons[pageButtons.length - 1] !== "gap") pageButtons.push("gap");
  }
  const goToPage = (n: number) => {
    setPage(n);
    document.getElementById("cheque-list-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onStatusChange = (id: string, status: string) => statusMutation.mutate({ id, status });

  return (
    <ScrollArea className="h-full flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="p-4 md:p-6">
        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-red-100 bg-white p-4 shadow-sm dark:border-red-900/40 dark:bg-zinc-900">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Create Cheque Un-used PKR</p>
            <p className="mt-1 text-xl font-bold text-red-500">{fmtPkr(totals.unused)}</p>
            <p className="text-[11px] text-slate-400">{totals.unusedCount} cheques</p>
          </div>
          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-900">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cheque Used PKR</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{fmtPkr(totals.used)}</p>
            <p className="text-[11px] text-slate-400">{totals.usedCount} cheques</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Cheques</p>
            <p className="mt-1 text-xl font-bold text-slate-800 dark:text-zinc-100">{chequesList.length.toLocaleString()}</p>
            <p className="text-[11px] text-slate-400">PKR {fmtPkr(totals.unused + totals.used)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Left: form */}
          <div className="w-full flex-shrink-0 lg:sticky lg:top-4 lg:w-[380px] lg:self-start">
            <div className="rounded-md border border-slate-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <img src={ASKARI_LOGO} alt="Askari Bank" className="mb-3 h-9 w-auto object-contain" decoding="async" />
              <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-300">New Cheque</h2>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Payee Name:</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Amount:</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                  {Number(formData.amount) > 0 && (
                    <p className="text-[11px] capitalize text-slate-500">{numberToWords(Number(formData.amount))}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Cheque Number:</Label>
                  <div className="flex justify-between gap-1">
                    {chequeDigits.map((digit, i) => (
                      <Input
                        key={i}
                        id={`cheque-digit-${i}`}
                        value={digit}
                        inputMode="numeric"
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                        className="h-10 w-full p-0 text-center text-lg font-medium focus-visible:ring-1 focus-visible:ring-emerald-500"
                        maxLength={1}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Cheque Date:</Label>
                  <Input
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                    className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Type</Label>
                  <Select value={formData.chequeType} onValueChange={(v) => setFormData({ ...formData, chequeType: v })}>
                    <SelectTrigger className="h-9 focus-visible:ring-1 focus-visible:ring-emerald-500">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CHEQUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-normal text-slate-500">Comments:</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Enter comment"
                    className="h-20 resize-none focus-visible:ring-1 focus-visible:ring-emerald-500"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                  className="mt-2 h-10 w-full bg-[#00a65a] text-white hover:bg-[#008d4c]"
                >
                  {createMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          </div>

          {/* Right: cheque list */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div id="cheque-list-top" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap gap-1">
                {STATUS_TABS.map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? "default" : "outline"}
                    className={cn("h-8 text-xs", statusFilter === s && "bg-[#00a65a] hover:bg-[#008d4c]")}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "All" : STATUS_LABEL[s]}
                    <span className="ml-1.5 opacity-70">{totals.counts[s] ?? 0}</span>
                  </Button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search payee, cheque no, type..."
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
            ) : filtered.length === 0 ? (
              <div className="rounded-md border border-slate-100 bg-white p-8 text-center text-slate-500 dark:border-zinc-800 dark:bg-zinc-900">
                {chequesList.length === 0 ? "No cheques generated yet." : "No cheques match this filter."}
              </div>
            ) : (
              <>
                {pageRows.map((cheque) => (
                  <ChequeCard
                    key={cheque.id}
                    cheque={cheque}
                    onStatusChange={onStatusChange}
                    statusPending={statusMutation.isPending && statusMutation.variables?.id === cheque.id}
                  />
                ))}

                <div className="flex max-w-[880px] flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-white p-3 text-xs text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <span>
                    Showing {pageStart + 1} to {pageStart + pageRows.length} of {filtered.length.toLocaleString()} cheques
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>Previous</Button>
                    {pageButtons.map((n, i) =>
                      n === "gap" ? (
                        <span key={`gap-${i}`} className="flex h-8 items-center px-2">…</span>
                      ) : (
                        <Button
                          key={n}
                          size="sm"
                          variant={n === currentPage ? "default" : "outline"}
                          className={cn("h-8 min-w-8 px-2", n === currentPage && "bg-[#00a65a] hover:bg-[#008d4c]")}
                          onClick={() => goToPage(n)}
                        >
                          {n}
                        </Button>
                      ),
                    )}
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>Next</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
