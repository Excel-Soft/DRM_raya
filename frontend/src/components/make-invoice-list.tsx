import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Swal from "sweetalert2";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Eye, PlusCircle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { InvoiceReceipt } from "@/components/invoice/InvoiceReceipt";

// Make Invoice list = old DRM drm/make-invoice: invoices (webxl_invoice) of the last month,
// newest first. Payment column = grand_total. Plus icon green ("Payed") when the invoice has
// a payment, red ("Pending") otherwise; it opens "Create Project" (record a payment and pick
// the invoice items to start).

type LegacyInvoice = {
  invoiceId: string;
  comId: string | null;
  companyName: string | null;
  invoiceName: string | null;
  salePerson: string | null;
  createdAt: string | null;
  grandTotal: string;
  pay: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  subTotal: string | null;
  discount: string | null;
  gst: string | null;
  dollarRate: string | null;
  account: string | null;
  isPaid: boolean;
};

type LegacyInvoiceItem = {
  id: string;
  item: string | null;
  detail: string | null;
  unitPrice: string | null;
  qty: string | null;
  totalPkr: string | null;
  pkr: string;
  pay: string;
  start: string | null;
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtDate = (v: string | null, f = "dd-MM-yyyy hh:mm a") => {
  if (!v) return "-";
  const d = new Date(v.replace(" ", "T"));
  return isNaN(d.getTime()) ? v : format(d, f);
};

// Old detail text is HTML with <br/> line breaks.
const detailLines = (s: string | null) =>
  String(s || "")
    .split(/<br\s*\/?>/i)
    .map((x) => x.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "Bank Transfar", label: "Bank Transfar" },
  { value: "Free", label: "Free" },
  { value: "Delay", label: "Delay" },
];

function useInvoiceItems(invoiceId: string | null) {
  return useQuery<LegacyInvoiceItem[]>({
    queryKey: ["/api/account/make-invoice", invoiceId, "items"],
    queryFn: () => apiRequestJson("GET", `/api/account/make-invoice/${invoiceId}/items`),
    enabled: !!invoiceId,
  });
}

