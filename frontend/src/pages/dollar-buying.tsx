import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ChevronRight, Loader2 } from "lucide-react";
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

type BuyerAttributeRow = {
  id: string;
  category: string;
  name: string;
  parentId: string | null;
  email: string | null;
  phone: string | null;
};

type DollarBuyingRecord = {
  id: string;
  buyer_id: string | null;
  buyer_name: string | null;
  buyer_name_full: string | null;
  buyer_reference: string | null;
  paypal_email: string | null;
  cheque_id: string | null;
  payment_method: string | null;
  type: string | null;
  dollar_amount: string;
  dollar_rate: string;
  pkr_amount: string;
  date: string;
  detail: string | null;
  martini: string | null;
};

const PAYMENT_METHOD_OPTIONS = ["Bank Transfer", "Cheque", "Cash", "Online"];
const TYPE_OPTIONS = ["New", "Renewal"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DollarBuying() {
  const { toast } = useToast();

  const [showAddBuyer, setShowAddBuyer] = useState(true);
  const [showViewHistory, setShowViewHistory] = useState(true);

  // ── Add Buyer (new transaction) form ──
  const [buyerId, setBuyerId] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [chequeId, setChequeId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [type, setType] = useState("");
  const [amountMode, setAmountMode] = useState<"dollar" | "pkr">("dollar");
  const [amount, setAmount] = useState("");
  const [dollarRate, setDollarRate] = useState("");
  const [date, setDate] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [detail, setDetail] = useState("");

  const buyerTreeQuery = useQuery<BuyerAttributeRow[]>({
    queryKey: ["/api/attributes", "Buyer Detail"],
    queryFn: () => apiRequestJson<BuyerAttributeRow[]>("GET", `/api/attributes/${encodeURIComponent("Buyer Detail")}`),
  });
  const buyerTree = buyerTreeQuery.data ?? [];
  const topBuyers = useMemo(() => buyerTree.filter((r) => !r.parentId), [buyerTree]);
  const buyerReferences = useMemo(() => buyerTree.filter((r) => r.parentId === buyerId), [buyerTree, buyerId]);
  const selectedBuyerNode = topBuyers.find((b) => b.id === buyerId) ?? null;
  const selectedReferenceNode = buyerReferences.find((r) => r.id === referenceId) ?? null;

  const rate = Number(dollarRate || 0);
  const amountNum = Number(amount || 0);
  const dollarAmount = amountMode === "dollar" ? amountNum : (rate > 0 ? amountNum / rate : 0);
  const pkrAmount = amountMode === "pkr" ? amountNum : amountNum * rate;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!buyerId) throw new Error("Choose a buyer");
      if (!amountNum || !rate) throw new Error("Amount and Dollar Rate are required");
      let screenshotUrl: string | null = null;
      if (screenshotFile) screenshotUrl = await fileToDataUrl(screenshotFile);

      return apiRequestJson("POST", "/api/account/buying", {
        buyerName: selectedBuyerNode?.name ?? null,
        buyerReference: selectedReferenceNode?.name ?? null,
        paypalEmail: selectedReferenceNode?.email ?? null,
        accountNo: accountNo || null,
        chequeId: chequeId || null,
        paymentMethod: paymentMethod || null,
        type: type || null,
        dollarAmount: dollarAmount.toFixed(2),
        dollarRate: rate.toFixed(2),
        pkrAmount: pkrAmount.toFixed(2),
        date: date || undefined,
        screenshotUrl,
        detail: detail || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/buying"] });
      toast({ title: "Buying record added" });
      setBuyerId("");
      setReferenceId("");
      setAccountNo("");
      setChequeId("");
      setPaymentMethod("");
      setType("");
      setAmount("");
      setDollarRate("");
      setDate("");
      setScreenshotFile(null);
      setDetail("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add record", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  // ── View History ──
  const [historyBuyerName, setHistoryBuyerName] = useState("");
  const [historyReference, setHistoryReference] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [committedFilters, setCommittedFilters] = useState({ startDate: "", endDate: "" });

  const historyQuery = useQuery<DollarBuyingRecord[]>({
    queryKey: ["/api/account/buying", committedFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (committedFilters.startDate) params.set("startDate", committedFilters.startDate);
      if (committedFilters.endDate) params.set("endDate", committedFilters.endDate);
      return apiRequestJson<DollarBuyingRecord[]>("GET", `/api/account/buying?${params.toString()}`);
    },
  });
  const historyRows = historyQuery.data ?? [];

  // The backend only filters by startDate/endDate — buyer/buyerReference have
  // no server-side params, so they're filtered client-side against whatever
  // the server already returned.
  const filteredHistoryRows = useMemo(() => {
    return historyRows.filter((r) => {
      if (historyBuyerName && r.buyer_name !== historyBuyerName) return false;
      if (historyReference && r.buyer_reference !== historyReference) return false;
      return true;
    });
  }, [historyRows, historyBuyerName, historyReference]);

  const historyReferenceOptions = useMemo(() => {
    const parent = historyBuyerName ? topBuyers.find((b) => b.name === historyBuyerName) : null;
    const pool = parent ? buyerTree.filter((r) => r.parentId === parent.id) : buyerTree.filter((r) => r.parentId);
    return Array.from(new Set(pool.map((r) => r.name)));
  }, [buyerTree, topBuyers, historyBuyerName]);

  const handleView = () => {
    setCommittedFilters({ startDate: historyStartDate, endDate: historyEndDate });
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="wide-page p-4 sm:p-6 space-y-6">
        <nav className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">DOLLAR BUYING</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setShowAddBuyer((v) => !v)}
            className={showAddBuyer ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}
            data-testid="toggle-add-buyer"
          >
            ADD BUYER
          </button>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            type="button"
            onClick={() => setShowViewHistory((v) => !v)}
            className={showViewHistory ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}
            data-testid="toggle-view-history"
          >
            VIEW HISTORY
          </button>
        </nav>

        {/* Add Buyer form */}
        {showAddBuyer && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Buyer Name</label>
              <Select value={buyerId} onValueChange={(v) => { setBuyerId(v); setReferenceId(""); }}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {topBuyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Paypal Email</label>
              <Input value={selectedReferenceNode?.email ?? ""} readOnly placeholder="buyer paypal" className="h-10 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Account No</label>
              <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="Account no" className="h-10 text-[13px]" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Cheque List</label>
              <Input value={chequeId} onChange={(e) => setChequeId(e.target.value)} placeholder="Cheque no (if any)" className="h-10 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Payment method</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-muted-foreground">{amountMode === "dollar" ? "Dollar" : "Pkr"}</label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 flex items-center rounded-md border border-border overflow-hidden">
                <span className="px-3 h-10 flex items-center bg-muted/40 text-[12px] font-bold text-muted-foreground shrink-0">
                  {amountMode === "dollar" ? "Dollar" : "Pkr"}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 h-10 px-3 text-[13px] bg-transparent outline-none min-w-0"
                />
              </div>
              <button
                type="button"
                onClick={() => setAmountMode((m) => (m === "dollar" ? "pkr" : "dollar"))}
                title="Switch between entering Dollar or PKR"
                className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
              <Input
                type="number"
                value={dollarRate}
                onChange={(e) => setDollarRate(e.target.value)}
                placeholder="Dollar Rate"
                className="h-10 text-[13px] w-36 shrink-0"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Pkr Amount</label>
              <div className="h-10 flex items-center rounded-md border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground">
                {pkrAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Screenshot</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                className="h-10 w-full text-[13px] file:mr-3 file:h-10 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-bold text-muted-foreground">Detail</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="add detail"
              rows={3}
              className="w-full rounded-md border border-border bg-transparent p-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
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

        {/* View History */}
        {showViewHistory && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Buyer</label>
              <Select
                value={historyBuyerName || "all"}
                onValueChange={(v) => { setHistoryBuyerName(v === "all" ? "" : v); setHistoryReference(""); }}
              >
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {topBuyers.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Buyer Reference</label>
              <Select value={historyReference || "all"} onValueChange={(v) => setHistoryReference(v === "all" ? "" : v)}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {historyReferenceOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">Start Date</label>
              <Input type="date" value={historyStartDate} onChange={(e) => setHistoryStartDate(e.target.value)} className="h-10 text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-muted-foreground">End Date</label>
              <Input type="date" value={historyEndDate} onChange={(e) => setHistoryEndDate(e.target.value)} className="h-10 text-[13px]" />
            </div>
          </div>

          <Button onClick={handleView} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-8">
            View
          </Button>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="text-[11px] font-bold uppercase pl-6">No</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Buyer</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Buyer Reference</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Dollar</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Rate</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Total Pkr</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Paypal Email</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Type</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase">Martini</TableHead>
                    <TableHead className="text-[11px] font-bold uppercase pr-6">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-16 text-muted-foreground text-[12px]">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredHistoryRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-16 text-muted-foreground font-bold uppercase tracking-widest text-[12px]">
                        No records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistoryRows.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell className="pl-6">{i + 1}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(r.date)}</TableCell>
                        <TableCell className="font-bold">{r.buyer_name_full || r.buyer_name || "-"}</TableCell>
                        <TableCell className="text-emerald-600">{r.buyer_reference || "-"}</TableCell>
                        <TableCell>$ {Number(r.dollar_amount).toLocaleString()}</TableCell>
                        <TableCell>{Number(r.dollar_rate).toLocaleString()}</TableCell>
                        <TableCell>{Number(r.pkr_amount).toLocaleString()}</TableCell>
                        <TableCell>{r.paypal_email || "-"}</TableCell>
                        <TableCell>{r.type || "-"}</TableCell>
                        <TableCell>{r.martini || "-"}</TableCell>
                        <TableCell className="pr-6 max-w-[200px] truncate">{r.detail || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
