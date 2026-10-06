import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuthHeader, apiRequestJson } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Wallet, ArrowUp, ChevronDown, Calendar, Send, Eye, FileText, X, FileSpreadsheet, ArrowRight, Loader2, DollarSign, Info, Trash2, ArrowLeftRight, CheckSquare, Square } from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useLocation } from "wouter";

// PHP columns: #, Drm id, Created Date, Company, Sale Person, Dollar, Cus Dollar,
//              Pkr, Dollar Rate, Ex-Disc, Ex-Disc Pkr, Package, [loan Amount,] Type,
//              Expire, Droupout, Status, Action
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

function PaymentTable({ items = [], isLoan = false, onView, onDollarModal, onAttach }: any) {
  const colCount = isLoan ? 18 : 17;
  const tw = isLoan ? "1900px" : "1800px";
  return (
    <div style={{display:"block",width:"100%",overflowX:"auto",overflowY:"visible",paddingBottom:"16px"}} className="custom-scrollbar">
      <table style={{width:tw,tableLayout:"fixed",minWidth:tw}} className="text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
        <thead className="bg-[#f39c12] text-white font-bold text-[11px] shadow-sm dark:bg-zinc-900 sticky top-0 z-10">
          <tr>
            <th className="py-2.5 px-2 border-r border-white/20 text-center w-[45px]">#</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Drm id</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[110px]">Created Date</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[220px]">Company</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Sale Person</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Dollar</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Cus Dollar</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[100px]">Pkr</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Dollar Rate</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[80px]">Ex-Disc</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Ex-Disc Pkr</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[140px]">Package</th>
            {isLoan && <th className="py-2.5 px-2 border-r border-white/20 w-[100px]">loan Amount</th>}
            <th className="py-2.5 px-2 border-r border-white/20 w-[80px]">Type</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[100px]">Expire</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Droupout</th>
            <th className="py-2.5 px-2 border-r border-white/20 w-[90px]">Status</th>
            <th className="py-2.5 px-2 text-center w-[65px]">Action</th>
          </tr>
        </thead>
        <tbody className="bg-white font-bold dark:bg-zinc-900">
          {items.length > 0 ? items.map((item: any, i: number) => (
            <tr key={item.id} className="border-b hover:bg-gray-50/50 dark:hover:bg-zinc-800 transition-colors">
              <td className="p-2.5 border-r font-bold text-gray-400 text-center">{i + 1}</td>
              <td className="p-2.5 border-r font-black text-[#00a65a] italic uppercase dark:text-zinc-400 truncate" title={item.drmId}>{item.drmId || "-"}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 truncate">{safeDate(item.date, "yyyy-MM-dd")}</td>
              <td className="p-2.5 border-r font-black uppercase text-gray-700 dark:text-zinc-400 truncate" title={item.company}>{item.company || "-"}</td>
              <td className="p-2.5 border-r font-bold italic text-gray-500 dark:text-zinc-400 truncate">{item.salePerson || "-"}</td>
              <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.dollar || "0"}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400">$ {item.customerDollar || item.dollar || "0"}</td>
              <td className="p-2.5 border-r text-gray-600 dark:text-zinc-400">{Number(item.pkr || 0).toLocaleString()}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400">{item.rate || "-"}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400">{item.exDisc || "0"}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400">{item.exDiscPkr || "0"}</td>
              <td className="p-2.5 border-r text-gray-500 dark:text-zinc-400 truncate">{item.package || "-"}</td>
              {isLoan && <td className="p-2.5 border-r font-black text-gray-900 dark:text-zinc-100">$ {item.loanAmount || item.dollar || "0"}</td>}
              <td className="p-2.5 border-r">
                {item.type ? (
                  <Badge className={cn("text-[9px] font-black px-1.5 py-0.5 border-none shadow-none uppercase",
                    item.type==="New" ? "bg-emerald-100 text-emerald-700" :
                    item.type==="Rc"  ? "bg-blue-100 text-blue-700" :
                    item.type==="Ec"  ? "bg-red-100 text-red-700" :
                    item.type==="Rc-Up" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                  )}>{item.type}</Badge>
                ) : "-"}
              </td>
              <td className="p-2.5 border-r text-gray-400 dark:text-zinc-500 text-[10px]">{safeDate(item.expireDate, "yyyy-MM-dd")}</td>
              <td className="p-2.5 border-r text-gray-400 dark:text-zinc-500 text-[10px]">{safeDate(item.dropout, "yyyy-MM-dd", "None")}</td>
              <td className="p-2.5 border-r">
                <Badge className={cn("text-[9px] font-black px-1.5 py-0.5 border-none shadow-none uppercase",
                  item.status==="Approved" ? "bg-emerald-100 text-emerald-700" :
                  item.status==="Pending"  ? "bg-yellow-100 text-yellow-700" :
                  item.status==="Rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                )}>{item.status || "-"}</Badge>
              </td>
              <td className="p-2.5 text-center">
                <div className="flex gap-1.5 items-center justify-center">
                  <button 
                    type="button" 
                    onClick={() => onDollarModal ? onDollarModal(item, false) : (onAttach && onAttach(item))} 
                    title="Dollar Allocation / Pay Alibaba (Standard)"
                    className="w-5 h-5 rounded-full bg-[#00a65a] hover:bg-[#008d4c] text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
                  >
                    <DollarSign size={11} strokeWidth={2.8} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => onDollarModal ? onDollarModal(item, true) : (onView && onView(item))} 
                    title="Dollar Allocation / Pay Alibaba (Temp Payment)"
                    className="w-5 h-5 rounded-full bg-[#f39c12] hover:bg-[#d97706] text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
                  >
                    <Info size={11} strokeWidth={2.8} />
                  </button>
                </div>
              </td>
            </tr>
          )) : (
            <tr><td colSpan={colCount} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({ searchTerm, onSearch, startDate, onStart, endDate, onEnd, onClear, onExcel }: any) {
  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50/50 dark:bg-zinc-900 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
      <div className="relative w-60">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
        <Input placeholder="Search..." value={searchTerm} onChange={(e) => onSearch(e.target.value)} className="h-9 pl-10 rounded-md border-gray-200 shadow-sm text-sm dark:border-zinc-800" />
      </div>
      <div className="relative">
        <Input type="date" value={startDate} onChange={(e) => onStart(e.target.value)} className="h-9 w-40 text-sm border-gray-200 dark:border-zinc-800 pr-8" />
        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
      </div>
      <div className="relative">
        <Input type="date" value={endDate} onChange={(e) => onEnd(e.target.value)} className="h-9 w-40 text-sm border-gray-200 dark:border-zinc-800 pr-8" />
        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"/>
      </div>
      <Button onClick={onClear} className="bg-[#6c757d] hover:bg-[#5a6268] text-white px-6 h-9 rounded-md font-bold text-xs uppercase">Clear Filter</Button>
      {onExcel && <Button onClick={onExcel} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 h-9 rounded-md font-bold text-xs uppercase flex items-center gap-1"><FileSpreadsheet size={14}/> Export Excel</Button>}
    </div>
  );
}

export default function DollarSystem() {
  const [, setLocation] = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  useEffect(() => { const w = sidebarOpen; setSidebarOpen(false); return () => setSidebarOpen(w); }, []);

  const [quarterFilter, setQuarterFilter] = useState("CQ");
  const [fullSearch, setFullSearch] = useState(""); const [fullStart, setFullStart] = useState(""); const [fullEnd, setFullEnd] = useState("");
  const [partialSearch, setPartialSearch] = useState(""); const [partialStart, setPartialStart] = useState(""); const [partialEnd, setPartialEnd] = useState("");
  const [loanSearch, setLoanSearch] = useState(""); const [loanStart, setLoanStart] = useState(""); const [loanEnd, setLoanEnd] = useState("");
  const [pendSearch, setPendSearch] = useState(""); const [pendStart, setPendStart] = useState(""); const [pendEnd, setPendEnd] = useState("");
  const [abSearch, setAbSearch] = useState(""); const [abStart, setAbStart] = useState(""); const [abEnd, setAbEnd] = useState("");
  const [fullTypeFilter, setFullTypeFilter] = useState("all");
  const [loanTypeFilter, setLoanTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("full");
  const [activeTxTab, setActiveTxTab] = useState("balance");
  const [viewItem, setViewItem] = useState<any>(null);
  const [attachItem, setAttachItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Dollar Allocation / Pay Alibaba Modal State
  const [dollarModalItem, setDollarModalItem] = useState<any>(null);
  const [dollarSlots, setDollarSlots] = useState<any[]>([]);
  const [dollarForm, setDollarForm] = useState<any>({
    memberId: "",
    orderId: "",
    sliderMin: 0,
    sliderMax: 100,
    removeUnselected: true,
    dollar: "1357.00",
    dollarRate: "277.23",
    pkrAmount: "0.00",
    date: format(new Date(), "yyyy-MM-dd"),
    type: "",
    detail: "",
  });

  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);

  const handleSliderChange = (type: "min" | "max", val: number) => {
    const cleanVal = Math.max(0, Math.min(500, Math.round(val)));
    setDollarForm((prev: any) => {
      if (type === "min") {
        const newMin = Math.min(cleanVal, prev.sliderMax ?? 500);
        return { ...prev, sliderMin: newMin };
      } else {
        const newMax = Math.max(cleanVal, prev.sliderMin ?? 0);
        return { ...prev, sliderMax: newMax };
      }
    });
  };

  const startDragging = (thumb: "min" | "max", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveThumb(thumb);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeThumb || !sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const val = Math.round(pos * 500);
    handleSliderChange(activeThumb, val);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeThumb) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setActiveThumb(null);
    }
  };

  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const val = Math.round(pos * 500);
    const distMin = Math.abs(val - (dollarForm.sliderMin ?? 0));
    const distMax = Math.abs(val - (dollarForm.sliderMax ?? 100));
    if (distMin < distMax) {
      handleSliderChange("min", val);
      startDragging("min", e);
    } else {
      handleSliderChange("max", val);
      startDragging("max", e);
    }
  };

  const openDollarModal = (item: any, isTemp: boolean = false) => {
    const targetDollar = parseFloat(item.dollar || item.customerDollar || 0) || 1357;
    const rateVal = parseFloat(item.rate || 0) || 277.16;
    const pkrVal = item.pkr ? Number(item.pkr) : Math.round(targetDollar * rateVal);
    const memberIdVal = item.memberId || (item.drmId ? `pk${String(item.drmId).replace(/[^a-zA-Z0-9]/g, "")}uoqz` : "pk19023484233uoqz");
    const orderIdVal = item.orderId || (item.drmId ? `P${String(item.drmId).replace(/[^a-zA-Z0-9]/g, "")}` : `P${Date.now().toString().slice(0, 16)}`);
    const dateVal = item.date ? safeDate(item.date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    const remaining = targetDollar;
    const initialSlots = isTemp ? [
      {
        id: "0",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2026-01-17",
        email: "wloureiro2023@gmail.com",
        rate: 277.00,
        totalShort: "null",
        dollars: 900,
        useDollar: Math.min(900, Math.max(0, Math.round(remaining * 100) / 100))
      },
      {
        id: "1",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2026-01-12",
        email: "handyholdem0@gmail.com",
        rate: 280.00,
        totalShort: "null",
        dollars: 100,
        useDollar: Math.min(100, Math.max(0, Math.round(Math.max(0, remaining - 900) * 100) / 100))
      },
      {
        id: "15",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2025-09-15",
        email: "sportsexceedinc@gmail.com",
        rate: 284.00,
        totalShort: "null",
        dollars: 58.44,
        useDollar: Math.min(58.44, Math.max(0, Math.round(Math.max(0, remaining - 1000) * 100) / 100))
      },
      {
        id: "16",
        checked: remaining > 1058.44,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2025-09-15",
        email: "sportsexceedinc@gmail.com",
        rate: 284.00,
        totalShort: "null",
        dollars: 58.44,
        useDollar: Math.min(58.44, Math.max(0, Math.round(Math.max(0, remaining - 1058.44) * 100) / 100))
      }
    ] : [
      {
        id: "0",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2026-07-15",
        email: "sulemanr89@hotmail.com",
        rate: 278.92,
        totalShort: 1150,
        dollars: 51,
        useDollar: Math.min(51, Math.max(0, Math.round(remaining * 100) / 100))
      },
      {
        id: "1",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2026-09-30",
        email: "marketing@zabeelind.com",
        rate: 277.20,
        totalShort: 1100,
        dollars: 1083,
        useDollar: Math.min(1083, Math.max(0, Math.round(Math.max(0, remaining - 51) * 100) / 100))
      },
      {
        id: "2",
        checked: true,
        buyerName: "SYED HURR ABBAS",
        buyDate: "2026-09-16",
        email: "lacelocks404@gmail.com",
        rate: 277.00,
        totalShort: 4190,
        dollars: 1175,
        useDollar: Math.min(1175, Math.max(0, Math.round(Math.max(0, remaining - 1134) * 100) / 100))
      }
    ];

    setDollarModalItem({ ...item, pkr: pkrVal, rate: rateVal });
    setDollarSlots(initialSlots);
    setDollarForm({
      isTemp: isTemp,
      memberId: memberIdVal,
      orderId: orderIdVal,
      sliderMin: isTemp ? 2 : 0,
      sliderMax: 100,
      removeUnselected: true,
      dollar: String(targetDollar.toFixed(2)),
      dollarRate: String(rateVal.toFixed(2)),
      pkrAmount: "0.00",
      date: dateVal,
      type: item.type || "New",
      detail: item.notes || item.detail || ""
    });
  };

  const handleUseDollarChange = (id: string, val: string) => {
    const numVal = parseFloat(val) || 0;
    setDollarSlots(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, useDollar: numVal > s.dollars ? s.dollars : val };
      }
      return s;
    }));
  };

  const handleSlotToggle = (id: string) => {
    setDollarSlots(prev => prev.map(s => s.id === id ? { ...s, checked: !s.checked } : s));
  };

  const handleSlotDelete = (id: string) => {
    setDollarSlots(prev => prev.filter(s => s.id !== id));
  };

  const handleRemoveUnselectedToggle = (checked: boolean) => {
    setDollarForm((prev: any) => ({ ...prev, removeUnselected: checked }));
    if (!checked) {
      setDollarSlots(prev => prev.filter(s => s.checked));
    }
  };

  const handleDollarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Poof! You successfully paid Alibaba!");
    setDollarModalItem(null);
  };

  const {
    totalUsedDollars,
    totalUsedPkrs,
    customDollarRate,
    profitOrLoss,
    remainingDollars,
    shortSum,
    dollarPkr,
    isProfit
  } = useMemo(() => {
    if (!dollarModalItem) return { totalUsedDollars: 0, totalUsedPkrs: 0, customDollarRate: "0.00", profitOrLoss: "0.00", remainingDollars: "0.00", shortSum: "0.00", dollarPkr: "0", isProfit: false };
    
    const checkedSlots = dollarSlots.filter(s => s.checked);
    const totalUsed = checkedSlots.reduce((acc, s) => acc + (parseFloat(s.useDollar) || 0), 0);
    const totalPkrs = checkedSlots.reduce((acc, s) => acc + ((parseFloat(s.useDollar) || 0) * (parseFloat(s.rate) || 0)), 0);
    
    const targetDollar = parseFloat(dollarForm.dollar) || 0;
    const cusRate = totalUsed > 0 ? (totalPkrs / totalUsed).toFixed(2) : "0.00";
    
    const customerPaidPkr = parseFloat(dollarModalItem.pkr) || (targetDollar * (parseFloat(dollarModalItem.rate) || 277.16));
    const cusDollarRatePkr = targetDollar * parseFloat(cusRate || "0");
    const pkrDiffer = customerPaidPkr - cusDollarRatePkr;
    const pftLoss = parseFloat(cusRate) > 0 ? (pkrDiffer / parseFloat(cusRate)).toFixed(2) : "0.00";
    const remain = Math.max(0, targetDollar - totalUsed).toFixed(2);
    const shortS = (totalUsed + 2991).toFixed(2);
    
    return {
      totalUsedDollars: totalUsed,
      totalUsedPkrs: totalPkrs,
      customDollarRate: cusRate,
      profitOrLoss: pftLoss,
      remainingDollars: remain,
      shortSum: shortS,
      dollarPkr: Math.round(totalPkrs).toLocaleString(),
      isProfit: pkrDiffer >= 0
    };
  }, [dollarModalItem, dollarSlots, dollarForm.dollar]);

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
    balance:{count:0,sum:0,items:[]}, buy:{count:0,sum:0,items:[]},
    sell:{count:0,sum:0,items:[]}, martini:{count:0,sum:0,items:[]}, notUsed:{count:0,sum:0,items:[]}
  };
  const counts = data?.counts || { full:0, partial:0, pending:0, temp:0 };

  const flt = (arr: any[], search: string, s?: string, e?: string) => arr.filter((item: any) => {
    if (search) {
      const t = search.toLowerCase();
      if (!Object.values(item).some(v => String(v||"").toLowerCase().includes(t))) return false;
    }
    const d = item.date || item.abDate || item.createdAt;
    if (d) {
      try {
        const ds = safeDate(d, "yyyy-MM-dd", "");
        if (s && ds < s) return false;
        if (e && ds > e) return false;
      } catch { return true; }
    } else if (s || e) return false;
    return true;
  });

  const ncFullCount = useMemo(() => flt(fullPayments, fullSearch, fullStart, fullEnd).filter((p: any)=>p.type==="New").length, [fullPayments, fullSearch, fullStart, fullEnd]);
  const rcFullCount = useMemo(() => flt(fullPayments, fullSearch, fullStart, fullEnd).filter((p: any)=>p.type==="Rc"||p.type==="Rc-Up").length, [fullPayments, fullSearch, fullStart, fullEnd]);
  const ecFullCount = useMemo(() => flt(fullPayments, fullSearch, fullStart, fullEnd).filter((p: any)=>p.type==="Ec").length, [fullPayments, fullSearch, fullStart, fullEnd]);

  const fFull = useMemo(() => {
    const base = flt(fullPayments, fullSearch, fullStart, fullEnd);
    if (fullTypeFilter === "all") return base;
    if (fullTypeFilter === "Rc") return base.filter((p: any) => p.type === "Rc" || p.type === "Rc-Up");
    return base.filter((p: any) => p.type === fullTypeFilter);
  }, [fullPayments, fullSearch, fullStart, fullEnd, fullTypeFilter]);

  const fPartial = useMemo(() => flt(partialPayments, partialSearch, partialStart, partialEnd), [partialPayments, partialSearch, partialStart, partialEnd]);

  const ncLoanCount = useMemo(() => flt(loans, loanSearch, loanStart, loanEnd).filter((p: any)=>p.type==="New").length, [loans, loanSearch, loanStart, loanEnd]);
  const rcLoanCount = useMemo(() => flt(loans, loanSearch, loanStart, loanEnd).filter((p: any)=>p.type==="Rc"||p.type==="Rc-Up").length, [loans, loanSearch, loanStart, loanEnd]);
  const ecLoanCount = useMemo(() => flt(loans, loanSearch, loanStart, loanEnd).filter((p: any)=>p.type==="Ec").length, [loans, loanSearch, loanStart, loanEnd]);

  const fLoan = useMemo(() => {
    const base = flt(loans, loanSearch, loanStart, loanEnd);
    if (loanTypeFilter === "all") return base;
    if (loanTypeFilter === "Rc") return base.filter((p: any) => p.type === "Rc" || p.type === "Rc-Up");
    return base.filter((p: any) => p.type === loanTypeFilter);
  }, [loans, loanSearch, loanStart, loanEnd, loanTypeFilter]);
  const fPend    = useMemo(() => flt(pendingApprovals,pendSearch,    pendStart,    pendEnd),    [pendingApprovals,pendSearch,    pendStart,    pendEnd]);
  const fAb      = useMemo(() => flt(alibabaPayments, abSearch,      abStart,      abEnd),      [alibabaPayments, abSearch,      abStart,      abEnd]);

  const fullUsd  = useMemo(() => fFull.reduce((a: number, r: any) => a + Number(r.dollar||0), 0), [fFull]);
  const fullPkr  = useMemo(() => fFull.reduce((a: number, r: any) => a + Number(r.pkr||0), 0),   [fFull]);
  const partUsd  = useMemo(() => fPartial.reduce((a: number, r: any) => a + Number(r.dollar||0), 0), [fPartial]);
  const partPkr  = useMemo(() => fPartial.reduce((a: number, r: any) => a + Number(r.pkr||0), 0),   [fPartial]);
  const txItems  = useMemo(() => {
    const m: Record<string, any[]> = { balance: dts.balance?.items||[], buy: dts.buy?.items||[], sell: dts.sell?.items||[], martini: dts.martini?.items||[], notUsed: dts.notUsed?.items||[] };
    return m[activeTxTab] || [];
  }, [activeTxTab, dts]);

  const fmt2 = (v: any) => Number(v||0).toFixed(2);
  const fmtN = (v: any) => Number(v||0).toLocaleString();
  const fmtU = (v: any, d=2) => Number(v||0).toLocaleString(undefined, {minimumFractionDigits: d});

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-white dark:bg-zinc-900"><Loader2 className="h-10 w-10 animate-spin text-[#00a65a]"/></div>;

  return (
    <>
      {viewItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" style={{backdropFilter:"blur(4px)"}} onClick={()=>setViewItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#f39c12] px-6 py-4 flex items-center justify-between">
              <div className="text-white font-[1000] text-lg uppercase">Record Details</div>
              <button onClick={()=>setViewItem(null)} className="text-white hover:text-white/70"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-3">
              {[["DRM ID",viewItem.drmId],["Company",viewItem.company],["Sale Person",viewItem.salePerson],["Member ID",viewItem.memberId],["Date",safeDate(viewItem.date, "dd MMM yyyy")],["Product",viewItem.package],["Order Type",viewItem.type],["Contract No",viewItem.orderId],["Dollar",viewItem.dollar?"$ "+viewItem.dollar:"-"],["Cus Dollar",viewItem.customerDollar?"$ "+viewItem.customerDollar:"-"],["PKR",viewItem.pkr?"PKR "+Number(viewItem.pkr).toLocaleString():"-"],["Dollar Rate",viewItem.rate?"PKR "+viewItem.rate:"-"],["Ex-Disc",viewItem.exDisc?"$ "+viewItem.exDisc:"-"],["Ex-Disc Pkr",viewItem.exDiscPkr?"PKR "+viewItem.exDiscPkr:"-"],["Status",viewItem.status]].map(([l,v])=>(
                <div key={l} className="flex items-start gap-2 text-[12px]"><span className="w-36 font-black text-gray-500 uppercase shrink-0 dark:text-zinc-400">{l}</span><span className="font-bold text-gray-800 dark:text-zinc-200">{v||"-"}</span></div>
              ))}
              {viewItem.proofUrl && <div className="pt-3 border-t border-gray-100"><a href={viewItem.proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#00a65a] text-white px-4 py-2 rounded-md text-[11px] font-black uppercase hover:bg-[#008d4c]"><Eye size={14}/> View File</a></div>}
            </div>
          </div>
        </div>, document.body
      )}

      {attachItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" style={{backdropFilter:"blur(4px)"}} onClick={()=>setAttachItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-[#f39c12] px-6 py-4 flex items-center justify-between">
              <div className="text-white font-[1000] text-lg uppercase">Attach File</div>
              <button onClick={()=>setAttachItem(null)} className="text-white hover:text-white/70"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-[11px] text-gray-500 font-bold">Record: <span className="text-gray-800">{attachItem.company||attachItem.drmId}</span></div>
              {attachItem.proofUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3"><FileText size={16} className="text-[#00a65a]"/><span className="text-[11px] font-bold text-[#00a65a]">File already attached</span></div>
                  <a href={attachItem.proofUrl} target="_blank" rel="noreferrer" className="w-full flex items-center justify-center gap-2 bg-[#00a65a] text-white px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-[#008d4c]"><Eye size={14}/> View Current File</a>
                  <button onClick={()=>fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-gray-50">Replace File</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center"><FileText size={32} className="text-gray-300 mx-auto mb-2"/><div className="text-[11px] text-gray-400 font-bold">No file attached yet</div></div>
                  <button onClick={()=>fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-[#f39c12] text-white px-4 py-2.5 rounded-md text-[11px] font-black uppercase hover:bg-[#d97706]">
                    {uploading?<Loader2 size={14} className="animate-spin"/>:<FileText size={14}/>} {uploading?"Uploading...":"Choose & Upload File"}
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={async(e)=>{
                const f=e.target.files?.[0]; if(!f)return; setUploading(true);
                try {
                  const fd=new FormData(); fd.append("file",f); fd.append("entryId",String(attachItem.id));
                  const r=await fetch("/api/account/dollar-system/attach",{method:"POST",headers:getAuthHeader(),credentials:"include",body:fd});
                  if(r.ok){const d=await r.json();setAttachItem((p: any)=>({...p,proofUrl:d.proofUrl}))} else alert("Upload failed.");
                } catch{alert("Upload failed.");} finally{setUploading(false);if(fileRef.current)fileRef.current.value="";}
              }}/>
            </div>
          </div>
        </div>, document.body
      )}

      {dollarModalItem && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" style={{backdropFilter:"blur(4px)"}} onClick={()=>setDollarModalItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[95vh] flex flex-col border border-gray-200 dark:border-zinc-800" onClick={e=>e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className={cn("px-6 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors",
              dollarForm.isTemp 
                ? "bg-[#f59e0b] text-gray-900 border-b border-amber-600/30" 
                : "bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 border-b border-gray-100 dark:border-zinc-800"
            )}>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-base font-bold uppercase tracking-tight">
                <span className={dollarForm.isTemp ? "text-gray-900" : "text-gray-800 dark:text-zinc-100"}>
                  {dollarModalItem.company || "ROYAL TRADERS"} PKR: <span className="text-[#e74c3c] font-black">{dollarModalItem.pkr ? Number(dollarModalItem.pkr).toLocaleString() : "320000"}</span>
                </span>
                <span className={dollarForm.isTemp ? "text-gray-900" : "text-gray-800 dark:text-zinc-100"}>
                  Dollar Rate: <span className="text-[#e74c3c] font-black">{dollarModalItem.rate || "277.16"}</span>
                </span>
              </div>
              <button 
                onClick={()=>setDollarModalItem(null)} 
                className={cn("transition-colors p-1",
                  dollarForm.isTemp ? "text-gray-900 hover:text-black" : "text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
                )} 
                title="Close"
              >
                <X size={20}/>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 text-xs">
              <form onSubmit={handleDollarSubmit} className="space-y-4">
                
                {/* Top Inputs: Member Id and Order Id */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Member Id</label>
                    <Input 
                      value={dollarForm.memberId} 
                      onChange={e=>setDollarForm({...dollarForm, memberId: e.target.value})} 
                      placeholder="Enter member id" 
                      className="h-9 text-xs border-gray-300 rounded-md dark:border-zinc-700 text-gray-800 dark:text-zinc-200" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Order Id</label>
                    <Input 
                      value={dollarForm.orderId} 
                      onChange={e=>setDollarForm({...dollarForm, orderId: e.target.value})} 
                      placeholder="Enter order id" 
                      className="h-9 text-xs border-gray-300 rounded-md dark:border-zinc-700 text-gray-800 dark:text-zinc-200" 
                    />
                  </div>
                </div>

                {/* Range Slider Section */}
                {(() => {
                  const minP = Math.min(100, Math.max(0, ((dollarForm.sliderMin ?? 0) / 500) * 100));
                  const maxP = Math.min(100, Math.max(0, ((dollarForm.sliderMax ?? 100) / 500) * 100));
                  return (
                    <div 
                      className="pt-2 pb-2 select-none"
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      <div className="relative pt-7 pb-2">
                        {/* Floating Min Badge */}
                        <div 
                          className="absolute top-0 transition-all pointer-events-none"
                          style={{ left: `${minP}%`, transform: "translateX(-50%)" }}
                        >
                          <span className="bg-[#00a65a] text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {dollarForm.sliderMin ?? 0}
                          </span>
                        </div>

                        {/* Floating Max Badge */}
                        <div 
                          className="absolute top-0 transition-all pointer-events-none"
                          style={{ left: `${maxP}%`, transform: "translateX(-50%)" }}
                        >
                          <span className="bg-[#00a65a] text-white text-[11px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {dollarForm.sliderMax ?? 100}
                          </span>
                        </div>

                        {/* End Limit Badge 500 */}
                        <div className="absolute top-0 right-0 pointer-events-none">
                          <span className="bg-[#e9ecef] text-gray-700 text-[11px] font-bold px-2 py-0.5 rounded shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                            500
                          </span>
                        </div>

                        {/* Slider Track */}
                        <div 
                          ref={sliderTrackRef}
                          onPointerDown={handleTrackPointerDown}
                          className="h-2 bg-gray-200 dark:bg-zinc-700 rounded-full relative my-3 cursor-pointer group"
                        >
                          {/* Active Highlight Bar */}
                          <div 
                            className="bg-[#00a65a] h-full rounded-full pointer-events-none absolute"
                            style={{ 
                              left: `${minP}%`, 
                              width: `${Math.max(0, maxP - minP)}%` 
                            }} 
                          />

                          {/* Left Diamond Handle */}
                          <div 
                            onPointerDown={(e) => startDragging("min", e)}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-black rotate-45 shadow hover:scale-125 active:scale-125 transition-transform cursor-grab active:cursor-grabbing z-20"
                            style={{ left: `${minP}%` }}
                            title={`Min: ${dollarForm.sliderMin ?? 0}`}
                          />

                          {/* Right Diamond Handle */}
                          <div 
                            onPointerDown={(e) => startDragging("max", e)}
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-black rotate-45 shadow hover:scale-125 active:scale-125 transition-transform cursor-grab active:cursor-grabbing z-20"
                            style={{ left: `${maxP}%` }}
                            title={`Max: ${dollarForm.sliderMax ?? 100}`}
                          />
                        </div>

                        {/* Scale Numbers & Ticks */}
                        <div className="flex justify-between text-[10px] text-gray-400 font-semibold pt-1">
                          <span>0</span>
                          <span>125</span>
                          <span>250</span>
                          <span>375</span>
                          <span>500</span>
                        </div>
                      </div>

                      {/* Remove Unselected Slot Checkbox */}
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 cursor-pointer select-none mt-2">
                        <input 
                          type="checkbox" 
                          checked={dollarForm.removeUnselected} 
                          onChange={e => handleRemoveUnselectedToggle(e.target.checked)} 
                          className="rounded border-gray-300 text-[#00a65a] focus:ring-[#00a65a] w-4 h-4 cursor-pointer" 
                        />
                        <span>Uncheck The Box For Remove The Unselected Slot</span>
                      </label>
                    </div>
                  );
                })()}

                {/* Buyer Slots Repeater List */}
                <div className="space-y-3 pt-1">
                  {dollarSlots.map((slot) => (
                    <div key={slot.id} className="flex flex-wrap md:flex-nowrap items-center gap-2.5 bg-gray-50/70 dark:bg-zinc-800/50 p-2.5 rounded-lg border border-gray-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1 shrink-0 pt-4">
                        <input 
                          type="checkbox" 
                          checked={slot.checked} 
                          onChange={() => handleSlotToggle(slot.id)} 
                          className="rounded border-red-400 text-red-600 focus:ring-red-400 w-4 h-4 cursor-pointer" 
                        />
                        <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">{slot.id}</span>
                      </div>
                      <div className="flex-1 min-w-[150px]">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-gray-700 dark:text-zinc-300">Buyer Name</label>
                          <span className="text-[10px] text-red-500 font-semibold">{slot.buyDate}</span>
                        </div>
                        <Input 
                          value={slot.buyerName} 
                          readOnly 
                          className="h-8 text-xs font-medium text-gray-800 bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200" 
                        />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">Paypal Email</label>
                        <Input 
                          value={slot.email} 
                          readOnly 
                          className="h-8 text-xs font-medium text-gray-800 bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200" 
                        />
                      </div>
                      <div className="w-16 shrink-0">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">$ Rate</label>
                        <div className="h-8 flex items-center justify-center bg-[#fee2e2] text-[#ef4444] rounded text-xs font-bold px-1.5">
                          {slot.rate}
                        </div>
                      </div>
                      <div className="w-24 shrink-0">
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[11px] font-bold text-gray-700 dark:text-zinc-300">Dollars</label>
                          <span className="text-[10px] text-red-500 font-bold">{slot.totalShort}</span>
                        </div>
                        <Input 
                          value={slot.dollars} 
                          readOnly 
                          className="h-8 text-xs font-bold text-gray-700 bg-gray-100 border-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-center" 
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-zinc-300 mb-1">Use Dollar</label>
                        <Input 
                          type="number" 
                          step="any" 
                          value={slot.useDollar} 
                          onChange={e => handleUseDollarChange(slot.id, e.target.value)} 
                          className="h-8 text-xs font-bold text-gray-900 bg-white border-gray-300 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 text-center" 
                        />
                      </div>
                      <div className="shrink-0 pt-4">
                        <button 
                          type="button" 
                          onClick={() => handleSlotDelete(slot.id)} 
                          className="text-red-500 hover:text-red-700 p-1 transition-colors cursor-pointer" 
                          title="Delete Slot"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Stats Badges */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 py-2 border-t border-b border-gray-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span>Remaining Dollars</span> 
                    <span className="bg-[#d4edda] text-[#155724] px-2 py-0.5 rounded text-xs font-bold">{remainingDollars}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Custom Dollar Rate</span> 
                    <span className="bg-[#f8d7da] text-[#721c24] px-2 py-0.5 rounded text-xs font-bold">{customDollarRate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#28a745] font-bold">Profit</span> or <span className="text-[#dc3545] font-bold">Loss</span> 
                    <span className={cn("px-2 py-0.5 rounded text-xs font-bold", isProfit ? "bg-[#d4edda] text-[#155724]" : "bg-[#f8d7da] text-[#721c24]")}>{profitOrLoss}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Dollar Pkr</span> 
                    <span className="bg-[#f8d7da] text-[#721c24] px-2 py-0.5 rounded text-xs font-bold">{dollarPkr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Short Sum</span> 
                    <span className="bg-[#f8d7da] text-[#721c24] px-2 py-0.5 rounded text-xs font-bold">{shortSum}</span>
                  </div>
                </div>

                {/* Currency Exchange Row */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-600 text-xs font-semibold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">Dollar</span>
                    <Input 
                      value={dollarForm.dollar} 
                      onChange={e=>setDollarForm({...dollarForm, dollar: e.target.value})} 
                      className="rounded-none rounded-r-md h-9 text-xs font-bold text-gray-800 border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {}} 
                    className="w-9 h-9 rounded-full bg-[#00a65a] hover:bg-[#008d4c] text-white flex items-center justify-center shadow-sm shrink-0 transition-transform active:scale-95 cursor-pointer"
                  >
                    <ArrowLeftRight size={15} />
                  </button>
                  <div className="flex-1 flex rounded-md shadow-sm">
                    <Input 
                      value={dollarForm.dollarRate} 
                      onChange={e=>setDollarForm({...dollarForm, dollarRate: e.target.value})} 
                      className="rounded-none rounded-l-md h-9 text-xs font-bold text-gray-800 border-gray-300 text-right dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" 
                    />
                    <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-600 text-xs font-semibold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">Dollar Rate</span>
                  </div>
                </div>

                {/* Bottom Inputs: Pkr Amount, Date, Type, Detail */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Pkr Amount</label>
                    <Input 
                      value={dollarForm.pkrAmount} 
                      readOnly 
                      className="h-9 text-xs bg-gray-100 border-gray-300 rounded-md dark:bg-zinc-800 dark:border-zinc-700 text-gray-700 dark:text-zinc-300" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Date</label>
                    <div className="relative">
                      <Input 
                        type="date" 
                        value={dollarForm.date} 
                        onChange={e=>setDollarForm({...dollarForm, date: e.target.value})} 
                        className="h-9 text-xs border-gray-300 rounded-md pr-9 dark:border-zinc-700 text-gray-800 dark:text-zinc-200" 
                      />
                      <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Type</label>
                    <select 
                      value={dollarForm.type} 
                      onChange={e=>setDollarForm({...dollarForm, type: e.target.value})} 
                      className="h-9 w-full text-xs border border-gray-300 rounded-md px-3 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="">Choose...</option>
                      <option value="New">New</option>
                      <option value="Renewal">Renewal</option>
                      <option value="Expire">Expire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Detail</label>
                    <textarea 
                      value={dollarForm.detail} 
                      onChange={e=>setDollarForm({...dollarForm, detail: e.target.value})} 
                      placeholder="add detail" 
                      rows={1} 
                      className="w-full text-xs border border-gray-300 rounded-md p-2 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 focus:outline-none min-h-[36px] resize-y" 
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full h-10 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold text-sm uppercase rounded-md shadow-sm transition-all mt-2"
                >
                  Submit
                </Button>
              </form>
            </div>
          </div>
        </div>, document.body
      )}

      <div className="flex flex-col min-h-screen bg-[#f4f6f9] font-sans text-gray-700 dark:bg-zinc-950 dark:text-zinc-400">
        <div className="max-w-[1920px] mx-auto p-4 space-y-4">
          <div className="flex flex-col xl:flex-row gap-4 items-start">

            {/* LEFT COLUMN (col-xl-4) */}
            <div className="w-full xl:w-[380px] shrink-0 space-y-4">

              {/* WALLETS CARD */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 font-bold text-gray-800 text-sm border-b uppercase dark:text-zinc-100 dark:border-zinc-800">Wallets</div>
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-blue-400 font-bold">Available Balance</span>
                    <div className="relative">
                      <select id="AccountdashHead" value={quarterFilter} onChange={e=>setQuarterFilter(e.target.value)} className="appearance-none border border-gray-200 rounded px-2 pr-6 py-0.5 text-[10px] font-bold text-gray-600 bg-white cursor-pointer dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-400 focus:outline-none">
                        <option value="CQ">Current Q</option>
                        <option value="LQ">Last Q</option>
                        <option value="LS">Last S</option>
                        <option value="LY">Last Y</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xl font-[1000] text-gray-900 border-b-2 border-emerald-500 inline-block dark:text-zinc-100">C $ {fmt2(ws.availableCash)}</div>
                      <div className="text-[11px] text-gray-500 font-bold pb-1 dark:text-zinc-400">PKR {fmt2(ws.availableCashPkr)}</div>
                      <div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">L $ {fmt2(ws.availableLoan)}</div>
                      <div className="text-[11px] text-gray-400 font-bold">PKR {fmt2(ws.availableLoanPkr)}</div>
                    </div>
                    <div className="text-right space-y-2">
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Dollars Recovery</div>
                        <a href="/account/recovery-payments" target="_blank" className="text-base font-[1000] text-gray-900 border-b-2 border-red-500 inline-block hover:text-red-500 dark:text-zinc-100">$ {fmt2(ws.dollarRecovered)}</a>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Cash Recovery</div>
                        <a href="/account/recovery-payments" target="_blank" className="text-base font-[1000] text-gray-900 hover:text-red-500 dark:text-zinc-100 block">PKR {fmt2(ws.cashRecovered)}</a>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Partial Dollars Recovery</div>
                        <a href="/account/recovery-payments" target="_blank" className="text-base font-[1000] text-gray-900 hover:text-blue-500 dark:text-zinc-100 block">$ {fmt2(ws.partialDollarsRecovery)}</a>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-50 dark:border-zinc-800">
                    <div><div className="text-[11px] text-gray-500 font-black uppercase dark:text-zinc-400">Required Balance To Pay</div><div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">$ {fmt2(ws.requiredToPay)}</div></div>
                    <div><div className="text-[11px] text-gray-500 font-black uppercase dark:text-zinc-400">Cash In Hand</div><div className="text-lg font-[1000] text-gray-900 dark:text-zinc-100">PKR {fmtN(ws.cashInHand)}</div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 dark:border-zinc-800">
                    <div><div className="text-[11px] text-[#00a65a] font-black uppercase">Cash Recovered</div><div className="text-base font-[1000] text-gray-900 dark:text-zinc-100">PKR {fmt2(ws.cashRecovered)}</div></div>
                    <div className="text-right"><div className="text-[11px] text-[#00a65a] font-black uppercase">Dollar Recovered</div><div className="text-base font-[1000] text-gray-900 dark:text-zinc-100">$ {fmt2(ws.dollarRecovered)}</div></div>
                  </div>
                </div>
                <div className="p-4 border-t dark:border-zinc-800">
                  <div className="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-wider">In this month usage</div>
                  <div className="grid grid-cols-4 gap-2 text-center items-start pb-4 border-b border-gray-50 mb-3 dark:border-zinc-800">
                    <div><ArrowUp className="w-5 h-5 text-[#00a65a] mx-auto mb-1"/><div className="text-[8px] text-gray-400 font-black uppercase leading-tight">Dollar<br/>Buying</div><div className="text-[10px] font-black">$ {fmt2(data?.monthlySummary?.buyingUsd)}</div></div>
                    <div><Send className="w-5 h-5 text-[#00a65a] mx-auto mb-1 rotate-45"/><div className="text-[8px] text-gray-400 font-black uppercase leading-tight">Dollar<br/>Paid</div><div className="text-[10px] font-black">$ {fmt2(data?.monthlySummary?.paidUsd)}</div></div>
                    <div><Wallet className="w-5 h-5 text-[#00a65a] mx-auto mb-1"/><div className="text-[8px] text-gray-400 font-black uppercase leading-tight">Dollar<br/>Balance</div><div className="text-[10px] font-black">$ {fmt2(data?.monthlySummary?.balanceUsd)}</div></div>
                    <div><div className="w-5 h-5 flex items-center justify-center mx-auto mb-1 border-2 border-[#00a65a] text-[#00a65a] font-black text-[9px]">A</div><div className="text-[8px] text-gray-400 font-black uppercase leading-tight">Advance<br/>Pay</div><div className="text-[10px] font-black">PKR {fmtN(data?.monthlySummary?.advancePkr)}</div></div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[["Receive", "/account/dollar-buying"],["Send","/account/dollar-pay"],["Balance",null],["Advance Pay","/account/dollar-advance-payment"]].map(([b,a]) => (
                      <button key={b} onClick={a?()=>setLocation(a):undefined} className="bg-[#00a65a] text-white text-[8px] font-bold py-1.5 rounded-sm shadow-sm uppercase tracking-tight">{b}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CURRENT DAY TRANSACTIONS — 5 tabs: Balance / Buy / Sell / Martini / Not Used */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 font-bold text-gray-800 text-sm border-b uppercase dark:text-zinc-100 dark:border-zinc-800">Current Day Transactions</div>
                <div className="p-3">
                  <div className="flex flex-wrap gap-1 bg-gray-50 rounded-md p-1 mb-3 dark:bg-zinc-800">
                    {[
                      {id:"balance",label:"Balance",c:"bg-gray-500"},
                      {id:"buy",    label:"Buy",    c:"bg-[#00a65a]"},
                      {id:"sell",   label:"Sell",   c:"bg-red-500"},
                      {id:"martini",label:"Martini",c:"bg-blue-400"},
                      {id:"notUsed",label:"Not Used",c:"bg-blue-400"},
                    ].map(tab => (
                      <button key={tab.id} onClick={()=>setActiveTxTab(tab.id)}
                        className={cn("flex-1 min-w-0 text-[8px] font-black py-1.5 px-1 rounded text-white transition-all flex items-center justify-between gap-0.5",
                          activeTxTab===tab.id ? tab.c : "bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400"
                        )}>
                        <span className="truncate">{tab.label}</span>
                        <span className="text-[8px] opacity-90 shrink-0">{dts[tab.id]?.count||0}({Number(dts[tab.id]?.sum||0).toFixed(0)})</span>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {txItems.length > 0 ? txItems.map((tx, i) => (
                      <div key={i} className="flex gap-2 pb-3 border-b border-gray-50 last:border-0 last:pb-0 items-start dark:border-zinc-800">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white",
                          activeTxTab==="buy"?"bg-[#00a65a]":activeTxTab==="sell"?"bg-red-400":activeTxTab==="martini"||activeTxTab==="notUsed"?"bg-yellow-400":"bg-gray-400"
                        )}>
                          <ArrowRight size={12} className={activeTxTab==="sell"?"rotate-180":"rotate-[-45deg]"}/>
                        </div>
                        <div className="flex-1 min-w-0 flex justify-between items-start">
                          <div>
                            <div className="text-[10px] font-black text-gray-800 uppercase truncate w-28 dark:text-zinc-100">{tx.name||"-"}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase">{safeDate(tx.date, "dd MMM yyyy")}</div>
                            <div className="text-[9px] text-blue-400 font-medium italic truncate w-28">{tx.email||"-"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black text-gray-800 dark:text-zinc-100">{tx.rate||"-"}</div>
                            <div className="text-[10px] font-black text-gray-800 dark:text-zinc-100">$ {tx.amount||"0"}</div>
                          </div>
                        </div>
                      </div>
                    )) : <div className="text-[10px] text-gray-400 text-center py-4 italic">No transactions for today</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (col-xl-8) */}
            <div className="flex-1 min-w-0 space-y-4">

              {/* TOP TABS: Full / Partial / Tem Payment / AB Liabilities */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                <div className="p-4 border-b dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      {id:"full",          label:"Full "+(fullPayments.length||counts.full||0)},
                      {id:"partial",       label:"Partial "+(partialPayments.length||counts.partial||0)},
                      {id:"term",          label:"Tem Payment "+(counts.temp||0)},
                      {id:"ab_liabilities",label:"AB Liabilities"},
                    ].map(t => (
                      <Badge key={t.id} className={cn("px-4 py-2 text-[12px] font-black uppercase rounded-md shadow-none cursor-pointer transition-all border-none whitespace-nowrap",
                        activeTab===t.id?"bg-[#00a65a] text-white hover:bg-[#008d4c]":"bg-transparent text-gray-500 dark:text-slate-400 hover:bg-gray-100"
                      )} onClick={()=>setActiveTab(t.id)}>{t.label}</Badge>
                    ))}
                  </div>
                </div>
                <div className="p-4">

                  {/* FULL TAB */}
                  {activeTab==="full" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-y-3">
                      <div>
                        <div className="text-xl font-[1000] text-gray-900 uppercase tracking-tighter flex items-center gap-3 dark:text-zinc-100">
                          Full Payment Received <span className="text-red-500">{fFull.length}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] font-[1000] tracking-tighter uppercase mt-1">
                          <button
                            type="button"
                            onClick={() => setFullTypeFilter("all")}
                            className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer",
                              fullTypeFilter === "all" ? "bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:text-zinc-400"
                            )}
                          >
                            All ({flt(fullPayments, fullSearch, fullStart, fullEnd).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFullTypeFilter(prev => prev === "New" ? "all" : "New")}
                            className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                              fullTypeFilter === "New" ? "bg-[#00a65a] text-white shadow-sm" : "hover:bg-emerald-50 dark:hover:bg-zinc-800"
                            )}
                          >
                            <span>NC</span>
                            <span className={fullTypeFilter === "New" ? "text-white" : "text-[#00a65a]"}>({ncFullCount})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFullTypeFilter(prev => prev === "Rc" ? "all" : "Rc")}
                            className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                              fullTypeFilter === "Rc" ? "bg-blue-600 text-white shadow-sm" : "hover:bg-blue-50 dark:hover:bg-zinc-800"
                            )}
                          >
                            <span>RC</span>
                            <span className={fullTypeFilter === "Rc" ? "text-white" : "text-blue-500"}>({rcFullCount})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFullTypeFilter(prev => prev === "Ec" ? "all" : "Ec")}
                            className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                              fullTypeFilter === "Ec" ? "bg-red-600 text-white shadow-sm" : "hover:bg-red-50 dark:hover:bg-zinc-800"
                            )}
                          >
                            <span>EC</span>
                            <span className={fullTypeFilter === "Ec" ? "text-white" : "text-red-500"}>({ecFullCount})</span>
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {[
                          {l:"Cash Received",   u:fullUsd, p:fullPkr},
                          {l:"Online Paid",     u:Number(abLiabilities.fullOnlinePaidUsd||0), p:Number(abLiabilities.fullOnlinePaidPkr||0)},
                          {l:"Customer Paid",   u:fullUsd, p:fullPkr},
                        ].map((b,bi) => (
                          <div key={bi} className={cn("flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5", bi<2&&"border-r border-gray-200 pr-4 dark:border-zinc-800")}>
                            <span className="text-gray-400">{b.l}</span>
                            <div className="flex gap-1">
                              <Badge className="bg-emerald-50 text-[#00a65a] border-none px-1.5 py-0.5 shadow-none font-black text-[10px]">$ {fmtU(b.u)}</Badge>
                              <Badge className="bg-rose-50 text-red-400 border-none px-1.5 py-0.5 shadow-none font-black italic text-[10px]">Pkr {fmtN(b.p)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <FilterBar searchTerm={fullSearch} onSearch={setFullSearch} startDate={fullStart} onStart={setFullStart} endDate={fullEnd} onEnd={setFullEnd} onClear={()=>{setFullSearch("");setFullStart("");setFullEnd("");setFullTypeFilter("all");}} onExcel={()=>{}}/>
                    <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800"><PaymentTable items={fFull} onView={setViewItem} onAttach={setAttachItem} onDollarModal={openDollarModal}/></div>
                    <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">Showing {fFull.length} of {fullPayments.length} entries</div>
                  </div>
                  )}

                  {/* PARTIAL TAB */}
                  {activeTab==="partial" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center justify-between gap-y-3">
                      <div className="text-xl font-[1000] text-gray-900 uppercase tracking-tighter dark:text-zinc-100">Partial Full Payment Received <span className="text-red-500">{fPartial.length}</span></div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {l:"Cash Received",       u:partUsd, p:partPkr},
                          {l:"Extra Discount",      u:0,       p:0},
                          {l:"Online Paid",         u:Number(abLiabilities.partialOnlinePaidUsd||0), p:Number(abLiabilities.partialOnlinePaidPkr||0)},
                          {l:"Customer Paid",       u:partUsd, p:partPkr},
                        ].map((b,bi) => (
                          <div key={bi} className={cn("flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5", bi<3&&"border-r border-gray-200 pr-3 dark:border-zinc-800")}>
                            <span className="text-gray-400">{b.l}</span>
                            <div className="flex gap-1">
                              <Badge className="bg-emerald-50 text-[#00a65a] border-none px-1.5 py-0.5 shadow-none font-black text-[10px]">$ {fmtU(b.u)}</Badge>
                              <Badge className="bg-rose-50 text-red-400 border-none px-1.5 py-0.5 shadow-none font-black italic text-[10px]">Pkr {fmtN(b.p)}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <FilterBar searchTerm={partialSearch} onSearch={setPartialSearch} startDate={partialStart} onStart={setPartialStart} endDate={partialEnd} onEnd={setPartialEnd} onClear={()=>{setPartialSearch("");setPartialStart("");setPartialEnd("");}} onExcel={()=>{}}/>
                    <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800"><PaymentTable items={fPartial} onView={setViewItem} onAttach={setAttachItem} onDollarModal={openDollarModal}/></div>
                    <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">Showing {fPartial.length} of {partialPayments.length} entries</div>
                  </div>
                  )}

                  {/* TEM PAYMENT TAB */}
                  {activeTab==="term" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 dark:border-zinc-800 dark:text-zinc-100">Tem Payment <span className="text-[#00a65a]">0</span></div>
                    <Button className="bg-[#f06464] hover:bg-[#d9534f] text-white w-fit h-9 px-4 font-black uppercase text-[11px] rounded-md">Generate Email</Button>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-px">{["Copy","Excel","CSV","PDF"].map(b=><button key={b} className="bg-[#6c757d] hover:bg-[#5a6268] text-white text-[10px] font-black uppercase px-5 py-2 first:rounded-l-sm last:rounded-r-sm">{b}</button>)}</div>
                      <div className="flex items-center gap-2"><span className="text-[12px] font-bold text-gray-700 dark:text-zinc-400">Search:</span><Input className="h-9 w-56 border-gray-300 rounded-sm dark:border-zinc-800"/></div>
                    </div>
                    <div className="border border-gray-100 rounded-sm overflow-hidden dark:border-zinc-800">
                      <div className="overflow-x-auto custom-scrollbar pb-1">
                        <table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1400px] border-separate border-spacing-0">
                          <thead className="bg-[#f39c12] text-white font-bold text-[11px] shadow-sm dark:bg-zinc-900"><tr>{["No","Date","Channel Partner","Member Id","Company Name","Product Purchased","Order Type","Contract No","Contract Amount","PayPal Account","PayPal Amount","Attach","Action"].map(h=><th key={h} className="py-2.5 px-2.5 border-r border-white/20 last:border-0">{h}</th>)}</tr></thead>
                          <tbody className="bg-white dark:bg-zinc-900"><tr><td colSpan={13} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No data available in table</td></tr></tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* AB LIABILITIES TAB */}
                  {activeTab==="ab_liabilities" && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="text-xl font-[1000] text-gray-900 border-b border-gray-100 pb-2 uppercase tracking-tighter dark:border-zinc-800 dark:text-zinc-100">AB Liabilities</div>
                    <div className="max-w-2xl border border-gray-200 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                      <Table className="text-[12px]">
                        <TableHeader className="bg-[#f8f9fa] dark:bg-zinc-900">
                          <TableRow className="border-b border-gray-200 dark:border-zinc-800">
                            {["Payment Type","Mode","USD","PKR"].map(h=><TableHead key={h} className="p-4 font-black text-gray-800 uppercase border-r last:border-0 dark:text-zinc-100">{h}</TableHead>)}
                          </TableRow>
                        </TableHeader>
                        <TableBody className="bg-white font-bold dark:bg-zinc-900">
                          {[
                            {t:"Full Payment",rows:[
                              {m:"Online Paid",    u:Number(abLiabilities.fullOnlinePaidUsd||0),   p:Number(abLiabilities.fullOnlinePaidPkr||0)},
                              {m:"Cash Received",  u:Number(abLiabilities.fullCashReceivedUsd||0), p:Number(abLiabilities.fullCashReceivedPkr||0)},
                              {m:"Extra Discount", u:0, p:0},
                            ]},
                            {t:"Partial Payment",rows:[
                              {m:"Online Paid",                u:Number(abLiabilities.partialOnlinePaidUsd||0),   p:Number(abLiabilities.partialOnlinePaidPkr||0)},
                              {m:"Cash Received",              u:Number(abLiabilities.partialCashReceivedUsd||0), p:Number(abLiabilities.partialCashReceivedPkr||0)},
                              {m:"Installment Extra Discount", u:0, p:0},
                            ]},
                          ].map(s => s.rows.map((r,ri) => (
                            <TableRow key={s.t+ri} className="border-b border-gray-100 dark:border-zinc-800">
                              {ri===0 && <TableCell rowSpan={s.rows.length} className="p-4 border-r text-gray-600 font-black dark:text-zinc-300">{s.t}</TableCell>}
                              <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">{r.m}</TableCell>
                              <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ {fmtU(r.u)}</TableCell>
                              <TableCell className="p-4 text-red-500 font-[1000]">Pkr {fmtU(r.p)}</TableCell>
                            </TableRow>
                          )))}
                          {[{t:"Uncompleted GM Partials",m:"Outstanding"},{t:"Dollar Vendor Outstanding",m:"Outstanding"}].map(r=>(
                            <TableRow key={r.t} className="border-b border-gray-100 dark:border-zinc-800">
                              <TableCell className="p-4 border-r text-gray-600 font-black dark:text-zinc-300">{r.t}</TableCell>
                              <TableCell className="p-4 border-r text-gray-500 font-bold dark:text-zinc-400">{r.m}</TableCell>
                              <TableCell className="p-4 border-r text-emerald-600 font-[1000]">$ 0.00</TableCell>
                              <TableCell className="p-4 text-red-500 font-[1000]">Pkr 0.00</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-gray-50/50 dark:bg-zinc-900">
                            <TableCell className="p-4 border-r text-gray-700 font-black uppercase dark:text-zinc-400">Total</TableCell>
                            <TableCell className="p-4 border-r text-gray-500 font-black italic dark:text-zinc-400">All Payments</TableCell>
                            <TableCell className="p-4 border-r text-[#3c8dbc] text-lg font-[1000] dark:text-zinc-100">
                              $ {fmtU(Number(abLiabilities.fullOnlinePaidUsd||0)+Number(abLiabilities.fullCashReceivedUsd||0)+Number(abLiabilities.partialOnlinePaidUsd||0)+Number(abLiabilities.partialCashReceivedUsd||0))}
                            </TableCell>
                            <TableCell className="p-4 text-red-500 text-lg font-[1000]">
                              Pkr {fmtU(Number(abLiabilities.fullOnlinePaidPkr||0)+Number(abLiabilities.fullCashReceivedPkr||0)+Number(abLiabilities.partialOnlinePaidPkr||0)+Number(abLiabilities.partialCashReceivedPkr||0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  )}

                </div>
              </div>

              {/* LOAN PAYMENT RECEIVED */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-y-2">
                  <div className="text-[18px] font-[1000] text-gray-900 uppercase tracking-tighter dark:text-zinc-100 flex items-center gap-3">
                    <span>Loan Payment Received</span>
                    <div className="flex items-center gap-1.5 text-[12px] font-[1000] tracking-tighter uppercase">
                      <button
                        type="button"
                        onClick={() => setLoanTypeFilter("all")}
                        className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer",
                          loanTypeFilter === "all" ? "bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm" : "text-gray-500 hover:text-gray-900 dark:text-zinc-400"
                        )}
                      >
                        All ({flt(loans, loanSearch, loanStart, loanEnd).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanTypeFilter(prev => prev === "New" ? "all" : "New")}
                        className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                          loanTypeFilter === "New" ? "bg-[#00a65a] text-white shadow-sm" : "hover:bg-emerald-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <span>NC</span>
                        <span className={loanTypeFilter === "New" ? "text-white" : "text-[#00a65a]"}>({ncLoanCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanTypeFilter(prev => prev === "Rc" ? "all" : "Rc")}
                        className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                          loanTypeFilter === "Rc" ? "bg-blue-600 text-white shadow-sm" : "hover:bg-blue-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <span>RC</span>
                        <span className={loanTypeFilter === "Rc" ? "text-white" : "text-blue-500"}>({rcLoanCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanTypeFilter(prev => prev === "Ec" ? "all" : "Ec")}
                        className={cn("px-2 py-0.5 rounded text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5",
                          loanTypeFilter === "Ec" ? "bg-red-600 text-white shadow-sm" : "hover:bg-red-50 dark:hover:bg-zinc-800"
                        )}
                      >
                        <span>EC</span>
                        <span className={loanTypeFilter === "Ec" ? "text-white" : "text-red-500"}>({ecLoanCount})</span>
                      </button>
                    </div>
                  </div>
                </div>
                <FilterBar searchTerm={loanSearch} onSearch={setLoanSearch} startDate={loanStart} onStart={setLoanStart} endDate={loanEnd} onEnd={setLoanEnd} onClear={()=>{setLoanSearch("");setLoanStart("");setLoanEnd("");}}/>
                <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800"><PaymentTable items={fLoan} isLoan onView={setViewItem} onAttach={setAttachItem} onDollarModal={openDollarModal}/></div>
                <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">Showing {fLoan.length} of {loans.length} entries</div>
              </div>

              {/* PARTIAL PAYMENT RECEIVED SECTION */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-y-2">
                  <div className="text-[18px] font-[1000] text-blue-500 uppercase tracking-tighter">Partial Payment Received <span className="text-red-500">{fPartial.length}</span></div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {l:"Cash Received",  u:partUsd, p:partPkr},
                      {l:"Online Paid",    u:Number(abLiabilities.partialOnlinePaidUsd||0), p:Number(abLiabilities.partialOnlinePaidPkr||0)},
                      {l:"Customer Paid",  u:partUsd, p:partPkr},
                    ].map((b,bi) => (
                      <div key={bi} className={cn("flex flex-col items-start font-[1000] uppercase text-[10px] gap-0.5", bi<2&&"border-r border-gray-200 pr-3 dark:border-zinc-800")}>
                        <span className="text-gray-400">{b.l}</span>
                        <div className="flex gap-1">
                          <Badge className="bg-emerald-50 text-[#00a65a] border-none px-1.5 py-0.5 shadow-none font-black text-[10px]">$ {fmtU(b.u)}</Badge>
                          <Badge className="bg-rose-50 text-red-400 border-none px-1.5 py-0.5 shadow-none font-black italic text-[10px]">Pkr {fmtN(b.p)}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterBar searchTerm={partialSearch} onSearch={setPartialSearch} startDate={partialStart} onStart={setPartialStart} endDate={partialEnd} onEnd={setPartialEnd} onClear={()=>{setPartialSearch("");setPartialStart("");setPartialEnd("");}} onExcel={()=>{}}/>
                  <Button className="bg-[#3c8dbc] hover:bg-[#367fa9] text-white h-9 px-4 font-black uppercase text-[11px]">View Installments</Button>
                </div>
                <div className="border border-gray-100 rounded-sm shadow-sm dark:border-zinc-800"><PaymentTable items={fPartial} onView={setViewItem} onAttach={setAttachItem} onDollarModal={openDollarModal}/></div>
                <div className="text-[11px] text-gray-500 font-bold dark:text-zinc-400">Showing {fPartial.length} of {partialPayments.length} entries</div>
              </div>

              {/* PENDING APPROVALS */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="text-[18px] font-[1000] text-rose-500 uppercase tracking-tighter">Pending Approvals <span className="text-red-500 font-black">{fPend.length}</span></div>
                <FilterBar searchTerm={pendSearch} onSearch={setPendSearch} startDate={pendStart} onStart={setPendStart} endDate={pendEnd} onEnd={setPendEnd} onClear={()=>{setPendSearch("");setPendStart("");setPendEnd("");}}/>
                <div className="flex gap-1">{["Copy","Excel","CSV","PDF"].map(b=><button key={b} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase px-4 py-1.5 rounded-sm dark:bg-zinc-800 dark:text-zinc-400">{b}</button>)}</div>
                <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                  <div className="overflow-x-auto custom-scrollbar">
                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1400px] border-separate border-spacing-0">
                      <TableHeader className="bg-[#f8f9fa] text-gray-800 font-bold text-xs uppercase dark:bg-zinc-900 dark:text-zinc-100">
                        <TableRow>{["#","DRM ID","Company","Sales Person","Dollar","PKR","Dollar Rate","AB Disc","Extra Disc","Package","Type","Dropout","Status","Action"].map(h=><TableHead key={h} className="p-3 px-3 border-r last:border-0">{h}</TableHead>)}</TableRow>
                      </TableHeader>
                      <TableBody className="bg-white dark:bg-zinc-900">
                        {fPend.length > 0 ? fPend.map((tx,i) => (
                          <TableRow key={i} className="hover:bg-rose-50/10 transition-colors">
                            <TableCell className="p-3 border-r border-b font-bold text-gray-400">{i+1}</TableCell>
                            <TableCell className="p-3 border-r border-b font-[1000] text-[#00a65a] italic uppercase dark:text-zinc-400">{tx.drmId}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black uppercase text-gray-700 dark:text-zinc-400">{tx.company}</TableCell>
                            <TableCell className="p-3 border-r border-b font-bold italic text-gray-500 dark:text-zinc-400">{tx.salePerson}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black text-gray-900 dark:text-zinc-100">$ {tx.dollar}</TableCell>
                            <TableCell className="p-3 border-r border-b font-bold">{tx.pkr}</TableCell>
                            <TableCell className="p-3 border-r border-b">{tx.rate}</TableCell>
                            <TableCell className="p-3 border-r border-b">{tx.abDisc||"0"}</TableCell>
                            <TableCell className="p-3 border-r border-b">{tx.exDisc||"0"}</TableCell>
                            <TableCell className="p-3 border-r border-b">{tx.package||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b">{tx.type||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b">None</TableCell>
                            <TableCell className="p-3 border-r border-b font-black text-[#00a65a] uppercase italic dark:text-zinc-400">{tx.status}</TableCell>
                            <TableCell className="p-3 border-b text-center"><Badge className="bg-red-500/10 text-red-700 border-none text-[10px] uppercase font-black px-2 shadow-none">Pending</Badge></TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={14} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No pending approvals</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* PAID ALIBABA */}
              <div className="bg-[#fbfcfd] border border-gray-200 rounded-lg shadow-sm p-4 space-y-4 pb-10 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-zinc-800">
                  <h2 className="text-[18px] font-[1000] text-gray-800 tracking-tighter uppercase whitespace-nowrap dark:text-zinc-100">Paid Alibaba</h2>
                  <span className="text-[24px] font-black text-green-500 leading-none">..</span>
                  <h2 className="text-[18px] font-[1000] text-[#00a65a] tracking-tighter uppercase leading-none dark:text-zinc-400">Partial Payments Paid To Alibaba</h2>
                </div>
                <FilterBar searchTerm={abSearch} onSearch={setAbSearch} startDate={abStart} onStart={setAbStart} endDate={abEnd} onEnd={setAbEnd} onClear={()=>{setAbSearch("");setAbStart("");setAbEnd("");}}/>
                <div className="border border-gray-100 rounded-sm overflow-hidden shadow-sm dark:border-zinc-800">
                  <div className="overflow-x-auto custom-scrollbar">
                    <Table className="w-full text-left text-[11px] whitespace-nowrap min-w-[1200px] border-separate border-spacing-0">
                      <TableHeader className="bg-[#f8f9fa] text-gray-800 font-bold text-xs uppercase dark:bg-zinc-900 dark:text-zinc-100">
                        <TableRow>
                          <TableHead className="p-3 border-r w-12 text-center"><div className="flex items-center justify-center"><Checkbox className="rounded-sm border-emerald-500"/></div></TableHead>
                          {["AB Date","BV Date","DRM ID","AB ID","Order ID","Company","Amount","Status","Paid Date","Proof"].map(h=><TableHead key={h} className="p-3 border-r last:border-0">{h}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="bg-white dark:bg-zinc-900">
                        {fAb.length > 0 ? fAb.map((tx,i) => (
                          <TableRow key={i} className="hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                            <TableCell className="p-3 border-r border-b text-center"><Checkbox className="rounded-sm border-emerald-500"/></TableCell>
                            <TableCell className="p-3 border-r border-b text-gray-500 dark:text-zinc-400">{safeDate(tx.abDate, "MM/dd/yyyy")}</TableCell>
                            <TableCell className="p-3 border-r border-b text-[#dd4b39]">{safeDate(tx.date, "MM/dd/yyyy")}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black text-[#00a65a] italic uppercase dark:text-zinc-400">{tx.drmId||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black text-gray-600 dark:text-zinc-300">{tx.abId||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b text-gray-500 dark:text-zinc-400">{tx.orderId||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black uppercase text-gray-700 dark:text-zinc-400 max-w-[200px] truncate">{tx.company||"-"}</TableCell>
                            <TableCell className="p-3 border-r border-b font-black text-gray-900 dark:text-zinc-100">$ {tx.abAmountUsd||tx.dollar||"0"}</TableCell>
                            <TableCell className="p-3 border-r border-b">
                              <Badge className={cn("text-[9px] font-black px-1.5 py-0.5 border-none shadow-none uppercase",
                                tx.paymentStatus==="paid"?"bg-emerald-100 text-emerald-700":tx.paymentStatus==="processing"?"bg-blue-100 text-blue-700":"bg-yellow-100 text-yellow-700"
                              )}>{tx.paymentStatus||"pending"}</Badge>
                            </TableCell>
                            <TableCell className="p-3 border-r border-b text-gray-500 dark:text-zinc-400">{safeDate(tx.paidDate, "MM/dd/yyyy")}</TableCell>
                            <TableCell className="p-3 border-b text-center">{tx.proofUrl?<a href={tx.proofUrl} target="_blank" rel="noreferrer"><Eye size={14} className="text-[#00a65a] cursor-pointer inline-block"/></a>:<span className="text-gray-300 text-[10px] italic">none</span>}</TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={11} className="p-5 text-center text-gray-500 font-medium italic dark:text-zinc-400">No alibaba payments found</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
