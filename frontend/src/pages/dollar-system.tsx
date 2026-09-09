import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuthHeader } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Wallet,
  ArrowUp,
  Download,
  PlusCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Send,
  Plus,
  Eye,
  FileText,
  X,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  User,
  Loader2
} from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function DollarSystem() {
    const [fullSearchTerm, setFullSearchTerm] = useState("");
    const [fullStartDate, setFullStartDate] = useState("");
    const [fullEndDate, setFullEndDate] = useState("");
    const [partialSearchTerm, setPartialSearchTerm] = useState("");
    const [partialStartDate, setPartialStartDate] = useState("");
    const [partialEndDate, setPartialEndDate] = useState("");
    const [abSearchTerm, setAbSearchTerm] = useState("");
    const [abStartDate, setAbStartDate] = useState("");
    const [abEndDate, setAbEndDate] = useState("");
    const [pendingSearchTerm, setPendingSearchTerm] = useState("");
    const [pendingStartDate, setPendingStartDate] = useState("");
    const [pendingEndDate, setPendingEndDate] = useState("");
    const [loanSearchTerm, setLoanSearchTerm] = useState("");
    const [loanStartDate, setLoanStartDate] = useState("");
    const [loanEndDate, setLoanEndDate] = useState("");
    const [activeTab, setActiveTab] = useState("full"); // Tab State: full, partial, term, ab_liabilities
    const [viewItem, setViewItem] = useState<any>(null);      // For View Detail Modal
    const [attachItem, setAttachItem] = useState<any>(null);  // For Attach Modal
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: fullData, isLoading } = useQuery({
        queryKey: ["/api/account/dollar-system/list"],
        queryFn: async () => {
            const res = await fetch(`/api/account/dollar-system/list`, { headers: getAuthHeader(), credentials: "include" });
            if (!res.ok) throw new Error("Fetch failed");
            return res.json();
        }
    });

    const { 
        walletStats = {
            availableCash: "0",
            availableCashPkr: "0",
            availableLoan: "0",
            availableLoanPkr: "0",
            requiredToPay: "0",
            cashInHand: "0",
            cashRecovered: "0",
            dollarRecovered: "0",
            abPaidUsd: "0",
            abPaidPkr: "0",
        }, 
        fullPayments = [], 
        partialPayments = [], 
        loans = [], 
        pendingApprovals = [], 
        alibabaPayments = [],
        abLiabilities = {},
        transactions = [],
        counts = { full: 0, partial: 0, pending: 0, temp: 0, liabilities: 0 }
    } = fullData || {};

    const filteredFullPayments = useMemo(() => {
        return (fullPayments || []).filter((item: any) => {
            if (fullSearchTerm) {
                const term = fullSearchTerm.toLowerCase();
                const matches = 
                    (item.drmId || "").toLowerCase().includes(term) ||
                    (item.company || "").toLowerCase().includes(term) ||
                    (item.salePerson || "").toLowerCase().includes(term) ||
                    (item.orderId || "").toLowerCase().includes(term) ||
                    (item.package || "").toLowerCase().includes(term) ||
                    (item.type || "").toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (item.date) {
                const itemDateStr = format(new Date(item.date), "yyyy-MM-dd");
                if (fullStartDate && itemDateStr < fullStartDate) return false;
                if (fullEndDate && itemDateStr > fullEndDate) return false;
            } else if (fullStartDate || fullEndDate) {
                return false;
            }
            return true;
        });
    }, [fullPayments, fullSearchTerm, fullStartDate, fullEndDate]);

    const filteredPartialPayments = useMemo(() => {
        return (partialPayments || []).filter((item: any) => {
            if (partialSearchTerm) {
                const term = partialSearchTerm.toLowerCase();
                const matches = 
                    (item.drmId || "").toLowerCase().includes(term) ||
                    (item.company || "").toLowerCase().includes(term) ||
                    (item.salePerson || "").toLowerCase().includes(term) ||
                    (item.orderId || "").toLowerCase().includes(term) ||
                    (item.package || "").toLowerCase().includes(term) ||
                    (item.type || "").toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (item.date) {
                const itemDateStr = format(new Date(item.date), "yyyy-MM-dd");
                if (partialStartDate && itemDateStr < partialStartDate) return false;
                if (partialEndDate && itemDateStr > partialEndDate) return false;
            } else if (partialStartDate || partialEndDate) {
                return false;
            }
            return true;
        });
    }, [partialPayments, partialSearchTerm, partialStartDate, partialEndDate]);

    const filteredAlibabaPayments = useMemo(() => {
        return (alibabaPayments || []).filter((item: any) => {
            if (abSearchTerm) {
                const term = abSearchTerm.toLowerCase();
                const matches = 
                    (item.drmId || "").toLowerCase().includes(term) ||
                    (item.company || "").toLowerCase().includes(term) ||
                    (item.abId || "").toLowerCase().includes(term) ||
                    (item.orderId || "").toLowerCase().includes(term) ||
                    (item.status || "").toLowerCase().includes(term);
                if (!matches) return false;
            }
            const checkDate = item.abDate || item.date;
            if (checkDate) {
                const itemDateStr = format(new Date(checkDate), "yyyy-MM-dd");
                if (abStartDate && itemDateStr < abStartDate) return false;
                if (abEndDate && itemDateStr > abEndDate) return false;
            } else if (abStartDate || abEndDate) {
                return false;
            }
            return true;
        });
    }, [alibabaPayments, abSearchTerm, abStartDate, abEndDate]);

    const filteredPendingApprovals = useMemo(() => {
        return (pendingApprovals || []).filter((item: any) => {
            if (pendingSearchTerm) {
                const term = pendingSearchTerm.toLowerCase();
                const matches = 
                    (item.drmId || "").toLowerCase().includes(term) ||
                    (item.company || "").toLowerCase().includes(term) ||
                    (item.salePerson || "").toLowerCase().includes(term) ||
                    (item.package || "").toLowerCase().includes(term) ||
                    (item.type || "").toLowerCase().includes(term) ||
                    (item.status || "").toLowerCase().includes(term);
                if (!matches) return false;
            }
            const checkDate = item.date || item.createdAt;
            if (checkDate) {
                const itemDateStr = format(new Date(checkDate), "yyyy-MM-dd");
                if (pendingStartDate && itemDateStr < pendingStartDate) return false;
                if (pendingEndDate && itemDateStr > pendingEndDate) return false;
            } else if (pendingStartDate || pendingEndDate) {
                return false;
            }
            return true;
        });
    }, [pendingApprovals, pendingSearchTerm, pendingStartDate, pendingEndDate]);

    const filteredLoans = useMemo(() => {
        return (loans || []).filter((item: any) => {
            if (loanSearchTerm) {
                const term = loanSearchTerm.toLowerCase();
                const matches = 
                    (item.drmId || "").toLowerCase().includes(term) ||
                    (item.company || "").toLowerCase().includes(term) ||
                    (item.salePerson || "").toLowerCase().includes(term) ||
                    (item.orderId || "").toLowerCase().includes(term) ||
                    (item.package || "").toLowerCase().includes(term) ||
                    (item.type || "").toLowerCase().includes(term);
                if (!matches) return false;
            }
            if (item.date) {
                const itemDateStr = format(new Date(item.date), "yyyy-MM-dd");
                if (loanStartDate && itemDateStr < loanStartDate) return false;
                if (loanEndDate && itemDateStr > loanEndDate) return false;
            } else if (loanStartDate || loanEndDate) {
                return false;
            }
            return true;
        });
    }, [loans, loanSearchTerm, loanStartDate, loanEndDate]);

    const fullTotalUsd = useMemo(() => (filteredFullPayments || []).reduce((acc: number, item: any) => acc + (Number(item.dollar) || 0), 0), [filteredFullPayments]);
    const fullTotalPkr = useMemo(() => (filteredFullPayments || []).reduce((acc: number, item: any) => acc + (Number(item.pkr) || 0), 0), [filteredFullPayments]);

    const partialTotalUsd = useMemo(() => (filteredPartialPayments || []).reduce((acc: number, item: any) => acc + (Number(item.dollar) || 0), 0), [filteredPartialPayments]);
    const partialTotalPkr = useMemo(() => (filteredPartialPayments || []).reduce((acc: number, item: any) => acc + (Number(item.pkr) || 0), 0), [filteredPartialPayments]);

    if (isLoading) return (
        <div className="flex h-screen items-center justify-center bg-white flex-col gap-4 dark:bg-zinc-900">
            <Loader2 className="h-10 w-10 animate-spin text-[#00a65a] dark:text-zinc-400" />
        </div>
    );

    return (
        <>
            {/* ─── VIEW DETAIL MODAL ─── */}
            {viewItem && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" style={{backdropFilter:'blur(4px)'}} onClick={() => setViewItem(null)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#f39c12] px-6 py-4 flex items-center justify-between">
                            <div className="text-white font-[1000] text-lg uppercase tracking-tight">Record Details</div>
                            <button onClick={() => setViewItem(null)} className="text-white hover:text-white/70 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {[
                                { label: 'DRM ID', value: viewItem.drmId },
                                { label: 'Company', value: viewItem.company },
                                { label: 'Channel Partner', value: viewItem.salePerson },
                                { label: 'Member ID', value: viewItem.memberId },
                                { label: 'Date', value: viewItem.date ? format(new Date(viewItem.date), 'dd MMM yyyy') : '-' },
                                { label: 'Product', value: viewItem.package },
                                { label: 'Order Type', value: viewItem.type },
                                { label: 'Contract No', value: viewItem.orderId },
                                { label: 'Contract Amount', value: viewItem.dollar ? `$ ${viewItem.dollar}` : '-' },
                                { label: 'PKR Amount', value: viewItem.pkr ? `PKR ${Number(viewItem.pkr).toLocaleString()}` : '-' },
                                { label: 'Rate', value: viewItem.rate ? `PKR ${viewItem.rate}` : '-' },
                                { label: 'Notes', value: viewItem.notes || '-' },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-start gap-2 text-[12px]">
                                    <span className="w-36 font-black text-gray-500 uppercase shrink-0 dark:text-zinc-400">{label}</span>
                                    <span className="font-bold text-gray-800 dark:text-zinc-200">{value || '-'}</span>
                                </div>
                            ))}
                            {viewItem.proofUrl && (
                                <div className="pt-3 border-t border-gray-100 dark:border-zinc-800">
                                    <a href={viewItem.proofUrl} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-2 bg-[#00a65a] text-white px-4 py-2 rounded-md text-[11px] font-black uppercase hover:bg-[#008d4c] transition-colors">
                                        <Eye size={14}/> View Attached File
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ─── ATTACH MODAL ─── */}
            {attachItem && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" style={{backdropFilter:'blur(4px)'}} onClick={() => setAttachItem(null)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-[#f39c12] px-6 py-4 flex items-center justify-between">
                            <div className="text-white font-[1000] text-lg uppercase tracking-tight">Attach File</div>
                            <button onClick={() => setAttachItem(null)} className="text-white hover:text-white/70 transition-colors">
                                <X size={20}/>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">
                                Record: <span className="text-gray-800 dark:text-zinc-200">{attachItem.company || attachItem.drmId}</span>
                            </div>
                            {attachItem.proofUrl ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700">
                                        <FileText size={16} className="text-[#00a65a]"/>
                                        <span className="text-[11px] font-bold text-[#00a65a]">File already attached</span>
                                    </div>
                                    <a href={attachItem.proofUrl} target="_blank" rel="noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-[#00a65a] text-white px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-[#008d4c] transition-colors">
                                        <Eye size={14}/> View Current File
                                    </a>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-gray-50 transition-colors dark:border-zinc-700 dark:text-zinc-400"
                                    >Replace File</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center dark:border-zinc-700">
                                        <FileText size={32} className="text-gray-300 mx-auto mb-2"/>
                                        <div className="text-[11px] text-gray-400 font-bold">No file attached yet</div>
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 bg-[#f39c12] text-white px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-[#d97706] transition-colors"
                                    >
                                        {uploading ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                                        {uploading ? 'Uploading...' : 'Choose & Upload File'}
                                    </button>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploading(true);
                                    try {
                                        const fd = new FormData();
                                        fd.append('file', file);
                                        fd.append('entryId', String(attachItem.id));
                                        const res = await fetch('/api/account/dollar-system/attach', {
                                            method: 'POST',
                                            headers: getAuthHeader(),
                                            credentials: 'include',
                                            body: fd
                                        });
                                        if (res.ok) {
                                            const data = await res.json();
                                            setAttachItem((prev: any) => ({ ...prev, proofUrl: data.proofUrl }));
                                        } else {
                                            alert('Upload failed. Please try again.');
                                        }
                                    } catch {
                                        alert('Upload failed. Please try again.');
                                    } finally {
                                        setUploading(false);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            , document.body)}
            <div className="flex flex-col min-h-screen bg-[#f4f6f9] font-sans text-gray-700 dark:bg-zinc-950 dark:text-zinc-400">
                <div className="max-w-[1920px] mx-auto p-6 space-y-6">
                
                {/* ── ROW 1: WALLETS & DYNAMIC SECTION 1 ── */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    
                    {/* WALLETS (Previously Sidebar) */}
                    <aside className="w-full lg:w-[350px] shrink-0 bg-white border border-gray-200 rounded-lg shadow-sm h-fit overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="p-4 font-bold text-gray-800 text-lg border-b uppercase dark:text-zinc-100">Wallets</div>
                    <div className="p-4 space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] text-blue-400 font-bold">
                                <span>2024-04-01 To 2026-06-30</span>
                                <div className="border rounded px-1 flex items-center gap-1 text-gray-500 text-[10px] cursor-pointer dark:text-zinc-400">
                                    Current Q <ChevronRight size={10}/>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <div className="text-gray-600 font-bold text-sm dark:text-zinc-300">Available Balance</div>
                                    <div className="text-xl font-[1000] text-gray-900 border-b-2 border-emerald-500 inline-block dark:text-zinc-100">
                                        C $ {walletStats.availableCash || walletStats.dollarBalance || '0'}
                                    </div>
                                    <div className="text-[11px] text-gray-500 font-bold pb-2 dark:text-zinc-400">PKR {walletStats.availableCashPkr || walletStats.pkrBalance || '0'}</div>
                                    <div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">L $ {walletStats.availableLoan || walletStats.loanDollar || '0'}</div>
                                    <div className="text-[11px] text-gray-400 font-bold">PKR {walletStats.availableLoanPkr || walletStats.loanPkr || '0'}</div>
                                </div>
                                <div className="text-right space-y-4">
                                    <div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Dollars Recovery</div>
                                        <div className="text-lg font-[1000] text-gray-900 border-b-2 border-red-500 inline-block dark:text-zinc-100">$ {walletStats.dollarRecovered || '0'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Cash Recovery</div>
                                        <div className="text-lg font-[1000] text-gray-900 font-black dark:text-zinc-100">PKR {walletStats.cashRecovered || '0'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1 pt-2 border-t border-gray-50 dark:border-zinc-800">
                                <div className="text-[11px] text-gray-500 font-black uppercase dark:text-zinc-400">Required Balance To Pay</div>
                                <div className="text-xl font-[1000] text-gray-900 dark:text-zinc-100">$ {walletStats.requiredToPay || '0'}</div>
                            </div>
                            
                            <div className="space-y-1 pt-2 border-t border-gray-50 dark:border-zinc-800">
                                <div className="text-[11px] text-gray-500 font-black uppercase dark:text-zinc-400">Cash In Hand</div>
                                <div className="text-xl font-[1000] text-gray-900 dark:text-zinc-100">PKR {Number(walletStats.cashInHand || 0).toLocaleString()}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-zinc-800">
                                <div>
                                    <div className="text-[11px] text-[#00a65a] font-black uppercase dark:text-zinc-400">Cash Recovered</div>
                                    <div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">PKR {walletStats.cashRecovered || '0'}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[11px] text-[#00a65a] font-black uppercase dark:text-zinc-400">Dollar Recovered</div>
                                    <div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">$ {walletStats.dollarRecovered || '0'}</div>
                                </div>
                            </div>
                        </div>

                        {/* USAGE ICONS */}
                        <div className="pt-4 border-t">
                            <div className="text-[10px] text-gray-400 font-bold uppercase mb-5 tracking-wider">In this month usage</div>
                            <div className="grid grid-cols-4 gap-2 text-center items-start pb-4 border-b border-gray-50 mb-4 dark:border-zinc-800">
                                <div>
                                    <ArrowUp className="w-6 h-6 text-[#00a65a] mx-auto mb-1 dark:text-zinc-400"/>
                                    <div className="text-[8px] text-gray-400 font-black uppercase leading-tight tracking-tighter">Dollar<br/>Buying</div>
                                    <div className="text-[10px] font-black">$ {fullData?.monthlySummary?.buyingUsd || '0'}</div>
                                </div>
                                <div>
                                    <Send className="w-6 h-6 text-[#00a65a] mx-auto mb-1 rotate-45 dark:text-zinc-400"/>
                                    <div className="text-[8px] text-gray-400 font-black uppercase leading-tight tracking-tighter">Dollar<br/>Paid</div>
                                    <div className="text-[10px] font-black">$ {fullData?.monthlySummary?.paidUsd || '0'}</div>
                                </div>
                                <div>
                                    <Wallet className="w-6 h-6 text-[#00a65a] mx-auto mb-1 dark:text-zinc-400"/>
                                    <div className="text-[8px] text-gray-400 font-black uppercase leading-tight tracking-tighter">Dollar<br/>Balance</div>
                                    <div className="text-[10px] font-black">$ {fullData?.monthlySummary?.balanceUsd || '0'}</div>
                                </div>
                                <div>
                                    <div className="w-6 h-6 flex items-center justify-center mx-auto mb-1 border-2 border-[#00a65a] text-[#00a65a] font-black text-[10px] dark:border-zinc-800 dark:text-zinc-400">A</div>
                                    <div className="text-[8px] text-gray-400 font-black uppercase leading-tight tracking-tighter">Advance<br/>Pay</div>
                                    <div className="text-[10px] font-black">PKR {fullData?.monthlySummary?.advancePkr || '0'}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1">
                                {["Receive", "Send", "Balance", "Advance Pay"].map((btn) => (
                                    <button key={btn} className="bg-[#00a65a] text-white text-[9px] font-bold py-2 rounded-sm shadow-sm uppercase tracking-tighter">{btn}</button>
                                ))}
                            </div>
                        </div>

                        {/* DAILY ACTIVITY & RECENT TRANS */}
                        <div className="pt-6">
                            <div className="font-[1000] text-gray-900 text-xs uppercase mb-4 pb-2 underline decoration-gray-100 underline-offset-4 dark:text-zinc-100">Recent Day Transactions</div>
                            
                            <div className="grid grid-cols-3 gap-2 mb-6">
                                <Badge className="bg-[#00a65a] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">Balance <span className="ml-1 opacity-80 text-[8px]">{transactions.length}(...)</span></Badge>
                                <Badge className="bg-emerald-50 text-[#00a65a] border-[#00a65a] text-[10px] font-bold px-2 py-1 rounded-md shadow-sm dark:border-zinc-800 dark:text-zinc-400">Buy <span className="ml-1 opacity-80 text-[8px]">0(0)</span></Badge>
                                <Badge className="bg-rose-50 text-red-500 border-red-500 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm">Sell <span className="ml-1 opacity-80 text-[8px]">0(0)</span></Badge>
                            </div>

                            <div className="space-y-5 border border-gray-100 rounded-lg p-3 bg-white shadow-inner dark:bg-zinc-900 dark:border-zinc-800">
                                {transactions.length > 0 ? (
                                    transactions.map((tx: any, i: number) => (
                                        <div key={i} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0 items-start dark:border-zinc-800">
                                            <div className="w-8 h-8 rounded-full border border-orange-200 flex items-center justify-center shrink-0 bg-white shadow-sm overflow-hidden text-orange-400 dark:bg-zinc-900">
                                                <ArrowRight size={14} className="rotate-[-45deg]"/>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="text-[10px] font-black text-gray-800 tracking-tighter uppercase truncate w-32 dark:text-zinc-100">{tx.name}</div>
                                                        <div className="text-[9px] text-gray-400 font-bold uppercase">{tx.date ? format(new Date(tx.date), "dd MMM yyyy") : '-'}</div>
                                                        <div className="text-[9px] text-blue-400 font-medium italic truncate w-32">{tx.email}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-black text-gray-800 dark:text-zinc-100">{tx.rate}</div>
                                                        <div className="text-[10px] font-black text-gray-800 dark:text-zinc-100">$ {tx.amount}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-[10px] text-gray-400 text-center py-4 italic">No recent transactions</div>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>
                    
                    {/* SECTION 1: DYNAMIC TOP SECTION */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm min-w-0 h-fit dark:bg-zinc-900 dark:border-zinc-800">
                        <section className="p-6 space-y-6">
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                            {[
                                { id: "full", label: `Full ${fullPayments.length || counts.full || 0}` },
                                { id: "partial", label: `Partial ${partialPayments.length || counts.partial || 0}` },
                                { id: "term", label: `Tem Payment ${counts.temp || 0}` },
                                { id: "ab_liabilities", label: "AB Liabilities" }
                            ].map((tab) => (
                                <Badge 
                                    key={tab.id}
                                    className={cn("px-5 py-2.5 text-[12px] font-black uppercase rounded-md shadow-none cursor-pointer transition-all border-none whitespace-nowrap", 
                                        activeTab === tab.id ? "bg-[#00a65a] text-white hover:bg-[#008d4c]" : "bg-transparent text-gray-500 dark:text-slate-400 hover:bg-gray-100"
                                    )}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </Badge>
                            ))}
                        </div>

                        {/* --- TAB CONTENT: FULL --- */}
                        {activeTab === "full" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-wrap items-center justify-between gap-y-4">
                                <div className="space-y-1">
                                    <div className="text-2xl font-[1000] text-gray-900 uppercase tracking-tighter flex items-center gap-3 dark:text-zinc-100">
                                        Full Payment Received <span className="text-red-500">{filteredFullPayments.length}</span>
                                    </div>
                                    <div className="flex gap-4 text-[13px] font-[1000] tracking-tighter uppercase whitespace-nowrap">
                                        <span>NC(<span className="text-[#00a65a] dark:text-zinc-400">{filteredFullPayments.length}</span>)</span>
                                        <span>RC(<span className="text-blue-500">0</span>)</span>
                                        <span>EC(<span className="text-red-500">0</span>)</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] border-r border-gray-200 pr-6 gap-0.5 dark:border-zinc-800">
                                        <span className="text-gray-400">Cash Received</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ {fullTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr {fullTotalPkr.toLocaleString()}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] border-r border-gray-200 pr-6 gap-0.5 dark:border-zinc-800">
                                        <span className="text-gray-400">Online Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ {Number(abLiabilities.fullOnlinePaidUsd || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr {Number(abLiabilities.fullOnlinePaidPkr || 0).toLocaleString()}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] gap-0.5">
                                        <span className="text-gray-400">Customer Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ {fullTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr {fullTotalPkr.toLocaleString()}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-zinc-900 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={fullSearchTerm}
                                        onChange={(e) => setFullSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={fullStartDate}
                                        onChange={(e) => setFullStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={fullEndDate}
                                        onChange={(e) => setFullEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setFullSearchTerm("");
                                        setFullStartDate("");
                                        setFullEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm shadow-sm shadow-emerald-500/5 dark:border-zinc-800">
                                <div style={{display:'block', width:'100%', overflowX:'auto', overflowY:'visible', paddingBottom:'16px'}} className="custom-scrollbar">
                                    <table style={{width:'1650px', tableLayout:'fixed', minWidth:'1650px'}} className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-bold text-[11px] tracking-normal shadow-sm dark:bg-zinc-900 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[50px]">No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Date</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Channel Partner</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[120px]">Mem ID</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[240px]">Company Name</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[160px]">Product Purchased</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Order Type</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[180px]">PayPal Account</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">PayPal Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[70px]">Attach</th>
                                                <th className="py-2.5 px-2 text-center w-[70px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {filteredFullPayments.length > 0 ? (
                                                filteredFullPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="p-2.5 border-r font-bold text-gray-400 text-center w-[50px]">{i + 1}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px] truncate" title={item.date}>{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-2.5 border-r font-bold italic text-gray-500 dark:text-zinc-400 w-[140px] truncate" title={item.salePerson}>{item.salePerson || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400 w-[120px] truncate" title={item.drmId}>{item.drmId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black uppercase text-gray-700 dark:text-zinc-400 w-[240px] truncate" title={item.company}>{item.company || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[160px] truncate" title={item.package}>{item.package || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px]">{item.type || 'Full'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[130px] truncate" title={item.orderId}>{item.orderId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100 w-[130px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[180px] truncate">-</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[140px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r w-[70px] py-2"><div className="flex justify-center"><button onClick={() => setAttachItem(item)}><FileText size={16} className={item.proofUrl ? "text-[#00a65a] cursor-pointer" : "text-gray-400 cursor-pointer"}/></button></div></td>
                                                        <td className="p-2.5 text-center w-[70px]"><button onClick={() => setViewItem(item)}><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></button></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-b">
                                                    <td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* --- TAB CONTENT: PARTIAL --- */}
                        {activeTab === "partial" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="flex flex-wrap items-center justify-between gap-y-4">
                                <div className="space-y-1">
                                    <div className="text-xl font-[1000] text-gray-900 uppercase tracking-tighter dark:text-zinc-100">
                                        Partial Full Payment Received <span className="text-red-500">{filteredPartialPayments.length}</span>
                                    </div>
                                    <div className="text-[11px] font-black text-red-400 italic">Pkr 0</div>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5">
                                        <span className="text-gray-400">Cash Received</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ {partialTotalUsd.toLocaleString(undefined, {minimumFractionDigits:2})}</Badge>
                                            <Badge className="bg-rose-50 text-red-500 border-none px-2 py-0.5 shadow-none font-black italic">Pkr {partialTotalPkr.toLocaleString()}</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5 border-l border-gray-100 pl-4 dark:border-zinc-800">
                                        <span className="text-gray-400">Online Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ {Number(abLiabilities.partialOnlinePaidUsd || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</Badge>
                                            <Badge className="bg-rose-50 text-red-500 border-none px-2 py-0.5 shadow-none font-black italic">Pkr {Number(abLiabilities.partialOnlinePaidPkr || 0).toLocaleString()}</Badge>
                                        </div>
                                    </div>
                                </div>
                                                         <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 dark:bg-zinc-900 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={partialSearchTerm}
                                        onChange={(e) => setPartialSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={partialStartDate}
                                        onChange={(e) => setPartialStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={partialEndDate}
                                        onChange={(e) => setPartialEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setPartialSearchTerm("");
                                        setPartialStartDate("");
                                        setPartialEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>  </div>

                             <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800">
                                <div style={{display:'block', width:'100%', overflowX:'auto', overflowY:'visible', paddingBottom:'16px'}} className="custom-scrollbar">
                                    <table style={{width:'1650px', tableLayout:'fixed', minWidth:'1650px'}} className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-bold text-[11px] tracking-normal shadow-sm dark:bg-zinc-900 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[50px]">No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Date</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Channel Partner</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[120px]">Mem ID</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[240px]">Company Name</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[160px]">Product Purchased</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Order Type</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[180px]">PayPal Account</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">PayPal Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[70px]">Attach</th>
                                                <th className="py-2.5 px-2 text-center w-[70px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {filteredPartialPayments.length > 0 ? (
                                                filteredPartialPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="p-2.5 border-r font-bold text-gray-400 text-center w-[50px]">{i + 1}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px] truncate" title={item.date}>{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-2.5 border-r font-bold italic text-gray-500 dark:text-zinc-400 w-[140px] truncate" title={item.salePerson}>{item.salePerson || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400 w-[120px] truncate" title={item.drmId}>{item.drmId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black uppercase text-gray-700 dark:text-zinc-400 w-[240px] truncate" title={item.company}>{item.company || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[160px] truncate" title={item.package}>{item.package || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px]">{item.type || 'Partial'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[130px] truncate" title={item.orderId}>{item.orderId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100 w-[130px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[180px] truncate">-</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[140px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r w-[70px] py-2"><div className="flex justify-center"><button onClick={() => setAttachItem(item)}><FileText size={16} className={item.proofUrl ? "text-[#00a65a] cursor-pointer" : "text-gray-400 cursor-pointer"}/></button></div></td>
                                                        <td className="p-2.5 text-center w-[70px]"><button onClick={() => setViewItem(item)}><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></button></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-b">
                                                    <td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        )}

                        {/* --- TAB CONTENT: TERM PAYMENT --- */}
                        {activeTab === "term" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-col gap-4">
                                <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 dark:border-zinc-800 dark:text-zinc-100">Term Payment <span className="text-[#00a65a] dark:text-zinc-400">0</span></div>
                                <Button className="bg-[#f06464] hover:bg-[#d9534f] text-white w-fit h-9 px-4 font-black uppercase text-[11px] rounded-md shadow-sm dark:bg-zinc-900 dark:hover:bg-zinc-800">Generate Email</Button>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-px">
                                        {["Copy", "Excel", "CSV", "PDF"].map(btn => (
                                            <button key={btn} className="bg-[#6c757d] hover:bg-[#5a6268] text-white text-[10px] font-black uppercase px-5 py-2 first:rounded-l-sm last:rounded-r-sm shadow-sm">{btn}</button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[12px] font-bold text-gray-700 dark:text-zinc-400">Search:</span>
                                        <Input className="h-9 w-56 border-gray-300 rounded-sm dark:border-zinc-800" />
                                    </div>
                                </div>
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden dark:border-zinc-800">
                                <div className="overflow-x-auto w-full custom-scrollbar pb-1">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1300px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-bold text-[11px] tracking-normal shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-10">No</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Date</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Channel Partner</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Mem ID</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Company Name</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Product Purchased</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Order Type</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Contract No</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">Contract Amount</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">PayPal Account</th>
                                                <th className="py-2.5 px-2.5 border-r border-white/20">PayPal Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-12">Attach</th>
                                                <th className="py-2.5 px-2 text-center w-12">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-zinc-900">
                                            <tr className="border-b">
                                                <td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">Showing 0 to 0 of 0 entries</div>
                        </div>
                        )}

                        {/* --- TAB CONTENT: AB LIABILITIES --- */}
                        {activeTab === "ab_liabilities" && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 uppercase tracking-tighter dark:border-zinc-800 dark:text-zinc-100">AB Liabilities <span className="text-red-500">{counts.liabilities}</span></div>
                             
                             <div className="max-w-4xl border border-gray-200 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <Table className="text-[12px]">
                                    <TableHeader className="bg-[#f8f9fa] dark:bg-zinc-900">
                                        <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                            <TableHead className="p-4 font-black text-gray-800 uppercase tracking-tighter border-r dark:text-zinc-100">Payment Type</TableHead>
                                            <TableHead className="p-4 font-black text-gray-800 uppercase tracking-tighter border-r dark:text-zinc-100">Mode</TableHead>
                                            <TableHead className="p-4 font-black text-gray-800 uppercase tracking-tighter border-r dark:text-zinc-100">USD</TableHead>
                                            <TableHead className="p-4 font-black text-gray-800 uppercase tracking-tighter dark:text-zinc-100">PKR</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="bg-white font-bold dark:bg-zinc-900">
                                        <TableRow className="border-b border-gray-100 dark:border-zinc-800">
                                            <TableCell rowSpan={2} className="p-4 border-r text-gray-600 font-black dark:text-zinc-300">Full Payment</TableCell>
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Online Paid</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {Number(abLiabilities.fullOnlinePaidUsd || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr {Number(abLiabilities.fullOnlinePaidPkr || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Cash Received</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {Number(abLiabilities.fullCashReceivedUsd || walletStats.dollarRecovered || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr {Number(abLiabilities.fullCashReceivedPkr || walletStats.cashRecovered || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-100 dark:border-zinc-800">
                                            <TableCell rowSpan={2} className="p-4 border-r text-gray-600 font-black dark:text-zinc-300">Partial Payment</TableCell>
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Online Paid</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {Number(abLiabilities.partialOnlinePaidUsd || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr {Number(abLiabilities.partialOnlinePaidPkr || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Cash Received</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {Number(abLiabilities.partialCashReceivedUsd || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr {Number(abLiabilities.partialCashReceivedPkr || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-gray-50/50 dark:bg-zinc-900">
                                            <TableCell className="p-4 border-r text-gray-700 font-black uppercase dark:text-zinc-400">Total</TableCell>
                                            <TableCell className="p-4 border-r text-gray-500 font-black text-sm italic dark:text-zinc-400">All Payments</TableCell>
                                            <TableCell className="p-4 border-r text-[#3c8dbc] text-lg font-[1000] dark:text-zinc-100">
                                                $ {(
                                                    Number(abLiabilities.fullOnlinePaidUsd || 0) +
                                                    Number(abLiabilities.fullCashReceivedUsd || 0) +
                                                    Number(abLiabilities.partialOnlinePaidUsd || 0) +
                                                    Number(abLiabilities.partialCashReceivedUsd || 0)
                                                ).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                                            </TableCell>
                                            <TableCell className="p-4 text-red-500 text-lg font-[1000]">
                                                Pkr {(
                                                    Number(abLiabilities.fullOnlinePaidPkr || 0) +
                                                    Number(abLiabilities.fullCashReceivedPkr || 0) +
                                                    Number(abLiabilities.partialOnlinePaidPkr || 0) +
                                                    Number(abLiabilities.partialCashReceivedPkr || 0)
                                                ).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                             </div>
                        </div>
                        )}
                        </section>
                    </div>
                </div>

                {/* SECTION 2: LOAN PAYMENT RECEIVED (DYNAMIC) */}
                <section className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="space-y-4">
                            <div className="text-[20px] font-[1000] text-gray-900 uppercase tracking-tighter dark:text-zinc-100">Loan Payment Received NC({filteredLoans.length}) RC(0) EC(0)</div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={loanSearchTerm}
                                        onChange={(e) => setLoanSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={loanStartDate}
                                        onChange={(e) => setLoanStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={loanEndDate}
                                        onChange={(e) => setLoanEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setLoanSearchTerm("");
                                        setLoanStartDate("");
                                        setLoanEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>
                            <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800">
                                <div style={{display:'block', width:'100%', overflowX:'auto', overflowY:'visible', paddingBottom:'16px'}} className="custom-scrollbar">
                                    <table style={{width:'1650px', tableLayout:'fixed', minWidth:'1650px'}} className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-bold text-[11px] tracking-normal shadow-sm dark:bg-zinc-900 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[50px]">No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Date</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Channel Partner</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[120px]">Mem ID</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[240px]">Company Name</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[160px]">Product Purchased</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Order Type</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[180px]">PayPal Account</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">PayPal Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[70px]">Attach</th>
                                                <th className="py-2.5 px-2 text-center w-[70px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {filteredLoans.length > 0 ? (
                                                filteredLoans.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="p-2.5 border-r font-bold text-gray-400 text-center w-[50px]">{i + 1}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px] truncate" title={item.date}>{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-2.5 border-r font-bold italic text-gray-500 dark:text-zinc-400 w-[140px] truncate" title={item.salePerson}>{item.salePerson || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400 w-[120px] truncate" title={item.drmId}>{item.drmId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black uppercase text-gray-700 dark:text-zinc-400 w-[240px] truncate" title={item.company}>{item.company || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[160px] truncate" title={item.package}>{item.package || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px]">Loan</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[130px] truncate" title={item.orderId}>{item.orderId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100 w-[130px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[180px] truncate">-</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[140px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r w-[70px] py-2"><div className="flex justify-center"><button onClick={() => setAttachItem(item)}><FileText size={16} className={item.proofUrl ? "text-[#00a65a] cursor-pointer" : "text-gray-400 cursor-pointer"}/></button></div></td>
                                                        <td className="p-2.5 text-center w-[70px]"><button onClick={() => setViewItem(item)}><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></button></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-b">
                                                    <td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>

                {/* SECTION 3: PARTIAL PAYMENT RECEIVED (DYNAMIC) */}
                <section className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm space-y-6 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-y-4">
                                <div className="space-y-1 text-blue-500">
                                    <div className="text-2xl font-[1000] uppercase tracking-tighter">Partial Payment Received <span className="text-red-500">{filteredPartialPayments.length}</span></div>
                                    <Badge className="bg-[#f8d7da] text-[#721c24] border-none shadow-none text-[10px] font-bold px-2 dark:bg-zinc-900">Pkr 0</Badge>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={partialSearchTerm}
                                        onChange={(e) => setPartialSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={partialStartDate}
                                        onChange={(e) => setPartialStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={partialEndDate}
                                        onChange={(e) => setPartialEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setPartialSearchTerm("");
                                        setPartialStartDate("");
                                        setPartialEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800">
                                <div style={{display:'block', width:'100%', overflowX:'auto', overflowY:'visible', paddingBottom:'16px'}} className="custom-scrollbar">
                                    <table style={{width:'1650px', tableLayout:'fixed', minWidth:'1650px'}} className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-bold text-[11px] tracking-normal shadow-sm dark:bg-zinc-900 sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[50px]">No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Date</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Channel Partner</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[120px]">Mem ID</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[240px]">Company Name</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[160px]">Product Purchased</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Order Type</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract No</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[130px]">Contract Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[180px]">PayPal Account</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">PayPal Amount</th>
                                                <th className="py-2.5 px-2 border-r border-white/20 text-center w-[70px]">Attach</th>
                                                <th className="py-2.5 px-2 text-center w-[70px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {filteredPartialPayments.length > 0 ? (
                                                filteredPartialPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
                                                        <td className="p-2.5 border-r font-bold text-gray-400 text-center w-[50px]">{i + 1}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px] truncate" title={item.date}>{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-2.5 border-r font-bold italic text-gray-500 dark:text-zinc-400 w-[140px] truncate" title={item.salePerson}>{item.salePerson || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400 w-[120px] truncate" title={item.drmId}>{item.drmId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black uppercase text-gray-700 dark:text-zinc-400 w-[240px] truncate" title={item.company}>{item.company || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[160px] truncate" title={item.package}>{item.package || '-'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[110px]">{item.type || 'Partial'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[130px] truncate" title={item.orderId}>{item.orderId || '-'}</td>
                                                        <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100 w-[130px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[180px] truncate">-</td>
                                                        <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 w-[140px]">$ {item.dollar || '0'}</td>
                                                        <td className="p-2.5 border-r w-[70px] py-2"><div className="flex justify-center"><button onClick={() => setAttachItem(item)}><FileText size={16} className={item.proofUrl ? "text-[#00a65a] cursor-pointer" : "text-gray-400 cursor-pointer"}/></button></div></td>
                                                        <td className="p-2.5 text-center w-[70px]"><button onClick={() => setViewItem(item)}><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></button></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr className="border-b">
                                                    <td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 4: PENDING & ALIBABA (DYNAMIC) */}
                    <section className="p-6 bg-[#fbfcfd] border border-gray-200 rounded-lg shadow-sm space-y-10 pb-20 dark:border-zinc-800 dark:bg-zinc-900">
                        {/* 4.1 Pending Approvals */}
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-y-4">
                                <div className="space-y-1">
                                    <div className="text-2xl font-[1000] text-rose-500 uppercase tracking-tighter">Pending Approvals <span className="text-red-500 font-black">{filteredPendingApprovals.length}</span></div>
                                </div>
                            </div>

                            {/* FILTER BAR - SEARCH & DATE RANGE */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={pendingSearchTerm}
                                        onChange={(e) => setPendingSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={pendingStartDate}
                                        onChange={(e) => setPendingStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={pendingEndDate}
                                        onChange={(e) => setPendingEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setPendingSearchTerm("");
                                        setPendingStartDate("");
                                        setPendingEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>

                            <div className="flex gap-1.5 mb-2">
                                {["Copy", "Excel", "CSV", "PDF"].map(btn => (
                                    <button key={btn} className="bg-slate-50 hover:bg-slate-600 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-sm shadow-sm dark:bg-zinc-900">{btn}</button>
                                ))}
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1500px] border-separate border-spacing-0">
                                        <TableHeader className="bg-[#f8f9fa] border-b text-gray-800 font-bold text-xs uppercase tracking-normal shadow-inner dark:bg-zinc-900 dark:text-zinc-100">
                                            <TableRow>
                                                <TableHead className="p-3.5 px-4 border-r text-center">#</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">DRM ID</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Company</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Sales Person</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Dollar</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">PKR</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Dollar Rate</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">AB Disc</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Extra Disc</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Package</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Type</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Dropout</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Status</TableHead>
                                                <TableHead className="p-3.5 px-4 text-center">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-white dark:bg-zinc-900">
                                            {filteredPendingApprovals.length > 0 ? (
                                                filteredPendingApprovals.map((tx: any, i: number) => (
                                                    <TableRow key={i} className="hover:bg-rose-50/10 transition-colors">
                                                        <TableCell className="p-3 border-r border-b font-bold text-gray-400">{i+1}</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-[1000] text-[#00a65a] italic uppercase dark:text-zinc-400">{tx.drmId}</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-black uppercase text-gray-700 dark:text-zinc-400">{tx.company}</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-bold italic text-gray-500 dark:text-zinc-400">{tx.salePerson}</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-black text-gray-900 dark:text-zinc-100">{tx.dollar}</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-bold">{tx.pkr}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">{tx.rate}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">{tx.abDisc || '0'}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">{tx.exDisc || '0'}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">{tx.package || '-'}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">{tx.type || '-'}</TableCell>
                                                        <TableCell className="p-3 border-r border-b">None</TableCell>
                                                        <TableCell className="p-3 border-r border-b font-black text-[#00a65a] uppercase italic dark:text-zinc-400">{tx.status}</TableCell>
                                                        <TableCell className="p-3 border-b text-center h-11 flex items-center justify-center"><Badge className="bg-red-500/10 text-red-700 border-none text-[10px] uppercase font-black px-2 shadow-none">Pending</Badge></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={14} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No pending approvals</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>

                        {/* 4.2 Paid Alibaba */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-zinc-800">
                                <h2 className="text-[20px] font-[1000] text-gray-800 tracking-tighter uppercase whitespace-nowrap dark:text-zinc-100">Paid Alibaba</h2>
                                <span className="w-5 h-5 flex items-center justify-center text-[28px] font-black text-green-500 pb-2">..</span>
                                <h2 className="text-[20px] font-[1000] text-[#00a65a] tracking-tighter uppercase leading-none dark:text-zinc-400">Partial Payments Paid To Alibaba</h2>
                            </div>

                            {/* FILTER BAR - COMPACT AND FUNCTIONAL */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-72">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input 
                                        placeholder="Search..." 
                                        value={abSearchTerm}
                                        onChange={(e) => setAbSearchTerm(e.target.value)}
                                        className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" 
                                    />
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={abStartDate}
                                        onChange={(e) => setAbStartDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative">
                                    <Input 
                                        type="date"
                                        value={abEndDate}
                                        onChange={(e) => setAbEndDate(e.target.value)}
                                        className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800 pr-10" 
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setAbSearchTerm("");
                                        setAbStartDate("");
                                        setAbEndDate("");
                                    }}
                                    className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase"
                                >
                                    Clear Filter
                                </Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm shadow-blue-500/5 dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1200px] border-separate border-spacing-0">
                                        <TableHeader className="bg-[#f8f9fa] border-b text-gray-800 font-bold text-xs uppercase tracking-normal dark:bg-zinc-900 dark:text-zinc-100">
                                            <TableRow>
                                                <TableHead className="p-3.5 px-4 border-r w-12 text-center items-center justify-center flex"><Checkbox className="rounded-sm border-emerald-500" /></TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">AB Date</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">BV Date</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">DRM ID</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">AB ID</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Order ID</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Company</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Amount</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Status</TableHead>
                                                <TableHead className="p-3.5 px-4 border-r">Paid Date</TableHead>
                                                <TableHead className="p-3.5 px-4 text-center">Proof</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-white dark:bg-zinc-900">
                                            {filteredAlibabaPayments.length > 0 ? (
                                                filteredAlibabaPayments.map((tx: any, i: number) => (
                                                    <TableRow key={i} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                                        <TableCell className="p-4 border-r border-b text-center"><Checkbox className="rounded-sm border-emerald-500" /></TableCell>
                                                        <TableCell className="p-4 border-r border-b text-gray-500 dark:text-zinc-400">{tx.abDate ? format(new Date(tx.abDate), "MM/dd/yyyy") : '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b text-[#dd4b39]">{tx.date ? format(new Date(tx.date), "MM/dd/yyyy") : '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{tx.drmId || '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-black text-gray-600 dark:text-zinc-300">{tx.abId || <span className="text-gray-300 italic text-[10px]">not linked</span>}</TableCell>
                                                        <TableCell className="p-4 border-r border-b text-gray-500 dark:text-zinc-400">{tx.orderId || '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-black uppercase text-gray-700 dark:text-zinc-400">{tx.company || '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-black text-gray-900 dark:text-zinc-100">$ {Number(tx.dollar || 0).toLocaleString(undefined, {minimumFractionDigits:2})}</TableCell>
                                                        <TableCell className="p-4 border-r border-b text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                                tx.paymentStatus === 'paid'       ? 'bg-emerald-100 text-emerald-700' :
                                                                tx.paymentStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                                                                tx.paymentStatus === 'rejected'   ? 'bg-red-100 text-red-700' :
                                                                tx.paymentStatus === 'cancelled'  ? 'bg-gray-100 text-gray-500' :
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>{tx.paymentStatus || 'pending'}</span>
                                                        </TableCell>
                                                        <TableCell className="p-4 border-r border-b text-gray-400 text-[10px]">{tx.paidDate ? format(new Date(tx.paidDate), 'MM/dd/yyyy') : '-'}</TableCell>
                                                        <TableCell className="p-4 border-b text-center">
                                                            {tx.proofUrl
                                                                ? <a href={tx.proofUrl} target="_blank" rel="noreferrer"><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block"/></a>
                                                                : <FileText size={16} className="text-gray-300"/>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={11} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No paid Alibaba records found</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>



            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar {
                    overflow-x: scroll !important;
                    scrollbar-width: auto !important;
                    scrollbar-color: #f39c12 #cbd5e1 !important;
                }
                .custom-scrollbar::-webkit-scrollbar { height: 20px !important; width: 20px !important; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #cbd5e1 !important; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #f39c12 !important; border-radius: 10px; border: 3px solid #cbd5e1 !important; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d97706 !important; }

                .dark .custom-scrollbar { scrollbar-color: #f39c12 #27272a !important; }
                .dark .custom-scrollbar::-webkit-scrollbar-track { background: #27272a !important; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #f39c12 !important; border: 3px solid #27272a !important; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d97706 !important; }
            `}</style>
        </>
    );
}
