import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Purpose/Grade/Reservation option sets and layout verbatim-match the
// "Follow The Customer" form in service-assistant-manager-dashboard.tsx
// (the only real implementation of this section anywhere in the codebase).
// That reference has no Grade or Service field of its own; both are added
// here because the "Follow Up Details" table this section feeds
// (service-executive-dashboard.tsx) has Grade/Main Service/Sub Type columns
// that read from drm.followup_subservice_details, which requires a
// service+subservice pair to write a row at all. The Grade set (A+, A, A-,
// B+, B, B-, C+, C, D) and Method dropdown options are taken from
// FollowCustomerServicesPanel.tsx, the only other place in the codebase that
// defines a Grade/Method taxonomy for follow-ups.
const FOLLOW_PURPOSE_OPTIONS = ["New Sell", "Inform", "Payment Recovery", "Ab Payment", "Project Data", "Renew Sell", "Seminar", "Webinar", "Training"];
// New required multi-select ("Review") field, positioned between Purpose and
// Grade per the confirmed screenshot layout. Options verbatim per user
// screenshot spelling (including "Happay").
const FOLLOW_REVIEW_OPTIONS = ["Report", "Start Rating", "Up Selling", "Rfq", "Products", "Follow Rate", "Sample", "Order", "Revenue", "Happay With Alibaba", "Happay With Webxl"];
const FOLLOW_GRADE_OPTIONS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
const FOLLOW_METHOD_OPTIONS = ["Mobile", "Whatsapp", "WH-Call", "In-meeting", "Out-meeting", "E-mail", "Appointment", "Seminar", "OL-Meeting"];
const FOLLOW_RESERVATION_OPTIONS = [
    { label: "Mobile", code: "MOBILE" },
    { label: "On-Site Appointment", code: "ON_SITE_APPOINTMENT" },
    { label: "E-mail", code: "E_MAIL" },
    { label: "Vm Appointment", code: "VM_APPOINTMENT" },
    { label: "Fax", code: "FAX" },
    { label: "No Need", code: "NO_NEED" },
];
// The Follow Up Details table only ever surfaces rows whose serviceType is
// "Alibaba Membership" or "Alibaba Services" (service-executive-dashboard.tsx's
// followUpKeptServices) — the Service picker is restricted to those two so a
// submitted follow-up is guaranteed to actually show up there.
const FOLLOW_KEPT_SERVICES = ["alibaba membership", "alibaba services"];

