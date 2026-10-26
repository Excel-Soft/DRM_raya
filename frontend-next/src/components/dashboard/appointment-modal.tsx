"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MeetingTab = "active" | "ended";

export function AppointmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MeetingTab>("active");

  const [aptCustomerId, setAptCustomerId] = useState("");
  const [aptSubject, setAptSubject] = useState("");
  const [aptTime, setAptTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  });

  const { data: customersResponse, isLoading: loadingCustomers } = useQuery({
    queryKey: ["customers-list-mini"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/customers?pageSize=5000");
      return res.json();
    },
  });
  const customers = (customersResponse as { data?: unknown[] })?.data || [];

  const appointmentMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await apiRequest("POST", "/api/sales/appointments", payload);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "Failed to create appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment created successfully" });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/appointments/today"] });
      setAptCustomerId("");
      setAptSubject("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create appointment", description: err.message, variant: "destructive" });
    },
  });

  const { data: appointmentsResponse, isLoading: loadingMeetings } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/appointments?all=true");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const appointments = (appointmentsResponse as { data?: Array<Record<string, unknown>> })?.data || [];
  const inProcess = appointments.filter((a) => !a.endsAt);
  const endMeeting = appointments.filter((a) => a.endsAt);

  const endAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/sales/appointments/${id}/end`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || "Failed to end meeting");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Meeting ended successfully" });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/appointments/today"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to end meeting", description: err.message, variant: "destructive" });
    },
  });

  const createAppointment = () => {
    if (!aptCustomerId) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }
    appointmentMutation.mutate({
      customerId: aptCustomerId,
      purpose: aptSubject,
      date: new Date().toISOString().split("T")[0],
      time: aptTime,
    });
  };

  const activeRows = tab === "active" ? inProcess : endMeeting;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="flex max-h-[min(88vh,720px)] w-[min(100vw-1.5rem,32rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <DialogTitle className="text-base font-semibold">New appointment</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Company</label>
              <Select value={aptCustomerId} onValueChange={setAptCustomerId}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={loadingCustomers ? "Loading…" : "Search by ID or company name"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(customers as Array<{ id: string; companyName?: string; accountName?: string; email?: string }>).map(
                    (c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName || c.accountName || c.email || c.id}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Subject</label>
                <Input
                  value={aptSubject}
                  onChange={(e) => setAptSubject(e.target.value)}
                  className="h-9"
                  placeholder="Meeting purpose"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Time</label>
                <Input
                  type="time"
                  value={aptTime}
                  onChange={(e) => setAptTime(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={createAppointment}
              disabled={appointmentMutation.isPending}
              className="h-9 w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {appointmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create appointment"}
            </Button>
          </div>

          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setTab("active")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                  tab === "active"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400",
                )}
              >
                In process ({inProcess.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("ended")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                  tab === "ended"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400",
                )}
              >
                Ended ({endMeeting.length})
              </button>
            </div>

            <div className="max-h-52 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    {tab === "active" ? (
                      <>
                        <th className="px-2 py-2 font-semibold">Company</th>
                        <th className="px-2 py-2 font-semibold">By</th>
                        <th className="px-2 py-2 font-semibold">Time</th>
                        <th className="px-2 py-2 font-semibold text-right">Action</th>
                      </>
                    ) : (
                      <>
                        <th className="px-2 py-2 font-semibold">Company</th>
                        <th className="px-2 py-2 font-semibold">Start</th>
                        <th className="px-2 py-2 font-semibold">End</th>
                        <th className="px-2 py-2 font-semibold text-right">Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loadingMeetings ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  ) : activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                        No records
                      </td>
                    </tr>
                  ) : tab === "active" ? (
                    (inProcess as Array<Record<string, string>>).map((apt) => (
                      <tr key={String(apt.id)} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                        <td className="max-w-[7rem] truncate px-2 py-2">{apt.company}</td>
                        <td className="max-w-[5rem] truncate px-2 py-2">{apt.meetingBy}</td>
                        <td className="whitespace-nowrap px-2 py-2">
                          {apt.startsAt
                            ? new Date(String(apt.startsAt)).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 border-red-200 px-2 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                            onClick={() => endAppointmentMutation.mutate(String(apt.id))}
                            disabled={endAppointmentMutation.isPending}
                          >
                            End
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    (endMeeting as Array<Record<string, string>>).map((apt) => {
                      const start = new Date(String(apt.startsAt));
                      const end = new Date(String(apt.endsAt));
                      const diffMins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
                      return (
                        <tr key={String(apt.id)} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                          <td className="max-w-[8rem] truncate px-2 py-2">{apt.company}</td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-2 py-2 text-right font-medium tabular-nums">{diffMins}m</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
