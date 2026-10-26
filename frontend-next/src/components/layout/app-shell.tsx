"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { findNavTitle } from "@/lib/navigation/navigation-config";
import { AppTopbar } from "@/components/layout/app-topbar";
import { AppSidebarNav, useSidebarCollapsed } from "@/components/layout/app-sidebar-nav";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { cn } from "@/lib/utils/cn";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const { user, status } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const pageTitle = useMemo(() => findNavTitle(pathname), [pathname]);
  const authenticated = status === "authenticated" && Boolean(user);
  const wideMain =
    pathname.startsWith("/dashboard/drm") ||
    pathname.startsWith("/dashboard/super-admin") ||
    pathname.startsWith("/dashboard/admin") ||
    pathname.startsWith("/dashboard/drm/users") ||
    pathname.startsWith("/dashboard/account") ||
    pathname.startsWith("/dashboard/sales") ||
    pathname.startsWith("/hr") ||
    pathname === "/dashboard";

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <AppTopbar pageTitle={pageTitle} />
      <MobileNavDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeRoleId={user?.activeRoleId}
        userRoles={user?.roles}
        authenticated={authenticated}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "sticky top-14 z-20 hidden max-h-[calc(100vh-3.5rem)] shrink-0 self-start overflow-y-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 md:block",
            collapsed ? "w-14" : "w-64 lg:w-72",
          )}
        >
          <AppSidebarNav
            activeRoleId={user?.activeRoleId}
            userRoles={user?.roles}
            authenticated={authenticated}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            className="py-3"
          />
        </aside>
        <main
          className={cn(
            "min-w-0 flex-1 px-3 py-4 sm:px-6 lg:px-8",
            authenticated && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-4",
          )}
        >
          <div className={cn("mx-auto w-full", wideMain ? "max-w-[88rem]" : "max-w-6xl")}>{children}</div>
        </main>
      </div>
      <MobileBottomNav authenticated={authenticated} onOpenMenu={() => setMobileOpen(true)} />
    </div>
  );
}
