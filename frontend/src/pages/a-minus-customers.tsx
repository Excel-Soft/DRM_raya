import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type CustomerRow = {
  id: string;
  companyName: string;
  accountName: string;
  grade: string;
  createdAt: string;
};

type CustomersResponse = {
  customers: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function AMinusCustomersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["/api/sales/customers", "A-"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/sales/customers?grade=${encodeURIComponent("A-")}&page=1&pageSize=200`,
      );
      return res.json();
    },
  });

  const rows = data?.customers ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.companyName.toLowerCase().includes(q) ||
        r.accountName?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="flex-1 overflow-auto p-1 wide-page">
      <div className="max-w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">A- CUSTOMER</h1>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-lg">View Detail</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">Copy</Button>
              <Button variant="outline" size="sm">Excel</Button>
              <Button variant="outline" size="sm">PDF</Button>
              <Button variant="outline" size="sm">Column visibility</Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Search:</span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-48"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c, idx) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{c.companyName || "-"}</TableCell>
                        <TableCell>{c.accountName || "-"}</TableCell>
                        <TableCell>{c.grade || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.createdAt ? format(new Date(c.createdAt), "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-muted-foreground mt-3">
              Showing {filtered.length} of {rows.length} entries
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
