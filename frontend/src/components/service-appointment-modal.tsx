import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { FollowupServiceOption } from "@/components/FollowCustomerServicesPanel";

const normalizeCode = (value: string) => value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

// Purpose/Grade verbatim-match the option sets FollowCustomerServicesPanel
// uses for the Sales flow (kept as separate local copies here since this
// form no longer renders that shared panel — see the restructure note below).
const PURPOSE_OPTIONS = [
    { code: "NEW_SELL", label: "New Sell" },
    { code: "INFORM", label: "Inform" },
    { code: "PAYMENT_RECOVERY", label: "Payment Recovery" },
    { code: "AB_PAYMENT", label: "Ab Payment" },
    { code: "PROJECT_DATA", label: "Project Data" },
    { code: "RENEW_SELL", label: "Renew Sell" },
    { code: "SEMINAR", label: "Seminar" },
    { code: "WEBINAR", label: "Webinar" },
    { code: "TRAINING", label: "Training" },
    { code: "ANYDESK", label: "Anydesk" },
];
const GRADE_OPTIONS = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];
// Full legacy "method" attribute list (webxl_attribute, reflid 8) the user
// asked to bring over verbatim. Excludes 2 rows from that same table ("B+",
// "A-") that are clearly misfiled Grade values sharing the bucket, not real
// methods — Grade already has its own field above. Codes are normalized
// (uppercase/underscore) so the subset that already existed as tracked
// dashboard method buckets (Mobile, Whatsapp, E-mail, Seminar, In-meeting,
// WH-Call, Out-meeting, Appointment, OL-Meeting) keep matching
// `upper(fsd.method)='...'` in dashboard.controller.ts; the rest are new and
// simply count toward totals without a dedicated named bucket.
const METHOD_OPTIONS = [
    { label: "Mobile", code: "MOBILE" },
    { label: "OnSite Visit", code: "ONSITE_VISIT" },
    { label: "Whatsapp", code: "WHATSAPP" },
    { label: "Group Whatsapp (Broadcast)", code: "GROUP_WHATSAPP_BROADCAST" },
    { label: "VAS Call", code: "VAS_CALL" },
    { label: "Facebook Post", code: "FACEBOOK_POST" },
    { label: "Facebook Message", code: "FACEBOOK_MESSAGE" },
    { label: "E-mail", code: "E_MAIL" },
    { label: "Talk Time", code: "TALK_TIME" },
    { label: "Webinar", code: "WEBINAR" },
    { label: "Seminar", code: "SEMINAR" },
    { label: "Copy Product", code: "COPY_PRODUCT" },
    { label: "New Product", code: "NEW_PRODUCT" },
    { label: "VM-Call", code: "VM_CALL" },
    { label: "VM-Met", code: "VM_MET" },
    { label: "ShowCase", code: "SHOWCASE" },
    { label: "Diagnose", code: "DIAGNOSE" },
    { label: "Reel Shoot + Edit", code: "REEL_SHOOT_EDIT" },
    { label: "TikTok", code: "TIKTOK" },
    { label: "Service Animation", code: "SERVICE_ANIMATION" },
    { label: "Ebay Course", code: "EBAY_COURSE" },
    { label: "Amazon Fba", code: "AMAZON_FBA" },
    { label: "LLC Reg Followup", code: "LLC_REG_FOLLOWUP" },
    { label: "W-Call", code: "W_CALL" },
    { label: "In-meeting", code: "IN_MEETING" },
    { label: "WH-Call", code: "WH_CALL" },
    { label: "Out-meeting", code: "OUT_MEETING" },
    { label: "Appointment", code: "APPOINTMENT" },
    { label: "OL-Meeting", code: "OL_MEETING" },
];

// Reservation option set verbatim-matches the "Follow The Customer" form in
// service-assistant-manager-dashboard.tsx.
// New required multi-select ("Review") field, positioned between Purpose and
// Grade per the confirmed screenshot layout. Options verbatim per user
// screenshot spelling (including "Happay").
const FOLLOW_REVIEW_OPTIONS = ["Report", "Start Rating", "Up Selling", "Rfq", "Products", "Follow Rate", "Sample", "Order", "Revenue", "Happay With Alibaba", "Happay With Webxl"];
// Every Review option opens an extra detail popup right under its checkbox
// once checked (per confirmed reference screenshots) — the exact popup
// contents differ by option, see renderReviewPopup below.
const REVIEW_OPTIONS_WITH_POPUP = new Set(FOLLOW_REVIEW_OPTIONS);
// Yes/No only, no extra count.
const REVIEW_YES_NO_ONLY = new Set(["Report", "Follow Rate", "Happay With Alibaba", "Happay With Webxl"]);
// Yes/No plus a single bare counter underneath.
const REVIEW_YES_NO_WITH_COUNT = new Set(["Sample", "Order", "Revenue"]);

function ReviewStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => onChange(Math.max(0, value - 1))}
                className="w-7 h-7 flex items-center justify-center bg-[#059669] hover:bg-[#047857] text-white rounded-[4px] text-sm font-bold shrink-0"
            >
                -
            </button>
            <input
                type="text"
                value={value}
                readOnly
                className="w-14 h-7 text-center border border-slate-200 rounded-[4px] text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="w-7 h-7 flex items-center justify-center bg-[#059669] hover:bg-[#047857] text-white rounded-[4px] text-sm font-bold shrink-0"
            >
                +
            </button>
        </div>
    );
}
const FOLLOW_RESERVATION_OPTIONS = [
    { label: "Mobile", code: "MOBILE" },
    { label: "On-Site Appointment", code: "ON_SITE_APPOINTMENT" },
    { label: "E-mail", code: "E_MAIL" },
    { label: "Vm Appointment", code: "VM_APPOINTMENT" },
    { label: "Fax", code: "FAX" },
    { label: "No Need", code: "NO_NEED" },
];

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
    // Restructured per explicit request to match the legacy layout: Service
    // is a single flat pick (one of the 2 allowed services), with its real
    // sub-services shown as plain checkboxes underneath (still required by
    // the backend — at least one real sub-service id per submission — but no
    // longer carrying their own individual Purpose/Grade/Method/Comment; those
    // are now asked once, shared across whichever sub-services get checked.
    const [selectedServiceId, setSelectedServiceId] = useState("");
    const [selectedSubserviceIds, setSelectedSubserviceIds] = useState<Set<string>>(new Set());
    const [purpose, setPurpose] = useState("");
    const [grade, setGrade] = useState("");
    const [method, setMethod] = useState("");
    const [followReview, setFollowReview] = useState<string[]>([]);
    // Only one Review popup is ever shown at a time — checking a new option
    // makes it the active one and closes whichever popup was open before
    // (the checked-state of earlier options is untouched, just their popup).
    const [activeReviewPopup, setActiveReviewPopup] = useState<string | null>(null);
    const toggleFollowReview = (r: string) => {
        setFollowReview((prev) => {
            if (prev.includes(r)) {
                setActiveReviewPopup((active) => (active === r ? null : active));
                return prev.filter((x) => x !== r);
            }
            setActiveReviewPopup(r);
            return [...prev, r];
        });
    };
    // Per-option extra detail captured by the popup that opens under each
    // Review option once checked (see REVIEW_OPTIONS_WITH_POPUP) — shape
    // varies by option (Yes/No, old/new counts, free text, per-tier counts,
    // or a single bare count), kept keyed by option name.
    const [reviewDetails, setReviewDetails] = useState<Record<string, any>>({});
    const updateReviewDetail = (option: string, patch: Record<string, any>) =>
        setReviewDetails((prev) => ({ ...prev, [option]: { ...prev[option], ...patch } }));
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

    // Service catalog for the flat "Service" dropdown below — same generic
    // endpoint the Sales "Follow The Customer" flow uses via
    // service-private-pool.tsx, but restricted here to just Alibaba
    // Membership + Alibaba Services — the Service Executive's Service Pool /
    // dashboard follow-up form should only ever offer those 2, not the other
    // 3 (Design Development, Domain Hosting, AI Services), per explicit
    // confirmation. Filtered by code (not name) to avoid the catalog-name-drift
    // bug that affected an earlier version of this restriction.
    const SERVICE_EXECUTIVE_ALLOWED_CODES = new Set(["ALIBABA_MEMBERSHIP", "ALIBABA_SERVICES"]);
    const { data: servicesCatalogResponse } = useQuery<{ success: boolean; items: FollowupServiceOption[] }>({
        queryKey: ["/api/sales/services"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/sales/services");
            if (!res.ok) throw new Error("Failed to fetch services");
            return res.json();
        },
        enabled: open,
    });
    const followupServices = (servicesCatalogResponse?.items || []).filter((s) =>
        SERVICE_EXECUTIVE_ALLOWED_CODES.has(normalizeCode(s.code)),
    );

    const resetFollowupForm = () => {
        setFollowCustomerId(initialCustomerId ?? "");
        setSelectedServiceId("");
        setSelectedSubserviceIds(new Set());
        setPurpose("");
        setGrade("");
        setMethod("");
        setFollowReview([]);
        setReviewDetails({});
        setActiveReviewPopup(null);
        setFollowReservation("");
        setFollowNextDate("");
        setFollowNote("");
    };

    const selectedService = followupServices.find((s) => s.id === selectedServiceId);

    const handleSelectService = (serviceId: string) => {
        setSelectedServiceId(serviceId);
        // Switching service invalidates whatever sub-services were ticked
        // under the previous one.
        setSelectedSubserviceIds(new Set());
    };

    const handleToggleSubservice = (subserviceId: string, checked: boolean) => {
        setSelectedSubserviceIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(subserviceId);
            else next.delete(subserviceId);
            return next;
        });
    };

    const followupMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("POST", "/api/service/executive/follow-ups", payload);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (errData.error === "ALL_SERVICES_LOCKED") {
                    const names = (errData.locked || []).map((l: any) => `${l.name} (${l.reason})`).join(", ");
                    throw new Error(`All selected services are currently locked: ${names}`);
                }
                throw new Error(errData.error || "Failed to submit follow-up");
            }
            return res.json();
        },
        onSuccess: (data: any) => {
            if (data?.locked?.length) {
                const names = data.locked.map((l: any) => `${l.name} (${l.reason})`).join(", ");
                toast({ title: "Follow-up saved with some services skipped", description: names });
            } else {
                toast({ title: "Follow-up submitted successfully" });
            }
            // Feeds service-executive-dashboard.tsx's "Follow Up Details" table.
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/followups?pageSize=50"] });
            resetFollowupForm();
        },
        onError: (err: any) => {
            toast({ title: "Failed to submit follow-up", description: err.message, variant: "destructive" });
        }
    });

    const submitFollowup = () => {
        if (!followCustomerId) return toast({ title: "Please select a customer", variant: "destructive" });
        if (!selectedServiceId) return toast({ title: "Please select a service", variant: "destructive" });
        if (selectedSubserviceIds.size === 0) return toast({ title: "Please select at least one sub-service", variant: "destructive" });
        if (!purpose) return toast({ title: "Please select a purpose", variant: "destructive" });
        if (!grade) return toast({ title: "Please select a grade", variant: "destructive" });
        if (!method) return toast({ title: "Please select a method", variant: "destructive" });
        if (!followReview.length) return toast({ title: "Please select at least one review option", variant: "destructive" });
        if (!followReservation) return toast({ title: "Please select a reservation option", variant: "destructive" });
        if (!followNextDate) return toast({ title: "Please select a next date", variant: "destructive" });
        if (!followNote.trim()) return toast({ title: "Please add a note", variant: "destructive" });

        // Purpose/Grade/Method are now asked once for the whole submission
        // (see restructure note above) rather than per sub-service — the same
        // 3 values, plus the Note as the backend's required per-detail
        // "comment" (this flattened form has no separate Comment field),
        // are copied onto every ticked sub-service's detail row.
        const noteTrimmed = followNote.trim();
        const detailPayloads = Array.from(selectedSubserviceIds).map((subServiceId) => ({
            subServiceId,
            purpose,
            grade,
            method,
            comment: noteTrimmed,
            note: noteTrimmed,
        }));

        followupMutation.mutate({
            customerId: followCustomerId,
            subServiceDetails: detailPayloads,
            review: followReview,
            reservationType: followReservation,
            note: followNote,
            nextDate: followNextDate,
            method,
        });
    };

    const renderReviewPopup = (option: string) => {
        const detail = reviewDetails[option] || {};
        if (REVIEW_YES_NO_ONLY.has(option)) {
            return (
                <div className="flex items-center gap-4">
                    {["Yes", "No"].map((v) => (
                        <label key={v} className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                            <input
                                type="radio"
                                name={`review-${option}-yn`}
                                className="accent-[#059669]"
                                checked={detail.value === v}
                                onChange={() => updateReviewDetail(option, { value: v })}
                            />
                            {v}
                        </label>
                    ))}
                </div>
            );
        }
        if (REVIEW_YES_NO_WITH_COUNT.has(option)) {
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        {["Yes", "No"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                                <input
                                    type="radio"
                                    name={`review-${option}-yn`}
                                    className="accent-[#059669]"
                                    checked={detail.value === v}
                                    onChange={() => updateReviewDetail(option, { value: v })}
                                />
                                {v}
                            </label>
                        ))}
                    </div>
                    <ReviewStepper value={detail.count ?? 0} onChange={(v) => updateReviewDetail(option, { count: v })} />
                </div>
            );
        }
        if (option === "Start Rating" || option === "Rfq") {
            return (
                <div className="flex flex-col gap-3">
                    <div>
                        <div className="text-[13px] font-medium text-slate-600 dark:text-zinc-300 mb-1">Old</div>
                        <ReviewStepper value={detail.old ?? 0} onChange={(v) => updateReviewDetail(option, { old: v })} />
                    </div>
                    <div>
                        <div className="text-[13px] font-medium text-slate-600 dark:text-zinc-300 mb-1">New</div>
                        <ReviewStepper value={detail.new ?? 0} onChange={(v) => updateReviewDetail(option, { new: v })} />
                    </div>
                </div>
            );
        }
        if (option === "Up Selling") {
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        {["Yes", "No"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 cursor-pointer text-[13px]">
                                <input
                                    type="radio"
                                    name="review-upselling-yn"
                                    className="accent-[#059669]"
                                    checked={detail.value === v}
                                    onChange={() => updateReviewDetail(option, { value: v })}
                                />
                                {v}
                            </label>
                        ))}
                    </div>
                    <textarea
                        placeholder="type..."
                        value={detail.text ?? ""}
                        onChange={(e) => updateReviewDetail(option, { text: e.target.value })}
                        className="w-40 h-16 border border-slate-200 rounded-[4px] p-1.5 text-[13px] resize-y dark:border-zinc-700 dark:bg-zinc-900"
                    />
                </div>
            );
        }
        if (option === "Products") {
            return (
                <div className="flex flex-col gap-3">
                    {["Basic", "Potential", "Top", "Super"].map((tier) => {
                        const tierKey = tier.toLowerCase();
                        return (
                            <div key={tier}>
                                <div className="text-[13px] font-medium text-slate-600 dark:text-zinc-300 mb-1">{tier}</div>
                                <ReviewStepper value={detail[tierKey] ?? 0} onChange={(v) => updateReviewDetail(option, { [tierKey]: v })} />
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
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

                        <div className="grid grid-cols-1 gap-5">
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
                        </div>

                        {/* Purpose */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Purpose *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {PURPOSE_OPTIONS.map((p) => (
                                    <label key={p.code} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="purpose"
                                            className="accent-[#059669]"
                                            checked={purpose === p.code}
                                            onChange={() => setPurpose(p.code)}
                                        />
                                        {p.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Review */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Review *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {FOLLOW_REVIEW_OPTIONS.map((r) => (
                                    <div key={r} className="relative">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="accent-[#059669]"
                                                checked={followReview.includes(r)}
                                                onChange={() => toggleFollowReview(r)}
                                            />
                                            {r}
                                        </label>
                                        {REVIEW_OPTIONS_WITH_POPUP.has(r) && followReview.includes(r) && activeReviewPopup === r && (
                                            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-[6px] shadow-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 min-w-[160px]">
                                                {renderReviewPopup(r)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Grade */}
                        <div className="flex flex-col md:flex-row md:items-start gap-2 text-[13px]">
                            <span className="text-[#059669] font-bold w-28 shrink-0 dark:text-zinc-400">Grade *</span>
                            <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300">
                                {GRADE_OPTIONS.map((g) => (
                                    <label key={g} className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="grade"
                                            className="accent-[#059669]"
                                            checked={grade === g}
                                            onChange={() => setGrade(g)}
                                        />
                                        {g}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Service + Method */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Service *</label>
                                <Select value={selectedServiceId} onValueChange={handleSelectService}>
                                    <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {followupServices.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Method *</label>
                                <Select value={method} onValueChange={setMethod}>
                                    <SelectTrigger className="w-full border-slate-200 shadow-sm text-slate-500 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {METHOD_OPTIONS.map((m) => (
                                            <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Sub-services of the chosen Service */}
                        {selectedService && (selectedService.subServices?.length ?? 0) > 0 && (
                            <div className="rounded-md border p-3 bg-card shadow-sm dark:border-zinc-800">
                                <p className="text-[13px] font-bold text-slate-600 dark:text-zinc-300 mb-2">
                                    {selectedService.name} - Sub Services *
                                </p>
                                <div className="flex flex-wrap gap-4 text-slate-600 dark:text-zinc-300 text-[13px]">
                                    {selectedService.subServices!.map((sub) => (
                                        <label key={sub.id} className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="accent-[#059669]"
                                                checked={selectedSubserviceIds.has(sub.id)}
                                                onChange={(e) => handleToggleSubservice(sub.id, e.target.checked)}
                                            />
                                            {sub.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Next Date *</label>
                                <input
                                    type="datetime-local"
                                    value={followNextDate}
                                    onChange={(e) => setFollowNextDate(e.target.value)}
                                    className="w-full h-9 rounded-md border border-slate-200 shadow-sm px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[13px] font-bold text-slate-600 dark:text-zinc-300">Note *</label>
                                <textarea
                                    value={followNote}
                                    onChange={(e) => setFollowNote(e.target.value)}
                                    className="w-full border border-slate-200 rounded-[6px] min-h-[36px] p-2.5 text-[13px] text-slate-600 resize-y shadow-sm bg-white dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                                />
                            </div>
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
