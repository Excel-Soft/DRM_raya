// Old-DRM "Group List" (drm/groups): the role groups with Role Id, Role Title,
// Department, Description and Date (+ how many active users hold each role).
// Read-only: roles are referenced by users.role_id, so they are not edited here.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RoleGroup {
  id: string;
  roleId: string | null;
  title: string;
  department: string | null;
  description: string | null;
  date: string | null; // YYYY-MM-DD
  members: number;
}

const fmtDate = (d: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "—";
};

export function RoleGroupList() {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<{ roles: RoleGroup[] }>({
    queryKey: ["/api/users/groups/roles"],
    queryFn: () => apiRequestJson("GET", "/api/users/groups/roles"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data?.roles ?? [];
    if (!q) return list;
    return list.filter((r) =>
      `${r.roleId ?? ""} ${r.title} ${r.department ?? ""} ${r.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-200">Group List</h2>
            <p className="text-xs text-muted-foreground">Role groups and their departments ({data?.roles?.length ?? 0} roles)</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Show
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
              entries
            </div>
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search role, department..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-md border border-slate-100 dark:border-zinc-800">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900">
              <TableRow>
                <TableHead className="w-16">#No</TableHead>
                <TableHead className="w-20">Role Id</TableHead>
                <TableHead>Role Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-rose-600">Failed to load role groups.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No roles found</TableCell></TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-muted-foreground">{start + i + 1}</TableCell>
                    <TableCell className="text-sm">{r.roleId ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell>
                      {r.department ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                          {r.department}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-zinc-400 max-w-[420px]">{r.description || ""}</TableCell>
                    <TableCell className="text-center text-sm">{r.members}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {filtered.length === 0 ? "Showing 0 entries" : `Showing ${start + 1} to ${start + rows.length} of ${filtered.length} entries`}
          </span>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={n === currentPage ? "default" : "outline"}
                className={n === currentPage ? "bg-[#3a8a4f] hover:bg-[#2f7341] min-w-9" : "min-w-9"}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
