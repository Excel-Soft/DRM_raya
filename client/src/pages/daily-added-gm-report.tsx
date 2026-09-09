import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
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
import { Search } from "lucide-react";

type GmRow = {
  id: string;
  company_name: string | null;
  sales_person_name: string | null;
  added_by_name: string | null;
  entry_type: string | null;
  package_type: string | null;
  gm_type: string | null;
  status: string | null;
  amount_usd: string | null;
  amount_pkr: string | null;
  created_at: string | null;
};

type GmReportResponse = {
  rows: GmRow[];
  total: number;
  page: number;
  pageSize: number;
};

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}\n${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const isRenewal = (entryType: string | null) =>
  !!entryType && /renew/i.test(entryType);

export default function DailyAddedGmReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [dateError, setDateError] = useState<string | null>(null);

  const query = useQuery<GmReportResponse>({
    queryKey: ["/api/reports/daily-added-gm", applied.startDate, applied.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "100" });
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      return apiRequestJson("GET", `/api/reports/daily-added-gm?${params.toString()}`);
    },
  });

  const handleSearch = () => {
    if (startDate && endDate && startDate > endDate) {
      setDateError("Start date must be on or before end date.");
      return;
    }
    setDateError(null);
    setApplied({ startDate, endDate });
  };

  const rows = query.data?.rows ?? [];

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">

        {/* Main Card */}
        <div className="bg-white rounded-[4px] shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-100">
            <h1 className="text-[17px] font-medium text-[#333]">Daily GM Record</h1>
          </div>

          <div className="p-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row items-end gap-4 mb-2">
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] font-normal">Start Date:</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                />
              </div>
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] font-normal">End Date:</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                />
              </div>
              <Button
                onClick={handleSearch}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-9 px-6 rounded-[4px] font-medium"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            {dateError && (
              <p className="text-[12px] text-[#d9534f] mb-4">{dateError}</p>
            )}

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-[4px] mt-4">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-[#2c3b41] hover:bg-[#2c3b41] border-b-0">
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">ID</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">User Name</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Company Name</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Package</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">GM Type</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Amount (USD)</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Amount (PKR)</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Create Date</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Renewal</TableHead>
                    <TableHead className="py-3 px-4 font-semibold text-white h-auto">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-[#d9534f]">
                        Could not load the GM record. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                        No records found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-3 px-4 text-[#555] font-mono text-[11px]">{item.id.slice(0, 8)}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.sales_person_name || item.added_by_name || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.company_name || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.package_type || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.gm_type || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.amount_usd ?? "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.amount_pkr ?? "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555] whitespace-pre-wrap leading-tight">{fmtDateTime(item.created_at)}</TableCell>
                        <TableCell className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-[3px] text-[11px] font-bold text-white ${isRenewal(item.entry_type) ? 'bg-[#00a65a]' : 'bg-[#0073b7]'}`}>
                            {item.entry_type || "-"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="bg-[#777] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                            {item.status || "-"}
                          </span>
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
  );
}
