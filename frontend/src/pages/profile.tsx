// My Profile (user menu → Profile): the logged-in user's own details, ticks and recent logins.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Settings } from "lucide-react";
import { apiRequestJson } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { UserTicksView } from "@/components/user-ticks";
import { formatRoleLabel } from "@/lib/role-labels";

type Profile = {
  id: string; fullName: string; email: string; username: string; phone: string | null;
  department: string | null; designation: string | null; branch: string | null; country: string | null;
  role: string | null; roles: string[] | null; joinDate: string | null; attendanceId: string | null;
  shiftTimeIn: string | null; shiftTimeOut: string | null; gender: string | null; dateOfBirth: string | null;
  address: string | null; createdAt: string | null; accountVerifiedAt: string | null; statusActive: boolean;
  recentLogins: { id: string; event: string; reason: string | null; ip: string | null; browser: string | null; os: string | null; device: string | null; createdAt: string }[];
};

const EVENT_LABEL: Record<string, string> = {
  login_success: "Login", login_failed: "Failed login", logout: "Logout", forced_logout: "Logged out by admin",
};

export default function ProfilePage() {
  const { data: p, isLoading, isError } = useQuery<Profile>({
    queryKey: ["/api/me/profile-full"],
    queryFn: () => apiRequestJson("GET", "/api/me/profile-full"),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (isError || !p) return <div className="p-6 text-sm text-red-500">Failed to load profile.</div>;

  const roles = (p.roles?.length ? p.roles : p.role ? [p.role] : []).map((r) => formatRoleLabel(r));
  const fields: [string, string | null | undefined][] = [
    ["Email", p.email], ["Username", p.username], ["Phone", p.phone],
    ["Department", p.department], ["Designation", p.designation],
    ["Branch", p.branch], ["Country", p.country],
    ["Join Date", p.joinDate ? String(p.joinDate).slice(0, 10) : null], ["Attendance ID", p.attendanceId],
    ["Shift", p.shiftTimeIn || p.shiftTimeOut ? `${p.shiftTimeIn || "-"} to ${p.shiftTimeOut || "-"}` : null],
    ["Gender", p.gender], ["Date of Birth", p.dateOfBirth], ["Address", p.address],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
            {(p.fullName || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              {p.fullName}
              <UserTicksView active={p.statusActive} verified={!!p.accountVerifiedAt} size={18} />
            </h1>
            <p className="text-sm text-muted-foreground">{p.designation || roles[0] || ""}</p>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 ${p.statusActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {p.statusActive ? "Active" : "Not active"}
              </span>
              <span className={`rounded-full px-2 py-0.5 ${p.accountVerifiedAt ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                {p.accountVerifiedAt ? `Account verified ${new Date(p.accountVerifiedAt).toLocaleDateString("en-GB")}` : "Account not verified"}
              </span>
            </div>
          </div>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm"><Settings className="mr-1 h-4 w-4" /> Settings</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border bg-card p-5 shadow-sm md:col-span-2">
          <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Details</h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] uppercase text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium break-words">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">Roles</h2>
          <div className="flex flex-wrap gap-2">
            {roles.length ? roles.map((r) => (
              <span key={r} className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase dark:bg-zinc-800">{r}</span>
            )) : <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase text-muted-foreground">My recent logins</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-muted-foreground">
              <tr><th className="py-2 pr-3">When</th><th className="py-2 pr-3">Event</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3">Browser</th><th className="py-2 pr-3">OS / Device</th></tr>
            </thead>
            <tbody>
              {p.recentLogins.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No login history yet.</td></tr>}
              {p.recentLogins.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("en-GB")}</td>
                  <td className={`py-2 pr-3 ${l.event === "login_failed" || l.event === "forced_logout" ? "text-red-600" : ""}`}>
                    {EVENT_LABEL[l.event] || l.event}{l.reason && l.event === "login_failed" ? ` (${l.reason})` : ""}
                  </td>
                  <td className="py-2 pr-3 font-mono">{l.ip || "—"}</td>
                  <td className="py-2 pr-3">{l.browser || "—"}</td>
                  <td className="py-2 pr-3">{[l.os, l.device].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
