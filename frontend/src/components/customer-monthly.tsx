import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type CustomerMonthlyRow = {
  id: string;
  drmId?: string;
  company: string;
  accountName: string;
  email: string;
  phone: string;
  ntn: string;
  grade: string;
  lastNote: string;
  createdAt: string;
};

type CustomerMonthlyResponse = {
  data: CustomerMonthlyRow[];
  meta: { month: string; total: number; page: number; pageSize: number };
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function CustomerMonthlyWidget() {
  const now = new Date();
  const defaultMonth = format(now, "MM");
  const defaultYear = format(now, "yyyy");
  const [month, setMonth] = useState<string>(defaultMonth);
  const [year, setYear] = useState<string>(defaultYear);
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [applyKey, setApplyKey] = useState<{ month: string }>({
    month: `${defaultYear}-${defaultMonth}`,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columns, setColumns] = useState({
    account: true,
    email: true,
    phone: true,
  });

  const queryKey = useMemo(
    () => ["/api/dashboard/sales-executive/customer-monthly", applyKey.month, page],
    [applyKey, page],
  );

  const { data, isLoading, refetch } = useQuery<CustomerMonthlyResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        month: applyKey.month,
        page: String(page),
        pageSize: String(pageSize),
      });
      const authHeader = (() => {
        try {
          const token = sessionStorage.getItem("token");
          return token ? { Authorization: `Bearer ${token}` } : {};
        } catch {
          return {};
        }
      })();
      const res = await fetch(`/api/dashboard/sales-executive/customer-monthly?${params.toString()}`, {
        credentials: "include",
        headers: { ...(authHeader as Record<string, string>) },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    },
  });

  const rows = data?.data ?? [];
  if (rows.length > 0) {
    console.log("[DEBUG] CustomerMonthlyWidget rows[0]:", rows[0]);
  }
  const totalPages = data?.meta ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(rows.map((r) => r.id)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  return (
    <Card data-testid="card-customer-monthly">
      <CardHeader className="p-4 pb-2 border-b-0 space-y-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Customer Monthly</CardTitle>
          <div className="flex items-center">
            <Select defaultValue="choose">
              <SelectTrigger className="w-[100px] h-8 text-xs border-slate-200 focus:ring-0 focus:ring-offset-0 dark:border-zinc-800">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choose" disabled className="text-xs">Choose</SelectItem>
                <SelectItem value="GM" className="text-xs">GM</SelectItem>
                <SelectItem value="BV" className="text-xs">BV</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-row items-center justify-between pt-1">
          <Button className="h-8 bg-[#6b7280] hover:bg-[#4b5563] text-white text-xs px-4 rounded-md">
            Focus
          </Button>
          <div className="flex items-center">
            <Button
              className="h-8 bg-[#6b7280] hover:bg-[#4b5563] text-white text-xs px-4 rounded-r-none border-r border-[#9ca3af]/30 dark:border-zinc-800"
              onClick={() => {
                setColumns({ account: true, email: true, phone: true });
              }}
              data-testid="btn-display-all"
            >
              Display all
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-8 bg-[#6b7280] hover:bg-[#4b5563] text-white text-xs px-4 rounded-l-none"
                  data-testid="btn-display"
                >
                  Display
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuCheckboxItem checked={columns.account} onCheckedChange={(v) => setColumns(p => ({ ...p, account: v }))} className="text-xs">Account</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={columns.email} onCheckedChange={(v) => setColumns(p => ({ ...p, email: v }))} className="text-xs">Email</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={columns.phone} onCheckedChange={(v) => setColumns(p => ({ ...p, phone: v }))} className="text-xs">Phone</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading...</div>
        ) : (
          <div className="space-y-3">
            <div className="border border-[#e2e8f0] rounded-sm overflow-hidden dark:border-zinc-800">
              <table className="w-full table-fixed border-collapse" style={{ fontSize: '10px' }}>
                <thead>
                  <tr className="bg-white border-b border-[#e2e8f0] dark:bg-zinc-900 dark:border-zinc-800">
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[4%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === rows.length}
                        onCheckedChange={(val) => toggleSelectAll(Boolean(val))}
                      />
                    </th>
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[8%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">ID</th>
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[12%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Company</th>
                    {columns.account && <th className="px-2 py-2 text-left font-bold text-slate-600 w-[11%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Account</th>}
                    {columns.email && <th className="px-2 py-2 text-left font-bold text-slate-600 w-[14%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Email</th>}
                    {columns.phone && <th className="px-2 py-2 text-left font-bold text-slate-600 w-[11%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Phone</th>}
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[7%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">NTN</th>
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[6%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Grade</th>
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[17%] border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">Last Note</th>
                    <th className="px-2 py-2 text-left font-bold text-slate-600 w-[10%] dark:text-zinc-300">Create</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-sm text-slate-500 py-6 text-center dark:text-zinc-400">
                        No customers found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn("border-b border-[#e2e8f0] dark:border-slate-700 last:border-0 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50", selected.has(row.id) ? "bg-slate-50/50 dark:bg-zinc-900/50" : "")}
                      >
                        <td className="px-2 py-2 border-r border-[#e2e8f0] dark:border-zinc-800">
                          <Checkbox
                            checked={selected.has(row.id)}
                            onCheckedChange={(val) => toggleRow(row.id, Boolean(val))}
                          />
                        </td>
                        <td className="px-2 py-2 text-slate-600 truncate font-mono border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">
                          {row.drmId || row.id.slice(0, 8)}
                        </td>
                        <td className="px-2 py-2 text-slate-700 truncate border-r border-[#e2e8f0] dark:border-zinc-800 dark:text-zinc-400">{row.company || "-"}</td>
                        {columns.account && <td className="px-2 py-2 text-slate-700 truncate border-r border-[#e2e8f0] dark:border-zinc-800 dark:text-zinc-400">{row.accountName || "-"}</td>}
                        {columns.email && <td className="px-2 py-2 text-slate-600 truncate border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">{row.email || "-"}</td>}
                        {columns.phone && <td className="px-2 py-2 text-slate-600 truncate border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">{row.phone || "-"}</td>}
                        <td className="px-2 py-2 text-slate-700 truncate border-r border-[#e2e8f0] dark:border-zinc-800 dark:text-zinc-400">{row.ntn || "-"}</td>
                        <td className="px-2 py-2 text-slate-700 border-r border-[#e2e8f0] dark:border-zinc-800 dark:text-zinc-400">{row.grade || "-"}</td>
                        <td className="px-2 py-2 truncate text-slate-600 border-r border-[#e2e8f0] dark:text-zinc-300 dark:border-zinc-800">
                          {row.lastNote || "-"}
                        </td>
                        <td className="px-2 py-2 text-slate-600 truncate dark:text-zinc-300">
                          {row.createdAt ? format(new Date(row.createdAt), "yyyy-MM-dd") : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <div>
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
