import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { exportToCSV, exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import { Eye, Copy, FileSpreadsheet, FileText, FileDown, ArrowLeft, Pencil, Save, X } from "lucide-react";
import { InvoiceViewDialog } from "@/components/make-invoice-list";

// Old DRM "Balance Report" (balance-report.php). Backend: /api/reports/balance-report*.

type ColType = "text" | "int" | "dec2" | "raw" | "detail" | "invoice" | "badge";
interface DetailColumn { key: string; header: string; type?: ColType; align?: "left" | "right" | "center" }
interface InvoiceRef { label: string; legacyInvoiceId?: string | null; modernInvoiceId?: string | null }
interface DetailResponse {
  filter: string;
  title: string;
  start: string;
  end: string;
  info?: string[];
  columns: DetailColumn[];
  rows: Record<string, any>[];
  footer?: Record<string, string | number> | null;
  cards?: { positive: number; nonPositive: number; total: number; totalAmount: number } | null;
  note?: string;
  editableBank?: boolean;
}
interface LineItem { filter: string; label: string; amount: number; inProgress: boolean }
interface SummaryResponse {
  start: string;
  end: string;
  rows: { debit: LineItem | null; credit: LineItem | null | "stars" }[];
  totalDebit: number;
  totalCredit: number;
  totalBalance: number;
}
interface BankEntry { id: string; source: "legacy" | "new"; head: string; detail: string; amount: string; createAt: string; userName: string }
interface EntriesResponse { canAdd: boolean; tableReady: boolean; data: BankEntry[] }

/** PHP number_format($n, $d): half away from zero, "," thousands, "." decimals. */
function numberFormat(value: unknown, decimals = 0): string {
  const x = Number(value);
  if (!Number.isFinite(x)) return String(value ?? "");
  const f = Math.pow(10, decimals);
  const rounded = (Math.sign(x) * Math.round(Math.abs(x) * f)) / f;
  return rounded.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function pkToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}
function cellText(col: DetailColumn, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (col.type) {
    case "int":
      return typeof value === "number" ? numberFormat(value, 0) : String(value);
    case "dec2":
      return typeof value === "number" ? numberFormat(value, 2) : String(value);
    case "invoice":
      return (value as InvoiceRef)?.label ?? "";
    default:
      return String(value);
  }
}
const alignClass = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
const TONE: Record<string, string> = {
  success: "bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60",
  danger: "bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/40 dark:hover:bg-rose-950/60",
  parent: "bg-blue-100 font-semibold dark:bg-blue-950/60",
  child: "bg-cyan-50 font-medium dark:bg-cyan-950/40",
};

/** Old "See More": text over 20 characters is cut, the rest opens in a dialog. */
function SeeMore({ text, onOpen, emptyLabel }: { text: string; onOpen: (t: string) => void; emptyLabel?: string }) {
  const t = String(text ?? "");
  if (!t.trim()) return <span className="text-muted-foreground">{emptyLabel ?? ""}</span>;
  if (t.length <= 20) return <span>{t}</span>;
  return (
    <span>
      {t.slice(0, 20)}...{" "}
      <button type="button" className="text-blue-600 hover:underline dark:text-blue-400" onClick={() => onOpen(t)}>
        See more
      </button>
    </span>
  );
}
/** Old details hold <br/> tags; show them as line breaks in the dialog. */
function plainDetail(t: string): string {
  return t.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
}

const PAGE_SIZE = 20;

/** Prev / page numbers / Next, 20 rows per page. */
function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  const nums: (number | "gap")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "gap") nums.push("gap");
  }
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-500">
      <span>Showing {from.toLocaleString()} to {to.toLocaleString()} of {total.toLocaleString()} entries</span>
      <div className="flex flex-wrap gap-1">
        <Button variant="outline" size="sm" className="h-8 px-3" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        {nums.map((n, k) =>
          n === "gap" ? (
            <span key={`g${k}`} className="flex h-8 items-center px-1">…</span>
          ) : (
            <Button key={n} size="sm" variant={n === page ? "default" : "outline"}
              className={n === page ? "h-8 min-w-8 px-2 bg-[#009a54] hover:bg-[#008246]" : "h-8 min-w-8 px-2"}
              onClick={() => onPage(n)}>{n}</Button>
          ),
        )}
        <Button variant="outline" size="sm" className="h-8 px-3" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export default function BalanceReportPage() {
  const { toast } = useToast();
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [seeMore, setSeeMore] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ head: "", amount: "", detail: "", createDate: pkToday() });
  const [editing, setEditing] = useState<{ id: string; createAt: string; amount: string; detail: string } | null>(null);
  const [entriesPage, setEntriesPage] = useState(1);
  const [invoiceView, setInvoiceView] = useState<{ legacy: string | null; modern: string | null } | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  useEffect(() => { setDetailPage(1); }, [filter, search, range]);

  const entriesQuery = useQuery<EntriesResponse>({
    queryKey: ["/api/reports/balance-report/entries"],
    queryFn: () => apiRequestJson("GET", "/api/reports/balance-report/entries"),
  });
  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ["/api/reports/balance-report", range?.start, range?.end],
    queryFn: () => apiRequestJson("GET", `/api/reports/balance-report?start=${range!.start}&end=${range!.end}`),
    enabled: !!range,
  });
  const detailQuery = useQuery<DetailResponse>({
    queryKey: ["/api/reports/balance-report/detail", filter, range?.start, range?.end],
    queryFn: () =>
      apiRequestJson(
        "GET",
        `/api/reports/balance-report/detail?filter=${encodeURIComponent(filter!)}&start=${range!.start}&end=${range!.end}`,
      ),
    enabled: !!range && !!filter,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/reports/balance-report/entries"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/balance-report"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/balance-report/detail"] });
  };

  const addMutation = useMutation({
    mutationFn: () => apiRequestJson("POST", "/api/reports/balance-report/entries", form),
    onSuccess: () => {
      toast({ title: "Data Add In Balance" });
      setForm({ head: "", amount: "", detail: "", createDate: pkToday() });
      setShowAdd(false);
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Could not add bank balance", description: e?.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: (v: { id: string; createAt: string; amount: string; detail: string }) =>
      apiRequestJson("PATCH", `/api/reports/balance-report/entries/${v.id}`, v),
    onSuccess: () => {
      toast({ title: "Bank balance updated successfully!" });
      setEditing(null);
      invalidateAll();
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to update", variant: "destructive" }),
  });

  const handleView = () => {
    if (!tempStart || !tempEnd) {
      toast({ title: "Select Start Date and End Date", variant: "destructive" });
      return;
    }
    setRange({ start: tempStart, end: tempEnd });
    setFilter(null);
    setSearch("");
  };
  const openDetail = (f: string) => {
    setFilter(f);
    setSearch("");
    setEditing(null);
  };

  const detail = detailQuery.data;
  const visibleRows = useMemo(() => {
    if (!detail) return [];
    const q = search.trim().toLowerCase();
    if (!q) return detail.rows;
    return detail.rows.filter((r) => detail.columns.some((c) => cellText(c, r[c.key]).toLowerCase().includes(q)));
  }, [detail, search]);

  const exportCols: ExportColumn[] = (detail?.columns ?? []).map((c) => ({
    key: c.key,
    header: c.header,
    format: (v: any) => cellText(c, v),
  }));
  const exportRows = () => {
    if (!detail) return [];
    const rows = visibleRows.slice();
    if (detail.footer) rows.push(detail.footer);
    return rows;
  };
  const reportName = detail ? `${detail.title} ${detail.start} ${detail.end}` : "balance_report";
  const handleCopy = async () => {
    if (!detail) return;
    const lines = [
      detail.columns.map((c) => c.header).join("\t"),
      ...exportRows().map((r) => detail.columns.map((c) => cellText(c, r[c.key]).replace(/\s+/g, " ")).join("\t")),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: `Copied ${visibleRows.length} rows to clipboard` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const summary = summaryQuery.data;
  const entries = entriesQuery.data?.data ?? [];
  const canAdd = !!entriesQuery.data?.canAdd;

  const LineCell = ({ item }: { item: LineItem }) => (
    <button
      type="button"
      onClick={() => openDetail(item.filter)}
      className={`text-left text-[12px] font-semibold hover:underline ${filter === item.filter ? "text-[#009a54]" : "text-blue-700 dark:text-blue-400"}`}
    >
      {item.label}
      {item.inProgress && <span className="ml-1 text-rose-600"> Report in Progress</span>}
    </button>
  );

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-5 space-y-5 font-sans text-[#333] dark:text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[16px] font-bold text-[#555] dark:text-zinc-300 uppercase tracking-wide">Balance Report</h1>
          {canAdd && (
            <Button
              onClick={() => setShowAdd((s) => !s)}
              className="bg-[#009a54] hover:bg-[#008246] text-white rounded-[4px] h-9 text-[13px]"
            >
              Add Bank Balance
            </Button>
          )}
        </div>

        {/* Add Bank Balance (old balance_head form) */}
        {showAdd && canAdd && (
          <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800">
            <h2 className="text-[14px] font-bold text-[#555] dark:text-zinc-300 mb-4">Add Bank Balance</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate();
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Head</Label>
                <Input value={form.head} onChange={(e) => setForm({ ...form, head: e.target.value })} required className="h-10 text-[13px]" />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-semibold">Create Date</Label>
                <Input type="date" value={form.createDate} onChange={(e) => setForm({ ...form, createDate: e.target.value })} className="h-10 text-[13px]" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label className="text-[13px] font-semibold">Detail</Label>
                <Textarea value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} rows={3} className="text-[13px]" />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={addMutation.isPending} className="bg-[#009a54] hover:bg-[#008246] text-white rounded-[4px] px-8 h-9 text-[13px]">
                  {addMutation.isPending ? "Saving..." : "Submit"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">Start Date</Label>
              <Input type="date" value={tempStart} onChange={(e) => setTempStart(e.target.value)} className="h-10 text-[13px] rounded-[4px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">End Date</Label>
              <Input type="date" value={tempEnd} onChange={(e) => setTempEnd(e.target.value)} className="h-10 text-[13px] rounded-[4px]" />
            </div>
          </div>
          <Button onClick={handleView} className="bg-[#009a54] hover:bg-[#008246] text-white rounded-[4px] px-8 h-9 text-[13px] font-medium">
            View
          </Button>
        </div>

        {/* Balance View */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-[#555] dark:text-zinc-300">
              Balance View{range ? ` — ${range.start} to ${range.end}` : ""}
            </h2>
            {range && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => { setRange(null); setFilter(null); }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Bank balance list
              </Button>
            )}
          </div>

          {!range ? (
            <div className="w-full overflow-x-auto rounded-[4px] border border-gray-100 dark:border-zinc-800">
              <Table>
                <TableHeader className="bg-[#fef4e8] dark:bg-zinc-900">
                  <TableRow>
                    <TableHead className="w-14 font-bold">#</TableHead>
                    <TableHead className="font-bold">Head</TableHead>
                    <TableHead className="font-bold text-right">Amount</TableHead>
                    <TableHead className="font-bold">Detail</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entriesQuery.isLoading ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-gray-500">Loading...</TableCell></TableRow>
                  ) : entriesQuery.isError ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-rose-600">Failed to load bank balance entries.</TableCell></TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-6 text-center text-gray-500">No records found.</TableCell></TableRow>
                  ) : (
                    entries.slice((entriesPage - 1) * PAGE_SIZE, entriesPage * PAGE_SIZE).map((e, i) => (
                      <TableRow key={e.id} className="text-[13px]">
                        <TableCell>{(entriesPage - 1) * PAGE_SIZE + i + 1}</TableCell>
                        <TableCell>{e.head}</TableCell>
                        <TableCell className="text-right">{e.amount}</TableCell>
                        <TableCell><SeeMore text={e.detail} onOpen={setSeeMore} /></TableCell>
                        <TableCell>{e.createAt}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <Pager page={entriesPage} total={entries.length} onPage={setEntriesPage} />
            </div>
          ) : summaryQuery.isLoading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : summaryQuery.isError || !summary ? (
            <div className="py-8 text-center text-rose-600">Failed to load the balance report.</div>
          ) : (
            <div className="w-full overflow-x-auto rounded-[4px] border border-gray-100 dark:border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Debit</TableHead>
                    <TableHead className="bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">Amount</TableHead>
                    <TableHead className="bg-rose-100 font-bold text-rose-900 dark:bg-rose-950 dark:text-rose-200">Credit</TableHead>
                    <TableHead className="bg-rose-100 font-bold text-rose-900 dark:bg-rose-950 dark:text-rose-200">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((row, i) => (
                    <TableRow key={i} className="text-[13px]">
                      <TableCell>{row.debit && <LineCell item={row.debit} />}</TableCell>
                      <TableCell>{row.debit ? numberFormat(row.debit.amount) : ""}</TableCell>
                      <TableCell>
                        {row.credit === "stars" ? "***********" : row.credit ? <LineCell item={row.credit} /> : ""}
                      </TableCell>
                      <TableCell>
                        {row.credit === "stars" ? "**********" : row.credit ? numberFormat(row.credit.amount) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="text-[13px] font-bold">
                    <TableCell>Total Debit</TableCell>
                    <TableCell>{numberFormat(summary.totalDebit)}</TableCell>
                    <TableCell>Total Credit</TableCell>
                    <TableCell>{numberFormat(summary.totalCredit)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-amber-100 text-[13px] font-bold dark:bg-amber-950/60">
                    <TableCell>******************</TableCell>
                    <TableCell>Total Balance</TableCell>
                    <TableCell className={summary.totalBalance < 0 ? "text-rose-700 dark:text-rose-400" : ""}>
                      {numberFormat(summary.totalBalance)}
                    </TableCell>
                    <TableCell>******************</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </div>

        {/* Line item detail (old #loadAlibaba block) */}
        {range && filter && (
          <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-[#555] dark:text-zinc-300">{detail?.title ?? "Detail"}</h2>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setFilter(null)}>
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </div>

            {detailQuery.isLoading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : detailQuery.isError || !detail ? (
              <div className="py-8 text-center text-rose-600">Failed to load detail.</div>
            ) : (
              <>
                {detail.info && detail.info.length > 0 && (
                  <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                    {detail.info.map((line) => {
                      const [k, ...rest] = line.split(": ");
                      return (
                        <div key={line}>
                          <strong>{k}:</strong> {rest.join(": ")}
                        </div>
                      );
                    })}
                  </div>
                )}

                {detail.cards && (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg bg-emerald-600 p-4 text-white">
                        <div className="text-[14px] font-semibold">Positive Amounts</div>
                        <div className="text-2xl font-bold">{detail.cards.positive}</div>
                        <div className="text-[11px] opacity-90">Records with amount &gt; 0</div>
                      </div>
                      <div className="rounded-lg bg-rose-600 p-4 text-white">
                        <div className="text-[14px] font-semibold">Zero/Negative Amounts</div>
                        <div className="text-2xl font-bold">{detail.cards.nonPositive}</div>
                        <div className="text-[11px] opacity-90">Records with amount ≤ 0</div>
                      </div>
                      <div className="rounded-lg bg-sky-600 p-4 text-white">
                        <div className="text-[14px] font-semibold">Total Records</div>
                        <div className="text-2xl font-bold">{detail.cards.total}</div>
                        <div className="text-[11px] opacity-90">All records</div>
                      </div>
                    </div>
                    <div
                      className={`rounded border px-4 py-3 text-[14px] font-bold ${
                        detail.cards.totalAmount > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      Total Amount: {numberFormat(detail.cards.totalAmount)}
                    </div>
                  </>
                )}

                {detail.note && <p className="text-[12px] text-muted-foreground">{detail.note}</p>}

                {detail.columns.length > 0 && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" className="h-8" onClick={handleCopy}>
                          <Copy className="mr-1 h-4 w-4" /> Copy
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => exportToExcel(exportRows(), exportCols, reportName)}>
                          <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
                        </Button>
                        <Button variant="outline" size="sm" className="h-8" onClick={() => exportToCSV(exportRows(), exportCols, reportName)}>
                          <FileText className="mr-1 h-4 w-4" /> CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => exportToPDF(exportRows(), exportCols, reportName, { title: `${detail.title} (${detail.start} to ${detail.end})` })}
                        >
                          <FileDown className="mr-1 h-4 w-4" /> PDF
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[12px]">Search:</Label>
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-56 text-[13px]" />
                      </div>
                    </div>

                    <div className="w-full overflow-x-auto rounded-[4px] border border-gray-100 dark:border-zinc-800">
                      <Table className="text-[12px]">
                        <TableHeader className="bg-sky-50 dark:bg-zinc-900">
                          <TableRow>
                            {detail.columns.map((c) => (
                              <TableHead key={c.key} className={`whitespace-nowrap font-bold ${alignClass(c.align)}`}>{c.header}</TableHead>
                            ))}
                            {detail.editableBank && <TableHead className="text-center font-bold">Action</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={detail.columns.length + (detail.editableBank ? 1 : 0)} className="py-6 text-center text-muted-foreground">
                                No record found
                              </TableCell>
                            </TableRow>
                          ) : (
                            visibleRows.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE).map((r, i) => {
                              const isEditing = editing && editing.id === r.id;
                              return (
                                <TableRow key={r.id ?? i} className={TONE[r._tone] ?? ""}>
                                  {detail.columns.map((c) => {
                                    const v = r[c.key];
                                    let content: ReactNode = cellText(c, v);
                                    if (isEditing && c.key === "date") {
                                      content = (
                                        <Input type="date" value={editing!.createAt} onChange={(e) => setEditing({ ...editing!, createAt: e.target.value })} className="h-7 w-36 text-[12px]" />
                                      );
                                    } else if (isEditing && c.key === "amount") {
                                      content = (
                                        <Input type="number" step="0.01" value={editing!.amount} onChange={(e) => setEditing({ ...editing!, amount: e.target.value })} className="h-7 w-32 text-right text-[12px]" />
                                      );
                                    } else if (isEditing && c.key === "detail") {
                                      content = (
                                        <Input value={editing!.detail} onChange={(e) => setEditing({ ...editing!, detail: e.target.value })} className="h-7 text-[12px]" />
                                      );
                                    } else if (c.type === "detail") {
                                      content = <SeeMore text={String(v ?? "")} onOpen={setSeeMore} emptyLabel={detail.cards ? "No record found" : ""} />;
                                    } else if (c.type === "invoice") {
                                      const inv = v as InvoiceRef | null;
                                      content = inv?.label ? (
                                        <button
                                          type="button"
                                          onClick={() => setInvoiceView({ legacy: inv.legacyInvoiceId ?? null, modern: inv.modernInvoiceId ?? null })}
                                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline dark:text-emerald-400"
                                          title={`View invoice ${inv.label}`}
                                        >
                                          <Eye className="h-4 w-4" /> {inv.label}
                                        </button>
                                      ) : null;
                                    } else if (c.type === "badge") {
                                      const s = String(v ?? "");
                                      const ok = s === "Complete" || s === "Approved" || s === "Clear";
                                      content = (
                                        <Badge
                                          variant="secondary"
                                          className={ok
                                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                                            : "bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"}
                                        >
                                          {s}
                                        </Badge>
                                      );
                                    }
                                    return (
                                      <TableCell key={c.key} className={`align-top ${alignClass(c.align)}`}>
                                        {content}
                                      </TableCell>
                                    );
                                  })}
                                  {detail.editableBank && (
                                    <TableCell className="text-center whitespace-nowrap">
                                      {!r.editable ? (
                                        <span className="text-[11px] text-muted-foreground">Old DRM</span>
                                      ) : isEditing ? (
                                        <div className="flex justify-center gap-1">
                                          <Button
                                            size="sm"
                                            className="h-7 bg-[#009a54] px-2 hover:bg-[#008246]"
                                            disabled={updateMutation.isPending}
                                            onClick={() => {
                                              if (!editing!.createAt || !editing!.amount) {
                                                toast({ title: "Date and Amount are required!", variant: "destructive" });
                                                return;
                                              }
                                              updateMutation.mutate(editing!);
                                            }}
                                          >
                                            <Save className="mr-1 h-3.5 w-3.5" /> {updateMutation.isPending ? "Saving..." : "Save"}
                                          </Button>
                                          <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => setEditing(null)}>
                                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="h-7 px-2"
                                          onClick={() => setEditing({ id: r.id, createAt: r.dateIso, amount: String(r.amount), detail: r.detail ?? "" })}
                                        >
                                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                                        </Button>
                                      )}
                                    </TableCell>
                                  )}
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                        {detail.footer && (
                          <TableFooter>
                            <TableRow className="font-bold">
                              {detail.columns.map((c) => (
                                <TableCell key={c.key} className={alignClass(c.align)}>
                                  {detail.footer![c.key] === undefined ? "" : cellText(c, detail.footer![c.key])}
                                </TableCell>
                              ))}
                              {detail.editableBank && <TableCell />}
                            </TableRow>
                          </TableFooter>
                        )}
                      </Table>
                    </div>
                    <Pager page={detailPage} total={visibleRows.length} onPage={setDetailPage} />
                    {visibleRows.length <= PAGE_SIZE && (
                      <div className="text-[12px] text-muted-foreground">
                        Showing {visibleRows.length} of {detail.rows.length} entries
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {invoiceView && (
        <InvoiceViewDialog legacyInvoiceId={invoiceView.legacy} modernInvoiceId={invoiceView.modern} onClose={() => setInvoiceView(null)} />
      )}
      <Dialog open={seeMore !== null} onOpenChange={(o) => !o && setSeeMore(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-[13px]">{plainDetail(seeMore ?? "")}</div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSeeMore(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}