// Service-Executive analog of AppointmentModal (frontend/src/components/appointment-modal.tsx).
// Wired into TodayAppointment's "+" button via the `renderModal` override (see
// service-executive-dashboard.tsx) and mirrors the Sales create/manage-appointments
// flow, but scoped to the executive's own /api/service/executive/appointments
// endpoints and own service customers for the picker.
export function ServiceAppointmentModal({
    open,
    onClose,
    initialCustomerId,
    initialCustomerName,
}: {
    open: boolean;
    onClose: () => void;
    // Set when this modal is opened from a specific customer row (e.g. the
    // Service Pool page's clickable ID column) rather than the generic "+"
    // button — locks the "Follow The Customer" customer field to that
    // customer instead of showing the normal searchable dropdown. Optional
    // and additive: the "+" button call site (service-executive-dashboard.tsx)
    // omits both, so it keeps its existing dropdown-driven behavior unchanged.
    initialCustomerId?: string;
    initialCustomerName?: string;
}) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Follow The Customer form state
    const [followCustomerId, setFollowCustomerId] = useState(initialCustomerId ?? "");
    // Re-sync whenever the modal is (re)opened for a specific customer — a
    // single mounted modal instance can be reused across different rows, so
    // the initial useState value alone wouldn't catch a second row's click.
    useEffect(() => {
        if (open && initialCustomerId) {
            setFollowCustomerId(initialCustomerId);
        }
    }, [open, initialCustomerId]);
    const [followServiceId, setFollowServiceId] = useState("");
    const [followPurpose, setFollowPurpose] = useState("");
    const [followReview, setFollowReview] = useState<string[]>([]);
    const toggleFollowReview = (r: string) => setFollowReview((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
    const [followGrade, setFollowGrade] = useState("");
    const [followMethod, setFollowMethod] = useState("");
    const [followReservation, setFollowReservation] = useState("");
    const [followNextDate, setFollowNextDate] = useState("");
    const [followNote, setFollowNote] = useState("");

    // Fetch this executive's own in-service customers for the picker, scoped
    // to Service Pool (drm.customers.pool_type = 'Service') — follow-ups must
    // be sourced from Service Pool, not whichever pool the customer happens
    // to sit in otherwise (e.g. Private).
    const { data: customersResponse, isLoading: loadingCustomers } = useQuery({
        queryKey: ["/api/service/executive/customers/in-service?poolType=Service"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/service/executive/customers/in-service?poolType=Service");
            if (!res.ok) throw new Error("Failed to fetch customers");
            return res.json();
        },
        enabled: open,
    });
    const customers = ((customersResponse as any[]) || []).map((row: any) => ({
        id: row.serviceCustomer?.customerId,
        name: row.customerDetails?.companyName || row.customerDetails?.email || row.serviceCustomer?.customerId,
    })).filter((c: any) => c.id);

    // Service catalog for the Follow The Customer "Service" picker. This is
    // a generic, non-owner-scoped read (any authenticated user), same
    // endpoint the Sales "Follow The Customer" panel (FollowCustomerServicesPanel)
    // uses via service-private-pool.tsx.
    const { data: servicesCatalogResponse } = useQuery({
        queryKey: ["/api/sales/services"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/services");
            if (!res.ok) throw new Error("Failed to fetch services");
            return res.json();
        },
        enabled: open,
    });
    // Exactly the 2 top-level services (no subservice breakdown) — the
    // dropdown must show only "Alibaba Membership" / "Alibaba Services" per
    // the reference screenshot. Each option retains its full subServices list
    // so submitFollowup can resolve a real subServiceId behind the scenes
    // (drm.followup_subservice_details.subservice_id is NOT NULL, and the
    // backend's findSubservicesByIds only matches service_subservices rows —
    // it cannot accept a bare top-level service id).
    const followServiceOptions = Array.from(
        ((servicesCatalogResponse as any)?.items || [])
            .filter((s: any) => FOLLOW_KEPT_SERVICES.includes(String(s.name).toLowerCase()))
            // The catalog has duplicate rows sharing the same name (e.g. an old
            // legacy "Alibaba Membership" entry with zero configured
            // subservices, alongside the real one with 14) — keep only the
            // richest entry per name so the dropdown never shows a
            // dead-end option with nothing to auto-resolve a subServiceId from.
            .reduce((byName: Map<string, any>, s: any) => {
                const key = String(s.name).toLowerCase();
                const existing = byName.get(key);
                if (!existing || (s.subServices?.length || 0) > (existing.subServices?.length || 0)) {
                    byName.set(key, s);
                }
                return byName;
            }, new Map<string, any>())
            .values()
    ).map((s: any) => ({
        id: s.id,
        label: s.name,
        subServices: s.subServices || [],
    }));

    const followupMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("POST", "/api/service/executive/follow-ups", payload);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to submit follow-up");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Follow-up submitted successfully" });
            // Feeds service-executive-dashboard.tsx's "Follow Up Details" table.
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
            setFollowCustomerId("");
            setFollowServiceId("");
            setFollowPurpose("");
            setFollowReview([]);
            setFollowGrade("");
            setFollowMethod("");
            setFollowReservation("");
            setFollowNextDate("");
            setFollowNote("");
        },
        onError: (err: any) => {
            toast({ title: "Failed to submit follow-up", description: err.message, variant: "destructive" });
        }
    });

    const submitFollowup = () => {
        if (!followCustomerId) return toast({ title: "Please select a customer", variant: "destructive" });
        if (!followServiceId) return toast({ title: "Please select a service", variant: "destructive" });
        if (!followPurpose) return toast({ title: "Please select a purpose", variant: "destructive" });
        if (!followReview.length) return toast({ title: "Please select at least one review option", variant: "destructive" });
        if (!followGrade) return toast({ title: "Please select a grade", variant: "destructive" });
        if (!followMethod) return toast({ title: "Please select a method", variant: "destructive" });
        if (!followReservation) return toast({ title: "Please select a reservation option", variant: "destructive" });
        if (!followNextDate) return toast({ title: "Please select a next date", variant: "destructive" });
        if (!followNote.trim()) return toast({ title: "Please add a note", variant: "destructive" });
        // The dropdown only exposes the 2 top-level services, but
        // drm.followup_subservice_details.subservice_id (and the backend's
        // findSubservicesByIds lookup) require a real service_subservices id.
        // Transparently resolve to that service's first subservice so the
        // insert still succeeds with a valid row — the dashboard's Sub Type
        // column will just show that subservice's name.
        const chosenService = followServiceOptions.find((s: any) => s.id === followServiceId);
        const resolvedSubServiceId = chosenService?.subServices?.[0]?.id;
        if (!resolvedSubServiceId) return toast({ title: "Selected service has no configured subservice", variant: "destructive" });
        followupMutation.mutate({
            customerId: followCustomerId,
            subServiceId: resolvedSubServiceId,
            purpose: followPurpose,
            review: followReview,
            grade: followGrade,
            method: followMethod,
            reservationType: followReservation,
            note: followNote,
            nextDate: followNextDate,
        });
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-[1200px] w-[95vw] h-[95vh] overflow-y-auto bg-slate-50 border-slate-200 p-0 shadow-2xl rounded-[12px] custom-scrollbar text-slate-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                <DialogHeader className="p-4 border-b border-slate-200 bg-white shadow-sm sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogTitle className="text-[17px] text-slate-600 dark:text-zinc-300">Service Appointment</DialogTitle>
                </DialogHeader>

                <div className="p-6 md:p-8 flex flex-col gap-6 font-sans">
                    {/* Follow The Customer Section */}
                    <div className="bg-white p-6 rounded-[10px] shadow-sm border border-slate-200 flex flex-col gap-5 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Follow The Customer</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Customer</label>
                                {initialCustomerId ? (
                                    <div className="flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
                                        {initialCustomerName || "Selected customer"}
                                    </div>
                                ) : (
                                    <Select value={followCustomerId} onValueChange={setFollowCustomerId}>
                                        <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                            <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select a service customer"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.map((c: any) => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Service</label>
                                <Select value={followServiceId} onValueChange={setFollowServiceId}>
                                    <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Select a service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {followServiceOptions.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Purpose */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Purpose *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {FOLLOW_PURPOSE_OPTIONS.map((p) => (
                                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="followPurpose"
                                            className="accent-[#059669]"
                                            checked={followPurpose === p}
                                            onChange={() => setFollowPurpose(p)}
                                        />
                                        {p}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Review */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Review *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {FOLLOW_REVIEW_OPTIONS.map((r) => (
                                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="accent-[#059669]"
                                            checked={followReview.includes(r)}
                                            onChange={() => toggleFollowReview(r)}
                                        />
                                        {r}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Grade */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Grade *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {FOLLOW_GRADE_OPTIONS.map((g) => (
                                    <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="followGrade"
                                            className="accent-[#059669]"
                                            checked={followGrade === g}
                                            onChange={() => setFollowGrade(g)}
                                        />
                                        {g}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Method</label>
                                <Select value={followMethod} onValueChange={setFollowMethod}>
                                    <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Select a method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FOLLOW_METHOD_OPTIONS.map((m) => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Next Date *</label>
                                <Input
                                    type="datetime-local"
                                    value={followNextDate}
                                    onChange={(e) => setFollowNextDate(e.target.value)}
                                    className="w-full border-slate-200 shadow-sm dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        {/* Reservation */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Reservation *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {FOLLOW_RESERVATION_OPTIONS.map((r) => (
                                    <label key={r.code} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="followReservation"
                                            className="accent-[#059669]"
                                            checked={followReservation === r.code}
                                            onChange={() => setFollowReservation(r.code)}
                                        />
                                        {r.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Note *</label>
                            <textarea
                                value={followNote}
                                onChange={(e) => setFollowNote(e.target.value)}
                                className="w-full border border-slate-200 rounded-[6px] min-h-[70px] p-2.5 text-[13px] text-slate-600 resize-y shadow-sm bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                            />
                        </div>

                        <div>
                            <button
                                onClick={submitFollowup}
                                disabled={followupMutation.isPending}
                                className="bg-[#059669] hover:bg-[#047857] text-white px-8 py-2 rounded-[6px] text-[14px] font-bold shadow-sm transition-colors h-[40px] disabled:opacity-50 flex justify-center items-center gap-2">
                                {followupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Submit
                            </button>
                        </div>
                    </div>

                </div>
            </DialogContent>
        </Dialog>
    );
}
