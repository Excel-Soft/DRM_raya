import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { OfficeVas } from "@shared/schema";

export default function OfficeVasPage() {
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);

  const { data: vasEntries = [], isLoading, isError } = useQuery<OfficeVas[]>({
    queryKey: ["/api/office/vas", startDate, endDate],
    queryFn: () => apiRequestJson<OfficeVas[]>("GET", `/api/office/vas?${queryParams.toString()}`),
  });

  const handleView = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  const vasEntriesList = Array.isArray(vasEntries) ? vasEntries : [];

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
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3 font-medium">
                        {entry.companyName}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {formatCurrency(entry.amount, entry.currency)}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {entry.method}
                      </TableCell>
                      <TableCell className="text-center text-[13px] text-gray-700 py-3">
                        {entry.vasDate ? format(new Date(entry.vasDate), "dd-MM-yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
