import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient, apiRequestJson, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users, Repeat, Tag, Target, Clock, Wallet, CheckCircle, ChevronRight, Activity, Building2, Briefcase, ChevronLeft, Plug, User, Eye, UserPlus, FileText, CloudDownload, Search, Pencil, Loader2, Trash2, Plus
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function ItManagerDashboard() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const { data: domains = [] } = useQuery<any[]>({
        queryKey: ["/api/it/domains"],
    });

    const { data: backups = [] } = useQuery<any[]>({
        queryKey: ["/api/it/backups"],
    });

    const { data: itServers = [] } = useQuery<any[]>({
        queryKey: ["/api/it/servers"],
    });

    const { data: itRegistries = [] } = useQuery<any[]>({
        queryKey: ["/api/it/registries"],
    });

    const { data: itHostingPackages = [] } = useQuery<any[]>({
        queryKey: ["/api/it/hosting-packages"],
    });

    const [backupForm, setBackupForm] = useState({
        domainId: "",
        backupType: "Full",
        backupUrl: "",
        details: "",
    });

    function extractErrorMessage(err: any, fallback: string): string {
        const raw = String(err?.message ?? "");
        const idx = raw.indexOf(":");
        const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
        try {
            const parsed = JSON.parse(body);
            if (parsed?.error) return String(parsed.error);
        } catch {
            /* not JSON */
        }
        return body || fallback;
    }

    function daysLeft(dateStr: string | null | undefined): string {
        if (!dateStr || isNaN(new Date(dateStr).getTime())) return "N/A";
        const diff = new Date(dateStr).getTime() - Date.now();
        const days = Math.ceil(diff / 86_400_000);
        if (days < 0) return `Expired (${Math.abs(days)}d ago)`;
        return `${days} days left`;
    }

    const createBackupMutation = useMutation({
        mutationFn: async (payload: typeof backupForm) => {
            return apiRequestJson("POST", "/api/it/backups", payload);
        },
        onSuccess: () => {
            toast({ title: "Backup record added successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
            setDomainBackupModalOpen(false);
            setBackupForm({
                domainId: "",
                backupType: "Full",
                backupUrl: "",
                details: "",
            });
        },
        onError: (err) => {
            toast({ title: extractErrorMessage(err, "Failed to create backup"), variant: "destructive" });
        }
    });

    const deleteBackupMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiRequestJson("DELETE", `/api/it/backups/${id}`);
        },
        onSuccess: () => {
            toast({ title: "Backup record deleted" });
            queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
        },
        onError: (err) => {
            toast({ title: extractErrorMessage(err, "Failed to delete backup"), variant: "destructive" });
        }
    });

    const [activeDomainTab, setActiveDomainTab] = useState("3-month");
    const [domainStatsScope, setDomainStatsScope] = useState<"ld" | "all">("ld");
    const [expireDomainsScope, setExpireDomainsScope] = useState<"1mh" | "3mh" | "6mh" | "12mh">("1mh");
    const [activeView, setActiveView] = useState("dashboard");
    const [domainListSearch, setDomainListSearch] = useState("");
    const [domainListFilters, setDomainListFilters] = useState({ company: "", person: "", contact: "", email: "" });
    const [backupSearch, setBackupSearch] = useState("");
    const [selectedQuotationItem, setSelectedQuotationItem] = useState<any>(null);
    const [selectedDomainItem, setSelectedDomainItem] = useState<any>(null);
    const [activeHistoryTab, setActiveHistoryTab] = useState("contact");
    const [whatsappMsg, setWhatsappMsg] = useState("");
    const [gmDocOpen, setGmDocOpen] = useState(false);
    const [gmBvSubmitOpen, setGmBvSubmitOpen] = useState(false);
    const [domainBackupModalOpen, setDomainBackupModalOpen] = useState(false);
    const [showAdditional, setShowAdditional] = useState(false);
    const [duplicateResults, setDuplicateResults] = useState<any[] | null>(null);
    const [followupServices, setFollowupServices] = useState<string[]>([]);
    const [followupReservation, setFollowupReservation] = useState("");
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    const [selectedActionRow, setSelectedActionRow] = useState<any>(null);
    const [leaveAppDialogOpen, setLeaveAppDialogOpen] = useState(false);
    const [selectedLeaveRow, setSelectedLeaveRow] = useState<{ no: number, name: string } | null>(null);
    const [renewDomainOpen, setRenewDomainOpen] = useState(false);
    const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [activeQuarter, setActiveQuarter] = useState("q4");
    const [followupOpen, setFollowupOpen] = useState(false);

    // ==================== Real data wiring ====================
    const queryClient = useQueryClient();

    // Real IT domain/hosting registry (server/it-assets-routes.ts -> GET /api/it/domains).
    // Used for the Domain Report chart and as the renewal source for Invoice/Quotation creation.
    const { data: realDomains = [] } = useQuery<any[]>({ queryKey: ["/api/it/domains"] });

    // Real overtime submissions, manager-wide (same endpoint/pattern used by
    // software-manager-dashboard.tsx and service-overtime.tsx).
    const { data: overtimeRecords = [], isLoading: isOvertimeLoading } = useQuery<any[]>({ queryKey: ["/api/overtime/all"] });
    const [overtimeSearch, setOvertimeSearch] = useState("");

    const approveOvertimeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/overtime/${id}/approve`, {});
            if (!res.ok) throw new Error("Failed to approve overtime");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Overtime Approved" });
            queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] });
            setActionDialogOpen(false);
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const domainFollowupMutation = useMutation({
        mutationFn: async ({ id, services, reservation }: { id: string; services: string[]; reservation: string }) => {
            const res = await apiRequest("POST", `/api/it/domains/${id}/followup`, { services, reservation });
            if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save follow-up");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Follow-up saved" });
            setFollowupOpen(false);
            setFollowupServices([]);
            setFollowupReservation("");
            setShowAdditional(false);
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    const rejectOvertimeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/overtime/${id}/reject`, { reason: "Rejected by IT Manager" });
            if (!res.ok) throw new Error("Failed to reject overtime");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Overtime Rejected" });
            queryClient.invalidateQueries({ queryKey: ["/api/overtime/all"] });
            setActionDialogOpen(false);
        },
        onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });

    // Real invoices for the "Monthly Invoices" box — current calendar month, company-wide.
    // Reuses the exact same /api/reports/invoice-entries contract as invoice-report.tsx.
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const [invoicePageSize, setInvoicePageSize] = useState("10");
    const [invoicePage, setInvoicePage] = useState(1);
    const monthRange = useMemo(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
            to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
        };
    }, []);

    const { data: monthlyInvoicesData, isLoading: isInvoicesLoading } = useQuery<{ data: any[]; total: number; totalAmount: number }>({
        queryKey: ["/api/reports/invoice-entries", "it-manager-monthly", invoicePage, invoicePageSize, invoiceSearch, monthRange.from],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", String(invoicePage));
            params.set("pageSize", invoicePageSize);
            params.set("from", monthRange.from);
            params.set("to", monthRange.to);
            if (invoiceSearch) params.set("company", invoiceSearch);
            const res = await apiRequest("GET", `/api/reports/invoice-entries?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load invoices");
            return res.json();
        },
    });
    const monthlyInvoices = monthlyInvoicesData?.data || [];
    const monthlyInvoicesTotal = monthlyInvoicesData?.total || 0;

    // Real invoice/quotation creation — reuses the exact existing Account invoice contract
    // (shared/schema.ts insertInvoiceSchema + server/account-routes.ts POST /api/account/invoices),
    // the same contract already used by client/src/pages/sales/create-invoice.tsx.
    const { data: nextInvoiceInfo } = useQuery<{ invoiceNumber: string }>({ queryKey: ["/api/account/invoices/next-number"] });
    const [renewalDomainId, setRenewalDomainId] = useState("");
    const [renewalCustomerName, setRenewalCustomerName] = useState("");
    const [invoiceIntent, setInvoiceIntent] = useState<"quotation" | "invoice">("invoice");
    const [qDetail, setQDetail] = useState("");
    const [qUnitPrice, setQUnitPrice] = useState("0");
    const [qQuantity, setQQuantity] = useState("1");
    const [qGstPercent, setQGstPercent] = useState("0");
    const [qDiscountType, setQDiscountType] = useState<"percentage" | "amount">("percentage");
    const [qDiscountValue, setQDiscountValue] = useState("0");
    const [qNote, setQNote] = useState("");
    const [lastCreatedInvoice, setLastCreatedInvoice] = useState<any>(null);

    const selectedRenewalDomain = (realDomains as any[]).find((d: any) => d.id === renewalDomainId) || null;

    const qSubAmount = (parseFloat(qUnitPrice) || 0) * (parseFloat(qQuantity) || 0);
    const qTax = (qSubAmount * (parseFloat(qGstPercent) || 0)) / 100;
    const qTotalAmount = qSubAmount + qTax;
    const qDiscountAmount = qDiscountType === "percentage" ? (qTotalAmount * (parseFloat(qDiscountValue) || 0)) / 100 : (parseFloat(qDiscountValue) || 0);
    const qGrandTotal = Math.max(qTotalAmount - qDiscountAmount, 0);
    const qPkrTotal = qGrandTotal * 280;

    const createDomainInvoiceMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("POST", "/api/account/invoices", payload);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}) as any);
                throw new Error(body?.error || "Failed to save");
            }
            return res.json();
        },
        onSuccess: (invoice: any) => {
            setLastCreatedInvoice(invoice);
            toast({
                title: invoiceIntent === "quotation" ? "Quotation Saved" : "Invoice Created",
                description: `${invoice?.invoiceNumber || ""} has been saved.`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/reports/invoice-entries"] });
            queryClient.invalidateQueries({ queryKey: ["/api/account/invoices/next-number"] });
            setActiveView("domain-invoice");
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });

    const resetInvoiceForm = () => {
        setRenewalDomainId("");
        setQDetail("");
        setQUnitPrice("0");
        setQQuantity("1");
        setQGstPercent("0");
        setQDiscountType("percentage");
        setQDiscountValue("0");
        setQNote("");
    };

    const handleOpenInvoiceForm = (intent: "quotation" | "invoice", domain?: { company?: string; domain?: string }) => {
        setInvoiceIntent(intent);
        resetInvoiceForm();
        setRenewalCustomerName(domain?.company || "");
        setQDetail(domain?.domain ? `Domain Renewal (${domain.domain})` : "");
        setActiveView("domain-quotation");
    };

    const handleSaveDomainInvoice = () => {
        if (!renewalCustomerName.trim()) {
            toast({ title: "Company name required", description: "Enter the customer/company name before saving.", variant: "destructive" });
            return;
        }
        const items = [{
            detail: qDetail || (selectedRenewalDomain ? `Domain Renewal (${selectedRenewalDomain.domainName})` : "Domain / Hosting Renewal"),
            unitPrice: parseFloat(qUnitPrice) || 0,
            quantity: parseFloat(qQuantity) || 0,
            total: qSubAmount,
        }];
        createDomainInvoiceMutation.mutate({
            customerName: renewalCustomerName.trim(),
            items: JSON.stringify(items),
            subtotal: qSubAmount.toFixed(2),
            tax: qTax.toFixed(2),
            total: qGrandTotal.toFixed(2),
            status: invoiceIntent === "quotation" ? "Draft" : "Pending",
            invoiceNumber: nextInvoiceInfo?.invoiceNumber || `INV-${Math.floor(Math.random() * 100000)}`,
            notes: qNote || undefined,
        });
    };
    // ==================== End real data wiring ====================

    // Phase 10 — derived from the real /api/it/domains query (was hardcoded
    // mock data). "Expired" = expiryDate already in the past; "3-month" =
    // expiring within the next 90 days. Each row keeps the full source domain
    // under `raw` so actions (View Detail, future Edit) can use real data.
    const domainRowsWithDays = domains
        .filter((d: any) => d.expiryDate)
        .map((d: any) => {
            const day = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86_400_000);
            return {
                id: d.id,
                company: d.company || "—",
                domain: d.domainName,
                day,
                expire: new Date(d.expiryDate).toLocaleDateString("en-GB"),
                raw: d,
            };
        });

    const domainDetailsData = domainRowsWithDays
        .filter((d) => d.day < 0)
        .sort((a, b) => b.day - a.day);

    const threeMonthExpireData = domainRowsWithDays
        .filter((d) => d.day >= 0 && d.day <= 90)
        .sort((a, b) => a.day - b.day);

    const displayedDomains = activeDomainTab === "3-month" ? threeMonthExpireData : domainDetailsData;

    // "LD" (Live Domains) scopes the 4 stat cards to domains that haven't
    // expired yet; "All" counts every domain regardless of expiry status.
    const liveDomainsCount = domainRowsWithDays.filter((d) => d.day >= 0).length;
    const expiredDomainsCount = domainDetailsData.length;
    const expiringSoonCount = threeMonthExpireData.length;
    const totalDomainStat = domainStatsScope === "ld" ? liveDomainsCount : domains.length;
    const expiredDomainStat = domainStatsScope === "ld" ? 0 : expiredDomainsCount;

    // "Activities" widget below (donut + progress bars) was hardcoded fake
    // numbers. There's no "project"/"task" concept on the IT side, so this
    // reuses the real domain-expiry breakdown already computed above: every
    // domain is either already expired (Delay), expiring within 3 months
    // (Pending), or neither (Free). "Complete" has no domain equivalent, so
    // it honestly stays 0 rather than showing an invented number.
    const activitiesFreeCount = Math.max(0, domains.length - expiringSoonCount - expiredDomainsCount);
    const activitiesData = [
        { name: 'Complete', value: 0, color: '#f1f5f9' },
        { name: 'Pending', value: expiringSoonCount, color: '#34d399' },
        { name: 'Delay', value: expiredDomainsCount, color: '#64748b' },
        { name: 'Free', value: activitiesFreeCount, color: '#1e293b' },
    ];
    const activitiesPct = (n: number) => (domains.length > 0 ? Math.round((n / domains.length) * 100) : 0);

    // "Expire Domains" table below was a hardcoded mock array (fake domains,
    // fake dollar figures) with no backing data source. Domain/date columns
    // now come from the real /api/it/domains query; the D/H$, T$, O$R, O/Pkr,
    // N$R, N/Pkr and Inv/Rep columns have no equivalent real data yet (no
    // renewal-pricing/invoice tracking exists for domains), so they render
    // "—" rather than fabricated numbers.
    const expireDomainsWindowDays: Record<string, number> = { "1mh": 30, "3mh": 90, "6mh": 180, "12mh": 365 };
    const expireDomainsRows = domainRowsWithDays
        .filter((d) => d.day >= 0 && d.day <= expireDomainsWindowDays[expireDomainsScope])
        .sort((a, b) => a.day - b.day)
        .map((d, idx) => ({
            no: idx + 1,
            domain: d.domain,
            type: "domain",
            day: d.day,
            regDate: d.raw.activationDate ? new Date(d.raw.activationDate).toLocaleDateString("en-GB") : "—",
            firstDate: d.raw.createdAt ? new Date(d.raw.createdAt).toLocaleDateString("en-GB") : "—",
            expDate: d.expire,
        }));

    if (activeView === "leave-application") {
        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                </div>

                <div className="mb-6 px-2">
                    <h2 className="text-[18px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 uppercase tracking-tight">PENDING LEAVE / <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">FORMS</span></h2>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden dark:bg-zinc-900">
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex flex-col gap-1.5 align-start">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                <div className="flex items-center gap-2">
                                    <Select defaultValue="10">
                                        <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                            </div>
                            <div className="flex flex-col gap-1 align-start self-end">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 pl-4 text-left dark:text-zinc-400">No</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Purpose</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Type</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Alternative</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Monthly Leaves</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Monthly Half Leaves</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Day</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Time</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Start</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">End</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Create</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[
                                        { no: 258, name: 'Shakeel Sikandar', purpose: 'Urgent Work', type: 'Half', alt: 'Sana e Mustafa', detail: 'Urgent Work', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '02-08-2025', create: '04-08-2025 10:08:AM' },
                                        { no: 428, name: 'Shakeel Sikandar', purpose: 'Urgent Work', type: 'Half', alt: '', detail: 'Urgent Work', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '14-04-2025', create: '14-04-2025 10:04:AM' },
                                        { no: 680, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Half', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '07-12-2024', create: '10-12-2024 10:12:AM' },
                                        { no: 848, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Half', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '0.5', day: 'half day', time: '', start: '01-01-1970', end: '04-09-2024', create: '04-09-2024 01:09:PM' },
                                        { no: 884, name: 'Shakeel Sikandar', purpose: 'Unhealthy', type: 'Full', alt: 'Shakeel Sikandar', detail: 'unhealthy', monthly: '0', monthlyHalf: '1', day: '1', time: '', start: '01-01-1970', end: '15-08-2024', create: '16-08-2024 09:08:AM' },
                                    ].map((row, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">{row.no}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.name}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.purpose}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.type}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.alt}</TableCell>
                                            <TableCell className="text-[13px] font-medium py-4">
                                                <span className={row.detail === 'Urgent Work' ? 'bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold' : 'text-slate-600 dark:text-slate-300'}>{row.detail}</span>
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.monthly}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.monthlyHalf}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.day}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.time}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.start}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.end}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums whitespace-nowrap dark:text-zinc-300">{row.create}</TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div
                                                    className="h-6 w-6 rounded-full border-[1.5px] border-[#059669] flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800"
                                                    onClick={() => { setSelectedLeaveRow({ no: row.no, name: row.name }); setLeaveAppDialogOpen(true); }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                            <span className="text-[13.5px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Showing 1 to 5 of 5 entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Application Modal */}
                <Dialog open={leaveAppDialogOpen} onOpenChange={setLeaveAppDialogOpen}>
                    <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
                            <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold tracking-tight">Application</h3>
                            <button onClick={() => setLeaveAppDialogOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Name</label>
                                <Input
                                    disabled
                                    value={selectedLeaveRow?.name || 'Shakeel Sikandar'}
                                    className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Alibaba</label>
                                <Select defaultValue="choose">
                                    <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                        <SelectValue placeholder="Choose..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-2 border-b border-slate-100 dark:border-zinc-800">
                                            <Input placeholder="" className="h-8 border-slate-200 text-[13px] dark:border-zinc-800" />
                                        </div>
                                        <div className="py-1">
                                            <div className="px-3 py-1.5 text-[13px] font-semibold text-slate-700 dark:text-zinc-400">Alibaba</div>
                                            <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                            <SelectItem value="approved" className="text-white font-bold bg-[#059669] focus:bg-[#059669] focus:text-white data-[highlighted]:bg-[#059669] data-[highlighted]:text-white">Approved</SelectItem>
                                            <SelectItem value="cancel" className="text-slate-700 font-medium dark:text-zinc-400">Cancel</SelectItem>
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 dark:border-zinc-800">
                            <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setLeaveAppDialogOpen(false)}>
                                Close
                            </button>
                            <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors" onClick={() => setLeaveAppDialogOpen(false)}>
                                Save
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    if (activeView === "overtime") {
        // Real overtime submissions — same /api/overtime/all endpoint + field mapping already used by
        // software-manager-dashboard.tsx and service-overtime.tsx.
        const filteredOvertimeRows = (overtimeRecords as any[]).filter((row: any) => {
            if (!overtimeSearch) return true;
            const haystack = [row.userName, row.taskTitle, row.taskDetails, row.reason, row.status]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(overtimeSearch.toLowerCase());
        });

        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden dark:bg-zinc-900">
                    <div className="py-4 px-6 border-b border-slate-50 dark:border-zinc-800">
                        <h2 className="text-[15px] font-bold text-[#475569] uppercase dark:text-zinc-400">OVERTIME</h2>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Show</span>
                                <Select defaultValue="10">
                                    <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">entries</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Search:</span>
                                <Input value={overtimeSearch} onChange={(e) => setOvertimeSearch(e.target.value)} className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 pl-4 w-12 dark:text-zinc-400">#</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Name</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Task</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Time</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Task Detail</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Status</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 dark:text-zinc-400">Create</TableHead>
                                        <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-center pr-4 dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isOvertimeLoading ? (
                                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-slate-400 text-[13px]">Loading...</TableCell></TableRow>
                                    ) : filteredOvertimeRows.length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="text-center py-6 text-slate-400 text-[13px]">No overtime records found.</TableCell></TableRow>
                                    ) : filteredOvertimeRows.map((row: any, index: number) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">{index + 1}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.userName || "Employee"}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">{row.taskTitle || "-"}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.timeSpent ?? "-"}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 max-w-[200px] truncate dark:text-zinc-300" title={row.taskDetails || row.reason}>{row.taskDetails || row.reason || ""}</TableCell>
                                            <TableCell className="py-4">
                                                <span className={cn(
                                                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                                                    row.status === "Approved" ? "bg-emerald-50 text-emerald-600" : row.status === "Rejected" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                                                )}>{row.status || "Pending"}</span>
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 tabular-nums dark:text-zinc-300">{row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}</TableCell>
                                            <TableCell className="py-4 text-center pr-4">
                                                <div
                                                    className="flex justify-center flex-col items-center cursor-pointer"
                                                    onClick={() => {
                                                        setSelectedActionRow(row);
                                                        setActionDialogOpen(true);
                                                    }}
                                                >
                                                    <Plug className="h-4 w-4 text-slate-500 hover:text-slate-800 transition-colors dark:text-zinc-400" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 gap-4">
                            <span className="text-[13px] text-slate-500 font-medium dark:text-zinc-400">Showing 1 to {filteredOvertimeRows.length} of {filteredOvertimeRows.length} entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>

                        {/* Overtime Action Dialog — approve/reject via server/overtime-routes.ts PATCH /api/overtime/:id/approve|reject */}
                        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
                            <DialogContent className="sm:max-w-[450px]">
                                <DialogHeader className="border-b border-slate-50 pb-4 dark:border-zinc-800">
                                    <DialogTitle className="text-[16px] font-bold text-slate-600 dark:text-zinc-300">Overtime</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Name</label>
                                        <Input disabled value={selectedActionRow?.userName || "Employee"} className="bg-slate-50/50 dark:bg-zinc-900 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Task</label>
                                        <Input disabled value={selectedActionRow?.taskTitle || ""} className="bg-slate-50/50 dark:bg-zinc-900 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Reason / Detail</label>
                                        <textarea disabled rows={3} value={selectedActionRow?.taskDetails || selectedActionRow?.reason || ""} className="w-full bg-slate-50/50 dark:bg-zinc-900 border border-slate-200 rounded p-2 text-[13px] text-slate-600 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Time Requested</label>
                                        <Input disabled value={`${selectedActionRow?.timeSpent ?? "-"}`} className="bg-slate-50/50 dark:bg-zinc-900 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[13px] font-semibold text-slate-500 dark:text-zinc-400">Status</label>
                                        <Input disabled value={selectedActionRow?.status || "Pending"} className="bg-slate-50/50 dark:bg-zinc-900 text-slate-600 h-9 border-slate-200 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                </div>

                                <DialogFooter className="sm:justify-end gap-2 pt-2 border-t border-slate-50 dark:border-zinc-800">
                                    <DialogClose asChild>
                                        <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-bold rounded transition-colors dark:bg-zinc-900 dark:text-zinc-400">
                                            Close
                                        </button>
                                    </DialogClose>
                                    {selectedActionRow?.status === "Pending" && (
                                        <>
                                            <button
                                                onClick={() => rejectOvertimeMutation.mutate(selectedActionRow.id)}
                                                disabled={rejectOvertimeMutation.isPending}
                                                className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold rounded transition-colors disabled:opacity-60"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => approveOvertimeMutation.mutate(selectedActionRow.id)}
                                                disabled={approveOvertimeMutation.isPending}
                                                className="px-4 py-2 bg-[#52b788] hover:bg-[#40916c] text-white text-[13px] font-bold rounded transition-colors disabled:opacity-60"
                                            >
                                                Approve
                                            </button>
                                        </>
                                    )}
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-backup") {
        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                {/* Header Navbar */}
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                </div>

                <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden overflow-hidden text-slate-700 dark:bg-zinc-900 dark:text-zinc-400">
                    <div className="py-4 px-6 border-b border-slate-50 flex items-center justify-between dark:border-zinc-800">
                        <h2 className="text-[16px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">DOMAIN BACKUP</h2>
                    </div>

                    <div className="p-6">
                        <button onClick={() => setDomainBackupModalOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold px-4 py-2.5 rounded shadow-sm transition-colors mb-6 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#059669]/50">
                            Add New Backup
                        </button>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex flex-col gap-1.5 align-start">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                <div className="flex items-center gap-2">
                                    <Select defaultValue="10">
                                        <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                            </div>

                            <div className="flex flex-col gap-1 align-start self-end">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-48 border-slate-200 dark:border-zinc-800" />
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 pl-4 w-12 text-left dark:text-zinc-400">No#</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Person</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Domain</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Web Type</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Url</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Day</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3.5 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">01</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Afaq Ali</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Urgent Work</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Full</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">Tuseef Abbas</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 dark:text-zinc-300">For Exams</TableCell>
                                        <TableCell className="text-[13px] font-medium text-slate-600 py-4 whitespace-nowrap dark:text-zinc-300">26-05-2023 11:00 AM</TableCell>
                                        <TableCell className="py-4 text-center items-center justify-center flex">
                                            <button className="text-white bg-[#ef4444]/90 hover:bg-[#ef4444] rounded flex items-center justify-center h-6 w-6 transition flex-shrink-0 shadow-sm outline-none mx-auto dark:hover:bg-zinc-800">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                            <span className="text-[13.5px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Showing 1 to 1 of 1 entries</span>
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800">Previous</button>
                                <button className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold pointer-events-none">1</button>
                                <button className="px-3.5 py-1.5 bg-white text-slate-400 text-[13px] font-medium hover:bg-slate-50 transition-colors pointer-events-none opacity-50 border-l border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800">Next</button>
                            </div>
                        </div>

                        {/* Add Leave / Backup Modal */}
                        <Dialog open={domainBackupModalOpen} onOpenChange={setDomainBackupModalOpen}>
                            <DialogContent className="sm:max-w-[550px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white dark:bg-zinc-900">
                                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between m-0 dark:border-zinc-800">
                                    <DialogTitle className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold m-0 p-0 tracking-tight">Add Leave</DialogTitle>
                                    <DialogClose className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer absolute right-4 top-4 dark:hover:bg-zinc-800">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        <span className="sr-only">Close</span>
                                    </DialogClose>
                                </DialogHeader>

                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Domain:</label>
                                            <Input placeholder="Domian name" className="h-10 border-slate-200 text-[#475569] placeholder:text-[#94a3b8] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Web Type:</label>
                                            <Select defaultValue="choose">
                                                <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                                    <SelectValue placeholder="Choose..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                                    <SelectItem value="full" className="text-slate-700 font-medium dark:text-zinc-400">Full</SelectItem>
                                                    <SelectItem value="partial" className="text-slate-700 font-medium dark:text-zinc-400">Partial</SelectItem>
                                                    <SelectItem value="none" className="text-slate-700 font-medium dark:text-zinc-400">None</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Server Url:</label>
                                        <Input placeholder="Day" className="h-10 border-slate-200 text-[#475569] placeholder:text-[#94a3b8] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Detail:</label>
                                        <textarea className="w-full min-h-[90px] p-3 text-[14px] border border-slate-200 rounded-md outline-none focus:border-[#059669]/50 focus:ring-1 focus:ring-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950/50 dark:border-zinc-800">
                                    <DialogClose asChild>
                                        <button className="px-5 py-2.5 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#1e293b] text-[14px] font-bold rounded-[6px] transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-100">
                                            Close
                                        </button>
                                    </DialogClose>
                                    <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#059669]/50" onClick={() => setDomainBackupModalOpen(false)}>
                                        Save
                                    </button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-report") {
        // Real data derived from the IT domain registry (GET /api/it/domains) — no separate reporting
        // backend exists for this, so we bucket the already-fetched real records client-side.
        const now = new Date();
        const monthlyExpiryData: { month: string; count: number }[] = (() => {
            const buckets: Record<string, number> = {};
            const order: string[] = [];
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                buckets[key] = 0;
                order.push(key);
            }
            (realDomains as any[]).forEach((d: any) => {
                if (!d.expiryDate) return;
                const key = new Date(d.expiryDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                if (key in buckets) buckets[key] += 1;
            });
            return order.map((key) => ({ month: key, count: buckets[key] }));
        })();

        const fiscalYearStartYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
        const quarterCounts = [
            { id: "q1", label: "Q1 Apr-Jun", start: new Date(fiscalYearStartYear, 3, 1), end: new Date(fiscalYearStartYear, 6, 0, 23, 59, 59, 999) },
            { id: "q2", label: "Q2 Jul-Sep", start: new Date(fiscalYearStartYear, 6, 1), end: new Date(fiscalYearStartYear, 9, 0, 23, 59, 59, 999) },
            { id: "q3", label: "Q3 Oct-Dec", start: new Date(fiscalYearStartYear, 9, 1), end: new Date(fiscalYearStartYear, 12, 0, 23, 59, 59, 999) },
            { id: "q4", label: "Q4 Jan-Mar", start: new Date(fiscalYearStartYear + 1, 0, 1), end: new Date(fiscalYearStartYear + 1, 3, 0, 23, 59, 59, 999) },
        ].map((q) => ({
            ...q,
            count: (realDomains as any[]).filter((d: any) => {
                const activatedAt = d.activationDate ? new Date(d.activationDate) : d.createdAt ? new Date(d.createdAt) : null;
                return activatedAt && activatedAt >= q.start && activatedAt <= q.end && (d.status || "Active") === "Active";
            }).length,
        }));

        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">DOMAIN REPORT</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pb-8 dark:bg-zinc-900">
                        <h2 className="text-[15px] font-bold text-[#475569] uppercase mb-6 dark:text-zinc-400">DOMAINS EXPIRING BY MONTH (NEXT 12 MONTHS)</h2>
                        <p className="text-[12px] text-slate-400 mb-6 -mt-4">Sourced from the live IT domain registry ({(realDomains as any[]).length} domain{(realDomains as any[]).length === 1 ? "" : "s"} tracked).</p>

                        {/* Chart Area — real domain expiry data from GET /api/it/domains */}
                        <div className="h-[380px] w-full dark:border-zinc-800">
                            {(realDomains as any[]).length === 0 ? (
                                <div className="h-full w-full bg-slate-50/30 rounded border border-slate-100 flex items-center justify-center dark:border-zinc-800">
                                    <span className="text-slate-400 text-[13px] font-medium">No domains registered yet — add one under IT Domains to see expiry trends.</span>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyExpiryData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--card))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="count" name="Domains Expiring" fill="#059669" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <h3 className="text-[16px] font-bold text-slate-600 mb-8 dark:text-zinc-300">Active Domains Onboarded (by Fiscal Quarter)</h3>

                        <div className="flex border-b border-slate-100 dark:border-zinc-800">
                            {quarterCounts.map((q) => {
                                const isActive = activeQuarter === q.id;
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => setActiveQuarter(q.id)}
                                        className={cn(
                                            "flex-1 text-center pb-4 cursor-pointer transition-all duration-200",
                                            isActive
                                                ? "border-b-[3px] border-[#059669] relative top-[2px]"
                                                : "group"
                                        )}
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <span className={cn(
                                                "text-[13px] font-bold transition-colors",
                                                isActive
                                                    ? "bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"
                                                    : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                                            )}>
                                                {q.label}
                                            </span>
                                            <span className={cn(
                                                "text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors",
                                                isActive
                                                    ? "bg-[#059669]/10 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500"
                                                    : "bg-slate-100 text-slate-500 dark:text-slate-400"
                                            )}>
                                                {q.count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-detail") {
        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-list")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Domain List
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">ATTRIBUTE</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-[#475569] font-bold text-[16px] px-2 uppercase mb-[-12px] dark:text-zinc-400">ATTRIBUTE</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Card: Dynamic Client Details */}
                        <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 flex flex-col items-center dark:bg-zinc-900">
                            <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">{selectedDomainItem?.company || "N/A"}</h3>
                            <div className="h-12 w-12 rounded-full bg-[#e0e7ff] text-[#4f46e5] flex items-center justify-center text-[16px] font-bold mb-5 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
                                {(selectedDomainItem?.company || "N").charAt(0)}
                            </div>
                            <p className="text-[14px] font-bold text-slate-700 mb-0.5 dark:text-zinc-400">{selectedDomainItem?.company || "N/A"}</p>
                            <p className="text-[12px] font-semibold text-slate-400 mb-4 hover:text-slate-600 transition-colors cursor-pointer tracking-tight">{selectedDomainItem?.email || "N/A"}</p>

                            <div className="flex gap-2 mb-6">
                                <span className="bg-[#059669] text-white text-[12px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#047857] transition-colors cursor-pointer">{selectedDomainItem?.contactNo || "N/A"}</span>
                            </div>

                            <div className="grid grid-cols-2 w-full gap-4 mb-6 pt-4 border-t border-slate-50/50 dark:border-zinc-800">
                                <div className="text-center flex flex-col items-center border-r border-slate-50 dark:border-zinc-800">
                                    <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Grade:</p>
                                    <div className="h-10 w-10 rounded-full bg-[#fef08a]/60 text-[#ca8a04] flex items-center justify-center text-[14px] font-bold shadow-sm">D</div>
                                </div>
                                <div className="text-center flex flex-col items-center">
                                    <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Contact:</p>
                                    <div className="h-10 w-10 rounded-full bg-[#fecaca]/50 text-[#dc2626] flex items-center justify-center text-[14px] font-bold shadow-sm">0</div>
                                </div>
                            </div>

                            <div className="text-center mb-8 w-full">
                                <p className="text-[12px] font-medium text-slate-500 mb-2 dark:text-zinc-400">Last Contact:</p>
                                <span className="bg-[#334155] text-white text-[12px] font-bold px-4 py-1.5 rounded shadow-sm">
                                    {selectedDomainItem?.createdAt ? new Date(selectedDomainItem.createdAt).toLocaleDateString() : "—"}
                                </span>
                            </div>

                            <div className="flex flex-wrap justify-center gap-2 mt-auto">
                                <button onClick={() => setFollowupOpen(true)} className="bg-[#059669] hover:bg-[#047857] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Followup</button>
                                <button onClick={() => handleOpenInvoiceForm("quotation", { company: "Spedster Sports", domain: "spedstersports.com" })} className="bg-[#64748b] hover:bg-[#475569] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Quotation</button>
                                <button onClick={() => handleOpenInvoiceForm("invoice", { company: "Spedster Sports", domain: "spedstersports.com" })} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors">Invoice</button>
                                <button onClick={() => setGmDocOpen(true)} className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors mt-0.5 dark:bg-zinc-900 dark:hover:bg-zinc-800">Gm Doc</button>
                                <button onClick={() => setGmBvSubmitOpen(true)} className="bg-[#eab308] hover:bg-[#ca8a04] text-white text-[12px] font-bold px-3 py-1.5 rounded shadow-sm transition-colors mt-0.5 border border-[#ca8a04]/20 dark:border-zinc-800 dark:bg-zinc-900">Gm BV submit</button>
                            </div>
                        </div>

                        {/* Center Card: Expiry Date */}
                        <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pb-2 dark:bg-zinc-900">
                            <h3 className="text-[15px] font-bold text-slate-700 mb-8 dark:text-zinc-400">Expiry Date</h3>

                            <div className="relative pl-7 space-y-10 before:absolute before:inset-0 before:ml-[34px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-slate-100">
                                {/* Domain Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserPlus className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Domain</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">{selectedDomainItem?.domainName || selectedDomainItem?.domain || "N/A"}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date {selectedDomainItem?.expiryDate ? new Date(selectedDomainItem.expiryDate).toLocaleDateString() : "N/A"}</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">{selectedDomainItem?.expiryDate ? daysLeft(selectedDomainItem.expiryDate) : "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* SSL Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <FileText className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Ssl</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">{selectedDomainItem?.domainName || selectedDomainItem?.domain || "N/A"}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date {selectedDomainItem?.sslExpiryDate ? new Date(selectedDomainItem.sslExpiryDate).toLocaleDateString() : "N/A"}</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">{selectedDomainItem?.sslExpiryDate ? daysLeft(selectedDomainItem.sslExpiryDate) : "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Hosting Item */}
                                <div className="relative flex items-start gap-5 z-10 -ml-[5px]">
                                    <div className="bg-white p-1 rounded-full border-[2px] border-slate-200 mt-1 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="bg-white rounded-full h-2 w-2 flex items-center justify-center dark:bg-zinc-900">
                                            <div className="h-1 w-1 bg-slate-400 rounded-full"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CloudDownload className="h-[18px] w-[18px] text-emerald-600" />
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-zinc-400">Hosting</span>
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-400 mb-3 hover:bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 transition-colors cursor-pointer">{selectedDomainItem?.domainName || selectedDomainItem?.domain || "N/A"}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-[#334155] text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm">Date {selectedDomainItem?.hostingExpiryDate ? new Date(selectedDomainItem.hostingExpiryDate).toLocaleDateString() : "N/A"}</span>
                                            <span className="bg-[#ef4444]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-sm hover:bg-[#ef4444] transition-colors dark:hover:bg-zinc-800">{selectedDomainItem?.hostingExpiryDate ? daysLeft(selectedDomainItem.hostingExpiryDate) : "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Area: Whatsapp & Duplicate */}
                        <div className="space-y-6">
                            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 dark:bg-zinc-900">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">Whatsapp Message</h3>
                                <div className="space-y-3">
                                    <p className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Message:</p>
                                    <textarea
                                        value={whatsappMsg}
                                        onChange={(e) => setWhatsappMsg(e.target.value)}
                                        className="w-full min-h-[90px] p-2 text-[13px] border border-slate-200 rounded outline-none focus:border-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm dark:text-zinc-300 dark:border-zinc-800"
                                    />
                                    <button
                                        onClick={() => window.open(`https://wa.me/923016263980?text=${encodeURIComponent(whatsappMsg)}`, '_blank')}
                                        className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors mt-2"
                                    >
                                        Whatsapp
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 dark:bg-zinc-900">
                                <h3 className="text-[14px] font-bold text-slate-700 mb-5 dark:text-zinc-400">Duplicate Company Details</h3>
                                <button
                                    onClick={() => {
                                        const targetKey = (selectedDomainItem?.company || "").trim().toLowerCase();
                                        if (!targetKey) {
                                            setDuplicateResults([]);
                                            return;
                                        }
                                        const matches = (realDomains as any[]).filter((d: any) => {
                                            const key = (d.company || "").trim().toLowerCase();
                                            return key === targetKey && d.id !== selectedDomainItem?.id;
                                        });
                                        setDuplicateResults(matches);
                                    }}
                                    className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors flex items-center gap-2 w-max"
                                >
                                    <Search className="h-4 w-4" /> Find Duplicate Companies
                                </button>
                                {duplicateResults !== null && (
                                    duplicateResults.length === 0 ? (
                                        <p className="text-[12.5px] text-slate-500 mt-4 dark:text-zinc-400">No other domain records found under this company name.</p>
                                    ) : (
                                        <div className="mt-4 space-y-2">
                                            {duplicateResults.map((d: any) => (
                                                <div key={d.id} className="flex items-center justify-between text-[12.5px] border border-slate-100 rounded px-3 py-2 dark:border-zinc-800">
                                                    <span className="font-semibold text-slate-600 dark:text-zinc-300">{d.domainName || d.domain}</span>
                                                    <span className="text-slate-400">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "N/A"}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Area: History */}
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 pt-5 mt-6 dark:bg-zinc-900">
                        <h2 className="text-[#475569] font-bold text-[15px] mb-6 dark:text-zinc-400">History</h2>

                        <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto no-scrollbar justify-start dark:border-zinc-800">
                            {[
                                { id: 'contact', title: 'Contact History' },
                                { id: 'company', title: 'Company History' },
                                { id: 'quotation', title: 'Quotation History' },
                                { id: 'invoice', title: 'Invoice History' },
                                { id: 'templates', title: 'Quotation Templates' },
                            ].map((tab) => (
                                <div
                                    key={tab.id}
                                    onClick={() => setActiveHistoryTab(tab.id)}
                                    className={cn(
                                        "pb-3 md:pb-4 whitespace-nowrap px-1 cursor-pointer transition-colors relative top-[2px]",
                                        activeHistoryTab === tab.id
                                            ? "border-b-2 border-slate-400"
                                            : "group"
                                    )}
                                >
                                    <span className={cn(
                                        "text-[13px] transition-colors",
                                        activeHistoryTab === tab.id
                                            ? "font-bold text-slate-600 dark:text-slate-300"
                                            : "font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                                    )}>
                                        {tab.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            {activeHistoryTab === "contact" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left pl-6 w-[15%] dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[20%] dark:text-zinc-400">CM</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[15%] dark:text-zinc-400">Next CD</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left w-[20%] dark:text-zinc-400">Next CM</TableHead>
                                            <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Note</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-[13px] font-medium">No history data available.</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "company" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Title</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Detail</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Actin By</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { title: "Move From Duplication", detail: "Spedster Sports, Move From Saim Tariq To Saim Tariq", by: "Maria Rani", date: "26-03-2026 02:24 PM" },
                                            { title: "Move From Duplication", detail: "Spedster Sports, Move From Muhammad Nadeem Zulfiqar To Saim Tariq", by: "Maria Rani", date: "26-03-2026 02:22 PM" },
                                            { title: "Create", detail: "Spedster Sports is Created", by: "Muhammad Nadeem Zulfiqar", date: "18-03-2021 03:58 PM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.title}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.detail}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "quotation" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sub Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Discount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Pay First</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Send By</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { date: "29-08-2025 11:16 AM", sub: "18", discount: "0", total: "20", payFirst: "100", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "29-08-2025 09:23 AM", sub: "18", discount: "0", total: "19", payFirst: "33", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "01-07-2025 03:18 PM", sub: "120", discount: "4000", total: "105.92", payFirst: "0", by: "Muhammad Nadeem Zulfiqar" },
                                            { date: "10-06-2025 04:45 PM", sub: "63", discount: "7800", total: "35.44", payFirst: "0", by: "Muhammad Nadeem Zulfiqar" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.date}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.sub}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.discount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.total}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.payFirst}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "invoice" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Company Name</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sale Person</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total Amount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">View</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "14000", date: "28-02-2024 12:20 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "21000", date: "12-01-2024 12:30 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "18000", date: "22-12-2022 02:18 PM" },
                                            { company: "Spedster Sports", by: "Muhammad Nadeem Zulfiqar", amount: "18000", date: "12-12-2022 10:24 AM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{row.company}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.amount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <div onClick={() => setActiveView("domain-invoice")} className="h-6 w-6 rounded-full border border-[#059669]/20 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors dark:border-zinc-800">
                                                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}

                            {activeHistoryTab === "templates" && (
                                <Table>
                                    <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left pl-4 dark:text-zinc-400">Title</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Sub Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Discount</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Total</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Pay First</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Make By</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Date</TableHead>
                                            <TableHead className="text-[13px] font-bold text-[#475569] py-3.5 text-left dark:text-zinc-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[
                                            { title: "Domain Registration", sub: "18", discount: "0", total: "20", payFirst: "100", by: "Muhammad Nadeem Zulfiqar", date: "29-08-2025 11:16 AM" },
                                            { title: "Domain Registration", sub: "18", discount: "0", total: "19", payFirst: "33", by: "Muhammad Nadeem Zulfiqar", date: "29-08-2025 09:23 AM" },
                                            { title: "Domain Registration & Hosting Plan & SSL Certificate &", sub: "132", discount: "9964", total: "88.11", payFirst: "0", by: "Muhammad Nadeem Zulfiqar", date: "19-11-2022 02:50 PM" },
                                            { title: "Domain Registration &", sub: "15", discount: "0", total: "15", payFirst: "0", by: "Namriza", date: "19-06-2021 03:17 PM" }
                                        ].map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-bold text-slate-600 py-3.5 pl-4 truncate max-w-[280px] dark:text-zinc-300">{row.title}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.sub}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.discount}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.total}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.payFirst}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.by}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-500 py-3.5 dark:text-zinc-400">{row.date}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <div onClick={() => setActiveView("domain-quotation")} className="h-6 w-6 rounded-full border border-[#059669]/20 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors dark:border-zinc-800">
                                                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>

                    {/* GM Doc Dialog */}
                    <Dialog open={gmDocOpen} onOpenChange={setGmDocOpen}>
                        <DialogContent className="sm:max-w-[480px] p-8 bg-white border-none shadow-xl dark:bg-zinc-900">
                            <DialogHeader className="mb-4">
                                <DialogTitle className="text-[#3b4b6b] text-[18px] font-bold dark:text-zinc-100">GM Doc</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Packge</label>
                                    <Input className="h-10 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Status</label>
                                    <Input className="h-10 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">GM Date</label>
                                    <Input type="date" className="h-10 border-slate-200 text-slate-500 block w-full bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Note</label>
                                    <textarea className="w-full min-h-[90px] p-3 text-[13px] border border-slate-200 rounded-md outline-none focus:border-[#059669]/50 focus:ring-1 focus:ring-[#059669]/50 transition-colors resize-y text-slate-600 shadow-sm dark:text-zinc-300 dark:border-zinc-800" />
                                </div>

                                <div className="pt-2">
                                    <p className="text-[13.5px] font-semibold text-[#475569] mb-4 tracking-tight dark:text-zinc-400">Please check the Relevant Doc which is submitted in GM BV</p>
                                    <div className="space-y-2.5">
                                        {[
                                            "NTN",
                                            "Latest 181 Form",
                                            "ID card",
                                            "Bank Statement",
                                            "Phone bill",
                                            "Deed (If company have partner)"
                                        ].map((doc, index) => (
                                            <label key={index} className="flex items-center gap-3 cursor-pointer group w-fit">
                                                <input type="checkbox" className="w-4 h-4 border-slate-300 rounded bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] cursor-pointer dark:border-zinc-800" />
                                                <span className="text-[13.5px] font-medium text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300 dark:group-hover:text-zinc-100">{doc}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Followup Dialog */}
                    <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
                        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[96vh] overflow-y-auto p-0 border border-slate-200 shadow-2xl rounded-xl overflow-hidden gap-0 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            {/* Header */}
                            <div className="flex bg-white items-center justify-between px-6 py-4 border-b border-slate-100 dark:bg-zinc-900 dark:border-zinc-800">
                                <DialogTitle className="text-[#64748b] text-[18px] font-bold tracking-tight">Follow The Customer</DialogTitle>
                                <DialogClose className="rounded-full p-1.5 hover:bg-slate-100 transition-colors dark:hover:bg-zinc-800">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    <span className="sr-only">Close</span>
                                </DialogClose>
                            </div>

                            {/* Body */}
                            <div className="p-6 bg-white space-y-4 dark:bg-zinc-900">
                                <Input disabled value={selectedDomainItem?.company || ""} className="h-10 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-slate-200 text-[#475569] font-medium dark:text-zinc-400 dark:border-zinc-800" />

                                <div className="border border-slate-200 rounded p-5 pb-6 dark:border-zinc-800">
                                    <p className="text-[13px] font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 mb-4">Select Services:<span className="text-[#ef4444]">*</span></p>
                                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                                        {[
                                            "Alibaba Membership",
                                            "Alibaba Services",
                                            "Design Development",
                                            "Domain Hosting"
                                        ].map((service, index) => (
                                            <label key={index} className="flex items-center gap-2.5 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={followupServices.includes(service)}
                                                    onChange={(e) => setFollowupServices((prev) => e.target.checked ? [...prev, service] : prev.filter((s) => s !== service))}
                                                    className="w-4 h-4 border-slate-300 rounded bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] cursor-pointer dark:border-zinc-800"
                                                />
                                                <span className="text-[13.5px] font-bold text-[#64748b] group-hover:text-[#475569] transition-colors">{service}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {showAdditional && (
                                    <Select value={followupReservation} onValueChange={setFollowupReservation}>
                                        <SelectTrigger className="h-10 border-slate-200 text-[#64748b] font-medium focus:ring-[#059669] dark:border-zinc-800">
                                            <SelectValue placeholder="Select Reservation" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Select Reservation" className="text-slate-500 font-medium dark:text-zinc-400">Select Reservation</SelectItem>
                                            <SelectItem value="Mobile" className="font-medium text-[#64748b]">Mobile</SelectItem>
                                            <SelectItem value="WhatsApp" className="font-medium text-[#64748b]">WhatsApp</SelectItem>
                                            <SelectItem value="WH-Call" className="font-medium text-[#64748b]">WH-Call</SelectItem>
                                            <SelectItem value="In-meeting" className="font-medium text-[#64748b]">In-meeting</SelectItem>
                                            <SelectItem value="Out-meeting" className="font-medium text-[#64748b]">Out-meeting</SelectItem>
                                            <SelectItem value="E-mail" className="font-medium text-[#64748b]">E-mail</SelectItem>
                                            <SelectItem value="On-Site Appointment" className="font-medium text-[#64748b]">On-Site Appointment</SelectItem>
                                            <SelectItem value="Vm Appointment" className="font-medium text-[#64748b]">Vm Appointment</SelectItem>
                                            <SelectItem value="Fax" className="font-medium text-[#64748b]">Fax</SelectItem>
                                            <SelectItem value="No Need" className="font-medium text-[#64748b]">No Need</SelectItem>
                                            <SelectItem value="Seminar" className="font-medium text-[#64748b]">Seminar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}

                                <button
                                    onClick={() => setShowAdditional(!showAdditional)}
                                    className={`w-full py-2 rounded text-[13.5px] font-bold border transition-colors flex items-center justify-center gap-2 ${showAdditional
                                        ? "border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/5"
                                        : "border-[#059669] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 hover:bg-[#059669]/5"
                                        }`}
                                >
                                    {showAdditional ? (
                                        <>
                                            <div className="w-3.5 h-3.5 rounded-full bg-[#ef4444] flex items-center justify-center text-white pb-[1px] leading-none text-[10px] font-black dark:bg-zinc-900">-</div>
                                            Hide Additional Details
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-3.5 h-3.5 rounded-full bg-[#059669] flex items-center justify-center text-white pb-[1px] leading-none text-[10px] font-black">+</div>
                                            Show Additional Details
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        if (!selectedDomainItem?.id) return;
                                        if (followupServices.length === 0) {
                                            toast({ title: "Select at least one service", variant: "destructive" });
                                            return;
                                        }
                                        domainFollowupMutation.mutate({ id: selectedDomainItem.id, services: followupServices, reservation: followupReservation });
                                    }}
                                    disabled={domainFollowupMutation.isPending}
                                    className="w-full bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold py-2.5 rounded transition-colors mt-2 disabled:opacity-60"
                                >
                                    {domainFollowupMutation.isPending ? "Saving..." : "Submit"}
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* GM BV Submit Dialog */}
                    <Dialog open={gmBvSubmitOpen} onOpenChange={setGmBvSubmitOpen}>
                        <DialogContent className="sm:max-w-[420px] p-8 bg-white border-none shadow-xl dark:bg-zinc-900">
                            <DialogHeader className="mb-2">
                                <DialogTitle className="text-[#3b4b6b] text-[18px] font-bold dark:text-zinc-100">User GM BV Submit Date</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Packge</label>
                                    <Input className="h-10 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">Status</label>
                                    <Input className="h-10 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-slate-200 text-slate-800 dark:text-zinc-100 dark:border-zinc-800" />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-semibold text-[#475569] dark:text-zinc-400">User GM BV Submit Date</label>
                                    <Input type="date" className="h-10 border-slate-200 text-slate-500 block w-full bg-white dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                </div>
            </div>
        );
    }

    if (activeView === "domain-list") {
        const listData = domains.filter((d: any) => {
            if (!d) return false;
            const searchLc = domainListSearch.trim().toLowerCase();
            const companyLc = domainListFilters.company.trim().toLowerCase();
            const emailLc = domainListFilters.email.trim().toLowerCase();
            const contactLc = domainListFilters.contact.trim().toLowerCase();

            if (companyLc && !(d.company || "").toLowerCase().includes(companyLc)) return false;
            if (emailLc && !(d.email || "").toLowerCase().includes(emailLc)) return false;
            if (contactLc && !(d.contactNo || "").toLowerCase().includes(contactLc)) return false;

            if (searchLc) {
                const hay = `${d.company || ""} ${d.domainName || d.domain || ""} ${d.email || ""}`.toLowerCase();
                if (!hay.includes(searchLc)) return false;
            }
            return true;
        }).slice().sort((a: any, b: any) => (a.company || "").toLowerCase().localeCompare((b.company || "").toLowerCase()))
          .map((d: any, i: number) => ({
            id: d.id,
            no: i + 1,
            company: d.company || "N/A",
            domainName: d.domainName || d.domain || "",
            dom1: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "N/A",
            dom2: "Active",
            host1: d.hostingExpiryDate ? new Date(d.hostingExpiryDate).toLocaleDateString() : "N/A",
            host2: d.hostingPackageName || "N/A",
            ssl1: d.sslExpiryDate ? new Date(d.sslExpiryDate).toLocaleDateString() : "N/A",
            ssl2: d.sslExpiryDate ? "Renew" : "N/A",
            register: d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "N/A",
            item: d
        }));

        // Grouped-by-company visibility: rows for the same company (case-insensitive,
        // trimmed) are adjacent after the sort above; only the first row in each run
        // renders the Company Name cell, spanning the rest via rowSpan, so a company
        // with several domains reads as one grouped block instead of repeating its
        // name on every row.
        const companyKey = (c: string) => (c || "").trim().toLowerCase();
        listData.forEach((row: any, i: number) => {
            const prev = listData[i - 1];
            row.isGroupStart = !prev || companyKey(prev.company) !== companyKey(row.company);
        });
        listData.forEach((row: any, i: number) => {
            if (!row.isGroupStart) return;
            let span = 1;
            while (listData[i + span] && companyKey(listData[i + span].company) === companyKey(row.company)) span++;
            row.groupSpan = span;
        });

        const handleExport = (type: "copy" | "csv" | "excel" | "pdf" | "print") => {
            if (type === "print" || type === "pdf") {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    const html = `
                        <!DOCTYPE html>
                        <html>
                            <head>
                                <title>DRM Dashboard Print</title>
                                <style>
                                    @page { size: portrait; margin: 15mm; }
                                    body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; margin: 0; padding: 0; color: #333; }
                                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; vertical-align: middle; }
                                    th { font-weight: bold; color: #111; font-size: 10px; }
                                    td { color: #444; }
                                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
                                    .header-left h1 { margin: 0; font-size: 22px; color: #111; font-weight: 500; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                                    .header-right { font-size: 10px; font-weight: 600; color: #111; padding-bottom: 2px; }
                                    .header-date { font-size: 10px; color: #666; margin-bottom: 8px; }
                                </style>
                            </head>
                            <body>
                                <div class="header-date">${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}</div>
                                <div class="header">
                                    <div class="header-left">
                                        <h1>DRM Dashboard</h1>
                                    </div>
                                    <div class="header-right">
                                        DRM Dashboard
                                    </div>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width: 30px;">No</th>
                                            <th>Company Name</th>
                                            <th>Domain Name</th>
                                            <th>Domain</th>
                                            <th>Hosting</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${listData.map(item => `
                                            <tr>
                                                <td>${item.no}</td>
                                                <td>${item.company}</td>
                                                <td>${item.domainName}</td>
                                                <td>${item.dom1}${item.dom2}</td>
                                                <td>${item.host1}${item.host2}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                                <script>
                                    window.onload = function() {
                                        setTimeout(function() {
                                            window.print();
                                        }, 150);
                                    }
                                </script>
                            </body>
                        </html>
                    `;
                    printWindow.document.open();
                    printWindow.document.write(html);
                    printWindow.document.close();
                }
                return;
            }

            const headers = ["No", "Company Name", "Domain Name", "Domain 1", "Domain 2", "Hosting 1", "Hosting 2", "SSL 1", "SSL 2", "Register Date"];
            const rows = listData.map(item => [
                item.no, item.company, item.domainName, item.dom1, item.dom2, item.host1, item.host2, item.ssl1, item.ssl2, item.register
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(e => e.join(","))
            ].join("\n");

            if (type === "copy") {
                navigator.clipboard.writeText(csvContent);
                alert("Table data copied to clipboard!");
            } else if (type === "csv" || type === "excel") {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `Domain_List_Export.${type}`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };

        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("dashboard")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">DOMAIN LIST</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-[#475569] font-bold text-[16px] px-2 mb-[-12px] dark:text-zinc-400">IT DEPARTMENT</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Company Name</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter company name" value={domainListFilters.company} onChange={(e) => setDomainListFilters(f => ({ ...f, company: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Person Name</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter person name" value={domainListFilters.person} onChange={(e) => setDomainListFilters(f => ({ ...f, person: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Contact No#</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter contact no" value={domainListFilters.contact} onChange={(e) => setDomainListFilters(f => ({ ...f, contact: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Email</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter e-mail" value={domainListFilters.email} onChange={(e) => setDomainListFilters(f => ({ ...f, email: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">NTN/CINC #</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter NTN/CINC" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">AB ID</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter AB ID No" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Team (Company)</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter Company name" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-semibold text-slate-500 dark:text-zinc-400">Team Member</label>
                                <Input className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" placeholder="Enter team member name" />
                            </div>
                        </div>
                    </div>

                    <h2 className="text-[#475569] font-bold text-[16px] px-2 mt-8 mb-[-12px] uppercase dark:text-zinc-400">Domain / Hosting / SSL</h2>
                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 dark:bg-zinc-900">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                            <div className="flex bg-[#64748b] rounded overflow-hidden shadow-sm">
                                <button onClick={() => handleExport('copy')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition">Copy</button>
                                <button onClick={() => handleExport('excel')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Excel</button>
                                <button onClick={() => handleExport('csv')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">CSV</button>
                                <button onClick={() => handleExport('pdf')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">PDF</button>
                                <button onClick={() => handleExport('print')} className="px-5 py-1.5 text-white/90 text-[13px] hover:bg-[#475569] font-medium transition border-l border-white/20">Print</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500 font-medium tracking-tight dark:text-zinc-400">Search:</span>
                                <Input className="h-8 w-44 border-slate-200 dark:border-zinc-800" value={domainListSearch} onChange={(e) => setDomainListSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 pl-4 w-12 text-left dark:text-zinc-400">No</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Company Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-left dark:text-zinc-400">Domain Name</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Domain</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Hosting</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">SSL</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center dark:text-zinc-400">Register</TableHead>
                                        <TableHead className="text-[12px] font-bold text-[#475569] py-3 text-center pr-4 dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {listData.map((row: any, i: number) => (
                                        <TableRow key={i} className="hover:bg-slate-50 border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-4 pl-4 dark:text-zinc-300">{row.no}</TableCell>
                                            {row.isGroupStart && (
                                                <TableCell rowSpan={row.groupSpan} className="text-[13px] font-bold text-[#475569] py-4 whitespace-nowrap align-top border-r border-slate-100 dark:text-zinc-400 dark:border-zinc-800">
                                                    {row.company}
                                                    {row.groupSpan > 1 && (
                                                        <span className="ml-1.5 bg-[#64748b]/10 text-[#64748b] text-[10px] font-bold px-1.5 py-0.5 rounded-full dark:text-zinc-400">{row.groupSpan}</span>
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-[13px] py-4 whitespace-nowrap">
                                                <span className="bg-[#a7f3d0]/60 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-2 py-0.5 rounded font-bold">{row.domainName}</span>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.dom1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.dom2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.host1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.host2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">{row.ssl1}</span>
                                                    <span className="bg-[#64748b] text-white text-[11px] px-2 py-0.5 rounded-full font-bold leading-none">{row.ssl2}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[12px] font-bold text-slate-500 py-4 text-center dark:text-zinc-400">{row.register}</TableCell>
                                            <TableCell className="py-4 pr-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => { setSelectedDomainItem(row.item); setActiveView("domain-detail"); }} className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors">
                                                        <User className="h-4 w-4 text-white" />
                                                    </button>
                                                    <button onClick={() => { setSelectedDomainItem(row.item); setActiveView("domain-quotation"); }} title="Quotation" className="h-7 w-7 rounded-full bg-[#059669] shadow-sm hover:bg-[#047857] flex items-center justify-center transition-colors">
                                                        <Eye className="h-4 w-4 text-white" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-quotation") {
        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-list")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to Domain List
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">INVOICE QUOTATION</span>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-slate-600 font-bold text-[16px] px-2 mb-[-12px] uppercase dark:text-zinc-300">
                        {invoiceIntent === "quotation" ? "Quotation" : "Invoice"} <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold">{new Date().toLocaleString()}</span>
                    </h2>

                    <div className="bg-white backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden p-6 md:p-8 dark:bg-zinc-900">
                        {/* Top Info Row — sourced from the real IT domain registry (GET /api/it/domains) */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Renewal Domain</label>
                                <Select value={renewalDomainId} onValueChange={setRenewalDomainId}>
                                    <SelectTrigger className="h-10 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue placeholder="Select a domain (optional)" /></SelectTrigger>
                                    <SelectContent>
                                        {(realDomains as any[]).length === 0 && <SelectItem value="none" disabled>No domains found</SelectItem>}
                                        {(realDomains as any[]).map((d: any) => (
                                            <SelectItem key={d.id} value={d.id}>{d.domainName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Company / Customer Name <span className="text-red-500">*</span></label>
                                <Input value={renewalCustomerName} onChange={(e) => setRenewalCustomerName(e.target.value)} placeholder="Enter company name" className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Domain Status</label>
                                <Input disabled value={selectedRenewalDomain?.status || "—"} className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Expiry Date</label>
                                <Input disabled value={selectedRenewalDomain?.expiryDate ? new Date(selectedRenewalDomain.expiryDate).toLocaleDateString() : "—"} className="h-10 border-slate-200 text-slate-600 font-medium bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-800" />
                            </div>
                        </div>

                        {/* Line Item — single renewal item (Domain / Hosting / SSL renewal) */}
                        <div className="pb-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Detail <span className="text-red-500">*</span></label>
                                    <Input value={qDetail} onChange={(e) => setQDetail(e.target.value)} placeholder="e.g. Domain Renewal (example.com)" className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Unit Price ($) <span className="text-red-500">*</span></label>
                                    <Input type="number" min="0" step="0.01" value={qUnitPrice} onChange={(e) => setQUnitPrice(e.target.value)} className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[12px] font-bold text-slate-600 dark:text-zinc-300">Quantity <span className="text-red-500">*</span></label>
                                    <Input type="number" min="0" step="1" value={qQuantity} onChange={(e) => setQQuantity(e.target.value)} className="h-9 border-slate-200 text-[13px] dark:border-zinc-800" />
                                </div>
                            </div>
                            <p className="text-[12px] text-slate-400 dark:text-zinc-500">Line total: ${qSubAmount.toFixed(2)}</p>
                        </div>

                        {/* Bottom Grid Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 gap-y-6 pt-4 border-t border-slate-100 mb-8 dark:border-zinc-800">
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Sub Amount</label>
                                <Input readOnly value={qSubAmount.toFixed(2)} className="h-10 border-slate-200 bg-slate-50/50 dark:bg-zinc-900 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">GST %</label>
                                <Input type="number" min="0" step="0.01" value={qGstPercent} onChange={(e) => setQGstPercent(e.target.value)} className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Total Amount (incl. GST)</label>
                                <Input readOnly value={qTotalAmount.toFixed(2)} className="h-10 border-slate-200 bg-slate-50/50 dark:bg-zinc-900 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Save As</label>
                                <Select value={invoiceIntent} onValueChange={(v) => setInvoiceIntent(v as "quotation" | "invoice")}>
                                    <SelectTrigger className="h-10 border-slate-200 text-[13px] dark:border-zinc-800"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="quotation">Quotation (Draft)</SelectItem>
                                        <SelectItem value="invoice">Invoice (Pending)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Discount</label>
                                <div className="flex items-center gap-4 h-10">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={qDiscountType === "percentage"} onChange={() => setQDiscountType("percentage")} className="rounded border-slate-300 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] dark:border-zinc-800" />
                                        <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300 dark:group-hover:text-zinc-100">In Percentage</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={qDiscountType === "amount"} onChange={() => setQDiscountType("amount")} className="rounded border-slate-300 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 focus:ring-[#059669] dark:border-zinc-800" />
                                        <span className="text-[12px] font-semibold text-slate-600 group-hover:text-slate-800 transition-colors dark:text-zinc-300 dark:group-hover:text-zinc-100">In Amount</span>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Discount Value</label>
                                <Input type="number" min="0" step="0.01" value={qDiscountValue} onChange={(e) => setQDiscountValue(e.target.value)} className="h-10 border-slate-200 dark:border-zinc-800" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">$Grand Total</label>
                                <Input readOnly value={qGrandTotal.toFixed(2)} className="h-10 border-slate-200 bg-slate-50/50 dark:bg-zinc-900 dark:border-zinc-800 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Pkr Total</label>
                                <Input readOnly value={qPkrTotal.toFixed(2)} className="h-10 border-slate-200 bg-slate-50/50 dark:bg-zinc-900 dark:border-zinc-800" />
                            </div>

                            <div className="space-y-2 md:col-span-4">
                                <label className="text-[12px] font-bold text-slate-500 dark:text-zinc-400">Note</label>
                                <textarea value={qNote} onChange={(e) => setQNote(e.target.value)} className="w-full h-10 min-h-[40px] p-2 text-[13px] border border-slate-200 rounded outline-none focus:border-[#059669]/50 transition-colors resize-none dark:border-zinc-800" />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveDomainInvoice}
                                disabled={createDomainInvoiceMutation.isPending}
                                className="bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-6 py-2.5 rounded shadow-sm transition-colors disabled:opacity-60"
                            >
                                {createDomainInvoiceMutation.isPending ? "Saving..." : "Save Change"}
                            </button>
                            <button onClick={resetInvoiceForm} className="bg-slate-500 hover:bg-slate-600 text-white text-[13px] font-bold px-6 py-2.5 rounded shadow-sm transition-colors">Reset</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (activeView === "domain-invoice") {
        return (
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
                <div className="mb-6 flex justify-between items-center px-2">
                    <button onClick={() => setActiveView("domain-detail")} className="text-slate-400 hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-emerald-600 hover:to-teal-500 flex items-center gap-1 text-[13px] font-bold transition-colors">
                        <ChevronLeft className="h-4 w-4" /> Back to History
                    </button>
                    <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                        <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT MANAGER</span>
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                        <span className="text-slate-500 uppercase dark:text-zinc-400">INVOICE PREVIEW</span>
                    </div>
                </div>

                {!lastCreatedInvoice ? (
                    <div className="max-w-[800px] mx-auto bg-white shadow-md p-12 mt-6 text-center dark:bg-zinc-900">
                        <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-semibold dark:text-zinc-400">No invoice has been generated yet.</p>
                        <p className="text-slate-400 text-[13px] mt-1">Use the Invoice / Quotation buttons on a domain's Attribute page to create one.</p>
                        <button onClick={() => setActiveView("domain-detail")} className="mt-6 bg-[#059669] hover:bg-[#047857] text-white text-[13px] font-bold px-5 py-2 rounded shadow-sm transition-colors">Back to Attribute</button>
                    </div>
                ) : (() => {
                    let previewItems: any[] = [];
                    try { previewItems = JSON.parse(lastCreatedInvoice.items || "[]"); } catch { previewItems = []; }
                    const subtotalNum = parseFloat(lastCreatedInvoice.subtotal || "0");
                    const taxNum = parseFloat(lastCreatedInvoice.tax || "0");
                    const totalNum = parseFloat(lastCreatedInvoice.total || "0");
                    const currency = lastCreatedInvoice.currency || "USD";
                    return (
                    <div className="max-w-[800px] mx-auto bg-white shadow-md p-8 pt-12 mt-6 dark:bg-zinc-900">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                {/* Logo representation */}
                                <div className="flex items-center gap-3">
                                    <div className="h-14 w-14 rounded-full border-[3px] border-[#34d399] flex items-center justify-center relative overflow-hidden bg-white shadow-sm shrink-0 dark:bg-zinc-900 dark:border-zinc-800">
                                        {/* Using CSS to mimic the intersecting circles and cursive W from screenshot */}
                                        <div className="absolute -left-1 -top-1 w-10 h-10 border-[2px] border-[#34d399] rounded-full opacity-60 dark:border-zinc-800"></div>
                                        <div className="absolute right-0 bottom-0 w-8 h-8 border-[2px] border-[#34d399] rounded-full opacity-60 dark:border-zinc-800"></div>
                                        <span className="text-[#22c55e] font-black text-3xl italic tracking-tighter mix-blend-multiply relative z-10 mr-1 mt-1 font-serif dark:text-zinc-100">W</span>
                                    </div>
                                    <div className="mt-1">
                                        <h1 className="text-[26px] font-black text-[#22c55e] tracking-tighter italic leading-none dark:text-zinc-100" style={{ textShadow: "1px 1px 0px #000" }}>WEB EXCELS</h1>
                                        <p className="text-[10px] italic font-semibold text-slate-800 tracking-tight mt-0.5 dark:text-zinc-100" style={{ fontFamily: "cursive" }}>Design, Development & Marketing</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pt-2 space-y-1">
                                <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100"><span className="text-slate-800 dark:text-zinc-100">{lastCreatedInvoice.status === "Draft" ? "Quotation No: " : "Invoice No: "}</span>{lastCreatedInvoice.invoiceNumber}</p>
                                <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100"><span className="text-slate-800 dark:text-zinc-100">Date:</span>{lastCreatedInvoice.issueDate ? new Date(lastCreatedInvoice.issueDate).toLocaleString() : new Date(lastCreatedInvoice.createdAt || Date.now()).toLocaleString()}</p>
                                <p className="text-[11px] font-bold text-slate-900 dark:text-zinc-100"><span className="text-slate-800 dark:text-zinc-100">Status:</span>{lastCreatedInvoice.status}</p>
                            </div>
                        </div>

                        {/* Green Banner */}
                        <div className="flex items-center justify-center bg-[#4ade80] text-white h-10 mb-8 relative">
                            {/* We use a white background block in the middle to house the black text as in the screenshot */}
                            <div className="bg-white px-6 h-full flex items-center justify-center z-10 w-fit shrink-0 dark:bg-zinc-900">
                                <h2 className="text-[28px] font-black text-black dark:text-zinc-100 uppercase tracking-widest leading-none pt-1">{lastCreatedInvoice.status === "Draft" ? "QUOTATION" : "INVOICE"}</h2>
                            </div>
                        </div>

                        {/* Addresses */}
                        <div className="grid grid-cols-2 gap-8 mb-8 pb-4">
                            <div className="text-[10px] leading-relaxed text-black/90 dark:text-zinc-300">
                                <p className="font-bold mb-1">From:</p>
                                <p>Web Excels</p>
                                <p>+92-334-8086611 (Whatsapp)</p>
                                <p>+92-52-4271592</p>
                                <p className="mt-2 text-[#0ea5e9] dark:text-zinc-400">Support@Webexcels.com</p>
                                <p className="mt-2">Al-Amin Center, Paris Rd, Opposite The</p>
                                <p>Sialkot Chamber Of Commerce, Sialkot</p>
                                <p>51310 Pakistan.</p>
                            </div>
                            <div className="text-[10px] leading-relaxed text-black/90 dark:text-zinc-300 pr-12">
                                <p className="font-bold mb-1">To:</p>
                                <p>{lastCreatedInvoice.customerName}</p>
                                {lastCreatedInvoice.customerEmail && <p className="mt-2">Email:<span className="text-[#0ea5e9] dark:text-zinc-400">{lastCreatedInvoice.customerEmail}</span></p>}
                                {lastCreatedInvoice.customerAddress && <p className="mt-2">Address:{lastCreatedInvoice.customerAddress}</p>}
                            </div>
                        </div>

                        {/* Table */}
                        <table className="w-full text-left mb-6 border-collapse border border-slate-700 dark:border-zinc-800">
                            <thead>
                                <tr className="bg-[#2a3042] text-white">
                                    <th className="py-2.5 px-3 text-[11px] font-bold w-10 border border-slate-700 text-center dark:border-zinc-800">Sl.</th>
                                    <th className="py-2.5 px-3 text-[11px] font-bold border border-slate-700 text-center dark:border-zinc-800">Item Description</th>
                                    <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Price</th>
                                    <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Quantity</th>
                                    <th className="py-2.5 px-3 text-[11px] font-bold w-20 border border-slate-700 text-center dark:border-zinc-800">Total</th>
                                </tr>
                            </thead>
                            <tbody className="text-[10px] text-black dark:text-zinc-300">
                                {previewItems.length === 0 ? (
                                    <tr><td colSpan={5} className="py-4 px-3 text-center border border-slate-700 dark:border-zinc-800">No line items</td></tr>
                                ) : previewItems.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="py-3 px-3 border border-slate-700 font-bold text-center dark:border-zinc-800">{idx + 1}</td>
                                        <td className="py-3 px-3 border border-slate-700 dark:border-zinc-800">
                                            <span className="font-bold block text-[11px] text-black dark:text-zinc-300">{item.detail || "Service"}</span>
                                        </td>
                                        <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">${Number(item.unitPrice || 0).toFixed(2)}</td>
                                        <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">{item.quantity}</td>
                                        <td className="py-3 px-3 border border-slate-700 text-center dark:border-zinc-800">{Number(item.total || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals Box */}
                        <div className="flex justify-end mb-16 pt-2">
                            <div className="w-[280px] text-[12px] font-extrabold text-[#0f172a] space-y-2.5 dark:text-zinc-400">
                                <div className="flex justify-between pl-4">
                                    <span>Sub Total:</span>
                                    <span>{currency} {subtotalNum.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pl-4">
                                    <span>Tax:</span>
                                    <span>{currency} {taxNum.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between bg-[#22c55e] text-white py-2.5 px-4 shadow-sm mt-1">
                                    <span>Total:</span>
                                    <span>{currency} {totalNum.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t-4 border-[#34d399] pt-2 text-center text-[10px] font-bold text-black dark:text-zinc-300 pb-8 dark:border-zinc-800">
                            This {lastCreatedInvoice.status === "Draft" ? "Quotation" : "Invoice"} Only For {lastCreatedInvoice.customerName}. Copyright 2026 Reserved By Webexcels.
                        </div>
                    </div>
                    );
                })()}
            </div>
        );
    }

    return (
        <div className="p-4 bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 min-h-screen font-sans">
            {/* Breadcrumb Header */}
            <div className="mb-6 flex justify-between items-center">
                <div className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
                    <span className="text-slate-800 uppercase dark:text-zinc-100">DASHBOARD</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 uppercase">IT DEPARTMENT</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 px-0.5">/</span>
                    <span className="text-slate-500 uppercase dark:text-zinc-400">IT MANAGER</span>
                </div>
            </div>

            {/* Top Selling & Promotion */}
            <div className="grid grid-cols-12 gap-6 mb-6">
                {/* Top Selling (8 Cols) */}
                <div className="col-span-12 lg:col-span-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-[16px] font-bold text-slate-700 dark:text-zinc-400">Top Selling</h2>
                        <Select value={domainStatsScope} onValueChange={(v) => setDomainStatsScope(v as "ld" | "all")}>
                            <SelectTrigger className="w-24 h-8 bg-white text-[13px] font-medium border-slate-200 dark:bg-zinc-900 dark:border-zinc-800">
                                <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ld">LD</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Domain */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Total Domain</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{totalDomainStat}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Users className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Expire */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Expire</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{expiringSoonCount}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Repeat className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Expired */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Expired</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">{expiredDomainStat}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Tag className="h-5 w-5" />
                            </div>
                        </div>

                        {/* Due */}
                        <div className="bg-white p-5 pt-4 pb-4 rounded-[10px] shadow-sm flex items-center justify-between border border-slate-50 hover:shadow-md transition-shadow dark:bg-zinc-900 dark:border-zinc-800">
                            <div>
                                <p className="text-[13px] font-semibold text-slate-500 mb-1 dark:text-zinc-400">Due</p>
                                <p className="text-[22px] font-bold text-slate-800 dark:text-zinc-100">0</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm">
                                <Target className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Promotion Banners (4 Cols) */}
                <div className="col-span-12 lg:col-span-4">
                    <h2 className="text-[16px] font-bold text-slate-700 mb-4 dark:text-zinc-400">Promotion Baners</h2>
                    <Card className="overflow-hidden border-none shadow-sm rounded-[10px] relative h-[90px] group">
                        <img
                            src="https://img.freepik.com/free-photo/young-women-hugging-each-other-smiling_23-2148181676.jpg"
                            alt="Promotion Banner"
                            className="w-full h-full object-cover"
                        />
                        {/* Chevrons overlay */}
                        <div className="absolute inset-0 flex items-center justify-between px-2 bg-gradient-to-t from-black/10 to-transparent">
                            <div className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="rotate-180" /></div>
                            <div className="w-6 h-6 flex items-center justify-center text-white/70 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight /></div>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Domain Details (8 columns) */}
                <div className="col-span-12 lg:col-span-8">
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-3 px-6 border-b border-slate-50 flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Domain Details</CardTitle>
                            <div className="flex flex-wrap items-center gap-4 border border-slate-100 rounded bg-slate-50 p-1 dark:bg-zinc-900 dark:border-zinc-800">
                                <button
                                    onClick={() => setActiveDomainTab("3-month")}
                                    className={cn(
                                        "px-5 py-1.5 text-[13px] font-bold rounded transition-all",
                                        activeDomainTab === "3-month" ? "bg-[#059669] text-white shadow-sm hover:bg-[#047857]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                    )}
                                >
                                    3-Month Expire Domains
                                </button>
                                <button
                                    onClick={() => setActiveDomainTab("expired")}
                                    className={cn(
                                        "px-5 py-1.5 text-[13px] font-bold rounded transition-all",
                                        activeDomainTab === "expired" ? "bg-[#059669] text-white shadow-sm hover:bg-[#047857]" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
                                    )}
                                >
                                    Expired Domains
                                </button>
                            </div>
                        </CardHeader>

                        <div className="overflow-x-auto min-h-[300px]">
                            <Table>
                                <TableHeader className="bg-[#f0f4f8] dark:bg-zinc-900">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 pl-6 w-16 dark:text-zinc-300">No#</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 dark:text-zinc-300">Company</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 dark:text-zinc-300">Domain</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center dark:text-zinc-300">Day</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center dark:text-zinc-300">Expire</TableHead>
                                        <TableHead className="text-[13px] font-bold text-slate-600 py-3 text-center pr-6 dark:text-zinc-300">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayedDomains.map((row, idx) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50 border-slate-50 group dark:hover:bg-zinc-800 dark:border-zinc-800">
                                            <TableCell className="text-[13px] font-medium text-slate-800 py-3 pl-6 dark:text-zinc-100">{idx + 1}</TableCell>
                                            <TableCell className="text-[13px] font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 py-3 cursor-pointer hover:underline uppercase">{row.company}</TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-3 dark:text-zinc-300">{row.domain}</TableCell>
                                            <TableCell className="text-[12px] font-medium py-3 text-center">
                                                <span className="bg-slate-100/80 text-slate-500 px-2.5 py-1 rounded-full dark:bg-zinc-800 dark:text-zinc-400">{row.day}</span>
                                            </TableCell>
                                            <TableCell className="text-[13px] font-medium text-slate-600 py-3 text-center tabular-nums dark:text-zinc-300">{row.expire}</TableCell>
                                            <TableCell className="py-3 text-center pr-6">
                                                <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[120px] mx-auto">
                                                     <div onClick={() => { setSelectedDomainItem(row.raw); setActiveView("domain-detail"); }} className="w-6 h-6 rounded-full bg-[#059669]/10 flex items-center justify-center text-[#059669] cursor-pointer hover:bg-[#059669]/20 transition-all shadow-sm dark:text-zinc-400" title="View Detail"><Eye className="w-3.5 h-3.5" /></div>
                                                     <div onClick={() => setFollowupOpen(true)} className="w-6 h-6 rounded-full bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] cursor-pointer hover:bg-[#3b82f6]/20 transition-all shadow-sm dark:text-zinc-100" title="Follow Up"><Clock className="w-3.5 h-3.5" /></div>
                                                     <div aria-disabled="true" className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 opacity-40 cursor-not-allowed shadow-sm dark:text-zinc-500 dark:bg-zinc-900" title="Edit Domain — not available yet"><Pencil className="w-3.5 h-3.5" /></div>
                                                     <div aria-disabled="true" className="w-6 h-6 rounded-full bg-[#f59e0b]/10 flex items-center justify-center text-[#f59e0b] opacity-40 cursor-not-allowed shadow-sm" title="Account Details — not available yet"><User className="w-3.5 h-3.5" /></div>
                                                 </div>

                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                    {/* Monthly Invoices Box — real query against /api/reports/invoice-entries (same contract as invoice-report.tsx), scoped to the current calendar month */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden mt-6 dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Monthly Invoices</CardTitle>
                        </CardHeader>

                        <CardContent className="p-6 bg-white dark:bg-zinc-900">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div className="flex flex-col gap-1.5 align-start">
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight h-4 dark:text-zinc-400">Show</span>
                                    <div className="flex items-center gap-2">
                                        <Select value={invoicePageSize} onValueChange={(v) => { setInvoicePageSize(v); setInvoicePage(1); }}>
                                            <SelectTrigger className="w-16 h-8 text-[13px] border-slate-200 focus:ring-0 dark:border-zinc-800">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight self-start mt-0.5 dark:text-zinc-400">entries</span>
                                </div>
                                <div className="flex flex-col gap-1 align-start self-end">
                                    <span className="text-[13px] text-slate-500 font-medium tracking-tight self-end dark:text-zinc-400">Search:</span>
                                    <Input
                                        value={invoiceSearch}
                                        onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1); }}
                                        className="h-8 w-48 border-slate-200 dark:border-zinc-800"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded border border-slate-100 dark:border-zinc-800">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 pl-4 text-left w-12 dark:text-zinc-300">No</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Company</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Invoice #</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Create</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Total</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-left dark:text-zinc-300">Status</TableHead>
                                            <TableHead className="text-[12px] font-bold text-slate-600 py-3 text-center pr-2 dark:text-zinc-300">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isInvoicesLoading ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400 text-[13px]">Loading...</TableCell></TableRow>
                                        ) : monthlyInvoices.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center py-6 text-slate-400 text-[13px]">No invoices created this month.</TableCell></TableRow>
                                        ) : monthlyInvoices.map((row: any, i: number) => (
                                            <TableRow key={row.id} className="hover:bg-slate-50 border-slate-100 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800">
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 pl-4 dark:text-zinc-300">{(invoicePage - 1) * parseInt(invoicePageSize) + i + 1}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 uppercase dark:text-zinc-300">{row.customerName}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 dark:text-zinc-300">{row.invoiceNumber}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 tabular-nums dark:text-zinc-300">{row.issueDate ? new Date(row.issueDate).toLocaleString() : "-"}</TableCell>
                                                <TableCell className="text-[13px] font-medium text-slate-600 py-3.5 tabular-nums dark:text-zinc-300">{row.currency || "USD"} {Number(row.total || 0).toFixed(2)}</TableCell>
                                                <TableCell className="py-3.5">
                                                    <span className={cn(
                                                        "text-[11px] font-bold px-2 py-0.5 rounded-full",
                                                        row.status === "Paid" ? "bg-emerald-50 text-emerald-600" : row.status === "Overdue" || row.status === "Cancelled" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                                                    )}>{row.status}</span>
                                                </TableCell>
                                                <TableCell className="py-3.5 text-center items-center justify-center flex">
                                                    <div className="h-5 w-5 rounded-full border-[1.5px] border-[#059669]/60 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800" onClick={() => { setSelectedInvoice(row); setInvoiceDialogOpen(true); }}>
                                                        <Eye className="h-3 w-3 text-emerald-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-6 gap-4 border-t border-slate-50 pt-4 dark:border-zinc-800">
                                <span className="text-[13.5px] text-slate-500 font-medium dark:text-zinc-400">
                                    Showing {monthlyInvoicesTotal === 0 ? 0 : (invoicePage - 1) * parseInt(invoicePageSize) + 1} to {Math.min(invoicePage * parseInt(invoicePageSize), monthlyInvoicesTotal)} of {monthlyInvoicesTotal} entries
                                </span>
                                <div className="flex items-center border border-slate-200 rounded overflow-hidden dark:border-zinc-800">
                                    <button
                                        onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                                        disabled={invoicePage === 1}
                                        className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-r border-slate-200 disabled:opacity-40 disabled:pointer-events-none dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-3.5 py-1.5 bg-[#059669] text-white text-[13px] font-bold">{invoicePage}</span>
                                    <button
                                        onClick={() => setInvoicePage((p) => (p * parseInt(invoicePageSize) < monthlyInvoicesTotal ? p + 1 : p))}
                                        disabled={invoicePage * parseInt(invoicePageSize) >= monthlyInvoicesTotal}
                                        className="px-3.5 py-1.5 bg-white text-slate-500 text-[13px] font-medium hover:bg-slate-50 transition-colors border-l border-slate-200 disabled:opacity-40 disabled:pointer-events-none dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-800"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Cards (4 columns) */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Projects Overview */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Projects Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 gap-2">
                                <div
                                    onClick={() => setActiveView("overtime")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800 dark:group-hover:text-zinc-100">Over Time</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-report")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800 dark:group-hover:text-zinc-100">Domain Report</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-list")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800 dark:group-hover:text-zinc-100">Domain List</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                                <div
                                    onClick={() => setActiveView("domain-backup")}
                                    className="bg-slate-50 hover:bg-slate-100 transition-colors p-2.5 px-3 flex justify-between items-center cursor-pointer text-[13px] text-slate-600 group dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                >
                                    <span className="font-medium group-hover:text-slate-800 dark:group-hover:text-zinc-100">Domain Backup</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Important */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Important</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 bg-white dark:bg-zinc-900">
                            <div className="grid grid-cols-2 text-[13px]">
                                {/* Total Hosting — no hosting-usage/billing tracking exists yet */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Total Hosting</span>
                                    <span className="text-slate-400 font-semibold md:ml-2 dark:text-zinc-500">—</span>
                                </div>
                                {/* Total Use — no usage tracking exists yet */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Total Use</span>
                                    <span className="text-slate-400 font-semibold md:ml-2 dark:text-zinc-500">—</span>
                                </div>
                                {/* Server */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Server</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">{itServers.length}</span>
                                </div>
                                {/* Registry */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Registry</span>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-semibold md:ml-2">{itRegistries.length}</span>
                                </div>
                                {/* Hosting Pkg */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Hosting Pkg</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">{itHostingPackages.length}</span>
                                </div>
                                {/* Pending — no clear real concept identified yet */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Pending</span>
                                    <span className="text-slate-400 font-semibold md:ml-2 dark:text-zinc-500">—</span>
                                </div>
                                {/* Leave Application — no real leave-application backend exists yet */}
                                <div
                                    onClick={() => setActiveView("leave-application")}
                                    className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-b border-slate-100 cursor-pointer group dark:hover:bg-zinc-800 dark:border-zinc-800"
                                >
                                    <span className="text-slate-500 font-medium group-hover:text-slate-700 dark:text-zinc-400">Leave Application</span>
                                    <span className="text-slate-700 font-semibold md:ml-2 dark:text-zinc-400">0</span>
                                </div>
                                {/* Dollar Rate — no single live exchange-rate source exists yet */}
                                <div className="flex flex-col sm:flex-row justify-between p-3.5 bg-slate-50/50 dark:bg-zinc-900 hover:bg-slate-50 transition-colors border-l border-b border-slate-100 dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <span className="text-slate-500 font-medium dark:text-zinc-400">Dollar Rate</span>
                                    <span className="text-slate-400 font-semibold md:ml-2 dark:text-zinc-500">—</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activities */}
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Activities</CardTitle>
                            <Select defaultValue="td">
                                <SelectTrigger className="w-20 h-8 bg-white text-[13px] font-medium border-slate-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="td">TD</SelectItem>
                                    <SelectItem value="all">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-6 bg-white dark:bg-zinc-900">
                            {/* Pie Chart */}
                            <div className="h-[200px] w-full mb-6 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activitiesData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {activitiesData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: 'hsl(var(--card))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-700 dark:text-zinc-400">
                                    <Activity className="h-6 w-6 text-slate-400 mb-1 opacity-50" />
                                </div>
                            </div>

                            {/* Progress Bars */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Total Project</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">{domains.length}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-[#10b981] w-full rounded-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Complete</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">0</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-200 w-0 rounded-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Pending</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">{expiringSoonCount}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-[#34d399] rounded-full" style={{ width: `${activitiesPct(expiringSoonCount)}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Delay</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">{expiredDomainsCount}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-400 rounded-full dark:bg-zinc-600" style={{ width: `${activitiesPct(expiredDomainsCount)}%` }}></div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[13px]">
                                        <span className="text-slate-600 font-medium dark:text-zinc-300">Free</span>
                                        <span className="text-slate-800 font-bold dark:text-zinc-100">{activitiesFreeCount}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden dark:bg-zinc-900">
                                        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${activitiesPct(activitiesFreeCount)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Expire Domains - Full Width */}
                <div className="col-span-12 mt-6">
                    <Card className="border-none shadow-sm rounded-sm bg-white overflow-hidden dark:bg-zinc-900">
                        <CardHeader className="py-4 px-6 border-b border-slate-50 bg-white flex flex-row items-center justify-between space-y-0 dark:bg-zinc-900 dark:border-zinc-800">
                            <CardTitle className="text-[15px] font-bold text-slate-700 dark:text-zinc-400">Expire Domains</CardTitle>
                            <Select value={expireDomainsScope} onValueChange={(v) => setExpireDomainsScope(v as "1mh" | "3mh" | "6mh" | "12mh")}>
                                <SelectTrigger className="w-24 h-8 bg-white text-[13px] font-medium border-slate-200 focus:ring-0 dark:bg-zinc-900 dark:border-zinc-800">
                                    <SelectValue placeholder="1 MH" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1mh">1 MH</SelectItem>
                                    <SelectItem value="3mh">3 MH</SelectItem>
                                    <SelectItem value="6mh">6 MH</SelectItem>
                                    <SelectItem value="12mh">12 MH</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent className="p-0 bg-white dark:bg-zinc-900">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[1400px]">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-zinc-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-emerald-50/20 dark:bg-none dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800">
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">No#</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Domain</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Type</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Day</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Register Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">First Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Expire Date</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">D/H$</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">T$</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">O$R</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">O/Pkr</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">N$R</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">N/Pkr</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap dark:text-zinc-300">Inv/Rep</th>
                                            <th className="text-[11px] font-bold text-slate-600 py-3 px-3 whitespace-nowrap text-center dark:text-zinc-300">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[11px]">
                                        {expireDomainsRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={15} className="py-8 px-3 text-center text-slate-400 dark:text-zinc-500">
                                                    No domains expiring in this window.
                                                </td>
                                            </tr>
                                        ) : (
                                            expireDomainsRows.map((row, i) => (
                                            <tr key={row.no} className={`border-b border-slate-100 dark:border-slate-700/60 hover:bg-slate-50/50 dark:bg-zinc-900/50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-900/30' : ''}`}>
                                                <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.no}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-600 whitespace-nowrap dark:text-zinc-300">{row.domain}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap dark:text-zinc-400">{row.type}</td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap dark:text-zinc-400">{row.day}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.regDate}</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-500 whitespace-nowrap tabular-nums dark:text-zinc-400">{row.firstDate}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                                                    <span className="font-medium text-[#ef4444]">{row.expDate}</span>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap tabular-nums dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 font-medium text-slate-400 whitespace-nowrap dark:text-zinc-500">—</td>
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <div
                                                        className="h-5 w-5 rounded-full border-[1.5px] border-[#059669]/60 flex items-center justify-center cursor-pointer hover:bg-[#059669]/10 transition-colors mx-auto dark:border-zinc-800"
                                                        onClick={() => setRenewDomainOpen(true)}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                                                    </div>
                                                </td>
                                            </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Renew Domain Modal */}
            <Dialog open={renewDomainOpen} onOpenChange={setRenewDomainOpen}>
                <DialogContent className="sm:max-w-[500px] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between dark:border-zinc-800">
                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[18px] font-bold tracking-tight">Renew Domain</h3>
                        <button onClick={() => setRenewDomainOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Company</label>
                            <Input className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Domain</label>
                            <Input className="h-10 border-slate-200 text-[#475569] font-medium bg-[#f0fdf4] focus-visible:ring-0 shadow-sm dark:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Expire</label>
                            <Input type="date" placeholder="yyyy-m-d" className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus-visible:ring-1 focus-visible:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800" />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[14px] font-semibold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">Active</label>
                            <Select defaultValue="choose">
                                <SelectTrigger className="h-10 border-slate-200 text-[#475569] font-medium bg-white focus:ring-1 focus:ring-[#059669]/50 shadow-sm dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800">
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="choose" className="text-slate-500 font-medium dark:text-zinc-400">Choose...</SelectItem>
                                    <SelectItem value="active" className="text-slate-700 font-medium dark:text-zinc-400">Active</SelectItem>
                                    <SelectItem value="inactive" className="text-slate-700 font-medium dark:text-zinc-400">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 dark:border-zinc-800">
                        <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setRenewDomainOpen(false)}>
                            Close
                        </button>
                        <button className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors" onClick={() => setRenewDomainOpen(false)}>
                            Save
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invoice Preview Dialog */}
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[90vh] p-0 border-none shadow-2xl rounded-[8px] overflow-hidden bg-white [&>button]:hidden dark:bg-zinc-900">
                    <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 dark:bg-zinc-900 dark:border-zinc-800">
                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[16px] font-bold tracking-tight">Invoice Preview</h3>
                        <button onClick={() => setInvoiceDialogOpen(false)} className="rounded-full p-1 opacity-70 hover:opacity-100 hover:bg-slate-100 transition-colors cursor-pointer dark:hover:bg-zinc-800">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 dark:text-zinc-400"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div className="overflow-y-auto max-h-[calc(90vh-120px)]" id="invoice-print-area">
                        <div className="p-8 bg-white dark:bg-zinc-900" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {/* Header with Logo and Invoice Info */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-[#2d8f4e] rounded-full flex items-center justify-center text-white font-bold text-[14px]">W</div>
                                    <div>
                                        <h2 className="text-[18px] font-extrabold text-[#1a1a1a] leading-tight tracking-tight dark:text-zinc-100" style={{ fontFamily: 'Impact, sans-serif' }}>WEB EXCELS</h2>
                                        <p className="text-[8px] text-slate-500 italic -mt-0.5 dark:text-zinc-400">Design, Development & Marketing</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] text-[#ef4444] font-bold">Invoice No: {selectedInvoice?.invoiceNumber}</p>
                                    <p className="text-[11px] bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 font-bold">Date: {selectedInvoice?.issueDate ? new Date(selectedInvoice.issueDate).toLocaleString() : "-"}</p>
                                </div>
                            </div>

                            {/* INVOICE Title */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-[6px] flex-1 bg-[#2d8f4e] rounded"></div>
                                <h1 className="text-[28px] font-black tracking-[3px] text-[#1a1a1a] dark:text-zinc-100" style={{ fontFamily: 'Impact, sans-serif' }}>{selectedInvoice?.status === "Draft" ? "QUOTATION" : "INVOICE"}</h1>
                                <div className="h-[6px] flex-1 bg-[#2d8f4e] rounded"></div>
                            </div>

                            {/* From / To */}
                            <div className="flex justify-between mb-6 gap-8">
                                <div className="text-[11px] text-slate-700 space-y-0.5 dark:text-zinc-400">
                                    <p className="font-bold text-[12px] text-slate-800 dark:text-zinc-100">From:</p>
                                    <p className="font-semibold">Web Excels</p>
                                    <p>+92-334-8086611 (Whatsapp)</p>
                                    <p>+92-52-4271592</p>
                                    <p className="text-blue-600">Support@webexcels.com</p>
                                    <p className="mt-1 text-[10px] leading-tight text-slate-500 dark:text-zinc-400">Al-Amin Center, Paris Rd, Opposite The<br />Sialkot Chamber Of Commerce, Sialkot<br />51310 Pakistan.</p>
                                </div>
                                <div className="text-[11px] text-slate-700 space-y-0.5 text-right dark:text-zinc-400">
                                    <p className="font-bold text-[12px] text-slate-800 dark:text-zinc-100">To:</p>
                                    <p className="font-semibold">{selectedInvoice?.customerName}</p>
                                    {selectedInvoice?.customerEmail && <p><span className="font-semibold">Email:</span>{selectedInvoice.customerEmail}</p>}
                                    {selectedInvoice?.customerAddress && <p><span className="font-semibold">Address:</span>{selectedInvoice.customerAddress}</p>}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="border border-slate-200 rounded overflow-hidden mb-4 dark:border-zinc-800">
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="bg-[#2d8f4e] text-white">
                                            <th className="py-2 px-3 text-left font-bold w-10">Sl.</th>
                                            <th className="py-2 px-3 text-left font-bold">Item Description</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Price</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Quantity</th>
                                            <th className="py-2 px-3 text-center font-bold w-16">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            let previewItems: any[] = [];
                                            try { previewItems = JSON.parse(selectedInvoice?.items || "[]"); } catch { previewItems = []; }
                                            if (previewItems.length === 0) {
                                                return <tr><td colSpan={5} className="py-3 px-3 text-center text-slate-400">No line items</td></tr>;
                                            }
                                            return previewItems.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-t border-slate-100 dark:border-zinc-800">
                                                    <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-zinc-300">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-100">{item.detail || item.desc || "Service"}</td>
                                                    <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-zinc-300">${Number(item.unitPrice ?? item.price ?? 0).toFixed(2)}</td>
                                                    <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-zinc-300">{item.quantity ?? item.qty}</td>
                                                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-zinc-400">{Number(item.total ?? 0).toFixed(2)}</td>
                                                </tr>
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div className="flex justify-end mb-6">
                                <div className="space-y-1.5 text-[12px] text-right min-w-[220px]">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-700 dark:text-zinc-400">Sub Total:</span>
                                        <span className="font-bold text-slate-800 dark:text-zinc-100">{selectedInvoice?.currency || "USD"} {Number(selectedInvoice?.subtotal || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-700 dark:text-zinc-400">Tax:</span>
                                        <span className="font-bold text-[#f97316]">{selectedInvoice?.currency || "USD"} {Number(selectedInvoice?.tax || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between bg-[#2d8f4e] text-white px-3 py-1.5 rounded mt-1">
                                        <span className="font-bold">Total:</span>
                                        <span className="font-bold">{selectedInvoice?.currency || "USD"} {Number(selectedInvoice?.total || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t-2 border-[#2d8f4e] pt-3 mt-6 dark:border-zinc-800">
                                <p className="text-center text-[10px] text-slate-500 font-medium dark:text-zinc-400">
                                    This <span className="text-[#ef4444] font-bold">{selectedInvoice?.status === "Draft" ? "Quotation" : "Invoice"}</span> Only For <span className="font-bold text-slate-700 dark:text-zinc-400">{selectedInvoice?.customerName}</span>. Copyright 2026 Reserved By <span className="font-bold text-slate-700 dark:text-zinc-400">Webexcels</span>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end gap-3 bg-white sticky bottom-0 dark:bg-zinc-900 dark:border-zinc-800">
                        <button className="px-5 py-2.5 bg-white hover:bg-slate-50 text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 text-[14px] font-bold rounded-[6px] border border-slate-200 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800" onClick={() => setInvoiceDialogOpen(false)}>
                            Close
                        </button>
                        <button
                            className="px-5 py-2.5 bg-[#059669] hover:bg-[#047857] text-white text-[14px] font-bold rounded-[6px] shadow-sm transition-colors"
                            onClick={() => {
                                const printArea = document.getElementById('invoice-print-area');
                                if (printArea) {
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write('<html><head><title>Invoice #' + (selectedInvoice?.invoiceNumber || '') + '</title><style>body{margin:0;padding:20px;font-family:Arial,sans-serif}@media print{body{padding:0}}</style></head><body>');
                                        printWindow.document.write(printArea.innerHTML);
                                        printWindow.document.write('</body></html>');
                                        printWindow.document.close();
                                        printWindow.focus();
                                        setTimeout(() => printWindow.print(), 300);
                                    }
                                }
                            }}
                        >
                            Print
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
