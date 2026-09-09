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

const TAX_RATE = 0.05; // 5% tax

export default function AccountInvoices() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<GmEntry | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Bank");
  const rowsPerPage = 10;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(true);
  const [modalMode, setModalMode] = useState<'view' | 'create'>('view');
  const [projectData, setProjectData] = useState({
    due: "0",
    amount: "",
    method: "Bank",
    project: ""
  });

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
      return apiRequest("PATCH", `/api/account/gm-entries/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
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

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return gmEntries;
    const query = searchQuery.toLowerCase();
    return gmEntries.filter(
      (entry) =>
        entry.companyName.toLowerCase().includes(query) ||
        entry.drmId.toLowerCase().includes(query) ||
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
                <Select value={searchQuery} onValueChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}>
                    <SelectTrigger className="w-full text-sm h-11 border-slate-200 dark:border-zinc-800">
                        <SelectValue placeholder="Search Company Through Id/Name" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Search Company Through Id/Name</SelectItem>
                        {gmEntries?.map((gm: any) => {
                            const val = (gm.companyName || gm.drmId || gm.orderId || gm.id || "").toLowerCase().trim();
                            return (
                                <SelectItem key={gm.id} value={val || "unknown"}>
                                    {gm.companyName || gm.drmId || gm.orderId || "Unnamed Company"}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm rounded-md overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="p-0">
          <div className="p-5 flex flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Show</span>
              <div className="flex items-center gap-2">
                <Select defaultValue="10">
                  <SelectTrigger className="w-[70px] h-9 text-xs">
                    <SelectValue placeholder="10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">entries</span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Search:</span>
              <Input
                className="w-[200px] h-9 text-sm border-slate-200 dark:border-zinc-800"
                value={searchQuery === 'none' ? '' : searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="px-5 pb-5">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No entries found matching your search" : "No GM entries available"}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="border-t border-slate-100 table-fixed w-full dark:border-zinc-800">
                    <TableHeader>
                      <TableRow className="bg-slate-100/50 hover:bg-slate-100/50 border-b-0 dark:bg-zinc-900/80 dark:hover:bg-zinc-900/80">
                        <TableHead className="w-[40px] font-bold text-slate-700 text-xs py-4 pl-4 truncate dark:text-zinc-400">#</TableHead>
                        <TableHead className="w-[120px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Drm id</TableHead>
                        <TableHead className="w-[100px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Created Date</TableHead>
                        <TableHead className="w-[160px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Company</TableHead>
                        <TableHead className="w-[100px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Sale Person</TableHead>
                        <TableHead className="w-[70px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Dollar</TableHead>
                        <TableHead className="w-[80px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Pkr</TableHead>
                        <TableHead className="w-[90px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Dollar Rate</TableHead>
                        <TableHead className="w-[80px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Ex-Disc</TableHead>
                        <TableHead className="w-[100px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Ex-Disc Pkr</TableHead>
                        <TableHead className="w-[70px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Package</TableHead>
                        <TableHead className="w-[70px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Type</TableHead>
                        <TableHead className="w-[80px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Expire</TableHead>
                        <TableHead className="w-[80px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Droupout</TableHead>
                        <TableHead className="w-[80px] font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Status</TableHead>
                        <TableHead className="w-[80px] text-center font-bold text-slate-700 text-xs py-4 truncate dark:text-zinc-400">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedEntries.map((entry: any, index: number) => {
                          const paymentValue = parseInt(entry.amountPkr || entry.amountUsd || "0");
                          const isRed = index % 3 === 0 || paymentValue >= 25000;
                          return (
                        <TableRow
                          key={entry.id}
                          className="hover:bg-slate-50/50 border-b border-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                        >
                          <TableCell className="text-slate-500 text-[11px] font-medium pl-4 py-4 truncate dark:text-zinc-400">
                            {(currentPage - 1) * rowsPerPage + index + 1}
                          </TableCell>
                          <TableCell className="text-emerald-600 text-[11px] font-bold py-4 truncate">
                            {entry.drmId || `DRM-${entry.id}`}
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            {format(new Date(entry.createdAt), "M/d/yyyy")}
                          </TableCell>
                          <TableCell className="text-slate-800 text-[11px] font-bold uppercase py-4 truncate max-w-[150px] dark:text-zinc-100">
                            {entry.companyName}
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            {entry.salesPersonName || entry.agentName || "-"}
                          </TableCell>
                          <TableCell className="text-emerald-600 text-[11px] font-bold py-4 truncate">
                            {entry.currency === 'USD' ? Number(entry.amount || 0).toFixed(2) : "0.00"}
                          </TableCell>
                          <TableCell className="text-slate-800 text-[11px] font-bold py-4 truncate dark:text-zinc-100">
                            {entry.amountPkr ? entry.amountPkr : (entry.currency === 'USD' ? Number(entry.amount || 0) * 277 : (entry.amount || 0))}
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            277.0000
                          </TableCell>
                          <TableCell className="text-rose-500 text-[11px] font-bold py-4 truncate">
                            223.41
                          </TableCell>
                          <TableCell className="text-rose-500 text-[11px] font-bold py-4 truncate">
                            62197.34
                          </TableCell>
                          <TableCell className="text-slate-400 text-[11px] font-medium py-4 truncate">
                            BAS
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            New
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            -
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            0
                          </TableCell>
                          <TableCell className="text-slate-500 text-[11px] font-medium py-4 truncate dark:text-zinc-400">
                            Unpaid
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setModalMode('view');
                                }}
                                title="View"
                              >
                                <Eye className="h-[14px] w-[14px]" />
                              </button>
                              {!isPaid(entry.status) ? (
                                <button
                                  className={`${isRed ? 'text-rose-500 hover:text-rose-600' : 'text-emerald-500 hover:text-emerald-600'} transition-colors`}
                                  onClick={() => {
                                    setSelectedEntry(entry);
                                    setModalMode('create');
                                  }}
                                  title="Add Invoice"
                                >
                                  <PlusCircle className="h-[14px] w-[14px]" />
                                </button>
                              ) : (
                                <button
                                  className="text-rose-500 hover:text-rose-600 transition-colors"
                                  title="Remove/Void"
                                >
                                  <PlusCircle className="h-[14px] w-[14px]" />
                                </button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                      {Math.min(currentPage * rowsPerPage, filteredEntries.length)} of{" "}
                      {filteredEntries.length} entries
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        data-testid="button-next-page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className={`${modalMode === 'create' ? 'sm:max-w-[650px]' : 'sm:max-w-4xl'} max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 p-0 border-0`}>
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
            <div className="bg-white rounded-lg flex flex-col dark:bg-zinc-900">
              <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800">
                <h2 className="text-xl font-semibold text-slate-700 dark:text-zinc-400">
                  Create Project — <span className="text-emerald-500 font-medium text-lg">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
                </h2>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-semibold text-sm dark:text-zinc-300">Name</Label>
                    <Input
                      value={selectedEntry.companyName.toUpperCase()}
                      readOnly
                      className="bg-slate-50 border-slate-200 h-11 text-slate-700 font-medium focus-visible:ring-0 shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                    />
                  </div>
                  {/* Due */}
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-semibold text-sm dark:text-zinc-300">Due</Label>
                    <Input
                      type="number"
                      value={projectData.due}
                      readOnly
                      className="bg-slate-50 border-slate-200 h-11 text-slate-700 shadow-sm focus-visible:ring-0 cursor-not-allowed dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
                    />
                  </div>
                  
                  {/* Amount */}
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-semibold text-sm dark:text-zinc-300">Amount</Label>
                    <Input
                      type="number"
                      placeholder=""
                      value={projectData.amount}
                      onChange={(e) => setProjectData({ ...projectData, amount: e.target.value })}
                      className="border-slate-200 h-11 text-slate-700 shadow-sm focus-visible:ring-emerald-500 dark:border-zinc-800 dark:text-zinc-400"
                    />
                  </div>
                  {/* Method */}
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-semibold text-sm dark:text-zinc-300">Method</Label>
                    <Select
                      value={projectData.method}
                      onValueChange={(v) => setProjectData({ ...projectData, method: v })}
                    >
                      <SelectTrigger className="h-11 border-slate-200 shadow-sm focus:ring-emerald-500 dark:border-zinc-800">
                        <SelectValue placeholder="Choose ..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank">Bank Transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Online">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Project */}
                  <div className="space-y-2">
                    <Label className="text-slate-600 font-semibold text-sm dark:text-zinc-300">Project</Label>
                    <Input
                      value={projectData.project}
                      onChange={(e) => setProjectData({ ...projectData, project: e.target.value })}
                      className="border-slate-200 h-11 text-slate-700 shadow-sm focus-visible:ring-emerald-500 dark:border-zinc-800 dark:text-zinc-400"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 bg-white border-t border-slate-50 flex justify-end gap-3 mt-8 dark:bg-zinc-900 dark:border-zinc-800">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedEntry(null)}
                  className="bg-slate-100 text-slate-800 hover:bg-slate-200 px-6 h-10 font-semibold rounded-md shadow-sm dark:text-zinc-100 dark:bg-zinc-900"
                >
                  Close
                </Button>
                <Button
                  onClick={handleConfirmInvoice}
                  disabled={markPaidMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 font-semibold rounded-md shadow-sm"
                >
                  {markPaidMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
