"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { isNextMigratedPath, legacyAppHref } from "@/lib/navigation/migrated-routes";
import { isNavPathActive } from "@/lib/navigation/navigation-visibility";

type Props = {
  href: string;
  label: string;
  pathname: string;
  compact?: boolean;
  onNavigate?: () => void;
};

export function NavLinkItem({ href, label, pathname, compact, onNavigate }: Props) {
  const active = isNavPathActive(pathname, href);
  const migrated = isNextMigratedPath(href);
  const baseClass = cn(
    "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
    active
      ? "bg-emerald-50 font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80",
    compact && "py-1.5 text-xs",
  );

  const legacyOrigin = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGIN;
  const badge = !migrated ? (
    <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
      Legacy
    </span>
  ) : (
    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
      Next
    </span>
  );

  if (migrated) {
    return (
      <Link href={href} className={baseClass} onClick={onNavigate}>
        <span className="truncate">{label}</span>
        {badge}
      </Link>
    );
  }

  if (legacyOrigin) {
    return (
      <a
        href={legacyAppHref(href)}
        className={baseClass}
        onClick={onNavigate}
        target="_blank"
        rel="noopener noreferrer"
        title="Opens legacy WebExcels app"
      >
        <span className="truncate">{label}</span>
        {badge}
      </a>
    );
  }

  return (
    <span
      className={cn(baseClass, "cursor-default opacity-90")}
      title="Not migrated to Next yet — use your legacy WebExcels URL"
    >
      <span className="truncate">{label}</span>
      {badge}
    </span>
  );
}
