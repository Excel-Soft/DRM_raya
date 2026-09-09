import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, RotateCcw } from "lucide-react";

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  module: string | null;
  reason: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString() : "—");

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    actor: "",
    module: "",
    entityType: "",
    entityId: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ["/api/audit-logs", applied, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      Object.entries(applied).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      return apiRequestJson<AuditResponse>("GET", `/api/audit-logs?${params.toString()}`);
    },
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onApply = () => {
    setPage(1);
    setApplied(filters);
  };
  const onReset = () => {
    const cleared = { actor: "", module: "", entityType: "", entityId: "", action: "", dateFrom: "", dateTo: "" };
    setFilters(cleared);
    setApplied(cleared);
    setPage(1);
  };

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-4 md:p-6 min-h-screen bg-slate-50/50 dark:bg-transparent">
      <div className="mb-1 text-[12px] text-slate-400 dark:text-zinc-500">Admin / Audit Logs</div>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-600" />
        <h1 className="text-[18px] font-bold text-slate-700 dark:text-zinc-200">Audit Logs</h1>
        <span className="text-[12px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">{total}</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input placeholder="Actor (user id)" value={filters.actor} onChange={set("actor")} className="text-[13px] h-9" />
          <Input placeholder="Module" value={filters.module} onChange={set("module")} className="text-[13px] h-9" />
          <Input placeholder="Entity type" value={filters.entityType} onChange={set("entityType")} className="text-[13px] h-9" />
          <Input placeholder="Entity ID" value={filters.entityId} onChange={set("entityId")} className="text-[13px] h-9" />
          <Input placeholder="Action" value={filters.action} onChange={set("action")} className="text-[13px] h-9" />
          <Input type="date" placeholder="From" value={filters.dateFrom} onChange={set("dateFrom")} className="text-[13px] h-9" />
          <Input type="date" placeholder="To" value={filters.dateTo} onChange={set("dateTo")} className="text-[13px] h-9" />
          <div className="flex gap-2">
            <Button onClick={onApply} className="h-9 text-[13px] flex-1">Apply</Button>
            <Button onClick={onReset} variant="outline" className="h-9 text-[13px]"><RotateCcw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm p-3">
        <div className="overflow-x-auto rounded border border-slate-50 dark:border-zinc-800">
          <Table>
            <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">When</TableHead>
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Actor</TableHead>
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Action</TableHead>
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Module</TableHead>
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Entity</TableHead>
                <TableHead className="text-[12px] font-bold text-slate-600 py-3 dark:text-zinc-300">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading audit logs…
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-rose-500">
                    Failed to load audit logs.{" "}
                    <button onClick={() => refetch()} className="underline font-semibold">Retry</button>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-slate-500">No audit entries match these filters.</TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="border-b border-slate-50 dark:border-zinc-800 hover:bg-slate-50/50">
                    <TableCell className="text-[12px] text-slate-600 py-2.5 whitespace-nowrap dark:text-zinc-400">{fmtDateTime(r.createdAt)}</TableCell>
                    <TableCell className="text-[12px] text-slate-600 py-2.5 dark:text-zinc-400">
                      <div className="font-semibold">{r.actorName || r.actorEmail || r.actorId || "—"}</div>
                      {r.actorRole && <div className="text-[11px] text-slate-400">{r.actorRole}</div>}
                    </TableCell>
                    <TableCell className="text-[12px] font-medium text-slate-700 py-2.5 dark:text-zinc-300">{r.action}</TableCell>
                    <TableCell className="text-[12px] text-slate-600 py-2.5 dark:text-zinc-400">{r.module || "—"}</TableCell>
                    <TableCell className="text-[12px] text-slate-600 py-2.5 dark:text-zinc-400">
                      {r.entityType}
                      {r.entityId ? <span className="text-slate-400"> · {r.entityId}</span> : null}
                    </TableCell>
                    <TableCell className="text-[12px] text-slate-600 py-2.5 max-w-[260px] truncate dark:text-zinc-400" title={r.reason || ""}>{r.reason || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-3 px-1">
          <div className="text-[12px] text-slate-500">
            {total > 0 ? `Page ${page} of ${totalPages} · ${total} entries` : "—"}
            {isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin inline-block ml-2" />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8 text-[12px]" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
            <Button variant="outline" className="h-8 text-[12px]" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
