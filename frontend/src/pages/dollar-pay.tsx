import { useEffect, useState } from "react";
import { useMutation, useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronRight, Eye, Loader2, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

// Port of the old DRM dollarpay.php page (func.php page_dollar_gm2 / page_dollar_gm_partial /
// payId_buyerDetail(2) / type_fillter_pay_ab / dollar_pay_ab_gm_id2_partial).

type Src = "legacy" | "modern";

type FullRow = {
  src: Src;
  payid: string;
  gmid: string | null;
  payDate: string | null;
  drmId: string | null;
  memberId: string | null;
  orderId: string | null;
  companyName: string | null;
  salePerson: string | null;
  dollars: number | null;
  dollarRate: number | null;
  package: string | null;
  type: string | null;
  payStatus: string | null;
  cusDollarRate: number | null;
  cusProfit: number | null;
  earningLabel: string;
  earningAmount: number | null;
};

type PartialRow = {
  src: Src;
  partialGmId: string;
  delayGmId: string | null;
  payDate: string | null;
  drmId: string | null;
  memberId: string | null;
  orderId: string | null;
  companyName: string | null;
  salePerson: string | null;
  currentDollarPay: number | null;
  currentDollarRate: number | null;
  abPayDollar: number | null;
  payDollarRate: number | null;
  dollarRate: number | null;
  package: string | null;
  payType: string | null;
  abConfirmStatus: string | null;
  cusDollarRate: number | null;
  cusProfit: number | null;
  earningLabel: string;
  earningAmount: number | null;
};

type PagedResponse<T> = {
  records: T[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  grandTotals?: { total_dollar: number; total_pkr: number };
};

type HistoryRow = {
  n: number;
  src: Src;
  id: string;
  payDate: string | null;
  drmId: string | null;
  memberId: string | null;
  orderId: string | null;
  companyName: string | null;
  person: string | null;
  dollars: number | null;
  dollarRate: number | null;
  abDisc: number | null;
  extraDisc: number | null;
  cusLabel: string;
  cusProfit: number;
  package: string | null;
  type: string | null;
  payStatus: string | null;
  earningLabel: string;
  earningAmount: number | null;
};

type HistoryResponse = {
  records: HistoryRow[];
  fetched: number;
  totals: { dollars: number; abDisc: number; extraDisc: number; profit: number; loss: number };
};

type Buyer = {
  buyer_main_name?: string;
  buyer_paypal_email?: string;
  dollarTotal?: string | number;
  dollarUse?: string | number;
  buyer_dollar_rate?: string | number;
};

type DetailTarget = {
  kind: "full" | "partial";
  id: string;
  src: Src;
  memberId: string | null;
  orderId: string | null;
  companyName: string | null;
  orderAmount: number | null;
  dollarRate: number | null;
  earningLabel: string;
  earningAmount: number | null;
};

const TYPE_OPTIONS = ["All", "New", "Renewal", "Expire"];
const PAY_STATUS_OPTIONS = ["All", "paid", "refund", "processing"];
const PAYMENT_TYPE_OPTIONS = ["All", "Profit", "Loss", "Equal"];
const AB_STATUS_OPTIONS = ["paid", "refund", "processing"];

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "-" : String(n));
const money = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "-" : n.toLocaleString(undefined, { maximumFractionDigits: digits });

function statusClass(s: string | null) {
  const v = (s || "").toLowerCase();
  if (v === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (v === "refund") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
}

function labelClass(label: string) {
  if (label === "Profit") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (label === "Loss") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
}

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${className}`}>{children}</span>;
}

function Earning({ label, amount }: { label: string; amount: number | null }) {
  return <Pill className={labelClass(label)}>{label}: $ {amount === null ? "-" : amount.toFixed(2)}</Pill>;
}

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-6 py-3 border-t text-xs text-muted-foreground">
      <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page <= 1} onClick={() => onPage(1)}>First</Button>
      <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="font-medium text-foreground">Page {page} of {totalPages}</span>
      <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      <Button type="button" variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>Last</Button>
    </div>
  );
}

const TH = "text-[11px] font-bold uppercase whitespace-nowrap";

export default function DollarPay() {
  const { toast } = useToast();

  // ── View History filter (type_fillter_pay_ab) ──
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [hType, setHType] = useState("All");
  const [hPayStatus, setHPayStatus] = useState("All");
  const [hPaymentType, setHPaymentType] = useState("All");
  const [hStart, setHStart] = useState("");
  const [hEnd, setHEnd] = useState("");
  const [historyFilters, setHistoryFilters] = useState<null | Record<string, string>>(null);

  const historyQuery = useQuery<HistoryResponse>({
    queryKey: ["/api/account/dollar-pay/history", historyFilters],
    queryFn: () => apiRequestJson<HistoryResponse>("POST", "/api/account/dollar-pay/history", historyFilters),
    enabled: !!historyFilters,
  });

  const handleViewHistory = () => {
    if (!hStart || !hEnd) {
      toast({ title: "Start Date and End Date are required", variant: "destructive" });
      return;
    }
    setHistoryFilters({ type: hType, paymentStatus: hPayStatus, paymentType: hPaymentType, startDate: hStart, endDate: hEnd });
  };

  // ── Full Payments To Paid (page_dollar_gm2) ──
  const [fullSearchInput, setFullSearchInput] = useState("");
  const fullSearch = useDebounced(fullSearchInput.trim());
  const [fullPage, setFullPage] = useState(1);
  useEffect(() => setFullPage(1), [fullSearch]);
  const fullQuery = useQuery<PagedResponse<FullRow>>({
    queryKey: ["/api/account/dollar-pay/full", fullPage, fullSearch],
    queryFn: () =>
      apiRequestJson<PagedResponse<FullRow>>(
        "GET",
        `/api/account/dollar-pay/full?${new URLSearchParams({ page: String(fullPage), search: fullSearch, pageSize: "20" })}`,
      ),
    placeholderData: keepPreviousData,
  });

  // ── Partial Payments To Paid (page_dollar_gm_partial) ──
  const [partialSearchInput, setPartialSearchInput] = useState("");
  const partialSearch = useDebounced(partialSearchInput.trim());
  const [partialPage, setPartialPage] = useState(1);
  useEffect(() => setPartialPage(1), [partialSearch]);
  const partialQuery = useQuery<PagedResponse<PartialRow>>({
    queryKey: ["/api/account/dollar-pay/partial", partialPage, partialSearch],
    queryFn: () =>
      apiRequestJson<PagedResponse<PartialRow>>(
        "GET",
        `/api/account/dollar-pay/partial?${new URLSearchParams({ page: String(partialPage), search: partialSearch })}`,
      ),
    placeholderData: keepPreviousData,
  });

  // ── View Details modal (payId_buyerDetail / payId_buyerDetail2) ──
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const buyersQuery = useQuery<{ buyers: Buyer[] }>({
    queryKey: ["/api/account/dollar-pay/buyers", detail?.kind, detail?.id, detail?.src],
    queryFn: () =>
      apiRequestJson<{ buyers: Buyer[] }>(
        "GET",
        `/api/account/dollar-pay/${detail!.kind}/${encodeURIComponent(detail!.id)}/buyers?src=${detail!.src}`,
      ),
    enabled: !!detail,
  });

  // ── Ab Payment Status modal (dollar_pay_ab_gm_id2_partial) ──
  const [editRow, setEditRow] = useState<PartialRow | null>(null);
  const [abStatus, setAbStatus] = useState("");
  const [abDate, setAbDate] = useState("");
  const [abNote, setAbNote] = useState("");
  const openEdit = (r: PartialRow) => {
    setEditRow(r);
    setAbStatus("");
    setAbDate("");
    setAbNote("");
  };
  const abMutation = useMutation({
    mutationFn: () =>
      apiRequestJson("POST", `/api/account/dollar-pay/partial/${encodeURIComponent(editRow!.partialGmId)}/ab-status`, {
        gmId: editRow!.delayGmId,
        status: abStatus,
        date: abDate || null,
        note: abNote || null,
      }),
    onSuccess: () => {
      toast({ title: "Ab payment status updated" });
      setEditRow(null);
      queryClient.invalidateQueries({ queryKey: ["/api/account/dollar-pay/partial"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/dollar-pay/full"] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message || "Please try again", variant: "destructive" }),
  });
  const submitAbStatus = () => {
    if (!abStatus) {
      toast({ title: "Choose an Ab Payment Status", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure to update ab paid status")) return;
    abMutation.mutate();
  };

  const full = fullQuery.data;
  const partial = partialQuery.data;
  const fullOffset = ((full?.page ?? fullPage) - 1) * (full?.pageSize ?? 0);
  const partialOffset = ((partial?.page ?? partialPage) - 1) * (partial?.pageSize ?? 0);
  const buyers = buyersQuery.data?.buyers ?? [];

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="wide-page p-4 sm:p-6 space-y-6">
        <nav className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">DOLLAR PAY</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setShowHistoryForm((v) => !v)}
            className={showHistoryForm ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}
            data-testid="toggle-view-history"
          >
            VIEW HISTORY
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            type="button"
            onClick={() => document.getElementById("partial-payments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="text-muted-foreground hover:text-foreground"
          >
            PARTIAL PAYMENTS ↓
          </button>
        </nav>

        {showHistoryForm && (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {([
                ["Type", hType, setHType, TYPE_OPTIONS],
                ["Payment Status", hPayStatus, setHPayStatus, PAY_STATUS_OPTIONS],
                ["Payment Type", hPaymentType, setHPaymentType, PAYMENT_TYPE_OPTIONS],
              ] as const).map(([label, value, setter, options]) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-[12px] font-bold text-muted-foreground">{label}</label>
                  <Select value={value} onValueChange={setter}>
                    <SelectTrigger className="h-10 text-[13px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Start Date</label>
                <Input type="date" value={hStart} onChange={(e) => setHStart(e.target.value)} className="h-10 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">End Date</label>
                <Input type="date" value={hEnd} onChange={(e) => setHEnd(e.target.value)} className="h-10 text-[13px]" />
              </div>
            </div>
            <Button onClick={handleViewHistory} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-8">
              {historyQuery.isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              View
            </Button>
          </div>
        )}

        {/* Old page: the View History response replaces the Full Payments card. */}
        {historyFilters ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
              <h2 className="text-base font-bold">
                Dollar Pay History
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {historyFilters.startDate} to {historyFilters.endDate}
                  {historyQuery.data ? ` · ${historyQuery.data.records.length} shown of ${historyQuery.data.fetched}` : ""}
                </span>
              </h2>
              <Button variant="outline" size="sm" onClick={() => setHistoryFilters(null)}>Back to Full Payments</Button>
            </div>
            <div className="overflow-x-auto max-h-[70vh]">
              <Table className="text-[12px]">
                <TableHeader className="bg-muted/10 sticky top-0">
                  <TableRow>
                    {["#", "Date", "Drm Id", "Ab Id", "Order Id", "Comapny", "Person", "Dollars", "Rate", "Ab Disc", "Extra Disc", "Cus Report", "Package", "Type", "Payment", "Earnings Report"].map((h) => (
                      <TableHead key={h} className={TH}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.isLoading ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : historyQuery.isError ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16 text-destructive">Failed to load history</TableCell></TableRow>
                  ) : !historyQuery.data?.records.length ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest">No records found</TableCell></TableRow>
                  ) : (
                    historyQuery.data.records.map((r) => (
                      <TableRow key={`${r.src}-${r.id}`}>
                        <TableCell>{r.n}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.payDate || "-"}</TableCell>
                        <TableCell>{r.drmId || "-"}</TableCell>
                        <TableCell>{r.memberId || "-"}</TableCell>
                        <TableCell>{r.orderId || "-"}</TableCell>
                        <TableCell className="font-semibold">{r.companyName || "-"}</TableCell>
                        <TableCell>{r.person || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">$ {fmt(r.dollars)}</TableCell>
                        <TableCell>{fmt(r.dollarRate)}</TableCell>
                        <TableCell className="whitespace-nowrap">$ {fmt(r.abDisc)}</TableCell>
                        <TableCell className="whitespace-nowrap">$ {fmt(r.extraDisc)}</TableCell>
                        <TableCell><Pill className={labelClass(r.cusLabel)}>{r.cusLabel}: $ {r.cusProfit}</Pill></TableCell>
                        <TableCell>{r.package || "-"}</TableCell>
                        <TableCell>{r.type || "-"}</TableCell>
                        <TableCell>{r.payStatus || "-"}</TableCell>
                        <TableCell><Pill className={labelClass(r.earningLabel)}>{r.earningLabel}: $ {r.earningAmount ?? "-"}</Pill></TableCell>
                      </TableRow>
                    ))
                  )}
                  {historyQuery.data && historyQuery.data.fetched > 0 && (
                    <TableRow className="font-bold bg-muted/40">
                      <TableCell colSpan={7}>Total</TableCell>
                      <TableCell className="whitespace-nowrap">$ {money(historyQuery.data.totals.dollars)}</TableCell>
                      <TableCell />
                      <TableCell className="whitespace-nowrap">$ {money(historyQuery.data.totals.abDisc)}</TableCell>
                      <TableCell className="whitespace-nowrap">$ {money(historyQuery.data.totals.extraDisc)}</TableCell>
                      <TableCell className="whitespace-nowrap">Profit $ {money(historyQuery.data.totals.profit)}</TableCell>
                      <TableCell className="whitespace-nowrap">Loss $ {money(historyQuery.data.totals.loss)}</TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
              <div>
                <h2 className="text-base font-bold">Full Payments To Paid</h2>
                {full && (
                  <p className="text-xs text-muted-foreground">
                    {full.totalRecords.toLocaleString()} records · Total $ {money(full.grandTotals?.total_dollar)} · PKR {money(full.grandTotals?.total_pkr, 0)}
                  </p>
                )}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={fullSearchInput}
                  onChange={(e) => setFullSearchInput(e.target.value)}
                  placeholder="Search company / DRM id"
                  className="h-9 pl-8 text-[13px]"
                  data-testid="search-full"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-[12px]">
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    {["#", "Date", "Drm Id", "Ab Id", "Order Id", "Comapny Name", "Sale Person", "Total Dollar", "Today Dollar Rate", "Package", "Type", "Payment Status", "Earnings Report", "Cus $ Rate", "Cus $ Profit", "View Details"].map((h) => (
                      <TableHead key={h} className={TH}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fullQuery.isLoading ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : fullQuery.isError ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16 text-destructive">Failed to load full payments</TableCell></TableRow>
                  ) : !full?.records.length ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest">No records found</TableCell></TableRow>
                  ) : (
                    full.records.map((r, i) => (
                      <TableRow key={`${r.src}-${r.payid}`}>
                        <TableCell>{fullOffset + i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.payDate || "-"}</TableCell>
                        <TableCell>{r.drmId || "-"}</TableCell>
                        <TableCell>{r.memberId || "-"}</TableCell>
                        <TableCell>{r.orderId || "-"}</TableCell>
                        <TableCell className="font-semibold">{r.companyName || "-"}</TableCell>
                        <TableCell>{r.salePerson || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">$ {fmt(r.dollars)}</TableCell>
                        <TableCell>{fmt(r.dollarRate)}</TableCell>
                        <TableCell>{r.package || "-"}</TableCell>
                        <TableCell>{r.type || "-"}</TableCell>
                        <TableCell><Pill className={statusClass(r.payStatus)}>{r.payStatus || "-"}</Pill></TableCell>
                        <TableCell><Earning label={r.earningLabel} amount={r.earningAmount} /></TableCell>
                        <TableCell>{fmt(r.cusDollarRate)}</TableCell>
                        <TableCell>{fmt(r.cusProfit)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setDetail({
                              kind: "full", id: r.payid, src: r.src, memberId: r.memberId, orderId: r.orderId,
                              companyName: r.companyName, orderAmount: r.dollars, dollarRate: r.dollarRate,
                              earningLabel: r.earningLabel, earningAmount: r.earningAmount,
                            })}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Pager page={full?.page ?? fullPage} totalPages={full?.totalPages ?? 0} onPage={setFullPage} />
          </div>
        )}

        <div id="partial-payments" className="bg-card border border-border rounded-lg overflow-hidden scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b">
            <div>
              <h2 className="text-base font-bold">Partial Payments To Paid</h2>
              {partial && <p className="text-xs text-muted-foreground">{partial.totalRecords.toLocaleString()} records</p>}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={partialSearchInput}
                onChange={(e) => setPartialSearchInput(e.target.value)}
                placeholder="Search company / DRM id"
                className="h-9 pl-8 text-[13px]"
                data-testid="search-partial"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="text-[12px]">
              <TableHeader className="bg-muted/10">
                <TableRow>
                  {["#", "Date", "Drm Id", "Ab Id", "Order Id", "Comapny Name", "Sale Person", "Total Dollar", "Today Dollar Rate", "Package", "Type", "Payment Status", "Earnings Report", "Cus $ Rate", "Cus $ Profit", "View Details", "Action"].map((h) => (
                    <TableHead key={h} className={TH}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {partialQuery.isLoading ? (
                  <TableRow><TableCell colSpan={17} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : partialQuery.isError ? (
                  <TableRow><TableCell colSpan={17} className="text-center py-16 text-destructive">Failed to load partial payments</TableCell></TableRow>
                ) : !partial?.records.length ? (
                  <TableRow><TableCell colSpan={17} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest">No records found</TableCell></TableRow>
                ) : (
                  partial.records.map((r, i) => (
                    <TableRow key={`${r.src}-${r.partialGmId}`}>
                      <TableCell>{partialOffset + i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.payDate || "-"}</TableCell>
                      <TableCell>{r.drmId || "-"}</TableCell>
                      <TableCell>{r.memberId || "-"}</TableCell>
                      <TableCell>{r.orderId || "-"}</TableCell>
                      <TableCell className="font-semibold">{r.companyName || "-"}</TableCell>
                      <TableCell>{r.salePerson || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">$ {fmt(r.currentDollarPay)}</TableCell>
                      <TableCell>{fmt(r.dollarRate)}</TableCell>
                      <TableCell>{r.package || "-"}</TableCell>
                      <TableCell>{r.payType || "-"}</TableCell>
                      <TableCell><Pill className={statusClass(r.abConfirmStatus)}>{r.abConfirmStatus || "-"}</Pill></TableCell>
                      <TableCell><Earning label={r.earningLabel} amount={r.earningAmount} /></TableCell>
                      <TableCell>{fmt(r.cusDollarRate)}</TableCell>
                      <TableCell>{fmt(r.cusProfit)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => setDetail({
                            kind: "partial", id: r.partialGmId, src: r.src, memberId: r.memberId, orderId: r.orderId,
                            companyName: r.companyName, orderAmount: r.abPayDollar, dollarRate: r.dollarRate,
                            earningLabel: r.earningLabel, earningAmount: r.earningAmount,
                          })}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </TableCell>
                      <TableCell>
                        {r.src === "legacy" && (r.abConfirmStatus || "").toLowerCase() !== "paid" ? (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Update Ab payment status" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pager page={partial?.page ?? partialPage} totalPages={partial?.totalPages ?? 0} onPage={setPartialPage} />
        </div>
      </div>

      {/* Order Details modal */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Member id:</span> {detail.memberId || "-"}</div>
                <div><span className="text-muted-foreground">Order id:</span> {detail.orderId || "-"}</div>
                <div><span className="text-muted-foreground">Company Name:</span> {detail.companyName || "-"}</div>
                <div><span className="text-muted-foreground">Order Amount:</span> $ {fmt(detail.orderAmount)}</div>
              </div>
              <Table className="text-[12px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className={TH}>#</TableHead>
                    <TableHead className={TH}>Buyer</TableHead>
                    <TableHead className={TH}>Use</TableHead>
                    <TableHead className={TH}>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyersQuery.isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : buyers.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No buyer detail</TableCell></TableRow>
                  ) : (
                    buyers.map((b, i) => {
                      const total = Number(b.dollarTotal ?? 0);
                      const use = Number(b.dollarUse ?? 0);
                      return (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{b.buyer_main_name || "-"}</div>
                            <div className="text-muted-foreground">{b.buyer_paypal_email || ""}</div>
                            <div>Total: ${String(b.dollarTotal ?? "-")} Rate: {String(b.buyer_dollar_rate ?? "-")}</div>
                          </TableCell>
                          <TableCell>${String(b.dollarUse ?? "-")}</TableCell>
                          <TableCell>$ {Number.isFinite(total - use) ? Math.round((total - use) * 100) / 100 : "-"}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={4}>Dollar Rate: {fmt(detail.dollarRate)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell colSpan={4}><Earning label={detail.earningLabel} amount={detail.earningAmount} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ab Payment Status modal */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRow?.companyName || "Update Ab Payment Status"}</DialogTitle></DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-muted-foreground">Member Id</label>
                  <Input value={editRow.memberId ?? ""} readOnly className="h-9 text-[13px] bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-muted-foreground">Order Id</label>
                  <Input value={editRow.orderId ?? ""} readOnly className="h-9 text-[13px] bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-muted-foreground">Ab Payment Status</label>
                  <Select value={abStatus} onValueChange={setAbStatus}>
                    <SelectTrigger className="h-9 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                    <SelectContent>
                      {AB_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-muted-foreground">Ab Pay Date</label>
                  <Input type="date" value={abDate} onChange={(e) => setAbDate(e.target.value)} className="h-9 text-[13px]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-muted-foreground">Detail</label>
                <textarea
                  value={abNote}
                  onChange={(e) => setAbNote(e.target.value)}
                  rows={3}
                  placeholder="add detail"
                  className="w-full rounded-md border border-border bg-transparent p-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button onClick={submitAbStatus} disabled={abMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {abMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
