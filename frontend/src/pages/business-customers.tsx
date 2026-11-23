import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_SIZE = 50;

// Companies whose invoices were paid in installments (old DRM Business Customer):
// Amount Paid = received so far, Amount Due = invoice total still outstanding.
interface BusinessCustomerRow {
  id: string;
  companyName: string;
  phone: string | null;
  cnic: string | null;
  ntn: string | null;
  invoices: number;
  installments: number;
  totalPaid: string;
  totalDue: string;
}

const clean = (v: string | null | undefined) => {
  const t = String(v ?? "").trim();
  return t && t.toLowerCase() !== "null" ? t : "";
};

export default function BusinessCustomers() {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [date, setDate] = useState("");
  const [filters, setFilters] = useState({ companyName: "", phone: "", cnic: "", date: "" });
  const [page, setPage] = useState(1);

  // Search on the server; typing is debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({ companyName: companyName.trim(), phone: phone.trim(), cnic: cnic.trim(), date });
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [companyName, phone, cnic, date]);

  const params = new URLSearchParams();
  if (filters.companyName) params.set("companyName", filters.companyName);
  if (filters.phone) params.set("phone", filters.phone);
  if (filters.cnic) params.set("cnic", filters.cnic);
  if (filters.date) params.set("date", filters.date);

  const { data: customers = [], isLoading, isError, isFetching } = useQuery<BusinessCustomerRow[]>({
    queryKey: ["/api/office/business-customers", filters],
    queryFn: () => apiRequestJson("GET", `/api/office/business-customers?${params.toString()}`),
    placeholderData: (prev) => prev,
  });

  const list = Array.isArray(customers) ? customers : [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = list.slice(pageStart, pageStart + PAGE_SIZE);
  const sumPaid = list.reduce((s, c) => s + (parseFloat(c.totalPaid) || 0), 0);
  const sumDue = list.reduce((s, c) => s + (parseFloat(c.totalDue) || 0), 0);
  const pageButtons: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1) pageButtons.push(n);
    else if (pageButtons[pageButtons.length - 1] !== "gap") pageButtons.push("gap");
  }

  const formatPkr = (amount: string | number | null) =>
    `PKR ${(Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const clearFilters = () => {
    setCompanyName("");
    setPhone("");
    setCnic("");
    setDate("");
  };

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-5 space-y-5 font-sans text-[#333] dark:text-zinc-300">
        <h1 className="text-[16px] font-bold text-[#555] uppercase mb-4 tracking-wide dark:text-zinc-300">
          INVOICES LIST
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column - Filters */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">Company Name:</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="h-10 border-gray-300 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">Phone:</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-10 border-gray-300 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">CINC:</Label>
                <Input
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="Enter NTN/CINC"
                  className="h-10 border-gray-300 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700 dark:text-zinc-300">Select Date:</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 border-gray-300 text-[13px] rounded-[4px]"
                />
                <p className="text-[11px] text-gray-400">Invoices created on this date.</p>
              </div>
              <Button variant="outline" className="w-full h-9 text-[13px]" onClick={clearFilters}>
                Clear Filter
              </Button>
            </div>
          </div>

          {/* Right Column - Table */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 dark:border-zinc-800 min-h-[400px]">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-[#555] dark:text-zinc-300">Customer List</h2>
                {isFetching && <span className="text-[11px] text-gray-400">Loading…</span>}
              </div>

              <div className="w-full border border-gray-100 dark:border-zinc-800 rounded-[4px] overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#def3e7] dark:bg-emerald-950/40">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="w-12 text-[#333] dark:text-zinc-300 font-bold text-[13px] h-12 text-center border-r border-white dark:border-zinc-800">#</TableHead>
                      <TableHead className="text-[#333] dark:text-zinc-300 font-bold text-[13px] h-12 text-center border-r border-white dark:border-zinc-800">Name</TableHead>
                      <TableHead className="text-[#333] dark:text-zinc-300 font-bold text-[13px] h-12 text-center border-r border-white dark:border-zinc-800">Amount Paid</TableHead>
                      <TableHead className="text-[#333] dark:text-zinc-300 font-bold text-[13px] h-12 text-center">Amount Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-gray-500">Loading...</TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-rose-600 text-[13px]">Failed to load customers. Please try again.</TableCell>
                      </TableRow>
                    ) : pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-gray-500 text-[13px]">No records found.</TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((customer, idx) => {
                        const ph = clean(customer.phone);
                        const id = clean(customer.cnic) || clean(customer.ntn);
                        return (
                          <TableRow key={customer.id} className="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-800">
                            <TableCell className="text-center text-[13px] text-gray-500 py-3">{pageStart + idx + 1}</TableCell>
                            <TableCell className="text-center text-[13px] text-gray-700 dark:text-zinc-200 py-3">
                              <div className="font-medium">{customer.companyName || "—"}</div>
                              <div className="text-[11px] text-gray-400">
                                {[ph, id].filter(Boolean).join(" · ") || "—"}
                                <span className="ml-1">
                                  ({customer.invoices} invoice{customer.invoices === 1 ? "" : "s"}, {customer.installments} installment{customer.installments === 1 ? "" : "s"})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-[13px] text-emerald-700 dark:text-emerald-400 py-3">
                              {formatPkr(customer.totalPaid)}
                            </TableCell>
                            <TableCell className={`text-center text-[13px] py-3 ${(parseFloat(customer.totalDue) || 0) > 0 ? "text-rose-600 font-semibold" : "text-gray-500"}`}>
                              {formatPkr(customer.totalDue)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                  {list.length > 0 && (
                    <TableFooter>
                      <TableRow className="bg-slate-50 dark:bg-zinc-800/60">
                        <TableCell />
                        <TableCell className="text-center text-[13px] font-bold">Total ({list.length} companies)</TableCell>
                        <TableCell className="text-center text-[13px] font-bold">{formatPkr(sumPaid)}</TableCell>
                        <TableCell className="text-center text-[13px] font-bold">{formatPkr(sumDue)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>

              {list.length > PAGE_SIZE && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-gray-500 dark:text-zinc-400">
                  <span>
                    Showing {pageStart + 1} to {pageStart + pageRows.length} of {list.length} companies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
                    {pageButtons.map((n, i) =>
                      n === "gap" ? (
                        <span key={`gap-${i}`} className="flex h-8 items-center px-1.5">…</span>
                      ) : (
                        <Button
                          key={n}
                          size="sm"
                          variant={n === currentPage ? "default" : "outline"}
                          className={n === currentPage ? "h-8 min-w-8 px-2 bg-[#009a54] hover:bg-[#008246]" : "h-8 min-w-8 px-2"}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </Button>
                      ),
                    )}
                    <Button variant="outline" size="sm" className="h-8 px-3" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
