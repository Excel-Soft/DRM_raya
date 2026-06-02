import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type VasDocRow = {
  id: string;
  company: string;
  person: string;
  project: string;
  grade: string;
  status: string;
  date: string;
};

type VasDocResponse = {
  data: VasDocRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function VasDocumentsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<VasDocResponse>({
    queryKey: ["/api/office/vas-documents", search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (search.trim()) params.set("search", search.trim());
      const res = await apiRequest("GET", `/api/office/vas-documents?${params.toString()}`);
      return res.json();
    },
  });

  const rows = data?.data ?? [];
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.company.toLowerCase().includes(q) ||
        r.person.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q) ||
        r.grade.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="flex-1 overflow-auto p-1 wide-page">
      <div className="max-w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">VAS DOCUMENT</h1>
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
                    <TableHead>Project</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{row.company || "-"}</TableCell>
                        <TableCell>{row.person || "-"}</TableCell>
                        <TableCell>{row.project || "-"}</TableCell>
                        <TableCell>{row.grade || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"}
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
