import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, ArrowRightCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { AppointmentModal } from "@/components/appointment-modal";

interface Appointment {
  id: string;
  company: string;
  purpose: string;
  time: string;
}

export function TodayAppointment({
  apiEndpoint = "/api/sales/appointments/today",
  renderModal,
}: {
  apiEndpoint?: string;
  /** Optional override for the "create appointment" modal opened by the "+"
   *  button. Defaults to the shared Sales AppointmentModal — pass this to
   *  point the create flow at a different department's own endpoints
   *  (e.g. Service Executive) without touching Sales/Reception's behavior. */
  renderModal?: (props: { open: boolean; onClose: () => void }) => ReactNode;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: [apiEndpoint],
  });

  return (
    <>
      <Card data-testid="card-today-appointment" className="shadow-none border-0 bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-0 pt-0 pb-3">
          <CardTitle className="text-sm font-bold text-foreground tracking-tight">Today Appointment</CardTitle>
          <button
            onClick={() => setIsModalOpen(true)}
            data-testid="button-add-appointment"
            className="text-emerald-500 hover:text-emerald-600 transition-colors"
          >
            <PlusCircle className="w-[20px] h-[20px]" strokeWidth={2.5} />
          </button>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-0">
          <div className="flex flex-col">
            <div className="grid grid-cols-[minmax(0,1.2fr)_1fr_80px] gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground pb-3 border-b border-border mb-2">
              <div className="flex items-center gap-1.5">
                <ArrowRightCircle className="w-[14px] h-[14px]" strokeWidth={2} />
                Company
              </div>
              <div className="text-left">Purpose</div>
              <div className="text-left">Time</div>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-[13px] text-muted-foreground">Loading...</div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted-foreground">
                No appointments for today
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {appointments.map((apt) => (
                  <div key={apt.id} className="grid grid-cols-[minmax(0,1.2fr)_1fr_80px] gap-2 text-[12px] text-muted-foreground items-center">
                    <div className="truncate pr-1 text-foreground font-medium flex items-center gap-1.5">
                      <ArrowRightCircle className="w-[12px] h-[12px] text-transparent" />
                      {apt.company}
                    </div>
                    <div className="truncate pr-1">{apt.purpose}</div>
                    <div className="font-medium text-muted-foreground">{apt.time}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {isModalOpen && (
        renderModal
          ? renderModal({ open: isModalOpen, onClose: () => setIsModalOpen(false) })
          : <AppointmentModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
      )
      }
    </>
  );
}
