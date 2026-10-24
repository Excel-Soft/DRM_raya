"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { isPublicPath } from "@/lib/auth/constants";
import { isRouteAccessAllowed } from "@/lib/auth/route-access";
import { getDefaultDashboardPath } from "@/lib/auth/role-dashboards";
import { AuthSessionSkeleton } from "@/components/ui/skeleton";

function LoadingShell() {
  return <AuthSessionSkeleton />;
}

function ForbiddenShell() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-zinc-800">Access denied</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Your role cannot open this page. Express API calls would also enforce permissions.
      </p>
    </div>
  );
}

function AuthErrorShell({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-zinc-800">Authentication error</h1>
      <p className="mt-2 text-sm text-zinc-600">{message}</p>
    </div>
  );
}

/**
 * Client gate: no protected flash — children hidden until /api/auth/me resolves.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { status, user, errorMessage } = useAuth();

  const publicRoute = isPublicPath(pathname);

  useEffect(() => {
    if (publicRoute) return;
    if (status === "unauthenticated") {
      router.replace("/auth");
    }
  }, [status, publicRoute, router]);

  useEffect(() => {
    if (publicRoute || status !== "authenticated" || !user) return;
    const allowed = isRouteAccessAllowed(pathname, user.activeRoleId, user.roles);
    if (!allowed) {
      const dest = getDefaultDashboardPath(user.activeRoleId);
      if (dest !== pathname) router.replace(dest);
    }
  }, [pathname, publicRoute, status, user, router]);

  if (publicRoute) return children;

  if (status === "loading") return <LoadingShell />;
  if (status === "error") return <AuthErrorShell message={errorMessage ?? "Unknown error"} />;
  if (status === "unauthenticated") return <LoadingShell />;

  if (user && !isRouteAccessAllowed(pathname, user.activeRoleId, user.roles)) {
    return <ForbiddenShell />;
  }

  return children;
}
