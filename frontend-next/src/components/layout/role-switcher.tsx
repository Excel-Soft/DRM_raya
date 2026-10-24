"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { apiRequest } from "@/lib/query/query-client";
import { normalizeRole } from "@/lib/auth/role-utils";
import {
  DEFAULT_MANAGEABLE_ROLES,
  formatRoleLabel,
  isAdminActor,
  stopRoleImpersonation,
  switchActiveRole,
  type ManageableRole,
} from "@/lib/auth/role-switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/legacy/dropdown-menu";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils/cn";

type NavPayload = {
  manageableRoles?: ManageableRole[];
  isImpersonating?: boolean;
};

export function RoleSwitcher() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  const { data: navData } = useQuery({
    queryKey: ["/api/me/navigation"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/navigation");
      return res.json() as NavPayload;
    },
    enabled: !!user,
  });

  const activeRole = user?.activeRoleId || user?.role || "";
  const assignedRoles = user?.roles ?? [];
  const normalizedAssigned = useMemo(() => assignedRoles.map((r) => normalizeRole(r)), [assignedRoles]);
  const isImpersonating =
    navData?.isImpersonating ||
    (typeof window !== "undefined" && sessionStorage.getItem("isImpersonating") === "true");
  const isAdmin = isAdminActor(activeRole, assignedRoles);

  const options = useMemo(() => {
    const fromApi = navData?.manageableRoles ?? [];
    const pool = fromApi.length > 0 ? fromApi : isAdmin || isImpersonating ? DEFAULT_MANAGEABLE_ROLES : [];

    if (isAdmin || isImpersonating) {
      return pool.length > 0 ? pool : DEFAULT_MANAGEABLE_ROLES;
    }

    if (pool.length > 0) {
      return pool.filter((role) => normalizedAssigned.includes(normalizeRole(role.key)));
    }

    return assignedRoles.map((r) => ({
      key: normalizeRole(r),
      label: formatRoleLabel(normalizeRole(r)),
    }));
  }, [navData?.manageableRoles, isAdmin, isImpersonating, normalizedAssigned, assignedRoles]);

  if (!user || (options.length <= 1 && !isAdmin && !isImpersonating)) {
    return (
      <Badge variant="neutral" className="hidden max-w-[140px] truncate sm:inline-flex">
        {formatRoleLabel(normalizeRole(activeRole)) || activeRole}
      </Badge>
    );
  }

  const onSelectRole = async (roleKey: string) => {
    if (normalizeRole(roleKey) === normalizeRole(activeRole) && !isImpersonating) return;
    setPending(true);
    try {
      await switchActiveRole({
        roleKey,
        assignedRoles,
        activeRoleId: activeRole,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not switch role");
      setPending(false);
    }
  };

  const onStopImpersonation = async () => {
    setPending(true);
    try {
      await stopRoleImpersonation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not stop impersonation");
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          className="h-9 max-w-[min(200px,40vw)] gap-1.5 px-2"
          data-testid="role-switcher-trigger"
        >
          <span className="truncate text-xs font-semibold">
            {isImpersonating ? `As ${formatRoleLabel(normalizeRole(activeRole))}` : formatRoleLabel(normalizeRole(activeRole))}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Switch role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((role) => {
          const selected = normalizeRole(role.key) === normalizeRole(activeRole);
          return (
            <DropdownMenuItem
              key={role.key}
              disabled={pending}
              className="flex items-center justify-between"
              onSelect={() => void onSelectRole(role.key)}
            >
              <span>{role.label}</span>
              {selected ? <Check className={cn("h-4 w-4 text-emerald-600")} aria-hidden /> : null}
            </DropdownMenuItem>
          );
        })}
        {isImpersonating ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={pending}
              className="text-red-600 focus:text-red-600"
              onSelect={() => void onStopImpersonation()}
            >
              Stop impersonation
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
