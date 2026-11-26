// User ticks shown next to a user's name everywhere:
//   green tick = user turned "Active" on in Settings, red = turned it off
//   blue tick  = Accounts verified this user's account
// Data: GET /api/user-badges (one small list, cached).
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CheckCircle2, XCircle } from "lucide-react";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

export type UserBadge = { id: string; active: boolean; verified: boolean };

export function useUserBadges() {
  const { data } = useQuery<{ items: UserBadge[] }>({
    queryKey: ["/api/user-badges"],
    queryFn: () => apiRequestJson("GET", "/api/user-badges"),
    staleTime: 60_000,
  });
  const map = new Map<string, UserBadge>();
  for (const b of data?.items ?? []) map.set(String(b.id), b);
  return map;
}

export function UserTicksView({ active, verified, size = 14 }: { active?: boolean; verified?: boolean; size?: number }) {
  const s = { width: size, height: size };
  return (
    <span className="inline-flex flex-shrink-0 items-center gap-0.5 align-middle">
      {active === undefined ? null : active ? (
        <CheckCircle2 style={s} className="text-emerald-500" aria-label="Active" />
      ) : (
        <XCircle style={s} className="text-red-500" aria-label="Not active" />
      )}
      {verified && <BadgeCheck style={s} className="text-blue-500" aria-label="Account verified" />}
    </span>
  );
}

export function UserTicks({ userId, size }: { userId?: string | null; size?: number }) {
  const badges = useUserBadges();
  const b = userId ? badges.get(String(userId)) : undefined;
  if (!b) return null;
  return <UserTicksView active={b.active} verified={b.verified} size={size} />;
}

/** Admin "Force Logout" and Accounts "Verify account" (blue tick) actions, with confirmation. */
export function useUserSecurityActions() {
  const run = async (url: string, body: unknown, okText: string) => {
    const { default: Swal } = await import("sweetalert2");
    try {
      await apiRequestJson("POST", url, body);
      queryClient.invalidateQueries({ queryKey: ["/api/user-badges"] });
      Swal.fire({ icon: "success", title: okText, timer: 1500, showConfirmButton: false });
    } catch (e: any) {
      Swal.fire({ icon: "error", title: "Failed", text: e?.message || "Request failed" });
    }
  };
  const confirm = async (title: string, html: string, confirmButtonText: string) => {
    const { default: Swal } = await import("sweetalert2");
    const r = await Swal.fire({ icon: "warning", title, html, showCancelButton: true, confirmButtonText, focusCancel: true });
    return r.isConfirmed;
  };
  const escape = (s: string) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  return {
    forceLogout: async (id: string, name: string) => {
      if (!(await confirm("Force logout?", `<b>${escape(name)}</b> will be logged out of every device and browser now.`, "Yes, log out"))) return;
      await run(`/api/admin/users/${id}/force-logout`, {}, "User logged out");
    },
    setVerified: async (id: string, name: string, verified: boolean) => {
      if (!(await confirm(verified ? "Verify account?" : "Remove verification?", `<b>${escape(name)}</b>`, verified ? "Verify" : "Remove"))) return;
      await run(`/api/admin/users/${id}/account-verify`, { verified }, verified ? "Account verified" : "Verification removed");
    },
  };
}
