import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, FileText, ChevronLeft, ChevronRight, DollarSign, Eye, PlusCircle, X } from "lucide-react";
import type { GmEntry } from "@shared/schema";
import { GmEntryInvoiceForm } from "@/components/gm-entry-invoice-form";
import { MakeInvoiceList } from "@/components/make-invoice-list";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown } from "lucide-react";

// The company search shows at most this many matches (old DRM has ~4,000 companies).
const COMPANY_MATCH_LIMIT = 50;
const companyValue = (gm: any) =>
  (gm.companyName || gm.drmId || gm.orderId || gm.id || "").toLowerCase().trim() || "unknown";

const TAX_RATE = 0.05; // 5% tax

export default function AccountInvoices() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<GmEntry | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(true);
  const [modalMode, setModalMode] = useState<'view' | 'create'>('view');

  const { data: gmEntries = [], isLoading } = useQuery<GmEntry[]>({
    queryKey: ["/api/account/gm-entries"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/gm-entries");
      if (!res.ok) throw new Error("Failed to fetch GM entries");
      return res.json();
    }
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/sale/commission-verification/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sale/commission-verification"] });
      setSelectedEntry(null);
      toast({
        title: "Invoice Created",
        description: "Payment has been recorded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  // One dropdown option per company (old-DRM data has many GMs per company; a
  // Select with duplicate values misbehaves). Latest GM first, as the list is sorted.
  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    return gmEntries.filter((gm: any) => {
      const val = (gm.companyName || gm.drmId || gm.orderId || gm.id || "").toLowerCase().trim() || "unknown";
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }, [gmEntries]);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState("");
  const matchedCompanies = useMemo(() => {
    const q = companyQuery.toLowerCase().trim();
    const out: any[] = [];
    for (const gm of companyOptions as any[]) {
      if (
        !q ||
        (gm.companyName || "").toLowerCase().includes(q) ||
        (gm.drmId || "").toLowerCase().includes(q) ||
        (gm.memberId || "").toLowerCase().includes(q)
      ) {
        out.push(gm);
        if (out.length >= COMPANY_MATCH_LIMIT) break;
      }
    }
    return out;
  }, [companyOptions, companyQuery]);
  const selectedCompanyLabel = useMemo(() => {
    if (!searchQuery || searchQuery === "none") return "";
    const m = (companyOptions as any[]).find((gm) => companyValue(gm) === searchQuery);
    return m ? (m.companyName || m.drmId || m.orderId || "") : "";
  }, [companyOptions, searchQuery]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return gmEntries;
    const query = searchQuery.toLowerCase();
    return gmEntries.filter(
      (entry) =>
        (entry.companyName || "").toLowerCase().includes(query) ||
        (entry.drmId || "").toLowerCase().includes(query) ||
        (entry.memberId && entry.memberId.toLowerCase().includes(query))
    );
  }, [gmEntries, searchQuery]);

  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const formatCurrency = (amount: string | null, prefix = "$") => {
    if (!amount) return "-";
    const num = parseFloat(amount) || 0;
    return `${prefix}${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy");
  };

  const calculateTax = (amount: string | null) => {
    if (!amount) return 0;
    return parseFloat(amount) * TAX_RATE;
  };

  const calculateFinalAmount = (amount: string | null) => {
    if (!amount) return 0;
    const base = parseFloat(amount);
    return base + (base * TAX_RATE);
  };

  const handleConfirmInvoice = () => {
    if (selectedEntry) {
      markPaidMutation.mutate(selectedEntry.id);
    }
  };

  const isPaid = (status: string) => status === "Approved";

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950 min-h-screen">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-slate-700 dark:text-zinc-400">CREATE INVOICE / </span>
          <span 
            className="text-emerald-600 cursor-pointer hover:underline transition-all"
            onClick={() => {
              const nextShowForm = !showForm;
              setShowForm(nextShowForm);
              if (nextShowForm) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }
            }}
          >
            MAKE INVOICE
          </span>
        </h1>
      </div>

      {showForm && (
        <Card className="border-0 shadow-sm rounded-md overflow-hidden bg-white dark:bg-zinc-900">
          <CardContent className="p-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Company Name</Label>
              <div className="relative">
                <Popover open={companyOpen} onOpenChange={(o) => { setCompanyOpen(o); if (!o) setCompanyQuery(""); }}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full h-11 px-3 flex items-center justify-between text-sm rounded-md border border-slate-200 bg-slate-50 text-left dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <span className={selectedCompanyLabel ? "text-slate-800 dark:text-zinc-100" : "text-slate-500 dark:text-zinc-400"}>
                        {selectedCompanyLabel || "Search Company Through Id/Name"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0 w-[var(--radix-popover-trigger-width)]">
                    <div className="p-2 border-b dark:border-zinc-800">
                      <Input
                        autoFocus
                        placeholder="Type company name or DRM ID..."
                        value={companyQuery}
                        onChange={(e) => setCompanyQuery(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {searchQuery && searchQuery !== "none" && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                          onClick={() => { setSearchQuery(""); setCurrentPage(1); setCompanyOpen(false); }}
                        >
                          Clear selection
                        </button>
                      )}
                      {matchedCompanies.length === 0 ? (
                        <div className="px-3 py-4 text-center text-sm text-slate-400">No company found</div>
                      ) : (
                        matchedCompanies.map((gm: any) => (
                          <button
                            key={gm.id}
                            type="button"
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-2"
                            onClick={() => {
                              const v = companyValue(gm);
                              setSearchQuery(v);
                              setCurrentPage(1);
                              setCompanyOpen(false);
                              setCompanyQuery("");
                              setSelectedEntry(gm);
                              setModalMode('create');
                            }}
                          >
                            <span className="truncate">{gm.companyName || gm.drmId || gm.orderId || "Unnamed Company"}</span>
                            {gm.drmId && <span className="text-[11px] text-slate-400 shrink-0">{gm.drmId}</span>}
                          </button>
                        ))
                      )}
                      {matchedCompanies.length === COMPANY_MATCH_LIMIT && (
                        <div className="px-3 py-1.5 text-[11px] text-slate-400">Showing first {COMPANY_MATCH_LIMIT} - type more to narrow down</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Old-DRM invoice list (drm/make-invoice) */}
      <MakeInvoiceList />

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className={`${modalMode === 'create' ? 'sm:max-w-[98vw] w-[98vw] h-[94vh] max-h-[94vh]' : 'sm:max-w-4xl max-h-[90vh]'} overflow-y-auto bg-white dark:bg-zinc-900 p-0 border-0`}>
          <DialogHeader className="sr-only">
            <DialogTitle>Invoice Detail</DialogTitle>
          </DialogHeader>

          {selectedEntry && modalMode === 'view' && (
            <div className="p-8 space-y-6 text-[#1e293b] dark:text-zinc-100">
              {/* Header Section */}
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="Web Excels" className="h-16" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <div className="flex flex-col">
                      <span className="text-3xl font-bold tracking-tight text-[#10b981] dark:text-zinc-100">WEB EXCELS</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold">Invoice No: <span className="font-medium">#7680</span></p>
                  <p className="font-bold">Date: <span className="font-medium">{format(new Date(selectedEntry.createdAt), "yyyy-MM-dd HH:mm:ss")}</span></p>
                </div>
              </div>

              {/* Invoice Title with Green Bars */}
              <div className="flex items-center gap-4">
                <div className="h-[40px] flex-1 bg-[#4ade80]"></div>
                <h2 className="text-4xl font-black tracking-widest text-[#1e293b] dark:text-zinc-100">INVOICE</h2>
                <div className="h-[40px] flex-1 bg-[#4ade80]"></div>
              </div>

              {/* From/To Details */}
              <div className="flex justify-between">
                <div className="space-y-1 text-sm max-w-[300px]">
                  <p className="font-bold text-base">From:</p>
                  <p className="font-bold">Web Excels</p>
                  <p>+92-334-8086611 (Whatsapp)</p>
                  <p>+92-52-4271592</p>
                  <p>Support@Webexcels.com</p>
                  <p className="text-[12px] leading-tight">Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan.</p>
                </div>
                <div className="space-y-1 text-sm text-right">
                  <p className="font-bold text-base text-left">To:</p>
                  <p className="font-bold text-left">{selectedEntry.companyName}</p>
                  <p className="text-left">Phone: {selectedEntry.memberId || "-"}</p>
                  <p className="text-left">Email: - </p>
                  <p className="text-left">Address: -</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-[#1e293b] rounded-t-sm dark:border-zinc-800">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#334155] hover:bg-[#334155]">
                      <TableHead className="w-12 text-center font-bold text-white border-r border-white/20">Sl.</TableHead>
                      <TableHead className="text-center font-bold text-white border-r border-white/20">Item Description</TableHead>
                      <TableHead className="w-24 text-center font-bold text-white border-r border-white/20">Price</TableHead>
                      <TableHead className="w-24 text-center font-bold text-white border-r border-white/20">Quantity</TableHead>
                      <TableHead className="w-24 text-center font-bold text-white">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-center font-bold border-r border-[#1e293b] py-4 dark:border-zinc-800">1</TableCell>
                      <TableCell className="border-r border-[#1e293b] py-4 pl-4 dark:border-zinc-800">
                        <p className="font-bold">{selectedEntry.entryType}</p>
                        <p className="text-xs text-muted-foreground italic">Business Listing Fee ({selectedEntry.companyName.toLowerCase().replace(/ /g, '')}.com)</p>
                      </TableCell>
                      <TableCell className="text-center border-r border-[#1e293b] py-4 dark:border-zinc-800">${selectedEntry.amountUsd || "0"}</TableCell>
                      <TableCell className="text-center border-r border-[#1e293b] py-4 dark:border-zinc-800">1</TableCell>
                      <TableCell className="text-center py-4">{selectedEntry.amountUsd || "0"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Summary Section */}
              <div className="flex flex-col items-end gap-1">
                <div className="w-[200px] flex justify-between pr-2">
                  <p className="font-bold italic">Sub Total:</p>
                  <p className="font-medium">${selectedEntry.amountUsd || "0"}</p>
                </div>
                <div className="w-[200px] flex justify-between pr-2">
                  <p className="font-bold italic">Sub Total:</p>
                  <p className="font-medium">{selectedEntry.amountPkr || "0"} Pkr</p>
                </div>
                <div className="w-[200px] flex justify-between pr-2">
                  <p className="font-bold italic">Discount:</p>
                  <p className="font-medium">0 Pkr</p>
                </div>
                <div className="w-[300px] bg-[#4ade80] mt-2 flex justify-between items-center py-2 px-4 rounded-sm">
                  <p className="font-bold text-lg">Total:</p>
                  <p className="font-bold text-lg">{selectedEntry.amountPkr || "0"} Pkr</p>
                </div>
              </div>

              {/* Footer Line */}
              <div className="pt-12 border-b-4 border-[#4ade80] dark:border-zinc-800"></div>
              <p className="text-center text-[12px] font-bold">This Invoice Only For {selectedEntry.companyName}. Copyright 2026 Reserved By Webexcels.</p>

              <div className="no-print pt-6 flex justify-end gap-3 border-t mt-8">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEntry(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#10b981] hover:bg-[#059669]"
                  onClick={() => window.print()}
                >
                  Print Invoice
                </Button>
                {!isPaid(selectedEntry.status) && (
                  <Button
                    onClick={handleConfirmInvoice}
                    disabled={markPaidMutation.isPending}
                    className="bg-[#334155] hover:bg-[#1e293b]"
                  >
                    {markPaidMutation.isPending ? "Processing..." : "Confirm & Send"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {selectedEntry && modalMode === 'create' && (
            <GmEntryInvoiceForm
              entry={selectedEntry}
              onClose={() => setSelectedEntry(null)}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
