import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuthHeader, apiRequestJson } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowDown, 
  ChevronDown, 
  Calendar, 
  Send, 
  Eye, 
  FileText, 
  X, 
  FileSpreadsheet, 
  ArrowRight, 
  Loader2,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  Filter,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Download
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useLocation } from "wouter";

function safeDate(val: any, fmt = "yyyy-MM-dd", fallback = "-"): string {
  if (!val) return fallback;
  if (typeof val === "string" && !/^\d{4}/.test(val) && !/^\d{1,2}[\/-]\d{1,2}/.test(val)) {
    return val;
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return format(d, fmt);
  } catch {
    return String(val);
  }
}

function exportToCsv(filename: string, rows: any[]) {
  if (!rows || !rows.length) return;
  const separator = ",";
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    "\n" +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? "" : String(row[k]);
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ModernPaymentTable({ 
  items = [], 
  isLoan = false, 
  onView, 
  onAttach,
  page = 1,
  pageSize = 10,
  onPageChange
}: any) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm custom-scrollbar">
        <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/75 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold text-[11px]">
              <th className="py-3 px-3 text-center w-10">#</th>
              <th className="py-3 px-4">Drm id</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4 min-w-[220px]">Company</th>
              <th className="py-3 px-4">Sale Person</th>
              <th className="py-3 px-4 font-bold text-slate-700 dark:text-zinc-200">Dollar</th>
              <th className="py-3 px-4">Cus Dollar</th>
              <th className="py-3 px-4">Pkr</th>
              <th className="py-3 px-4">Dollar Rate</th>
              <th className="py-3 px-4">Exchange Rate</th>
              {isLoan && <th className="py-3 px-4">Loan Amount</th>}
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-3 text-center w-16">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item: any, idx: number) => {
                const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr 
                    key={item.id || idx} 
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-3 text-center font-normal text-slate-400">{globalIndex}</td>
                    <td className="py-3.5 px-4 font-bold italic text-[#00a65a] dark:text-emerald-400 uppercase tracking-tight">
                      {item.drmId || "-"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                      {safeDate(item.date, "yyyy-MM-dd")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-tight max-w-[280px] truncate" title={item.company}>
                      {item.company || "-"}
                    </td>
                    <td className="py-3.5 px-4 italic text-slate-500 dark:text-zinc-400">
                      {item.salePerson || "-"}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-zinc-100">
                      $ {Number(item.dollar || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300">
                      $ {Number(item.customerDollar || item.dollar || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-semibold">
                      {Number(item.pkr || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                      {item.rate ? Number(item.rate).toFixed(4) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">
                      {item.exDisc ? Number(item.exDisc).toFixed(4) : "78.0000"}
                    </td>
                    {isLoan && (
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-zinc-100">
                        $ {Number(item.loanAmount || item.dollar || 0).toFixed(2)}
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      {item.type ? (
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase inline-block",
                          item.type === "New" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" :
                          item.type === "Rc"  ? "bg-blue-50 text-blue-700 border border-blue-200/60" :
                          item.type === "Ec"  ? "bg-purple-50 text-purple-700 border border-purple-200/60" :
                          "bg-slate-100 text-slate-600 border border-slate-200"
                        )}>
                          {item.type}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                        item.status === "Approved" || !item.status || item.status === "Paid"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : item.status === "Pending"
                          ? "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400"
                      )}>
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          item.status === "Approved" || !item.status || item.status === "Paid" ? "bg-emerald-500" :
                          item.status === "Pending" ? "bg-amber-500" : "bg-rose-500"
                        )} />
                        {item.status === "Approved" ? "Paid" : item.status || "Paid"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          onClick={() => onAttach(item)} 
                          title="Attach"
                          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <FileText size={14} className={item.proofUrl ? "text-[#00a65a]" : "text-slate-400"} />
                        </button>
                        <button 
                          onClick={() => onView(item)} 
                          title="View Details"
                          className="p-1 rounded hover:bg-emerald-50 text-emerald-600 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={isLoan ? 14 : 13} className="py-12 text-center text-slate-400 font-medium italic">
                  No records available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Summary footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 text-xs text-slate-500">
        <div>
          Showing {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, items.length)} of {items.length} entries
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors",
                  currentPage === p
                    ? "bg-[#00a65a] text-white shadow-sm"
                    : "border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DollarSystem() {
  const [, setLocation] = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  useEffect(() => { 
    const w = sidebarOpen; 
    setSidebarOpen(false); 
    return () => setSidebarOpen(w); 
  }, []);

  const [periodFilter, setPeriodFilter] = useState("Current");
  const [activeTab, setActiveTab] = useState("full");
  const [activeTxTab, setActiveTxTab] = useState("balance");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Pagination states
  const [fullPage, setFullPage] = useState(1);
  const [partialPage, setPartialPage] = useState(1);
  const [loanPage, setLoanPage] = useState(1);

  // Modals
  const [viewItem, setViewItem] = useState<any>(null);
  const [attachItem, setAttachItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/account/dollar-system/list"],
    queryFn: () => apiRequestJson("GET", "/api/account/dollar-system/list")
  });

  const ws = data?.walletStats || {};
  const fullPayments = data?.fullPayments || [];
  const partialPayments = data?.partialPayments || [];
  const loans = data?.loans || [];
  const pendingApprovals = data?.pendingApprovals || [];
  const alibabaPayments = data?.alibabaPayments || [];
  const abLiabilities = data?.abLiabilities || {};
  const dts = data?.dailyTxSummary || {
    balance: { count: 0, sum: 0, items: [] },
    buy: { count: 0, sum: 0, items: [] },
    sell: { count: 0, sum: 0, items: [] },
    martini: { count: 0, sum: 0, items: [] },
    notUsed: { count: 0, sum: 0, items: [] }
  };
  const counts = data?.counts || { full: 0, partial: 0, pending: 0, temp: 0 };

  const filterList = (arr: any[]) => arr.filter((item: any) => {
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      if (!Object.values(item).some(v => String(v || "").toLowerCase().includes(t))) return false;
    }
    const d = item.date || item.abDate || item.createdAt;
    if (d) {
      try {
        const ds = safeDate(d, "yyyy-MM-dd", "");
        if (startDate && ds < startDate) return false;
        if (endDate && ds > endDate) return false;
      } catch { return true; }
    } else if (startDate || endDate) return false;
    return true;
  });

  // Filtered lists
  const filteredFullBase = useMemo(() => filterList(fullPayments), [fullPayments, searchTerm, startDate, endDate]);
  const ncFullCount = useMemo(() => filteredFullBase.filter((p: any) => p.type === "New").length, [filteredFullBase]);
  const rcFullCount = useMemo(() => filteredFullBase.filter((p: any) => p.type === "Rc" || p.type === "Rc-Up").length, [filteredFullBase]);
  const ecFullCount = useMemo(() => filteredFullBase.filter((p: any) => p.type === "Ec").length, [filteredFullBase]);

  const fFull = useMemo(() => {
    if (typeFilter === "all") return filteredFullBase;
    if (typeFilter === "Rc") return filteredFullBase.filter((p: any) => p.type === "Rc" || p.type === "Rc-Up");
    return filteredFullBase.filter((p: any) => p.type === typeFilter);
  }, [filteredFullBase, typeFilter]);

  const fPartial = useMemo(() => filterList(partialPayments), [partialPayments, searchTerm, startDate, endDate]);
  const fLoan = useMemo(() => filterList(loans), [loans, searchTerm, startDate, endDate]);
  const fPend = useMemo(() => filterList(pendingApprovals), [pendingApprovals, searchTerm, startDate, endDate]);
  const fAb = useMemo(() => filterList(alibabaPayments), [alibabaPayments, searchTerm, startDate, endDate]);

  const txItems = useMemo(() => {
    const m: any = { 
      balance: dts.balance?.items || [], 
      buy: dts.buy?.items || [], 
      sell: dts.sell?.items || [], 
      martini: dts.martini?.items || [], 
      notUsed: dts.notUsed?.items || [] 
    };
    return m[activeTxTab] || [];
  }, [activeTxTab, dts]);

  const fmt2 = (v: any) => Number(v || 0).toFixed(2);
  const fmtN = (v: any) => Number(v || 0).toLocaleString();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-[#00a65a]" />
      </div>
    );
  }

  return (
    <>
      {/* View Detail Modal */}
      {viewItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="font-bold text-base uppercase tracking-wider flex items-center gap-2">
                <FileText size={18} /> Record Details
              </div>
              <button onClick={() => setViewItem(null)} className="text-white/80 hover:text-white rounded-lg p-1 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {[
                ["DRM ID", viewItem.drmId],
                ["Company", viewItem.company],
                ["Sale Person", viewItem.salePerson],
                ["Member ID", viewItem.memberId],
                ["Date", safeDate(viewItem.date, "dd MMM yyyy")],
                ["Product", viewItem.package],
                ["Order Type", viewItem.type],
                ["Contract No", viewItem.orderId],
                ["Dollar", viewItem.dollar ? `$ ${Number(viewItem.dollar).toFixed(2)}` : "-"],
                ["Cus Dollar", viewItem.customerDollar ? `$ ${Number(viewItem.customerDollar).toFixed(2)}` : "-"],
                ["PKR", viewItem.pkr ? `PKR ${Number(viewItem.pkr).toLocaleString()}` : "-"],
                ["Dollar Rate", viewItem.rate ? `PKR ${viewItem.rate}` : "-"],
                ["Exchange Rate", viewItem.exDisc ? `${viewItem.exDisc}` : "-"],
                ["Status", viewItem.status || "Paid"]
              ].map(([l, v]) => (
                <div key={l} className="flex items-start justify-between py-1.5 border-b border-slate-100 dark:border-zinc-800 text-xs">
                  <span className="font-semibold text-slate-400 uppercase tracking-tight">{l}</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 text-right">{v || "-"}</span>
                </div>
              ))}
              {viewItem.proofUrl && (
                <div className="pt-3">
                  <a href={viewItem.proofUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white py-2.5 rounded-xl text-xs font-bold uppercase shadow-sm transition-all">
                    <Eye size={16} /> View Attached Proof
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>, document.body
      )}

      {/* Attach File Modal */}
      {attachItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setAttachItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-100 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="font-bold text-base uppercase tracking-wider flex items-center gap-2">
                <FileText size={18} /> Attach Document
              </div>
              <button onClick={() => setAttachItem(null)} className="text-white/80 hover:text-white rounded-lg p-1 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-500 font-semibold">
                Record: <span className="text-slate-800 dark:text-zinc-200 font-bold">{attachItem.company || attachItem.drmId}</span>
              </div>
              {attachItem.proofUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 text-emerald-700 text-xs font-bold">
                    <CheckCircle2 size={16} /> Document is already attached
                  </div>
                  <a href={attachItem.proofUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white py-2.5 rounded-xl text-xs font-bold uppercase shadow-sm transition-all">
                    <Eye size={16} /> View Current Document
                  </a>
                  <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-bold uppercase transition-all">
                    Replace Document
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-zinc-800/30">
                    <FileText size={36} className="text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 font-semibold">No file attached yet</div>
                  </div>
                  <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-[#00a65a] hover:bg-[#008d4c] text-white py-2.5 rounded-xl text-xs font-bold uppercase shadow-sm transition-all">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {uploading ? "Uploading..." : "Upload Document"}
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={async(e) => {
                const f = e.target.files?.[0]; 
                if (!f) return; 
                setUploading(true);
                try {
                  const fd = new FormData(); 
                  fd.append("file", f); 
                  fd.append("entryId", String(attachItem.id));
                  const r = await fetch("/api/account/dollar-system/attach", {
                    method: "POST",
                    headers: getAuthHeader(),
                    credentials: "include",
                    body: fd
                  });
                  if (r.ok) {
                    const d = await r.json();
                    setAttachItem((p: any) => ({ ...p, proofUrl: d.proofUrl }));
                  } else {
                    alert("Upload failed.");
                  }
                } catch {
                  alert("Upload failed.");
                } finally {
                  setUploading(false);
                  if (fileRef.current) fileRef.current.value = "";
                }
              }} />
            </div>
          </div>
        </div>, document.body
      )}

      {/* Main Container */}
      <div className="min-h-screen bg-[#f8fafc] dark:bg-zinc-950 font-sans text-slate-700 dark:text-zinc-300 p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="max-w-[1700px] mx-auto space-y-6">

          {/* ========================================================================= */}
          {/* TOP SECTION: WALLETS CARD (MATCHING USER SCREENSHOT)                      */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 p-6 space-y-5">
            {/* Header: Icon + Title + Subtitle + Buttons & Period Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">Wallets</h1>
                  <p className="text-xs text-slate-400 font-medium">Your account balance and recovery details</p>
                </div>
              </div>

              {/* Action Buttons & Period Filter */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Wallet Action Buttons */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-800/60 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-700">
                  <button 
                    onClick={() => setLocation("/account/dollar-buying")}
                    className="px-3 py-1.5 rounded-lg bg-[#00a65a] hover:bg-[#008d4c] text-white text-[11px] font-bold tracking-tight shadow-sm transition-all"
                  >
                    Receive
                  </button>
                  <button 
                    onClick={() => setLocation("/account/dollar-pay")}
                    className="px-3 py-1.5 rounded-lg bg-[#00a65a] hover:bg-[#008d4c] text-white text-[11px] font-bold tracking-tight shadow-sm transition-all"
                  >
                    Send
                  </button>
                  <button 
                    onClick={() => setLocation("/account/dollar-advance-payment")}
                    className="px-3 py-1.5 rounded-lg bg-[#00a65a] hover:bg-[#008d4c] text-white text-[11px] font-bold tracking-tight shadow-sm transition-all"
                  >
                    Advance Pay
                  </button>
                </div>

                {/* Period Filter Dropdown */}
                <div className="relative">
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                    className="appearance-none bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="Current">Current</option>
                    <option value="Current Q">Current Q</option>
                    <option value="Last Q">Last Q</option>
                    <option value="Last S">Last S</option>
                    <option value="Last Y">Last Y</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 6 Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Card 1: Available Balance */}
              <div className="bg-[#f2faf7] dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Wallet size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Available Balance</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    C $ {fmt2(ws.availableCash || 8895)}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                    PKR {fmtN(ws.availableCashPkr || 1635000)}
                  </div>
                </div>
              </div>

              {/* Card 2: Required Balance to Pay */}
              <div className="bg-[#f4f8fe] dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-blue-100/90 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <ArrowUpRight size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Required Balance to Pay</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    PKR {fmtN(ws.requiredToPay || 2600000)}
                  </div>
                </div>
              </div>

              {/* Card 3: Cash in Hand */}
              <div className="bg-[#faf5ff] dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-purple-100/90 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <DollarSign size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Cash in Hand</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    PKR {fmtN(ws.cashInHand || 1635000)}
                  </div>
                </div>
              </div>

              {/* Card 4: Dollar Recovery */}
              <div className="bg-[#f0fdf9] dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-teal-100/90 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <RefreshCw size={15} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Dollar Recovery</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    C $ {fmt2(ws.dollarRecovered)}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                    PKR {fmt2(ws.dollarRecoveredPkr || 0)}
                  </div>
                </div>
              </div>

              {/* Card 5: Cash Recovery */}
              <div className="bg-[#fff5f5] dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-rose-100/90 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <ArrowDown size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Cash Recovery</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    PKR {fmt2(ws.cashRecovered)}
                  </div>
                </div>
              </div>

              {/* Card 6: Partial Dollars Recovery */}
              <div className="bg-[#f0f9ff] dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all hover:shadow-md">
                <div className="w-8 h-8 rounded-lg bg-sky-100/90 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-0.5">Partial Dollars Recovery</div>
                  <div className="text-[17px] font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
                    $ {fmt2(ws.partialDollarsRecovery)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MAIN PAYMENT TABLE CARD (MATCHING USER SCREENSHOT)                        */}
          {/* ========================================================================= */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 p-6 space-y-6">

            {/* Header & Controls Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
              
              {/* Left: Title + Red Count Badge */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={18} />
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                  {activeTab === "full" ? "Full Payment Received" :
                   activeTab === "partial" ? "Partial Payment Received" :
                   activeTab === "term" ? "Tem Payment" :
                   activeTab === "ab_liabilities" ? "AB Liabilities" : "Daily Transactions"}
                </h2>
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center shadow-sm">
                  {activeTab === "full" ? fFull.length :
                   activeTab === "partial" ? fPartial.length :
                   activeTab === "term" ? (counts.temp || 0) :
                   activeTab === "ab_liabilities" ? "-" : fPend.length}
                </span>
              </div>

              {/* Right: Search, Date Pickers, Filter & Export Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative w-full sm:w-64 md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <Input 
                    placeholder="Search by company, ID, or person..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="h-9 pl-9 rounded-xl border-slate-200 dark:border-zinc-700 shadow-none text-xs focus-visible:ring-emerald-500/20"
                  />
                </div>

                {/* Start Date */}
                <div className="relative">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="h-9 w-36 text-xs rounded-xl border-slate-200 dark:border-zinc-700 pr-8"
                  />
                  <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                </div>

                {/* End Date */}
                <div className="relative">
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="h-9 w-36 text-xs rounded-xl border-slate-200 dark:border-zinc-700 pr-8"
                  />
                  <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                </div>

                {/* Filter / Reset Button */}
                <Button 
                  onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setTypeFilter("all"); }}
                  className="bg-[#475569] hover:bg-[#334155] text-white text-xs font-semibold px-4 h-9 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Filter size={14} /> Filter
                </Button>

                {/* Export Excel Button */}
                <Button 
                  onClick={() => {
                    const dataToExport = activeTab === "full" ? fFull : activeTab === "partial" ? fPartial : fLoan;
                    exportToCsv(`${activeTab}_payments_${format(new Date(), "yyyyMMdd")}`, dataToExport);
                  }}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs font-semibold px-4 h-9 rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download size={14} /> Export Excel
                </Button>
              </div>
            </div>

            {/* Navigation Tabs (Full / Partial / Tem Payment / AB Liabilities) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "full", label: `Full (${fullPayments.length || counts.full || 0})` },
                  { id: "partial", label: `Partial ${partialPayments.length || counts.partial || 0}` },
                  { id: "term", label: `Tem Payment ${counts.temp || 0}` },
                  { id: "ab_liabilities", label: "AB Liabilities" },
                  { id: "daily_tx", label: "Daily Transactions" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                      activeTab === t.id
                        ? "bg-[#00a65a] text-white shadow-sm"
                        : "bg-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-type Filters (All, NC, RC, EC) for Full/Partial */}
              {activeTab === "full" && (
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800/60 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-700">
                  <button
                    onClick={() => setTypeFilter("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                      typeFilter === "all" ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                    )}
                  >
                    All ({filteredFullBase.length})
                  </button>
                  <button
                    onClick={() => setTypeFilter(typeFilter === "New" ? "all" : "New")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      typeFilter === "New" ? "bg-[#00a65a] text-white shadow-sm" : "text-emerald-700 hover:bg-emerald-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <span>NC</span>
                    <span>({ncFullCount})</span>
                  </button>
                  <button
                    onClick={() => setTypeFilter(typeFilter === "Rc" ? "all" : "Rc")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      typeFilter === "Rc" ? "bg-blue-600 text-white shadow-sm" : "text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <span>RC</span>
                    <span>({rcFullCount})</span>
                  </button>
                  <button
                    onClick={() => setTypeFilter(typeFilter === "Ec" ? "all" : "Ec")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                      typeFilter === "Ec" ? "bg-purple-600 text-white shadow-sm" : "text-purple-600 hover:bg-purple-50 dark:hover:bg-zinc-800"
                    )}
                  >
                    <span>EC</span>
                    <span>({ecFullCount})</span>
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTENT */}
            {activeTab === "full" && (
              <ModernPaymentTable 
                items={fFull} 
                onView={setViewItem} 
                onAttach={setAttachItem}
                page={fullPage}
                pageSize={10}
                onPageChange={setFullPage}
              />
            )}

            {activeTab === "partial" && (
              <ModernPaymentTable 
                items={fPartial} 
                onView={setViewItem} 
                onAttach={setAttachItem}
                page={partialPage}
                pageSize={10}
                onPageChange={setPartialPage}
              />
            )}

            {activeTab === "term" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800 dark:text-zinc-200">Temporary Payment Records</div>
                  <Button className="bg-[#f06464] hover:bg-[#d9534f] text-white h-9 px-4 font-bold text-xs rounded-xl">
                    Generate Email
                  </Button>
                </div>
                <div className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-semibold">
                        {["No", "Date", "Channel Partner", "Member Id", "Company Name", "Product Purchased", "Order Type", "Contract No", "Contract Amount", "Action"].map(h => (
                          <th key={h} className="py-3 px-4">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-medium italic">
                          No temporary payment records available
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "ab_liabilities" && (
              <div className="space-y-4">
                <div className="max-w-3xl rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <Table className="text-xs">
                    <TableHeader className="bg-slate-50 dark:bg-zinc-800/50">
                      <TableRow>
                        {["Payment Type", "Mode", "USD", "PKR"].map(h => (
                          <TableHead key={h} className="py-3.5 px-4 font-bold text-slate-700 dark:text-zinc-200 uppercase">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                      {[
                        {
                          t: "Full Payment",
                          rows: [
                            { m: "Online Paid", u: Number(abLiabilities.fullOnlinePaidUsd || 0), p: Number(abLiabilities.fullOnlinePaidPkr || 0) },
                            { m: "Cash Received", u: Number(abLiabilities.fullCashReceivedUsd || 0), p: Number(abLiabilities.fullCashReceivedPkr || 0) },
                          ]
                        },
                        {
                          t: "Partial Payment",
                          rows: [
                            { m: "Online Paid", u: Number(abLiabilities.partialOnlinePaidUsd || 0), p: Number(abLiabilities.partialOnlinePaidPkr || 0) },
                            { m: "Cash Received", u: Number(abLiabilities.partialCashReceivedUsd || 0), p: Number(abLiabilities.partialCashReceivedPkr || 0) },
                          ]
                        }
                      ].map((s, si) => s.rows.map((r, ri) => (
                        <TableRow key={s.t + ri} className="hover:bg-slate-50/50">
                          {ri === 0 && <TableCell rowSpan={s.rows.length} className="py-3.5 px-4 font-bold text-slate-800 dark:text-zinc-200 border-r">{s.t}</TableCell>}
                          <TableCell className="py-3.5 px-4 text-slate-500">{r.m}</TableCell>
                          <TableCell className="py-3.5 px-4 font-bold text-emerald-600">$ {fmt2(r.u)}</TableCell>
                          <TableCell className="py-3.5 px-4 font-bold text-rose-500">PKR {fmtN(r.p)}</TableCell>
                        </TableRow>
                      )))}
                      <TableRow className="bg-slate-50 dark:bg-zinc-800/60 font-bold">
                        <TableCell className="py-3.5 px-4 border-r uppercase">Total</TableCell>
                        <TableCell className="py-3.5 px-4 text-slate-500">All Payments</TableCell>
                        <TableCell className="py-3.5 px-4 text-emerald-600 text-sm">
                          $ {fmt2(Number(abLiabilities.fullOnlinePaidUsd || 0) + Number(abLiabilities.fullCashReceivedUsd || 0) + Number(abLiabilities.partialOnlinePaidUsd || 0) + Number(abLiabilities.partialCashReceivedUsd || 0))}
                        </TableCell>
                        <TableCell className="py-3.5 px-4 text-rose-500 text-sm">
                          PKR {fmtN(Number(abLiabilities.fullOnlinePaidPkr || 0) + Number(abLiabilities.fullCashReceivedPkr || 0) + Number(abLiabilities.partialOnlinePaidPkr || 0) + Number(abLiabilities.partialCashReceivedPkr || 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === "daily_tx" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "balance", label: "Balance", c: "bg-slate-800 text-white" },
                    { id: "buy", label: "Buy", c: "bg-[#00a65a] text-white" },
                    { id: "sell", label: "Sell", c: "bg-rose-500 text-white" },
                    { id: "martini", label: "Martini", c: "bg-blue-500 text-white" },
                    { id: "notUsed", label: "Not Used", c: "bg-amber-500 text-white" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTxTab(tab.id)}
                      className={cn(
                        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                        activeTxTab === tab.id ? tab.c : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] opacity-80">({dts[tab.id]?.count || 0})</span>
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 font-semibold">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Rate</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {txItems.length > 0 ? (
                        txItems.map((tx: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">{tx.name || "-"}</td>
                            <td className="py-3 px-4 text-slate-500">{safeDate(tx.date, "dd MMM yyyy")}</td>
                            <td className="py-3 px-4 text-blue-500">{tx.email || "-"}</td>
                            <td className="py-3 px-4 font-semibold text-slate-700">{tx.rate || "-"}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">$ {Number(tx.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400 font-medium italic">
                            No transactions for today
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}
