import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AppointmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Form State
    const [aptCustomerId, setAptCustomerId] = useState("");
    const [aptSubject, setAptSubject] = useState("");
    const [aptTime, setAptTime] = useState(() => {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    });

    // Fetch customers
    const { data: customersResponse, isLoading: loadingCustomers } = useQuery({
        queryKey: ["customers-list-mini"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/customers?pageSize=5000");
            return res.json();
        },
    });
    const customers = (customersResponse as any)?.data || [];

    const appointmentMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("POST", "/api/sales/appointments", payload);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to create appointment");
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
        onError: (err: any) => {
            toast({ title: "Failed to create appointment", description: err.message, variant: "destructive" });
        }
    });

    const { data: appointmentsResponse } = useQuery({
        queryKey: ["appointments"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/appointments?all=true");
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
    });
    const appointments = (appointmentsResponse as any)?.data || [];
    const inProcess = appointments.filter((a: any) => !a.endsAt);
    const endMeeting = appointments.filter((a: any) => a.endsAt);

    const endAppointmentMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/sales/appointments/${id}/end`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to end meeting");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Meeting ended successfully" });
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sales/appointments/today"] });
        },
        onError: (err: any) => {
            toast({ title: "Failed to end meeting", description: err.message, variant: "destructive" });
        }
    });

    const createAppointment = () => {
        if (!aptCustomerId) return toast({ title: "Please select a customer", variant: "destructive" });
        appointmentMutation.mutate({
            customerId: aptCustomerId,
            purpose: aptSubject,
            date: new Date().toISOString().split("T")[0],
            time: aptTime,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] overflow-y-auto bg-slate-50 border-slate-200 p-0 shadow-2xl rounded-[12px] custom-scrollbar text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                <DialogHeader className="p-4 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[17px] text-slate-600 dark:text-zinc-300">Create Appointment</DialogTitle>
                </DialogHeader>

                <div className="p-6 md:p-8 flex flex-col gap-6 font-sans">
                    {/* Create Appointment Section */}
                    <div className="bg-white p-6 rounded-[10px] shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-5 items-end dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Name</label>
                            <Select value={aptCustomerId} onValueChange={setAptCustomerId}>
                                <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Search Company Through Id/Name"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map((c: any) => (
                                        <SelectItem key={c.id} value={c.id}>{c.companyName || c.accountName || c.email || c.id}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <label className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">Subject</label>
                            <Input value={aptSubject} onChange={(e) => setAptSubject(e.target.value)} className="w-full border-slate-200 shadow-sm dark:border-zinc-800" />
                        </div>
                        <div className="flex flex-col gap-2 w-32">
                            <label className="text-[13px] font-bold text-slate-700 dark:text-zinc-400">Time</label>
                            <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="w-full border-slate-200 shadow-sm dark:border-zinc-800" />
                        </div>
                        <button 
                            onClick={createAppointment}
                            disabled={appointmentMutation.isPending}
                            className="bg-[#059669] hover:bg-[#047857] text-white px-8 py-2 rounded-[6px] text-[14px] font-bold shadow-sm transition-colors h-[40px] disabled:opacity-50 flex justify-center items-center gap-2">
                            {appointmentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create
                        </button>
                    </div>

                    {/* Tables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start mt-2">

                        <div className="flex flex-col gap-2">
                            <h3 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">In Process</h3>
                            <div className="border border-slate-200 rounded-[6px] bg-white overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <table className="w-full text-left text-[12px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-zinc-800">
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Company</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Meeting By</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Manager</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Com</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Time</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inProcess.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">No data available</td>
                                            </tr>
                                        ) : (
                                            inProcess.map((apt: any) => (
                                                <tr key={apt.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800">
                                                    <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.company}</td>
                                                    <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.meetingBy}</td>
                                                    <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.manager}</td>
                                                    <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.purpose}</td>
                                                    <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                                                        {apt.startsAt ? new Date(apt.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                        <button 
                                                            onClick={() => endAppointmentMutation.mutate(apt.id)} 
                                                            disabled={endAppointmentMutation.isPending} 
                                                            className="px-3 py-1 bg-red-50 text-red-600 font-bold rounded-[6px] text-[11px] hover:bg-red-100 transition-colors disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                                        >
                                                            End
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <h3 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">End Meeting</h3>
                            <div className="border border-slate-200 rounded-[6px] bg-white overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                <table className="w-full text-left text-[12px]">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-zinc-800">
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Company</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Meeting By</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">Start</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 border-r border-slate-200 dark:text-zinc-300 dark:border-zinc-800">End</th>
                                            <th className="px-3 py-3 font-bold text-slate-600 dark:text-zinc-300">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {endMeeting.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">No data available</td>
                                            </tr>
                                        ) : (
                                            endMeeting.map((apt: any) => {
                                                const start = new Date(apt.startsAt);
                                                const end = new Date(apt.endsAt);
                                                const diffMs = end.getTime() - start.getTime();
                                                const diffMins = Math.max(0, Math.round(diffMs / 60000));
                                                return (
                                                    <tr key={apt.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800">
                                                        <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.company}</td>
                                                        <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{apt.meetingBy}</td>
                                                        <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td className="px-3 py-3 border-r border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">{end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                        <td className="px-3 py-3 text-slate-600 font-bold dark:text-zinc-300">{diffMins} min</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
