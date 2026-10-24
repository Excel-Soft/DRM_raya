"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HiOutlineBars3,
  HiOutlineCalendarDays,
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineCircleStack,
} from "react-icons/hi2";
import { ATTENDANCE_MAIN } from "@/lib/navigation/attendance-routes";
import { CUSTOMER_DUPLICATE_CHECKER } from "@/lib/navigation/customer-routes";
import { DASHBOARD_HOME } from "@/lib/navigation/migrated-routes";
import { LEAD_LEAD_POOL } from "@/lib/navigation/lead-routes";
import { isNavPathActive } from "@/lib/navigation/navigation-visibility";
import { cn } from "@/lib/utils/cn";

type Tab = {
  id: string;
  label: string;
  href?: string;
  icon: typeof HiOutlineHome;
  matchPrefixes?: string[];
  action?: "menu";
};

const MOBILE_TABS: Tab[] = [
  {
    id: "home",
    label: "Home",
    href: DASHBOARD_HOME,
    icon: HiOutlineHome,
    matchPrefixes: ["/dashboard"],
  },
  {
    id: "customer",
    label: "Customer",
    href: CUSTOMER_DUPLICATE_CHECKER,
    icon: HiOutlineUserGroup,
    matchPrefixes: ["/dashboard/sales", "/dashboard/customers", "/dashboard/customer", "/customers"],
  },
  {
    id: "attendance",
    label: "HR",
    href: ATTENDANCE_MAIN,
    icon: HiOutlineCalendarDays,
    matchPrefixes: ["/hr"],
  },
  {
    id: "lead",
    label: "Lead",
    href: LEAD_LEAD_POOL,
    icon: HiOutlineCircleStack,
    matchPrefixes: ["/dashboard/lead"],
  },
  { id: "menu", label: "Menu", icon: HiOutlineBars3, action: "menu" },
];

function isTabActive(pathname: string, tab: Tab): boolean {
  if (tab.action === "menu") return false;
  if (!tab.href) return false;
  if (tab.id === "home") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  if (tab.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  return isNavPathActive(pathname, tab.href);
}

type Props = {
  onOpenMenu: () => void;
  authenticated: boolean;
};

export function MobileBottomNav({ onOpenMenu, authenticated }: Props) {
  const pathname = usePathname() || "/";

  if (!authenticated) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      aria-label="Primary"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(pathname, tab);
          const className = cn(
            "flex flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
            active
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
          );

          if (tab.action === "menu") {
            return (
              <li key={tab.id}>
                <button type="button" className={cn(className, "h-full w-full")} onClick={onOpenMenu}>
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={tab.id}>
              <Link href={tab.href!} className={cn(className, "h-full w-full")}>
                <Icon className={cn("h-5 w-5 shrink-0", active && "scale-105")} aria-hidden />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
