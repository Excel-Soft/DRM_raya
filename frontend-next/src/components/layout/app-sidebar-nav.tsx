"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { APP_NAV_GROUPS, PLATFORM_NAV, type NavGroup } from "@/lib/navigation/navigation-config";
import { filterVisibleNavGroups, isNavPathActive } from "@/lib/navigation/navigation-visibility";
import { isNextMigratedPath, legacyAppHref } from "@/lib/navigation/migrated-routes";
import {
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi2";
import { NavIcon } from "@/components/layout/nav-icon";
import { NavLinkItem } from "@/components/layout/nav-link-item";

const SIDEBAR_COLLAPSED_KEY = "drm-sidebar-collapsed";

type Props = {
  activeRoleId: string | null | undefined;
  userRoles: string[] | undefined;
  authenticated: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
  className?: string;
};

function NavGroupSection({
  group,
  pathname,
  onNavigate,
  collapsed,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const hasChildren = (group.children?.length ?? 0) > 0;
  const childActive = group.children?.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`));
  const selfActive = group.href && (pathname === group.href || pathname.startsWith(`${group.href}/`));
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? Boolean(childActive || selfActive);

  if (!hasChildren && group.href) {
    const active = isNavPathActive(pathname, group.href);
    const migrated = isNextMigratedPath(group.href);
    const legacyOrigin = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGIN;
    const rowClass = cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
      active
        ? "bg-emerald-50 font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80",
    );
    const badge = !migrated ? (
      <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
        Legacy
      </span>
    ) : (
      <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
        Next
      </span>
    );
    const inner = (
      <>
        <NavIcon name={group.icon} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{group.label}</span>
            {badge}
          </>
        )}
      </>
    );
    if (migrated) {
      return (
        <Link href={group.href} className={rowClass} onClick={onNavigate} title={collapsed ? group.label : undefined}>
          {inner}
        </Link>
      );
    }
    if (legacyOrigin) {
      return (
        <a
          href={legacyAppHref(group.href)}
          className={rowClass}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          title={collapsed ? group.label : undefined}
        >
          {inner}
        </a>
      );
    }
    return (
      <span className={cn(rowClass, "cursor-default opacity-90")} title={group.label}>
        {inner}
      </span>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-zinc-200 dark:hover:bg-zinc-800/80",
          (childActive || selfActive) && "text-emerald-800 dark:text-emerald-200",
        )}
        aria-expanded={open}
        onClick={() => setManualOpen(!open)}
      >
        <NavIcon name={group.icon} />
        {!collapsed && <span className="flex-1 truncate">{group.label}</span>}
        {!collapsed && (
          <span className="text-zinc-400" aria-hidden>
            {open ? (
              <HiOutlineChevronUp className="h-4 w-4 shrink-0" />
            ) : (
              <HiOutlineChevronDown className="h-4 w-4 shrink-0" />
            )}
          </span>
        )}
      </button>
      {open && !collapsed && (
        <ul className="ml-2 space-y-0.5 border-l border-zinc-200 pl-2 dark:border-zinc-700">
          {group.children?.map((item) => (
            <li key={item.id}>
              <NavLinkItem
                href={item.href}
                label={item.label}
                pathname={pathname}
                compact
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AppSidebarNav({
  activeRoleId,
  userRoles,
  authenticated,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  className,
}: Props) {
  const pathname = usePathname() || "/";
  const groups = useMemo(
    () => filterVisibleNavGroups(APP_NAV_GROUPS, activeRoleId, userRoles, authenticated),
    [activeRoleId, userRoles, authenticated],
  );

  return (
    <nav className={cn("flex flex-col", className)} aria-label="Main">
      <div className="flex items-center justify-between gap-2 px-3 pb-2">
        {!collapsed && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Modules
          </p>
        )}
        <button
          type="button"
          className="hidden rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 md:inline-flex"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <HiOutlineChevronDoubleRight className="h-4 w-4" aria-hidden />
          ) : (
            <HiOutlineChevronDoubleLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      <div className="px-2 pb-3">
        <div className="space-y-3">
          {authenticated && PLATFORM_NAV.length > 0 && (
            <div>
              {!collapsed && (
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Platform
                </p>
              )}
              <ul className="space-y-0.5">
                {PLATFORM_NAV.map((item) => (
                  <li key={item.id}>
                    <NavLinkItem href={item.href} label={item.label} pathname={pathname} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-2">
            {groups.map((g) => (
              <NavGroupSection
                key={g.id}
                group={g}
                pathname={pathname}
                onNavigate={onNavigate}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>
      </div>
      {!collapsed && (
        <p className="mx-2 mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-[10px] leading-snug text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
          Legacy links need <code className="text-[9px]">NEXT_PUBLIC_LEGACY_APP_ORIGIN</code>. Menu ≠ access control.
        </p>
      )}
    </nav>
  );
}

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return [collapsed, toggle];
}
