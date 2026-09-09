import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";

interface ProjectReportRow {
  rowNumber: number;
  id: string;
  displayId: string | null;
  name: string | null;
  package: string | null;
  status: string | null;
  person: string | null;
  customerCreateDate: string | null;
  gmPayDate: string | null;
  gmDoc: number;
  bvDate: string | null;
  invoiceDate: string | null;
  receiptDate: string | null;
  method: string | null;
  project: string | null;
  projectCreateDate: string | null;
  dataDate: string | null;
  hodDate: string | null;
  depDate: string | null;
  p15: number;
  assignDate: string | null;
  finish: string | null;
  remaining: number;
}

interface ProjectReportResponse {
  filters: { companyName: string; startDate: string; endDate: string; search: string };
  rows: ProjectReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface FetchParams {
  companyName: string;
  startDate: string;
  endDate: string;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

/** Format an ISO date string as DD-MM-YYYY; "-" when missing. */
function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function txt(value: string | null | undefined): string {
  return value && String(value).trim() !== "" ? String(value) : "-";
}

const thClass =
  "text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 border-r border-white/50 dark:text-zinc-400";
const tdClass =
  "text-[12.5px] text-[#495057] whitespace-nowrap px-4 py-4 dark:text-zinc-400";

export default function PmsProjectReport() {
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);
  const [dateError, setDateError] = useState("");

  const { data, isLoading, isError } = useQuery<ProjectReportResponse>({
    queryKey: ["/api/dd-manager/project-report", fetchParams, search, page, limit],
    enabled: !!fetchParams,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("startDate", fetchParams!.startDate);
      params.set("endDate", fetchParams!.endDate);
      if (fetchParams!.companyName) params.set("companyName", fetchParams!.companyName);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await apiRequest("GET", `/api/dd-manager/project-report?${params.toString()}`);
      if (res.status === 403) throw new Error("forbidden");
      if (!res.ok) throw new Error("request_failed");
      return res.json();
    },
  });

