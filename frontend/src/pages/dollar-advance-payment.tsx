import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiRequestJson, queryClient } from "@/lib/queryClient";

type Customer = { id: string; company_name: string; drm_id?: string; person_name?: string };

type BuyerAttributeRow = {
  id: string;
  category: string;
  name: string;
  parentId: string | null;
  email: string | null;
  phone: string | null;
};

type AdvancePaymentRecord = {
  id: string;
  company_name: string;
  buyer_name: string | null;
  buyer_reference: string | null;
  amount: string;
  remaining_amount: string;
  pay_date: string | null;
  comment: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

function formatDateDMY(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${dd}-${mm}-${d.getFullYear()} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
}

export default function DollarAdvancePayment() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);

  // ── Company search combobox ──
  const [companyName, setCompanyName] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/account/customers-list"],
    queryFn: () => apiRequestJson<Customer[]>("GET", "/api/account/customers-list"),
    staleTime: 60_000,
  });

  const filteredCustomers = companySearch.trim()
    ? allCustomers.filter(
        (c) =>
          c.company_name?.toLowerCase().includes(companySearch.toLowerCase()) ||
          c.drm_id?.toLowerCase().includes(companySearch.toLowerCase())
      )
    : allCustomers;

  // ── Buyer Name / Buyer Reference (Buyer Detail tree) ──
  const [buyerId, setBuyerId] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const buyerTreeQuery = useQuery<BuyerAttributeRow[]>({
    queryKey: ["/api/attributes", "Buyer Detail"],
    queryFn: () => apiRequestJson<BuyerAttributeRow[]>("GET", `/api/attributes/${encodeURIComponent("Buyer Detail")}`),
  });
  const buyerTree = buyerTreeQuery.data ?? [];
  const topBuyers = useMemo(() => buyerTree.filter((r) => !r.parentId), [buyerTree]);
  const buyerReferences = useMemo(() => buyerTree.filter((r) => r.parentId === buyerId), [buyerTree, buyerId]);
  const selectedBuyerNode = topBuyers.find((b) => b.id === buyerId) ?? null;
  const selectedReferenceNode = buyerReferences.find((r) => r.id === referenceId) ?? null;

  // ── Amount / Date / Comment ──
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [comment, setComment] = useState("");

  const entriesQuery = useQuery<AdvancePaymentRecord[]>({
    queryKey: ["/api/account/advance-payments"],
    queryFn: () => apiRequestJson<AdvancePaymentRecord[]>("GET", "/api/account/advance-payments"),
  });
  const entries = entriesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyName) throw new Error("Choose a company");
      if (!amount || Number(amount) <= 0) throw new Error("Amount is required");

      return apiRequestJson("POST", "/api/account/advance-payments", {
        companyName,
        buyerName: selectedBuyerNode?.name ?? null,
        buyerReference: selectedReferenceNode?.name ?? null,
        amount: Number(amount).toFixed(2),
        payDate: payDate || undefined,
        comment: comment || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/advance-payments"] });
      toast({ title: "Advance payment added" });
      setCompanyName("");
      setBuyerId("");
      setReferenceId("");
      setAmount("");
      setPayDate("");
      setComment("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add advance payment", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/account/advance-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/advance-payments"] });
      toast({ title: "Deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
    },
  });

  const totalAmount = entries.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalRemaining = entries.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="wide-page p-4 sm:p-6 space-y-4">
        <h1 className="text-base font-bold tracking-wide">
          <span className="text-foreground">ADVANCE PAY</span>
          <span
            className="text-emerald-600 cursor-pointer hover:text-emerald-700 hover:underline select-none transition-colors"
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) {
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }
            }}
            title={showForm ? "Click to hide form" : "Click to add a dollar payment"}
          >
            {" / ADD DOLLAR PAYMENT"}
          </span>
        </h1>

        {showForm && (
          <div ref={formRef} className="bg-card border border-border rounded-lg p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Company Name */}
              <div className="relative" ref={companyRef}>
                <label className="text-[12px] font-bold text-muted-foreground">Company Name</label>
                <div
                  className="relative flex items-center h-10 border border-border rounded-md bg-background cursor-pointer px-3 mt-1.5"
                  onClick={() => setShowCompanyDropdown((v) => !v)}
                >
                  <span className={`flex-1 text-[13px] truncate ${companyName ? "text-foreground" : "text-muted-foreground"}`}>
                    {companyName || "Search Company Through Id/Name"}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 ml-1 transition-transform ${showCompanyDropdown ? "rotate-180" : ""}`} />
                </div>

                {showCompanyDropdown && (
                  <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg mt-1 max-h-64 flex flex-col">
                    <div className="p-2 border-b border-border">
                      <input
                        autoFocus
                        className="w-full text-[13px] border border-border rounded px-2 py-1 outline-none focus:border-emerald-500 bg-background"
                        placeholder="Type to search..."
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                      />
                    </div>
                    <div className="overflow-auto flex-1">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.slice(0, 100).map((c) => (
                          <div
                            key={c.id}
                            className="px-3 py-2 text-[13px] cursor-pointer flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            onClick={() => {
                              setCompanyName(c.company_name);
                              setCompanySearch("");
                              setShowCompanyDropdown(false);
                            }}
                          >
                            <span className="font-semibold text-xs text-emerald-700">{c.drm_id || c.id?.substring(0, 8)}</span>
                            <span className="truncate">{c.company_name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-[13px] text-muted-foreground text-center">No companies found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Buyer Name */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Buyer Name</label>
                <Select value={buyerId} onValueChange={(v) => { setBuyerId(v); setReferenceId(""); }}>
                  <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {topBuyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Buyer Reference */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Buyer Reference</label>
                <Select value={referenceId} onValueChange={setReferenceId} disabled={!buyerId || buyerReferences.length === 0}>
                  <SelectTrigger className="h-10 text-[13px]">
                    <SelectValue placeholder={!buyerId ? "Select buyer first" : buyerReferences.length ? "Select" : "No references"} />
                  </SelectTrigger>
                  <SelectContent>
                    {buyerReferences.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Amount:</label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Pay Date</label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="h-10 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Comment:</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="add detail"
                  rows={1}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 h-10"
                />
              </div>
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-8"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Submit
            </Button>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-[11px] font-bold uppercase pl-6">No#</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Company</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Buyer</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Reference</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Amount</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Remaining</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Status</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase">Comment</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Create</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-16 text-muted-foreground text-[12px]">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {entries.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-6">{i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateDMY(r.pay_date)}</TableCell>
                        <TableCell className="font-semibold text-emerald-700 uppercase">{r.company_name}</TableCell>
                        <TableCell>{r.buyer_name || "-"}</TableCell>
                        <TableCell className="text-emerald-600">{r.buyer_reference || "-"}</TableCell>
                        <TableCell>{Number(r.amount).toLocaleString()}</TableCell>
                        <TableCell>{Number(r.remaining_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{r.status}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.comment || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TableCell>
                        <TableCell className="pr-6">
                          <button
                            onClick={() => deleteMutation.mutate(r.id)}
                            disabled={deleteMutation.isPending}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="pl-6 font-bold" colSpan={5}>Total</TableCell>
                      <TableCell className="font-bold">{totalAmount.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{totalRemaining.toLocaleString()}</TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
