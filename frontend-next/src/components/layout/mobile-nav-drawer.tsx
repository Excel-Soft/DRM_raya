"use client";

import { useEffect, useRef } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { cn } from "@/lib/utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  activeRoleId: string | null | undefined;
  userRoles: string[] | undefined;
  authenticated: boolean;
  onToggleCollapsed: () => void;
};

export function MobileNavDrawer({
  open,
  onClose,
  activeRoleId,
  userRoles,
  authenticated,
  onToggleCollapsed,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          "absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Menu</span>
          <button
            type="button"
            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Close menu"
            onClick={onClose}
          >
            <HiOutlineXMark className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <AppSidebarNav
          activeRoleId={activeRoleId}
          userRoles={userRoles}
          authenticated={authenticated}
          collapsed={false}
          onToggleCollapsed={onToggleCollapsed}
          onNavigate={onClose}
          className="flex-1 pt-2"
        />
      </div>
    </div>
  );
}
