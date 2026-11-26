// Admin → Login Audit: who logged in / out, from which IP, browser, OS and device.
// (Browsers never send a MAC address, so it cannot be recorded.)
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  id: string; event: string; reason: string | null; ip: string | null; browser: string | null; os: string | null;
  device: string | null; userAgent: string | null; loginId: string | null; createdAt: string;
  userId: string | null; userName: string | null; userEmail: string | null; actorName: string | null;
};

const EVENTS: Record<string, { label: string; cls: string }> = {
  login_success: { label: "Login", cls: "bg-emerald-100 text-emerald-700" },
  login_failed: { label: "Failed login", cls: "bg-red-100 text-red-600" },
  logout: { label: "Logout", cls: "bg-slate-100 text-slate-700" },
  forced_logout: { label: "Force logout", cls: "bg-amber-100 text-amber-700" },
};

export default function LoginAuditPage() {
  const [draft, setDraft] = useState({ search: "", event: "", from: "", to: "" });
  const [filters, setFilters] = useState(draft);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

  const { data, isLoading, isError } = useQuery<{ total: number; items: Row[] }>({
    queryKey: ["/api/admin/login-audit", params.toString()],
    queryFn: () => apiRequestJson("GET", `/api/admin/login-audit?${params.toString()}`),
  });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  return (
    <div className="space-y-4 p-6">
      <div>
        <p className="text-xs text-muted-foreground">Admin / Login Audit</p>
        <h1 className="text-xl font-bold">Login Audit <span className="ml-1 text-sm text-emerald-600">{data?.total ?? ""}</span></h1>
        <p className="text-xs text-muted-foreground">IP, browser, OS and device of every login. Browsers do not share a MAC address, so it is not available.</p>
      </div>

      <div className="grid gap-3 rounded-md border bg-card p-4 shadow-sm md:grid-cols-5">
        <Input placeholder="Name, email, IP, browser" value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} />
        <select
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={draft.event}
          onChange={(e) => setDraft({ ...draft, event: e.target.value })}
        >
          <option value="">All events</option>
          {Object.entries(EVENTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <Input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        <Input type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => { setFilters(draft); setPage(1); }}>Apply</Button>
          <Button variant="outline" onClick={() => { const e = { search: "", event: "", from: "", to: "" }; setDraft(e); setFilters(e); setPage(1); }}>Reset</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">IP address</th><th className="px-3 py-2">Browser</th><th className="px-3 py-2">OS</th>
              <th className="px-3 py-2">Device</th><th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Loading...</td></tr>}
            {isError && <tr><td colSpan={8} className="px-3 py-6 text-center text-red-500">Failed to load (admin only).</td></tr>}
            {data && data.items.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No records found.</td></tr>}
            {data?.items.map((r) => {
              const ev = EVENTS[r.event] || { label: r.event, cls: "" };
              return (
                <tr key={r.id} className="border-t" title={r.userAgent || ""}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold">{r.userName || r.loginId || "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground">{r.userEmail || (r.userName ? "" : "typed login id")}</div>
                  </td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] ${ev.cls}`}>{ev.label}</span></td>
                  <td className="px-3 py-2 font-mono">{r.ip || "—"}</td>
                  <td className="px-3 py-2">{r.browser || "—"}</td>
                  <td className="px-3 py-2">{r.os || "—"}</td>
                  <td className="px-3 py-2">{r.device || "—"}</td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">
                    {r.event === "forced_logout" && r.actorName ? `By ${r.actorName}` : r.reason || ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
