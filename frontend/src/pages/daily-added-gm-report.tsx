import { useMemo, useState } from "react";
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
  legacy_gm_id?: string;
  drm_id: string | null;
  company_name: string | null;
  sales_person_name: string | null;
  added_by_name?: string | null;
  user_bv_date?: string | null;
  bv_date?: string | null;
  bv_date_missing?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  last_start_date?: string | null;
  last_expire_date?: string | null;
  created_at: string | null;
  renewal_status?: "new" | "renew" | "unknown";
  renewal_label?: string;
  entry_type?: string | null;
  date_btn?: string | null;
  status: string | null;
  package_type?: string | null;
  amount_usd?: string | null;
  amount_pkr?: string | null;
};

type GmReportResponse = {
  rows: GmRow[];
  total: number;
  page: number;
  pageSize: number;
  source?: "legacy" | "modern";
};

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Default: last 30 days (legacy daily-gm-record behaviour). */
function defaultLastMonthRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

function fmtDateTime(value: string | null): string {
  if (!value) return "-";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  return value;
}

export default function DailyAddedGmReport() {
  const defaults = useMemo(() => defaultLastMonthRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [applied, setApplied] = useState(defaults);
  const [dateError, setDateError] = useState<string | null>(null);

  const query = useQuery<GmReportResponse>({
    queryKey: ["/api/reports/daily-added-gm", applied.startDate, applied.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "2000" });
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
  const colSpan = 13;

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="bg-white dark:bg-zinc-900 rounded-[4px] shadow-sm border border-slate-200 dark:border-zinc-800">
          <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
            <h1 className="text-[17px] font-medium text-[#333] dark:text-zinc-300">
              Daily GM Record
              {query.data?.source === "legacy" ? (
                <span className="text-[12px] text-slate-500 font-normal ml-2">(legacy archive)</span>
              ) : null}
            </h1>
          </div>

          <div className="p-4">
            <div className="flex flex-col md:flex-row items-end gap-4 mb-2">
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] dark:text-zinc-300 font-normal">Start Date:</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-[13px] border-slate-300 focus-visible:ring-0 rounded-[4px]"
                />
              </div>
              <div className="flex flex-col gap-1 w-full md:w-64">
                <Label className="text-[13px] text-[#555] dark:text-zinc-300 font-normal">End Date:</Label>
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
              <p className="text-[12px] text-[#d9534f] dark:text-red-400 mb-4">{dateError}</p>
            )}

            <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-[4px] mt-4">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="bg-[#2c3b41] hover:bg-[#2c3b41] border-b-0">
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">ID</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">User Name</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Company Name</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">User BV Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">BV Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Start Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">End Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Last Start Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Last Expire Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Create Date</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Renewal</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Date BTN</TableHead>
                    <TableHead className="py-3 px-3 font-semibold text-white h-auto">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-8 text-slate-500">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-8 text-[#d9534f] dark:text-red-400">
                        Could not load the GM record. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colSpan} className="text-center py-8 text-slate-500">
                        No records found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item) => {
                      const renewalStatus =
                        item.renewal_status ||
                        (item.entry_type?.toLowerCase().includes("renew") ? "renew" : "new");
                      const dateBtn = (item.date_btn || "enable").toLowerCase();
                      return (
                        <TableRow
                          key={item.id}
                          className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f8f9fa] dark:hover:bg-zinc-800"
                        >
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">
                            {item.legacy_gm_id || item.id}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">
                            {item.sales_person_name || item.added_by_name || "-"}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300 max-w-[220px] truncate" title={item.company_name || ""}>
                            {item.company_name || "-"}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.user_bv_date)}</TableCell>
                          <TableCell className="py-2 px-3">
                            {item.bv_date_missing || !item.bv_date ? (
                              <span className="bg-[#d9534f] text-white px-2 py-0.5 rounded text-[11px] font-semibold">
                                Missing
                              </span>
                            ) : (
                              <span className="text-[#555] dark:text-zinc-300">{item.bv_date}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.start_date)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.end_date)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.last_start_date)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.last_expire_date)}</TableCell>
                          <TableCell className="py-2 px-3 text-[#555] dark:text-zinc-300">{fmtDateTime(item.created_at)}</TableCell>
                          <TableCell className="py-2 px-3">
                            {renewalStatus === "renew" ? (
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 px-2 text-[11px] bg-[#00a65a] hover:bg-[#008d4c] text-white rounded-[3px]"
                              >
                                Renew GM
                              </Button>
                            ) : (
                              <span className="bg-[#0073b7] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                                {item.renewal_label || item.entry_type || "New"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-[3px] text-[11px] font-semibold text-white ${
                                dateBtn === "disable" ? "bg-[#5bc0de]" : "bg-[#00c0ef]"
                              }`}
                            >
                              {dateBtn === "disable" ? "disable" : "enable"}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <span className="bg-[#777] text-white px-2 py-0.5 rounded-[3px] text-[11px] font-bold">
                              {item.status || "Unknown"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {query.data?.total != null && query.data.total > 0 && (
              <p className="text-[12px] text-slate-500 mt-2">
                Showing {rows.length} of {query.data.total} records
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
