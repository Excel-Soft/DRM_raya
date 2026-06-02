import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type ComplaintRow = {
  id: string;
  company?: string;
  person?: string;
  service?: string;
  priority: string;
  status: string;
  detail: string;
  date: string;
};

export default function ComplaintsPage() {
  const [search, setSearch] = useState("");

  const { data: complaints = [], isLoading } = useQuery<ComplaintRow[]>({
    queryKey: ["/api/support/tickets"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/support/tickets");
      const raw = await res.json();
      return raw.map((t: any) => ({
        id: t.id,
        company: t.customer?.companyName ?? "",
        person: t.customer?.accountName ?? "",
        service: t.channel,
        priority: t.priority,
        status: t.status,
        detail: t.subject,
        date: t.createdAt,
      })) as ComplaintRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return complaints;
    const q = search.toLowerCase();
    return complaints.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.person?.toLowerCase().includes(q) ||
        c.detail.toLowerCase().includes(q),
    );
  }, [complaints, search]);

  return (
    <div className="flex-1 overflow-auto p-1 wide-page">
      <div className="max-w-full space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">COMPLAINT LIST</h1>
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
                    <TableHead>Service</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                        No data available in table
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c, idx) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>{c.company || "-"}</TableCell>
                        <TableCell>{c.person || "-"}</TableCell>
                        <TableCell className="capitalize">{c.service || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {c.detail || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.date ? format(new Date(c.date), "dd/MM/yyyy") : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="text-sm text-muted-foreground mt-3">
              Showing {filtered.length} of {complaints.length} entries
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
