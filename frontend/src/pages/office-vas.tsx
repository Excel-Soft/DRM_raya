import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequestJson } from "@/lib/queryClient";

const PAGE_SIZE = 50;

interface VasRow {
  id: string;
  companyName: string;
  amount: string;
  currency: string;
  method: string;
  vasDate: string | null; // "YYYY-MM-DD HH:mm:ss"
}

export default function OfficeVasPage() {
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(PAGE_SIZE));

  // Server-side pagination: 50 most recent payments per page.
  const { data: vasPage, isLoading, isError, isFetching } = useQuery<{
    data: VasRow[]; total: number; totalAmount: string; page: number; pageSize: number;
    departmentSummary?: { department: string; amount: number }[];
  }>({
    queryKey: ["/api/office/vas", startDate, endDate, page],
    queryFn: () => apiRequestJson("GET", `/api/office/vas?${queryParams.toString()}`),
    placeholderData: (prev) => prev,
  });

  const handleView = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setPage(1);
  };

  const vasEntriesList = vasPage?.data ?? [];
  const total = vasPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageButtons: (number | "gap")[] = [];
  for (let n = 1; n <= totalPages; n++) {
    if (n === 1 || n === totalPages || Math.abs(n - page) <= 1) pageButtons.push(n);
    else if (pageButtons[pageButtons.length - 1] !== "gap") pageButtons.push("gap");
  }
  const methodClass = (m: string) =>
    /free/i.test(m)
      ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100"
      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50";

  const formatCurrency = (amount: string | null, currency = "PKR") => {
    if (!amount) return "-";
    const num = parseFloat(amount) || 0;
    return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-5 space-y-5 font-sans text-[#333] dark:text-zinc-300">
        
        {/* Page Title */}
        <h1 className="text-[16px] font-bold text-[#555] dark:text-zinc-300 uppercase mb-4 tracking-wide">
          VAS SYSTEM
        </h1>

        {/* Filter Block */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-gray-700">Start Date</Label>
              <Input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-gray-700">End Date</Label>
              <Input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleView}
            className="bg-[#009a54] hover:bg-[#008246] text-white rounded-[4px] px-8 h-9 text-[13px] font-medium"
          >
            View
          </Button>
        </div>

        {/* List Block */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded shadow-sm border border-gray-100 min-h-[400px]">
          <h2 className="text-[14px] font-bold text-[#555] dark:text-zinc-300 mb-4">VAS View</h2>
          
          <div className="w-full border border-gray-100 rounded-[4px] overflow-hidden">
            <Table>
              <TableHeader className="bg-[#fef4e8] dark:bg-zinc-900">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[13px] h-12 w-16 text-center">#</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[13px] h-12 text-center">Company</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[13px] h-12 text-center">Amount</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[13px] h-12 text-center">Method</TableHead>
                  <TableHead className="text-[#333] dark:text-zinc-300 dark:text-zinc-300 font-bold text-[13px] h-12 text-center">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-gray-500">Loading...</TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-rose-600 text-[13px]">Failed to load VAS records. Please try again.</TableCell>
                  </TableRow>
                ) : vasEntriesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-gray-500 text-[13px]">No records found.</TableCell>
                  </TableRow>
                ) : (
                  vasEntriesList.map((entry, index) => (
                    <TableRow key={entry.id} className="border-b border-gray-100 hover:bg-gray-50/50 dark:hover:bg-zinc-800">
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {pageStart + index + 1}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3 font-medium">
                        {entry.companyName}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {formatCurrency(entry.amount, "PKR")}
                      </TableCell>
                      <TableCell className="text-center py-3">
                        {entry.method && entry.method !== "-" ? (
                          <Badge variant="secondary" className={`font-medium border ${methodClass(entry.method)}`}>
                            {entry.method}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {entry.vasDate || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination: 50 per page */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-gray-500 dark:text-zinc-400">
            <span>
              {total === 0
                ? "Showing 0 entries"
                : `Showing ${(pageStart + 1).toLocaleString()} to ${(pageStart + vasEntriesList.length).toLocaleString()} of ${total.toLocaleString()} entries`}
              {total > 0 && (
                <span className="ml-3 font-semibold text-gray-700 dark:text-zinc-300">
                  Total: {formatCurrency(vasPage?.totalAmount ?? "0", "PKR")}
                </span>
              )}
              {isFetching && <span className="ml-2 text-gray-400">Loading…</span>}
            </span>
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" className="h-8 px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              {pageButtons.map((n, i) =>
                n === "gap" ? (
                  <span key={`gap-${i}`} className="flex h-8 items-center px-1.5">…</span>
                ) : (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === page ? "default" : "outline"}
                    className={n === page ? "h-8 min-w-8 px-2 bg-[#009a54] hover:bg-[#008246]" : "h-8 min-w-8 px-2"}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ),
              )}
              <Button variant="outline" size="sm" className="h-8 px-3" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>

          {/* Old DRM: Department Wise Summary under the payments (whole date range, all pages) */}
          {(vasPage?.departmentSummary?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-lg border border-gray-100 overflow-hidden dark:border-zinc-800">
              <div className="bg-gray-50 px-4 py-3 text-center text-[13px] font-bold text-gray-700 dark:bg-zinc-900 dark:text-zinc-200">
                Department Wise Summary
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-sky-50 dark:bg-zinc-900">
                    <TableHead className="w-16 text-center font-bold">#</TableHead>
                    <TableHead className="text-center font-bold">Department</TableHead>
                    <TableHead className="text-center font-bold">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vasPage!.departmentSummary!.map((d, i) => (
                    <TableRow key={d.department}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="text-center">{d.department}</TableCell>
                      <TableCell className="text-center">{formatCurrency(String(d.amount), "PKR")}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-amber-50 font-bold dark:bg-zinc-800">
                    <TableCell>Dept Total</TableCell>
                    <TableCell />
                    <TableCell className="text-center">
                      {formatCurrency(String(vasPage!.departmentSummary!.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)), "PKR")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
