"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock } from "lucide-react";
import { apiRequest } from "@/lib/query/query-client";
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
import { cn } from "@/lib/utils/cn";

type NotificationRow = {
  id: string;
  message?: string;
  type?: string;
  readStatus?: string;
  read_status?: string;
  link?: string;
  targetUrl?: string;
  target_url?: string;
  createdAt?: string;
  created_at?: string;
};

function readStatus(n: NotificationRow): string {
  return n.readStatus || n.read_status || "READ";
}

function notificationLink(n: NotificationRow): string | undefined {
  return n.link || n.targetUrl || n.target_url;
}

export function NotificationDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: notificationsData } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notifications");
      return res.json();
    },
    refetchInterval: (query) => (query.state.status === "error" ? false : 30_000),
  });

  const notifications = useMemo(() => {
    const list = notificationsData?.data ?? (Array.isArray(notificationsData) ? notificationsData : []);
    return Array.isArray(list) ? (list as NotificationRow[]).slice(0, 100) : [];
  }, [notificationsData]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => readStatus(n) === "UNREAD").length,
    [notifications],
  );

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
          data-testid="button-notifications"
        >
          <Bell className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(400px,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? <Badge variant="brand">{unreadCount} new</Badge> : null}
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No notifications yet</p>
          ) : (
            notifications.map((notif) => {
              const unread = readStatus(notif) === "UNREAD";
              const link = notificationLink(notif);
              return (
                <DropdownMenuItem
                  key={notif.id}
                  className={cn(
                    "cursor-pointer flex-col items-start gap-1 rounded-none border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800",
                    unread && "bg-emerald-50/50 dark:bg-emerald-950/20",
                  )}
                  onSelect={() => {
                    if (unread) markAsReadMutation.mutate(notif.id);
                    if (!link) return;
                    if (link.startsWith("http")) {
                      window.location.href = link;
                      return;
                    }
                    router.push(link);
                  }}
                >
                  <p className={cn("text-sm leading-snug", unread ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400")}>
                    {notif.message || "Notification"}
                  </p>
                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Clock className="h-3 w-3" aria-hidden />
                    {(() => {
                      const raw = notif.createdAt || notif.created_at;
                      if (!raw) return "Recent";
                      const d = new Date(raw);
                      return Number.isNaN(d.getTime())
                        ? "Recent"
                        : d.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                    })()}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="px-3 py-2 text-center">
          <button
            type="button"
            className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            onClick={() => router.push("/dashboard")}
          >
            Open dashboard
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
