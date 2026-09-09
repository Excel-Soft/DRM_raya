import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeader } from "@/lib/queryClient";
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
import type { BusinessCustomer } from "@shared/schema";

export default function BusinessCustomers() {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [date, setDate] = useState("");

  const { data: customers = [], isLoading } = useQuery<BusinessCustomer[]>({
    queryKey: ["/api/office/business-customers"],
    queryFn: () => fetch("/api/office/business-customers", { headers: getAuthHeader(), credentials: "include" }).then(r => r.json()),
  });

  // Filter local logic for visual mock matching
  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c => {
    if (companyName && !c.companyName?.toLowerCase().includes(companyName.toLowerCase())) return false;
    if (phone && !c.phone?.includes(phone)) return false;
    if (cnic && !c.cnic?.includes(cnic) && !c.ntn?.includes(cnic)) return false;
    if (date && c.createdAt) {
      const customerDate = new Date(c.createdAt).toISOString().split('T')[0];
      if (customerDate !== date) return false;
    }
    return true;
  });

  const formatDollar = (amount: string | null) => {
    if (!amount) return "$ 0.00";
    const num = parseFloat(amount) || 0;
    return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  return (
    <ScrollArea className="flex-1 bg-[#f4f6f9] dark:bg-zinc-950">
      <div className="p-5 space-y-5 font-sans text-[#333]">
        <h1 className="text-[16px] font-bold text-[#555] uppercase mb-4 tracking-wide">
          INVOICES LIST
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column - Filters */}
          <div className="lg:col-span-4 xl:col-span-3">
            <div className="bg-white p-5 rounded shadow-sm border border-gray-100 space-y-5">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700">Company Name:</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700">Phone:</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700">CINC:</Label>
                <Input
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="Enter NTN/CINC"
                  className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold text-gray-700">Select Date:</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="dd M, yyyy"
                  className="h-10 border-gray-300 text-gray-500 text-[13px] rounded-[4px]"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Table */}
          <div className="lg:col-span-8 xl:col-span-9">
            <div className="bg-white p-5 rounded shadow-sm border border-gray-100 min-h-[400px]">
              <h2 className="text-[14px] font-bold text-[#555] mb-4">Customer List</h2>
              
              <div className="w-full border border-gray-100 rounded-[4px] overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#def3e7]">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[#333] font-bold text-[13px] h-12 text-center border-r border-white">Name</TableHead>
                      <TableHead className="text-[#333] font-bold text-[13px] h-12 text-center border-r border-white">Amount Paid</TableHead>
                      <TableHead className="text-[#333] font-bold text-[13px] h-12 text-center">Amount Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-gray-500">Loading...</TableCell>
                      </TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-gray-500 text-[13px]">No records found.</TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <TableRow key={customer.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <TableCell className="text-center text-[13px] text-gray-700 py-4 font-medium">
                            {customer.companyName}
                          </TableCell>
                          <TableCell className="text-center text-[13px] text-gray-700 py-4">
                            {formatDollar(customer.totalPaid)}
                          </TableCell>
                          <TableCell className="text-center text-[13px] text-gray-700 py-4">
                            {formatDollar(customer.totalDue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
