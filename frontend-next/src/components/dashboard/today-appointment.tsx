"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/legacy/card";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppointmentModal } from "@/components/dashboard/appointment-modal";
import {
  dashboardPanelClass,
  dashboardSidebarContent,
  dashboardSidebarHeader,
} from "@/modules/dashboard/dashboard-ui";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  company: string;
  purpose: string;
  time: string;
}

export function TodayAppointment({
  apiEndpoint = "/api/sales/appointments/today",
  renderModal,
  openCreateModal,
  onOpenCreateModalChange,
}: {
  apiEndpoint?: string;
  renderModal?: (props: { open: boolean; onClose: () => void }) => ReactNode;
  /** Controlled create modal (e.g. from dashboard quick link). */
  openCreateModal?: boolean;
  onOpenCreateModalChange?: (open: boolean) => void;
}) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = onOpenCreateModalChange ? (openCreateModal ?? false) : internalModalOpen;
  const setModalOpen = onOpenCreateModalChange ?? setInternalModalOpen;

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: [apiEndpoint],
  });

  return (
    <>
      <Card
        data-testid="card-today-appointment"
        className={cn(dashboardPanelClass, "overflow-hidden")}
      >
        <CardHeader className={cn(dashboardSidebarHeader, "flex flex-row items-center justify-between gap-2")}>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-600" aria-hidden />
            <CardTitle className="text-sm font-semibold">Today appointment</CardTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
            data-testid="button-add-appointment"
            className="h-8 w-8 shrink-0 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
            aria-label="Create appointment"
          >
            <span className="text-lg font-semibold leading-none" aria-hidden>
              +
            </span>
          </Button>
        </CardHeader>
        <CardContent className={cn(dashboardSidebarContent, "min-h-[6rem] pt-2")}>
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_4.5rem] gap-2 border-b border-zinc-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>Company</span>
            <span>Purpose</span>
            <span>Time</span>
          </div>

          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
          ) : !appointments || appointments.length === 0 ? (
            <p className="py-4 text-center text-sm leading-relaxed text-muted-foreground">
              No appointments for today
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {appointments.map((apt) => (
                <li
                  key={apt.id}
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_4.5rem] gap-2 py-3 text-sm text-zinc-700 dark:text-zinc-300"
                >
                  <span className="truncate font-medium">{apt.company}</span>
                  <span className="truncate text-zinc-600 dark:text-zinc-400">{apt.purpose}</span>
                  <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{apt.time}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {isModalOpen &&
        (renderModal ? (
          renderModal({ open: isModalOpen, onClose: () => setModalOpen(false) })
        ) : (
          <AppointmentModal open={isModalOpen} onClose={() => setModalOpen(false)} />
        ))}
    </>
  );
}
