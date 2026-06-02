import { useState, useMemo } from "react";
import { Bell, Clock, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function NotificationDropdown() {
    const queryClient = useQueryClient();
    const [, setLocation] = useLocation();

    const { data: notificationsData } = useQuery({
        queryKey: ["/api/notifications"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/notifications");
            const json = await res.json();
            console.log("[Notifications] Received:", json);
            return json;
        },
        // Dynamic interval: poll every 30s, but stop if the request fails to prevent DB hammering
        refetchInterval: (query: any) => (query.state.status === "error" ? false : 30000), 
    });

    const notifications = useMemo(() => {
        const list = notificationsData?.data || (Array.isArray(notificationsData) ? notificationsData : []);
        // Only keep the most recent 100 for the dropdown to prevent performance degradation
        return Array.isArray(list) ? list.slice(0, 100) : [];
    }, [notificationsData]);

    const unreadCount = useMemo(() => 
        notifications.filter((n: any) => (n.readStatus || n.read_status) === "UNREAD").length,
    [notifications]);

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("PUT", `/api/notifications/${id}/read`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
        },
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 h-9 w-9 dark:hover:bg-zinc-800">
                    <Bell className="h-5 w-5 text-slate-700 dark:text-zinc-400" strokeWidth={1.5} />
                    {unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1">
                            <Badge
                                variant="destructive"
                                className="h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold border border-white shadow-md animate-pulse"
                            >
                                {unreadCount}
                            </Badge>
                        </div>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[400px] p-0 shadow-2xl border-slate-200 dark:border-zinc-800">
                <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
                    <DropdownMenuLabel className="p-0 text-base font-bold text-slate-900 dark:text-zinc-100">Notifications</DropdownMenuLabel>
                    {unreadCount > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-white dark:bg-zinc-900">{unreadCount} New</Badge>
                    )}
                </div>
                <div className="max-h-[450px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center gap-2">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center dark:bg-zinc-900">
                                <Bell className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium dark:text-zinc-400">Everything's quiet here</p>
                        </div>
                    ) : (
                        notifications.map((notif: any) => (
                            <DropdownMenuItem
                                key={notif.id}
                                className={`flex flex-col items-start p-4 gap-1.5 cursor-pointer border-b last:border-0 transition-colors ${(notif.readStatus || notif.read_status) === 'UNREAD' ? 'bg-blue-50/40 hover:bg-blue-50' : 'hover:bg-slate-50 dark:bg-zinc-900'}`}
                                onClick={(e) => {
                                    // Important: mark as read
                                    if ((notif.readStatus || notif.read_status) === 'UNREAD') {
                                        markAsReadMutation.mutate(notif.id);
                                    }
                                    
                                    const link = notif.link || notif.targetUrl || notif.target_url;
                                    if (link) {
                                        console.log(`[Notifications] Actionable click, navigating to: ${link}`);
                                        if (link.startsWith('http')) {
                                            window.location.href = link;
                                        } else {
                                            setLocation(link);
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-start gap-3 w-full relative">
                                    <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${(notif.type || notif.type) === 'ERROR' ? 'bg-red-500 shadow-red-200' : (notif.type || notif.type) === 'WARNING' ? 'bg-orange-500 shadow-orange-200' : (notif.type || notif.type) === 'SUCCESS' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-blue-500 shadow-blue-200'}`} />
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className={`text-sm leading-snug ${(notif.readStatus || notif.read_status) === 'UNREAD' ? 'font-bold text-slate-900' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                                                {notif.message}
                                            </p>
                                            {(notif.link || notif.targetUrl || notif.target_url) && (
                                                <div className="bg-blue-100 text-blue-700 p-1 rounded hover:bg-blue-200 transition-colors shrink-0 tooltip" title="Click to open">
                                                    <ArrowRight className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {(() => {
                                                try {
                                                    return new Date(notif.createdAt || notif.created_at).toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    });
                                                } catch(e) { return "Recent"; }
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
                <div className="p-2 border-t bg-slate-50/30 text-center">
                    <button
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors py-1 px-4 rounded-md hover:bg-blue-50"
                        onClick={() => {
                            // Logic to mark all as read could go here
                        }}
                    >
                        View All Activity
                    </button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