function InvoiceView({ inv, onClose, preloadedItems }: { inv: LegacyInvoice; onClose: () => void; preloadedItems?: LegacyInvoiceItem[] }) {
  const itemsQuery = useInvoiceItems(preloadedItems ? null : inv.invoiceId);
  const items = preloadedItems ?? itemsQuery.data ?? [];
  const isLoading = !preloadedItems && itemsQuery.isLoading;
  const company = inv.invoiceName || inv.companyName || "-";
  const subTotalUsd = items.reduce((s, it) => s + num(it.unitPrice) * (num(it.qty) || 1), 0);
  const created = inv.createdAt ? new Date(inv.createdAt.replace(" ", "T")) : new Date();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Invoice #{inv.invoiceId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-10 text-center text-slate-400">Loading...</div>
        ) : (
          <InvoiceReceipt
            onClose={onClose}
            invoiceData={{
              invoiceNumber: inv.invoiceId,
              date: isNaN(created.getTime()) ? new Date() : created,
              from: {
                name: "Web Excels",
                whatsapp: "+92-334-8086611",
                phone: "+92-52-4271592",
                email: "Support@Webexcels.com",
                address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan",
              },
              to: {
                name: company,
                phone: inv.phone || "N/A",
                email: inv.email || "N/A",
                address: inv.address || "",
              },
              // Old invoice item: unit_price ($), qty, totalPkr (= price x qty x rate)
              items: items.map((it) => ({
                name: it.item || "Service",
                detail: detailLines(it.detail).join(", "),
                price: num(it.unitPrice),
                quantity: num(it.qty) || 1,
                total: Math.round(num(it.totalPkr)),
              })),
              subTotalUsd: Math.round(subTotalUsd * 100) / 100,
              subTotalPkr: Math.round(num(inv.subTotal)),
              taxUsd: Math.round(((subTotalUsd * num(inv.gst)) / 100) * 100) / 100,
              discountPkr: Math.round(num(inv.discount)),
              totalPkr: Math.round(num(inv.grandTotal)),
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Opens the Make Invoice receipt for an old-DRM invoice id or a new-app invoice id. */
export function InvoiceViewDialog({ legacyInvoiceId, modernInvoiceId, onClose }: {
  legacyInvoiceId?: string | null; modernInvoiceId?: string | null; onClose: () => void;
}) {
  const params = new URLSearchParams();
  if (legacyInvoiceId) params.set("legacyId", String(legacyInvoiceId));
  if (modernInvoiceId) params.set("modernId", String(modernInvoiceId));
  const { data, isLoading, isError } = useQuery<{ header: LegacyInvoice; items: LegacyInvoiceItem[] }>({
    queryKey: ["/api/account/invoice-view", legacyInvoiceId ?? null, modernInvoiceId ?? null],
    queryFn: () => apiRequestJson("GET", `/api/account/invoice-view?${params.toString()}`),
  });
  if (isLoading || isError || !data) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Invoice</DialogTitle></DialogHeader>
          <div className="py-6 text-center text-sm text-slate-500">{isLoading ? "Loading..." : "Invoice not found."}</div>
        </DialogContent>
      </Dialog>
    );
  }
  return <InvoiceView inv={{ ...data.header, isPaid: false }} preloadedItems={data.items} onClose={onClose} />;
}

type LegacyPayment = {
  paidAt: string | null;
  amount: string | number;
  method: string | null;
  receiptNumber: string | null;
  comments: string | null;
};

const methodLabel = (m: string | null) =>
  METHODS.find((x) => x.value.toLowerCase() === String(m || "").toLowerCase())?.label || m || "-";

function CreateProjectDialog({ inv, onClose }: { inv: LegacyInvoice; onClose: () => void }) {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useInvoiceItems(inv.invoiceId);
  const { data: payments = [] } = useQuery<LegacyPayment[]>({
    queryKey: ["/api/account/make-invoice", inv.invoiceId, "payments"],
    queryFn: () => apiRequestJson("GET", `/api/account/make-invoice/${inv.invoiceId}/payments`),
    enabled: inv.isPaid,
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [payRecDate, setPayRecDate] = useState("");
  const [comments, setComments] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const received = num(inv.pay);
  const due = num(inv.grandTotal) - received;
  // Fully paid invoice: show what was received, nothing to edit.
  const readOnly = inv.isPaid && due <= 0;
  const showDelayFields = method === "Delay" || method === "Free";
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const lastPayment = payments.length ? payments[payments.length - 1] : null;
  const paidItems = items.filter((it) => num(it.pay) > 0 || it.start === "1");

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequestJson("POST", `/api/account/make-invoice/${inv.invoiceId}/payment`, {
        amount: amount === "" ? 0 : Number(amount),
        method,
        payRecDate: showDelayFields ? payRecDate || null : null,
        comments: showDelayFields ? comments || null : null,
        items: selected,
      }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/make-invoice"] });
      Swal.fire({
        icon: "success",
        title: "Your transaction is added!",
        text: r?.projectsStarted?.length ? `Project started: ${r.projectsStarted.join(", ")}` : undefined,
        didOpen: () => { const c = Swal.getContainer(); if (c) c.style.pointerEvents = "auto"; },
      });
      onClose();
    },
    onError: (e: any) =>
      toast({ title: "Could not save payment", description: e?.message || "Failed", variant: "destructive" }),
  });

  const onSave = async () => {
    if (!method) return toast({ title: "Choose a method", variant: "destructive" });
    if (!showDelayFields && !(Number(amount) > 0)) return toast({ title: "Enter the amount received", variant: "destructive" });
    if (selected.length === 0) return toast({ title: "Select at least one project", variant: "destructive" });
    const r = await Swal.fire({
      icon: "warning",
      title: `Are you sure to add ${Number(amount || 0).toLocaleString()}.00?`,
      text: "Once payment is added, you will not be able to change it.",
      showCancelButton: true,
      confirmButtonText: "Yes, add",
      confirmButtonColor: "#059669",
      didOpen: () => { const c = Swal.getContainer(); if (c) c.style.pointerEvents = "auto"; },
    });
    if (r.isConfirmed) saveMutation.mutate();
  };

  const roBox = "mt-1 bg-slate-100 dark:bg-zinc-800";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-zinc-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            Create Project <span className="text-slate-400">—</span>
            <span className="text-sm font-normal text-emerald-600">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
          </DialogTitle>
        </DialogHeader>

        {readOnly ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-sm">Name</Label><Input readOnly value={inv.invoiceName || inv.companyName || ""} className={roBox} /></div>
              <div><Label className="text-sm">Due</Label><Input readOnly value={String(Math.max(0, due))} className={roBox} /></div>
              <div><Label className="text-sm">Amount</Label><Input readOnly value={received.toLocaleString()} className={roBox} /></div>
              <div><Label className="text-sm">Method</Label><Input readOnly value={methodLabel(lastPayment?.method ?? null)} className={roBox} /></div>
              <div>
                <Label className="text-sm">Status</Label>
                <div className="mt-1 h-10 flex items-center">
                  <span className="text-xs font-semibold rounded px-2 py-1 bg-emerald-100 text-emerald-700">Paid</span>
                </div>
              </div>
              <div>
                <Label className="text-sm">Receipt #</Label>
                <Input readOnly value={payments.map((p) => p.receiptNumber).filter(Boolean).join(", ") || "-"} className={roBox} />
              </div>
            </div>
            <div>
              <Label className="text-sm">Project</Label>
              <div className="mt-1 flex flex-wrap gap-1 border rounded-md p-2 min-h-10 dark:border-zinc-800">
                {(paidItems.length ? paidItems : items).map((it) => (
                  <span key={it.id} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
                    {it.item} ({Math.round(num(it.pkr) * 0.3 * 100) / 100})-({num(it.pay)})
                  </span>
                ))}
              </div>
            </div>
            {payments.length > 0 && (
              <div>
                <Label className="text-sm">Payments received</Label>
                <table className="w-full text-xs mt-1 border rounded dark:border-zinc-800">
                  <thead className="bg-slate-50 dark:bg-zinc-800">
                    <tr className="text-left"><th className="px-2 py-1">Date</th><th className="px-2 py-1">Amount</th><th className="px-2 py-1">Method</th><th className="px-2 py-1">Receipt</th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={i} className="border-t dark:border-zinc-800">
                        <td className="px-2 py-1">{fmtDate(p.paidAt)}</td>
                        <td className="px-2 py-1">{num(p.amount).toLocaleString()}</td>
                        <td className="px-2 py-1">{methodLabel(p.method)}</td>
                        <td className="px-2 py-1">{p.receiptNumber || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Name</Label>
                <Input readOnly value={inv.invoiceName || inv.companyName || ""} className={roBox} />
              </div>
              <div>
                <Label className="text-sm">Due</Label>
                <Input readOnly value={String(due)} className={roBox} />
              </div>
              <div>
                <Label className="text-sm">Amount</Label>
                <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose ..." /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {showDelayFields && (
                <>
                  <div>
                    <Label className="text-sm">Payment Receive</Label>
                    <Input type="date" value={payRecDate} onChange={(e) => setPayRecDate(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm">Comments</Label>
                    <Textarea rows={1} value={comments} onChange={(e) => setComments(e.target.value)} className="mt-1" />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <Label className="text-sm">Project</Label>
                {/* Old option label: item (30% of item PKR)-(item paid) */}
                <div className="mt-1 border rounded-md p-1 max-h-48 overflow-y-auto dark:border-zinc-800">
                  {isLoading ? (
                    <p className="text-sm text-slate-400 p-2">Loading...</p>
                  ) : items.length === 0 ? (
                    <p className="text-sm text-slate-400 p-2">No items on this invoice</p>
                  ) : (
                    items.map((it) => {
                      const on = selected.includes(it.id);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggle(it.id)}
                          className={`w-full text-left text-sm px-3 py-1.5 rounded ${on ? "bg-emerald-600 text-white" : "hover:bg-slate-100 dark:hover:bg-zinc-800"}`}
                        >
                          {it.item} ({Math.round(num(it.pkr) * 0.3 * 100) / 100})-({num(it.pay)})
                        </button>
                      );
                    })
                  )}
                </div>
                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {items.filter((it) => selected.includes(it.id)).map((it) => (
                      <span key={it.id} className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
                        {it.item}
                        <button type="button" onClick={() => toggle(it.id)}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {inv.isPaid && received > 0 && (
              <p className="text-xs text-slate-500">Already received: {received.toLocaleString()} PKR</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending} onClick={onSave}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MakeInvoiceList() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [viewInv, setViewInv] = useState<LegacyInvoice | null>(null);
  const [payInv, setPayInv] = useState<LegacyInvoice | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<{ data: LegacyInvoice[]; total: number }>({
    queryKey: ["/api/account/make-invoice", page, pageSize, search],
    queryFn: () =>
      apiRequestJson(
        "GET",
        `/api/account/make-invoice?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`,
      ),
    placeholderData: (prev) => prev,
  });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-md shadow-sm">
      <div className="p-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Show</span>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[70px] h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">entries</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Search:</span>
          <Input
            className="w-[240px] h-9 text-sm"
            placeholder="Company, sale person, invoice #"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="overflow-x-auto border rounded dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 dark:bg-zinc-800">
              <tr className="text-left text-slate-700 dark:text-zinc-300">
                <th className="px-4 py-3 w-14">No</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Sale Person</th>
                <th className="px-4 py-3">Create</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 w-24">Action</th>
              </tr>
            </thead>
            <tbody className={isFetching && !isLoading ? "opacity-60" : ""}>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">{search ? "No invoice matches your search" : "No invoices"}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.invoiceId} className="border-t hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-slate-500">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-4 py-3 font-medium uppercase">{r.companyName || r.invoiceName || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{r.salePerson || "-"}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3">{r.grandTotal}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button type="button" className="text-emerald-600 hover:text-emerald-700" title="View" onClick={() => setViewInv(r)}>
                          <Eye className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          type="button"
                          className={r.isPaid ? "text-emerald-600 hover:text-emerald-700" : "text-rose-500 hover:text-rose-600"}
                          title={r.isPaid ? "Payed" : "Pending"}
                          onClick={() => setPayInv(r)}
                        >
                          <PlusCircle className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewInv && <InvoiceView inv={viewInv} onClose={() => setViewInv(null)} />}
      {payInv && <CreateProjectDialog inv={payInv} onClose={() => setPayInv(null)} />}
    </div>
  );
}
