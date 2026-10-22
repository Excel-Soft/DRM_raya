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
import { Users } from "lucide-react";

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
    <Card data-testid="card-customer-monthly" className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="p-5 pb-4 border-b border-border space-y-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-base font-bold text-foreground tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              <Users className="h-4 w-4" />
            </span>
            Customer Monthly
          </CardTitle>
          <div className="flex items-center">
            <Select defaultValue="choose">
              <SelectTrigger className="w-[100px] h-8 rounded-lg text-xs">
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
          <Button variant="secondary" className="h-8 text-xs px-4 rounded-lg">
            Focus
          </Button>
          <div className="flex items-center">
            <Button
              variant="secondary"
              className="h-8 text-xs px-4 rounded-l-lg rounded-r-none border-r border-border"
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
                  variant="secondary"
                  className="h-8 text-xs px-4 rounded-r-lg rounded-l-none"
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
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full table-fixed border-collapse" style={{ fontSize: '10px' }}>
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[4%] border-r border-border">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === rows.length}
                        onCheckedChange={(val) => toggleSelectAll(Boolean(val))}
                      />
                    </th>
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[8%] border-r border-border">ID</th>
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[12%] border-r border-border">Company</th>
                    {columns.account && <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[11%] border-r border-border">Account</th>}
                    {columns.email && <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[14%] border-r border-border">Email</th>}
                    {columns.phone && <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[11%] border-r border-border">Phone</th>}
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[7%] border-r border-border">NTN</th>
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[6%] border-r border-border">Grade</th>
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[17%] border-r border-border">Last Note</th>
                    <th className="px-2 py-2 text-left font-bold text-muted-foreground w-[10%]">Create</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-sm text-muted-foreground py-6 text-center">
                        No customers found
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn("border-b border-border last:border-0 hover:bg-muted/40", selected.has(row.id) ? "bg-muted/40" : "")}
                      >
                        <td className="px-2 py-2 border-r border-border">
                          <Checkbox
                            checked={selected.has(row.id)}
                            onCheckedChange={(val) => toggleRow(row.id, Boolean(val))}
                          />
                        </td>
                        <td className="px-2 py-2 text-muted-foreground truncate font-mono border-r border-border">
                          {row.drmId || row.id.slice(0, 8)}
                        </td>
                        <td className="px-2 py-2 text-foreground truncate border-r border-border">{row.company || "-"}</td>
                        {columns.account && <td className="px-2 py-2 text-foreground truncate border-r border-border">{row.accountName || "-"}</td>}
                        {columns.email && <td className="px-2 py-2 text-muted-foreground truncate border-r border-border">{row.email || "-"}</td>}
                        {columns.phone && <td className="px-2 py-2 text-muted-foreground truncate border-r border-border">{row.phone || "-"}</td>}
                        <td className="px-2 py-2 text-foreground truncate border-r border-border">{row.ntn || "-"}</td>
                        <td className="px-2 py-2 text-foreground border-r border-border">{row.grade || "-"}</td>
                        <td className="px-2 py-2 truncate text-muted-foreground border-r border-border">
                          {row.lastNote || "-"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground truncate">
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
