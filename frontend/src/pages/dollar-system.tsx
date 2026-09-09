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
  User
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function DollarSystem() {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("full"); // Tab State: full, partial, term, ab_liabilities

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
            availableCash: "663.5",
            availableCashPkr: "183789.5",
            availableLoan: "2339",
            availableLoanPkr: "654967.99",
            requiredToPay: "131625.51",
            cashInHand: "672653",
            cashRecovered: "14371273.29",
            dollarRecovered: "6522.39"
        }, 
        fullPayments = [], 
        partialPayments = [], 
        loans = [], 
        pendingApprovals = [], 
        alibabaPayments = [],
        transactions = [],
        counts = { full: 0, partial: 0, pending: 0, temp: 0, liabilities: 0 }
    } = fullData || {};

    if (isLoading) return (
        <div className="flex h-screen items-center justify-center bg-white flex-col gap-4 dark:bg-zinc-900">
            <Loader2 className="h-10 w-10 animate-spin text-[#00a65a] dark:text-zinc-400" />
        </div>
    );

    return (
        <>
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
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden min-w-0 h-fit dark:bg-zinc-900 dark:border-zinc-800">
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
                                        Full Payment Received <span className="text-red-500">{fullPayments.length}</span>
                                    </div>
                                    <div className="flex gap-4 text-[13px] font-[1000] tracking-tighter uppercase whitespace-nowrap">
                                        <span>NC(<span className="text-[#00a65a] dark:text-zinc-400">{fullPayments.length}</span>)</span>
                                        <span>RC(<span className="text-blue-500">0</span>)</span>
                                        <span>EC(<span className="text-red-500">0</span>)</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] border-r border-gray-200 pr-6 gap-0.5 dark:border-zinc-800">
                                        <span className="text-gray-400">Cash Received</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ 42924</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr 9067030</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] border-r border-gray-200 pr-6 gap-0.5 dark:border-zinc-800">
                                        <span className="text-gray-400">Online Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ 32408</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr 6487210</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[11px] gap-0.5">
                                        <span className="text-gray-400">Customer Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ 4919</Badge>
                                            <Badge className="bg-rose-50 text-red-400 border-none px-2 py-0.5 shadow-none font-black italic">Pkr 979995</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
                                <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" /><Input placeholder="Search..." className="h-10 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" /></div>
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <Button className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-bold text-sm uppercase">Clear Filter</Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm shadow-emerald-500/5 dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1800px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-black h-10 tracking-tighter shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="p-3 border-r border-white/20">No</th>
                                                <th className="p-3 border-r border-white/20">Date</th>
                                                <th className="p-3 border-r border-white/20">Channel Partner</th>
                                                <th className="p-3 border-r border-white/20">Mmem Id</th>
                                                <th className="p-3 border-r border-white/20">Company Name</th>
                                                <th className="p-3 border-r border-white/20">Product Purchased</th>
                                                <th className="p-3 border-r border-white/20">Order Type</th>
                                                <th className="p-3 border-r border-white/20">Contract No</th>
                                                <th className="p-3 border-r border-white/20">Contact Amount</th>
                                                <th className="p-3 border-r border-white/20">PayPal Account</th>
                                                <th className="p-3 border-r border-white/20">PayPal Amount</th>
                                                <th className="p-3 border-r border-white/20">Attach</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {fullPayments.length > 0 ? (
                                                fullPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-3 border-r font-bold text-gray-400 text-center">{i + 1}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-3 border-r font-bold italic text-gray-500 dark:text-zinc-400">{item.salePerson || '-'}</td>
                                                        <td className="p-3 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{item.drmId || '-'}</td>
                                                        <td className="p-3 border-r font-black uppercase text-gray-700 dark:text-zinc-400">{item.company || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.package || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.type || 'Full'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.orderId || '-'}</td>
                                                        <td className="p-3 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">-</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r flex justify-center py-2"><FileText size={16} className="text-gray-400 cursor-pointer"/></td>
                                                        <td className="p-3 text-center"><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></td>
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
                                        Partial Full Payment Received <span className="text-red-500">{partialPayments.length}</span>
                                    </div>
                                    <div className="text-[11px] font-black text-red-400 italic">Pkr 0</div>
                                </div>
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5">
                                        <span className="text-gray-400">Cash Received</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ 0</Badge>
                                            <Badge className="bg-rose-50 text-red-500 border-none px-2 py-0.5 shadow-none font-black italic">Pkr 0</Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5 border-l border-gray-100 pl-4 dark:border-zinc-800">
                                        <span className="text-gray-400">Online Paid</span>
                                        <div className="flex gap-2">
                                            <Badge className="bg-emerald-50 text-[#00a65a] border-none px-2 py-0.5 shadow-none font-black dark:text-zinc-400">$ 0</Badge>
                                            <Badge className="bg-rose-50 text-red-500 border-none px-2 py-0.5 shadow-none font-black italic">Pkr 0</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-44 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <Button className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 h-10 rounded-md font-bold text-sm">Filter</Button>
                                <Button className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-6 h-10 rounded-md font-bold text-sm">Clear</Button>
                            </div>

                             <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1800px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-black h-10 tracking-tighter shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="p-3 border-r border-white/20">No</th>
                                                <th className="p-3 border-r border-white/20">Date</th>
                                                <th className="p-3 border-r border-white/20">Channel Partner</th>
                                                <th className="p-3 border-r border-white/20">Mmem Id</th>
                                                <th className="p-3 border-r border-white/20">Company Name</th>
                                                <th className="p-3 border-r border-white/20">Product Purchased</th>
                                                <th className="p-3 border-r border-white/20">Order Type</th>
                                                <th className="p-3 border-r border-white/20">Contract No</th>
                                                <th className="p-3 border-r border-white/20">Contact Amount</th>
                                                <th className="p-3 border-r border-white/20">PayPal Account</th>
                                                <th className="p-3 border-r border-white/20">PayPal Amount</th>
                                                <th className="p-3 border-r border-white/20">Attach</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {partialPayments.length > 0 ? (
                                                partialPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-3 border-r font-bold text-gray-400 text-center">{i + 1}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-3 border-r font-bold italic text-gray-500 dark:text-zinc-400">{item.salePerson || '-'}</td>
                                                        <td className="p-3 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{item.drmId || '-'}</td>
                                                        <td className="p-3 border-r font-black uppercase text-gray-700 dark:text-zinc-400">{item.company || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.package || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.type || 'Partial'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.orderId || '-'}</td>
                                                        <td className="p-3 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">-</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r flex justify-center py-2"><FileText size={16} className="text-gray-400 cursor-pointer"/></td>
                                                        <td className="p-3 text-center"><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></td>
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
                                <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 dark:border-zinc-800 dark:text-zinc-100">Tem Payment <span className="text-[#00a65a] dark:text-zinc-400">0</span></div>
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
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1800px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-black h-10 tracking-tighter shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="p-3 border-r border-white/20">No</th>
                                                <th className="p-3 border-r border-white/20">Date</th>
                                                <th className="p-3 border-r border-white/20">Channel Partner</th>
                                                <th className="p-3 border-r border-white/20">Mmem Id</th>
                                                <th className="p-3 border-r border-white/20">Company Name</th>
                                                <th className="p-3 border-r border-white/20">Product Purchased</th>
                                                <th className="p-3 border-r border-white/20">Order Type</th>
                                                <th className="p-3 border-r border-white/20">Contract No</th>
                                                <th className="p-3 border-r border-white/20">Contact Amount</th>
                                                <th className="p-3 border-r border-white/20">PayPal Account</th>
                                                <th className="p-3 border-r border-white/20">PayPal Amount</th>
                                                <th className="p-3 border-r border-white/20">Attach</th>
                                                <th className="p-3">Action</th>
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
                             <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 uppercase tracking-tighter dark:border-zinc-800 dark:text-zinc-100">AB Liabilities <span className="text-red-500">0</span></div>
                             
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
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ 32,408.00</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr 6,487,210.00</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Cash Received</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {walletStats.dollarRecovered || '42,924.00'}</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr {walletStats.cashRecovered || '9,067,030.00'}</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-100 dark:border-zinc-800">
                                            <TableCell rowSpan={2} className="p-4 border-r text-gray-600 font-black dark:text-zinc-300">Partial Payment</TableCell>
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Online Paid</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ 10,662.95</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr 2,991,900.00</TableCell>
                                        </TableRow>
                                        <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                                            <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">Cash Received</TableCell>
                                            <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ 25,335.86</TableCell>
                                            <TableCell className="p-4 text-red-500 font-[1000]">Pkr 7,094,067.00</TableCell>
                                        </TableRow>
                                        <TableRow className="bg-gray-50/50">
                                            <TableCell className="p-4 border-r text-gray-700 font-black uppercase dark:text-zinc-400">Total</TableCell>
                                            <TableCell className="p-4 border-r text-gray-500 font-black text-sm italic dark:text-zinc-400">All Payments</TableCell>
                                            <TableCell className="p-4 border-r text-[#3c8dbc] text-lg font-[1000] dark:text-zinc-100">$ 111,330.81</TableCell>
                                            <TableCell className="p-4 text-red-500 text-lg font-[1000]">Pkr 25,640,207.00</TableCell>
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
                            <div className="text-[20px] font-[1000] text-gray-900 uppercase tracking-tighter dark:text-zinc-100">Loan Payment Received NC({loans.length}) RC(0) EC(0)</div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" /><Input placeholder="Search..." className="h-10 pl-10 rounded-md border-gray-200 dark:border-zinc-800" /></div>
                            </div>
                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1800px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-black h-10 tracking-tighter shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="p-3 border-r border-white/20">No</th>
                                                <th className="p-3 border-r border-white/20">Date</th>
                                                <th className="p-3 border-r border-white/20">Channel Partner</th>
                                                <th className="p-3 border-r border-white/20">Mmem Id</th>
                                                <th className="p-3 border-r border-white/20">Company Name</th>
                                                <th className="p-3 border-r border-white/20">Product Purchased</th>
                                                <th className="p-3 border-r border-white/20">Order Type</th>
                                                <th className="p-3 border-r border-white/20">Contract No</th>
                                                <th className="p-3 border-r border-white/20">Contact Amount</th>
                                                <th className="p-3 border-r border-white/20">PayPal Account</th>
                                                <th className="p-3 border-r border-white/20">PayPal Amount</th>
                                                <th className="p-3 border-r border-white/20">Attach</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {loans.length > 0 ? (
                                                loans.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-3 border-r font-bold text-gray-400 text-center">{i + 1}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-3 border-r font-bold italic text-gray-500 dark:text-zinc-400">{item.salePerson || '-'}</td>
                                                        <td className="p-3 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{item.drmId || '-'}</td>
                                                        <td className="p-3 border-r font-black uppercase text-gray-700 dark:text-zinc-400">{item.company || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.package || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">Loan</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.orderId || '-'}</td>
                                                        <td className="p-3 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">-</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r flex justify-center py-2"><FileText size={16} className="text-gray-400 cursor-pointer"/></td>
                                                        <td className="p-3 text-center"><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></td>
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
                                    <div className="text-2xl font-[1000] uppercase tracking-tighter">Partial Payment Received <span className="text-red-500">{partialPayments.length}</span></div>
                                    <Badge className="bg-[#f8d7da] text-[#721c24] border-none shadow-none text-[10px] font-bold px-2 dark:bg-zinc-900">Pkr 0</Badge>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" /><Input placeholder="Search..." className="h-10 pl-10 rounded-md border-gray-200 dark:border-zinc-800" /></div>
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-40 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <div className="relative"><Input value="dd/mm/yyyy" readOnly className="h-10 w-40 text-sm border-gray-200 dark:border-zinc-800" /><Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/></div>
                                <Button className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-8 h-10 rounded-md font-black text-xs uppercase shadow-md">Clear</Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1800px] border-separate border-spacing-0">
                                        <thead className="bg-[#f39c12] border-b text-white font-black h-10 tracking-tighter shadow-sm dark:bg-zinc-900">
                                            <tr>
                                                <th className="p-3 border-r border-white/20">No</th>
                                                <th className="p-3 border-r border-white/20">Date</th>
                                                <th className="p-3 border-r border-white/20">Channel Partner</th>
                                                <th className="p-3 border-r border-white/20">Mmem Id</th>
                                                <th className="p-3 border-r border-white/20">Company Name</th>
                                                <th className="p-3 border-r border-white/20">Product Purchased</th>
                                                <th className="p-3 border-r border-white/20">Order Type</th>
                                                <th className="p-3 border-r border-white/20">Contract No</th>
                                                <th className="p-3 border-r border-white/20">Contact Amount</th>
                                                <th className="p-3 border-r border-white/20">PayPal Account</th>
                                                <th className="p-3 border-r border-white/20">PayPal Amount</th>
                                                <th className="p-3 border-r border-white/20">Attach</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white font-bold dark:bg-zinc-900">
                                            {partialPayments.length > 0 ? (
                                                partialPayments.map((item: any, i: number) => (
                                                    <tr key={item.id} className="border-b hover:bg-gray-50/50 transition-colors">
                                                        <td className="p-3 border-r font-bold text-gray-400 text-center">{i + 1}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.date ? format(new Date(item.date), "yyyy-MM-dd") : '-' }</td>
                                                        <td className="p-3 border-r font-bold italic text-gray-500 dark:text-zinc-400">{item.salePerson || '-'}</td>
                                                        <td className="p-3 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{item.drmId || '-'}</td>
                                                        <td className="p-3 border-r font-black uppercase text-gray-700 dark:text-zinc-400">{item.company || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.package || '-'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.type || 'Partial'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">{item.orderId || '-'}</td>
                                                        <td className="p-3 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">-</td>
                                                        <td className="p-3 border-r text-gray-500 dark:text-zinc-400">$ {item.dollar || '0'}</td>
                                                        <td className="p-3 border-r flex justify-center py-2"><FileText size={16} className="text-gray-400 cursor-pointer"/></td>
                                                        <td className="p-3 text-center"><Eye size={16} className="text-[#00a65a] cursor-pointer inline-block dark:text-zinc-400"/></td>
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
                                    <div className="text-2xl font-[1000] text-rose-500 uppercase tracking-tighter">Pending Approvals <span className="text-red-500 font-black">{pendingApprovals.length}</span></div>
                                </div>
                            </div>

                            <div className="flex gap-1.5 mb-2">
                                {["Copy", "Excel", "CSV", "PDF"].map(btn => (
                                    <button key={btn} className="bg-slate-50 hover:bg-slate-600 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-sm shadow-sm dark:bg-zinc-900">{btn}</button>
                                ))}
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1500px] border-separate border-spacing-0">
                                        <TableHeader className="bg-[#f8f9fa] border-b text-gray-800 font-extrabold h-10 uppercase tracking-tighter shadow-inner dark:bg-zinc-900 dark:text-zinc-100">
                                            <TableRow>
                                                <TableHead className="p-3 border-r">#</TableHead>
                                                <TableHead className="p-3 border-r">Drm id</TableHead>
                                                <TableHead className="p-3 border-r">Company</TableHead>
                                                <TableHead className="p-3 border-r">Sale Person</TableHead>
                                                <TableHead className="p-3 border-r">Dollar</TableHead>
                                                <TableHead className="p-3 border-r">Pkr</TableHead>
                                                <TableHead className="p-3 border-r">Dollar Rate</TableHead>
                                                <TableHead className="p-3 border-r">Ab Disc</TableHead>
                                                <TableHead className="p-3 border-r">Extra Disc</TableHead>
                                                <TableHead className="p-3 border-r">Package</TableHead>
                                                <TableHead className="p-3 border-r">Type</TableHead>
                                                <TableHead className="p-3 border-r">Dropout</TableHead>
                                                <TableHead className="p-3 border-r">Status</TableHead>
                                                <TableHead className="p-3 border-r">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-white dark:bg-zinc-900">
                                            {pendingApprovals.length > 0 ? (
                                                pendingApprovals.map((tx: any, i: number) => (
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

                            {/* FILTER BAR - MATCHING SCREENSHOT (FULL WIDTH) */}
                            <div className="flex items-center gap-4 w-full">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                    <Input placeholder="Search..." className="h-12 pl-12 rounded-md border-gray-100 bg-gray-50/30 dark:border-zinc-800" />
                                </div>
                                <div className="relative w-48">
                                    <Input value="dd/mm/yyyy" readOnly className="h-12 text-sm border-gray-100 bg-gray-50/30 dark:border-zinc-800" />
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <div className="relative w-48">
                                    <Input value="dd/mm/yyyy" readOnly className="h-12 text-sm border-gray-100 bg-gray-50/30 dark:border-zinc-800" />
                                    <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
                                </div>
                                <Button className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-10 h-12 rounded-md font-black text-sm uppercase tracking-wider">Clear</Button>
                            </div>

                            <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm shadow-blue-500/5 dark:border-zinc-800">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1200px] border-separate border-spacing-0">
                                        <TableHeader className="bg-[#f8f9fa] border-b text-gray-800 font-extrabold h-11 uppercase tracking-tighter dark:bg-zinc-900 dark:text-zinc-100">
                                            <TableRow>
                                                <TableHead className="p-4 border-r w-12 text-center items-center justify-center flex"><Checkbox className="rounded-sm border-emerald-500" /></TableHead>
                                                <TableHead className="p-4 border-r">Ab Date</TableHead>
                                                <TableHead className="p-4 border-r">Bv Date</TableHead>
                                                <TableHead className="p-4 border-r">Drm Id</TableHead>
                                                <TableHead className="p-4 border-r">Ab Id</TableHead>
                                                <TableHead className="p-4 border-r">Order Id</TableHead>
                                                <TableHead className="p-4 border-r">Company</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="bg-white dark:bg-zinc-900">
                                            {alibabaPayments.length > 0 ? (
                                                alibabaPayments.map((tx: any, i: number) => (
                                                    <TableRow key={i} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                                        <TableCell className="p-4 border-r border-b text-center"><Checkbox className="rounded-sm border-emerald-500" /></TableCell>
                                                        <TableCell className="p-4 border-r border-b text-gray-500 dark:text-zinc-400">{tx.abDate ? format(new Date(tx.abDate), "MM/dd/yyyy") : '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b text-[#dd4b39]">{tx.date ? format(new Date(tx.date), "MM/dd/yyyy") : '-'}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{tx.drmId}</TableCell>
                                                        <TableCell className="p-4 border-r border-b font-bold text-blue-500">{tx.abId}</TableCell>
                                                        <TableCell className="p-4 border-r border-b">{tx.orderId}</TableCell>
                                                        <TableCell className="p-4 border-b font-black uppercase text-gray-700 dark:text-zinc-400">{tx.company}</TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No payments to Alibaba found</TableCell>
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
                .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f8f9fa; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #00a65a; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #008d4c; }
            `}</style>
        </>
    );
}