  const handleView = () => {
    if (!startDate || !endDate) {
      setDateError("Please select both Start Date and End Date.");
      return;
    }
    if (startDate > endDate) {
      setDateError("Start Date must be on or before End Date.");
      return;
    }
    setDateError("");
    setPage(1);
    setFetchParams({ companyName: companyName.trim(), startDate, endDate });
  };

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const startEntry = total === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, total);

  const pageNumbers: number[] = [];
  const maxButtons = 5;
  let firstPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let lastPage = Math.min(totalPages, firstPage + maxButtons - 1);
  firstPage = Math.max(1, lastPage - maxButtons + 1);
  for (let p = firstPage; p <= lastPage; p++) pageNumbers.push(p);

  return (
    <div className="p-4 md:p-6 bg-[#f8f9fc] min-h-[calc(100vh-60px)] font-sans flex flex-col max-h-screen dark:bg-zinc-950">
      <h1 className="text-[17px] font-bold text-[#495057] tracking-wide uppercase mb-6 flex-shrink-0 dark:text-zinc-400">
        CHECK PROJECT REPORTS
      </h1>

      {/* Filter Section */}
      <div className="bg-white rounded border border-gray-100 p-6 flex flex-col md:flex-row gap-6 items-end mb-6 shadow-sm flex-shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col gap-2 w-full md:w-1/3">
          <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Company Name</label>
          <Input
            placeholder="Enter name"
            className="h-10 text-[13px]"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">Start Date</label>
          <div className="relative">
            <Input
              type="date"
              className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => 'showPicker' in e.currentTarget && (e.currentTarget as HTMLInputElement).showPicker()}
            />
            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-1/4">
          <label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">End Date</label>
          <div className="relative">
            <Input
              type="date"
              className="h-10 text-[13px] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => 'showPicker' in e.currentTarget && (e.currentTarget as HTMLInputElement).showPicker()}
            />
            <CalendarIcon className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="w-full md:w-auto">
          <Button
            onClick={handleView}
            disabled={isLoading}
            className="h-10 px-8 bg-[#00a65a] hover:bg-[#008d4c] text-white font-bold tracking-wide disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "View"}
          </Button>
        </div>
      </div>

      {dateError && (
        <div className="mb-4 text-[13px] text-red-600 font-medium flex-shrink-0">{dateError}</div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0 dark:bg-zinc-900 dark:border-zinc-800">
        {/* Table controls: Show entries + Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-[13px] text-[#495057] dark:text-zinc-400">
            <span>Show</span>
            <select
              className="h-9 rounded border border-gray-200 bg-white px-2 text-[13px] dark:bg-zinc-800 dark:border-zinc-700"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {LIMIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-[#495057] dark:text-zinc-400">
            <span>Search:</span>
            <Input
              className="h-9 w-full md:w-64 text-[13px]"
              placeholder="Search records"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <Table className="w-full min-w-[2000px] border-collapse relative">
            <TableHeader>
              <TableRow className="bg-[#f0f2f5] hover:bg-[#f0f2f5] dark:bg-zinc-900 dark:hover:bg-zinc-800">
                <TableHead className={`${thClass} w-[50px]`}>#</TableHead>
                <TableHead className={thClass}>ID</TableHead>
                <TableHead className={thClass}>Name</TableHead>
                <TableHead className={thClass}>Package</TableHead>
                <TableHead className={thClass}>Status</TableHead>
                <TableHead className={thClass}>Person</TableHead>
                <TableHead className={thClass}>Create</TableHead>
                <TableHead className={thClass}>GM Pay</TableHead>
                <TableHead className={thClass}>GM Doc</TableHead>
                <TableHead className={thClass}>BV Date</TableHead>
                <TableHead className={thClass}>Invoice</TableHead>
                <TableHead className={thClass}>Receipt</TableHead>
                <TableHead className={thClass}>Method</TableHead>
                <TableHead className={thClass}>Project</TableHead>
                <TableHead className={thClass}>Create</TableHead>
                <TableHead className={thClass}>Data</TableHead>
                <TableHead className={thClass}>Hod</TableHead>
                <TableHead className={thClass}>Dep</TableHead>
                <TableHead className={thClass}>15P</TableHead>
                <TableHead className={thClass}>Assign</TableHead>
                <TableHead className={thClass}>Finish</TableHead>
                <TableHead className="text-[12px] font-bold text-[#495057] whitespace-nowrap px-4 py-3 dark:text-zinc-400">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!fetchParams ? (
                <TableRow>
                  <TableCell colSpan={22} className="text-center text-[13px] text-gray-500 py-10">
                    Select a date range and click View to load the report.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={22} className="text-center text-[13px] text-gray-500 py-10">
                    Loading data...
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={22} className="text-center text-[13px] text-red-600 py-10">
                    Unable to load the project report. You may not have access, or an error occurred.
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={22} className="text-center text-[13px] text-gray-500 py-10">
                    No entries found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className={`${tdClass} font-bold`}>{row.rowNumber}</TableCell>
                    <TableCell className={`${tdClass} font-bold`}>{txt(row.displayId)}</TableCell>
                    <TableCell className={`${tdClass} uppercase`}>{txt(row.name)}</TableCell>
                    <TableCell className={tdClass}>{txt(row.package)}</TableCell>
                    <TableCell className={tdClass}>{txt(row.status)}</TableCell>
                    <TableCell className={tdClass}>{txt(row.person)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.customerCreateDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.gmPayDate)}</TableCell>
                    <TableCell className={tdClass}>{row.gmDoc ?? 0}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.bvDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.invoiceDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.receiptDate)}</TableCell>
                    <TableCell className={tdClass}>{txt(row.method)}</TableCell>
                    <TableCell className={tdClass}>{txt(row.project)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.projectCreateDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.dataDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.hodDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.depDate)}</TableCell>
                    <TableCell className={tdClass}>{row.p15 ?? 0}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.assignDate)}</TableCell>
                    <TableCell className={tdClass}>{fmtDate(row.finish)}</TableCell>
                    <TableCell className={tdClass}>{row.remaining ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 py-3 border-t border-gray-100 flex-shrink-0 dark:border-zinc-800">
          <div className="text-[13px] text-[#495057] dark:text-zinc-400">
            Showing {startEntry} to {endEntry} of {total} entries
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              className="h-8 px-3 text-[13px]"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            {pageNumbers.map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                className={`h-8 px-3 text-[13px] ${p === page ? "bg-[#00a65a] hover:bg-[#008d4c] text-white" : ""}`}
                onClick={() => setPage(p)}
                disabled={isLoading}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-8 px-3 text-[13px]"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
