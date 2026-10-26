"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineChevronRight,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import { useAuth } from "@/providers/auth-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationDropdown } from "@/components/layout/notification-dropdown";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { toast } from "@/lib/toast";

type Props = {
  pageTitle: string | null;
};

export function AppTopbar({ pageTitle }: Props) {
  const router = useRouter();
  const { user, signOut, status } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-bold tracking-tight text-emerald-700 dark:text-emerald-400"
        >
          DRM WebExcels
        </Link>
        <div className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          <HiOutlineChevronRight className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
            {pageTitle ?? "Next.js migration shell"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {status === "authenticated" && user ? <NotificationDropdown /> : null}
          <ThemeToggle />
          {status === "authenticated" && user ? (
            <>
              <RoleSwitcher />
              <span className="hidden max-w-[160px] items-center gap-1 truncate text-xs text-zinc-600 sm:inline-flex dark:text-zinc-400">
                <HiOutlineUserCircle className="h-4 w-4 shrink-0" aria-hidden />
                {user.fullName}
              </span>
              <button
                type="button"
                onClick={() =>
                  void signOut().then(() => {
                    toast.info("Signed out");
                    router.push("/auth");
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:text-emerald-400"
              >
                <HiOutlineArrowRightOnRectangle className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <HiOutlineArrowRightOnRectangle className="h-4 w-4 rotate-180" aria-hidden />
              Sign in
            </Link>
          )}
        </div>
      </div>
      {pageTitle && (
        <p className="border-t border-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-800 md:hidden dark:border-zinc-800 dark:text-zinc-100">
          {pageTitle}
        </p>
      )}
    </header>
  );
}
