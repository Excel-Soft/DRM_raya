"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { isNextMigratedPath, legacyAppHref } from "@/lib/navigation/migrated-routes";
import { quickLinkMigrationPath } from "@/lib/navigation/dashboard-quick-links";
import { cn } from "@/lib/utils/cn";

const rowClass =
  "group flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-2.5 text-sm font-medium transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/50";

type Props = {
  label: string;
  href: string;
  onAction?: () => void;
};

export function DashboardQuickLinkRow({ label, href, onAction }: Props) {
  const chevron = (
    <ChevronRight
      className="h-3.5 w-3.5 shrink-0 text-zinc-400 group-hover:text-emerald-600"
      aria-hidden
    />
  );

  if (onAction) {
    return (
      <button type="button" onClick={onAction} className={cn(rowClass, "text-left")}>
        <span className="min-w-0 truncate">{label}</span>
        {chevron}
      </button>
    );
  }

  const path = quickLinkMigrationPath(href);
  const migrated = isNextMigratedPath(path);
  const legacyOrigin = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGIN;

  if (migrated) {
    return (
      <Link href={href} className={rowClass}>
        <span className="min-w-0 truncate">{label}</span>
        {chevron}
      </Link>
    );
  }

  if (legacyOrigin) {
    return (
      <a
        href={legacyAppHref(href)}
        className={rowClass}
        target="_blank"
        rel="noopener noreferrer"
        title="Opens legacy WebExcels app"
      >
        <span className="min-w-0 truncate">{label}</span>
        {chevron}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={rowClass}
      title="Not migrated to Next yet — set NEXT_PUBLIC_LEGACY_APP_ORIGIN for legacy app"
    >
      <span className="min-w-0 truncate">{label}</span>
      {chevron}
    </Link>
  );
}
